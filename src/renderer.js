const { ipcRenderer } = require('electron');

let currentConfig = null;
let editingCategoryIndex = -1;
let editingVariableIndex = -1;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupEventListeners();
  setupIPCListeners();
});

// Load configuration
async function loadConfig() {
  currentConfig = await ipcRenderer.invoke('config:load');
  updateUI();
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
  
  // Monitor controls
  document.getElementById('monitorBtn').addEventListener('click', toggleMonitoring);
  
  // Category management
  document.getElementById('addCategoryBtn').addEventListener('click', () => showCategoryModal());
  
  // Variable management
  document.getElementById('addVariableBtn').addEventListener('click', () => showVariableModal());
  
  // Modal controls
  setupModalControls();
}

// Setup IPC listeners
function setupIPCListeners() {
  ipcRenderer.on('monitor:status', (event, status) => {
    updateMonitorStatus(status);
  });
  
  ipcRenderer.on('monitor:error', (event, error) => {
    alert(`Monitoring error: ${error}`);
  });
  
  ipcRenderer.on('file:processed', (event, result) => {
    console.log('File processed:', result);
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
  }
}

// Monitor control
async function toggleMonitoring() {
  const isRunning = await ipcRenderer.invoke('monitor:status');
  const btn = document.getElementById('monitorBtn');
  
  if (isRunning) {
    await ipcRenderer.invoke('monitor:stop');
    btn.textContent = 'Start Monitoring';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
  } else {
    if (!currentConfig.watched_folder) {
      alert('Please select a folder to monitor first');
      return;
    }
    
    await ipcRenderer.invoke('monitor:start', currentConfig.watched_folder);
    btn.textContent = 'Stop Monitoring';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');
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
    btn.textContent = 'Stop Monitoring';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');
  } else {
    statusDot.classList.remove('running');
    statusText.textContent = 'Not running';
    btn.textContent = 'Start Monitoring';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
  }
}

// Update UI with current config
function updateUI() {
  if (!currentConfig) return;
  
  // Update folder path
  document.getElementById('folderPath').value = currentConfig.watched_folder || '';
  document.getElementById('enableOrganization').checked = currentConfig.enable_organization;
  
  // Update categories list
  renderCategories();
  
  // Update variables list
  renderVariables();
}

// Render categories
function renderCategories() {
  const container = document.getElementById('categoriesList');
  
  if (currentConfig.categories.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No categories defined</p></div>';
    return;
  }
  
  container.innerHTML = currentConfig.categories.map((category, index) => `
    <div class="list-item">
      <div class="list-item-info">
        <h4>${category.name}</h4>
        <p>${category.description}</p>
        <p style="font-family: monospace; font-size: 12px; margin-top: 5px;">
          Pattern: ${category.naming_pattern}
        </p>
      </div>
      <div class="list-item-actions">
        ${category.name !== 'General' ? `
          <button class="btn btn-secondary btn-small" onclick="editCategory(${index})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="deleteCategory(${index})">Delete</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Render variables
function renderVariables() {
  const container = document.getElementById('variablesList');
  
  if (currentConfig.variables.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No variables defined</p></div>';
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
          <button class="btn btn-secondary btn-small" onclick="editVariable(${index})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="deleteVariable(${index})">Delete</button>
        ` : ''}
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
  }
};

window.editVariable = (index) => {
  showVariableModal(currentConfig.variables[index], index);
};

window.deleteVariable = async (index) => {
  if (confirm('Are you sure you want to delete this variable?')) {
    currentConfig = await ipcRenderer.invoke('config:deleteVariable', index);
    renderVariables();
  }
};

window.insertVariable = insertVariable;