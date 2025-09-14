import os
import time 
from dotenv import load_dotenv
import ollama
import requests
from groq import Groq
import re

class LLM:
    def __init__(self):
        # Enhanced prompt with strict DB focus and anti-hallucination measures
        self.template = '''[INST] You are a specialized SQL query generator with STRICT limitations:

CRITICAL RULES:
1. You ONLY generate SQL queries for database operations
2. You MUST NOT answer any non-database related questions
3. If asked about anything other than SQL/database operations, respond with: "I can only help with SQL database queries."
4. NEVER provide general knowledge, programming advice, or personal opinions

TASK: Given the user's natural language input and database schema, generate a precise SQL Server query.

USER INPUT: {prompt}

DATABASE SCHEMA: {schema}

REQUIREMENTS:
- Use SQL Server syntax ONLY
- Reference ONLY the provided tables and columns
- If the user's request cannot be translated to a valid SQL query using the given schema, ask for clarification
- If the user asks about topics outside of database querying, decline politely
- Always wrap your SQL code in ``` markers
- Provide ONLY the SQL query, no explanations unless explicitly requested

RESPOND WITH ONLY:
1. The SQL query in ``` blocks
2. OR clarification questions about the database query
3. OR the decline message for non-DB topics

[/INST]'''
        
        nv_path = os.path.join(os.path.dirname(__file__), 'config', '.env')
        load_dotenv(dotenv_path=nv_path)
        
        # Model configurations
        self.models = {
            'ollama': [
                # 'codellama:7b-instruct',
                # 'llama3.1:8b',
                # 'sqlcoder:7b'
                # 'qwen3:1.7b'
                'gemma3:1b'
            ],
            'groq': [
                'llama-3.1-8b-instant',
                'openai/gpt-oss-20b',
                'llama-3.3-70b-versatile'
            ]
        }
        
        # Initialize Groq client
        self.groq_api_key = os.environ.get('GROQ_API_KEY')
        if self.groq_api_key:
            self.groq_client = Groq(api_key=self.groq_api_key)
        else:
            self.groq_client = None

    def get_available_models(self):
        """Return available models for both providers"""
        available = {'ollama': [], 'groq': []}
        
        # Check Ollama models
        try:
            ollama_response = ollama.list()
            print(f"Debug - Ollama response: {ollama_response}")  # Debug log
            
            if 'models' in ollama_response:
                available_ollama = []
                for model in ollama_response['models']:
                    # Handle different possible key names
                    model_name = model.get('name') or model.get('model') or model.get('id', '')
                    if model_name:
                        available_ollama.append(model_name)
                
                # Filter to only include models we support
                available['ollama'] = [model for model in self.models['ollama'] 
                                     if any(model.split(':')[0] in avail for avail in available_ollama)]
            else:
                available['ollama'] = []
                
        except Exception as e:
            print(f"Ollama not available: {e}")
            available['ollama'] = []
        
        # Check Groq availability
        if self.groq_client:
            available['groq'] = self.models['groq']
        else:
            available['groq'] = []
            
        print(f"Debug - Available models: {available}")  # Debug log
        return available

    def validate_query_intent(self, query):
        """Validate if the query is database-related"""
        db_keywords = [
            'select', 'insert', 'update', 'delete', 'table', 'database', 'query', 'sql',
            'where', 'join', 'group by', 'order by', 'count', 'sum', 'avg', 'max', 'min',
            'show me', 'find', 'get', 'retrieve', 'data', 'records', 'rows', 'columns'
        ]
        
        non_db_patterns = [
            'weather', 'news', 'recipe', 'movie', 'music', 'sports', 'politics',
            'health', 'travel', 'shopping', 'gaming', 'entertainment',
            'what is', 'who is', 'when did', 'how to', 'tell me about'
        ]
        
        query_lower = query.lower()
        
        # Check for obvious non-DB patterns
        for pattern in non_db_patterns:
            if pattern in query_lower and not any(keyword in query_lower for keyword in db_keywords):
                return False, "I can only help with SQL database queries. Please ask about your database data."
        
        return True, None

    def generate_query(self, schema, query, history, model_provider, model_name):
        """Generate SQL query using specified model and provider"""
        start_time = time.time()
        
        # Validate query intent first
        is_valid, error_msg = self.validate_query_intent(query)
        if not is_valid:
            return error_msg, abs(time.time() - start_time)
        
        try:
            template = self.template.replace("{schema}", schema).replace("{prompt}", query)
            
            if model_provider == 'ollama':
                return self._generate_with_ollama(template, history, model_name, start_time)
            elif model_provider == 'groq':
                return self._generate_with_groq(template, history, model_name, start_time)
            else:
                return "Invalid model provider specified.", abs(time.time() - start_time)
                
        except Exception as e:
            return f"Error generating query: {str(e)}", abs(time.time() - start_time)

    def _generate_with_ollama(self, template, history, model_name, start_time):
        """Generate query using Ollama"""
        messages = []
        if history:
            messages.append({'role': 'system', 'content': history})
        messages.append({'role': 'user', 'content': template})
        
        try:
            stream = ollama.chat(
                model=model_name,
                messages=messages,
                stream=True,
                options={
                    'temperature': 0.1,  # Low temperature for consistent SQL generation
                    'top_p': 0.9,
                    'stop': ['[INST]', '[/INST]']  # Stop tokens to prevent rambling
                }
            )
            
            response = ""
            for chunk in stream:
                response += chunk['message']['content']
                
            # Post-process response to extract SQL
            response = self._post_process_response(response)
            
            end_time = time.time()
            return response, abs(start_time - end_time)
            
        except Exception as e:
            return f"Ollama error: {str(e)}", abs(time.time() - start_time)

    def _generate_with_groq(self, template, history, model_name, start_time):
        """Generate query using Groq"""
        if not self.groq_client:
            return "Groq API key not configured.", abs(time.time() - start_time)
        
        try:
            messages = []
            if history:
                messages.append({"role": "system", "content": history})
            messages.append({"role": "user", "content": template})
            
            chat_completion = self.groq_client.chat.completions.create(
                messages=messages,
                model=model_name,
                temperature=0.1,  # Low temperature for consistent SQL generation
                max_tokens=1024,
                top_p=0.9,
                stop=['[INST]', '[/INST]']  # Stop tokens
            )
            
            response = chat_completion.choices[0].message.content
            response = self._post_process_response(response)
            
            end_time = time.time()
            return response, abs(start_time - end_time)
            
        except Exception as e:
            return f"Groq error: {str(e)}", abs(time.time() - start_time)

    def _post_process_response(self, response):
        """Post-process the response to clean up and validate"""
        # Check if response is a decline for non-DB topics
        decline_indicators = [
            "I can only help with SQL",
            "database queries only",
            "not related to database"
        ]
        
        if any(indicator.lower() in response.lower() for indicator in decline_indicators):
            return "I can only help with SQL database queries. Please ask about your database data."
        
        # Try to extract SQL from code blocks
        code_match = re.search(r'```(?:sql)?\s*\n?(.*?)\n?```', response, re.DOTALL | re.IGNORECASE)
        if code_match:
            return code_match.group(1).strip()
        
        # If no code blocks found, check if it looks like SQL
        if any(keyword in response.upper() for keyword in ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH']):
            # Clean up the response
            cleaned = re.sub(r'^[^A-Z]*?(SELECT|INSERT|UPDATE|DELETE|WITH)', r'\1', response, flags=re.IGNORECASE | re.MULTILINE)
            return cleaned.strip()
        
        # If it doesn't look like SQL, it might be a clarification question
        return response.strip()