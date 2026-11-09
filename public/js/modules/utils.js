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
// ==================== UNIVERSAL DIRECT SUPABASE CLOUD STORE HELPERS ====================
const UBM_SUPABASE_URL = 'https://aefhdgktpmneqbhaoily.supabase.co';
const UBM_SUPABASE_KEY = 'sb_publishable_i-LZ_maZ8S0VaRM8lEWtXg_Mc0L5bIL';

async function directSupabaseSyncUsers(usersList) {
  if (!Array.isArray(usersList) || usersList.length === 0) return false;
  try {
    // 1. Upsert ke tabel native public.users di Supabase (jika tabel sudah dibuat)
    try {
      const nativeRows = usersList.map(u => ({
        id: u.id,
        name: u.name || 'Pengguna UBM',
        email: (u.email || '').trim().toLowerCase(),
        password: u.password || '',
        role: u.role || 'Member',
        role_id: u.roleId || u.role_id || 'ROLE-MEMBER',
        department: u.department || 'Operations & Management',
        status: u.status || 'Aktif',
        avatar: u.avatar || 'US',
        permissions: u.permissions || {},
        updated_at: new Date().toISOString()
      }));
      await fetch(`${UBM_SUPABASE_URL}/rest/v1/users?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': UBM_SUPABASE_KEY,
          'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(nativeRows)
      });
    } catch (nativeErr) {}

    // 2. Simpan juga ke Cloud Store backup
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery`, {
      method: 'POST',
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: '__SYS_SYNC_users__',
        customer_name: '__UBM_SYS_STORE__',
        items: usersList,
        notes: 'Direct universal synchronization for users',
        updated_at: new Date().toISOString()
      })
    });
    if (res.ok) {
      try { localStorage.setItem('ubm_cached_users', JSON.stringify(usersList)); } catch (e) {}
    }
    return res.ok;
  } catch (err) {
    console.warn('⚠️ [Direct Supabase Sync] Notice:', err.message);
    return false;
  }
}

async function directSupabaseFetchUsers() {
  try {
    // 1. Cek tabel native public.users terlebih dahulu
    const nativeRes = await fetch(`${UBM_SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`, {
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Cache-Control': 'no-cache, no-store'
      }
    });
    if (nativeRes.ok) {
      const nativeData = await nativeRes.json();
      if (Array.isArray(nativeData) && nativeData.length > 0) {
        const mapped = nativeData.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          password: r.password,
          role: r.role,
          roleId: r.role_id,
          department: r.department,
          status: r.status,
          avatar: r.avatar,
          permissions: r.permissions,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
        try { localStorage.setItem('ubm_cached_users', JSON.stringify(mapped)); } catch (e) {}
        return mapped;
      }
    }

    // 2. Fallback Cloud Store
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery?id=eq.__SYS_SYNC_users__&select=items`, {
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Cache-Control': 'no-cache, no-store'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0] && Array.isArray(data[0].items) && data[0].items.length > 0) {
        try { localStorage.setItem('ubm_cached_users', JSON.stringify(data[0].items)); } catch (e) {}
        return data[0].items;
      }
    }
  } catch (err) {
    console.warn('⚠️ [Direct Supabase Fetch] Notice:', err.message);
  }
  try {
    const cached = localStorage.getItem('ubm_cached_users');
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  return null;
}

window.directSupabaseSyncUsers = directSupabaseSyncUsers;
window.directSupabaseFetchUsers = directSupabaseFetchUsers;

async function directSupabaseSyncPartnerships(partnershipsList) {
  if (!Array.isArray(partnershipsList)) return false;
  try {
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery`, {
      method: 'POST',
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: '__SYS_SYNC_partnerships__',
        customer_name: '__UBM_SYS_STORE__',
        items: partnershipsList,
        notes: 'Direct universal synchronization for partnerships (Takumi & Ayumi)',
        updated_at: new Date().toISOString()
      })
    });
    if (res.ok) {
      try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify(partnershipsList)); } catch (e) {}
    }
    return res.ok;
  } catch (err) {
    console.warn('⚠️ [Direct Supabase Sync Partnerships] Notice:', err.message);
    return false;
  }
}

async function directSupabaseFetchPartnerships() {
  try {
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery?id=eq.__SYS_SYNC_partnerships__&select=items`, {
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Cache-Control': 'no-cache, no-store'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const items = (data[0] && Array.isArray(data[0].items)) ? data[0].items : [];
        try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify(items)); } catch (e) {}
        return items;
      }
    }
  } catch (err) {
    console.warn('⚠️ [Direct Supabase Fetch Partnerships] Notice:', err.message);
  }
  return [];
}

window.directSupabaseSyncPartnerships = directSupabaseSyncPartnerships;
window.directSupabaseFetchPartnerships = directSupabaseFetchPartnerships;

async function directSupabaseSyncServiceExpenses(expensesList) {
  if (!Array.isArray(expensesList)) return false;
  try {
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery`, {
      method: 'POST',
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: '__SYS_SYNC_service_expenses__',
        customer_name: '__UBM_SYS_STORE__',
        items: expensesList,
        notes: 'Direct universal synchronization for service expenses (Transport & Uang Makan Jasa)',
        updated_at: new Date().toISOString()
      })
    });
    if (res.ok) {
      try { localStorage.setItem('ubm_cached_service_expenses', JSON.stringify(expensesList)); } catch (e) {}
    }
    return res.ok;
  } catch (err) {
    console.warn('⚠️ [Direct Supabase Sync Service Expenses] Notice:', err.message);
    return false;
  }
}

async function directSupabaseFetchServiceExpenses() {
  try {
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery?id=eq.__SYS_SYNC_service_expenses__&select=items`, {
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Cache-Control': 'no-cache, no-store'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const items = (data[0] && Array.isArray(data[0].items)) ? data[0].items : [];
        try { localStorage.setItem('ubm_cached_service_expenses', JSON.stringify(items)); } catch (e) {}
        return items;
      }
    }
  } catch (err) {
    console.warn('⚠️ [Direct Supabase Fetch Service Expenses] Notice:', err.message);
  }
  return [];
}

window.directSupabaseSyncServiceExpenses = directSupabaseSyncServiceExpenses;
window.directSupabaseFetchServiceExpenses = directSupabaseFetchServiceExpenses;

function toSnakeCaseKey(str) {
  return String(str).replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function toCamelCaseKey(str) {
  return String(str).replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

function convertObjToSnake(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_syncedNative') continue;
    const sk = toSnakeCaseKey(k);
    if (sk.endsWith('_date') && (!v || v === '-')) {
      out[sk] = null;
    } else {
      out[sk] = v;
    }
  }
  return out;
}

function convertObjToCamel(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[toCamelCaseKey(k)] = v;
  }
  return out;
}

async function directSupabaseUpsertNativeRow(resource, item) {
  if (!resource || !item || !item.id) return false;
  try {
    let payload = convertObjToSnake(item);
    for (let attempt = 0; attempt < 15; attempt++) {
      const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/${resource}`, {
        method: 'POST',
        headers: {
          'apikey': UBM_SUPABASE_KEY,
          'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) return true;
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody.message || '';
      if (errBody.code === 'PGRST204' || msg.includes('column') || msg.includes('schema')) {
        const missingCol = (
          msg.match(/'([^']+)' column/) ||
          msg.match(/column "([^"]+)"/) ||
          msg.match(/column '([^']+)'/)
        )?.[1];
        if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
          delete payload[missingCol];
          continue;
        }
      }
      break;
    }
  } catch (err) {
    console.warn(`⚠️ [Direct Native Upsert] ${resource}:`, err.message);
  }
  return false;
}

async function directSupabaseDeleteNativeRow(resource, id) {
  if (!resource || !id) return false;
  try {
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/${resource}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`
      }
    });
    return res.ok;
  } catch (err) {
    console.warn(`⚠️ [Direct Native Delete] ${resource}:`, err.message);
    return false;
  }
}

// ==================== PO DOCUMENT CARRIER HELPERS ====================
function embedPOInNotes(notes, poDoc) {
  const cleanNotes = (notes || '').replace(/<!--UBM_PO_DATA:[\s\S]*?-->/g, '').trim();
  if (!poDoc || (!poDoc.url && !poDoc.name)) return cleanNotes;
  const payload = JSON.stringify({
    name: poDoc.name || 'PO-Pelanggan.pdf',
    url: poDoc.url || '',
    uploadedAt: poDoc.uploadedAt || new Date().toISOString()
  });
  return cleanNotes ? `${cleanNotes}\n<!--UBM_PO_DATA:${payload}-->` : `<!--UBM_PO_DATA:${payload}-->`;
}

function extractPOFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const match = notes.match(/<!--UBM_PO_DATA:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && (parsed.url || parsed.name)) {
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

function cleanDisplayNotes(notes) {
  if (!notes || typeof notes !== 'string') return '';
  return notes
    .replace(/<!--UBM_PO_DATA:[\s\S]*?-->/g, '')
    .replace(/<!--UBM_BOM_META:[\s\S]*?-->/g, '')
    .replace(/<!--UBM_APPROVAL_DATA:[\s\S]*?-->/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

// ==================== ORDER DUAL APPROVAL CARRIER HELPERS ====================
function embedApprovalInNotes(notes, approvalData) {
  const cleanNotes = (notes || '').replace(/<!--UBM_APPROVAL_DATA:[\s\S]*?-->/g, '').trim();
  if (!approvalData || (approvalData.approvalKetuaUbm === undefined && approvalData.approvalWadir1 === undefined)) {
    return cleanNotes;
  }
  const payload = JSON.stringify({
    approvalKetuaUbm: Boolean(approvalData.approvalKetuaUbm),
    approvalKetuaUbmBy: approvalData.approvalKetuaUbmBy || '',
    approvalKetuaUbmDate: approvalData.approvalKetuaUbmDate || '',
    approvalWadir1: Boolean(approvalData.approvalWadir1),
    approvalWadir1By: approvalData.approvalWadir1By || '',
    approvalWadir1Date: approvalData.approvalWadir1Date || ''
  });
  return cleanNotes ? `${cleanNotes}\n<!--UBM_APPROVAL_DATA:${payload}-->` : `<!--UBM_APPROVAL_DATA:${payload}-->`;
}

function extractApprovalFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const match = notes.match(/<!--UBM_APPROVAL_DATA:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

function ensureOrderApprovalData(order) {
  if (!order || typeof order !== 'object') return order;

  // 1. Ekstrak dari notes atau _rawNotes
  const meta = extractApprovalFromNotes(order.notes) || extractApprovalFromNotes(order._rawNotes);
  if (meta) {
    if (order.approvalKetuaUbm === undefined && meta.approvalKetuaUbm !== undefined) {
      order.approvalKetuaUbm = Boolean(meta.approvalKetuaUbm);
    }
    if (!order.approvalKetuaUbmBy && meta.approvalKetuaUbmBy) {
      order.approvalKetuaUbmBy = meta.approvalKetuaUbmBy;
    }
    if (!order.approvalKetuaUbmDate && meta.approvalKetuaUbmDate) {
      order.approvalKetuaUbmDate = meta.approvalKetuaUbmDate;
    }
    if (order.approvalWadir1 === undefined && meta.approvalWadir1 !== undefined) {
      order.approvalWadir1 = Boolean(meta.approvalWadir1);
    }
    if (!order.approvalWadir1By && meta.approvalWadir1By) {
      order.approvalWadir1By = meta.approvalWadir1By;
    }
    if (!order.approvalWadir1Date && meta.approvalWadir1Date) {
      order.approvalWadir1Date = meta.approvalWadir1Date;
    }
  }

  // 2. Kriteria Auto-Approval untuk project sebelumnya yang tombol aksinya sudah aktif
  // Proyek yang sudah memiliki dokumen PO atau sudah dalam status Accepted/Confirmed/In Production/Delivered
  const isLegacyActive = Boolean(
    order.poDocument ||
    order.poFileUrl ||
    order.poFileName ||
    ['Accepted', 'Confirmed', 'In Production', 'Delivered'].includes(order.status)
  );

  if (isLegacyActive) {
    if (order.approvalKetuaUbm !== true) {
      order.approvalKetuaUbm = true;
      order.approvalKetuaUbmBy = order.approvalKetuaUbmBy || 'Ketua UBM (Auto-Approved Proyek Berjalan)';
      order.approvalKetuaUbmDate = order.approvalKetuaUbmDate || order.orderDate || new Date().toISOString();
    }
    if (order.approvalWadir1 !== true) {
      order.approvalWadir1 = true;
      order.approvalWadir1By = order.approvalWadir1By || 'Wakil Direktur I (Auto-Approved Proyek Berjalan)';
      order.approvalWadir1Date = order.approvalWadir1Date || order.orderDate || new Date().toISOString();
    }
    if (order.status === 'Pengajuan' || !order.status) {
      order.status = 'Accepted';
    }
  } else {
    // Order baru: harus persetujuan asli
    order.approvalKetuaUbm = Boolean(order.approvalKetuaUbm);
    order.approvalWadir1 = Boolean(order.approvalWadir1);
  }

  // Benamkan ke notes agar tidak hilang saat dikirim ke backend / disimpan ke Supabase
  if (order.approvalKetuaUbm || order.approvalWadir1) {
    const targetNotes = order._rawNotes || order.notes || '';
    const embedded = embedApprovalInNotes(targetNotes, order);
    order._rawNotes = embedded;
    order.notes = embedded;
  }

  return order;
}

// ==================== QUOTATION DUAL APPROVAL CARRIER HELPERS ====================
function embedQuotationApprovalInNotes(notes, approvalData) {
  const cleanNotes = (notes || '').replace(/<!--UBM_QUO_APPROVAL:[\s\S]*?-->/g, '').trim();
  if (!approvalData || (approvalData.approvalKetuaUbm === undefined && approvalData.approvalDirektur === undefined)) {
    return cleanNotes;
  }
  const payload = JSON.stringify({
    approvalKetuaUbm: Boolean(approvalData.approvalKetuaUbm),
    approvalKetuaUbmBy: approvalData.approvalKetuaUbmBy || '',
    approvalKetuaUbmDate: approvalData.approvalKetuaUbmDate || '',
    approvalDirektur: Boolean(approvalData.approvalDirektur),
    approvalDirekturBy: approvalData.approvalDirekturBy || '',
    approvalDirekturDate: approvalData.approvalDirekturDate || ''
  });
  return cleanNotes ? `${cleanNotes}\n<!--UBM_QUO_APPROVAL:${payload}-->` : `<!--UBM_QUO_APPROVAL:${payload}-->`;
}

function extractQuotationApprovalFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const match = notes.match(/<!--UBM_QUO_APPROVAL:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

function ensureQuotationApprovalData(quo) {
  if (!quo || typeof quo !== 'object') return quo;

  // 1. Ekstrak dari notes atau _rawNotes
  const meta = extractQuotationApprovalFromNotes(quo.notes) || extractQuotationApprovalFromNotes(quo._rawNotes);
  if (meta) {
    if (quo.approvalKetuaUbm === undefined && meta.approvalKetuaUbm !== undefined) {
      quo.approvalKetuaUbm = Boolean(meta.approvalKetuaUbm);
    }
    if (!quo.approvalKetuaUbmBy && meta.approvalKetuaUbmBy) {
      quo.approvalKetuaUbmBy = meta.approvalKetuaUbmBy;
    }
    if (!quo.approvalKetuaUbmDate && meta.approvalKetuaUbmDate) {
      quo.approvalKetuaUbmDate = meta.approvalKetuaUbmDate;
    }
    if (quo.approvalDirektur === undefined && meta.approvalDirektur !== undefined) {
      quo.approvalDirektur = Boolean(meta.approvalDirektur);
    }
    if (!quo.approvalDirekturBy && meta.approvalDirekturBy) {
      quo.approvalDirekturBy = meta.approvalDirekturBy;
    }
    if (!quo.approvalDirekturDate && meta.approvalDirekturDate) {
      quo.approvalDirekturDate = meta.approvalDirekturDate;
    }
  }

  // 2. Kriteria Auto-Approval untuk Quotation legacy/lama yang sudah dikonversi atau status Accepted
  const ordersList = (window.state && Array.isArray(state.orders)) ? state.orders : [];
  const isConverted = Boolean(
    quo.orderId ||
    ordersList.some(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id))) ||
    quo.status === 'Accepted'
  );

  if (isConverted) {
    if (quo.approvalKetuaUbm !== true) {
      quo.approvalKetuaUbm = true;
      quo.approvalKetuaUbmBy = quo.approvalKetuaUbmBy || 'Ketua UBM (Auto-Approved Quotation Berjalan)';
      quo.approvalKetuaUbmDate = quo.approvalKetuaUbmDate || quo.quotationDate || new Date().toISOString();
    }
    if (quo.approvalDirektur !== true) {
      quo.approvalDirektur = true;
      quo.approvalDirekturBy = quo.approvalDirekturBy || 'Direktur (Auto-Approved Quotation Berjalan)';
      quo.approvalDirekturDate = quo.approvalDirekturDate || quo.quotationDate || new Date().toISOString();
    }
    if (quo.status === 'Pengajuan' || !quo.status) {
      quo.status = 'Accepted';
    }
  } else {
    // Quotation baru: harus persetujuan asli
    quo.approvalKetuaUbm = Boolean(quo.approvalKetuaUbm);
    quo.approvalDirektur = Boolean(quo.approvalDirektur);
  }

  // Benamkan ke notes agar tidak hilang saat dikirim ke backend / disimpan ke Supabase
  if (quo.approvalKetuaUbm || quo.approvalDirektur) {
    const targetNotes = quo._rawNotes || quo.notes || '';
    const embedded = embedQuotationApprovalInNotes(targetNotes, quo);
    quo._rawNotes = embedded;
    quo.notes = embedded;
  }

  return quo;
}

// ==================== BOM PROJECT & ORDER LINKAGE CARRIER HELPERS ====================
function embedBOMMetaInNotes(notes, meta) {
  const cleanNotes = (notes || '').replace(/<!--UBM_BOM_META:[\s\S]*?-->/g, '').trim();
  if (!meta || (!meta.orderId && !meta.projectId && !meta.projectName && !meta.customerName)) {
    return cleanNotes;
  }
  const payload = JSON.stringify({
    orderId: meta.orderId || '',
    projectId: meta.projectId || '',
    projectName: meta.projectName || '',
    customerName: meta.customerName || ''
  });
  return cleanNotes ? `${cleanNotes}\n<!--UBM_BOM_META:${payload}-->` : `<!--UBM_BOM_META:${payload}-->`;
}

function extractBOMMetaFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const match = notes.match(/<!--UBM_BOM_META:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

function ensureBOMProjectData(bom, stateOrDb = null) {
  if (!bom || typeof bom !== 'object') return bom;
  const meta = extractBOMMetaFromNotes(bom.notes) || extractBOMMetaFromNotes(bom._rawNotes);
  if (meta) {
    if (!bom.orderId && meta.orderId) bom.orderId = meta.orderId;
    if (!bom.projectId && meta.projectId) bom.projectId = meta.projectId;
    if (!bom.projectName && meta.projectName) bom.projectName = meta.projectName;
    if (!bom.customerName && meta.customerName) bom.customerName = meta.customerName;
  }
  if (bom.orderId && (!bom.projectName || !bom.customerName)) {
    const orders = stateOrDb?.orders || (typeof state !== 'undefined' && state?.orders) || [];
    const ord = Array.isArray(orders) ? orders.find(o => o.id === bom.orderId) : null;
    if (ord) {
      if (!bom.customerName) bom.customerName = ord.customerName || '';
      if (!bom.projectName) bom.projectName = `Project ${ord.id} - ${ord.customerName || ''}`;
    }
  }
  if (bom.notes && typeof bom.notes === 'string' && bom.notes.includes('<!--UBM_BOM_META:')) {
    bom._rawNotes = bom.notes;
    bom.notes = cleanDisplayNotes(bom.notes);
  }
  return bom;
}

function ensureOrderPOData(order) {
  if (!order) return order;
  if (!order.poDocument && !order.poFileUrl) {
    const fromNotes = extractPOFromNotes(order.notes) || extractPOFromNotes(order._rawNotes);
    if (fromNotes) {
      order.poDocument = fromNotes;
      order.poFileUrl = fromNotes.url || '';
      order.poFileName = fromNotes.name || 'PO-Pelanggan.pdf';
    }
  } else if (order.poDocument && !order.poFileUrl) {
    order.poFileUrl = order.poDocument.url || '';
    order.poFileName = order.poDocument.name || 'PO-Pelanggan.pdf';
  } else if (!order.poDocument && order.poFileUrl) {
    order.poDocument = {
      name: order.poFileName || 'PO-Pelanggan.pdf',
      url: order.poFileUrl,
      uploadedAt: order.updatedAt || new Date().toISOString()
    };
  }

  // Preserve raw notes with embedded PO while cleaning display notes
  if (order.notes && typeof order.notes === 'string' && order.notes.includes('<!--UBM_PO_DATA:')) {
    order._rawNotes = order.notes;
    order.notes = cleanDisplayNotes(order.notes);
  }

  return order;
}

// ==================== QUOTATION DUAL APPROVAL CARRIER HELPERS ====================
function embedQuotationApprovalInNotes(notes, approvalData) {
  const cleanNotes = (notes || '').replace(/<!--UBM_QUO_APPROVAL:[\s\S]*?-->/g, '').trim();
  if (!approvalData || (approvalData.approvalKetuaUbm === undefined && approvalData.approvalDirektur === undefined)) {
    return cleanNotes;
  }
  const payload = JSON.stringify({
    approvalKetuaUbm: Boolean(approvalData.approvalKetuaUbm),
    approvalKetuaUbmBy: approvalData.approvalKetuaUbmBy || '',
    approvalKetuaUbmDate: approvalData.approvalKetuaUbmDate || '',
    approvalDirektur: Boolean(approvalData.approvalDirektur),
    approvalDirekturBy: approvalData.approvalDirekturBy || '',
    approvalDirekturDate: approvalData.approvalDirekturDate || ''
  });
  return cleanNotes ? `${cleanNotes}\n<!--UBM_QUO_APPROVAL:${payload}-->` : `<!--UBM_QUO_APPROVAL:${payload}-->`;
}

function extractQuotationApprovalFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const match = notes.match(/<!--UBM_QUO_APPROVAL:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

function ensureQuotationApprovalData(quo) {
  if (!quo || typeof quo !== 'object') return quo;

  // 1. Ekstrak dari notes atau _rawNotes
  const meta = extractQuotationApprovalFromNotes(quo.notes) || extractQuotationApprovalFromNotes(quo._rawNotes);
  if (meta) {
    if (quo.approvalKetuaUbm === undefined && meta.approvalKetuaUbm !== undefined) {
      quo.approvalKetuaUbm = Boolean(meta.approvalKetuaUbm);
    }
    if (!quo.approvalKetuaUbmBy && meta.approvalKetuaUbmBy) {
      quo.approvalKetuaUbmBy = meta.approvalKetuaUbmBy;
    }
    if (!quo.approvalKetuaUbmDate && meta.approvalKetuaUbmDate) {
      quo.approvalKetuaUbmDate = meta.approvalKetuaUbmDate;
    }
    if (quo.approvalDirektur === undefined && meta.approvalDirektur !== undefined) {
      quo.approvalDirektur = Boolean(meta.approvalDirektur);
    }
    if (!quo.approvalDirekturBy && meta.approvalDirekturBy) {
      quo.approvalDirekturBy = meta.approvalDirekturBy;
    }
    if (!quo.approvalDirekturDate && meta.approvalDirekturDate) {
      quo.approvalDirekturDate = meta.approvalDirekturDate;
    }
  }

  // 2. Kriteria Auto-Approval untuk Quotation legacy/lama yang sudah dikonversi atau status Accepted
  const ordersList = (window.state && Array.isArray(state.orders)) ? state.orders : [];
  const isConverted = Boolean(
    quo.orderId ||
    ordersList.some(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id))) ||
    quo.status === 'Accepted'
  );

  if (isConverted) {
    if (quo.approvalKetuaUbm !== true) {
      quo.approvalKetuaUbm = true;
      quo.approvalKetuaUbmBy = quo.approvalKetuaUbmBy || 'Ketua UBM (Auto-Approved Quotation Berjalan)';
      quo.approvalKetuaUbmDate = quo.approvalKetuaUbmDate || quo.quotationDate || new Date().toISOString();
    }
    if (quo.approvalDirektur !== true) {
      quo.approvalDirektur = true;
      quo.approvalDirekturBy = quo.approvalDirekturBy || 'Direktur (Auto-Approved Quotation Berjalan)';
      quo.approvalDirekturDate = quo.approvalDirekturDate || quo.quotationDate || new Date().toISOString();
    }
    if (quo.status === 'Pengajuan' || !quo.status) {
      quo.status = 'Accepted';
    }
  } else {
    // Quotation baru: harus persetujuan asli
    quo.approvalKetuaUbm = Boolean(quo.approvalKetuaUbm);
    quo.approvalDirektur = Boolean(quo.approvalDirektur);
  }

  // Benamkan ke notes agar tidak hilang saat dikirim ke backend / disimpan ke Supabase
  if (quo.approvalKetuaUbm || quo.approvalDirektur) {
    const targetNotes = quo._rawNotes || quo.notes || '';
    const embedded = embedQuotationApprovalInNotes(targetNotes, quo);
    quo._rawNotes = embedded;
    quo.notes = embedded;
  }

  return quo;
}

function ensureProjectData(project) {
  if (!project || typeof project !== 'object') return project;
  if (!project.poDocument && !project.poFileUrl) {
    const fromNotes = extractPOFromNotes(project.notes) || extractPOFromNotes(project._rawNotes);
    if (fromNotes) {
      project.poDocument = fromNotes;
      project.poFileUrl = fromNotes.url || '';
      project.poFileName = fromNotes.name || 'PO-Pelanggan.pdf';
    }
  } else if (project.poDocument && !project.poFileUrl) {
    project.poFileUrl = project.poDocument.url || '';
    project.poFileName = project.poDocument.name || 'PO-Pelanggan.pdf';
  } else if (!project.poDocument && project.poFileUrl) {
    project.poDocument = {
      name: project.poFileName || 'PO-Pelanggan.pdf',
      url: project.poFileUrl,
      uploadedAt: project.updatedAt || new Date().toISOString()
    };
  }

  // Preserve raw notes with embedded PO or comments while cleaning display notes
  if (project.notes && typeof project.notes === 'string' && (project.notes.includes('<!--UBM_PO_DATA:') || project.notes.includes('<!--UBM_BOM_META:') || project.notes.includes('<!--'))) {
    project._rawNotes = project.notes;
    project.notes = cleanDisplayNotes(project.notes);
  }

  return project;
}

// Universal direct Supabase helper for any resource (Native Table + Cloud Store)
async function directSupabaseFetchResource(resource) {
  try {
    if (resource && resource !== 'settings') {
      const nativeUrl = resource === 'delivery'
        ? `${UBM_SUPABASE_URL}/rest/v1/delivery?id=not.like.__SYS_SYNC_%25&select=*&order=created_at.desc`
        : `${UBM_SUPABASE_URL}/rest/v1/${resource}?select=*&order=created_at.desc`;
      const nativeRes = await fetch(nativeUrl, {
        headers: {
          'apikey': UBM_SUPABASE_KEY,
          'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
          'Cache-Control': 'no-cache, no-store'
        }
      });
      if (nativeRes.ok) {
        const nativeRows = await nativeRes.json();
        if (Array.isArray(nativeRows)) {
          // If resource is orders or bom, also fetch cloud sync to merge rich relational data
          let cloudOrdersMap = null;
          let cloudBOMMap = null;
          if (resource === 'orders' || resource === 'bom') {
            try {
              const syncKey = `__SYS_SYNC_${resource}__`;
              const cRes = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery?id=eq.${syncKey}&select=items`, {
                headers: {
                  'apikey': UBM_SUPABASE_KEY,
                  'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
                  'Cache-Control': 'no-cache, no-store'
                }
              });
              if (cRes.ok) {
                const cData = await cRes.json();
                if (Array.isArray(cData) && cData[0] && Array.isArray(cData[0].items)) {
                  if (resource === 'orders') {
                    cloudOrdersMap = new Map(cData[0].items.map(o => [o.id, o]));
                  } else if (resource === 'bom') {
                    cloudBOMMap = new Map(cData[0].items.map(b => [b.id, b]));
                  }
                }
              }
            } catch (e) {}
          }

          return nativeRows.map(r => {
            const item = convertObjToCamel(r);
            if (resource === 'orders') {
              if (cloudOrdersMap && cloudOrdersMap.has(item.id)) {
                const cOrder = cloudOrdersMap.get(item.id);
                if (!item.poDocument && cOrder.poDocument) item.poDocument = cOrder.poDocument;
                if (!item.poFileUrl && cOrder.poFileUrl) item.poFileUrl = cOrder.poFileUrl;
                if (!item.poFileName && cOrder.poFileName) item.poFileName = cOrder.poFileName;
                if (item.approvalKetuaUbm === undefined && cOrder.approvalKetuaUbm !== undefined) {
                  item.approvalKetuaUbm = cOrder.approvalKetuaUbm;
                }
                if (!item.approvalKetuaUbmBy && cOrder.approvalKetuaUbmBy) {
                  item.approvalKetuaUbmBy = cOrder.approvalKetuaUbmBy;
                }
                if (!item.approvalKetuaUbmDate && cOrder.approvalKetuaUbmDate) {
                  item.approvalKetuaUbmDate = cOrder.approvalKetuaUbmDate;
                }
                if (item.approvalWadir1 === undefined && cOrder.approvalWadir1 !== undefined) {
                  item.approvalWadir1 = cOrder.approvalWadir1;
                }
                if (!item.approvalWadir1By && cOrder.approvalWadir1By) {
                  item.approvalWadir1By = cOrder.approvalWadir1By;
                }
                if (!item.approvalWadir1Date && cOrder.approvalWadir1Date) {
                  item.approvalWadir1Date = cOrder.approvalWadir1Date;
                }
              }
              ensureOrderPOData(item);
              ensureOrderApprovalData(item);
            }
            if (resource === 'bom') {
              if (cloudBOMMap && cloudBOMMap.has(item.id)) {
                const cBom = cloudBOMMap.get(item.id);
                if (!item.orderId && cBom.orderId) item.orderId = cBom.orderId;
                if (!item.projectId && cBom.projectId) item.projectId = cBom.projectId;
                if (!item.projectName && cBom.projectName) item.projectName = cBom.projectName;
                if (!item.customerName && cBom.customerName) item.customerName = cBom.customerName;
              }
              ensureBOMProjectData(item);
            }
            if (resource === 'projects') {
              ensureProjectData(item);
            }
            if (resource === 'po') {
              if (item.expectedDate && !item.expectedDelivery) item.expectedDelivery = item.expectedDate;
              if (item.grandTotal !== undefined && item.totalAmount === undefined) item.totalAmount = Number(item.grandTotal);
            }
            return item;
          });
        }
      }
    }

    const syncKey = `__SYS_SYNC_${resource}__`;
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery?id=eq.${syncKey}&select=items`, {
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Cache-Control': 'no-cache, no-store'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data[0] && data[0].items !== undefined) {
          if (resource === 'settings' && Array.isArray(data[0].items)) {
            return data[0].items[0] || {};
          }
          if (resource === 'orders' && Array.isArray(data[0].items)) {
            return data[0].items.map(o => ensureOrderApprovalData(ensureOrderPOData(o)));
          }
          if (resource === 'quotations' && Array.isArray(data[0].items)) {
            return data[0].items.map(q => ensureQuotationApprovalData(q));
          }
          if (resource === 'bom' && Array.isArray(data[0].items)) {
            return data[0].items.map(b => ensureBOMProjectData(b));
          }
          if (resource === 'projects' && Array.isArray(data[0].items)) {
            return data[0].items.map(p => ensureProjectData(p));
          }
          return data[0].items;
        }
        return resource === 'settings' ? null : [];
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Direct Supabase Fetch] ${resource}:`, err.message);
  }
  return null;
}

async function directSupabaseSyncResource(resource, items) {
  if (items === undefined || items === null) return false;
  try {
    const syncKey = `__SYS_SYNC_${resource}__`;
    const itemsPayload = Array.isArray(items) ? items : (typeof items === 'object' ? items : []);
    const res = await fetch(`${UBM_SUPABASE_URL}/rest/v1/delivery`, {
      method: 'POST',
      headers: {
        'apikey': UBM_SUPABASE_KEY,
        'Authorization': `Bearer ${UBM_SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: syncKey,
        customer_name: '__UBM_SYS_STORE__',
        items: itemsPayload,
        notes: `Universal direct synchronization for ${resource}`,
        updated_at: new Date().toISOString()
      })
    });
    return res.ok;
  } catch (err) {
    console.warn(`⚠️ [Direct Supabase Sync] ${resource}:`, err.message);
    return false;
  }
}

window.embedPOInNotes = embedPOInNotes;
window.extractPOFromNotes = extractPOFromNotes;
window.embedBOMMetaInNotes = embedBOMMetaInNotes;
window.extractBOMMetaFromNotes = extractBOMMetaFromNotes;
window.ensureBOMProjectData = ensureBOMProjectData;
window.cleanDisplayNotes = cleanDisplayNotes;
window.ensureOrderPOData = ensureOrderPOData;
window.ensureProjectData = ensureProjectData;
window.embedApprovalInNotes = embedApprovalInNotes;
window.extractApprovalFromNotes = extractApprovalFromNotes;
window.ensureOrderApprovalData = ensureOrderApprovalData;
window.embedQuotationApprovalInNotes = embedQuotationApprovalInNotes;
window.extractQuotationApprovalFromNotes = extractQuotationApprovalFromNotes;
window.ensureQuotationApprovalData = ensureQuotationApprovalData;
window.directSupabaseUpsertNativeRow = directSupabaseUpsertNativeRow;
window.directSupabaseDeleteNativeRow = directSupabaseDeleteNativeRow;
window.directSupabaseFetchResource = directSupabaseFetchResource;
window.directSupabaseSyncResource = directSupabaseSyncResource;

// ==================== QR CODE GENERATOR HELPER ====================
function generateQRCodeSvg(text, cellSize = 2.3, margin = 1) {
  if (!text || typeof text !== 'string') return '';
  try {
    const qrEngine = (typeof qrcode !== 'undefined') ? qrcode : (window.qrcode || null);
    if (typeof qrEngine === 'function') {
      const qr = qrEngine(0, 'M');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag(cellSize, margin);
    }
  } catch (err) {
    console.warn('QR Code generation notice:', err.message);
  }

  // Fallback to URL-based QR code if qrcode library is not ready
  const encoded = encodeURIComponent(text);
  return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encoded}" style="width: 68px; height: 68px; display: block; margin: 0 auto;" alt="QR Code" />`;
}
window.generateQRCodeSvg = generateQRCodeSvg;

function getVerificationBaseUrl() {
  // 1. Cek jika pengguna mengatur Public URL / Domain resmi pada profil instansi
  const compSettings = (typeof getCompanySettings === 'function')
    ? getCompanySettings()
    : (window.state?.settings || {});

  if (compSettings.publicUrl && typeof compSettings.publicUrl === 'string' && compSettings.publicUrl.trim().startsWith('http')) {
    return compSettings.publicUrl.trim().replace(/\/+$/, '');
  }

  // 1b. Cek jika website institusi berawalan http/https
  if (compSettings.website && typeof compSettings.website === 'string' && compSettings.website.trim().startsWith('http')) {
    return compSettings.website.trim().replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') return 'https://unitbisnistakumi.netlify.app';

  // 2. Cek apakah aplikasi saat ini diakses di domain publik (misal: Netlify, Vercel, VPS, takumi.ac.id)
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const isLocal = !hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

  if (!isLocal && origin && origin.startsWith('http')) {
    return origin.replace(/\/+$/, '');
  }

  // 3. Default resmi: Gunakan domain Netlify resmi (https://unitbisnistakumi.netlify.app)
  // agar siapa pun yang memindai QR code dari HP / internet umum dapat mengaksesnya secara instan
  return 'https://unitbisnistakumi.netlify.app';
}
window.getVerificationBaseUrl = getVerificationBaseUrl;

function getSignatureVerificationUrl(name, role, doc, title) {
  const baseUrl = getVerificationBaseUrl();
  const cleanName = (name || '').replace(/\.+$/, '');
  return `${baseUrl}/verifikasi?name=${encodeURIComponent(cleanName)}&role=${encodeURIComponent(role || '')}&doc=${encodeURIComponent(doc || '')}&title=${encodeURIComponent(title || '')}`;
}
window.getSignatureVerificationUrl = getSignatureVerificationUrl;

function getSignaturePdfDownloadUrl(name, role, doc, title) {
  const baseUrl = getVerificationBaseUrl();
  const cleanName = (name || '').replace(/\.+$/, '');
  return `${baseUrl}/api/download-signature-pdf?name=${encodeURIComponent(cleanName)}&role=${encodeURIComponent(role || '')}&doc=${encodeURIComponent(doc || '')}&title=${encodeURIComponent(title || '')}`;
}
window.getSignaturePdfDownloadUrl = getSignaturePdfDownloadUrl;

// ==================== SERVICE (JASA) DETECTION HELPERS ====================
function isServiceOrder(order) {
  if (!order) return false;

  // 1. Cek relasi Quotation terlebih dahulu (Sumber Kebenaran Utama Tipe Penawaran)
  const quoId = order.quotationId || (order.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]);
  if (quoId && window.state && Array.isArray(state.quotations)) {
    const quo = state.quotations.find(q => q.id === quoId);
    if (quo && quo.quotationType) {
      return String(quo.quotationType).toLowerCase() === 'jasa';
    }
  }
  if (order.id && window.state && Array.isArray(state.quotations)) {
    const linkedQuo = state.quotations.find(q => q.orderId === order.id);
    if (linkedQuo && linkedQuo.quotationType) {
      return String(linkedQuo.quotationType).toLowerCase() === 'jasa';
    }
  }

  // 2. Cek properti eksplisit pada order (quotationType / orderType)
  if (order.quotationType) {
    return String(order.quotationType).toLowerCase() === 'jasa';
  }
  if (order.orderType) {
    return String(order.orderType).toLowerCase() === 'jasa';
  }

  // 3. Fallback pada catatan konversi eksplisit (hindari salah deteksi kata 'jasa' dari sub-rincian instalasi produk)
  if (order.notes) {
    const notesLower = order.notes.toLowerCase();
    if (notesLower.includes('surat penawaran harga (produk)') || notesLower.includes('[tipe: produk]')) {
      return false;
    }
    if (notesLower.includes('surat penawaran harga (jasa)') || notesLower.includes('[tipe: jasa]') || notesLower.includes('tipe penawaran: jasa')) {
      return true;
    }
  }

  return false;
}

function isProjectService(p) {
  if (!p) return false;

  // 1. Jika terhubung ke Order Penjualan, ikuti tipe Order/Quotation secara ketat
  if (p.orderId && window.state && Array.isArray(state.orders)) {
    const order = state.orders.find(o => o.id === p.orderId);
    if (order) {
      return isServiceOrder(order);
    }
  }

  // 2. Jika terhubung ke Quotation langsung, ikuti tipe Quotation
  if (p.quotationId && window.state && Array.isArray(state.quotations)) {
    const quo = state.quotations.find(q => q.id === p.quotationId);
    if (quo && quo.quotationType) {
      return String(quo.quotationType).toLowerCase() === 'jasa';
    }
  }

  // 3. Cek properti eksplisit pada project
  if (p.quotationType) {
    return String(p.quotationType).toLowerCase() === 'jasa';
  }
  if (p.projectType) {
    return String(p.projectType).toLowerCase() === 'jasa';
  }
  if (typeof p.isService === 'boolean') {
    return p.isService;
  }

  // 4. Fallback catatan eksplisit
  if (p.notes) {
    const notesLower = p.notes.toLowerCase();
    if (notesLower.includes('surat penawaran harga (produk)') || notesLower.includes('[tipe: produk]')) {
      return false;
    }
    if (notesLower.includes('surat penawaran harga (jasa)') || notesLower.includes('[tipe: jasa]') || notesLower.includes('tipe penawaran: jasa')) {
      return true;
    }
  }

  return false;
}

window.isServiceOrder = isServiceOrder;
window.isProjectService = isProjectService;

