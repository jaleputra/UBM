// =========================================================
// UBM - Activity Logs & Interactive Calendar Module
// Universal Business Management System
// Compatibility: Supabase PostgreSQL (DATE type) & Local DB
// =========================================================

let calendarCurrentDate = new Date();
let currentEditingLogId = null;
let logCalendarPicFilter = 'ALL';
let logTableSearchQuery = '';
let logTableStatusFilter = 'ALL';
let logTableCategoryFilter = 'ALL';

let isCalendarDragging = false;
let dragStartDateStr = null;
let dragCurrentDateStr = null;

// Initialize Logs Module
document.addEventListener('DOMContentLoaded', () => {
  initLogFormEvents();
  initCalendarEvents();
});

// ==================== FORM LOG KEGIATAN EVENTS ====================
function initLogFormEvents() {
  const form = document.getElementById('form-activity-log');
  if (form) {
    form.addEventListener('submit', handleLogFormSubmit);
  }

  const startInput = document.getElementById('log-start-date');
  const endInput = document.getElementById('log-end-date');

  if (startInput && endInput) {
    startInput.addEventListener('change', updateDurationDisplay);
    endInput.addEventListener('change', updateDurationDisplay);
  }

  // Setup auto numbering / bullets on Enter in notes textarea
  initLogNotesAutoBullets();

  // Set default initial values to today's date
  setDefaultLogDates();
}

// Auto continuation of numbers / bullets when typing in log-notes textarea
function initLogNotesAutoBullets() {
  const textarea = document.getElementById('log-notes');
  if (!textarea) return;

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cursor = textarea.selectionStart;
      const text = textarea.value;
      const lines = text.slice(0, cursor).split('\n');
      const currentLine = lines[lines.length - 1];

      // Check if current line starts with numbered list like "1. ", "1) "
      const numMatch = currentLine.match(/^(\s*)(\d+)[\.\)]\s*(.*)$/);
      if (numMatch) {
        e.preventDefault();
        const indent = numMatch[1];
        const num = parseInt(numMatch[2], 10);
        const content = numMatch[3].trim();

        if (content.length > 0) {
          const insertStr = `\n${indent}${num + 1}. `;
          insertTextAtCursor(textarea, insertStr);
        } else {
          // If empty number item, back out and create a clean newline
          const lineStartPos = cursor - currentLine.length;
          textarea.value = text.slice(0, lineStartPos) + text.slice(cursor);
          textarea.selectionStart = textarea.selectionEnd = lineStartPos;
        }
        return;
      }

      // Check if current line starts with bullet like "- ", "* ", "• "
      const bulletMatch = currentLine.match(/^(\s*)([\-\*\•])\s*(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const bulletChar = bulletMatch[2];
        const content = bulletMatch[3].trim();

        if (content.length > 0) {
          const insertStr = `\n${indent}${bulletChar} `;
          insertTextAtCursor(textarea, insertStr);
        } else {
          // If empty bullet item, back out
          const lineStartPos = cursor - currentLine.length;
          textarea.value = text.slice(0, lineStartPos) + text.slice(cursor);
          textarea.selectionStart = textarea.selectionEnd = lineStartPos;
        }
        return;
      }
    }
  });
}

function insertTextAtCursor(textarea, textToInsert) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.slice(0, start) + textToInsert + text.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
  textarea.dispatchEvent(new Event('input'));
}

// Global shortcut helper buttons to insert point formats
window.insertNoteBullet = function(type) {
  const textarea = document.getElementById('log-notes');
  if (!textarea) return;
  textarea.focus();
  const val = textarea.value;
  const lines = val.split('\n').filter(l => l.trim().length > 0);
  
  if (type === 'num') {
    const nextNum = lines.length + 1;
    if (!val.trim()) {
      textarea.value = '1. ';
    } else {
      textarea.value = val + (val.endsWith('\n') ? '' : '\n') + `${nextNum}. `;
    }
  } else {
    if (!val.trim()) {
      textarea.value = '- ';
    } else {
      textarea.value = val + (val.endsWith('\n') ? '' : '\n') + '- ';
    }
  }
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
};

function setDefaultLogDates(startDateStr, endDateStr) {
  const todayStr = formatYMD(new Date());
  const startInput = document.getElementById('log-start-date');
  const endInput = document.getElementById('log-end-date');

  if (startInput) {
    startInput.value = startDateStr || todayStr;
  }
  if (endInput) {
    endInput.value = endDateStr || startDateStr || todayStr;
  }

  updateDurationDisplay();
}

// Calculate and show live duration in days
function updateDurationDisplay() {
  const startVal = document.getElementById('log-start-date')?.value;
  const endVal = document.getElementById('log-end-date')?.value;
  const displayEl = document.getElementById('log-duration-badge');

  if (!displayEl) return;

  if (!startVal || !endVal) {
    displayEl.textContent = '-';
    return;
  }

  const start = new Date(startVal + 'T00:00:00');
  const end = new Date(endVal + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    displayEl.textContent = '-';
    return;
  }

  const diffTime = end.getTime() - start.getTime();

  if (diffTime < 0) {
    displayEl.textContent = 'Tanggal selesai mendahului tanggal mulai!';
    displayEl.style.color = 'var(--danger)';
    return;
  }

  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  displayEl.style.color = '#0369a1';
  displayEl.textContent = `${diffDays} Hari`;
}

function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr) return 0;
  const sStr = startDateStr.slice(0, 10);
  const eStr = (endDateStr || startDateStr).slice(0, 10);
  const s = new Date(sStr + 'T00:00:00');
  const e = new Date(eStr + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 1;
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ==================== CALENDAR NAVIGATION & LOGIC ====================
function initCalendarEvents() {
  const prevBtn = document.getElementById('cal-btn-prev');
  const nextBtn = document.getElementById('cal-btn-next');
  const todayBtn = document.getElementById('cal-btn-today');
  const picFilter = document.getElementById('cal-filter-pic');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      calendarCurrentDate = new Date();
      renderCalendar();
    });
  }

  if (picFilter) {
    picFilter.addEventListener('change', (e) => {
      logCalendarPicFilter = e.target.value;
      renderCalendar();
    });
  }

  initCalendarDragListeners();
}

function initCalendarDragListeners() {
  const gridEl = document.getElementById('ubm-calendar-grid');
  if (!gridEl) return;

  // Mouse Down: Start range drag
  gridEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    if (e.target.closest('.cal-event-pill')) return; // Ignore event pill clicks

    const cell = e.target.closest('.calendar-cell');
    if (!cell) return;

    const dateStr = cell.getAttribute('data-date');
    if (!dateStr) return;

    e.preventDefault(); // Prevent text selection
    isCalendarDragging = true;
    dragStartDateStr = dateStr;
    dragCurrentDateStr = dateStr;
    highlightCalendarDragRange(dragStartDateStr, dragCurrentDateStr);
  });

  // Mouse Over: Update selection range during drag
  gridEl.addEventListener('mouseover', (e) => {
    if (!isCalendarDragging) return;

    const cell = e.target.closest('.calendar-cell');
    if (!cell) return;

    const dateStr = cell.getAttribute('data-date');
    if (!dateStr || dateStr === dragCurrentDateStr) return;

    dragCurrentDateStr = dateStr;
    highlightCalendarDragRange(dragStartDateStr, dragCurrentDateStr);
  });

  // Mouse Up anywhere: End drag selection and open popup modal with chosen date range
  document.addEventListener('mouseup', (e) => {
    if (!isCalendarDragging) return;
    isCalendarDragging = false;

    const start = dragStartDateStr;
    const end = dragCurrentDateStr || dragStartDateStr;

    clearCalendarDragHighlight();

    if (start && end) {
      openLogFormModalWithRange(start, end);
    }

    dragStartDateStr = null;
    dragCurrentDateStr = null;
  });
}

function highlightCalendarDragRange(dateA, dateB) {
  if (!dateA || !dateB) return;
  const start = dateA < dateB ? dateA : dateB;
  const end = dateA < dateB ? dateB : dateA;

  const cells = document.querySelectorAll('#ubm-calendar-grid .calendar-cell');
  cells.forEach(cell => {
    const cellDate = cell.getAttribute('data-date');
    if (cellDate && cellDate >= start && cellDate <= end) {
      cell.classList.add('is-drag-selected');
    } else {
      cell.classList.remove('is-drag-selected');
    }
  });
}

function clearCalendarDragHighlight() {
  const cells = document.querySelectorAll('#ubm-calendar-grid .calendar-cell');
  cells.forEach(cell => cell.classList.remove('is-drag-selected'));
}

// ==================== MAIN RENDER LOGS VIEW ====================
function renderLogsView() {
  renderLogStats();
  renderCalendar();
  renderLogsTable();
  populatePicFilterDropdowns();
}

// Render Summary Stats
function renderLogStats() {
  const logs = state.activity_logs || [];
  
  const totalLogsEl = document.getElementById('stat-total-logs');
  const activeLogsEl = document.getElementById('stat-active-logs');
  const doneLogsEl = document.getElementById('stat-done-logs');
  const totalHoursEl = document.getElementById('stat-total-hours');

  const totalCount = logs.length;
  const inProgressCount = logs.filter(l => (l.status || '').toLowerCase().includes('berjalan')).length;
  const completedCount = logs.filter(l => (l.status || '').toLowerCase().includes('selesai')).length;

  // Calculate total working days accumulated
  let totalDaysAccumulated = 0;
  logs.forEach(l => {
    const s = l.startDate || l.startTime;
    const e = l.endDate || l.endTime || s;
    if (s) {
      totalDaysAccumulated += calculateDaysBetween(s, e);
    }
  });

  if (totalLogsEl) totalLogsEl.textContent = totalCount;
  if (activeLogsEl) activeLogsEl.textContent = inProgressCount;
  if (doneLogsEl) doneLogsEl.textContent = completedCount;
  if (totalHoursEl) totalHoursEl.textContent = `${totalDaysAccumulated} Hari`;
}

// Render Calendar Grid
function renderCalendar() {
  const gridEl = document.getElementById('ubm-calendar-grid');
  const titleEl = document.getElementById('calendar-month-title');
  if (!gridEl) return;

  const logs = state.activity_logs || [];
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  if (titleEl) {
    titleEl.textContent = `${monthNames[month]} ${year}`;
  }

  // First day of current month (0: Sunday, 1: Monday, ...)
  const firstDayObj = new Date(year, month, 1);
  const lastDayObj = new Date(year, month + 1, 0);
  const totalDays = lastDayObj.getDate();

  // Convert so Monday is 0 and Sunday is 6
  let startingDayOfWeek = firstDayObj.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  // Days in previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentYearMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  let html = '';

  // 1. Cells from previous month padding
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const prevDate = prevMonthLastDay - i;
    const prevMonthDateStr = formatYMD(new Date(year, month - 1, prevDate));
    html += `
      <div class="calendar-cell other-month" data-date="${prevMonthDateStr}" title="Klik / drag tanggal ${prevDate} ${monthNames[(month + 11) % 12]}">
        <div class="calendar-cell-header">
          <span class="calendar-date-number">${prevDate}</span>
          <span class="calendar-cell-add-hint"><i data-lucide="plus" style="width: 12px; height: 12px;"></i></span>
        </div>
        <div class="calendar-events-list">
          ${renderDayEventsHtml(prevMonthDateStr, logs)}
        </div>
      </div>
    `;
  }

  // 2. Cells for current month
  for (let date = 1; date <= totalDays; date++) {
    const dateObj = new Date(year, month, date);
    const dayOfWeek = (startingDayOfWeek + date - 1) % 7;
    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // Sat & Sun
    const isToday = isCurrentYearMonth && date === todayDate;
    const dateStr = formatYMD(dateObj);

    html += `
      <div class="calendar-cell ${isToday ? 'is-today' : ''} ${isWeekend ? 'weekend' : ''}" 
           data-date="${dateStr}"
           title="Klik atau drag untuk pilih rentang tanggal ${date} ${monthNames[month]} ${year}">
        <div class="calendar-cell-header">
          <span class="calendar-date-number">${date}</span>
          <span class="calendar-cell-add-hint" title="Tambah kegiatan"><i data-lucide="plus" style="width: 12px; height: 12px;"></i></span>
        </div>
        <div class="calendar-events-list">
          ${renderDayEventsHtml(dateStr, logs)}
        </div>
      </div>
    `;
  }

  // 3. Cells for next month padding to fill complete grid rows (multiple of 7)
  const totalCellsRendered = startingDayOfWeek + totalDays;
  const remainingCells = (7 - (totalCellsRendered % 7)) % 7;
  for (let nextDate = 1; nextDate <= remainingCells; nextDate++) {
    const nextMonthDateStr = formatYMD(new Date(year, month + 1, nextDate));
    html += `
      <div class="calendar-cell other-month" data-date="${nextMonthDateStr}" title="Klik / drag tanggal ${nextDate} ${monthNames[(month + 1) % 12]}">
        <div class="calendar-cell-header">
          <span class="calendar-date-number">${nextDate}</span>
          <span class="calendar-cell-add-hint"><i data-lucide="plus" style="width: 12px; height: 12px;"></i></span>
        </div>
        <div class="calendar-events-list">
          ${renderDayEventsHtml(nextMonthDateStr, logs)}
        </div>
      </div>
    `;
  }

  gridEl.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function formatYMD(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Render event pills for specific date string YYYY-MM-DD
function renderDayEventsHtml(dateStr, allLogs) {
  const filtered = allLogs.filter(log => {
    if (logCalendarPicFilter !== 'ALL' && log.pic !== logCalendarPicFilter) {
      return false;
    }
    const startYMD = (log.startDate || log.startTime || '').slice(0, 10);
    const endYMD = (log.endDate || log.endTime || startYMD).slice(0, 10);

    if (startYMD && endYMD) {
      return dateStr >= startYMD && dateStr <= endYMD;
    } else if (startYMD) {
      return dateStr === startYMD;
    }
    return false;
  });

  if (filtered.length === 0) return '';

  return filtered.map(log => {
    let statusClass = 'status-terjadwal';
    const status = (log.status || '').toLowerCase();
    if (status.includes('selesai')) statusClass = 'status-selesai';
    else if (status.includes('berjalan')) statusClass = 'status-sedang-berjalan';

    const safeTitle = escapeAttr(`${log.task} (${log.pic || 'PIC -'}) [${log.status || ''}]`);

    return `
      <div class="cal-event-pill ${statusClass}" 
           title="${safeTitle}" 
           onmousedown="event.stopPropagation()"
           onclick="event.stopPropagation(); openLogDetailModal('${log.id}')">
        <span><b>${escapeHtml(log.task)}</b> <small style="opacity: 0.85;">(${escapeHtml(log.pic || '-')})</small></span>
      </div>
    `;
  }).join('');
}

// Open Activity Log Form Modal with Date Range (From - To)
function openLogFormModalWithRange(startDateStr, endDateStr) {
  resetLogForm();

  const start = startDateStr < endDateStr ? startDateStr : endDateStr;
  const end = startDateStr < endDateStr ? endDateStr : startDateStr;

  const startInput = document.getElementById('log-start-date');
  const endInput = document.getElementById('log-end-date');

  if (startInput && endInput) {
    startInput.value = start;
    endInput.value = end;
    updateDurationDisplay();
  }

  openModal('modal-activity-log-form');
  setTimeout(() => {
    document.getElementById('log-task')?.focus();
  }, 100);
}

// Open Activity Log Form Modal (Single Date or Default)
function openLogFormModal(targetDateStr) {
  if (targetDateStr) {
    openLogFormModalWithRange(targetDateStr, targetDateStr);
  } else {
    resetLogForm();
    setDefaultLogDates();
    openModal('modal-activity-log-form');
    setTimeout(() => {
      document.getElementById('log-task')?.focus();
    }, 100);
  }
}

// Populate PIC filters in calendar and table
function populatePicFilterDropdowns() {
  const logs = state.activity_logs || [];
  const pics = new Set();

  logs.forEach(l => {
    if (l.pic && l.pic.trim()) pics.add(l.pic.trim());
  });

  const calPicSelect = document.getElementById('cal-filter-pic');
  const datalistPic = document.getElementById('datalist-pic-suggestions');

  if (calPicSelect) {
    const currentVal = calPicSelect.value || 'ALL';
    let options = '<option value="ALL">Semua PIC</option>';
    pics.forEach(p => {
      options += `<option value="${escapeAttr(p)}" ${p === currentVal ? 'selected' : ''}>${escapeHtml(p)}</option>`;
    });
    calPicSelect.innerHTML = options;
  }

  if (datalistPic) {
    let dlHtml = `
      <option value="Reza (Tim Produksi)"></option>
      <option value="Ahmad (Tim QC)"></option>
      <option value="Bambang S., S.T. (Maintenance)"></option>
      <option value="Rizaldi Putra, M.Kom. (Ketua UBM)"></option>
      <option value="Siti Rahma, S.E. (Keuangan)"></option>
      <option value="Tim Mekanikal"></option>
      <option value="Tim Elektrikal & IoT"></option>
    `;
    pics.forEach(p => {
      dlHtml += `<option value="${escapeAttr(p)}"></option>`;
    });
    datalistPic.innerHTML = dlHtml;
  }
}

// ==================== FORM SUBMIT (CREATE / UPDATE) ====================
async function handleLogFormSubmit(e) {
  e.preventDefault();

  const task = document.getElementById('log-task')?.value.trim();
  const pic = document.getElementById('log-pic')?.value.trim();
  const category = document.getElementById('log-category')?.value || 'Produksi';
  const startDate = document.getElementById('log-start-date')?.value;
  const endDate = document.getElementById('log-end-date')?.value;
  const status = document.getElementById('log-status')?.value || 'Sedang Berjalan';
  const notes = document.getElementById('log-notes')?.value.trim();

  if (!task) {
    showToast('Harap masukkan nama task / kegiatan!', 'warning');
    document.getElementById('log-task')?.focus();
    return;
  }

  if (!pic) {
    showToast('Harap tentukan PIC penanggung jawab kegiatan!', 'warning');
    document.getElementById('log-pic')?.focus();
    return;
  }

  if (!startDate || !endDate) {
    showToast('Tanggal pengerjaan dari dan sampai harus diisi!', 'warning');
    return;
  }

  if (endDate < startDate) {
    showToast('Tanggal selesai tidak boleh lebih awal dari tanggal mulai!', 'error');
    return;
  }

  // Exact Supabase & REST API schema compatible payload
  const logPayload = {
    task,
    pic,
    category,
    startDate,
    endDate,
    // Backward compatibility for any existing readers
    startTime: startDate,
    endTime: endDate,
    status,
    notes,
    updatedAt: new Date().toISOString()
  };

  const submitBtn = document.getElementById('btn-submit-log');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Menyimpan...`;
  }

  try {
    if (currentEditingLogId) {
      // UPDATE
      const res = await fetch(`/api/activity_logs/${currentEditingLogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();

      // Update state
      const idx = (state.activity_logs || []).findIndex(l => l.id === currentEditingLogId);
      if (idx !== -1) {
        state.activity_logs[idx] = updated;
      }
      showToast('Kegiatan UBM berhasil diperbarui!', 'success');
    } else {
      // CREATE
      logPayload.createdAt = new Date().toISOString();
      const res = await fetch('/api/activity_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();

      if (!state.activity_logs) state.activity_logs = [];
      state.activity_logs.unshift(created);
      showToast('Kegiatan baru UBM berhasil dicatat!', 'success');
    }

    // Close modal and reset form
    closeModal('modal-activity-log-form');
    resetLogForm();
    renderLogsView();
    updateSidebarBadges();
  } catch (err) {
    console.error('Error saving activity log:', err);
    showToast('Gagal menyimpan kegiatan: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="save"></i> ${currentEditingLogId ? 'Simpan Perubahan' : 'Simpan Kegiatan UBM'}`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

function resetLogForm() {
  currentEditingLogId = null;
  const form = document.getElementById('form-activity-log');
  if (form) form.reset();

  const titleEl = document.getElementById('log-form-title-text');
  const badgeEl = document.getElementById('log-form-mode-badge');
  const submitBtn = document.getElementById('btn-submit-log');

  if (titleEl) titleEl.textContent = 'Form Input Kegiatan UBM';
  if (badgeEl) {
    badgeEl.textContent = 'Pencatatan Baru';
    badgeEl.className = 'badge badge-primary';
  }
  if (submitBtn) {
    submitBtn.innerHTML = `<i data-lucide="save"></i> <span>Simpan Kegiatan UBM</span>`;
  }

  setDefaultLogDates();
  if (window.lucide) lucide.createIcons();
}

function editLog(id) {
  const log = (state.activity_logs || []).find(l => l.id === id);
  if (!log) return;

  currentEditingLogId = id;

  document.getElementById('log-task').value = log.task || '';
  document.getElementById('log-pic').value = log.pic || '';
  document.getElementById('log-category').value = log.category || 'Produksi';
  
  const startVal = (log.startDate || log.startTime || '').slice(0, 10);
  const endVal = (log.endDate || log.endTime || startVal).slice(0, 10);
  document.getElementById('log-start-date').value = startVal;
  document.getElementById('log-end-date').value = endVal;
  
  document.getElementById('log-status').value = log.status || 'Sedang Berjalan';
  document.getElementById('log-notes').value = log.notes || '';

  const titleEl = document.getElementById('log-form-title-text');
  const badgeEl = document.getElementById('log-form-mode-badge');
  const submitBtn = document.getElementById('btn-submit-log');

  if (titleEl) titleEl.textContent = `Edit Kegiatan #${log.id}`;
  if (badgeEl) {
    badgeEl.textContent = 'Edit Mode';
    badgeEl.className = 'badge badge-warning';
  }
  if (submitBtn) {
    submitBtn.innerHTML = `<i data-lucide="check"></i> <span>Simpan Perubahan</span>`;
  }

  updateDurationDisplay();

  openModal('modal-activity-log-form');
  setTimeout(() => {
    document.getElementById('log-task')?.focus();
  }, 100);

  if (window.lucide) lucide.createIcons();
}

async function deleteLog(id) {
  if (!confirm(`Apakah Anda yakin ingin menghapus data kegiatan #${id}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/activity_logs/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    state.activity_logs = (state.activity_logs || []).filter(l => l.id !== id);
    showToast(`Kegiatan #${id} berhasil dihapus`, 'success');

    if (currentEditingLogId === id) {
      resetLogForm();
    }

    renderLogsView();
    updateSidebarBadges();
  } catch (err) {
    console.error('Error deleting activity log:', err);
    showToast('Gagal menghapus kegiatan: ' + err.message, 'error');
  }
}

// ==================== TABLE RIWAYAT LOG KEGIATAN ====================
function renderLogsTable() {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;

  const logs = state.activity_logs || [];

  // Filter logs
  const filtered = logs.filter(log => {
    // Search
    if (logTableSearchQuery) {
      const q = logTableSearchQuery.toLowerCase();
      const match = (log.task || '').toLowerCase().includes(q) ||
                    (log.pic || '').toLowerCase().includes(q) ||
                    (log.notes || '').toLowerCase().includes(q) ||
                    (log.id || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    // Status
    if (logTableStatusFilter !== 'ALL' && log.status !== logTableStatusFilter) {
      return false;
    }
    // Category
    if (logTableCategoryFilter !== 'ALL' && log.category !== logTableCategoryFilter) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <i data-lucide="clipboard-x" style="width: 40px; height: 40px; stroke-width: 1.5; margin-bottom: 8px; color: #cbd5e1;"></i>
          <p style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">Tidak ada catatan kegiatan UBM</p>
          <p style="font-size: 12px; color: var(--text-dim);">Silakan klik tanggal pada kalender untuk mencatat kegiatan baru.</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map((log, index) => {
    const sRaw = (log.startDate || log.startTime || '').slice(0, 10);
    const eRaw = (log.endDate || log.endTime || sRaw).slice(0, 10);

    let dateRangeFormatted = '-';
    let durationFormatted = '';

    if (sRaw) {
      const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' };
      const sDate = new Date(sRaw + 'T00:00:00');
      const eDate = new Date(eRaw + 'T00:00:00');

      if (!isNaN(sDate.getTime())) {
        const sStr = sDate.toLocaleDateString('id-ID', dateOpts);
        const eStr = !isNaN(eDate.getTime()) ? eDate.toLocaleDateString('id-ID', dateOpts) : sStr;

        if (sRaw === eRaw) {
          dateRangeFormatted = `<div style="font-weight: 600; font-size: 12.5px; color: var(--text-main);">${sStr}</div>`;
        } else {
          dateRangeFormatted = `
            <div style="font-weight: 600; font-size: 12px; color: var(--text-main);">${sStr}</div>
            <div style="font-size: 11px; color: var(--text-muted);">s/d ${eStr}</div>
          `;
        }

        const days = calculateDaysBetween(sRaw, eRaw);
        durationFormatted = `<span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 10.5px; margin-top: 3px; display: inline-block;">⏱ ${days} Hari</span>`;
      }
    }

    // Status Badge
    let statusBadge = '<span class="log-status-badge terjadwal"><i data-lucide="calendar" style="width: 12px; height: 12px;"></i> Terjadwal</span>';
    const st = (log.status || '').toLowerCase();
    if (st.includes('selesai')) {
      statusBadge = '<span class="log-status-badge selesai"><i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Selesai</span>';
    } else if (st.includes('berjalan')) {
      statusBadge = '<span class="log-status-badge sedang-berjalan"><i data-lucide="play-circle" style="width: 12px; height: 12px;"></i> Sedang Berjalan</span>';
    }

    // Category Badge
    const categoryBadge = log.category ? `<span class="badge badge-info" style="font-size: 10px; margin-left: 6px;">${escapeHtml(log.category)}</span>` : '';

    return `
      <tr class="clickable-log-row" onclick="openLogDetailModal('${log.id}')" title="Klik baris untuk melihat detail kegiatan">
        <td style="font-weight: 600; color: var(--text-muted); font-size: 11px; width: 40px; text-align: center;">${index + 1}</td>
        <td style="width: 260px;">
          <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${escapeHtml(log.task)}</div>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 4px;">
            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);">${escapeHtml(log.id)}</span>
            ${categoryBadge}
          </div>
        </td>
        <td style="width: 150px;">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 500; color: var(--text-body);">
            <i data-lucide="user" style="width: 14px; height: 14px; color: var(--primary-accent); flex-shrink: 0;"></i>
            <span>${escapeHtml(log.pic || '-')}</span>
          </div>
        </td>
        <td style="width: 200px;">
          ${dateRangeFormatted}
          ${durationFormatted}
        </td>
        <td style="width: 140px; text-align: center;">
          ${statusBadge}
        </td>
        <td style="max-width: 260px; color: var(--text-body); font-size: 12px;">
          <div style="max-height: 48px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${escapeAttr(log.notes || '-')}">
            ${escapeHtml(log.notes || '-')}
          </div>
        </td>
        <td style="width: 85px; text-align: right;" onclick="event.stopPropagation()">
          <div class="table-actions" style="justify-content: flex-end;">
            <button class="btn-icon" title="Edit Kegiatan" onclick="event.stopPropagation(); editLog('${log.id}')">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn-icon text-danger" title="Hapus Kegiatan" onclick="event.stopPropagation(); deleteLog('${log.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function onLogTableSearch(query) {
  logTableSearchQuery = query;
  renderLogsTable();
}

function onLogTableStatusChange(val) {
  logTableStatusFilter = val;
  renderLogsTable();
}

function onLogTableCategoryChange(val) {
  logTableCategoryFilter = val;
  renderLogsTable();
}

// Quick action from header button
function focusLogForm() {
  openLogFormModal();
}

// ==================== DETAIL MODAL POPUP ====================
function openLogDetailModal(id) {
  const log = (state.activity_logs || []).find(l => l.id === id);
  if (!log) return;

  const contentEl = document.getElementById('log-detail-modal-body');
  if (!contentEl) return;

  const sRaw = (log.startDate || log.startTime || '').slice(0, 10);
  const eRaw = (log.endDate || log.endTime || sRaw).slice(0, 10);

  let dateInfoHtml = '-';
  let daysCount = 1;

  if (sRaw) {
    const dateOpts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const sDate = new Date(sRaw + 'T00:00:00');
    const eDate = new Date(eRaw + 'T00:00:00');
    const sFormatted = !isNaN(sDate.getTime()) ? sDate.toLocaleDateString('id-ID', dateOpts) : sRaw;
    const eFormatted = !isNaN(eDate.getTime()) ? eDate.toLocaleDateString('id-ID', dateOpts) : eRaw;
    daysCount = calculateDaysBetween(sRaw, eRaw);

    dateInfoHtml = `
      <div><b style="color: var(--text-muted);">Mulai:</b> ${sFormatted}</div>
      <div><b style="color: var(--text-muted);">Selesai:</b> ${eFormatted}</div>
      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color); font-weight: 600; color: #0284c7;">
        Total Durasi Pengerjaan: ${daysCount} Hari
      </div>
    `;
  }

  contentEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
          <div>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);">${escapeHtml(log.id)}</span>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-top: 4px;">${escapeHtml(log.task)}</h3>
          </div>
          <span class="badge badge-info">${escapeHtml(log.category || 'Operasional')}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm);">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Penanggung Jawab (PIC)</div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 4px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="user-check" style="width: 14px; height: 14px; color: var(--primary-accent);"></i>
            ${escapeHtml(log.pic || '-')}
          </div>
        </div>

        <div style="border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm);">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Status Pengerjaan</div>
          <div style="margin-top: 4px;">
            <span class="badge ${log.status === 'Selesai' ? 'badge-success' : (log.status === 'Sedang Berjalan' ? 'badge-info' : 'badge-warning')}">
              ${escapeHtml(log.status || '-')}
            </span>
          </div>
        </div>
      </div>

      <div style="border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-sm); background: #ffffff;">
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Jadwal Tanggal Pengerjaan</div>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
          ${dateInfoHtml}
        </div>
      </div>

      <div style="border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-sm); background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Keterangan & Rincian Kegiatan</div>
          <span style="font-size: 11px; color: var(--text-dim); display: flex; align-items: center; gap: 4px;">
            <i data-lucide="list-checks" style="width: 12px; height: 12px; color: var(--primary-accent);"></i>
            <span>Poin Rincian</span>
          </span>
        </div>
        ${formatLogNotesHtml(log.notes)}
      </div>
    </div>
  `;

  const editBtn = document.getElementById('btn-modal-edit-log');
  if (editBtn) {
    editBtn.onclick = () => {
      closeModal('modal-log-detail');
      editLog(id);
    };
  }

  openModal('modal-log-detail');
  if (window.lucide) lucide.createIcons();
}

// Format raw notes into neat pointer/numbered structured points
function formatLogNotesHtml(rawNotes) {
  if (!rawNotes || !rawNotes.trim()) {
    return `
      <div class="log-notes-empty">
        <i data-lucide="info" style="width: 14px; height: 14px; color: var(--text-dim); flex-shrink: 0;"></i>
        <span>Tidak ada keterangan atau rincian tambahan untuk kegiatan ini.</span>
      </div>
    `;
  }

  // Split lines while preserving non-empty entries
  const rawLines = rawNotes.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) {
    return `
      <div class="log-notes-empty">
        <i data-lucide="info" style="width: 14px; height: 14px; color: var(--text-dim); flex-shrink: 0;"></i>
        <span>Tidak ada keterangan atau rincian tambahan untuk kegiatan ini.</span>
      </div>
    `;
  }

  let html = '<div class="log-notes-list">';
  let autoIndex = 1;

  rawLines.forEach((line) => {
    // Regex for explicit numbered list (e.g. "1.", "1)", "(1)", "1 -")
    const numRegex = /^(\d+)[\.\)\:\-]\s*(.*)$/;
    // Regex for bullet list (e.g. "-", "*", "•", "–")
    const bulletRegex = /^[\-\*\•\–\—\>]\s*(.*)$/;

    const numMatch = line.match(numRegex);
    const bulletMatch = line.match(bulletRegex);

    if (numMatch) {
      const explicitNum = numMatch[1];
      const text = numMatch[2].trim() || '-';
      html += `
        <div class="log-notes-item">
          <div class="log-notes-pointer num-pointer">${escapeHtml(explicitNum)}</div>
          <div class="log-notes-content">${escapeHtml(text)}</div>
        </div>
      `;
      autoIndex = parseInt(explicitNum, 10) + 1;
    } else if (bulletMatch) {
      const text = bulletMatch[1].trim() || '-';
      html += `
        <div class="log-notes-item">
          <div class="log-notes-pointer dot-pointer">
            <span class="dot-inner"></span>
          </div>
          <div class="log-notes-content">${escapeHtml(text)}</div>
        </div>
      `;
    } else {
      // Plain text line: automatically format with numbered pointer badge
      html += `
        <div class="log-notes-item">
          <div class="log-notes-pointer num-pointer">${autoIndex}</div>
          <div class="log-notes-content">${escapeHtml(line)}</div>
        </div>
      `;
      autoIndex++;
    }
  });

  html += '</div>';
  return html;
}
