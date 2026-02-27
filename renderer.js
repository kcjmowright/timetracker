const { ipcRenderer } = require('electron');

// Application State
let tasks = [];
let settings = {};
let currentTask = null;
let timerInterval = null;
let currentSessionStart = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadTasks();
  initializeEventListeners();
  renderTasks();
});

// Event Listeners
function initializeEventListeners() {
  // New Task Button
  document.getElementById('newTaskBtn').addEventListener('click', () => {
    if (currentTask && currentTask.status === 'IN_PROGRESS') {
      handleStatusChange(currentTask.id, 'PAUSED');
    }
    openTaskModal();
  });

  // Reports Button
  document.getElementById('reportBtn').addEventListener('click', () => {
    openReport();
  });

  // Settings Button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    openSettingsModal();
  });

  // Save Task Button
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);

  // Save Settings Button
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

  // Test Jira Connection
  document.getElementById('testJiraBtn').addEventListener('click', testJiraConnection);
}

// Data Management
async function loadTasks() {
  tasks = await ipcRenderer.invoke('store-get', 'tasks') || [];
  
  // Restore any active timers
  const activeTask = tasks.find(t => t.status === 'IN_PROGRESS');
  if (activeTask && activeTask.currentSessionStart) {
    currentTask = activeTask;
    currentSessionStart = new Date(activeTask.currentSessionStart);
    startTimer();
    tasks.filter(t => t.id !== activeTask.id).forEach(t => {
      if (t.status === 'IN_PROGRESS') {
        t.status = 'PAUSED';
      }
    });
  }
}

async function saveTasks() {
  await ipcRenderer.invoke('store-set', 'tasks', tasks);
}

async function loadSettings() {
  settings = await ipcRenderer.invoke('store-get', 'settings') || {
    jiraUrl: '',
    jiraEmail: '',
    jiraToken: ''
  };
}

async function saveSettings() {
  settings = {
    jiraUrl: document.getElementById('jiraUrl').value,
    jiraEmail: document.getElementById('jiraEmail').value,
    jiraToken: document.getElementById('jiraToken').value
  };
  
  await ipcRenderer.invoke('store-set', 'settings', settings);
  closeSettingsModal();
  showNotification('Settings saved successfully', 'success');
}

// Task Management
async function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  
  if (!title) {
    showNotification('Task title is required', 'error');
    return;
  }

  const taskData = {
    id: currentTask ? currentTask.id : generateId(),
    title,
    description: document.getElementById('taskDescription').value.trim(),
    jiraTicket: document.getElementById('jiraTicket').value.trim(),
    isRecurring: document.getElementById('isRecurring').checked,
    tags: document.getElementById('taskTags').value
      .split(',')
      .map(t => t.trim())
      .filter(t => t),
    status: currentTask ? currentTask.status : 'TODO',
    createdAt: currentTask ? currentTask.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeSessions: currentTask ? currentTask.timeSessions : [],
    comments: currentTask ? currentTask.comments : [],
    totalTime: currentTask ? currentTask.totalTime : 0
  };

  if (currentTask) {
    const index = tasks.findIndex(t => t.id === currentTask.id);   
    Object.assign(tasks[index], { ...taskData }); // Update existing task while preserving references
  } else {
    tasks.push(taskData);
  }

  await saveTasks();
  renderTasks();
  closeTaskModal();
  
  // If we just edited the current task, update the view
  if (currentTask && currentTask.id === taskData.id) {
    selectTask(taskData);
  }
  
  showNotification(`Task ${currentTask ? 'updated' : 'created'} successfully`, 'success');
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) {
    return;
  }

  tasks = tasks.filter(t => t.id !== taskId);
  await saveTasks();
  
  if (currentTask && currentTask.id === taskId) {
    currentTask = null;
    stopTimer();
    renderTaskDetail();
  }
  
  renderTasks();
  showNotification('Task deleted successfully', 'success');
}

function selectTask(task) {
  currentTask = task;
  renderTasks();
  renderTaskDetail();
}

function selectTaskById(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    selectTask(task);
  }
}

// Task Status Management
async function handleStatusChange(taskId, newStatus) {
  if (!newStatus) return;
  
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  // Show confirmation for certain transitions
  const oldStatus = task.status;
  let confirmMessage = null;
  
  if (newStatus === 'DONE' && oldStatus === 'IN_PROGRESS') {
    confirmMessage = 'Complete this task and stop the timer?';
  } else if (newStatus === 'IN_PROGRESS' && oldStatus === 'DONE') {
    confirmMessage = 'Reopen this completed task?';
  }
  
  if (confirmMessage && !confirm(confirmMessage)) {
    return;
  }
  
  await updateTaskStatus(taskId, newStatus);
}

async function updateTaskStatus(taskId, newStatus) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const oldStatus = task.status;
  task.status = newStatus;
  task.updatedAt = new Date().toISOString();

  // Handle timer based on status changes
  if (newStatus === 'IN_PROGRESS' && oldStatus !== 'IN_PROGRESS') {
    // Stop any other running task
    const otherRunningTask = tasks.find(t => t.id !== taskId && t.status === 'IN_PROGRESS');
    if (otherRunningTask) {
      showNotification(`Paused: ${otherRunningTask.title}`, 'info');
      await updateTaskStatus(otherRunningTask.id, 'PAUSED');
    }
    
    // Start this task
    task.currentSessionStart = new Date().toISOString();
    currentSessionStart = new Date(task.currentSessionStart);
    selectTask(task);
    startTimer();
    showNotification(`Timer started: ${task.title}`, 'success');
  } else if (oldStatus === 'IN_PROGRESS' && newStatus !== 'IN_PROGRESS') {
    // Stop timer and save session
    if (task.currentSessionStart) {
      const sessionEnd = new Date();
      const sessionStart = new Date(task.currentSessionStart);
      const duration = Math.floor((sessionEnd - sessionStart) / 1000);
      
      if (!task.timeSessions) task.timeSessions = [];
      task.timeSessions.push({
        start: task.currentSessionStart,
        end: sessionEnd.toISOString(),
        duration
      });
      
      task.totalTime = (task.totalTime || 0) + duration;
      task.currentSessionStart = null;
      
      showNotification(`Timer stopped: ${formatTime(duration)} recorded`, 'info');
    }
    
    if (currentTask && currentTask.id === taskId) {
      stopTimer();
      currentSessionStart = null;
    }
  }

  await saveTasks();
  renderTasks();
  if (currentTask && currentTask.id === taskId) {
    renderTaskDetail();
  }
}

// Timer Management
function startTimer() {
  if (timerInterval) return;
  
  timerInterval = setInterval(() => {
    updateTimerDisplay();
  }, 1000);
  
  updateTimerDisplay();
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  if (!currentTask || !currentSessionStart) return;
  
  const now = new Date();
  const elapsed = Math.floor((now - currentSessionStart) / 1000);
  const totalElapsed = (currentTask.totalTime || 0) + elapsed;
  
  const timerElement = document.querySelector('.timer-display');
  if (timerElement) {
    timerElement.textContent = formatTime(totalElapsed);
  }
}

// Comments Management
async function addComment() {
  const textarea = document.getElementById('commentInput');
  
  if (!textarea) {
    console.error('Comment textarea not found');
    showNotification('Error: Comment field not found', 'error');
    return;
  }
  
  const text = textarea.value.trim();
  
  if (!text) {
    showNotification('Please enter a comment', 'error');
    return;
  }
  
  if (!currentTask) {
    showNotification('No task selected', 'error');
    return;
  }
  
  const comment = {
    id: generateId(),
    text,
    createdAt: new Date().toISOString()
  };
  
  // Find the task in the tasks array
  const task = tasks.find(t => t.id === currentTask.id);
  if (!task) {
    showNotification('Task not found', 'error');
    return;
  }
  
  // Add comment to the task
  if (!task.comments) task.comments = [];
  task.comments.push(comment);
  
  // Update currentTask reference
  currentTask = task;
  
  await saveTasks();
  renderTaskDetail();
  showNotification('Comment added', 'success');
}

async function deleteComment(commentId) {
  if (!currentTask) {
    showNotification('No task selected', 'error');
    return;
  }
  
  if (!confirm('Delete this comment?')) {
    return;
  }
  
  // Find the task in the tasks array
  const task = tasks.find(t => t.id === currentTask.id);
  if (!task) {
    showNotification('Task not found', 'error');
    return;
  }
  
  // Remove comment from the task
  if (!task.comments) task.comments = [];
  task.comments = task.comments.filter(c => c.id !== commentId);
  
  // Update currentTask reference
  currentTask = task;
  
  await saveTasks();
  renderTaskDetail();
  showNotification('Comment deleted', 'success');
}

// Jira Integration
async function testJiraConnection() {
  const statusEl = document.getElementById('jiraStatus');
  statusEl.textContent = 'Testing...';
  statusEl.style.color = 'var(--text-secondary)';
  
  try {
    const jiraUrl = document.getElementById('jiraUrl').value;
    const jiraEmail = document.getElementById('jiraEmail').value;
    const jiraToken = document.getElementById('jiraToken').value;
    
    if (!jiraUrl || !jiraEmail || !jiraToken) {
      throw new Error('Please fill in all Jira credentials');
    }
    
    const response = await fetch(`${jiraUrl}/rest/api/3/myself`, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${jiraEmail}:${jiraToken}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      statusEl.textContent = '✓ Connection successful';
      statusEl.style.color = 'var(--success-color)';
    } else {
      throw new Error('Authentication failed');
    }
  } catch (error) {
    statusEl.textContent = '✗ ' + error.message;
    statusEl.style.color = 'var(--danger-color)';
  }
}

async function syncWithJira(task) {
  if (!task.jiraTicket || !settings.jiraUrl || !settings.jiraEmail || !settings.jiraToken) {
    showNotification('Jira credentials not configured', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${settings.jiraUrl}/rest/api/3/issue/${task.jiraTicket}`, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${settings.jiraEmail}:${settings.jiraToken}`),
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Jira ticket');
    }
    
    const issue = await response.json();
    
    // Update task with Jira data
    task.title = issue.fields.summary;
    task.description = (issue.fields.description.content || [])
      .map(c => (c.content || []).map(nc => nc.text || '').join('\n')).join('\n\n') || task.description;
    task.updatedAt = new Date().toISOString();
    
    await syncJiraWorkLog(task);
    await saveTasks();
    renderTasks();
    if (currentTask && currentTask.id === task.id) {
      renderTaskDetail();
    }
    
    showNotification('Synced with Jira successfully', 'success');
  } catch (error) {
    console.log('Jira sync error:', error);
    showNotification(`Failed to sync with Jira: ${error.message}`, 'error');
  }
}

async function syncWithJiraById(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    await syncWithJira(task);
  }
}

async function syncJiraWorkLog(task) {
  const authToken = btoa(`${settings.jiraEmail}:${settings.jiraToken}`);
  const response = await fetch(`${settings.jiraUrl}/rest/api/3/issue/${task.jiraTicket}/worklog`, {
    method: "GET",
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json'
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Jira API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  const taskMap = new Map((task.timeSessions || []).map(item => [item.start, item]));
  const logMap = new Map(data.worklogs.map(log => [new Date(log.started), log]));

  (task.timeSessions || []).filter(session => !logMap.has(new Date(session.start))).forEach(async (session) => {
    const sessionStart = new Date(session.start).toISOString().replace('Z', '+0000');
    const duration = secondsToJiraDuration(session.duration);

    try {
      await ipcRenderer.invoke('logTime', {
        domain: settings.jiraUrl, 
        credentials: authToken, 
        issueKey: task.jiraTicket, 
        timeSpent: duration, 
        started: sessionStart
      });
    } catch (error) {
      showNotification(`Failed to sync worklog with Jira: ${error.message}`, 'error');
    }
  });

  data.worklogs.filter(log => !taskMap.has(new Date(log.started))).forEach(log => {
    const sessionStart = new Date(log.started);
    const sessionEnd = new Date(sessionStart.getTime() + log.timeSpentSeconds * 1000);
    task.timeSessions.push({
      start: log.started,
      end: sessionEnd.toISOString(),
      duration: log.timeSpentSeconds
    });    
  });
}

function secondsToJiraDuration(totalSeconds, hoursPerDay = 8, daysPerWeek = 5) {
  const secondsPerMinute = 60;
  const secondsPerHour = 3600;
  const secondsPerDay = secondsPerHour * hoursPerDay;
  const secondsPerWeek = secondsPerDay * daysPerWeek;

  const weeks = Math.floor(totalSeconds / secondsPerWeek);
  const days = Math.floor((totalSeconds % secondsPerWeek) / secondsPerDay);
  const hours = Math.floor((totalSeconds % secondsPerDay) / secondsPerHour);
  const minutes = Math.floor((totalSeconds % secondsPerHour) / secondsPerMinute);

  return [
    weeks   && `${weeks}w`,
    days    && `${days}d`,
    hours   && `${hours}h`,
    minutes && `${minutes}m`,
  ]
    .filter(Boolean)
    .join(" ") || "0m";
}

// Rendering Functions
function renderTasks() {
  const activeList = document.getElementById('activeTasksList');
  const recentList = document.getElementById('recentTasksList');
  
  const activeTasks = tasks.filter(t => t.status !== 'DONE');
  const doneTasks = tasks.filter(t => t.status === 'DONE').slice(0, 10);
  
  activeList.innerHTML = activeTasks.map(task => renderTaskItem(task)).join('');
  recentList.innerHTML = doneTasks.map(task => renderTaskItem(task)).join('');
}

function renderTaskItem(task) {
  const isActive = currentTask && currentTask.id === task.id;
  const isRunning = task.status === 'IN_PROGRESS';
  const timeStr = formatTime(task.totalTime || 0);
  
  return `
    <div class="task-item ${isActive ? 'active' : ''} ${isRunning ? 'running' : ''}" data-task-id="${task.id}" onclick="selectTaskById('${task.id}')">
      <div class="task-item-header">
        <div class="task-item-title">
          ${isRunning ? '<span class="running-indicator">▶</span>' : ''}
          ${escapeHtml(task.title)}
        </div>
        <div class="task-item-status">${task.status.replace('_', ' ')}</div>
      </div>
      <div class="task-item-meta">
        ${task.jiraTicket ? `<span>🎫 ${escapeHtml(task.jiraTicket)}</span>` : ''}
        <span class="task-item-time">⏱️ ${timeStr}</span>
      </div>
    </div>
  `;
}

function renderTaskDetail() {
  const container = document.getElementById('currentTaskView');
  
  if (!currentTask) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>Select a task or create a new one to get started</p>
      </div>
    `;
    return;
  }
  
  const task = currentTask;
  const isRunning = task.status === 'IN_PROGRESS';
  const timeStr = formatTime(task.totalTime || 0);
  
  container.innerHTML = `
    <div class="task-detail">
      <div class="task-detail-header">
        <div class="task-detail-title">
          <h2>${escapeHtml(task.title)}</h2>
          <div class="task-detail-meta">
            <div class="status-transition">
              <span class="status-badge ${task.status.toLowerCase().replace('_', '-')}">${task.status.replace('_', ' ')}</span>
            </div>
            ${task.jiraTicket ? `<span>🎫 ${escapeHtml(task.jiraTicket)}</span>` : ''}
            ${task.isRecurring ? '<span>🔄 Recurring</span>' : ''}
            <span>Created: ${formatDate(task.createdAt)}</span>
          </div>
        </div>
        <div class="task-detail-actions">
          ${task.jiraTicket ? `<button class="btn btn-secondary btn-sm" onclick="syncWithJiraById('${task.id}')">Sync Jira</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="editTask('${task.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')">Delete</button>
        </div>
      </div>

      <div class="task-timer">
        <div class="timer-display">${timeStr}</div>
        <div class="timer-controls">
          ${task.status === 'TODO' || task.status === 'PAUSED' ? 
            `<button class="btn btn-success" onclick="updateTaskStatus('${task.id}', 'IN_PROGRESS')">▶️ Start</button>` : ''}
          ${task.status === 'IN_PROGRESS' ? 
            `<button class="btn btn-warning" onclick="updateTaskStatus('${task.id}', 'PAUSED')">⏸️ Pause</button>` : ''}
          ${task.status !== 'DONE' ? 
            `<button class="btn btn-success" onclick="updateTaskStatus('${task.id}', 'DONE')">✓ Complete</button>` : ''}
          ${task.status === 'DONE' ? 
            `<button class="btn btn-secondary" onclick="updateTaskStatus('${task.id}', 'TODO')">↩️ Reopen</button>` : ''}
        </div>
      </div>

      ${task.description ? `
        <div class="task-section">
          <h3>Description</h3>
          <div class="task-description">${escapeHtml(task.description)}</div>
        </div>
      ` : ''}

      ${task.tags && task.tags.length > 0 ? `
        <div class="task-section">
          <h3>Tags</h3>
          <div class="task-tags">
            ${task.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${task.timeSessions && task.timeSessions.length > 0 ? `
        <div class="task-section">
          <h3>Time Sessions</h3>
          <div class="time-sessions">
            ${task.timeSessions.slice(-5).reverse().map(session => `
              <div class="time-session">
                <div class="time-session-header">
                  <span>${formatDate(session.start)}</span>
                  <span class="time-session-duration">${formatTime(session.duration)}</span>
                </div>
                <div>${formatTime24(session.start)} - ${formatTime24(session.end)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="task-section">
        <h3>Comments (${(task.comments || []).length})</h3>
        ${task.comments && task.comments.length > 0 ? `
          <div class="comments-list">
            ${task.comments.map(comment => `
              <div class="comment">
                <div class="comment-header">
                  <span>${formatDate(comment.createdAt)}</span>
                  <button class="btn btn-sm" onclick="deleteComment('${comment.id}')" style="padding: 0.25rem 0.5rem;">Delete</button>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: var(--text-secondary); margin-bottom: 1rem;">No comments yet</p>'}
        
        <div class="comment-form">
          <textarea id="commentInput" rows="2" placeholder="Add a comment..."></textarea>
          <button class="btn btn-primary" onclick="addComment()">Add Comment</button>
        </div>
      </div>
    </div>
  `;
}

// Modal Management
function openTaskModal(task = null) {
  currentTask = task;
  
  document.getElementById('modalTitle').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('taskTitle').value = task ? task.title : '';
  document.getElementById('taskDescription').value = task ? task.description : '';
  document.getElementById('jiraTicket').value = task ? task.jiraTicket : '';
  document.getElementById('isRecurring').checked = task ? task.isRecurring : false;
  document.getElementById('taskTags').value = task && task.tags ? task.tags.join(', ') : '';
  
  document.getElementById('taskModal').classList.add('active');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('active');
  currentTask = null;
}

function editTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    openTaskModal(task);
  }
}

function openSettingsModal() {
  document.getElementById('jiraUrl').value = settings.jiraUrl || '';
  document.getElementById('jiraEmail').value = settings.jiraEmail || '';
  document.getElementById('jiraToken').value = settings.jiraToken || '';
  document.getElementById('jiraStatus').textContent = '';
  
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

// Report Window
function openReport() {
  ipcRenderer.invoke('open-report');
}

// Utility Functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

function formatTime24(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  // Simple notification - you could enhance this with a toast library
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Could add a toast notification UI here
  const colors = {
    success: 'var(--success-color)',
    error: 'var(--danger-color)',
    info: 'var(--primary-color)'
  };
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Make functions globally available
window.selectTask = selectTask;
window.selectTaskById = selectTaskById;
window.updateTaskStatus = updateTaskStatus;
window.handleStatusChange = handleStatusChange;
window.deleteTask = deleteTask;
window.editTask = editTask;
window.syncWithJira = syncWithJira;
window.syncWithJiraById = syncWithJiraById;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.closeTaskModal = closeTaskModal;
window.closeSettingsModal = closeSettingsModal;
