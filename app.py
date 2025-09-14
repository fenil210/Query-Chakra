from flask import Flask, request, render_template, redirect, url_for, jsonify, session
import os
import sys
import json
from dotenv import load_dotenv
from dbconnection import dbactivities
import pygwalker as pyg
import pandas as pd 
from llama import LLM 
import time 
import pymssql 
from flask import session

nv_path = os.path.join(os.path.dirname(__file__), 'config', '.env')
load_dotenv(dotenv_path=nv_path)

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.environ['FLASK_KEY']

# Initialize components
dbcon = dbactivities()
llm_model = LLM() 

# Get database schema
db_schema = dbcon.index()
print('SQL data fetched successfully')

# Connection info
connectionstring = {
    'Database': os.environ['DB'],
    'user': os.environ['USER'],
    'host': os.environ['HOST'],
    'port': os.environ['PORT']
}

# Global variables
current_query = ''
current_table = 'nothing'
time_difference = 0

@app.route('/')
def index():
    """Main index page with enhanced model selection"""
    normalized_data = json.dumps(db_schema)
    normalized_data = json.loads(normalized_data)
    databases = dbcon.get_databases()
    
    # Get available models
    available_models = llm_model.get_available_models()
    
    # Get chat history
    chat_history = session.get('history', "").split("\n") if session.get('history') else []
    chat_history = [msg.strip() for msg in chat_history if msg.strip()]  # Clean empty messages
    
    return render_template(
        'index.html', 
        json_data=normalized_data, 
        db_data=connectionstring, 
        dbs=databases, 
        chat_history=chat_history,
        available_models=available_models
    )

@app.route('/process_textarea', methods=['POST'])
def process_textarea():
    """Process user query with selected model"""
    try:
        content = request.get_json()
        
        # Validate required fields
        required_fields = ['schema', 'query', 'model_provider', 'model_name']
        for field in required_fields:
            if field not in content or not content[field]:
                return {
                    'success': False,
                    'error': f'Missing required field: {field}'
                }, 400
        
        schema = content['schema']
        query = content['query']
        model_provider = content['model_provider']
        model_name = content['model_name']
        
        # Get conversation history
        history = session.get('history', "")
        
        # Generate query
        response, time_taken = llm_model.generate_query(
            schema, query, history, model_provider, model_name
        )
        
        # Update session history
        if response and not response.startswith("Error") and not response.startswith("I can only help"):
            new_entry = f"User: {query}\nSQL: {response}"
            session['history'] = history + "\n" + new_entry if history else new_entry
        
        # Store current query and time
        global current_query, time_difference
        current_query = response
        time_difference = round(time_taken / 60, 4)  # More precision
        
        return {
            'success': True,
            'query': response, 
            'time': time_difference,
            'model_used': f"{model_provider}:{model_name}"
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Processing error: {str(e)}'
        }, 500

@app.route('/validate_query', methods=['POST'])
def validate_query():
    """Validate if query is database-related"""
    try:
        content = request.get_json()
        query = content.get('query', '')
        
        is_valid, error_msg = llm_model.validate_query_intent(query)
        
        return {
            'valid': is_valid,
            'message': error_msg if not is_valid else 'Query is valid'
        }
        
    except Exception as e:
        return {
            'valid': False,
            'message': f'Validation error: {str(e)}'
        }, 500

@app.route('/get_models')
def get_models():
    """Get available models for both providers"""
    try:
        available_models = llm_model.get_available_models()
        return {
            'success': True,
            'models': available_models
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }, 500

@app.route('/change_db', methods=['POST'])
def change_db():
    """Change database connection"""
    try:
        content = request.get_json()
        db = content['database']
        global connectionstring, db_schema
        
        if db == connectionstring['Database']:
            return {'status': 300, 'msg': 'no need to change'}
        else:
            dbcon.switch_db(db)
            connectionstring['Database'] = db
            db_schema = dbcon.index()
            # Clear history when switching databases
            session.pop('history', None)
            return {'status': 200, 'msg': 'changed successfully'}
            
    except Exception as e:
        return {'status': 600, 'msg': str(e)}
    
@app.route('/clean_query', methods=['POST'])
def clean_query():
    """Clean and prepare query for execution"""
    try:
        content = request.get_json()
        global current_query
        current_query = content['query']
        return {'success': True, 'message': 'Query cleaned successfully'}
    except Exception as e:
        return {'success': False, 'error': str(e)}, 500

@app.route('/output_page')
def output_page():
    """Display query results"""
    try:
        if not current_query or current_query.strip() == '':
            return redirect(url_for('index'))
        
        # Check if current_query is actually an SQL query
        if current_query.startswith("I can only help") or current_query.startswith("Error"):
            return render_template('error.html', 
                                 error_message=current_query,
                                 db_data=connectionstring)
        
        table = json.loads(dbcon.query_outputs(current_query))
        global current_table
        current_table = table
        
        columns = list(table.keys())
        indices = list(table[columns[0]].keys()) if columns and table[columns[0]] else []
        
        global time_difference
        chat_history = session.get('history', "").split("\n") if session.get('history') else []
        chat_history = [msg.strip() for msg in chat_history if msg.strip()]
        
        return render_template('output.html', 
                             db_data=current_query, 
                             positions=indices, 
                             output=table, 
                             gpt_metadata={'tokens': 0, 'time_taken': time_difference}, 
                             chat_history=chat_history)
                             
    except Exception as e:
        return render_template('error.html', 
                             error_message=f"Query execution failed: {str(e)}",
                             db_data=connectionstring)

@app.route('/render_dashboard')
def render_dashboard():
    """Render PyGWalker dashboard"""
    try:
        if isinstance(current_table, pd.DataFrame):
            df = current_table
        else:
            df = pd.DataFrame(current_table)
            
        walker = pyg.walk(df, hideDataSourceConfig=True)
        walker_html = walker.to_html()
        return walker_html
    except Exception as e:
        return f"Dashboard generation failed: {str(e)}", 500

@app.route('/reset_history', methods=['GET', 'POST'])
def reset_history():
    """Clear conversation history"""
    session.pop('history', None)
    return redirect(url_for('index'))

@app.route('/export_history')
def export_history():
    """Export conversation history as JSON"""
    try:
        history = session.get('history', "")
        return {
            'success': True,
            'history': history,
            'timestamp': time.time()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}, 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return render_template('error.html', 
                         error_message="Page not found",
                         db_data=connectionstring), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('error.html', 
                         error_message="Internal server error",
                         db_data=connectionstring), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)