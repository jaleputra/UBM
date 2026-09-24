// =========================================================
// UBM - Universal Business Management System
// Core Application Coordinator & SPA Router
// =========================================================

// Global State
const state = {
  currentView: 'dashboard',
  orders: [],
  quotations: [],
  po: [],
  invoices: [],
  purchasing: [],
  bom: [],
  delivery: [],
  projects: [],
  bast: [],
  project_reports: [],
  service_tickets: [],
  warranty_claims: [],
  maintenance: [],
  activity_logs: [],
  settings: null,
  stats: null,
  searchQuery: ''
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initHotReload();
  initNavigation();
  initSearch();
  startLiveClock();
  loadAllData();
  
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
  if (state.currentView && state.currentView !== viewName && !['bom-form', 'timeline'].includes(state.currentView)) {
    state.previousMainView = state.currentView;
  }
  if (state.currentView && state.currentView !== viewName) {
    state.previousView = state.currentView;
  }
  state.currentView = viewName;
  
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
    projects: { title: 'Project Management', sub: 'Daftar project terdaftar, Project Lead, tim pelaksana & progress pengerjaan', btn: '+ Alokasi Tim & Project' },
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
    case 'projects': openProjectAssignmentWorkspace(); break;
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
  try {
    await Promise.allSettled([
      loadDashboardData(),
      fetchResource('quotations'),
      fetchResource('orders'),
      fetchResource('po'),
      fetchResource('invoices'),
      fetchResource('purchasing'),
      fetchResource('bom'),
      fetchResource('delivery'),
      fetchResource('projects'),
      fetchResource('bast'),
      fetchResource('project_reports'),
      fetchResource('service_tickets'),
      fetchResource('warranty_claims'),
      fetchResource('maintenance'),
      fetchResource('activity_logs'),
      fetchResource('settings')
    ]);
    if (typeof updateAppFooterCopyright === 'function') {
      updateAppFooterCopyright();
    }
    renderCurrentView();
    updateSidebarBadges();
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Gagal memuat data dari server: ' + err.message, 'error');
  }
}

async function fetchResource(resource) {
  try {
    const res = await fetch(`/api/${resource}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (resource === 'settings') {
      state.settings = data;
    } else {
      state[resource] = Array.isArray(data) ? data : [];
    }
    return data;
  } catch (err) {
    console.warn(`[Data Fetch] Gagal mengambil resource ${resource}:`, err.message);
    if (!state[resource]) state[resource] = [];
    return state[resource];
  }
}

function updateSidebarBadges() {
  const badgeLogs = document.getElementById('badge-logs-count');
  if (badgeLogs) badgeLogs.textContent = state.activity_logs?.length || 0;

  const badgeQuotation = document.getElementById('badge-quotation-count');
  if (badgeQuotation) badgeQuotation.textContent = state.quotations?.length || 0;

  const badgeOrder = document.getElementById('badge-order-count');
  if (badgeOrder) badgeOrder.textContent = state.orders?.length || 0;

  const badgeDelivery = document.getElementById('badge-delivery-count');
  if (badgeDelivery) badgeDelivery.textContent = state.delivery?.length || 0;

  const badgeInvoice = document.getElementById('badge-invoice-count');
  if (badgeInvoice) badgeInvoice.textContent = state.invoices?.length || 0;

  const badgePurchasing = document.getElementById('badge-purchasing-count');
  if (badgePurchasing) badgePurchasing.textContent = state.purchasing?.length || 0;

  const badgePO = document.getElementById('badge-po-count');
  if (badgePO) badgePO.textContent = state.po?.length || 0;

  const badgeBOM = document.getElementById('badge-bom-count');
  if (badgeBOM) badgeBOM.textContent = state.bom?.length || 0;

  const badgeProjects = document.getElementById('badge-projects-count');
  if (badgeProjects) badgeProjects.textContent = state.projects?.length || 0;

  const badgeBast = document.getElementById('badge-bast-count');
  if (badgeBast) {
    const completedProjectsCount = (state.projects || []).filter(p => {
      const orderExists = (state.orders || []).some(o => o.id === p.orderId);
      return orderExists && p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed');
    }).length;
    badgeBast.textContent = completedProjectsCount;
  }

  const badgeReports = document.getElementById('badge-project-reports-count');
  if (badgeReports) {
    const completedCount = (state.projects || []).filter(p => {
      const orderExists = (state.orders || []).some(o => o.id === p.orderId || o.id === p.id);
      return orderExists && (p.status === 'Completed' || p.progressPercent === 100 || (p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed')));
    }).length;
    badgeReports.textContent = completedCount;
  }

  const badgeService = document.getElementById('badge-service-count');
  if (badgeService) {
    const completedWithWarranty = (state.projects || []).filter(p => {
      const orderExists = (state.orders || []).some(o => o.id === p.orderId || o.id === p.id);
      return orderExists && (p.status === 'Completed' || p.progressPercent === 100 || (p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed')));
    }).length;
    badgeService.textContent = completedWithWarranty;
  }

  const badgeMaintenance = document.getElementById('badge-maintenance-count');
  if (badgeMaintenance) {
    const completedCount = (state.projects || []).filter(p => {
      const orderExists = (state.orders || []).some(o => o.id === p.orderId || o.id === p.id);
      return orderExists && (p.status === 'Completed' || p.progressPercent === 100 || (p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed')));
    }).length;
    badgeMaintenance.textContent = completedCount;
  }

  const badgeFinance = document.getElementById('badge-finance-count');
  if (badgeFinance) {
    const completedCount = (state.projects || []).filter(p => {
      const orderExists = (state.orders || []).some(o => o.id === p.orderId || o.id === p.id);
      return orderExists && (p.status === 'Completed' || p.progressPercent === 100 || (p.milestones && p.milestones.length > 0 && p.milestones.every(m => m.status === 'Completed')));
    }).length;
    badgeFinance.textContent = completedCount || (state.projects || []).length || 0;
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
    case 'invoices': renderInvoicesTable(); break;
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
    case 'finance': if (typeof renderFinanceTable === 'function') renderFinanceTable(); break;
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
        showToast(`⚠️ Request Pengadaan ${id} sudah Disetujui (Terkunci) sehingga tidak dapat dihapus!`, 'warning');
        return;
      }
    }

    if (resource === 'bom' && typeof restoreBOMComponentsStock === 'function') {
      const bomToDelete = (state.bom || []).find(b => b.id === id);
      if (bomToDelete && bomToDelete.status !== 'Ditolak') {
        await restoreBOMComponentsStock(bomToDelete.components);
      }
    }

    const res = await fetch(`/api/${resource}/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast(`Data ${resource.toUpperCase()} ${id} berhasil dihapus`, 'success');
      await fetchResource(resource);
      if (resource === 'bom') {
        await fetchResource('purchasing');
      }
      renderCurrentView();
      updateSidebarBadges();
      loadDashboardData();
    } else {
      showToast('Gagal menghapus data', 'error');
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
