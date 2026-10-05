// =========================================================
// UBM - Authentication Module
// Strict Single-Tenant Corporate Access (admin@ubm.co.id)
// =========================================================

const AUTH_STORAGE_KEY = 'ubm_auth_user';
const ALLOWED_EMAIL = 'admin@ubm.co.id';
const ALLOWED_PASSWORD = 'bisnisdigital365';

/**
 * Retrieve active authenticated user from storage
 */
function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (user && user.email) {
      return user;
    }
  } catch (e) {
    console.warn('Failed parsing auth user from storage:', e);
  }
  return null;
}

/**
 * Returns true if current user is logged in
 */
function isAuthenticated() {
  return !!getAuthUser();
}

/**
 * =========================================================
 * 5 CANONICAL ROLES SYSTEM:
 * 1. Administrator: Akses penuh seluruh sistem
 * 2. Ketua UBM: Akses semua, persetujuan project pada order penjualan, assign lead project
 * 3. Lead Project: Mendaftarkan anggota, membuat timeline, membuat BOM, mengajukan pengadaan barang
 * 4. Keuangan: Akses persetujuan pembelian barang, invoice, keuangan project, BAST & after-sales menu
 * 5. Member: Akses timeline, laporan hasil pekerjaan/task, dan project yang telah di-assign oleh lead project
 * =========================================================
 */

function getNormalizedRole(user) {
  const u = user || getAuthUser();
  if (!u || !u.role) return 'Member';
  const r = (u.role || '').toLowerCase().trim();
  if (r.includes('admin')) return 'Administrator';
  if (r.includes('ketua') || r.includes('wadir')) return 'Ketua UBM';
  if (r.includes('lead')) return 'Lead Project';
  if (r.includes('keuangan') || r.includes('finance')) return 'Keuangan';
  return 'Member';
}

const ROLE_PERMISSIONS = {
  'Administrator': {
    name: 'Administrator',
    allowedViews: ['dashboard', 'logs', 'quotations', 'orders', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'settings'],
    canApproveOrder: true,
    canAssignLead: true,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: true
  },
  'Ketua UBM': {
    name: 'Ketua UBM',
    allowedViews: ['dashboard', 'logs', 'quotations', 'orders', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'settings'],
    canApproveOrder: true,
    canAssignLead: true,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: false
  },
  'Lead Project': {
    name: 'Lead Project',
    allowedViews: ['dashboard', 'project-reports', 'timeline', 'bom', 'bom-form', 'purchasing', 'logs'],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: false,
    canManageInvoices: false,
    canManageFinance: false,
    canManageBAST: false,
    canManageAfterSales: false,
    canManageSettings: false
  },
  'Keuangan': {
    name: 'Keuangan',
    allowedViews: ['dashboard', 'purchasing', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'logs'],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: false,
    canManageTimeline: false,
    canManageBOM: false,
    canSubmitPR: false,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: false
  },
  'Member': {
    name: 'Member',
    allowedViews: ['dashboard', 'project-reports', 'timeline', 'logs'],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: false,
    canManageTimeline: false,
    canManageBOM: false,
    canSubmitPR: false,
    canApprovePurchasing: false,
    canManageInvoices: false,
    canManageFinance: false,
    canManageBAST: false,
    canManageAfterSales: false,
    canManageSettings: false
  }
};

function hasRolePermission(permKey) {
  const user = getAuthUser();
  const roleName = getNormalizedRole(user);
  const perms = ROLE_PERMISSIONS[roleName] || ROLE_PERMISSIONS['Member'];
  return !!perms[permKey];
}

function isViewAllowedForUser(viewName) {
  if (!viewName || viewName === 'dashboard') return true; // Semua role bisa melihat dashboard
  const user = getAuthUser();
  const roleName = getNormalizedRole(user);
  const perms = ROLE_PERMISSIONS[roleName] || ROLE_PERMISSIONS['Member'];
  return (perms.allowedViews || []).includes(viewName);
}

function applyRoleNavigation(user) {
  const roleName = getNormalizedRole(user);
  const perms = ROLE_PERMISSIONS[roleName] || ROLE_PERMISSIONS['Member'];
  const allowed = new Set(perms.allowedViews);

  // Toggle sidebar navigation items
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
  navItems.forEach(btn => {
    const viewName = btn.getAttribute('data-view');
    if (viewName === 'dashboard') {
      btn.style.display = 'flex';
    } else if (allowed.has(viewName)) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  });

  // Hide empty section labels
  const sections = document.querySelectorAll('.sidebar-nav .nav-section-label');
  sections.forEach(sec => {
    let next = sec.nextElementSibling;
    let anyVisible = false;
    while (next && !next.classList.contains('nav-section-label')) {
      if (next.classList.contains('nav-item') && next.style.display !== 'none') {
        anyVisible = true;
        break;
      }
      next = next.nextElementSibling;
    }
    sec.style.display = anyVisible ? 'block' : 'none';
  });

  // Quick create button in topbar
  const quickCreateBtn = document.getElementById('btn-quick-create');
  if (quickCreateBtn) {
    if (roleName === 'Member' || roleName === 'Keuangan') {
      quickCreateBtn.style.display = 'none';
    } else {
      quickCreateBtn.style.display = 'inline-flex';
    }
  }

  // Populate registered accounts into universal assignment datalist
  populateUsersAssignmentDatalist();
}

function populateUsersAssignmentDatalist() {
  let datalist = document.getElementById('users-assignment-datalist');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'users-assignment-datalist';
    document.body.appendChild(datalist);
  }

  const users = (typeof state !== 'undefined' && Array.isArray(state.users)) ? state.users : [];
  datalist.innerHTML = users.map(u => `
    <option value="${escapeAttr(u.name)}">${escapeHtml(u.name)} &bull; ${escapeHtml(u.role)} (${escapeHtml(u.email)})</option>
  `).join('');

  // Attach to lead, member, and PIC inputs
  const leadInput = document.getElementById('pm-lead-name');
  if (leadInput && !leadInput.getAttribute('list')) {
    leadInput.setAttribute('list', 'users-assignment-datalist');
  }

  const picInput = document.getElementById('modal-log-pic');
  if (picInput && !picInput.getAttribute('list')) {
    picInput.setAttribute('list', 'users-assignment-datalist');
  }

  document.querySelectorAll('.pm-member-name').forEach(inp => {
    if (!inp.getAttribute('list')) inp.setAttribute('list', 'users-assignment-datalist');
  });
}

/**
 * Updates UI elements that show user details (name, email, role)
 */
function updateAppUserUI(user) {
  if (!user) return;
  const roleName = getNormalizedRole(user);

  const nameEls = document.querySelectorAll('.user-name');
  nameEls.forEach(el => el.textContent = user.name || 'Pengguna UBM');
  
  const roleEls = document.querySelectorAll('.user-role');
  roleEls.forEach(el => el.textContent = `${roleName} • ${user.email || ALLOWED_EMAIL}`);

  const avatarEls = document.querySelectorAll('.avatar');
  avatarEls.forEach(el => el.textContent = user.avatar || (user.name ? user.name.slice(0, 2).toUpperCase() : 'US'));

  const userPill = document.querySelector('.user-pill');
  if (userPill) userPill.title = `Akun Aktif: ${user.name || 'Pengguna'} (${user.email || ''}) - Role: ${roleName}`;

  applyRoleNavigation(user);
}

/**
 * Evaluates current auth state and toggles visibility between login screen and app layout
 */
function checkAuthAndRender() {
  const authScreen = document.getElementById('ubm-auth-screen');
  const appLayout = document.getElementById('main-app-layout') || document.querySelector('.app-layout');
  const user = getAuthUser();

  if (user) {
    // User is logged in -> show app, hide login screen
    if (authScreen) {
      authScreen.style.display = 'none';
      authScreen.setAttribute('aria-hidden', 'true');
    }
    if (appLayout) {
      appLayout.style.display = 'flex';
      appLayout.classList.remove('hidden-for-auth');
    }
    updateAppUserUI(user);

    // If current view is not allowed for this role, redirect to dashboard
    if (typeof state !== 'undefined' && state.currentView && !isViewAllowedForUser(state.currentView)) {
      if (typeof navigateTo === 'function') {
        navigateTo('dashboard');
      }
    }
    return true;
  } else {
    // User is not logged in -> hide app, show login screen
    if (appLayout) {
      appLayout.style.display = 'none';
      appLayout.classList.add('hidden-for-auth');
    }
    if (authScreen) {
      authScreen.style.display = 'flex';
      authScreen.setAttribute('aria-hidden', 'false');
    }
    // Reset any error alerts
    const errAlert = document.getElementById('auth-error-alert');
    if (errAlert) errAlert.style.display = 'none';

    if (window.lucide) {
      setTimeout(() => lucide.createIcons(), 10);
    }
    return false;
  }
}

/**
 * Form submit handler for login
 */
async function handleAuthLogin(event) {
  if (event) event.preventDefault();
  
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  const errAlert = document.getElementById('auth-error-alert');
  const errMsg = document.getElementById('auth-error-text');
  const submitBtn = document.getElementById('btn-auth-submit');
  const rememberCheckbox = document.getElementById('auth-remember-me');

  const email = (emailInput?.value || '').trim();
  const password = (passInput?.value || '').trim();

  // Reset alert
  if (errAlert) errAlert.style.display = 'none';

  if (!email || !password) {
    if (errAlert) {
      errAlert.style.display = 'flex';
      if (errMsg) errMsg.textContent = 'Harap masukkan email dan password.';
    }
    return;
  }

  // Button loading state
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Masuk ke Sistem';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="auth-spinner"></span>
      <span>Memverifikasi...</span>
    `;
  }

  try {
    let authSuccess = false;
    let authUser = null;

    try {
      // 1. Primary verification via backend API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        authSuccess = true;
        authUser = data.user;
      } else {
        throw new Error(data.error || 'Email atau password salah.');
      }
    } catch (apiErr) {
      // 2. Client-side fallback if network or dev server is restarting
      const localUsers = (typeof state !== 'undefined' && Array.isArray(state.users)) ? state.users : [];
      const matched = localUsers.find(u => (u.email || '').trim().toLowerCase() === email.toLowerCase() && u.password === password && u.status !== 'Non-Aktif');
      if (matched) {
        authSuccess = true;
        authUser = {
          id: matched.id,
          email: matched.email,
          name: matched.name,
          role: matched.role,
          department: matched.department,
          avatar: matched.avatar || (matched.name ? matched.name.slice(0, 2).toUpperCase() : 'US')
        };
      } else if (email.toLowerCase() === ALLOWED_EMAIL && password === ALLOWED_PASSWORD) {
        authSuccess = true;
        authUser = {
          id: 'usr-admin-ubm',
          email: ALLOWED_EMAIL,
          name: 'Administrator UBM',
          role: 'Super Administrator',
          department: 'Operations & Management',
          avatar: 'AD'
        };
      } else {
        throw apiErr;
      }
    }

    if (authSuccess && authUser) {
      // Store session
      const remember = rememberCheckbox ? rememberCheckbox.checked : true;
      const userPayload = JSON.stringify(authUser);
      if (remember) {
        localStorage.setItem(AUTH_STORAGE_KEY, userPayload);
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, userPayload);
      }

      // Visual feedback on button
      if (submitBtn) {
        submitBtn.classList.add('btn-auth-success');
        submitBtn.innerHTML = `
          <i data-lucide="check-circle-2"></i>
          <span>Akses Diterima! Masuk...</span>
        `;
        if (window.lucide) lucide.createIcons();
      }

      // Transition to application
      setTimeout(() => {
        checkAuthAndRender();
        if (typeof showToast === 'function') {
          showToast('Selamat datang kembali, Administrator UBM', 'success');
        }
        // Initialize or reload application data
        if (typeof loadAllData === 'function') {
          loadAllData();
        }
      }, 350);
      return;
    }
  } catch (err) {
    if (errAlert) {
      errAlert.style.display = 'flex';
      if (errMsg) {
        errMsg.textContent = err.message || 'Email atau password salah. Silakan coba lagi.';
      }
    }
  } finally {
    if (submitBtn && !submitBtn.classList.contains('btn-auth-success')) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
      if (window.lucide) lucide.createIcons();
    }
  }
}

/**
 * Handle user logout
 */
function handleUbmLogout() {
  if (confirm('Apakah Anda yakin ingin keluar dari sistem UBM Enterprise?')) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    
    // Clear password input
    const passInput = document.getElementById('auth-password');
    if (passInput) passInput.value = '';

    // Switch view
    checkAuthAndRender();

    if (window.lucide) lucide.createIcons();
    if (typeof showToast === 'function') {
      showToast('Sesi Anda telah diakhiri. Silakan login kembali.', 'info');
    }
  }
}

/**
 * Toggle password reveal in login form
 */
function toggleAuthPassword() {
  const passInput = document.getElementById('auth-password');
  const eyeIcon = document.getElementById('auth-eye-icon');
  if (!passInput) return;

  if (passInput.type === 'password') {
    passInput.type = 'text';
    if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
  } else {
    passInput.type = 'password';
    if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide) lucide.createIcons();
}

// Export for module environments if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAuthUser,
    isAuthenticated,
    checkAuthAndRender,
    handleAuthLogin,
    handleUbmLogout,
    toggleAuthPassword
  };
}
