// QueryChakra Frontend JavaScript - Fixed Version
$(document).ready(function() {
    console.log('DOM Ready - Initializing QueryChakra');
    
    // Initialize all components
    initializeModelSelection();
    initializeNotifications();
    initializeButtons();
    initializeDropdowns();
    initializeMasterCheckbox();
    initializeKeyboardShortcuts();
    
    // Clear prompt on load
    $("#prompt").val("");
    console.log('QueryChakra initialized successfully');
});

// Notification system
function initializeNotifications() {
    window.showNotification = function(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notification-container') || document.body;
        const notification = document.createElement('div');
        notification.className = `notification ${type} fixed top-4 right-4 p-4 rounded-lg shadow-lg transition-all duration-300 transform max-w-sm z-50`;
        notification.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
        notification.style.color = 'white';
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">×</button>
            </div>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
}

// Model selection functionality
function initializeModelSelection() {
    console.log('Initializing model selection...');
    
    const providerSelect = document.getElementById('model-provider');
    const modelSelect = document.getElementById('model-name');
    const modelInfo = document.getElementById('model-info');
    const modelBadge = document.getElementById('model-badge');
    const modelDescription = document.getElementById('model-description');
    
    if (!providerSelect || !modelSelect) {
        console.error('Model selection elements not found');
        return;
    }
    
    // Model data is now directly available as window.availableModels
    const availableModels = window.availableModels || {"ollama": [], "groq": []};
    console.log('Available models loaded:', availableModels);
    
    // Don't overwrite provider select - it's already populated by template
    console.log('Provider select already has options:', providerSelect.options.length);
    
    // Provider change handler
    providerSelect.addEventListener('change', function() {
        const provider = this.value;
        console.log('Provider selected:', provider);
        
        modelSelect.innerHTML = '<option value="">Select Model</option>';
        modelSelect.disabled = !provider;
        
        if (modelInfo) modelInfo.classList.add('hidden');
        
        if (provider && availableModels[provider]) {
            availableModels[provider].forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            modelSelect.disabled = false;
            console.log(`Populated ${availableModels[provider].length} models for ${provider}`);
        }
    });
    
    // Model change handler
    modelSelect.addEventListener('change', function() {
        const provider = providerSelect.value;
        const model = this.value;
        console.log('Model selected:', model);
        
        if (provider && model && modelInfo && modelBadge && modelDescription) {
            modelBadge.className = `model-badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${provider === 'ollama' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`;
            modelBadge.textContent = provider.toUpperCase();
            modelDescription.textContent = `${model} - AI model for SQL generation`;
            modelInfo.classList.remove('hidden');
        }
    });
    
    console.log('Model selection initialized');
}

// Button initialization
function initializeButtons() {
    console.log('Initializing buttons...');
    
    // Clear button
    $("#clear-prompt").off('click').on('click', function() {
        console.log('Clear button clicked');
        $("#prompt").val("");
        hideAllMessages();
        showNotification('Prompt cleared', 'info', 2000);
    });
    
    // Validate query button
    $("#validate-query").off('click').on('click', function() {
        console.log('Validate button clicked');
        const query = $("#prompt").val().trim();
        
        if (!query) {
            showNotification('Please enter a query to validate', 'warning');
            return;
        }
        
        $.ajax({
            url: "/validate_query",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({'query': query}),
            success: function(response) {
                console.log('Validation response:', response);
                if (response.valid) {
                    showNotification('Query validation passed', 'success');
                } else {
                    showNotification('Query validation failed: ' + response.message, 'warning');
                }
            },
            error: function(xhr, status, error) {
                console.error('Validation error:', error);
                showNotification('Validation service unavailable', 'error');
            }
        });
    });
    
    // Generate SQL button
    $("#request-query").off('click').on('click', function() {
        console.log('Generate SQL button clicked');
        
        hideAllMessages();
        
        const prompt = $("#prompt").val().trim();
        const provider = $("#model-provider").val();
        const model = $("#model-name").val();
        
        console.log('Generate SQL params:', {prompt: prompt.substring(0, 50) + '...', provider, model});
        
        // Validation
        if (!prompt) {
            $(".warningtext").removeClass('hidden');
            showNotification('Please enter a query', 'warning');
            return;
        }
        
        if (!provider || !model) {
            $(".warningmodel").removeClass('hidden');
            showNotification('Please select a model provider and model', 'warning');
            return;
        }
        
        if ($('.checkbox:checked').length === 0) {
            $(".warningcheckbox").removeClass('hidden');
            showNotification('Please select at least one table', 'warning');
            return;
        }
        
        // Show loading
        showLoadingState();
        
        // Prepare schema data
        let combinedData = "";
        $(".checkbox:checked").each(function() {
            const row = $(this).closest("tr");
            const table = row.find("td:nth-child(1)").text().trim();
            const schema = row.find("td:nth-child(2)").text().trim();
            const columns = row.find("td:nth-child(3)").text().trim();
            const dtypes = row.find("td:nth-child(4)").text().trim();
            
            combinedData += `schema: ${schema}, table: ${table}, columns: ${columns}, types: ${dtypes}\n`;
        });
        
        console.log('Schema data length:', combinedData.length);
        
        // Make request
        $.ajax({
            url: "/process_textarea",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                'query': prompt,
                'schema': combinedData,
                'model_provider': provider,
                'model_name': model
            }),
            success: function(response) {
                console.log('Generate SQL response:', response);
                hideLoadingState();
                
                if (response.success) {
                    $("#prompt").val(response.query.trim());
                    $("#time-taken").text(response.time);
                    $("#used-model").text(response.model_used || `${provider}:${model}`);
                    
                    // Update UI state
                    $("#request-query").addClass('hidden');
                    $("#execute-query").removeClass('hidden');
                    $("#clear-prompt").addClass('hidden');
                    $("#reset-prompt").removeClass('hidden');
                    $(".successtext").removeClass('hidden');
                    
                    showNotification('SQL query generated successfully!', 'success');
                } else {
                    showNotification(`Generation failed: ${response.error}`, 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('Generate SQL error:', xhr.responseJSON || error);
                hideLoadingState();
                const errorMsg = xhr.responseJSON?.error || 'Request failed';
                showNotification(`Error: ${errorMsg}`, 'error');
            }
        });
    });
    
    // Execute query button
    $("#execute-query").off('click').on('click', function() {
        console.log('Execute button clicked');
        const query = $("#prompt").val().trim();
        
        if (!query || query.includes('I can only help') || query.includes('Error')) {
            showNotification('Invalid query for execution', 'warning');
            return;
        }
        
        $.ajax({
            url: "/clean_query",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({'query': query}),
            success: function(response) {
                console.log('Execute response:', response);
                if (response.success || response === 'done') {
                    showNotification('Executing query...', 'info', 2000);
                    setTimeout(() => {
                        window.location.href = '/output_page';
                    }, 1000);
                } else {
                    showNotification(`Query preparation failed: ${response.error}`, 'error');
                }
            },
            error: function() {
                showNotification('Failed to prepare query for execution', 'error');
            }
        });
    });
    
    // Reset button
    $("#reset-prompt").off('click').on('click', function() {
        console.log('Reset button clicked');
        $("#prompt").val('');
        hideAllMessages();
        $("#request-query").removeClass('hidden');
        $("#execute-query").addClass('hidden');
        $("#clear-prompt").removeClass('hidden');
        $("#reset-prompt").addClass('hidden');
        showNotification('Interface reset', 'info', 2000);
    });
    
    console.log('Buttons initialized');
}

// Modal functionality
function initializeDropdowns() {
    // Connection info modal
    $("#openModalButton").off('click').on('click', function() {
        console.log('Connection info button clicked');
        $("#myModal").removeClass('hidden');
    });
    
    $("#closeModalButton").off('click').on('click', function() {
        $("#myModal").addClass('hidden');
    });
    
    // Database dropdown
    $("#dropdown-group li a").off('click').on('click', function(e) {
        e.preventDefault();
        const selection = $(this).text().trim();
        console.log('Database selected:', selection);
        
        showNotification('Switching database...', 'info');
        
        $.ajax({
            url: "/change_db",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({'database': selection}),
            success: function(response) {
                console.log('DB change response:', response);
                if (response['status'] == 200) {
                    showNotification('Database switched successfully', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } else if (response['status'] == 300) {
                    showNotification('Same database selected', 'warning');
                } else {
                    showNotification(`Database switch failed: ${response['msg']}`, 'error');
                }
            },
            error: function() {
                showNotification('Database switch request failed', 'error');
            }
        });
    });
    
    $("#dropdownDefaultButton").off('click').on('click', function() {
        $("#dropdown").toggleClass('hidden');
        $("#samedb").addClass('hidden');
    });
}

// Master checkbox
function initializeMasterCheckbox() {
    const masterCheckbox = document.getElementById('masterCheckbox');
    if (masterCheckbox) {
        masterCheckbox.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.checkbox');
            const tableBody = document.getElementById('tableBody');
            const rows = tableBody ? tableBody.getElementsByTagName('tr') : [];
            
            for (let i = 0; i < checkboxes.length; i++) {
                if (rows[i] && rows[i].style.display !== 'none') {
                    checkboxes[i].checked = masterCheckbox.checked;
                }
            }
            
            const checkedCount = document.querySelectorAll('.checkbox:checked').length;
            showNotification(
                `${masterCheckbox.checked ? 'Selected' : 'Deselected'} ${checkedCount} tables`, 
                'info', 
                2000
            );
        });
    }
}

// Keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!$("#request-query").hasClass('hidden')) {
                $("#request-query").click();
            } else if (!$("#execute-query").hasClass('hidden')) {
                $("#execute-query").click();
            }
        }
        
        if (event.key === 'Escape') {
            if (!$("#reset-prompt").hasClass('hidden')) {
                $("#reset-prompt").click();
            } else {
                $("#clear-prompt").click();
            }
        }
    });
}

// Utility functions
function hideAllMessages() {
    $(".warningtext").addClass('hidden');
    $(".warningcheckbox").addClass('hidden');
    $(".warningmodel").addClass('hidden');
    $(".successtext").addClass('hidden');
    $(".validationtext").addClass('hidden');
}

function showLoadingState() {
    $('#modalContainer').removeClass('hidden');
    $(".functionclass").addClass('disabled');
    $("#request-query").prop('disabled', true);
}

function hideLoadingState() {
    $('#modalContainer').addClass('hidden');
    $(".functionclass").removeClass('disabled');
    $("#request-query").prop('disabled', false);
}

// Auto-save functionality
$(document).on('input', '#prompt', function() {
    localStorage.setItem('queryChakra_lastQuery', $(this).val());
});

// Restore last query
$(document).ready(function() {
    const lastQuery = localStorage.getItem('queryChakra_lastQuery');
    if (lastQuery && lastQuery.trim() && !$("#prompt").val().trim()) {
        $("#prompt").val(lastQuery);
    }
});