// =========================================================
// UBM - Universal Business Management System
// Core Application Coordinator & SPA Router
// =========================================================

// Global State (Safely attached to window)
window.state = window.state || {};
var state = window.state;
Object.assign(state, {
  currentView: state.currentView || 'dashboard',
  orders: state.orders || [],
  quotations: state.quotations || [],
  po: state.po || [],
  invoices: state.invoices || [],
  purchasing: state.purchasing || [],
  purchasing_process: state.purchasing_process || [],
  master_items: state.master_items || [],
  bom: state.bom || [],
  delivery: state.delivery || [],
  projects: state.projects || [],
  bast: state.bast || [],
  project_reports: state.project_reports || [],
  service_tickets: state.service_tickets || [],
  warranty_claims: state.warranty_claims || [],
  maintenance: state.maintenance || [],
  activity_logs: state.activity_logs || [],
  partnerships: state.partnerships || [],
  service_expenses: state.service_expenses || [],
  project_finances: state.project_finances || [],
  roles: state.roles || [],
  users: (function() {
    try {
      const c = localStorage.getItem('ubm_cached_users');
      if (c) return JSON.parse(c);
    } catch (e) {}
    return window.state?.users || [];
  })(),
  settings: state.settings || null,
  stats: state.stats || null,
  searchQuery: state.searchQuery || '',
  ganttCollapsedProjects: state.ganttCollapsedProjects || {}
});

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // 0. Cek jika permintaan adalah Verifikasi QR Code publik (tanpa login sama sekali)
  if (typeof isVerificationRoute === 'function' && isVerificationRoute()) {
    handlePublicVerificationView();
    return;
  }

  // 1. Strict Authentication verification before loading app
  const isAuth = typeof checkAuthAndRender === 'function' ? checkAuthAndRender() : true;

  initHotReload();
  initNavigation();
  initSearch();
  startLiveClock();

  // Fetch server info for smart QR Code network URL
  fetch('/api/server-info')
    .then(r => r.json())
    .then(data => {
      if (data && data.lanIp && data.lanIp !== 'localhost') {
        window.__UBM_LAN_IP__ = data.lanIp;
      }
    })
    .catch(() => {});

  if (isAuth) {
    loadAllData();
  }
  
  // Mobile toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('open');
    });
  }
});

// ==================== HOT RELOAD / LIVE RELOAD CLIENT ====================
function initHotReload() {
  if (typeof EventSource === 'undefined') return;
  
  let source = null;
  let reconnectTimer = null;

  function connect() {
    try {
      source = new EventSource('/api/live-reload');

      source.onopen = () => {
        console.log('⚡ [Hot Reload] Terhubung ke SSE Live Reload server.');
      };

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'css-update') {
            console.log('⚡ [Hot Reload] Mengupdate stylesheet CSS secara instan:', data.file);
            const styleLinks = document.querySelectorAll('link[rel="stylesheet"]');
            styleLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (href && href.includes('css')) {
                const baseHref = href.split('?')[0];
                link.setAttribute('href', `${baseHref}?t=${Date.now()}`);
              }
            });
          } else if (data.type === 'reload') {
            console.log('⚡ [Live Reload] Perubahan data/script terdeteksi:', data.file || data.resource);
            if (data.file && (data.file.endsWith('.js') || data.file.endsWith('.html'))) {
              location.reload();
            } else {
              loadAllData();
            }
          }
        } catch (err) {
          console.error('Error parsing live reload event:', err);
        }
      };

      source.onerror = () => {
        if (source) {
          source.close();
          source = null;
        }
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 1500);
      };
    } catch (err) {
      console.warn('Live reload init error:', err);
    }
  }

  connect();
}

// Live clock in sidebar
function startLiveClock() {
  const el = document.getElementById('live-time');
  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
    if (el) el.textContent = timeStr;
  }
  update();
  setInterval(update, 1000);
}

// ==================== NAVIGATION & ROUTER ====================
function initNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      navigateTo(view);
    });
  });

  const quickCreateBtn = document.getElementById('btn-quick-create');
  if (quickCreateBtn) {
    quickCreateBtn.addEventListener('click', () => {
      handleQuickCreate();
    });
  }
}

function navigateTo(viewName) {
  // Guard: if not authenticated, redirect to auth screen
  if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
    if (typeof checkAuthAndRender === 'function') checkAuthAndRender();
    return;
  }

  // Guard: role permission check
  if (typeof isViewAllowedForUser === 'function' && !isViewAllowedForUser(viewName)) {
    if (typeof showToast === 'function') {
      showToast('Akses dibatasi sesuai wewenang role Anda.', 'warning');
    }
    navigateTo('dashboard');
    return;
  }

  if (state.currentView && state.currentView !== viewName && !['bom-form', 'timeline'].includes(state.currentView)) {
    state.previousMainView = state.currentView;
  }
  if (state.currentView && state.currentView !== viewName) {
    state.previousView = state.currentView;
  }
  state.currentView = viewName;

  // Bersihkan floating tooltip jika ada
  if (typeof hideGanttTooltip === 'function') {
    hideGanttTooltip();
  }
  
  // Update nav item active states
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    if (btn.getAttribute('data-view') === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle View sections
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const targetSec = document.getElementById(`view-${viewName}`);
  if (targetSec) targetSec.classList.add('active');

  // Update Page Title
  const titles = {
    dashboard: { title: 'Dashboard Overview', sub: 'Ringkasan performa dan operasional terpadu UBM', btn: 'Tambah Data' },
    logs: { title: 'Log Kegiatan & Kalender UBM', sub: 'Pencatatan kegiatan operasional UBM, waktu pengerjaan dari-sampai, PIC penanggung jawab, dan kalender kegiatan', btn: '+ Catat Kegiatan' },
    quotations: { title: 'Quotation', sub: 'Penawaran harga produk & jasa ke calon pelanggan, kuantiti, kalkulasi PPN & garansi', btn: 'Quotation Baru' },
    orders: { title: 'Manajemen Order Penjualan', sub: 'Daftar pesanan penjualan pelanggan & status pengerjaan', btn: 'Order Baru' },
    projects: { title: 'Project Management', sub: 'Daftar project terdaftar, Project Lead, tim pelaksana & progress pengerjaan', btn: '+ Project Management Baru' },
    timeline: { title: 'Project Management & Timeline', sub: 'Pengaturan jadwal pengerjaan, deadline, dan milestone tahapan project', btn: 'Kembali ke Order' },
    bom: { title: 'Bill of Materials (BOM)', sub: 'Master formula, struktur bahan baku dan estimasi HPP produk', btn: null },
    'bom-form': { title: 'Formulir Master BOM', sub: 'Input struktur komponen, bahan baku, dan estimasi HPP produk', btn: 'Kembali ke BOM' },
    purchasing: { title: 'Purchasing', sub: 'Pengajuan kebutuhan pengadaan barang/jasa internal dan persetujuan', btn: 'Request Pengadaan' },
    'project-reports': { title: 'Laporan Project', sub: 'Laporan pelaksanaan project, penggunaan bahan aktual & pengembalian sisa material ke Master Barang', btn: null },
    service: { title: 'Service & Garansi', sub: 'Layanan purna jual, kartu garansi resmi project & pengajuan biaya perbaikan service (non-garansi)', btn: null },
    maintenance: { title: 'Maintenance Project', sub: 'Jadwal pemeliharaan berkala, formulir checklist inspeksi teknis & riwayat perawatan project', btn: null },
    po: { title: 'Purchase Order (PO)', sub: 'Pesanan pembelian barang & bahan baku kepada vendor', btn: '+ Buat PO Baru' },
    delivery: { title: 'Surat Jalan / Delivery (DO)', sub: 'Manajemen pengiriman barang, armada & tracking status', btn: 'Buat Surat Jalan' },
    invoices: { title: 'Invoice / Faktur Tagihan', sub: 'Penerbitan faktur tagihan pelanggan & status pelunasan', btn: 'Terbitkan Invoice' },
    bast: { title: 'BAST', sub: 'Berita Acara Serah Terima pekerjaan dan serah terima produk hasil project selesai', btn: null },
    finance: { title: 'Keuangan & Profitabilitas Project', sub: 'Ringkasan finansial proyek: harga modal (HPP), harga jual, garansi, dan analisis laba bersih', btn: null },
    settings: { title: 'Pengaturan Profil Perusahaan', sub: 'Identitas UBM, Yayasan, Alamat, No. Kontak, Pejabat Resmi (Ketua UBM & Wadir I), Rekening Bank & Copyright', btn: null }
  };

  const info = titles[viewName] || titles.dashboard;
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = info.title;
  const subEl = document.getElementById('page-subtitle');
  if (subEl) subEl.textContent = info.sub;
  const btnEl = document.getElementById('quick-create-label');
  const quickBtn = document.getElementById('btn-quick-create');
  if (quickBtn) {
    if (info.btn) {
      quickBtn.style.display = 'inline-flex';
      if (btnEl) btnEl.textContent = info.btn;
    } else {
      quickBtn.style.display = 'none';
    }
  }

  renderCurrentView();
  
  // Close mobile sidebar if open
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

function handleQuickCreate() {
  switch (state.currentView) {
    case 'logs': if (typeof focusLogForm === 'function') focusLogForm(); break;
    case 'quotations': openQuotationModal(); break;
    case 'orders': openOrderModal(); break;
    case 'projects':
      if (typeof openCreateDirectProjectModal === 'function') {
        openCreateDirectProjectModal();
      } else {
        openProjectAssignmentWorkspace();
      }
      break;
    case 'po': openPOModal(); break;
    case 'invoices': openInvoiceModal(); break;
    case 'purchasing': openPurchasingModal(); break;
    case 'bom': openBOMPage(); break;
    case 'delivery': openDeliveryModal(); break;
    case 'bast': openCreateBastModal(); break;
    default: openOrderModal(); break;
  }
}

// ==================== DATA FETCHING & SYNC ====================
async function loadAllData() {
  // Guard: do not fetch data if not logged in
  if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
    return;
  }
  try {
    await Promise.allSettled([
      loadDashboardData(),
      fetchResource('quotations'),
      fetchResource('orders'),
      fetchResource('po'),
      fetchResource('invoices'),
      fetchResource('purchasing'),
      fetchResource('purchasing_process'),
      fetchResource('master_items'),
      fetchResource('bom'),
      fetchResource('delivery'),
      fetchResource('projects'),
      fetchResource('bast'),
      fetchResource('project_reports'),
      fetchResource('service_tickets'),
      fetchResource('warranty_claims'),
      fetchResource('maintenance'),
      fetchResource('activity_logs'),
      fetchResource('partnerships'),
      fetchResource('service_expenses'),
      fetchResource('project_finances'),
      fetchResource('roles'),
      fetchResource('users'),
      fetchResource('settings')
    ]);
    // Sync active session user with latest database state across all devices
    if (typeof getAuthUser === 'function') {
      const authUser = getAuthUser();
      if (authUser && Array.isArray(state.users)) {
        const authRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(authUser) : (authUser.role || '');
        const liveUser = state.users.find(u =>
          (u.email || '').trim().toLowerCase() === (authUser.email || '').trim().toLowerCase() ||
          u.id === authUser.id
        ) || (authRole === 'Administrator'
          ? state.users.find(u => (typeof getNormalizedRole === 'function' ? getNormalizedRole(u) : (u.role || '')) === 'Administrator' && u.status !== 'Non-Aktif')
          : null);
        if (liveUser) {
          const updatedAuth = {
            ...authUser,
            id: liveUser.id || authUser.id,
            email: liveUser.email || authUser.email,
            name: liveUser.name,
            role: liveUser.role,
            department: liveUser.department,
            avatar: liveUser.avatar || liveUser.name?.slice(0, 2).toUpperCase() || 'US'
          };
          const userPayload = JSON.stringify(updatedAuth);
          if (localStorage.getItem('ubm_auth_user')) {
            localStorage.setItem('ubm_auth_user', userPayload);
          } else {
            sessionStorage.setItem('ubm_auth_user', userPayload);
          }
          if (typeof updateAppUserUI === 'function') {
            updateAppUserUI(updatedAuth);
          }
        }
      }
    }

    if (typeof updateAppFooterCopyright === 'function') {
      updateAppFooterCopyright();
    }
    if (typeof populateUsersAssignmentDatalist === 'function') {
      populateUsersAssignmentDatalist();
    }
    if (typeof applyRoleNavigation === 'function') {
      applyRoleNavigation(typeof getAuthUser === 'function' ? getAuthUser() : null);
    }
    renderCurrentView();
    updateSidebarBadges();
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Gagal memuat data dari server: ' + err.message, 'error');
  }
}

async function fetchResource(resource) {
  let result = null;

  // 1. Prioritas Utama: Ambil langsung dari Supabase Database (Real-time Single Source of Truth)
  // Menghubungkan browser langsung ke PostgreSQL Supabase, bebas delay serverless dan bebas cold cache disk
  if (typeof directSupabaseFetchResource === 'function') {
    try {
      const directData = await directSupabaseFetchResource(resource);
      if (directData !== null && directData !== undefined) {
        result = directData;
      }
    } catch (err) {
      console.warn(`[Direct Supabase Fetch ${resource}] Notice:`, err.message);
    }
  }

  // 2. Fallback jika koneksi direct Supabase gagal (misal mode offline atau sandbox)
  if (result === null || result === undefined) {
    try {
      const cacheBuster = `_t=${Date.now()}`;
      const url = `/api/${resource}?${cacheBuster}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        result = await res.json();
      }
    } catch (err) {
      console.warn(`[Fallback /api/${resource}] Fetch notice:`, err.message);
    }
  }

  if (resource === 'settings') {
    state.settings = result;
  } else {
    if (resource === 'orders' && Array.isArray(result)) {
      result.forEach(o => {
        if (typeof ensureOrderPOData === 'function') ensureOrderPOData(o);
        if (typeof ensureOrderApprovalData === 'function') ensureOrderApprovalData(o);
      });
    }
    state[resource] = Array.isArray(result) ? result : [];
    if (resource === 'users' && Array.isArray(result) && result.length > 0) {
      try { localStorage.setItem('ubm_cached_users', JSON.stringify(result)); } catch (e) {}
    }
    if (resource === 'partnerships' && Array.isArray(result)) {
      try { localStorage.removeItem('ubm_cached_partnerships'); } catch (e) {}
    }
    if (resource === 'service_expenses' && Array.isArray(result)) {
      try { localStorage.removeItem('ubm_cached_service_expenses'); } catch (e) {}
    }
    if (resource === 'activity_logs' && Array.isArray(result)) {
      try { localStorage.removeItem('ubm_activity_logs_backup'); } catch (e) {}
      if (state.currentView === 'logs' && typeof renderLogsView === 'function') {
        renderLogsView();
      }
    }
  }

  if (!state[resource]) state[resource] = (resource === 'settings' ? null : []);
  return state[resource];
}

function updateSidebarBadges() {
  const badgeServiceExpenses = document.getElementById('badge-service-expenses-count');
  if (badgeServiceExpenses) {
    badgeServiceExpenses.textContent = state.service_expenses?.length || 0;
  }

  const badgePartnershipCount = document.getElementById('badge-partnership-count');
  if (badgePartnershipCount) {
    badgePartnershipCount.textContent = state.partnerships?.length || 0;
  }
  const badgeLogs = document.getElementById('badge-logs-count');
  if (badgeLogs) badgeLogs.textContent = state.activity_logs?.length || 0;

  const badgeQuotation = document.getElementById('badge-quotation-count');
  if (badgeQuotation) badgeQuotation.textContent = state.quotations?.length || 0;

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Administrator';

  const badgeOrder = document.getElementById('badge-order-count');
  if (badgeOrder) {
    if (roleName === 'Member') {
      const assignedOrders = (state.orders || []).filter(o => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(o.id, activeUser) : true);
      badgeOrder.textContent = assignedOrders.length;
    } else {
      badgeOrder.textContent = state.orders?.length || 0;
    }
  }

  const badgeDelivery = document.getElementById('badge-delivery-count');
  if (badgeDelivery) badgeDelivery.textContent = state.delivery?.length || 0;

  const badgeInvoice = document.getElementById('badge-invoice-count');
  if (badgeInvoice) {
    const invCount = (state.invoices?.length || 0) + (state.partnerships?.length || 0);
    badgeInvoice.textContent = invCount;
  }
  const badgeSubCustomer = document.getElementById('badge-tab-invoice-customer-count');
  if (badgeSubCustomer) badgeSubCustomer.textContent = state.invoices?.length || 0;
  const badgeSubPartnership = document.getElementById('badge-tab-invoice-partnership-count');
  if (badgeSubPartnership) badgeSubPartnership.textContent = state.partnerships?.length || 0;

  const badgePurchasing = document.getElementById('badge-purchasing-count');
  if (badgePurchasing) badgePurchasing.textContent = state.purchasing?.length || 0;

  const badgePO = document.getElementById('badge-po-count');
  if (badgePO) badgePO.textContent = state.po?.length || 0;

  const badgeBOM = document.getElementById('badge-bom-count');
  if (badgeBOM) {
    if (roleName === 'Member') {
      const memberBOMs = (state.bom || []).filter(b => {
        if (b.orderId || b.projectId) {
          return typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(b.orderId || b.projectId, activeUser) : false;
        }
        const userProjects = (state.projects || []).filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : false);
        return userProjects.some(p =>
          p.bomId === b.id ||
          (p.projectName && b.productName && p.projectName.toLowerCase().trim() === b.productName.toLowerCase().trim()) ||
          (p.projectName && b.projectName && p.projectName.toLowerCase().trim() === b.projectName.toLowerCase().trim())
        );
      });
      badgeBOM.textContent = memberBOMs.length;
    } else {
      badgeBOM.textContent = state.bom?.length || 0;
    }
  }

  const badgeProjects = document.getElementById('badge-projects-count');
  if (badgeProjects) {
    let productProjects = (state.projects || []).filter(p => {
      if (typeof isProjectService === 'function') return !isProjectService(p);
      const ord = (state.orders || []).find(o => o.id === p.orderId);
      if (ord && (ord.orderType === 'jasa' || ord.quotationType === 'jasa')) return false;
      return true;
    });
    if (roleName === 'Member') {
      productProjects = productProjects.filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : true);
    }
    badgeProjects.textContent = productProjects.length;
  }

  const badgeBast = document.getElementById('badge-bast-count');
  if (badgeBast) {
    const completedProjectsCount = (state.projects || []).filter(p => {
      const isSvc = p.isService || (typeof isProjectService === 'function' && isProjectService(p));
      if (isSvc) return false;
      const orderExists = (state.orders || []).some(o => o.id === p.orderId);
      return orderExists && p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed');
    }).length;
    badgeBast.textContent = completedProjectsCount;
  }

  const badgeReports = document.getElementById('badge-project-reports-count');
  if (badgeReports) {
    const completedCount = (state.projects || []).filter(p => {
      if (typeof isProjectFullyCompleted === 'function') return isProjectFullyCompleted(p);
      const isSvc = p.isService || (typeof isProjectService === 'function' && isProjectService(p));
      if (isSvc && p.serviceExpenseApproved) return true;
      const orderExists = (state.orders || []).some(o => o.id === p.orderId || o.id === p.id);
      return orderExists && (p.status === 'Completed' || p.progressPercent === 100 || (p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed')));
    }).length;
    badgeReports.textContent = completedCount;
  }

  const badgeService = document.getElementById('badge-service-count');
  if (badgeService) {
    const completedWithWarranty = (state.projects || []).filter(p => {
      const isSvc = p.isService || (typeof isProjectService === 'function' && isProjectService(p));
      if (isSvc) return false;
      const orderExists = (state.orders || []).some(o => o.id === p.orderId || o.id === p.id);
      return orderExists && (p.status === 'Completed' || p.progressPercent === 100 || (p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed')));
    }).length;
    badgeService.textContent = completedWithWarranty;
  }

  const badgeMaintenance = document.getElementById('badge-maintenance-count');
  if (badgeMaintenance) {
    const completedCount = (state.projects || []).filter(p => {
      const isSvc = p.isService || (typeof isProjectService === 'function' && isProjectService(p));
      if (isSvc) return false;
      const orderExists = (state.orders || []).some(o => o.id === p.orderId || o.id === p.id);
      return orderExists && (p.status === 'Completed' || p.progressPercent === 100 || (p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed')));
    }).length;
    badgeMaintenance.textContent = completedCount;
  }

  const badgeFinance = document.getElementById('badge-finance-count');
  if (badgeFinance) {
    const list = (state.project_finances && state.project_finances.length > 0)
      ? state.project_finances
      : (typeof getAllProjectsForFinance === 'function' ? getAllProjectsForFinance() : ((state.projects && state.projects.length) ? state.projects : (state.orders || [])));
    badgeFinance.textContent = list.length || 0;
  }

  if (typeof updateBOMTabBadges === 'function') {
    updateBOMTabBadges();
  }
}

function renderCurrentView() {
  switch (state.currentView) {
    case 'dashboard': loadDashboardData(); break;
    case 'logs':
      if (typeof renderLogsView === 'function') {
        renderLogsView();
      }
      break;
    case 'quotations': renderQuotationsTable(); break;
    case 'orders': renderOrdersTable(); break;
    case 'projects':
      if (typeof renderProjectsTableView === 'function') {
        renderProjectsTableView();
      }
      break;
    case 'timeline':
      if (typeof renderTimelineWorkspace === 'function') {
        const orderId = currentActiveProjectOrderId || (state.orders.length > 0 ? state.orders[0].id : null);
        renderTimelineWorkspace(orderId);
      }
      break;
    case 'po': renderPOTable(); break;
    case 'invoices':
      const savedInvoiceTab = sessionStorage.getItem('ubm_active_invoice_tab');
      if (savedInvoiceTab === 'partnership' && typeof switchInvoiceTab === 'function') {
        switchInvoiceTab('partnership');
      } else {
        if (typeof switchInvoiceTab === 'function') {
          switchInvoiceTab('customer');
        } else {
          renderInvoicesTable();
        }
      }
      break;
    case 'purchasing': renderPurchasingTable(); break;
    case 'project-reports': if (typeof renderProjectReportsTable === 'function') renderProjectReportsTable(); break;
    case 'service':
      if (typeof switchServiceTab === 'function') {
        switchServiceTab(typeof currentActiveServiceTab !== 'undefined' ? currentActiveServiceTab : 'warranty');
      } else if (typeof renderServiceTable === 'function') {
        renderServiceTable();
      }
      break;
    case 'maintenance': if (typeof renderMaintenanceTable === 'function') renderMaintenanceTable(); break;
    case 'finance':
      const savedFinanceTab = sessionStorage.getItem('ubm_active_finance_tab');
      if (savedFinanceTab === 'partnership' && typeof switchFinanceTab === 'function') {
        switchFinanceTab('partnership');
      } else if ((savedFinanceTab === 'service-expenses' || savedFinanceTab === 'service_expenses') && typeof switchFinanceTab === 'function') {
        switchFinanceTab('service-expenses');
      } else {
        if (typeof switchFinanceTab === 'function') {
          switchFinanceTab('profit');
        } else {
          if (typeof renderFinanceTable === 'function') renderFinanceTable();
          if (typeof renderPartnershipsTable === 'function') renderPartnershipsTable();
          if (typeof renderServiceExpensesTable === 'function') renderServiceExpensesTable();
        }
      }
      break;
    case 'bom': renderBOMTable(); break;
    case 'delivery': renderDeliveryTable(); break;
    case 'bast': if (typeof renderBastTable === 'function') renderBastTable(); break;
    case 'settings': if (typeof renderSettingsView === 'function') renderSettingsView(); break;
  }
}

// Global Delete Resource Helper
async function deleteResource(resource, id) {
  if (!confirm(`Apakah Anda yakin ingin menghapus data ${resource.toUpperCase()} dengan ID: ${id}?`)) {
    return;
  }

  try {
    if (resource === 'purchasing') {
      const prToDelete = (state.purchasing || []).find(p => p.id === id);
      if (prToDelete && (prToDelete.status === 'Disetujui' || prToDelete.status === 'Stock' || prToDelete.status === 'Approved')) {
        if (!confirm(`⚠️ Perhatian: Request Pengadaan ${id} berstatus '${prToDelete.status}'. Menghapus data ini akan menghapusnya secara permanen dari Dokumen PR, Proses Pembelian, dan Master Barang.\n\nApakah Anda yakin ingin tetap menghapusnya?`)) {
          return;
        }
      }
    }

    if (resource === 'bom' && typeof restoreBOMComponentsStock === 'function') {
      const bomToDelete = (state.bom || []).find(b => b.id === id);
      if (bomToDelete && bomToDelete.status !== 'Ditolak') {
        await restoreBOMComponentsStock(bomToDelete.components);
      }
    }

    // 1. Optimistic UI update: hapus dari state seketika agar antarmuka responsif tanpa jeda
    const originalItems = Array.isArray(state[resource]) ? [...state[resource]] : [];
    if (Array.isArray(state[resource])) {
      state[resource] = state[resource].filter(item => item.id !== id);
      renderCurrentView();
      updateSidebarBadges();
    }

    // 2. Hapus langsung dari Supabase Native Table & Cloud Sync Store secara instan
    if (typeof directSupabaseDeleteNativeRow === 'function') {
      directSupabaseDeleteNativeRow(resource, id).catch(() => {});
    }
    if (typeof directSupabaseSyncResource === 'function' && Array.isArray(state[resource])) {
      directSupabaseSyncResource(resource, state[resource]).catch(() => {});
    }

    // 3. Panggil API backend untuk sinkronisasi relasi (BOM, PO, Master Barang, db.json)
    const res = await fetch(`/api/${resource}/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast(`Data ${resource.toUpperCase()} ${id} berhasil dihapus`, 'success');
      await fetchResource(resource);
      if (resource === 'bom') {
        await Promise.allSettled([
          fetchResource('purchasing'),
          fetchResource('purchasing_process'),
          fetchResource('master_items'),
          fetchResource('projects')
        ]);
      } else if (resource === 'purchasing') {
        await Promise.allSettled([
          fetchResource('purchasing_process'),
          fetchResource('master_items')
        ]);
      } else if (resource === 'orders') {
        await Promise.allSettled([
          fetchResource('quotations'),
          fetchResource('projects'),
          fetchResource('bom'),
          fetchResource('invoices'),
          fetchResource('delivery'),
          fetchResource('bast'),
          fetchResource('project_reports'),
          fetchResource('service_expenses'),
          fetchResource('partnerships')
        ]);
      }
      renderCurrentView();
      updateSidebarBadges();
      loadDashboardData();
    } else {
      // Rollback jika server backend menolak
      state[resource] = originalItems;
      renderCurrentView();
      updateSidebarBadges();
      showToast('Gagal menghapus data dari server', 'error');
    }
  } catch (err) {
    console.error(`Error deleting ${resource}:`, err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

// Global Topbar Search
function initSearch() {
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      state.searchQuery = val.trim();
      
      // Sinkronkan input pencarian di dashboard jika sedang aktif
      const dashSearch = document.getElementById('dashboard-search-input');
      if (dashSearch && dashSearch.value !== val) {
        dashSearch.value = val;
        const clearBtn = document.getElementById('dashboard-search-clear-btn');
        if (clearBtn) clearBtn.style.display = val.trim().length > 0 ? 'inline-flex' : 'none';
      }

      if (state.currentView === 'dashboard') {
        if (typeof renderDashboardGanttChart === 'function') {
          renderDashboardGanttChart();
        }
      } else {
        renderCurrentView();
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        state.searchQuery = '';
        const dashSearch = document.getElementById('dashboard-search-input');
        if (dashSearch) {
          dashSearch.value = '';
          const clearBtn = document.getElementById('dashboard-search-clear-btn');
          if (clearBtn) clearBtn.style.display = 'none';
        }
        renderCurrentView();
      }
    });
  }

  // Shortcut Keyboard ⌘K / Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const globalSearch = document.getElementById('global-search');
      if (globalSearch) {
        globalSearch.focus();
        globalSearch.select();
      }
    }
  });

  // Klik kotak search untuk auto-focus input
  const searchBox = document.querySelector('.search-box');
  if (searchBox) {
    searchBox.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const input = searchBox.querySelector('input');
        if (input) input.focus();
      }
    });
  }
}

// ==================== PUBLIC QR CODE VERIFICATION VIEW (NO LOGIN) ====================
function isVerificationRoute() {
  if (typeof window === 'undefined') return false;
  const path = (window.location.pathname || '').toLowerCase();
  const search = window.location.search || '';
  const hash = (window.location.hash || '').toLowerCase();
  if (path.includes('verifikasi') || path.includes('verify')) return true;
  if (hash.includes('verifikasi') || hash.includes('verify')) return true;
  const params = new URLSearchParams(search);
  if (params.has('name') && (params.has('doc') || params.has('role') || params.has('title'))) {
    return true;
  }
  return false;
}
window.isVerificationRoute = isVerificationRoute;

function handlePublicVerificationView() {
  // Sembunyikan layar login dan layout aplikasi normal
  const authScreen = document.getElementById('ubm-auth-screen');
  if (authScreen) {
    authScreen.style.display = 'none';
    authScreen.setAttribute('aria-hidden', 'true');
  }

  const appLayout = document.getElementById('main-app-layout') || document.querySelector('.app-layout');
  if (appLayout) {
    appLayout.style.display = 'none';
  }

  // Tampilkan antarmuka verifikasi tanda tangan digital resmi secara inline
  renderInlinePublicVerification();
}
window.handlePublicVerificationView = handlePublicVerificationView;

function renderInlinePublicVerification() {
  const container = document.getElementById('ubm-public-verification-view');
  if (!container) return;

  container.style.display = 'flex';

  const params = new URLSearchParams(window.location.search);
  const rawName = params.get('name') || 'Rizaldi Putra, M.Kom';
  const cleanName = rawName.replace(/\.+$/, '');
  const role = params.get('role') || (cleanName.includes('Agung') ? 'Wakil Direktur I Politeknik Takumi' : (cleanName.includes('Wahyudi') ? 'Direktur Politeknik Takumi' : 'Ketua Unit Bisnis Mandiri (UBM)'));
  const doc = params.get('doc') || 'ST/UBM-ENG/2026/001';
  const title = params.get('title') || 'Surat Tugas Pelaksanaan Proyek';
  const nowStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';

  function escapeXml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  const escCleanName = escapeXml(cleanName);
  const escRole = escapeXml(role);
  const escDoc = escapeXml(doc);
  const escTitle = escapeXml(title);
  const escDate = escapeXml(nowStr);

  const displayName = escCleanName.length > 36 ? escCleanName.slice(0, 33) + '...' : escCleanName;
  const displayRole = escRole.length > 46 ? escRole.slice(0, 43) + '...' : escRole;
  const displayDoc = escDoc.length > 32 ? escDoc.slice(0, 29) + '...' : escDoc;
  const displayTitle = escTitle.length > 44 ? escTitle.slice(0, 41) + '...' : escTitle;

  const svgContent = `<svg id="signature-badge-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 360" width="540" height="360" style="background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,Roboto,Helvetica,Arial,sans-serif;display:block;width:100%;height:auto;max-width:520px;">
  <defs>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.08"/>
    </filter>
  </defs>

  <rect x="18" y="16" width="504" height="328" rx="16" fill="url(#cardGrad)" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  
  <path d="M 18 32 A 16 16 0 0 1 34 16 L 506 16 A 16 16 0 0 1 522 32 L 522 56 L 18 56 Z" fill="#0f172a"/>
  <rect x="18" y="56" width="504" height="3" fill="#10b981"/>
  
  <text x="270" y="38" fill="#ffffff" font-size="11.5" font-weight="700" letter-spacing="1.2" text-anchor="middle">
    UNIT BISNIS MANDIRI (UBM) &bull; POLITEKNIK TAKUMI
  </text>

  <circle cx="270" cy="108" r="34" fill="url(#checkGrad)"/>
  <circle cx="270" cy="108" r="39" fill="none" stroke="#a7f3d0" stroke-width="2.5" stroke-dasharray="4 2"/>
  <path d="M 255 108 L 266 119 L 288 97" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>

  <rect x="175" y="152" width="190" height="22" rx="11" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
  <text x="270" y="167" fill="#047857" font-size="10" font-weight="800" letter-spacing="1" text-anchor="middle">
    &#10003; TERVERIFIKASI DIGITAL
  </text>

  <text x="270" y="202" fill="#0f172a" font-size="20" font-weight="800" text-anchor="middle">
    Approved by ${displayName}
  </text>

  <text x="270" y="225" fill="#334155" font-size="13" font-weight="600" text-anchor="middle">
    ${displayRole}
  </text>

  <rect x="36" y="244" width="468" height="84" rx="10" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
  <text x="50" y="266" fill="#475569" font-size="11" font-weight="600">
    Dokumen: <tspan fill="#0f172a" font-weight="700">${displayTitle}</tspan> (${displayDoc})
  </text>
  <text x="50" y="288" fill="#475569" font-size="11">
    Status Keabsahan: <tspan fill="#059669" font-weight="700">&#10003; Resmi Disetujui &amp; Sah pada Database UBM</tspan>
  </text>
  <text x="50" y="309" fill="#64748b" font-size="10.5">
    Tanggal Validasi: <tspan fill="#0f172a">${escDate}</tspan> &bull; Sistem Verifikasi Otomatis UBM
  </text>
</svg>`;

  const pdfUrl = `/api/download-signature-pdf?name=${encodeURIComponent(cleanName)}&role=${encodeURIComponent(role)}&doc=${encodeURIComponent(doc)}&title=${encodeURIComponent(title)}&date=${encodeURIComponent(nowStr)}`;

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px; max-width: 600px;">
      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 10px; border: 1px solid #a7f3d0;">
        <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
        SISTEM VERIFIKASI PENGESAHAN RESMI
      </div>
      <h1 style="font-size: 21px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.3px; margin-bottom: 4px;">Unit Bisnis Mandiri (UBM)</h1>
      <p style="font-size: 13px; color: #64748b;">Politeknik Takumi &bull; Keabsahan Tanda Tangan Digital Resmi</p>
    </div>

    <div style="width: 100%; max-width: 540px; background: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center;">
      <div style="width: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden; border-radius: 14px; background: #f8fafc;">
        ${svgContent}
      </div>
      <div style="display: flex; gap: 8px; margin-top: 16px; width: 100%; justify-content: center; flex-wrap: wrap;">
        <a href="${pdfUrl}" download="Approved_by_${cleanName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf" style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none; cursor: pointer; background: #2563eb; color: #ffffff;">
          &#8681; Unduh PDF Resmi
        </a>
        <button id="inline-btn-download-png" type="button" style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; background: #10b981; color: #ffffff; border: none;">
          Simpan Gambar (.png)
        </button>
        <button id="inline-btn-copy-link" type="button" style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; background: #ffffff; color: #334155; border: 1px solid #cbd5e1;">
          Salin Tautan
        </button>
      </div>
    </div>

    <div style="width: 100%; max-width: 540px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 20px; font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
      <h2 style="font-size: 14px; font-weight: 700; color: #047857; display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
        Hasil Pindai &amp; Validasi Keabsahan Digital
      </h2>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9;">
        <span style="color: #64748b; font-weight: 500;">Status Dokumen</span>
        <span style="font-weight: 700; color: #047857; background: #ecfdf5; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">&#10003; RESMI &amp; TERVERIFIKASI</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9;">
        <span style="color: #64748b; font-weight: 500;">Pernyataan</span>
        <span style="font-weight: 700; color: #047857; font-size: 14px;">Approved by ${escCleanName}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9;">
        <span style="color: #64748b; font-weight: 500;">Pejabat Pengesah</span>
        <span style="font-weight: 600; color: #0f172a;">${escapeXml(rawName)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9;">
        <span style="color: #64748b; font-weight: 500;">Jabatan Resmi</span>
        <span style="font-weight: 600; color: #0f172a;">${escRole}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9;">
        <span style="color: #64748b; font-weight: 500;">Nomor Dokumen</span>
        <span style="font-weight: 600; color: #0f172a;">${escDoc}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9;">
        <span style="color: #64748b; font-weight: 500;">Perihal Dokumen</span>
        <span style="font-weight: 600; color: #0f172a;">${escTitle}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0;">
        <span style="color: #64748b; font-weight: 500;">Waktu Verifikasi</span>
        <span style="font-weight: 600; color: #0f172a;">${escDate}</span>
      </div>
    </div>

    <div style="text-align: center; font-size: 11.5px; color: #94a3b8; margin-top: auto; padding-top: 16px; line-height: 1.6;">
      <p>Copyright &copy; Bisnis Digital Takumi &bull; Unit Bisnis Mandiri (UBM)</p>
      <p>Tanda tangan digital ini dilindungi oleh Protokol Validasi Sistem UBM Politeknik Takumi.</p>
    </div>
  `;

  // Hook PNG download
  const dlPng = document.getElementById('inline-btn-download-png');
  if (dlPng) {
    dlPng.addEventListener('click', () => {
      const svgEl = document.getElementById('signature-badge-svg');
      if (!svgEl) return;
      const svgXml = new XMLSerializer().serializeToString(svgEl);
      const imgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || window.webkitURL || window;
      const url = URLObj.createObjectURL(imgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1080, 720);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `Approved_by_${cleanName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URLObj.revokeObjectURL(url);
        if (typeof showToast === 'function') showToast('Gambar kartu berhasil diunduh (.png)!');
      };
      img.src = url;
    });
  }

  // Hook Copy link
  const copyBtn = document.getElementById('inline-btn-copy-link');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          if (typeof showToast === 'function') showToast('Tautan verifikasi berhasil disalin!');
          else alert('Tautan verifikasi berhasil disalin!');
        })
        .catch(() => {});
    });
  }
}
