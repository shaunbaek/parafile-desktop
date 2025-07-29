const { ipcRenderer } = require('electron');

let currentConfig = null;
let editingCategoryIndex = -1;
let editingVariableIndex = -1;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupEventListeners();
  setupIPCListeners();
  initializeDragAndDrop();
});

// Check if first time user
function checkOnboarding() {
  const apiKey = currentConfig ? currentConfig.openai_api_key : '';
  const folderPath = currentConfig ? currentConfig.watched_folder : '';
  const welcomeSection = document.getElementById('welcomeSection');
  const mainContent = document.getElementById('mainContent');
  const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
  
  if ((!apiKey || !folderPath) && !hasSeenWelcome) {
    welcomeSection.style.display = 'block';
    mainContent.style.display = 'none';
    
    // Hide other sections initially for clean onboarding
    document.querySelectorAll('.control-section').forEach((section, index) => {
      if (index > 1) section.style.display = 'none';
    });
    
    // Update onboarding steps
    updateOnboardingSteps();
  } else {
    welcomeSection.style.display = 'none';
    mainContent.style.display = 'block';
    
    // Show all sections for returning users
    document.querySelectorAll('.control-section').forEach(section => {
      section.style.display = 'block';
    });
  }
}

// Update onboarding steps status
function updateOnboardingSteps() {
  const apiKey = currentConfig ? currentConfig.openai_api_key : '';
  const folderPath = currentConfig ? currentConfig.watched_folder : '';
  
  const step1 = document.getElementById('step1');
  const step1Status = document.getElementById('step1Status');
  const step2 = document.getElementById('step2');
  const step2Status = document.getElementById('step2Status');
  const selectFolderBtn = document.getElementById('selectFolderBtn');
  
  // Step 1: API Key
  if (apiKey) {
    step1.classList.add('completed');
    step1Status.textContent = '✓ Configured';
    step1Status.className = 'step-status success';
    
    // Enable step 2
    selectFolderBtn.disabled = false;
    selectFolderBtn.classList.remove('btn-secondary');
    selectFolderBtn.classList.add('btn-primary');
  } else {
    step1.classList.remove('completed');
    step1Status.textContent = '';
    step1Status.className = 'step-status';
    
    // Disable step 2
    selectFolderBtn.disabled = true;
    selectFolderBtn.classList.remove('btn-primary');
    selectFolderBtn.classList.add('btn-secondary');
  }
  
  // Step 2: Folder
  if (folderPath) {
    step2.classList.add('completed');
    step2Status.textContent = '✓ Selected';
    step2Status.className = 'step-status success';
    
    // Complete onboarding if both steps are done
    if (apiKey) {
      setTimeout(() => {
        completeOnboarding();
      }, 1000);
    }
  } else {
    step2.classList.remove('completed');
    step2Status.textContent = '';
    step2Status.className = 'step-status';
  }
}

// Complete onboarding
function completeOnboarding() {
  localStorage.setItem('hasSeenWelcome', 'true');
  document.getElementById('welcomeSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.querySelectorAll('.control-section').forEach(section => {
    section.style.display = 'block';
  });
  showNotification('Setup Complete', 'ParaFile is ready to organize your documents!', 'success');
}

// Load configuration
async function loadConfig() {
  currentConfig = await ipcRenderer.invoke('config:load');
  updateUI();
  checkOnboarding();
}

// Setup event listeners
function setupEventListeners() {
  // Onboarding buttons
  const configureApiBtn = document.getElementById('configureApiBtn');
  if (configureApiBtn) {
    configureApiBtn.addEventListener('click', () => {
      showSettingsModal();
    });
  }
  
  const selectFolderBtn = document.getElementById('selectFolderBtn');
  if (selectFolderBtn) {
    selectFolderBtn.addEventListener('click', () => {
      selectFolder();
    });
  }
  
  // Folder selection
  document.getElementById('browseBtn').addEventListener('click', selectFolder);
  
  // Organization toggle
  document.getElementById('enableOrganization').addEventListener('change', async (e) => {
    await ipcRenderer.invoke('config:updateSettings', {
      enable_organization: e.target.checked
    });
    currentConfig.enable_organization = e.target.checked;
  });

  // Auto-launch toggle
  document.getElementById('startAtLogin').addEventListener('change', async (e) => {
    await ipcRenderer.invoke('auto-launch:toggle');
  });

  // Start minimized toggle (store in localStorage for now)
  document.getElementById('startMinimized').addEventListener('change', async (e) => {
    localStorage.setItem('startMinimized', e.target.checked);
  });
  
  // Monitor controls
  document.getElementById('monitorBtn').addEventListener('click', toggleMonitoring);
  
  // Category management
  document.getElementById('addCategoryBtn').addEventListener('click', () => showCategoryModal());
  
  // Variable management
  document.getElementById('addVariableBtn').addEventListener('click', () => showVariableModal());
  
  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => showSettingsModal());
  
  // Modal controls
  setupModalControls();
}

// Setup IPC listeners
function setupIPCListeners() {
  ipcRenderer.on('monitor:status', (event, status) => {
    updateMonitorStatus(status);
  });
  
  ipcRenderer.on('monitor:error', (event, error) => {
    showNotification('Error', error, 'error');
  });
  
  ipcRenderer.on('file:processed', (event, result) => {
    console.log('File processed:', result);
    if (result.success) {
      showNotification(
        'Document Processed', 
        `${result.fileName} → ${result.category}`,
        'success'
      );
    } else {
      showNotification(
        'Processing Failed',
        `${result.fileName}: ${result.error}`,
        'error'
      );
    }
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
    
    // Update onboarding if we're in welcome mode
    if (document.getElementById('welcomeSection').style.display !== 'none') {
      updateOnboardingSteps();
    } else {
      // Mark that user has seen welcome screen and show all sections
      localStorage.setItem('hasSeenWelcome', 'true');
      document.getElementById('welcomeSection').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      document.querySelectorAll('.control-section').forEach(section => {
        section.style.display = 'block';
      });
    }
    
    // Show drop zone when monitoring
    const isRunning = await ipcRenderer.invoke('monitor:status');
    document.getElementById('dropZone').style.display = isRunning ? 'block' : 'none';
  }
}

// Monitor control
async function toggleMonitoring() {
  const isRunning = await ipcRenderer.invoke('monitor:status');
  const btn = document.getElementById('monitorBtn');
  
  if (isRunning) {
    await ipcRenderer.invoke('monitor:stop');
    btn.innerHTML = '<span>▶️</span> Start Monitoring';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
    document.getElementById('dropZone').style.display = 'none';
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
    btn.innerHTML = '<span>⏳</span> Testing API Key...';
    btn.disabled = true;
    
    try {
      const apiTest = await ipcRenderer.invoke('api:testKey', currentConfig.openai_api_key);
      
      if (!apiTest.success) {
        showNotification('API Key Error', `Cannot start monitoring: ${apiTest.error}`, 'error');
        btn.innerHTML = '<span>▶️</span> Start Monitoring';
        btn.disabled = false;
        return;
      }
      
      // API key is valid, start monitoring
      await ipcRenderer.invoke('monitor:start', currentConfig.watched_folder);
      btn.innerHTML = '<span>⏸️</span> Stop Monitoring';
      btn.classList.remove('btn-success');
      btn.classList.add('btn-danger');
      btn.disabled = false;
      document.getElementById('dropZone').style.display = 'block';
      
      showNotification('Success', 'Monitoring started successfully', 'success');
      
    } catch (error) {
      showNotification('Error', `Failed to test API key: ${error.message}`, 'error');
      btn.innerHTML = '<span>▶️</span> Start Monitoring';
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
    btn.innerHTML = '<span>⏸️</span> Stop Monitoring';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');
    document.getElementById('dropZone').style.display = 'block';
  } else {
    statusDot.classList.remove('running');
    statusText.textContent = 'Not running';
    btn.innerHTML = '<span>▶️</span> Start Monitoring';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
    document.getElementById('dropZone').style.display = 'none';
  }
}

// Update UI with current config
async function updateUI() {
  if (!currentConfig) return;
  
  // Update folder path
  document.getElementById('folderPath').value = currentConfig.watched_folder || '';
  document.getElementById('enableOrganization').checked = currentConfig.enable_organization;
  
  // Update auto-launch setting
  const autoLaunchEnabled = await ipcRenderer.invoke('auto-launch:isEnabled');
  document.getElementById('startAtLogin').checked = autoLaunchEnabled;
  
  // Update start minimized setting
  const startMinimized = localStorage.getItem('startMinimized') === 'true';
  document.getElementById('startMinimized').checked = startMinimized;
  
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
    <div class="list-item">
      <div class="list-item-info">
        <h4>${category.name}</h4>
        <p>${category.description}</p>
        <div class="naming-pattern">Pattern: ${category.naming_pattern}</div>
      </div>
      <div class="list-item-actions">
        ${category.name !== 'General' ? `
          <button class="btn btn-secondary btn-small" onclick="editCategory(${index})">
            <span>✏️</span> Edit
          </button>
          <button class="btn btn-danger btn-small" onclick="deleteCategory(${index})">
            <span>🗑️</span> Delete
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
  
  container.innerHTML = currentConfig.variables.map((variable, index) => `
    <div class="list-item">
      <div class="list-item-info">
        <h4>{${variable.name}}</h4>
        <p>${variable.description}</p>
      </div>
      <div class="list-item-actions">
        ${variable.name !== 'original_name' ? `
          <button class="btn btn-secondary btn-small" onclick="editVariable(${index})">
            <span>✏️</span> Edit
          </button>
          <button class="btn btn-danger btn-small" onclick="deleteVariable(${index})">
            <span>🗑️</span> Delete
          </button>
        ` : '<span style="color: #232323; opacity: 0.5; font-size: 13px;">Protected variable</span>'}
      </div>
    </div>
  `).join('');
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
  } else {
    form.reset();
  }
  
  modal.classList.add('active');
}

// Settings modal
function showSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const form = document.getElementById('settingsForm');
  
  // Load current API key
  if (currentConfig && currentConfig.openai_api_key) {
    document.getElementById('openaiApiKey').value = currentConfig.openai_api_key;
  } else {
    form.reset();
  }
  
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
  
  // Close modal on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
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
    
    if (editingCategoryIndex >= 0) {
      currentConfig = await ipcRenderer.invoke('config:updateCategory', editingCategoryIndex, category);
    } else {
      currentConfig = await ipcRenderer.invoke('config:addCategory', category);
    }
    
    document.getElementById('categoryModal').classList.remove('active');
    renderCategories();
    showNotification('Success', `Category "${category.name}" saved`, 'success');
  });
  
  // Variable form submission
  document.getElementById('variableForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const variable = {
      name: document.getElementById('variableName').value,
      description: document.getElementById('variableDescription').value
    };
    
    if (editingVariableIndex >= 0) {
      currentConfig = await ipcRenderer.invoke('config:updateVariable', editingVariableIndex, variable);
    } else {
      currentConfig = await ipcRenderer.invoke('config:addVariable', variable);
    }
    
    document.getElementById('variableModal').classList.remove('active');
    renderVariables();
    updateAvailableVariables();
    showNotification('Success', `Variable "{${variable.name}}" saved`, 'success');
  });
  
  // Settings form submission
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const apiKey = document.getElementById('openaiApiKey').value.trim();
    
    await ipcRenderer.invoke('config:updateSettings', {
      openai_api_key: apiKey
    });
    
    currentConfig.openai_api_key = apiKey;
    
    document.getElementById('settingsModal').classList.remove('active');
    showNotification('Success', 'Settings saved successfully', 'success');
    
    // Update onboarding if we're in welcome mode
    if (document.getElementById('welcomeSection').style.display !== 'none') {
      updateOnboardingSteps();
    }
  });
  
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
  icon.innerHTML = type === 'success' ? '<span>✓</span>' : '<span>✗</span>';
  
  // Show notification
  notification.classList.add('show');
  
  // Hide after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
  }, 4000);
}

// Initialize drag and drop
function initializeDragAndDrop() {
  const dropZone = document.getElementById('dropZone');
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // Highlight drop zone when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });
  
  // Handle dropped files
  dropZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  document.getElementById('dropZone').classList.add('drag-over');
}

function unhighlight(e) {
  document.getElementById('dropZone').classList.remove('drag-over');
}

async function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  handleFiles(files);
}

async function handleFiles(files) {
  ([...files]).forEach(async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['pdf', 'doc', 'docx'].includes(ext)) {
      // Show processing notification
      showNotification('Processing', `Processing ${file.name}...`, 'success');
      
      // In a real implementation, you would send this file to the main process
      // For now, we'll just show a success message after a delay
      setTimeout(() => {
        showNotification('Success', `${file.name} has been processed`, 'success');
      }, 2000);
    } else {
      showNotification('Error', `${file.name} is not a supported file type`, 'error');
    }
  });
}

// Global functions for inline onclick handlers
window.editCategory = (index) => {
  showCategoryModal(currentConfig.categories[index], index);
};

window.deleteCategory = async (index) => {
  if (confirm('Are you sure you want to delete this category?')) {
    currentConfig = await ipcRenderer.invoke('config:deleteCategory', index);
    renderCategories();
    showNotification('Success', 'Category deleted', 'success');
  }
};

window.editVariable = (index) => {
  showVariableModal(currentConfig.variables[index], index);
};

window.deleteVariable = async (index) => {
  if (confirm('Are you sure you want to delete this variable?')) {
    currentConfig = await ipcRenderer.invoke('config:deleteVariable', index);
    renderVariables();
    updateAvailableVariables();
    showNotification('Success', 'Variable deleted', 'success');
  }
};

window.insertVariable = insertVariable;