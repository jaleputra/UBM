// =========================================================
// UBM - Utils & Helper Functions Module
// =========================================================

// Currency Formatter (Rupiah)
function formatRupiah(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

// Toast Notification Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Safe attribute string escaping
function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return escapeAttr(str);
}

// Export data table to CSV
const exportDataToCSV = exportToCSV;
function exportToCSV(resource) {
  const data = state[resource] || [];
  if (data.length === 0) {
    showToast(`Tidak ada data ${resource} untuk diekspor`, 'warning');
    return;
  }

  const sample = data[0];
  const headers = Object.keys(sample).filter(k => typeof sample[k] !== 'object');
  const csvRows = [headers.join(',')];

  data.forEach(item => {
    const values = headers.map(header => {
      const val = item[header] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `UBM_${resource.toUpperCase()}_EXPORT_${new Date().toISOString().split('T')[0]}.csv`);
  a.click();
  showToast(`Data ${resource.toUpperCase()} berhasil diekspor ke CSV!`, 'success');
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

// Print Document Helper (High-Precision Printable View & PDF Export)
function printCurrentDocument() {
  const content = document.getElementById('preview-modal-content') || document.getElementById('preview-modal-body');
  if (!content) {
    window.print();
    return;
  }

  try {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.style.zIndex = '-9999';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Dokumen UBM Politeknik Takumi</title>
        <link rel="stylesheet" href="css/style.css">
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          *, *:before, *:after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #ffffff !important; color: #0f172a !important; padding: 20px; font-family: 'Inter', -apple-system, sans-serif; }
          .no-print { display: none !important; }
          .doc-preview { width: 100% !important; max-width: 100% !important; margin: 0 auto; }
          .doc-table { width: 100%; border-collapse: collapse; margin-top: 14px; margin-bottom: 14px; }
          .doc-table th, .doc-table td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
          .doc-table th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; border: 1px solid #cbd5e1; }
          .badge-success { background: #dcfce7; color: #15803d; border-color: #86efac; }
          .badge-info, .badge-blue { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }
          .badge-purple { background: #f3e8ff; color: #7e22ce; border-color: #d8b4fe; }
          .badge-amber, .badge-warning { background: #fef3c7; color: #b45309; border-color: #fcd34d; }
          .badge-danger { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
          .badge-secondary { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
          .calc-summary { margin-left: auto; width: 280px; margin-top: 10px; }
          .calc-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
          .calc-row.total { font-weight: bold; font-size: 14px; border-top: 2px solid #0f172a; padding-top: 6px; margin-top: 4px; }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    printFrame.contentWindow.focus();
    setTimeout(() => {
      printFrame.contentWindow.print();
      setTimeout(() => {
        printFrame.remove();
      }, 1500);
    }, 250);
  } catch (err) {
    console.warn('Fallback direct print:', err);
    window.print();
  }
}

// Global Escape Key Listener for Modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('form-modal');
    closeModal('preview-modal');
    closeModal('pr-picker-modal');
    closeModal('gantt-detail-modal');
  }
});

/**
 * Generates <option> HTML list for registered users dropdown
 * @param {string} selectedValue Current selected value (name, email, or id)
 * @param {string} placeholder Default empty option label
 * @param {string} roleFilter Optional role filter
 * @returns {string} HTML string of <option> tags
 */
function getUserDropdownOptions(selectedValue = '', placeholder = '-- Pilih Akun Terdaftar --', roleFilter = null) {
  const users = (typeof state !== 'undefined' && Array.isArray(state.users)) ? state.users : [];
  let html = `<option value="">${escapeHtml(placeholder)}</option>`;
  const addedNames = new Set();
  const selectedStr = typeof selectedValue === 'string' ? selectedValue : (selectedValue?.name || '');
  const selectedNorm = selectedStr.trim().toLowerCase();

  users.forEach(u => {
    if (!u || !u.name) return;
    if (roleFilter && u.role !== roleFilter) return;
    const isSelected = Boolean(selectedNorm && (
      u.name.trim().toLowerCase() === selectedNorm || 
      (u.email && u.email.trim().toLowerCase() === selectedNorm)
    ));
    const displayRole = (u.role === 'Lead Project') ? 'Member' : (u.role || 'Member');
    html += `<option value="${escapeAttr(u.name)}" data-role="${escapeAttr(displayRole)}" data-email="${escapeAttr(u.email || '')}" data-phone="${escapeAttr(u.phone || '')}" ${isSelected ? 'selected' : ''}>${escapeHtml(u.name)}</option>`;
    addedNames.add(u.name.trim().toLowerCase());
  });

  // Preserve legacy or custom value if not found in registered users
  if (selectedStr && selectedStr.trim() !== '' && !addedNames.has(selectedNorm)) {
    html += `<option value="${escapeAttr(selectedStr.trim())}" selected>${escapeHtml(selectedStr.trim())}</option>`;
  }

  return html;
}
window.getUserDropdownOptions = getUserDropdownOptions;

