// QueryChakra Frontend JavaScript - Enhanced History System
$(document).ready(function() {
    console.log('DOM Ready - Initializing QueryChakra with Enhanced History');
    
    // Initialize all components
    initializeModelSelection();
    initializeNotifications();
    initializeButtons();
    initializeDropdowns();
    initializeMasterCheckbox();
    initializeKeyboardShortcuts();
    initializeHistoryManagement();
    
    // Clear prompt on load
    $("#prompt").val("");
    console.log('QueryChakra initialized successfully');
});

// Enhanced Notification system
function initializeNotifications() {
    window.showNotification = function(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notification-container') || document.body;
        const notification = document.createElement('div');
        notification.className = `notification ${type} fixed top-4 right-4 p-4 rounded-lg shadow-lg transition-all duration-300 transform max-w-sm z-50`;
        notification.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
        notification.style.color = 'white';
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200 text-lg font-bold">×</button>
            </div>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
}

// History Management Functions
function initializeHistoryManagement() {
    console.log('Initializing history management...');
    
    // Export history
    $('#export-history').off('click').on('click', function() {
        console.log('Export history clicked');
        
        $.ajax({
            url: '/history_management?action=export',
            type: 'GET',
            success: function(response) {
                if (response.success) {
                    const dataStr = JSON.stringify(response.data, null, 2);
                    const dataBlob = new Blob([dataStr], {type: 'application/json'});
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = response.filename || 'querychakra_history.json';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    showNotification('History exported successfully!', 'success');
                } else {
                    showNotification('Failed to export history', 'error');
                }
            },
            error: function() {
                showNotification('Export request failed', 'error');
            }
        });
    });
    
    // Clear all history
    $('#clear-history').off('click').on('click', function() {
        console.log('Clear history clicked');
        
        if (confirm('Are you sure you want to clear all conversation history? This action cannot be undone.')) {
            $.ajax({
                url: '/history_management',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({action: 'clear_all'}),
                success: function(response) {
                    if (response.success) {
                        showNotification('History cleared successfully', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        showNotification('Failed to clear history', 'error');
                    }
                },
                error: function() {
                    showNotification('Clear request failed', 'error');
                }
            });
        }
    });
}

// Global functions for conversation management
window.deleteConversation = function(conversationId) {
    console.log('Delete conversation:', conversationId);
    
    if (confirm('Are you sure you want to delete this conversation?')) {
        $.ajax({
            url: '/history_management',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({action: 'delete', entry_id: conversationId}),
            success: function(response) {
                if (response.success) {
                    $(`[data-conversation-id="${conversationId}"]`).fadeOut(300, function() {
                        $(this).remove();
                        updateHistoryStats();
                    });
                    showNotification('Conversation deleted', 'success', 2000);
                } else {
                    showNotification('Failed to delete conversation', 'error');
                }
            },
            error: function() {
                showNotification('Delete request failed', 'error');
            }
        });
    }
};

window.reuseQuery = function(sqlQuery) {
    console.log('Reuse query:', sqlQuery.substring(0, 50) + '...');
    
    $('#prompt').val(sqlQuery);
    
    // Update UI state for reused query
    $('#request-query').addClass('hidden');
    $('#execute-query').removeClass('hidden');
    $('#clear-prompt').addClass('hidden');
    $('#reset-prompt').removeClass('hidden');
    
    // Scroll to top
    $('html, body').animate({scrollTop: 0}, 500);
    
    showNotification('Query loaded for execution', 'info', 2000);
};

window.copyToClipboard = function(text) {
    console.log('Copy to clipboard:', text.substring(0, 50) + '...');
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
            showNotification('SQL query copied to clipboard', 'success', 2000);
        }).catch(function() {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
};

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('SQL query copied to clipboard', 'success', 2000);
    } catch (err) {
        showNotification('Failed to copy to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
}

function updateHistoryStats() {
    const remainingConversations = $('.conversation-item').length;
    if (remainingConversations === 0) {
        // Reload page to show empty state
        setTimeout(() => window.location.reload(), 1000);
    } else {
        // Update stats counter
        $('.history-stats .bg-blue-100').text(`${remainingConversations} conversations`);
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
    
    const availableModels = window.availableModels || {"ollama": [], "groq": []};
    console.log('Available models loaded:', availableModels);
    
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

// Enhanced Button initialization
function initializeButtons() {
    console.log('Initializing buttons...');
    
    // Clear button
    $("#clear-prompt").off('click').on('click', function() {
        console.log('Clear button clicked');
        $("#prompt").val("");
        hideAllMessages();
        localStorage.removeItem('queryChakra_lastQuery');
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
        
        // Show loading state for validation
        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Validating...');
        
        $.ajax({
            url: "/validate_query",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({'query': query}),
            success: function(response) {
                console.log('Validation response:', response);
                if (response.valid) {
                    showNotification('✓ Query validation passed', 'success');
                } else {
                    showNotification('⚠ Query validation: ' + response.message, 'warning', 7000);
                }
            },
            error: function(xhr, status, error) {
                console.error('Validation error:', error);
                showNotification('Validation service unavailable', 'error');
            },
            complete: function() {
                $('#validate-query').prop('disabled', false).html('<i class="fas fa-search mr-1"></i>Validate Query');
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
            $("#prompt").focus();
            return;
        }
        
        if (!provider || !model) {
            $(".warningmodel").removeClass('hidden');
            showNotification('Please select a model provider and model', 'warning');
            $("#model-provider").focus();
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
                    
                    // Save to localStorage
                    localStorage.setItem('queryChakra_lastQuery', response.query.trim());
                    
                    showNotification('✓ SQL query generated successfully!', 'success');
                    
                    // Auto-scroll to show the generated query
                    $("#prompt")[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                    
                } else {
                    showNotification(`Generation failed: ${response.error}`, 'error', 8000);
                }
            },
            error: function(xhr, status, error) {
                console.error('Generate SQL error:', xhr.responseJSON || error);
                hideLoadingState();
                const errorMsg = xhr.responseJSON?.error || 'Request failed. Please check your connection and try again.';
                showNotification(`Error: ${errorMsg}`, 'error', 8000);
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
        
        // Show loading state
        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Executing...');
        
        $.ajax({
            url: "/clean_query",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({'query': query}),
            success: function(response) {
                console.log('Execute response:', response);
                if (response.success || response === 'done') {
                    showNotification('⚡ Executing query...', 'info', 2000);
                    setTimeout(() => {
                        window.location.href = '/output_page';
                    }, 1000);
                } else {
                    showNotification(`Query preparation failed: ${response.error}`, 'error');
                    $('#execute-query').prop('disabled', false).html('<i class="fas fa-play mr-1"></i>Execute Query');
                }
            },
            error: function() {
                showNotification('Failed to prepare query for execution', 'error');
                $('#execute-query').prop('disabled', false).html('<i class="fas fa-play mr-1"></i>Execute Query');
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
        localStorage.removeItem('queryChakra_lastQuery');
        showNotification('Interface reset', 'info', 2000);
    });
    
    console.log('Buttons initialized');
}

// Modal and dropdown functionality
function initializeDropdowns() {
    // Connection info modal
    $("#openModalButton").off('click').on('click', function() {
        console.log('Connection info button clicked');
        $("#myModal").removeClass('hidden');
    });
    
    $("#closeModalButton, #overlay").off('click').on('click', function() {
        $("#myModal").addClass('hidden');
    });
    
    // Close modal on Escape key
    $(document).off('keydown.modal').on('keydown.modal', function(e) {
        if (e.key === 'Escape' && !$("#myModal").hasClass('hidden')) {
            $("#myModal").addClass('hidden');
        }
    });
    
    // Database dropdown
    $("#dropdown-group li a").off('click').on('click', function(e) {
        e.preventDefault();
        const selection = $(this).text().trim();
        console.log('Database selected:', selection);
        
        showNotification('🔄 Switching database...', 'info');
        
        $.ajax({
            url: "/change_db",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({'database': selection}),
            success: function(response) {
                console.log('DB change response:', response);
                if (response['status'] == 200) {
                    showNotification('✓ Database switched successfully', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } else if (response['status'] == 300) {
                    showNotification('Same database already selected', 'warning');
                } else {
                    showNotification(`Database switch failed: ${response['msg']}`, 'error');
                }
            },
            error: function() {
                showNotification('Database switch request failed', 'error');
            }
        });
    });
    
    $("#dropdownDefaultButton").off('click').on('click', function(e) {
        e.stopPropagation();
        $("#dropdown").toggleClass('hidden');
        $("#samedb").addClass('hidden');
    });
    
    // Close dropdown when clicking outside
    $(document).off('click.dropdown').on('click.dropdown', function() {
        $("#dropdown").addClass('hidden');
    });
}

// Master checkbox functionality
function initializeMasterCheckbox() {
    const masterCheckbox = document.getElementById('masterCheckbox');
    if (masterCheckbox) {
        masterCheckbox.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.checkbox');
            const tableBody = document.getElementById('tableBody');
            const rows = tableBody ? tableBody.getElementsByTagName('tr') : [];
            let affectedCount = 0;
            
            for (let i = 0; i < checkboxes.length; i++) {
                if (rows[i] && rows[i].style.display !== 'none') {
                    checkboxes[i].checked = masterCheckbox.checked;
                    affectedCount++;
                }
            }
            
            showNotification(
                `${masterCheckbox.checked ? '✓ Selected' : '✗ Deselected'} ${affectedCount} tables`, 
                masterCheckbox.checked ? 'success' : 'info', 
                2000
            );
        });
    }
}

// Enhanced Keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Ctrl/Cmd + Enter: Generate or Execute
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!$("#request-query").hasClass('hidden')) {
                $("#request-query").click();
            } else if (!$("#execute-query").hasClass('hidden')) {
                $("#execute-query").click();
            }
        }
        
        // Escape: Reset or Clear
        if (event.key === 'Escape') {
            if (!$("#reset-prompt").hasClass('hidden')) {
                $("#reset-prompt").click();
            } else if (!$("#myModal").hasClass('hidden')) {
                $("#myModal").addClass('hidden');
            } else {
                $("#clear-prompt").click();
            }
        }
        
        // Ctrl/Cmd + K: Focus on prompt
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            $("#prompt").focus();
        }
        
        // Ctrl/Cmd + Shift + V: Validate query
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'V') {
            event.preventDefault();
            $("#validate-query").click();
        }
    });
    
    // Show keyboard shortcuts hint
    console.log('Keyboard shortcuts enabled:');
    console.log('- Ctrl/Cmd + Enter: Generate/Execute query');
    console.log('- Escape: Reset/Clear/Close modal');
    console.log('- Ctrl/Cmd + K: Focus prompt');
    console.log('- Ctrl/Cmd + Shift + V: Validate query');
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
    $("#request-query").prop('disabled', true).html('<span class="loading-spinner mr-2"></span><i class="fas fa-cogs mr-1"></i>Generating...');
}

function hideLoadingState() {
    $('#modalContainer').addClass('hidden');
    $(".functionclass").removeClass('disabled');
    $("#request-query").prop('disabled', false).html('<i class="fas fa-cogs mr-1"></i>Generate SQL');
}

// Enhanced Auto-save functionality with debouncing
let saveTimeout;
$(document).on('input', '#prompt', function() {
    const value = $(this).val();
    
    // Clear previous timeout
    clearTimeout(saveTimeout);
    
    // Set new timeout for debounced save
    saveTimeout = setTimeout(() => {
        if (value.trim()) {
            localStorage.setItem('queryChakra_lastQuery', value);
        } else {
            localStorage.removeItem('queryChakra_lastQuery');
        }
    }, 1000); // Save after 1 second of no typing
});

// Restore last query with user confirmation
$(document).ready(function() {
    const lastQuery = localStorage.getItem('queryChakra_lastQuery');
    if (lastQuery && lastQuery.trim() && !$("#prompt").val().trim()) {
        // Only restore if it's not just whitespace and looks like a meaningful query
        if (lastQuery.length > 10 && !lastQuery.startsWith('Error') && !lastQuery.startsWith('I can only help')) {
            $("#prompt").val(lastQuery);
            showNotification('Previous query restored from local storage', 'info', 3000);
        }
    }
});

// Page visibility change handling to auto-save
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is being hidden - save current query
        const currentQuery = $("#prompt").val();
        if (currentQuery.trim()) {
            localStorage.setItem('queryChakra_lastQuery', currentQuery);
        }
    }
});

// Enhanced error handling for AJAX requests
$(document).ajaxError(function(event, jqXHR, ajaxSettings, thrownError) {
    console.error('AJAX Error:', {
        url: ajaxSettings.url,
        status: jqXHR.status,
        error: thrownError,
        response: jqXHR.responseText
    });
    
    // Hide loading states
    hideLoadingState();
    $("#validate-query").prop('disabled', false).html('<i class="fas fa-search mr-1"></i>Validate Query');
    $("#execute-query").prop('disabled', false).html('<i class="fas fa-play mr-1"></i>Execute Query');
    
    // Show generic error if not already handled
    if (!jqXHR.statusText || jqXHR.statusText === 'error') {
        showNotification('Network error occurred. Please check your connection.', 'error', 5000);
    }
});

// Page load performance monitoring
window.addEventListener('load', function() {
    const loadTime = performance.now();
    console.log(`QueryChakra page loaded in ${Math.round(loadTime)}ms`);
    
    if (loadTime > 3000) {
        showNotification('Page took longer than expected to load', 'warning', 3000);
    }
});