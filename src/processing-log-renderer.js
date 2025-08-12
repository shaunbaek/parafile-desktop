const { ipcRenderer } = require('electron');

let processingLogs = [];
let currentConfig = null;
let editingLogId = null;

// Initialize the log viewer
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadProcessingLog();
  setupEventListeners();
});

// Load configuration
async function loadConfig() {
  currentConfig = await ipcRenderer.invoke('config:load');
}

// Load processing log
async function loadProcessingLog() {
  try {
    processingLogs = await ipcRenderer.invoke('log:load');
    renderLogTable();
  } catch (error) {
    console.error('Error loading processing log:', error);
    showNotification('Error', 'Failed to load processing log', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Refresh button
  document.getElementById('refreshLogBtn').addEventListener('click', () => {
    loadProcessingLog();
  });
  
  // Clear log button
  document.getElementById('clearLogBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear the entire processing log? This cannot be undone.')) {
      try {
        await ipcRenderer.invoke('log:clear');
        processingLogs = [];
        renderLogTable();
        showNotification('Success', 'Processing log cleared', 'success');
      } catch (error) {
        showNotification('Error', 'Failed to clear log', 'error');
      }
    }
  });
  
  // Modal controls
  setupModalControls();
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
  
  // Edit button
  document.getElementById('editBtn').addEventListener('click', () => {
    const log = processingLogs.find(l => l.id == editingLogId);
    if (log) {
      showEditMode(log);
    }
  });
  
  // Cancel edit button
  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    const log = processingLogs.find(l => l.id == editingLogId);
    if (log) {
      showViewMode(log);
    }
  });
  
  // Save corrections button
  document.getElementById('saveCorrectionsBtn').addEventListener('click', async () => {
    const log = processingLogs.find(l => l.id == editingLogId);
    if (!log) return;
    
    const newName = document.getElementById('editParafileName').value.trim();
    const nameFeedback = document.getElementById('editNameFeedback').value.trim();
    const newCategory = document.getElementById('editCategory').value;
    const categoryFeedback = document.getElementById('editCategoryFeedback').value.trim();
    
    // Check if any changes were made
    const nameChanged = newName && newName !== log.parafileName;
    const categoryChanged = newCategory && newCategory !== log.category;
    
    if (!nameChanged && !categoryChanged) {
      showNotification('Info', 'No changes to save', 'info');
      return;
    }
    
    // Validate feedback for changes
    if (nameChanged && !nameFeedback) {
      showNotification('Error', 'Please explain why you changed the name', 'error');
      return;
    }
    
    if (categoryChanged && !categoryFeedback) {
      showNotification('Error', 'Please explain why you changed the category', 'error');
      return;
    }
    
    try {
      const correction = {
        timestamp: new Date().toISOString()
      };
      
      if (nameChanged) {
        correction.newName = newName;
        correction.nameFeedback = nameFeedback;
      }
      
      if (categoryChanged) {
        correction.newCategory = newCategory;
        correction.categoryFeedback = categoryFeedback;
      }
      
      await ipcRenderer.invoke('log:addCorrection', editingLogId, correction);
      
      // Update the log in memory
      log.parafileName = nameChanged ? newName : log.parafileName;
      log.category = categoryChanged ? newCategory : log.category;
      log.corrected = true;
      
      if (!log.corrections) {
        log.corrections = [];
      }
      log.corrections.push(correction);
      
      // Show view mode with updated data
      showViewMode(log);
      
      // Refresh the table
      renderLogTable();
      
      showNotification('Success', 'Corrections saved successfully', 'success');
    } catch (error) {
      showNotification('Error', 'Failed to save corrections', 'error');
    }
  });
}

// Render log table
function renderLogTable() {
  const tbody = document.getElementById('logTableBody');
  
  if (processingLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 40px; text-align: center; color: #666; font-style: italic;">
          No documents processed yet. Start monitoring in the main window to see processing logs here.
        </td>
      </tr>
    `;
    return;
  }
  
  // Sort logs by timestamp (newest first)
  const sortedLogs = [...processingLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  tbody.innerHTML = sortedLogs.map((log, index) => {
    const date = new Date(log.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const statusBadge = log.corrected 
      ? '<span style="background: #448649; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">Corrected</span>'
      : log.success 
        ? '<span style="background: #448649; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">Processed</span>'
        : '<span style="background: #c45050; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">Failed</span>';
    
    const categoryDisplay = log.corrected && log.corrections && log.corrections.length > 0
      ? `<span style="color: #448649; font-weight: 500;">${log.category}</span> <small style="color: #666;">(corrected)</small>`
      : log.category;
    
    return `
      <tr style="cursor: pointer; transition: background-color 0.2s;" 
          onmouseover="this.style.backgroundColor='#f8f9fa'" 
          onmouseout="this.style.backgroundColor=''"
          onclick="showLogDetails('${log.id}')">
        <td style="padding: 12px; border-bottom: 1px solid #eee; max-width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" title="${log.originalName}">
          ${log.originalName}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; max-width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" title="${log.parafileName || 'N/A'}">
          ${log.parafileName || 'N/A'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${categoryDisplay}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; max-width: 300px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" title="${log.reasoning || 'No reasoning available'}">
          ${log.reasoning || 'No reasoning available'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; font-size: 12px;">
          ${renderTokenUsage(log.tokenUsage)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; font-size: 14px;">
          ${formattedDate}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
          ${statusBadge}
        </td>
      </tr>
    `;
  }).join('');
}

// Render token usage for table row
function renderTokenUsage(tokenUsage) {
  if (!tokenUsage || !tokenUsage.totalTokens) {
    return '<span style="color: #999;">-</span>';
  }
  
  const tokens = tokenUsage.totalTokens.toLocaleString();
  const cost = tokenUsage.totalCost ? `$${tokenUsage.totalCost.toFixed(4)}` : '$0.00';
  
  return `
    <div style="text-align: center;">
      <div style="font-weight: bold; font-size: 16px; color: var(--primary);">${cost}</div>
      <div style="color: #666; font-size: 11px;">${tokens} tokens</div>
    </div>
  `;
}

// Show log details modal
function showLogDetails(logId) {
  const log = processingLogs.find(l => l.id == logId);
  if (!log) return;
  
  editingLogId = logId;
  
  // Show view mode initially
  showViewMode(log);
  
  // Open modal
  const modal = document.getElementById('logViewModal');
  modal.classList.add('active');
}

// Show view mode
function showViewMode(log) {
  // Show view mode, hide edit mode
  document.getElementById('viewMode').style.display = 'block';
  document.getElementById('editMode').style.display = 'none';
  document.getElementById('viewModeButtons').style.display = 'flex';
  document.getElementById('editModeButtons').style.display = 'none';
  document.getElementById('logModalTitle').textContent = 'Processing Details';
  
  // Populate view mode data
  document.getElementById('viewOriginalName').textContent = log.originalName;
  document.getElementById('viewParafileName').textContent = log.parafileName || 'N/A';
  document.getElementById('viewCategory').textContent = log.category;
  document.getElementById('viewReasoning').textContent = log.reasoning || 'No reasoning available';
  
  // Status
  const statusHtml = log.success 
    ? '<span style="background: #448649; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px;">Successfully Processed</span>'
    : '<span style="background: #c45050; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px;">Failed</span>';
  document.getElementById('viewStatus').innerHTML = statusHtml;
  
  // Timestamp
  const date = new Date(log.timestamp);
  document.getElementById('viewTimestamp').textContent = 
    date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  
  // Token Usage
  if (log.tokenUsage && log.tokenUsage.totalTokens > 0) {
    document.getElementById('viewTokenUsage').style.display = 'block';
    document.getElementById('totalTokens').textContent = log.tokenUsage.totalTokens.toLocaleString();
    document.getElementById('totalCost').textContent = log.tokenUsage.totalCost ? log.tokenUsage.totalCost.toFixed(4) : '0.0000';
    
    // Show operation breakdown
    if (log.tokenUsage.operations && log.tokenUsage.operations.length > 0) {
      const operationsHtml = log.tokenUsage.operations.map(op => `
        <div style="margin-bottom: 4px;">
          • <strong>${op.operation.replace(/_/g, ' ')}:</strong> 
          <span style="font-weight: bold; color: var(--primary);">$${op.cost.toFixed(4)}</span>
          <span style="color: #666; font-size: 12px;">(${op.tokens.toLocaleString()} tokens)</span>
          <span style="color: #666;">[${op.model}]</span>
        </div>
      `).join('');
      document.getElementById('operationsDetails').innerHTML = operationsHtml;
    } else {
      document.getElementById('operationsDetails').innerHTML = '<div style="color: #666; font-style: italic;">No detailed breakdown available</div>';
    }
  } else {
    document.getElementById('viewTokenUsage').style.display = 'none';
  }
  
  // Show corrections history if any
  if (log.corrections && log.corrections.length > 0) {
    document.getElementById('viewCorrections').style.display = 'block';
    const correctionsList = document.getElementById('correctionsList');
    correctionsList.innerHTML = log.corrections.map(correction => `
      <div style="background: rgba(68, 134, 73, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid var(--primary);">
        ${correction.newName ? `
          <p style="margin-bottom: 8px;">
            <strong>Name changed to:</strong> 
            <span style="font-family: monospace; background: white; padding: 2px 6px; border-radius: 4px;">${correction.newName}</span>
          </p>
          ${correction.nameFeedback ? `<p style="margin-bottom: 8px; color: #666; font-style: italic;">"${correction.nameFeedback}"</p>` : ''}
        ` : ''}
        ${correction.newCategory ? `
          <p style="margin-bottom: 8px;">
            <strong>Category changed to:</strong> 
            <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px;">${correction.newCategory}</span>
          </p>
          ${correction.categoryFeedback ? `<p style="margin-bottom: 8px; color: #666; font-style: italic;">"${correction.categoryFeedback}"</p>` : ''}
        ` : ''}
        <p style="margin: 0; font-size: 12px; color: #999;">
          Corrected on ${new Date(correction.timestamp).toLocaleDateString()}
        </p>
      </div>
    `).join('');
  } else {
    document.getElementById('viewCorrections').style.display = 'none';
  }
}

// Show edit mode
function showEditMode(log) {
  // Show edit mode, hide view mode
  document.getElementById('viewMode').style.display = 'none';
  document.getElementById('editMode').style.display = 'block';
  document.getElementById('viewModeButtons').style.display = 'none';
  document.getElementById('editModeButtons').style.display = 'flex';
  document.getElementById('logModalTitle').textContent = 'Edit Corrections';
  
  // Populate edit mode data
  document.getElementById('editOriginalName').textContent = log.originalName;
  document.getElementById('editParafileName').value = log.parafileName || '';
  
  // Clear feedback fields
  document.getElementById('editNameFeedback').value = '';
  document.getElementById('editCategoryFeedback').value = '';
  
  // Populate category dropdown
  const categorySelect = document.getElementById('editCategory');
  categorySelect.innerHTML = '<option value="">Keep current category</option>';
  
  if (currentConfig && currentConfig.categories) {
    currentConfig.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.name;
      option.textContent = category.name;
      if (category.name === log.category) {
        option.textContent += ' (current)';
      }
      categorySelect.appendChild(option);
    });
  }
}

// Make functions global for onclick
window.showLogDetails = showLogDetails;

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

// Listen for log updates from main process
ipcRenderer.on('log:updated', () => {
  loadProcessingLog();
});