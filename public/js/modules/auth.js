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
    if (user && user.email && user.email.toLowerCase() === ALLOWED_EMAIL) {
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
 * Updates UI elements that show user details (name, email, role)
 */
function updateAppUserUI(user) {
  if (!user) return;
  const nameEls = document.querySelectorAll('.user-name');
  nameEls.forEach(el => el.textContent = user.name || 'Administrator UBM');
  
  const roleEls = document.querySelectorAll('.user-role');
  roleEls.forEach(el => el.textContent = user.role || 'Super Admin');

  const avatarEls = document.querySelectorAll('.avatar');
  avatarEls.forEach(el => el.textContent = user.avatar || 'AD');

  const emailEl = document.getElementById('topbar-user-email');
  if (emailEl) emailEl.textContent = user.email || ALLOWED_EMAIL;
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
      if (email.toLowerCase() === ALLOWED_EMAIL && password === ALLOWED_PASSWORD) {
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
