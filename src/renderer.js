const { ipcRenderer } = require('electron');

let currentConfig = null;
let editingCategoryIndex = -1;
let editingVariableIndex = -1;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupEventListeners();
  setupIPCListeners();
  initializeProcessingQueue();
  updateSearchShortcut();
});

// Update search shortcut display based on platform
function updateSearchShortcut() {
  const shortcutSpan = document.querySelector('.search-shortcut');
  if (shortcutSpan) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    shortcutSpan.textContent = isMac ? '⌘K' : 'Ctrl+K';
  }
}


// Check if first time user and show introduction
function checkFirstTimeUser() {
  const hasSeenIntro = localStorage.getItem('hasSeenIntroWalkthrough');
  
  if (!hasSeenIntro) {
    // Show introduction walkthrough
    setTimeout(() => {
      showIntroWalkthrough();
    }, 500);
  }
}

// Load configuration
async function loadConfig() {
  currentConfig = await ipcRenderer.invoke('config:load');
  updateUI();
  checkFirstTimeUser();
}

// Setup event listeners
function setupEventListeners() {
  
  // Folder selection
  document.getElementById('browseBtn').addEventListener('click', selectFolder);
  
  // Organization toggle
  document.getElementById('enableOrganization').addEventListener('change', async (e) => {
    await ipcRenderer.invoke('config:updateSettings', {
      enable_organization: e.target.checked
    });
    currentConfig.enable_organization = e.target.checked;
  });

  // Expertise change handlers
  document.getElementById('mainExpertiseGeneral').addEventListener('change', async (e) => {
    if (e.target.checked) {
      await ipcRenderer.invoke('config:updateSettings', {
        expertise: 'general'
      });
      currentConfig.expertise = 'general';
    }
  });

  document.getElementById('mainExpertiseLegal').addEventListener('change', async (e) => {
    if (e.target.checked) {
      await ipcRenderer.invoke('config:updateSettings', {
        expertise: 'legal'
      });
      currentConfig.expertise = 'legal';
    }
  });

  
  // Monitor controls
  document.getElementById('monitorBtn').addEventListener('click', toggleMonitoring);
  
  // Category management
  document.getElementById('addCategoryBtn').addEventListener('click', () => showCategoryModal());
  
  // Variable management
  document.getElementById('addVariableBtn').addEventListener('click', () => showVariableModal());

  // AI Variable Suggestion
  document.getElementById('aiSuggestBtn').addEventListener('click', () => {
    document.getElementById('aiSuggestionModal').classList.add('active');
    document.getElementById('aiPrompt').value = '';
    document.getElementById('aiSuggestionResult').style.display = 'none';
    document.getElementById('generateSuggestionBtn').style.display = 'block';
    document.getElementById('useSuggestionBtn').style.display = 'none';
  });
  

  // Category AI suggestion button
  document.getElementById('categoryAISuggest').addEventListener('click', async () => {
    const modal = document.getElementById('aiCategorySuggestionModal');
    modal.classList.add('active');
    document.getElementById('categoryPrompt').value = '';
    document.getElementById('categorySuggestionResult').style.display = 'none';
    document.getElementById('generateCategorySuggestionBtn').style.display = 'block';
    document.getElementById('useCategorySuggestionBtn').style.display = 'none';
  });
  
  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => showSettingsModal());
  
  // Open processing log
  document.getElementById('openLogBtn').addEventListener('click', async () => {
    await ipcRenderer.invoke('window:openLog');
  });
  
  // Modal controls
  setupModalControls();
}

// Setup IPC listeners
function setupIPCListeners() {
  ipcRenderer.on('monitor:status', (event, status) => {
    updateMonitorStatus(status);
  });
  
  ipcRenderer.on('monitor:auto-started', (event, started) => {
    if (started) {
      showNotification('Auto-Start', 'File monitoring started automatically', 'success');
    }
  });
  
  ipcRenderer.on('monitor:error', (event, error) => {
    showNotification('Error', error, 'error');
  });
  
  ipcRenderer.on('file:processed', (event, result) => {
    console.log('File processed:', result);
    const fileIcon = getFileTypeIcon(result.fileName);
    const fileType = getFileTypeCategory(result.fileName);
    
    if (result.success) {
      showNotification(
        `${fileIcon} ${fileType} Processed`, 
        `${result.fileName} → ${result.category}`,
        'success'
      );
    } else {
      showNotification(
        `${fileIcon} Processing Failed`,
        `${result.fileName}: ${result.error}`,
        'error'
      );
    }
  });

  // Handle show processing log from tray
  ipcRenderer.on('show-processing-log', async (event) => {
    // Open the processing log window
    await ipcRenderer.invoke('window:openLog');
  });
}

// Folder selection
async function selectFolder() {
  const result = await ipcRenderer.invoke('dialog:openDirectory');
  if (result.filePaths && result.filePaths[0]) {
    const folderPath = result.filePaths[0];
    document.getElementById('folderPath').value = folderPath;
    
    await ipcRenderer.invoke('config:updateSettings', {
      watched_folder: folderPath
    });
    currentConfig.watched_folder = folderPath;
    
    
    // Show drop zone when monitoring
    const isRunning = await ipcRenderer.invoke('monitor:status');
    document.getElementById('processingQueue').style.display = isRunning ? 'block' : 'none';
  }
}

// Monitor control
async function toggleMonitoring() {
  const isRunning = await ipcRenderer.invoke('monitor:status');
  const btn = document.getElementById('monitorBtn');
  
  if (isRunning) {
    await ipcRenderer.invoke('monitor:stop');
    btn.innerHTML = 'Start Monitoring';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
    document.getElementById('processingQueue').style.display = 'none';
  } else {
    if (!currentConfig.watched_folder) {
      showNotification('Error', 'Please select a folder to monitor first', 'error');
      return;
    }
    
    if (!currentConfig.openai_api_key) {
      showNotification('Error', 'Please configure your OpenAI API key in Settings first', 'error');
      return;
    }
    
    // Test API key before starting monitoring
    btn.innerHTML = 'Testing API Key...';
    btn.disabled = true;
    
    try {
      const apiTest = await ipcRenderer.invoke('api:testKey', currentConfig.openai_api_key);
      
      if (!apiTest.success) {
        showNotification('API Key Error', `Cannot start monitoring: ${apiTest.error}`, 'error');
        btn.innerHTML = 'Start Monitoring';
        btn.disabled = false;
        return;
      }
      
      // API key is valid, start monitoring
      await ipcRenderer.invoke('monitor:start', currentConfig.watched_folder);
      btn.innerHTML = 'Stop Monitoring';
      btn.classList.remove('btn-success');
      btn.classList.add('btn-danger');
      btn.disabled = false;
      document.getElementById('processingQueue').style.display = 'block';
      
      showNotification('Success', 'Monitoring started successfully', 'success');
      
    } catch (error) {
      showNotification('Error', `Failed to test API key: ${error.message}`, 'error');
      btn.innerHTML = 'Start Monitoring';
      btn.disabled = false;
    }
  }
}

// Update monitor status
function updateMonitorStatus(isRunning) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const btn = document.getElementById('monitorBtn');
  
  if (isRunning) {
    statusDot.classList.add('running');
    statusText.textContent = 'Running';
    btn.innerHTML = 'Stop Monitoring';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');
    document.getElementById('processingQueue').style.display = 'block';
  } else {
    statusDot.classList.remove('running');
    statusText.textContent = 'Not running';
    btn.innerHTML = 'Start Monitoring';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
    document.getElementById('processingQueue').style.display = 'none';
  }
}

// Update UI with current config
async function updateUI() {
  if (!currentConfig) return;
  
  // Update folder path
  document.getElementById('folderPath').value = currentConfig.watched_folder || '';
  document.getElementById('enableOrganization').checked = currentConfig.enable_organization;
  
  // Update expertise selection
  const expertise = currentConfig.expertise || 'general';
  const expertiseRadio = document.getElementById(expertise === 'legal' ? 'mainExpertiseLegal' : 'mainExpertiseGeneral');
  if (expertiseRadio) {
    expertiseRadio.checked = true;
  }
  
  // Update categories list
  renderCategories();
  
  // Update variables list
  renderVariables();
}

// Render categories
function renderCategories() {
  const container = document.getElementById('categoriesList');
  
  if (currentConfig.categories.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <p>No categories defined yet</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = currentConfig.categories.map((category, index) => `
    <div class="list-item" style="cursor: pointer;" onclick="showCategoryDetails(${index})">
      <div class="list-item-info">
        <h4>${category.name}</h4>
        <p style="color: var(--primary); font-weight: 500;">${category.shortDescription || category.description.substring(0, 50) + '...'}</p>
        <div class="naming-pattern">Pattern: ${category.naming_pattern}</div>
      </div>
      <div class="list-item-actions" onclick="event.stopPropagation()">
        ${category.name !== 'General' ? `
          <button class="btn btn-secondary btn-small" onclick="editCategory(${index})">
            Edit
          </button>
          <button class="btn btn-danger btn-small" onclick="deleteCategory(${index})">
            Delete
          </button>
        ` : '<span style="color: #232323; opacity: 0.5; font-size: 13px;">Protected category</span>'}
      </div>
    </div>
  `).join('');
}

// Render variables
function renderVariables() {
  const container = document.getElementById('variablesList');
  
  if (currentConfig.variables.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏷️</div>
        <p>No variables defined yet</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = currentConfig.variables.map((variable, index) => {
    const formattingLabel = variable.formatting && variable.formatting !== 'none' ? 
      ` <span style="font-size: 11px; color: #666; font-weight: normal;">(${variable.formatting})</span>` : '';
    
    return `
    <div class="list-item" style="cursor: pointer;" onclick="showVariableDetails(${index})">
      <div class="list-item-info">
        <h4>{${variable.name}}${formattingLabel}</h4>
        <p style="color: var(--primary); font-weight: 500;">${variable.shortDescription || variable.description.substring(0, 50) + '...'}</p>
      </div>
      <div class="list-item-actions" onclick="event.stopPropagation()">
        ${variable.name !== 'original_name' ? `
          <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); editVariable(${index})">
            Edit
          </button>
          <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteVariable(${index})">
            Delete
          </button>
        ` : '<span style="color: #232323; opacity: 0.5; font-size: 13px;">Protected variable</span>'}
      </div>
    </div>
  `;
  }).join('');
}

// Category modal
function showCategoryModal(category = null, index = -1) {
  editingCategoryIndex = index;
  const modal = document.getElementById('categoryModal');
  const form = document.getElementById('categoryForm');
  const title = document.getElementById('categoryModalTitle');
  
  title.textContent = category ? 'Edit Category' : 'Add Category';
  
  if (category) {
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryDescription').value = category.description;
    document.getElementById('namingPattern').value = category.naming_pattern;
  } else {
    form.reset();
  }
  
  updateAvailableVariables();
  modal.classList.add('active');
}

// Variable modal
function showVariableModal(variable = null, index = -1) {
  editingVariableIndex = index;
  const modal = document.getElementById('variableModal');
  const form = document.getElementById('variableForm');
  const title = document.getElementById('variableModalTitle');
  
  title.textContent = variable ? 'Edit Variable' : 'Add Variable';
  
  if (variable) {
    document.getElementById('variableName').value = variable.name;
    document.getElementById('variableDescription').value = variable.description;
    document.getElementById('variableFormatting').value = variable.formatting || 'none';
  } else {
    form.reset();
  }
  
  modal.classList.add('active');
}

// Settings modal
async function showSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const form = document.getElementById('settingsForm');
  
  // Load current API key
  if (currentConfig && currentConfig.openai_api_key) {
    document.getElementById('openaiApiKey').value = currentConfig.openai_api_key;
  } else {
    form.reset();
  }
  
  
  // Load minimize to tray setting
  const minimizeToTray = localStorage.getItem('minimizeToTray') === 'true';
  document.getElementById('minimizeToTray').checked = minimizeToTray;
  
  // Load desktop notifications setting
  document.getElementById('enableDesktopNotifications').checked = currentConfig.enable_desktop_notifications !== false;
  
  // Load auto-start monitoring setting
  document.getElementById('autoStartMonitoring').checked = currentConfig.auto_start_monitoring === true;
  
  // Clear status
  document.getElementById('apiKeyStatus').textContent = '';
  document.getElementById('apiKeyStatus').className = 'api-key-status';
  
  modal.classList.add('active');
}

// Update available variables in category form
function updateAvailableVariables() {
  const container = document.getElementById('availableVariables');
  container.innerHTML = currentConfig.variables.map(v => 
    `<span class="variable-tag" onclick="insertVariable('${v.name}')">{${v.name}}</span>`
  ).join('');
}

// Insert variable into naming pattern
function insertVariable(varName) {
  const input = document.getElementById('namingPattern');
  const cursorPos = input.selectionStart;
  const text = input.value;
  const before = text.substring(0, cursorPos);
  const after = text.substring(cursorPos);
  
  input.value = before + `{${varName}}` + after;
  input.focus();
  input.setSelectionRange(cursorPos + varName.length + 2, cursorPos + varName.length + 2);
}

// Setup modal controls
function setupModalControls() {
  // Close buttons
  document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.remove('active');
    });
  });
  
  // Close modal on outside click (except loading modal)
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.id !== 'loadingModal') {
        modal.classList.remove('active');
      }
    });
  });
  
  // Category form submission
  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const category = {
      name: document.getElementById('categoryName').value,
      description: document.getElementById('categoryDescription').value,
      naming_pattern: document.getElementById('namingPattern').value
    };
    
    // Show loading modal for short description generation
    showLoadingModal('Saving Category', 'Generating short description...');
    
    try {
      // Generate short description for the category
      const shortDescResult = await ipcRenderer.invoke('api:generateShortDescription', category.name, category.description);
      
      if (shortDescResult.success) {
        category.shortDescription = shortDescResult.shortDescription;
      }
      
      // Save the category
      let result;
      if (editingCategoryIndex >= 0) {
        result = await ipcRenderer.invoke('config:updateCategory', editingCategoryIndex, category);
      } else {
        result = await ipcRenderer.invoke('config:addCategory', category);
      }
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      currentConfig = result.data;
      
      hideLoadingModal();
      document.getElementById('categoryModal').classList.remove('active');
      renderCategories();
      showNotification('Success', `Category "${category.name}" saved`, 'success');
    } catch (error) {
      hideLoadingModal();
      showNotification('Error', 'Failed to save category', 'error');
    }
  });
  
  // Variable form submission
  document.getElementById('variableForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const variable = {
      name: document.getElementById('variableName').value,
      description: document.getElementById('variableDescription').value,
      formatting: document.getElementById('variableFormatting').value || 'none'
    };
    
    // Show loading modal
    showLoadingModal('Evaluating Description', 'Analyzing your variable description for clarity and completeness...');
    
    try {
      // Evaluate the description before saving
      const evaluationResult = await ipcRenderer.invoke('api:evaluateDescription', variable.name, variable.description);
      
      // Hide loading modal
      hideLoadingModal();
      
      if (evaluationResult.success && !evaluationResult.evaluation.isAdequate) {
        // Show suggestion modal
        showDescriptionSuggestion(variable, evaluationResult.evaluation);
      } else {
        // Description is adequate or evaluation failed, proceed with saving
        await saveVariable(variable);
      }
    } catch (error) {
      hideLoadingModal();
      showNotification('Error', 'Failed to evaluate description', 'error');
      // Proceed with saving anyway
      await saveVariable(variable);
    }
  });

  // AI Suggestion form handlers
  document.getElementById('aiSuggestionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prompt = document.getElementById('aiPrompt').value.trim();
    if (!prompt) return;
    
    const generateBtn = document.getElementById('generateSuggestionBtn');
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = 'Generating...';
    generateBtn.disabled = true;
    
    try {
      const result = await ipcRenderer.invoke('api:generateVariable', prompt);
      
      if (result.success) {
        // Display the suggestion
        document.getElementById('suggestedName').textContent = result.suggestion.name;
        document.getElementById('suggestedDescription').textContent = result.suggestion.description;
        document.getElementById('aiSuggestionResult').style.display = 'block';
        
        // Store the suggestion for later use
        document.getElementById('aiSuggestionModal').dataset.suggestedName = result.suggestion.name;
        document.getElementById('aiSuggestionModal').dataset.suggestedDescription = result.suggestion.description;
        
        // Update buttons
        generateBtn.style.display = 'none';
        document.getElementById('useSuggestionBtn').style.display = 'block';
      } else {
        showNotification('Error', result.error || 'Failed to generate suggestion', 'error');
      }
    } catch (error) {
      showNotification('Error', 'Failed to generate suggestion', 'error');
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.disabled = false;
    }
  });

  // Use AI suggestion button
  document.getElementById('useSuggestionBtn').addEventListener('click', () => {
    const modal = document.getElementById('aiSuggestionModal');
    const name = modal.dataset.suggestedName;
    const description = modal.dataset.suggestedDescription;
    
    // Populate the variable form
    document.getElementById('variableName').value = name;
    document.getElementById('variableDescription').value = description;
    
    // Close AI suggestion modal
    modal.classList.remove('active');
    
    // Keep variable modal open so user can review/edit before saving
    showNotification('Success', 'Suggestion applied. Review and save the variable.', 'success');
  });
  
  // AI Pattern Suggestion form
  document.getElementById('aiPatternForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prompt = document.getElementById('patternPrompt').value.trim();
    const categoryName = document.getElementById('categoryName').value.trim();
    const categoryDesc = document.getElementById('categoryDescription').value.trim();
    
    if (!prompt) return;
    
    const generateBtn = document.getElementById('generatePatternBtn');
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = 'Generating...';
    generateBtn.disabled = true;
    
    try {
      const config = await ipcRenderer.invoke('config:load');
      const result = await ipcRenderer.invoke('api:generatePattern', {
        prompt,
        categoryName,
        categoryDescription: categoryDesc,
        variables: config.variables
      });
      
      if (result.success) {
        // Display the suggestion
        document.getElementById('suggestedPattern').textContent = result.pattern;
        document.getElementById('patternExample').textContent = result.example || 'Example: document_2024-03-15_processed.pdf';
        document.getElementById('patternSuggestionResult').style.display = 'block';
        
        // Store the suggestion for later use
        document.getElementById('aiPatternModal').dataset.suggestedPattern = result.pattern;
        
        // Update buttons
        generateBtn.style.display = 'none';
        document.getElementById('usePatternBtn').style.display = 'block';
      } else {
        showNotification('Error', result.error || 'Failed to generate pattern', 'error');
      }
    } catch (error) {
      showNotification('Error', 'Failed to generate pattern', 'error');
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.disabled = false;
    }
  });
  
  // Category AI suggestion form
  document.getElementById('aiCategorySuggestionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prompt = document.getElementById('categoryPrompt').value.trim();
    if (!prompt) return;
    
    const generateBtn = document.getElementById('generateCategorySuggestionBtn');
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = 'Generating...';
    generateBtn.disabled = true;
    
    try {
      const result = await ipcRenderer.invoke('api:generateCategorySuggestion', prompt);
      
      if (result.success) {
        // Display the suggestion
        document.getElementById('suggestedCategoryName').textContent = result.suggestion.name;
        document.getElementById('suggestedCategoryDescription').textContent = result.suggestion.description;
        document.getElementById('categorySuggestionResult').style.display = 'block';
        
        // Store the suggestion for later use
        document.getElementById('aiCategorySuggestionModal').dataset.suggestedName = result.suggestion.name;
        document.getElementById('aiCategorySuggestionModal').dataset.suggestedDescription = result.suggestion.description;
        
        // Update buttons
        generateBtn.style.display = 'none';
        document.getElementById('useCategorySuggestionBtn').style.display = 'block';
      } else {
        showNotification('Error', result.error || 'Failed to generate category suggestion', 'error');
      }
    } catch (error) {
      showNotification('Error', 'Failed to generate category suggestion', 'error');
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.disabled = false;
    }
  });

  // Use category suggestion button
  document.getElementById('useCategorySuggestionBtn').addEventListener('click', () => {
    const modal = document.getElementById('aiCategorySuggestionModal');
    const name = modal.dataset.suggestedName;
    const description = modal.dataset.suggestedDescription;
    
    // Fill the category form with the suggested values
    document.getElementById('categoryName').value = name;
    document.getElementById('categoryDescription').value = description;
    
    // Close the AI suggestion modal
    modal.classList.remove('active');
  });

  // Use pattern suggestion button
  document.getElementById('usePatternBtn').addEventListener('click', () => {
    const modal = document.getElementById('aiPatternModal');
    const pattern = modal.dataset.suggestedPattern;
    
    // Populate the pattern field
    document.getElementById('namingPattern').value = pattern;
    
    // Close AI pattern modal
    modal.classList.remove('active');
    
    // Keep category modal open so user can review/edit before saving
    showNotification('Success', 'Pattern applied. Review and save the category.', 'success');
  });
  
  // Search Modal functionality
  const searchModal = document.getElementById('searchModal');
  const searchTriggerBtn = document.getElementById('searchTriggerBtn');
  const searchModalInput = document.getElementById('searchModalInput');
  const searchModalClose = document.getElementById('searchModalClose');
  const searchModalBackdrop = searchModal?.querySelector('.search-modal-backdrop');
  const searchModalScope = document.getElementById('searchModalScope');
  
  // Perform search within modal
  async function performSearchInModal(query, scope) {
    const resultsDiv = document.getElementById('searchModalResults');
    if (!resultsDiv) return;
    
    // Show loading state
    resultsDiv.innerHTML = `
      <div class="search-modal-loading">
        <div class="spinner"></div>
        <p>Searching your documents...</p>
      </div>
    `;
    
    try {
      const result = await ipcRenderer.invoke('ai:searchFiles', {
        query: query,
        scope: scope
      });
      
      if (result.success && result.results && result.results.length > 0) {
        displaySearchResults(result.results, resultsDiv);
      } else {
        resultsDiv.innerHTML = `
          <div class="search-modal-empty">
            <div class="search-modal-empty-icon">📄</div>
            <p>No documents found matching your query</p>
            <div class="search-modal-tips">
              <p>Try different keywords or check your search scope</p>
            </div>
          </div>
        `;
      }
    } catch (error) {
      resultsDiv.innerHTML = `
        <div class="search-modal-error">
          <div class="search-modal-error-icon">⚠️</div>
          <p>Search failed: ${error.message || 'Unknown error'}</p>
        </div>
      `;
    }
  }
  
  // Display search results in modal
  function displaySearchResults(results, container) {
    const resultsHTML = results.map((result) => {
      const score = result.score || 0;
      const scorePercent = Math.round(score * 100);
      
      // Determine score class for color coding
      let scoreClass = 'low-score';
      if (score >= 0.7) scoreClass = 'high-score';
      else if (score >= 0.4) scoreClass = 'medium-score';
      
      return `
        <div class="search-result-item" data-path="${result.path}">
          <div class="search-result-header">
            <h4 class="search-result-filename">${result.filename}</h4>
            <div class="search-result-score ${scoreClass}">Score: ${scorePercent}%</div>
          </div>
          <div class="search-result-path">${result.path}</div>
          ${result.reason ? `<div class="search-result-reason">${result.reason}</div>` : ''}
          <div class="search-result-actions">
            <button class="search-result-btn" onclick="openFile('${result.path}')">
              Open File
            </button>
            <button class="search-result-btn secondary" onclick="showFileLocation('${result.path}')">
              Show in Folder
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    container.innerHTML = `
      <div class="search-modal-results-header">
        <h3>Found ${results.length} document${results.length === 1 ? '' : 's'}</h3>
      </div>
      <div class="search-modal-results-list">
        ${resultsHTML}
      </div>
    `;
  }
  
  // File action functions
  window.openFile = async function(filePath) {
    try {
      await ipcRenderer.invoke('file:open', filePath);
    } catch (error) {
      showNotification('Error', `Could not open file: ${error.message}`, 'error');
    }
  };
  
  window.showFileLocation = async function(filePath) {
    try {
      const { shell } = require('electron');
      shell.showItemInFolder(filePath);
    } catch (error) {
      showNotification('Error', `Could not show file location: ${error.message}`, 'error');
    }
  };
  let currentResults = [];
  let showingCount = 3;
  
  // Show search modal
  function showSearchModal() {
    if (searchModal) {
      searchModal.classList.add('active');
      searchModalInput.focus();
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
  }
  
  // Hide search modal
  function hideSearchModal() {
    if (searchModal) {
      searchModal.classList.remove('active');
      document.body.style.overflow = ''; // Restore scrolling
      searchModalInput.value = '';
      // Clear results and show empty state
      const resultsDiv = document.getElementById('searchModalResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div class="search-modal-empty">
            <div class="search-modal-empty-icon">🔍</div>
            <p>Start typing to search your documents</p>
            <div class="search-modal-shortcuts">
              <div class="search-shortcut-item">
                <kbd>↵</kbd>
                <span>to search</span>
              </div>
              <div class="search-shortcut-item">
                <kbd>↑↓</kbd>
                <span>to navigate</span>
              </div>
              <div class="search-shortcut-item">
                <kbd>esc</kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        `;
      }
    }
  }
  
  // Global keyboard shortcut (Ctrl+K / Cmd+K)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      showSearchModal();
    }
    
    // ESC to close search modal
    if (e.key === 'Escape' && searchModal?.classList.contains('active')) {
      e.preventDefault();
      hideSearchModal();
    }
  });
  
  // Event listeners
  if (searchTriggerBtn) {
    searchTriggerBtn.addEventListener('click', showSearchModal);
  }
  
  if (searchModalClose) {
    searchModalClose.addEventListener('click', hideSearchModal);
  }
  
  if (searchModalBackdrop) {
    searchModalBackdrop.addEventListener('click', hideSearchModal);
  }
  
  if (searchModalInput) {
    searchModalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchModalInput.value.trim();
        if (query.length >= 3) {
          performSearchInModal(query, searchModalScope.value);
        } else {
          showNotification('Search Query Too Short', 'Please enter at least 3 characters to search', 'error');
        }
      } else if (e.key === 'Escape') {
        hideSearchModal();
      }
    });
  }
  
  // Update shortcut display based on platform
  const shortcutDisplay = document.querySelector('.search-shortcut');
  if (shortcutDisplay) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    shortcutDisplay.textContent = isMac ? '⌘K' : 'Ctrl+K';
  }
  
  // Load more button
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      showingCount = Math.min(showingCount + 5, currentResults.length);
      displaySearchResults(currentResults);
    });
  }
  
  // Removed old performSearch function - now using performSearchInModal

  // Description suggestion modal handlers
  document.getElementById('keepOriginalBtn').addEventListener('click', async () => {
    const modal = document.getElementById('descriptionSuggestionModal');
    const variableName = modal.dataset.variableName;
    const originalDescription = modal.dataset.originalDescription;
    
    // Close suggestion modal
    modal.classList.remove('active');
    
    // Save with original description
    const formatting = document.getElementById('variableFormatting').value || 'none';
    await saveVariable({ name: variableName, description: originalDescription, formatting });
  });

  document.getElementById('saveEditedBtn').addEventListener('click', async () => {
    const modal = document.getElementById('descriptionSuggestionModal');
    const variableName = modal.dataset.variableName;
    const editedDescription = document.getElementById('suggestedDescriptionText').value;
    
    if (!editedDescription.trim()) {
      showNotification('Error', 'Description cannot be empty', 'error');
      return;
    }
    
    // Close suggestion modal
    modal.classList.remove('active');
    
    // Save with edited description
    const formatting = document.getElementById('variableFormatting').value || 'none';
    await saveVariable({ name: variableName, description: editedDescription, formatting });
  });
  
  // Settings form submission
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const apiKey = document.getElementById('openaiApiKey').value.trim();
    const minimizeToTray = document.getElementById('minimizeToTray').checked;
    const enableDesktopNotifications = document.getElementById('enableDesktopNotifications').checked;
    const autoStartMonitoring = document.getElementById('autoStartMonitoring').checked;
    
    // Save API key and notification settings
    await ipcRenderer.invoke('config:updateSettings', {
      openai_api_key: apiKey,
      enable_desktop_notifications: enableDesktopNotifications,
      auto_start_monitoring: autoStartMonitoring
    });
    
    currentConfig.openai_api_key = apiKey;
    currentConfig.enable_desktop_notifications = enableDesktopNotifications;
    currentConfig.auto_start_monitoring = autoStartMonitoring;
    
    // Save minimize to tray setting
    localStorage.setItem('minimizeToTray', minimizeToTray);
    
    document.getElementById('settingsModal').classList.remove('active');
    showNotification('Success', 'Settings saved successfully', 'success');
  });
  
  // Introduction walkthrough handlers
  setupIntroWalkthroughHandlers();
  
  // Test API key button
  document.getElementById('testApiKeyBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('openaiApiKey').value.trim();
    const statusEl = document.getElementById('apiKeyStatus');
    
    if (!apiKey) {
      statusEl.textContent = 'Please enter an API key';
      statusEl.className = 'api-key-status error';
      return;
    }
    
    if (!apiKey.startsWith('sk-')) {
      statusEl.textContent = 'API key should start with "sk-"';
      statusEl.className = 'api-key-status error';
      return;
    }
    
    statusEl.textContent = 'Testing connection...';
    statusEl.className = 'api-key-status testing';
    
    try {
      const result = await ipcRenderer.invoke('api:testKey', apiKey);
      if (result.success) {
        statusEl.textContent = '✓ Connection successful';
        statusEl.className = 'api-key-status success';
      } else {
        statusEl.textContent = `✗ ${result.error}`;
        statusEl.className = 'api-key-status error';
      }
    } catch (error) {
      statusEl.textContent = `✗ Test failed: ${error.message}`;
      statusEl.className = 'api-key-status error';
    }
  });

  // Queue Error Modal handlers
  const queueErrorModal = document.getElementById('queueErrorModal');
  const rerunBtn = document.getElementById('rerunFileBtn');
  
  if (queueErrorModal && rerunBtn) {
    // Close error modal on outside click
    queueErrorModal.addEventListener('click', (e) => {
      if (e.target === queueErrorModal) {
        queueErrorModal.style.display = 'none';
      }
    });
    
    // Close button handler
    const queueErrorCloseBtn = queueErrorModal.querySelector('.close-btn');
    if (queueErrorCloseBtn) {
      queueErrorCloseBtn.addEventListener('click', () => {
        queueErrorModal.style.display = 'none';
      });
    }
    
    // Cancel button handler
    const queueErrorCancelBtn = queueErrorModal.querySelector('.cancel-btn');
    if (queueErrorCancelBtn) {
      queueErrorCancelBtn.addEventListener('click', () => {
        queueErrorModal.style.display = 'none';
      });
    }
    
    // Rerun button handler
    rerunBtn.addEventListener('click', rerunFailedFile);
  }
}

// Save variable helper function
async function saveVariable(variable) {
  // Show loading modal for short description generation
  showLoadingModal('Saving Variable', 'Generating short description...');
  
  try {
    // Generate short description
    const shortDescResult = await ipcRenderer.invoke('api:generateShortDescription', variable.name, variable.description);
    
    if (shortDescResult.success) {
      variable.shortDescription = shortDescResult.shortDescription;
    }
    
    // Save the variable
    let result;
    if (editingVariableIndex >= 0) {
      result = await ipcRenderer.invoke('config:updateVariable', editingVariableIndex, variable);
    } else {
      result = await ipcRenderer.invoke('config:addVariable', variable);
    }
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    currentConfig = result.data;
    
    hideLoadingModal();
    document.getElementById('variableModal').classList.remove('active');
    renderVariables();
    updateAvailableVariables();
    showNotification('Success', `Variable "{${variable.name}}" saved`, 'success');
  } catch (error) {
    hideLoadingModal();
    showNotification('Error', 'Failed to save variable', 'error');
  }
}

// Show description suggestion modal
function showDescriptionSuggestion(variable, evaluation) {
  const modal = document.getElementById('descriptionSuggestionModal');
  
  // Populate the modal with evaluation data
  document.getElementById('currentDescriptionText').textContent = variable.description;
  document.getElementById('suggestedDescriptionText').value = evaluation.suggestedDescription;
  
  // Populate issues list
  const issuesList = document.getElementById('issuesList');
  issuesList.innerHTML = evaluation.issues.map(issue => `<li>${issue}</li>`).join('');
  
  // Store the variable data for later use
  modal.dataset.variableName = variable.name;
  modal.dataset.originalDescription = variable.description;
  
  modal.classList.add('active');
}

// Show loading modal
function showLoadingModal(title = 'Loading', message = 'Please wait...') {
  const modal = document.getElementById('loadingModal');
  document.getElementById('loadingTitle').textContent = title;
  document.getElementById('loadingMessage').textContent = message;
  modal.classList.add('active');
}

// Hide loading modal
function hideLoadingModal() {
  const modal = document.getElementById('loadingModal');
  modal.classList.remove('active');
}

// Show variable details modal
function showVariableDetails(index) {
  const variable = currentConfig.variables[index];
  if (!variable) return;
  
  const modal = document.getElementById('variableDetailsModal');
  document.getElementById('detailsVariableName').textContent = `{${variable.name}}`;
  document.getElementById('detailsShortDescription').textContent = variable.shortDescription || 'No short description available';
  document.getElementById('detailsFullDescription').textContent = variable.description;
  
  modal.classList.add('active');
}

// Make showVariableDetails global for onclick
window.showVariableDetails = showVariableDetails;

// Show category details modal
function showCategoryDetails(index) {
  const category = currentConfig.categories[index];
  if (!category) return;
  
  const modal = document.getElementById('categoryDetailsModal');
  document.getElementById('detailsCategoryName').textContent = category.name;
  document.getElementById('detailsCategoryShortDescription').textContent = category.shortDescription || 'No short description available';
  document.getElementById('detailsCategoryDescription').textContent = category.description;
  document.getElementById('detailsCategoryPattern').textContent = category.naming_pattern;
  
  modal.classList.add('active');
}

// Make showCategoryDetails global for onclick
window.showCategoryDetails = showCategoryDetails;

// Get file type icon based on extension
function getFileTypeIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const icons = {
    // Documents
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    // Spreadsheets
    'csv': '📊',
    'xls': '📊',
    'xlsx': '📊',
    // Images
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'gif': '🖼️',
    'bmp': '🖼️',
    'tiff': '🖼️',
    'webp': '🖼️'
  };
  return icons[ext] || '📁';
}

// Get file type category
function getFileTypeCategory(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const categories = {
    'pdf': 'PDF Document',
    'doc': 'Word Document',
    'docx': 'Word Document',
    'csv': 'Spreadsheet',
    'xls': 'Excel Spreadsheet',
    'xlsx': 'Excel Spreadsheet',
    'png': 'Image',
    'jpg': 'Image',
    'jpeg': 'Image',
    'gif': 'Image',
    'bmp': 'Image',
    'tiff': 'Image',
    'webp': 'Image'
  };
  return categories[ext] || 'File';
}

// Show notification
function showNotification(title, message, type = 'success') {
  const notification = document.getElementById('notification');
  const icon = document.getElementById('notificationIcon');
  const titleEl = document.getElementById('notificationTitle');
  const messageEl = document.getElementById('notificationMessage');
  
  // Update content
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  // Update icon
  icon.className = `notification-icon ${type}`;
  icon.innerHTML = type === 'success' ? '✓' : '✗';
  
  // Show notification
  notification.classList.add('show');
  
  // Hide after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
  }, 4000);
}

// Initialize processing queue
function initializeProcessingQueue() {
  // Initialize queue stats
  let dailyCost = 0;
  let processedToday = 0;
  
  // Track daily costs from processing log
  updateQueueStats();
  
  // Listen for new files being processed
  ipcRenderer.on('file:processing', (event, data) => {
    addToProcessingQueue(data);
  });
  
  // Listen for processing completion
  ipcRenderer.on('file:processed', (event, result) => {
    updateQueueItem(result);
    updateQueueStats();
  });
}

// Add item to processing queue
function addToProcessingQueue(data) {
  const queueList = document.getElementById('queueList');
  const placeholder = queueList.querySelector('.queue-item-placeholder');
  
  // Remove placeholder if it exists
  if (placeholder) {
    placeholder.remove();
  }
  
  // Create queue item
  const queueItem = document.createElement('div');
  queueItem.className = 'queue-item';
  queueItem.id = `queue-item-${data.filename}`;
  
  // Store original file data for potential rerun
  queueItem.dataset.filePath = data.path;
  queueItem.dataset.fileType = data.type;
  queueItem.dataset.fileName = data.filename;
  
  queueItem.innerHTML = `
    <div class="queue-item-status processing">⏳</div>
    <div class="queue-item-info">
      <div class="queue-item-name">${data.filename}</div>
      <div class="queue-item-progress">Starting analysis...</div>
    </div>
    <div class="queue-item-cost">~$0.00</div>
  `;
  
  // Add to top of queue
  queueList.insertBefore(queueItem, queueList.firstChild);
  
  // Remove old items if queue gets too long (keep last 10)
  const items = queueList.querySelectorAll('.queue-item');
  if (items.length > 10) {
    items[items.length - 1].remove();
  }
}

// Update queue item when processing completes
function updateQueueItem(result) {
  const queueItem = document.getElementById(`queue-item-${result.fileName}`);
  if (!queueItem) return;
  
  const status = queueItem.querySelector('.queue-item-status');
  const progress = queueItem.querySelector('.queue-item-progress');
  const cost = queueItem.querySelector('.queue-item-cost');
  
  if (result.success) {
    status.className = 'queue-item-status completed';
    status.innerHTML = '✓';
    progress.textContent = `Organized → ${result.category}`;
    
    const totalCost = result.tokenUsage?.totalCost || 0;
    cost.textContent = `$${totalCost.toFixed(4)}`;
    
    // Remove success items after 10 seconds
    setTimeout(() => {
      if (queueItem.parentNode) {
        queueItem.remove();
        showQueuePlaceholderIfEmpty();
      }
    }, 10000);
  } else {
    status.className = 'queue-item-status failed';
    status.innerHTML = '⚠️';
    progress.textContent = 'Click to see error details';
    cost.textContent = '$0.00';
    
    // Store error details for display
    queueItem.dataset.errorMessage = result.error || 'Unknown error occurred';
    queueItem.dataset.errorStack = result.errorStack || '';
    queueItem.dataset.processingStep = result.processingStep || 'unknown';
    
    // Add click handler for error details
    queueItem.style.cursor = 'pointer';
    queueItem.addEventListener('click', () => showQueueErrorDetails(queueItem));
    
    // Add hover effect for failed items
    queueItem.classList.add('queue-item-error');
    
    // Failed items stay longer (30 seconds) to give user time to investigate
    setTimeout(() => {
      if (queueItem.parentNode) {
        queueItem.remove();
        showQueuePlaceholderIfEmpty();
      }
    }, 30000);
  }
}

// Show placeholder if queue is empty
function showQueuePlaceholderIfEmpty() {
  const remainingItems = document.querySelectorAll('.queue-item');
  if (remainingItems.length === 0) {
    showQueuePlaceholder();
  }
}

// Update queue statistics
function updateQueueStats() {
  const processingLogs = JSON.parse(localStorage.getItem('processing-logs') || '[]');
  const today = new Date().toDateString();
  
  // Calculate today's stats
  const todayLogs = processingLogs.filter(log => 
    new Date(log.timestamp).toDateString() === today
  );
  
  const todayCount = todayLogs.length;
  const todayCost = todayLogs.reduce((sum, log) => 
    sum + (log.tokenUsage?.totalCost || 0), 0
  );
  
  // Update UI
  document.getElementById('queueCount').textContent = `${todayCount} files today`;
  document.getElementById('queueCost').textContent = `$${todayCost.toFixed(4)}`;
}

// Show placeholder when queue is empty
function showQueuePlaceholder() {
  const queueList = document.getElementById('queueList');
  if (queueList.querySelectorAll('.queue-item').length === 0) {
    queueList.innerHTML = `
      <div class="queue-item-placeholder">
        <div class="placeholder-icon">⏳</div>
        <p>No files currently processing</p>
        <p style="font-size: 12px; opacity: 0.7; margin-top: 5px;">
          Files will appear here when added to the monitored folder
        </p>
      </div>
    `;
  }
}

// Show error details modal for queue item
function showQueueErrorDetails(queueItem) {
  const modal = document.getElementById('queueErrorModal');
  const fileName = queueItem.dataset.fileName;
  const errorMessage = queueItem.dataset.errorMessage;
  const errorStack = queueItem.dataset.errorStack;
  const processingStep = queueItem.dataset.processingStep;
  
  // Populate modal content
  document.getElementById('errorFileName').textContent = fileName;
  document.getElementById('errorMessage').textContent = errorMessage;
  document.getElementById('errorStep').textContent = getProcessingStepDescription(processingStep);
  
  // Show technical details if available
  const stackGroup = document.getElementById('errorStackGroup');
  if (errorStack && errorStack.trim()) {
    document.getElementById('errorStack').textContent = errorStack;
    stackGroup.style.display = 'block';
  } else {
    stackGroup.style.display = 'none';
  }
  
  // Update suggestions based on error type
  updateErrorSuggestions(errorMessage, processingStep);
  
  // Store queue item reference for rerun functionality
  modal.dataset.queueItemId = queueItem.id;
  
  // Show modal
  modal.style.display = 'block';
}

// Get human-readable description for processing step
function getProcessingStepDescription(step) {
  const stepDescriptions = {
    'file_access': 'Accessing the file',
    'text_extraction': 'Extracting text from document',
    'audio_transcription': 'Transcribing audio content',
    'video_processing': 'Processing video content',
    'ai_categorization': 'AI document categorization',
    'variable_extraction': 'Extracting document variables',
    'file_organization': 'Organizing and renaming file',
    'unknown': 'Unknown processing step'
  };
  
  return stepDescriptions[step] || stepDescriptions['unknown'];
}

// Update error suggestions based on error type
function updateErrorSuggestions(errorMessage, processingStep) {
  const suggestionsList = document.getElementById('errorSuggestions');
  let suggestions = [];
  
  const error = errorMessage.toLowerCase();
  
  if (error.includes('api key') || error.includes('authentication')) {
    suggestions = [
      'Check your OpenAI API key in Settings',
      'Ensure the API key has sufficient credits',
      'Verify the API key is correctly configured'
    ];
  } else if (error.includes('file not found') || error.includes('access')) {
    suggestions = [
      'Ensure the file still exists at the original location',
      'Check file permissions and accessibility',
      'Verify the file is not locked by another application'
    ];
  } else if (error.includes('unsupported') || error.includes('format')) {
    suggestions = [
      'Check if the file format is supported',
      'Try converting the file to a supported format',
      'Ensure the file is not corrupted'
    ];
  } else if (error.includes('network') || error.includes('timeout')) {
    suggestions = [
      'Check your internet connection',
      'Try again in a few moments',
      'Verify OpenAI services are accessible'
    ];
  } else if (processingStep === 'text_extraction') {
    suggestions = [
      'Ensure the document contains readable text',
      'Check if the file is password protected',
      'Try with a different document format'
    ];
  } else if (processingStep === 'ai_categorization') {
    suggestions = [
      'Check your OpenAI API key and credits',
      'Verify your categories are properly configured',
      'Try with a simpler document first'
    ];
  } else {
    suggestions = [
      'Check the file is accessible and not corrupted',
      'Ensure you have a valid OpenAI API key configured',
      'Verify the file format is supported',
      'Try processing the file again'
    ];
  }
  
  suggestionsList.innerHTML = suggestions.map(s => `<li>${s}</li>`).join('');
}

// Manual rerun functionality
async function rerunFailedFile() {
  const modal = document.getElementById('queueErrorModal');
  const queueItemId = modal.dataset.queueItemId;
  const queueItem = document.getElementById(queueItemId);
  
  if (!queueItem) {
    showNotification('Error', 'Could not find the file to rerun', 'error');
    return;
  }
  
  const filePath = queueItem.dataset.filePath;
  const fileType = queueItem.dataset.fileType;
  const fileName = queueItem.dataset.fileName;
  
  // Close the modal
  modal.style.display = 'none';
  
  // Reset the queue item to processing state
  const status = queueItem.querySelector('.queue-item-status');
  const progress = queueItem.querySelector('.queue-item-progress');
  const cost = queueItem.querySelector('.queue-item-cost');
  
  status.className = 'queue-item-status processing';
  status.innerHTML = '⏳';
  progress.textContent = 'Retrying processing...';
  cost.textContent = '~$0.00';
  
  // Remove error styling and handlers
  queueItem.classList.remove('queue-item-error');
  queueItem.style.cursor = 'default';
  queueItem.removeEventListener('click', showQueueErrorDetails);
  
  // Clear error data
  delete queueItem.dataset.errorMessage;
  delete queueItem.dataset.errorStack;
  delete queueItem.dataset.processingStep;
  
  try {
    // Request manual processing via IPC
    const result = await ipcRenderer.invoke('file:reprocess', {
      path: filePath,
      type: fileType,
      filename: fileName
    });
    
    if (result.success) {
      showNotification('Success', `${fileName} reprocessed successfully`, 'success');
    } else {
      showNotification('Error', `Failed to reprocess ${fileName}: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error during manual rerun:', error);
    showNotification('Error', `Failed to reprocess ${fileName}`, 'error');
    
    // Reset back to error state
    status.className = 'queue-item-status failed';
    status.innerHTML = '⚠️';
    progress.textContent = 'Click to see error details';
    queueItem.classList.add('queue-item-error');
    queueItem.style.cursor = 'pointer';
    queueItem.addEventListener('click', () => showQueueErrorDetails(queueItem));
  }
}

async function handleFiles(files) {
  if (!currentConfig || !currentConfig.watched_folder) {
    showNotification('Error', 'Please configure a watched folder first', 'error');
    return;
  }

  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    const supportedTypes = ['pdf', 'doc', 'docx', 'csv', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'];
    const fileIcon = getFileTypeIcon(file.name);
    
    if (supportedTypes.includes(ext)) {
      // Show processing notification
      showNotification(`${fileIcon} Processing`, `Processing ${file.name}...`, 'success');
      
      try {
        // Create a temporary file path in the watched folder
        const tempPath = path.join(currentConfig.watched_folder, file.name);
        
        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Send to main process for actual processing
        const result = await ipcRenderer.invoke('file:processDropped', {
          fileName: file.name,
          buffer: buffer,
          fileType: ext,
          originalPath: tempPath
        });
        
        if (result.success) {
          showNotification(
            `${fileIcon} Processed`, 
            `${file.name} → ${result.category}`,
            'success'
          );
        } else {
          showNotification(
            `${fileIcon} Failed`, 
            `Failed to process ${file.name}: ${result.error}`,
            'error'
          );
        }
        
      } catch (error) {
        console.error('Error processing dropped file:', error);
        showNotification('Error', `Failed to process ${file.name}: ${error.message}`, 'error');
      }
    } else {
      showNotification('Error', `${file.name} is not a supported file type`, 'error');
    }
  }
}

// Global functions for inline onclick handlers
window.editCategory = (index) => {
  showCategoryModal(currentConfig.categories[index], index);
};

window.deleteCategory = async (index) => {
  if (confirm('Are you sure you want to delete this category?')) {
    try {
      const result = await ipcRenderer.invoke('config:deleteCategory', index);
      if (!result.success) {
        throw new Error(result.error);
      }
      currentConfig = result.data;
      renderCategories();
      showNotification('Success', 'Category deleted', 'success');
    } catch (error) {
      showNotification('Error', error.message || 'Failed to delete category', 'error');
    }
  }
};

window.editVariable = (index) => {
  showVariableModal(currentConfig.variables[index], index);
};

window.deleteVariable = async (index) => {
  if (confirm('Are you sure you want to delete this variable?')) {
    try {
      const result = await ipcRenderer.invoke('config:deleteVariable', index);
      if (!result.success) {
        throw new Error(result.error);
      }
      currentConfig = result.data;
      renderVariables();
      updateAvailableVariables();
      showNotification('Success', 'Variable deleted', 'success');
    } catch (error) {
      showNotification('Error', error.message || 'Failed to delete variable', 'error');
    }
  }
};

window.insertVariable = insertVariable;

// Introduction Walkthrough Functions
function showIntroWalkthrough() {
  const modal = document.getElementById('introWalkthroughModal');
  modal.classList.add('active');
  showIntroStep(1);
}

function showIntroStep(stepNumber) {
  // Hide all steps
  document.querySelectorAll('.intro-step').forEach(step => {
    step.style.display = 'none';
  });
  
  // Show current step
  const currentStep = document.getElementById(`introStep${stepNumber}`);
  if (currentStep) {
    currentStep.style.display = 'block';
  }
}

function setupIntroWalkthroughHandlers() {
  // Step 1 handlers
  document.getElementById('nextStep1Btn').addEventListener('click', () => {
    showIntroStep(2);
  });
  
  document.getElementById('skipIntroBtn').addEventListener('click', () => {
    finishIntroWalkthrough();
  });
  
  // Step 2 handlers
  document.getElementById('backStep2Btn').addEventListener('click', () => {
    showIntroStep(1);
  });
  
  document.getElementById('nextStep2Btn').addEventListener('click', () => {
    showIntroStep(3);
  });
  
  // Step 3 handlers
  document.getElementById('backStep3Btn').addEventListener('click', () => {
    showIntroStep(2);
  });
  
  document.getElementById('nextStep3Btn').addEventListener('click', () => {
    showIntroStep(4);
  });
  
  // Step 4 handlers
  document.getElementById('backStep4Btn').addEventListener('click', () => {
    showIntroStep(3);
  });
  
  document.getElementById('finishIntroBtn').addEventListener('click', () => {
    finishIntroWalkthrough();
  });
}

function finishIntroWalkthrough() {
  // Mark as seen so it never shows again
  localStorage.setItem('hasSeenIntroWalkthrough', 'true');
  
  // Close the modal
  document.getElementById('introWalkthroughModal').classList.remove('active');
  
  // Show completion notification
  showNotification('Welcome!', 'You can now start using ParaFile to organize your documents', 'success');
}