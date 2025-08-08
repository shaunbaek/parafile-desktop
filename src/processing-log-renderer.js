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
  
  // Save correction button
  document.getElementById('saveCorrectionBtn').addEventListener('click', async () => {
    const newCategory = document.getElementById('correctionNewCategory').value;
    const feedback = document.getElementById('correctionFeedback').value;
    
    if (!newCategory) {
      showNotification('Error', 'Please select a correct category', 'error');
      return;
    }
    
    try {
      await ipcRenderer.invoke('log:addCorrection', editingLogId, {
        newCategory: newCategory,
        feedback: feedback
      });
      
      // Close modal
      document.getElementById('logCorrectionModal').classList.remove('active');
      
      // Refresh the log
      await loadProcessingLog();
      
      showNotification('Success', 'Correction saved successfully', 'success');
    } catch (error) {
      showNotification('Error', 'Failed to save correction', 'error');
    }
  });
}

// Render log table
function renderLogTable() {
  const tbody = document.getElementById('logTableBody');
  
  if (processingLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 40px; text-align: center; color: #666; font-style: italic;">
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
          onclick="showCorrectionModal('${log.id}')">
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

// Show correction modal
function showCorrectionModal(logId) {
  const log = processingLogs.find(l => l.id == logId);
  if (!log) return;
  
  editingLogId = logId;
  
  // Populate modal with log data
  document.getElementById('correctionOriginalName').textContent = log.originalName;
  document.getElementById('correctionCurrentCategory').textContent = log.category;
  document.getElementById('correctionReasoning').textContent = log.reasoning || 'No reasoning available';
  
  // Populate category dropdown
  const categorySelect = document.getElementById('correctionNewCategory');
  categorySelect.innerHTML = '<option value="">Select the correct category...</option>';
  
  if (currentConfig && currentConfig.categories) {
    currentConfig.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.name;
      option.textContent = category.name;
      if (category.name === log.category) {
        option.disabled = true;
        option.textContent += ' (current)';
      }
      categorySelect.appendChild(option);
    });
  }
  
  // Clear feedback
  document.getElementById('correctionFeedback').value = '';
  
  // Show modal
  document.getElementById('logCorrectionModal').classList.add('active');
}

// Make showCorrectionModal global for onclick
window.showCorrectionModal = showCorrectionModal;

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