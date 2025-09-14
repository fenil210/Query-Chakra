# QueryChakra - Natural Language to SQL

QueryChakra is an intelligent web application that converts natural language queries into SQL statements using AI models. It provides an intuitive interface for database interaction, conversation history management, and query execution with support for multiple AI providers.


ACCESS IT FROM HERE : https://query-chakra-gcp-e1t8.onrender.com/

## Features

### Core Functionality

- **Natural Language to SQL Conversion**: Transform plain English questions into optimized SQL queries
- **Multi-Provider AI Support**: Choose between Ollama (local) and Groq (cloud) AI models
- **Query Validation**: Built-in validation to ensure database-related queries
- **SQL Execution**: Execute generated queries directly against your database
- **Real-time Results**: View query results in formatted tables with export options

### Enhanced User Experience

- **Conversation History**: Persistent chat-like interface with conversation management
- **Model Selection**: Dynamic model provider and model selection with real-time availability
- **Database Schema Visualization**: Interactive table schema browser with filtering
- **Multi-Database Support**: Switch between different databases seamlessly
- **Responsive Design**: Mobile-friendly interface with modern UI/UX

### Advanced Features

- **History Management**: Export, import, and manage conversation history
- **Query Reuse**: Copy and reuse previous queries with one click
- **Status Tracking**: Track query generation, execution, and error states
- **Keyboard Shortcuts**: Productivity shortcuts for power users
- **Auto-save**: Automatic saving of work in progress

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript (jQuery)
- **Styling**: Tailwind CSS
- **Database**: MySQL with SQLAlchemy ORM
- **AI Models**: Ollama, Groq API
- **Deployment**: Render (Web Service) + Google Cloud Platform (Database)

## Installation

### Prerequisites

- Python 3.8+
- MySQL database
- Ollama (optional, for local AI models)
- Groq API key (optional, for cloud AI models)

### Local Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/querychakra.git
cd querychakra
```

2. **Install dependencies**

```bash
pip install -r requirements.txt
```

3. **Set up environment variables**
   Create a `.env` file in the `config/` directory:

```env
# Database Configuration
DB=your_database_name
USER=your_db_username
PASSWORD=your_db_password
HOST=your_db_host
DB_PORT=3306

# Flask Configuration
FLASK_KEY=your_secret_key

# AI Model APIs (Optional)
GROQ_API_KEY=your_groq_api_key
```

4. **Initialize the database**
   Ensure your MySQL database is running and accessible with the provided credentials.
5. **Run the application**

```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Configuration

### Environment Variables

| Variable         | Description       | Required | Default  |
| ---------------- | ----------------- | -------- | -------- |
| `DB`           | Database name     | Yes      | -        |
| `USER`         | Database username | Yes      | -        |
| `PASSWORD`     | Database password | Yes      | -        |
| `HOST`         | Database host     | Yes      | -        |
| `DB_PORT`      | Database port     | Yes      | `3306` |
| `FLASK_KEY`    | Flask secret key  | Yes      | -        |
| `GROQ_API_KEY` | Groq API key      | No       | -        |

### AI Model Setup

#### Ollama (Local Models)

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull desired models:

```bash
ollama pull gemma2:2b
ollama pull llama3.1:8b
```

#### Groq (Cloud Models)

1. Sign up at [console.groq.com](https://console.groq.com)
2. Generate an API key
3. Add to your `.env` file

## Usage

### Basic Workflow

1. **Select AI Model**: Choose your preferred AI provider and model
2. **Select Database Tables**: Choose relevant tables for better context
3. **Ask Questions**: Type natural language questions about your data
4. **Review SQL**: Generated SQL queries are displayed for review
5. **Execute**: Run queries to see results
6. **Manage History**: Access, export, or reuse previous conversations

### Example Queries

```
"Show me all customers who made orders in the last 30 days"
"What are the top 5 best-selling products by revenue?"
"Find customers with more than 3 orders"
"Calculate average order value by month"
```

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Generate or execute query
- `Ctrl/Cmd + K`: Focus on prompt input
- `Ctrl/Cmd + Shift + V`: Validate query
- `Escape`: Reset/clear interface

## API Endpoints

### Core Endpoints

| Endpoint              | Method | Description                        |
| --------------------- | ------ | ---------------------------------- |
| `/`                 | GET    | Main application interface         |
| `/process_textarea` | POST   | Generate SQL from natural language |
| `/validate_query`   | POST   | Validate query intent              |
| `/execute_query`    | POST   | Execute SQL query                  |
| `/output_page`      | GET    | Display query results              |

### History Management

| Endpoint                | Method | Description                            |
| ----------------------- | ------ | -------------------------------------- |
| `/history_management` | GET    | Retrieve conversation history          |
| `/history_management` | POST   | Manage history (delete, clear, import) |
| `/export_history`     | GET    | Export history as JSON                 |
| `/reset_history`      | POST   | Clear all history                      |

### Database Management

| Endpoint        | Method | Description                |
| --------------- | ------ | -------------------------- |
| `/change_db`  | POST   | Switch database connection |
| `/get_models` | GET    | Get available AI models    |

## Deployment

### Render Deployment

1. **Prepare for deployment**

   - Ensure all environment variables are set
   - Update database connection to use cloud database
2. **Deploy to Render**

   - Connect your GitHub repository
   - Set environment variables in Render dashboard
   - Deploy with automatic builds
3. **Environment Variables for Render**

```env
DB=your_database_name
USER=your_db_username  
PASSWORD=your_db_password
HOST=your_cloud_db_host
DB_PORT=3306
FLASK_KEY=your_secret_key
GROQ_API_KEY=your_groq_api_key
```

### Database Setup (Google Cloud SQL)

1. Create a MySQL instance on Google Cloud Platform
2. Configure networking and authentication
3. Update environment variables with cloud database details
4. Ensure proper firewall rules for Render IP ranges

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Flask App     │    │   Database      │
│   (HTML/CSS/JS) │◄──►│   (Python)      │◄──►│   (MySQL)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   AI Models     │
                       │   (Ollama/Groq) │
                       └─────────────────┘
```

### Key Components

- **Frontend**: Modern responsive UI built with Tailwind CSS
- **Backend**: Flask application with SQLAlchemy ORM
- **AI Integration**: Multi-provider support with fallback mechanisms
- **Database Layer**: MySQL with connection pooling
- **Session Management**: Flask sessions for conversation history

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- Follow PEP 8 for Python code
- Use meaningful variable and function names
- Comment complex logic
- Maintain consistent indentation

### Testing

```bash
# Run tests (when implemented)
python -m pytest tests/
```

## Security Considerations

- **SQL Injection Prevention**: Using parameterized queries
- **Input Validation**: Server-side validation for all inputs
- **API Key Security**: Environment variables for sensitive data
- **Session Security**: Secure session configuration
- **CORS Policy**: Restricted to application domain

## Troubleshooting

### Common Issues

**1. Database Connection Failed**

- Verify database credentials
- Check network connectivity
- Ensure database server is running

**2. AI Models Not Available**

- Check Ollama installation and running status
- Verify Groq API key validity
- Ensure network connectivity for cloud models

**3. Queries Not Generating**

- Verify model selection
- Check table selection
- Review query validation messages

**4. Deployment Issues**

- Check environment variables in Render
- Verify database firewall rules
- Review application logs

### Performance Optimization

- **Database Indexing**: Ensure proper indexes on frequently queried columns
- **Query Caching**: Implement query result caching for repeated requests
- **Model Selection**: Choose appropriate model size for your use case
- **Connection Pooling**: Configure database connection pooling

## Roadmap

### Planned Features

- [ ] Advanced query optimization suggestions
- [ ] Custom database connector support (PostgreSQL, SQLite)
- [ ] Query performance analytics
- [ ] User authentication and multi-tenancy
- [ ] Advanced visualization with charts
- [ ] Query scheduling and automation
- [ ] API documentation with Swagger
- [ ] Docker containerization

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ollama](https://ollama.ai) for local AI model support
- [Groq](https://groq.com) for high-performance cloud AI
- [Tailwind CSS](https://tailwindcss.com) for responsive design
- [Flask](https://flask.palletsprojects.com) for the web framework

## Support

For support, questions, or contributions:

- Create an issue on GitHub
- Review the troubleshooting section
- Check the documentation for common solutions

---

**Made with ❤️ for database developers and analysts who want to query data naturally.**
