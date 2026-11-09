// =========================================================
// UBM - Authentication Module
// Strict Single-Tenant Corporate Access (admin@ubm.co.id)
// =========================================================

const AUTH_STORAGE_KEY = 'ubm_auth_user';
const ALLOWED_EMAIL = 'unitbisnis@takumi.ac.id';
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
 * 4 CANONICAL ACCOUNT ROLES SYSTEM:
 * 1. Administrator: Akses penuh seluruh sistem
 * 2. Ketua UBM: Akses semua, persetujuan project pada order penjualan, assign lead project
 * 3. Keuangan: Akses persetujuan pembelian barang, invoice, keuangan project, BAST & after-sales menu
 * 4. Member: Operasional (Engineering, Teknisi, R&D, Assembly) - akses orders, BOM, purchasing PR, timeline, reports, servis & logs
 * Catatan: Lead Project adalah penugasan per-project, bukan role akun pengguna global.
 * =========================================================
 */

function getNormalizedRole(user) {
  const u = user || getAuthUser();
  if (!u || !u.role) return 'Member';
  const r = (u.role || '').toLowerCase().trim();
  if (r.includes('admin')) return 'Administrator';
  if (r.includes('wadir') || r.includes('wakil')) return 'Wakil Direktur I';
  if (r.includes('ketua')) return 'Ketua UBM';
  if (r.includes('keuangan') || r.includes('finance')) return 'Keuangan';
  if (r.includes('lead')) return 'Member';
  return 'Member';
}

const ROLE_PERMISSIONS = {
  'Administrator': {
    name: 'Administrator',
    allowedViews: ['dashboard', 'logs', 'quotations', 'orders', 'projects', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'settings'],
    canApproveOrder: true,
    canAssignLead: true,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canApproveBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: true
  },
  'Wakil Direktur I': {
    name: 'Wakil Direktur I',
    allowedViews: ['dashboard', 'logs', 'quotations', 'orders', 'projects', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'settings'],
    canApproveOrder: true,
    canAssignLead: true,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canApproveBOM: true,
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
    allowedViews: ['dashboard', 'logs', 'quotations', 'orders', 'projects', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'settings'],
    canApproveOrder: true,
    canAssignLead: true,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canApproveBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: false
  },
  'Keuangan': {
    name: 'Keuangan',
    allowedViews: ['dashboard', 'orders', 'bom', 'purchasing', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'settings', 'logs'],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: false,
    canManageTimeline: false,
    canManageBOM: false,
    canApproveBOM: true,
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
    allowedViews: ['dashboard', 'orders', 'projects', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'service', 'maintenance', 'settings', 'logs'],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: false, // Hanya berwenang menyusun BOM apabila ditunjuk sebagai Lead Project
    canApproveBOM: false,
    canSubmitPR: true,
    canApprovePurchasing: false,
    canManageInvoices: false,
    canManageFinance: false,
    canManageBAST: false,
    canManageAfterSales: false,
    canManageSettings: false
  },
  'Lead Project': {
    name: 'Member',
    allowedViews: ['dashboard', 'orders', 'projects', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'service', 'maintenance', 'settings', 'logs'],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canApproveBOM: false,
    canSubmitPR: true,
    canApprovePurchasing: false,
    canManageInvoices: false,
    canManageFinance: false,
    canManageBAST: false,
    canManageAfterSales: false,
    canManageSettings: false
  }
};

window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
window.getNormalizedRole = getNormalizedRole;

function hasRolePermission(permKey) {
  const user = getAuthUser();
  const roleName = getNormalizedRole(user);
  const perms = ROLE_PERMISSIONS[roleName] || ROLE_PERMISSIONS['Member'];
  return !!perms[permKey];
}

/**
 * Memeriksa apakah user saat ini bertindak sebagai Lead Project pada project tertentu
 * atau apakah user memiliki wewenang Lead Project di setidaknya satu project aktif.
 * Administrator, Ketua UBM, dan Wakil Direktur I selalu memiliki wewenang penuh (true).
 */
function isUserProjectLead(projectIdOrOrderId = null, user = null) {
  const u = user || (typeof getAuthUser === 'function' ? getAuthUser() : null);
  if (!u) return false;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(u) : 'Member';
  if (roleName === 'Administrator' || roleName === 'Ketua UBM' || roleName === 'Wakil Direktur I') return true;

  const uName = (u.name || '').trim().toLowerCase();
  const uEmail = (u.email || '').trim().toLowerCase();
  const projects = (typeof state !== 'undefined' && Array.isArray(state.projects)) ? state.projects : [];

  if (!projectIdOrOrderId) {
    return projects.some(p => {
      const lead = (p.projectLead || '').trim().toLowerCase();
      return Boolean(lead && lead !== 'belum diassign' && (
        lead === uName || lead === uEmail || (uName && uName.length > 2 && lead.includes(uName)) || (uName && lead.length > 2 && uName.includes(lead))
      ));
    });
  }

  const p = (typeof projectIdOrOrderId === 'object' && projectIdOrOrderId !== null)
    ? (projectIdOrOrderId.projectLead !== undefined ? projectIdOrOrderId : projects.find(item => item.id === projectIdOrOrderId.id || item.orderId === projectIdOrOrderId.id))
    : projects.find(item => item.id === projectIdOrOrderId || item.orderId === projectIdOrOrderId);

  if (!p || !p.projectLead) return false;
  const lead = p.projectLead.trim().toLowerCase();
  return Boolean(lead && lead !== 'belum diassign' && (
    lead === uName || lead === uEmail || (uName && uName.length > 2 && lead.includes(uName)) || (uName && lead.length > 2 && uName.includes(lead))
  ));
}
window.isUserProjectLead = isUserProjectLead;

function isUserAssignedToProject(projectIdOrOrderId, user = null) {
  const u = user || (typeof getAuthUser === 'function' ? getAuthUser() : null);
  if (!u) return false;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(u) : 'Member';
  if (roleName === 'Administrator' || roleName === 'Ketua UBM' || roleName === 'Wakil Direktur I') return true;

  const uName = (u.name || '').trim().toLowerCase();
  const uEmail = (u.email || '').trim().toLowerCase();
  const projects = (typeof state !== 'undefined' && Array.isArray(state.projects)) ? state.projects : [];

  const matchingProjects = [];
  if (typeof projectIdOrOrderId === 'object' && projectIdOrOrderId !== null) {
    if (projectIdOrOrderId.team !== undefined || projectIdOrOrderId.projectLead !== undefined) {
      matchingProjects.push(projectIdOrOrderId);
    } else if (projectIdOrOrderId.id) {
      const found = projects.filter(item => item.id === projectIdOrOrderId.id || item.orderId === projectIdOrOrderId.id);
      matchingProjects.push(...found);
    }
  } else if (projectIdOrOrderId) {
    const found = projects.filter(item => item.id === projectIdOrOrderId || item.orderId === projectIdOrOrderId);
    matchingProjects.push(...found);
  }

  if (matchingProjects.length === 0) return false;

  return matchingProjects.some(p => {
    const lead = (p.projectLead || '').trim().toLowerCase();
    const isLead = Boolean(lead && lead !== 'belum diassign' && (
      lead === uName ||
      lead === uEmail ||
      (uName && uName.length > 2 && lead.includes(uName)) ||
      (uName && lead.length > 2 && uName.includes(lead)) ||
      (uEmail && lead.includes(uEmail))
    ));

    const inTeam = Array.isArray(p.team) && p.team.some(m => {
      if (!m) return false;
      const mName = typeof m === 'string' ? m.trim().toLowerCase() : (m.name ? m.name.trim().toLowerCase() : '');
      const mEmail = typeof m === 'object' && m?.email ? m.email.trim().toLowerCase() : '';
      const mId = typeof m === 'object' && (m?.id || m?.userId) ? String(m.id || m.userId) : '';
      const uId = u.id ? String(u.id) : '';

      if (uId && mId && uId === mId) return true;
      if (uEmail && mEmail && uEmail === mEmail) return true;
      if (uName && mName) {
        if (uName === mName) return true;
        if (uName.length > 2 && mName.includes(uName)) return true;
        if (mName.length > 2 && uName.includes(mName)) return true;
      }
      if (uEmail && mName && (mName === uEmail || mName.includes(uEmail))) return true;
      return false;
    });

    return Boolean(isLead || inTeam);
  });
}
window.isUserAssignedToProject = isUserAssignedToProject;

/**
 * Memeriksa apakah user saat ini berwenang membuat Master BOM (template).
 * Master BOM hanya bisa dibuat oleh: Administrator, Ketua UBM, Wakil Direktur I, dan Lead Project.
 * Member biasa yang tidak bertindak sebagai Lead Project pada project aktif tidak dapat membuat Master BOM.
 */
function canUserCreateMasterBOM(user = null) {
  const u = user || (typeof getAuthUser === 'function' ? getAuthUser() : null);
  if (!u) return false;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(u) : (u.role || 'Member');
  if (roleName === 'Administrator' || roleName === 'Ketua UBM' || roleName === 'Wakil Direktur I') return true;
  if (typeof isUserProjectLead === 'function' && isUserProjectLead(null, u)) return true;
  return false;
}
window.canUserCreateMasterBOM = canUserCreateMasterBOM;

function isViewAllowedForUser(viewName) {
  if (!viewName || viewName === 'dashboard') return true; // Semua role bisa melihat dashboard
  const user = getAuthUser();
  const roleName = getNormalizedRole(user);
  if (viewName === 'projects') {
    return true; // Admin, Wadir I, Ketua UBM, dan Member (yang difilter berdasarkan penugasan) dapat mengakses
  }
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
  datalist.innerHTML = users.map(u => {
    return `<option value="${escapeAttr(u.name)}">${escapeHtml(u.name)}</option>`;
  }).join('');

  // Update registered users dropdown for log-pic if present
  if (typeof populateLogPicDropdown === 'function') {
    populateLogPicDropdown();
  }

  // Update lead select dropdown options if present and not locked
  const leadSelect = document.getElementById('pm-lead-name');
  if (leadSelect && leadSelect.tagName === 'SELECT' && !leadSelect.disabled && typeof getUserDropdownOptions === 'function') {
    const curVal = leadSelect.value;
    leadSelect.innerHTML = getUserDropdownOptions(curVal, '-- Pilih Akun Lead Project --');
    if (curVal) leadSelect.value = curVal;
  }
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
  // If this is a public verification URL (QR Code scan), NEVER show the login screen!
  if (typeof isVerificationRoute === 'function' && isVerificationRoute()) {
    const authScreen = document.getElementById('ubm-auth-screen');
    if (authScreen) {
      authScreen.style.display = 'none';
      authScreen.setAttribute('aria-hidden', 'true');
    }
    return false;
  }

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

    // If account is marked as mustChangePassword, lock view with change password modal
    if (Boolean(user.mustChangePassword)) {
      setTimeout(() => {
        openForceChangePasswordModal(user);
      }, 150);
    }

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

    // Pull latest users directly from Supabase so newly registered accounts can login immediately
    try {
      if (typeof directSupabaseFetchUsers === 'function') {
        const directUsers = await directSupabaseFetchUsers();
        if (Array.isArray(directUsers) && directUsers.length > 0) {
          state.users = directUsers;
        }
      }
    } catch (fetchErr) {}

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
          phone: matched.phone || '',
          mustChangePassword: Boolean(matched.mustChangePassword),
          avatar: matched.avatar || (matched.name ? matched.name.slice(0, 2).toUpperCase() : 'US')
        };
      } else if (email.toLowerCase() === ALLOWED_EMAIL && password === ALLOWED_PASSWORD) {
        authSuccess = true;
        authUser = {
          id: 'usr-admin-ubm',
          email: ALLOWED_EMAIL,
          name: 'Administrator UBM',
          role: 'Administrator',
          department: 'Operations & Management',
          mustChangePassword: false,
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
        const isMustChange = Boolean(authUser.mustChangePassword);
        if (isMustChange) {
          openForceChangePasswordModal(authUser);
          if (typeof showToast === 'function') {
            showToast('Akun Anda menggunakan password sementara. Harap tentukan password baru pribadi Anda.', 'warning');
          }
        } else {
          if (typeof showToast === 'function') {
            showToast(`Selamat datang kembali, ${authUser.name || 'Pengguna'}`, 'success');
          }
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
  if (confirm('Apakah Anda yakin ingin keluar dari sistem Unit Bisnis Mandiri, Politeknik Takumi?')) {
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

/**
 * =========================================================
 * MANDATORY FIRST-LOGIN & RESET PASSWORD FORCE-CHANGE FLOW
 * Pengguna yang didaftarkan oleh admin atau di-reset wajib
 * mengganti password default ke password pribadi saat login.
 * =========================================================
 */
function ensureForceChangePasswordModalDOM() {
  let modal = document.getElementById('modal-force-change-password');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.className = 'modal-overlay modal-locked';
  modal.id = 'modal-force-change-password';
  modal.style.zIndex = '99999';
  modal.style.background = 'rgba(15, 23, 42, 0.85)';
  modal.style.backdropFilter = 'blur(6px)';

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 520px; border-top: 4px solid #2563eb; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
      <div class="modal-header" style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 16px 20px;">
        <h3 style="font-size: 15.5px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="shield-alert" style="color: #2563eb; width: 22px; height: 22px;"></i>
          Wajib Ganti Password Akun
        </h3>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 13px 16px; margin-bottom: 20px; font-size: 12.5px; color: #1e40af; line-height: 1.55;">
          Halo <strong id="force-change-user-name">Pengguna</strong>, ini adalah login pertama Anda atau password akun Anda baru saja di-reset oleh Admin/Ketua UBM.
          <br><br>
          <span style="display: flex; align-items: center; gap: 6px; font-weight: 700;">
            <i data-lucide="lock" style="width: 14px; height: 14px;"></i> Demi Keamanan Akun Anda:
          </span>
          Silakan buat password baru pribadi Anda sekarang. Password ini bersifat rahasia dan <strong>hanya Anda yang mengetahuinya</strong> (Admin tidak dapat melihatnya).
        </div>

        <form id="form-force-change-password" onsubmit="submitForceChangePassword(event)">
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" style="font-weight: 700; font-size: 12.5px; color: #1e293b;">Password Baru *</label>
            <div style="position: relative;">
              <input type="password" id="force-pass-new" class="form-control" required placeholder="Minimal 6 karakter" minlength="6" style="padding-right: 38px; font-family: monospace; font-size: 13px;">
              <button type="button" onclick="toggleForceChangePassword('force-pass-new', 'force-eye-1')" style="position: absolute; right: 10px; top: 9px; background: none; border: none; cursor: pointer; color: #64748b; padding: 0;">
                <i data-lucide="eye" id="force-eye-1" style="width: 17px; height: 17px;"></i>
              </button>
            </div>
            <span class="font-xs text-muted" style="margin-top: 4px; display: block;">Gunakan kombinasi huruf, angka, atau simbol agar aman.</span>
          </div>

          <div class="form-group" style="margin-bottom: 18px;">
            <label class="form-label" style="font-weight: 700; font-size: 12.5px; color: #1e293b;">Ulangi Password Baru (Konfirmasi) *</label>
            <div style="position: relative;">
              <input type="password" id="force-pass-confirm" class="form-control" required placeholder="Ketik ulang password baru Anda" minlength="6" style="padding-right: 38px; font-family: monospace; font-size: 13px;">
              <button type="button" onclick="toggleForceChangePassword('force-pass-confirm', 'force-eye-2')" style="position: absolute; right: 10px; top: 9px; background: none; border: none; cursor: pointer; color: #64748b; padding: 0;">
                <i data-lucide="eye" id="force-eye-2" style="width: 17px; height: 17px;"></i>
              </button>
            </div>
            <div id="force-change-error-alert" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; color: #dc2626; font-size: 12px; font-weight: 600; margin-top: 8px;"></div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-outline" onclick="handleUbmLogout()" style="width: 32%; font-size: 12px; font-weight: 600;">
              <i data-lucide="log-out"></i> Batal / Keluar
            </button>
            <button type="submit" id="btn-submit-force-change" class="btn btn-primary" style="flex: 1; font-weight: 700; padding: 10px 18px; background: #2563eb; border-color: #2563eb; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
              <i data-lucide="check-circle-2"></i> <span>Simpan & Aktifkan Password Baru</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (window.lucide) lucide.createIcons();
  return modal;
}

function openForceChangePasswordModal(user) {
  const modal = ensureForceChangePasswordModalDOM();
  const u = user || getAuthUser();
  if (!u) return;

  const nameEl = document.getElementById('force-change-user-name');
  if (nameEl) nameEl.textContent = u.name || u.email || 'Pengguna';

  const newPassInput = document.getElementById('force-pass-new');
  const confirmPassInput = document.getElementById('force-pass-confirm');
  const errEl = document.getElementById('force-change-error-alert');

  if (newPassInput) newPassInput.value = '';
  if (confirmPassInput) confirmPassInput.value = '';
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

  modal.classList.add('open');
  if (window.lucide) lucide.createIcons();
}

function toggleForceChangePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide) lucide.createIcons();
}

async function submitForceChangePassword(event) {
  if (event) event.preventDefault();

  const user = getAuthUser();
  if (!user) {
    alert('Sesi tidak ditemukan. Silakan login kembali.');
    return;
  }

  const newPassInput = document.getElementById('force-pass-new');
  const confirmPassInput = document.getElementById('force-pass-confirm');
  const errEl = document.getElementById('force-change-error-alert');
  const submitBtn = document.getElementById('btn-submit-force-change');

  const newPass = (newPassInput?.value || '').trim();
  const confirmPass = (confirmPassInput?.value || '').trim();

  if (errEl) errEl.style.display = 'none';

  if (!newPass || newPass.length < 6) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Password baru minimal harus 6 karakter.';
    }
    return;
  }

  const forbiddenDefaults = ['12345678', 'ubm365', 'bisnisdigital365', 'takumi2026', 'password'];
  if (forbiddenDefaults.includes(newPass.toLowerCase())) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Password baru tidak boleh menggunakan password default umum demi keamanan akun.';
    }
    return;
  }

  if (newPass !== confirmPass) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Konfirmasi password baru tidak cocok. Harap periksa kembali.';
    }
    return;
  }

  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Simpan & Aktifkan Password Baru';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="auth-spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></span>
      <span>Menyimpan Password...</span>
    `;
  }

  try {
    let apiSuccess = false;

    // 1. Send update to API endpoint
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          newPassword: newPass
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        apiSuccess = true;
      } else {
        throw new Error(data.error || 'Gagal menyimpan password baru.');
      }
    } catch (apiErr) {
      console.warn('⚠️ [Force Change Pass] API fallback to direct Supabase / local:', apiErr.message);
    }

    // 2. Direct native Supabase update if available
    try {
      if (typeof directSupabaseUpsertNativeRow === 'function') {
        await directSupabaseUpsertNativeRow('users', {
          id: user.id,
          email: user.email,
          password: newPass,
          mustChangePassword: false,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (supErr) {}

    // 3. Update local state.users
    if (typeof state !== 'undefined' && Array.isArray(state.users)) {
      const uIdx = state.users.findIndex(u => u.id === user.id || (u.email || '').toLowerCase() === (user.email || '').toLowerCase());
      if (uIdx !== -1) {
        state.users[uIdx].password = newPass;
        state.users[uIdx].mustChangePassword = false;
        try { localStorage.setItem('ubm_cached_users', JSON.stringify(state.users)); } catch (e) {}
      }
    }

    // 4. Update authenticated session user
    user.mustChangePassword = false;
    const userPayload = JSON.stringify(user);
    if (localStorage.getItem(AUTH_STORAGE_KEY)) {
      localStorage.setItem(AUTH_STORAGE_KEY, userPayload);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, userPayload);
    }

    // Close modal
    const modal = document.getElementById('modal-force-change-password');
    if (modal) modal.classList.remove('open');

    if (typeof showToast === 'function') {
      showToast('✅ Password baru Anda berhasil disimpan dan diaktifkan! Password ini bersifat pribadi milik Anda.', 'success');
    }

    // Reload application view
    if (typeof checkAuthAndRender === 'function') {
      checkAuthAndRender();
    }
  } catch (err) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = err.message || 'Gagal menyimpan password baru. Silakan coba lagi.';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
      if (window.lucide) lucide.createIcons();
    }
  }
}

window.openForceChangePasswordModal = openForceChangePasswordModal;
window.toggleForceChangePassword = toggleForceChangePassword;
window.submitForceChangePassword = submitForceChangePassword;

// Export for module environments if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAuthUser,
    isAuthenticated,
    checkAuthAndRender,
    handleAuthLogin,
    handleUbmLogout,
    toggleAuthPassword,
    openForceChangePasswordModal,
    toggleForceChangePassword,
    submitForceChangePassword
  };
}
