from flask import Flask, request, render_template, redirect, url_for, jsonify, session
import os
import sys
import json
from datetime import datetime
from dotenv import load_dotenv
from dbconnection import dbactivities
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
    'db_port': os.environ['DB_PORT']
}

# Global variables
current_query = ''
current_table = 'nothing'
time_difference = 0

def get_conversation_history():
    """Get structured conversation history from session"""
    return session.get('conversation_history', [])

def add_to_history(user_query, sql_query, model_used, time_taken, status='generated'):
    """Add a new conversation entry to history with proper structure"""
    history = get_conversation_history()
    
    new_entry = {
        'id': len(history) + 1,
        'timestamp': datetime.now().isoformat(),
        'user_query': user_query,
        'sql_query': sql_query,
        'model_used': model_used,
        'time_taken': time_taken,
        'status': status,  # generated, executed, error
        'database': connectionstring['Database']
    }
    
    history.append(new_entry)
    
    # Keep only last 50 conversations to prevent session bloat
    if len(history) > 50:
        history = history[-50:]
    
    session['conversation_history'] = history
    return new_entry

def format_history_for_llm():
    """Format history for LLM context (backward compatibility)"""
    history = get_conversation_history()
    if not history:
        return ""
    
    # Take last 10 conversations for context
    recent_history = history[-10:]
    formatted = []
    
    for entry in recent_history:
        if entry['status'] != 'error':
            formatted.append(f"User: {entry['user_query']}")
            formatted.append(f"SQL: {entry['sql_query']}")
    
    return "\n".join(formatted)

@app.route('/')
def index():
    """Main index page with enhanced model selection"""
    normalized_data = json.dumps(db_schema)
    normalized_data = json.loads(normalized_data)
    databases = dbcon.get_databases()
    
    # Get available models
    available_models = llm_model.get_available_models()
    
    # Get structured chat history
    chat_history = get_conversation_history()
    
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
        
        # Get conversation history for LLM context
        history = format_history_for_llm()
        
        # Generate query
        response, time_taken = llm_model.generate_query(
            schema, query, history, model_provider, model_name
        )
        
        # Determine status
        status = 'error' if (response and (response.startswith("Error") or response.startswith("I can only help"))) else 'generated'
        
        # Add to structured history
        model_used = f"{model_provider}:{model_name}"
        entry = add_to_history(query, response, model_used, round(time_taken / 60, 4), status)
        
        # Store current query and time
        global current_query, time_difference
        current_query = response
        time_difference = round(time_taken / 60, 4)
        
        return {
            'success': True,
            'query': response, 
            'time': time_difference,
            'model_used': model_used,
            'history_entry': entry
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
            session.pop('conversation_history', None)
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
        
        # Update the last history entry status to executed
        history = get_conversation_history()
        if history:
            history[-1]['status'] = 'executed'
            session['conversation_history'] = history
        
        global time_difference
        chat_history = get_conversation_history()
        
        return render_template('output.html', 
                             db_data=current_query, 
                             positions=indices, 
                             output=table, 
                             gpt_metadata={'tokens': 0, 'time_taken': time_difference}, 
                             chat_history=chat_history)
                             
    except Exception as e:
        # Update history entry status to error
        history = get_conversation_history()
        if history:
            history[-1]['status'] = 'error'
            history[-1]['error_message'] = str(e)
            session['conversation_history'] = history
            
        return render_template('error.html', 
                             error_message=f"Query execution failed: {str(e)}",
                             db_data=connectionstring)

@app.route('/render_dashboard')
def render_dashboard():
    """Render PyGWalker dashboard"""
    try:
        walker_html = "Dashboard feature is currently disabled."
        return walker_html
    except Exception as e:
        return f"Dashboard generation failed: {str(e)}", 500

@app.route('/history_management', methods=['GET', 'POST'])
def history_management():
    """Manage conversation history"""
    if request.method == 'GET':
        action = request.args.get('action', 'get')
        
        if action == 'get':
            return {
                'success': True,
                'history': get_conversation_history(),
                'count': len(get_conversation_history())
            }
        elif action == 'export':
            history = get_conversation_history()
            export_data = {
                'export_timestamp': datetime.now().isoformat(),
                'database': connectionstring['Database'],
                'conversation_count': len(history),
                'conversations': history
            }
            return {
                'success': True,
                'data': export_data,
                'filename': f"querychakra_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            }
    
    elif request.method == 'POST':
        content = request.get_json()
        action = content.get('action')
        
        if action == 'delete':
            entry_id = content.get('entry_id')
            history = get_conversation_history()
            history = [entry for entry in history if entry['id'] != entry_id]
            session['conversation_history'] = history
            return {'success': True, 'message': 'Entry deleted'}
            
        elif action == 'clear_all':
            session.pop('conversation_history', None)
            return {'success': True, 'message': 'All history cleared'}
            
        elif action == 'import':
            import_data = content.get('data', [])
            if isinstance(import_data, list):
                session['conversation_history'] = import_data
                return {'success': True, 'message': f'Imported {len(import_data)} conversations'}
            else:
                return {'success': False, 'error': 'Invalid import data format'}, 400
    
    return {'success': False, 'error': 'Invalid request'}, 400

@app.route('/reset_history', methods=['GET', 'POST'])
def reset_history():
    """Clear conversation history (backward compatibility)"""
    session.pop('conversation_history', None)
    return redirect(url_for('index'))

@app.route('/export_history')
def export_history():
    """Export conversation history as JSON (backward compatibility)"""
    try:
        history = get_conversation_history()
        export_data = {
            'export_timestamp': datetime.now().isoformat(),
            'database': connectionstring['Database'],
            'conversation_count': len(history),
            'conversations': history
        }
        return {
            'success': True,
            'history': export_data,
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
    port=int(os.environ.get('PORT', 5000))
    print("port",port)
    app.run(debug=True, host='0.0.0.0', port=port)