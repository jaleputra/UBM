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

// Universal direct Supabase helper for any resource (Native Table + Cloud Store)
async function directSupabaseFetchResource(resource) {
  try {
    if (resource && resource !== 'settings') {
      const nativeUrl = resource === 'delivery'
        ? `${UBM_SUPABASE_URL}/rest/v1/delivery?id=not.like.__SYS_SYNC_*&select=*&order=created_at.desc`
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
          return nativeRows.map(r => convertObjToCamel(r));
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

window.directSupabaseUpsertNativeRow = directSupabaseUpsertNativeRow;
window.directSupabaseDeleteNativeRow = directSupabaseDeleteNativeRow;
window.directSupabaseFetchResource = directSupabaseFetchResource;
window.directSupabaseSyncResource = directSupabaseSyncResource;

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

