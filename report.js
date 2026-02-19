const { ipcRenderer } = require('electron');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Zero-pad and format seconds → "HH:MM:SS"
 */
function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Format a date string (ISO) to a human-readable date + time.
 * e.g.  "Mon, Feb 3 2026, 09:15 AM"
 */
function fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Format just the time portion.  "09:15 AM"
 */
function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format just the date portion.  "Mon, Feb 3 2026"
 */
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

// Convert a YYYY-MM-DD date string to a Date at local midnight
function localMidnight(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// Convert a YYYY-MM-DD date string to end-of-day in local time
function localEndOfDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// Today as "YYYY-MM-DD"
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// First day of current month as "YYYY-MM-DD"
function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

// ── Data Loading ──────────────────────────────────────────────────────────────

async function loadTasks() {
  return (await ipcRenderer.invoke('store-get', 'tasks')) || [];
}

// ── Core Filtering Logic ─────────────────────────────────────────────────────

/**
 * For a single task, return only the sessions that overlap [start, end].
 * A session overlaps if it started before end-of-day AND ended after start-of-day.
 * Duration is clipped to the portion that falls within the window.
 */
function filterSessions(task, start, end) {
  const sessions = task.timeSessions || [];

  // Also include a currently-running session if this task is IN_PROGRESS
  let allSessions = [...sessions];
  if (task.status === 'IN_PROGRESS' && task.currentSessionStart) {
    allSessions.push({
      start: task.currentSessionStart,
      end:   new Date().toISOString(),
      duration: Math.floor((Date.now() - new Date(task.currentSessionStart)) / 1000),
      live: true
    });
  }

  const result = [];

  for (const s of allSessions) {
    const sStart = new Date(s.start);
    const sEnd   = new Date(s.end);

    // Session must overlap the window
    if (sEnd < start || sStart > end) continue;

    // Clip to window and recalculate duration
    const clippedStart = sStart < start ? start : sStart;
    const clippedEnd   = sEnd   > end   ? end   : sEnd;
    const clippedSecs  = Math.max(0, Math.floor((clippedEnd - clippedStart) / 1000));

    result.push({
      ...s,
      clippedStart: clippedStart.toISOString(),
      clippedEnd:   clippedEnd.toISOString(),
      clippedDuration: clippedSecs
    });
  }

  // Sort ascending by session start
  result.sort((a, b) => new Date(a.clippedStart) - new Date(b.clippedStart));
  return result;
}

/**
 * Build the report data structure: an array of task entries (sorted by title),
 * each containing only the sessions that fall in-range and the in-range total.
 */
function buildReport(tasks, startStr, endStr) {
  const start = localMidnight(startStr);
  const end   = localEndOfDay(endStr);

  const entries = [];

  for (const task of tasks) {
    const sessions = filterSessions(task, start, end);
    if (sessions.length === 0) continue;

    const totalInRange = sessions.reduce((sum, s) => sum + s.clippedDuration, 0);

    entries.push({
      task,
      sessions,
      totalInRange
    });
  }

  // Sort alphabetically by task title (case-insensitive)
  entries.sort((a, b) => a.task.title.localeCompare(b.task.title, undefined, { sensitivity: 'base' }));

  return entries;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = {
    'TODO':        'badge-todo',
    'IN_PROGRESS': 'badge-in-progress',
    'PAUSED':      'badge-paused',
    'DONE':        'badge-done'
  };
  const cls = map[status] || 'badge-todo';
  const label = status.replace('_', ' ');
  return `<span class="badge ${cls}">${escHtml(label)}</span>`;
}

function renderSummaryBar(entries, startStr, endStr) {
  const totalTasks    = entries.length;
  const totalSessions = entries.reduce((n, e) => n + e.sessions.length, 0);
  const totalTime     = entries.reduce((n, e) => n + e.totalInRange, 0);

  return `
    <div class="summary-bar">
      <div class="summary-stat">
        <span class="val">${fmtDuration(totalTime)}</span>
        <span class="lbl">Total Time</span>
      </div>
      <div class="summary-stat">
        <span class="val">${totalTasks}</span>
        <span class="lbl">Task${totalTasks !== 1 ? 's' : ''}</span>
      </div>
      <div class="summary-stat">
        <span class="val">${totalSessions}</span>
        <span class="lbl">Session${totalSessions !== 1 ? 's' : ''}</span>
      </div>
      <div class="summary-stat" style="margin-left:auto; text-align:right">
        <span class="val" style="font-size:1rem; color:var(--muted)">${fmtDate(localMidnight(startStr).toISOString())} — ${fmtDate(localEndOfDay(endStr).toISOString())}</span>
        <span class="lbl">Date Range</span>
      </div>
    </div>
  `;
}

function renderTaskCard(entry) {
  const { task, sessions, totalInRange } = entry;

  // ── Header ──
  const badges = [
    statusBadge(task.status),
    task.jiraTicket  ? `<span class="badge badge-jira">🎫 ${escHtml(task.jiraTicket)}</span>` : '',
    task.isRecurring ? `<span class="badge badge-recurring">🔄 Recurring</span>` : ''
  ].filter(Boolean).join(' ');

  const tags = (task.tags || []).map(t =>
    `<span style="color:var(--muted);">#${escHtml(t)}</span>`
  ).join(' ');

  const header = `
    <div class="task-card-header">
      <div>
        <div class="task-title-row">
          <span class="task-name">${escHtml(task.title)}</span>
          ${badges}
        </div>
        ${tags ? `<div class="task-meta-row">${tags}</div>` : ''}
        ${task.description ? `<div class="task-meta-row" style="margin-top:.3rem">${escHtml(task.description)}</div>` : ''}
      </div>
      <div class="task-total-time" title="Total time in selected range">
        ${fmtDuration(totalInRange)}
      </div>
    </div>
  `;

  // ── Sessions Table ──
  const rows = sessions.map(s => {
    const startDay  = new Date(s.clippedStart).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    const startTime = fmtTime(s.clippedStart);
    const endTime   = fmtTime(s.clippedEnd);
    const live = s.live ? ' <span style="color:var(--success);font-size:.7rem;font-weight:700;">LIVE</span>' : '';
    return `
      <tr class="session-row">
        <td>${escHtml(startDay)}</td>
        <td>${escHtml(startTime)}</td>
        <td>${escHtml(endTime)}${live}</td>
        <td class="num"><span class="duration-pill">${fmtDuration(s.clippedDuration)}</span></td>
      </tr>
    `;
  }).join('');

  const table = `
    <table class="sessions-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Started</th>
          <th>Ended</th>
          <th class="num">Duration</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // ── Comments ──
  let commentsHtml = '';
  if (task.comments && task.comments.length > 0) {
    const items = task.comments.map(c => `
      <div class="comment-entry">
        <span class="comment-ts">${fmtDateTime(c.createdAt)}</span>
        <span class="comment-body">${escHtml(c.text)}</span>
      </div>
    `).join('');

    commentsHtml = `
      <div class="comments-section">
        <div class="comments-section-title">💬 Comments (${task.comments.length})</div>
        ${items}
      </div>
    `;
  }

  return `
    <div class="task-card">
      ${header}
      ${table}
      ${commentsHtml}
    </div>
  `;
}

function renderReport(entries, startStr, endStr) {
  if (entries.length === 0) {
    return `
      <div class="state-box">
        <div class="icon">🔍</div>
        <p>No tasks or time sessions found in the selected date range.<br>
           Try widening the range or check that time has been tracked.</p>
      </div>
    `;
  }

  const cards = entries.map(renderTaskCard).join('');
  return renderSummaryBar(entries, startStr, endStr) + cards;
}

// ── Event Wiring ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Default the date range to current month
  document.getElementById('startDate').value = firstOfMonthStr();
  document.getElementById('endDate').value   = todayStr();

  document.getElementById('generateBtn').addEventListener('click', generateReport);
  document.getElementById('clearBtn').addEventListener('click', clearReport);
  document.getElementById('printBtn').addEventListener('click', () => {
    // Make sure a report is visible before printing
    if (!lastEntries) {
      alert('Please generate a report first before printing.');
      return;
    }
    window.print();
  });

  // Allow pressing Enter in date fields to trigger generate
  ['startDate', 'endDate'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') generateReport();
    });
  });
});

let lastEntries  = null;
let lastStartStr = null;
let lastEndStr   = null;

async function generateReport() {
  const startStr = document.getElementById('startDate').value;
  const endStr   = document.getElementById('endDate').value;
  const output   = document.getElementById('reportOutput');

  // Validate
  if (!startStr || !endStr) {
    output.innerHTML = `
      <div class="state-box">
        <div class="icon">⚠️</div>
        <p>Please select both a <strong>start</strong> and <strong>end</strong> date.</p>
      </div>`;
    return;
  }

  if (startStr > endStr) {
    output.innerHTML = `
      <div class="state-box">
        <div class="icon">⚠️</div>
        <p>The <strong>start date</strong> cannot be after the <strong>end date</strong>.</p>
      </div>`;
    return;
  }

  // Loading state
  output.innerHTML = `
    <div class="state-box">
      <div class="icon">⏳</div>
      <p>Building report…</p>
    </div>`;

  const tasks   = await loadTasks();
  const entries = buildReport(tasks, startStr, endStr);

  lastEntries  = entries;
  lastStartStr = startStr;
  lastEndStr   = endStr;

  // Update the hidden print subtitle
  document.getElementById('printSubtitle').textContent =
    `${fmtDate(localMidnight(startStr).toISOString())} — ${fmtDate(localEndOfDay(endStr).toISOString())}  |  Generated ${fmtDateTime(new Date().toISOString())}`;

  output.innerHTML = renderReport(entries, startStr, endStr);
}

function clearReport() {
  document.getElementById('startDate').value = firstOfMonthStr();
  document.getElementById('endDate').value   = todayStr();
  document.getElementById('reportOutput').innerHTML = `
    <div class="state-box">
      <div class="icon">📅</div>
      <p>Select a date range above and click <strong>Generate Report</strong> to get started.</p>
    </div>`;
  lastEntries = null;
}
