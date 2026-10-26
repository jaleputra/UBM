// =========================================================
// UBM - Dashboard & Gantt Chart Timeline Monitoring Module
// =========================================================

// Helper: Memeriksa apakah order bertipe Jasa / Layanan (Non-BOM)
function isServiceOrder(order) {
  if (!order) return false;
  if (order.orderType === 'jasa' || order.quotationType === 'jasa') return true;
  if (order.quotationId) {
    const quo = (state.quotations || []).find(q => q.id === order.quotationId);
    if (quo && quo.quotationType === 'jasa') return true;
  }
  if (order.notes && (
    order.notes.toLowerCase().includes('[tipe: jasa]') ||
    order.notes.toLowerCase().includes('tipe penawaran: jasa') ||
    order.notes.toLowerCase().includes('(jasa)')
  )) return true;
  return false;
}
window.isServiceOrder = isServiceOrder;

// Helper: Memeriksa apakah project bertipe Jasa
function isProjectService(p) {
  if (!p) return false;
  if (p.projectType === 'jasa' || p.quotationType === 'jasa') return true;
  if (p.orderId) {
    const order = (state.orders || []).find(o => o.id === p.orderId);
    if (order && isServiceOrder(order)) return true;
  }
  if (p.quotationId) {
    const quo = (state.quotations || []).find(q => q.id === p.quotationId);
    if (quo && quo.quotationType === 'jasa') return true;
  }
  if (p.notes && (
    p.notes.toLowerCase().includes('[tipe: jasa]') ||
    p.notes.toLowerCase().includes('tipe penawaran: jasa') ||
    p.notes.toLowerCase().includes('(jasa)')
  )) return true;
  return false;
}
window.isProjectService = isProjectService;

// Segment Switcher: Memisahkan Tampilan Produk & Jasa dalam 1 Halaman Dashboard
function setDashboardSegment(segment) {
  state.dashboardSegment = segment || 'ALL';
  try { localStorage.setItem('ubm_dashboard_segment', state.dashboardSegment); } catch (e) {}

  const btnAll = document.getElementById('btn-dash-segment-all');
  const btnProduct = document.getElementById('btn-dash-segment-product');
  const btnService = document.getElementById('btn-dash-segment-service');
  const secProduct = document.getElementById('dashboard-section-product');
  const secService = document.getElementById('dashboard-section-service');

  const setBtnStyle = (btn, isActive) => {
    if (!btn) return;
    if (isActive) {
      btn.style.background = '#2563eb';
      btn.style.color = '#ffffff';
      btn.style.fontWeight = '700';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#475569';
      btn.style.fontWeight = '600';
    }
  };

  setBtnStyle(btnAll, state.dashboardSegment === 'ALL');
  setBtnStyle(btnProduct, state.dashboardSegment === 'PRODUCT');
  setBtnStyle(btnService, state.dashboardSegment === 'SERVICE');

  if (secProduct) {
    secProduct.style.display = (state.dashboardSegment === 'ALL' || state.dashboardSegment === 'PRODUCT') ? 'block' : 'none';
  }
  if (secService) {
    secService.style.display = (state.dashboardSegment === 'ALL' || state.dashboardSegment === 'SERVICE') ? 'block' : 'none';
  }
}
window.setDashboardSegment = setDashboardSegment;

async function loadDashboardData() {
  try {
    // 1. Pastikan semua dataset terkait sudah tersedia
    const toFetch = [];
    if (!state.orders || state.orders.length === 0) toFetch.push(fetchResource('orders'));
    if (!state.projects || state.projects.length === 0) toFetch.push(fetchResource('projects'));
    if (!state.quotations || state.quotations.length === 0) toFetch.push(fetchResource('quotations'));
    if (!state.bom || state.bom.length === 0) toFetch.push(fetchResource('bom'));
    if (!state.delivery || state.delivery.length === 0) toFetch.push(fetchResource('delivery'));
    if (!state.service_expenses || state.service_expenses.length === 0) toFetch.push(fetchResource('service_expenses'));
    if (!state.activity_logs || state.activity_logs.length === 0) toFetch.push(fetchResource('activity_logs'));
    if (toFetch.length > 0) {
      await Promise.allSettled(toFetch);
    }

    try {
      const res = await fetch(`/api/stats?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        state.stats = await res.json();
      }
    } catch (e) {
      // Abaikan jika offline / direct Supabase
    }

    // 2. Kalkulasi Metrik DASHBOARD PRODUK MANUFAKTUR
    const productQuos = (state.quotations || []).filter(q => q.quotationType !== 'jasa');
    const productQuoTotalVal = productQuos.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);

    const productOrders = (state.orders || []).filter(o => !isServiceOrder(o));
    const productOrderTotalVal = productOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
    const productActiveOrdersCount = productOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;

    const bomCount = (state.bom || []).length;
    const bomAcceptedCount = (state.bom || []).filter(b => b.status === 'Accepted').length;

    const deliveryCount = (state.delivery || []).length;
    const deliveryActiveCount = (state.delivery || []).filter(d => d.status !== 'Delivered' && d.status !== 'Selesai').length;

    // Update Elemen KPI Produk
    const elProdQuoVal = document.getElementById('kpi-product-quotations-val');
    const elProdQuoAmt = document.getElementById('kpi-product-quotations-amount');
    if (elProdQuoVal) elProdQuoVal.textContent = `${productQuos.length} Penawaran`;
    if (elProdQuoAmt) elProdQuoAmt.textContent = formatRupiah(productQuoTotalVal);

    const elProdOrdVal = document.getElementById('kpi-product-orders-val');
    const elProdOrdAmt = document.getElementById('kpi-product-orders-amount');
    if (elProdOrdVal) elProdOrdVal.textContent = `${productOrders.length} Order`;
    if (elProdOrdAmt) elProdOrdAmt.textContent = formatRupiah(productOrderTotalVal);

    const elProdBomVal = document.getElementById('kpi-product-bom-val');
    const elProdBomSub = document.getElementById('kpi-product-bom-sub');
    if (elProdBomVal) elProdBomVal.textContent = `${bomCount} Formula`;
    if (elProdBomSub) elProdBomSub.textContent = `${bomAcceptedCount} Disetujui (Accepted)`;

    const elProdDelVal = document.getElementById('kpi-product-delivery-val');
    const elProdDelSub = document.getElementById('kpi-product-delivery-sub');
    if (elProdDelVal) elProdDelVal.textContent = `${deliveryCount} Pengiriman`;
    if (elProdDelSub) elProdDelSub.textContent = `${deliveryActiveCount} Pengiriman Aktif`;

    const elProdOrdBadge = document.getElementById('dashboard-product-orders-badge');
    if (elProdOrdBadge) elProdOrdBadge.textContent = `${productActiveOrdersCount} Order Produk Aktif`;

    const elProdOrdCountText = document.getElementById('table-product-orders-count-text');
    if (elProdOrdCountText) elProdOrdCountText.textContent = `${productOrders.length} Pesanan Produk`;

    // 3. Kalkulasi Metrik DASHBOARD LAYANAN JASA
    const serviceQuos = (state.quotations || []).filter(q => q.quotationType === 'jasa');
    const serviceQuoTotalVal = serviceQuos.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);

    const serviceOrders = (state.orders || []).filter(o => isServiceOrder(o));
    const serviceOrderTotalVal = serviceOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

    const serviceExpenses = state.service_expenses || [];
    const serviceExpenseTotalAmount = serviceExpenses.reduce((sum, e) => {
      const tot = Number(e.totalAmount) || ((Number(e.transportAmount) || 0) + (Number(e.mealAmount) || 0));
      return sum + tot;
    }, 0);

    const serviceDisbursedTotal = serviceExpenses.filter(e => e.status === 'Dicairkan').reduce((sum, e) => {
      const tot = Number(e.totalAmount) || ((Number(e.transportAmount) || 0) + (Number(e.mealAmount) || 0));
      return sum + tot;
    }, 0);

    const servicePendingCount = serviceExpenses.filter(e => e.status !== 'Dicairkan' && e.status !== 'Ditolak').length;

    // Update Elemen KPI Jasa
    const elSvcQuoVal = document.getElementById('kpi-service-quotations-val');
    const elSvcQuoAmt = document.getElementById('kpi-service-quotations-amount');
    if (elSvcQuoVal) elSvcQuoVal.textContent = `${serviceQuos.length} Penawaran`;
    if (elSvcQuoAmt) elSvcQuoAmt.textContent = formatRupiah(serviceQuoTotalVal);

    const elSvcOrdVal = document.getElementById('kpi-service-orders-val');
    const elSvcOrdAmt = document.getElementById('kpi-service-orders-amount');
    if (elSvcOrdVal) elSvcOrdVal.textContent = `${serviceOrders.length} Order Jasa`;
    if (elSvcOrdAmt) elSvcOrdAmt.textContent = formatRupiah(serviceOrderTotalVal);

    const elSvcExpTotalVal = document.getElementById('kpi-service-expenses-total-val');
    const elSvcExpCountSub = document.getElementById('kpi-service-expenses-count-sub');
    if (elSvcExpTotalVal) elSvcExpTotalVal.textContent = formatRupiah(serviceExpenseTotalAmount);
    if (elSvcExpCountSub) elSvcExpCountSub.textContent = `${serviceExpenses.length} Pengajuan Biaya`;

    const elSvcDisbursedVal = document.getElementById('kpi-service-disbursed-val');
    const elSvcPendingSub = document.getElementById('kpi-service-pending-sub');
    if (elSvcDisbursedVal) elSvcDisbursedVal.textContent = formatRupiah(serviceDisbursedTotal);
    if (elSvcPendingSub) elSvcPendingSub.textContent = `${servicePendingCount} Menunggu Pencairan`;

    const elSvcOrdCountText = document.getElementById('table-service-orders-count-text');
    if (elSvcOrdCountText) elSvcOrdCountText.textContent = `${serviceOrders.length} Pesanan Jasa`;

    // 4. Backward Compatibility untuk KPI lama jika ada
    const summary = state.stats?.summary || {};
    const kpiQuotationsVal = document.getElementById('kpi-quotations-val');
    const kpiQuotationsAmount = document.getElementById('kpi-quotations-amount');
    if (kpiQuotationsVal) kpiQuotationsVal.textContent = `${summary.totalQuotations || (state.quotations?.length || 0)} Penawaran`;
    if (kpiQuotationsAmount) kpiQuotationsAmount.textContent = formatRupiah(summary.totalQuotationValue || (productQuoTotalVal + serviceQuoTotalVal));

    const kpiOrdersVal = document.getElementById('kpi-orders-val');
    const kpiOrdersAmount = document.getElementById('kpi-orders-amount');
    if (kpiOrdersVal) kpiOrdersVal.textContent = `${summary.totalOrders || (state.orders?.length || 0)} Order`;
    if (kpiOrdersAmount) kpiOrdersAmount.textContent = formatRupiah(summary.totalOrderValue || (productOrderTotalVal + serviceOrderTotalVal));

    // 5. Render Tables (Produk Manufaktur & Layanan Jasa)
    renderDashboardGanttChart();
    renderDashboardServiceTable();

    // 6. Render Gantt Chart Project Berjalan
    renderDashboardProjectGantt();

    // 7. Terapkan segmen preferensi pengguna
    const savedSegment = localStorage.getItem('ubm_dashboard_segment') || 'ALL';
    setDashboardSegment(savedSegment);

    // 8. Selalu default tab Project (Gantt Chart Berjalan) saat dashboard pertama kali dibuka
    try { localStorage.removeItem('ubm_dashboard_active_tab'); } catch (e) {}
    switchDashboardTab('project');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

// -------------------------------------------------------------
// DASHBOARD SEARCH FILTER HANDLERS
// -------------------------------------------------------------
function onDashboardSearchInput(val) {
  state.searchQuery = (val || '').trim();
  const globalSearch = document.getElementById('global-search');
  if (globalSearch && globalSearch.value !== val) {
    globalSearch.value = val;
  }
  const clearBtn = document.getElementById('dashboard-search-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = val && val.trim().length > 0 ? 'inline-flex' : 'none';
  }
  renderDashboardGanttChart();
  renderDashboardServiceTable();
}

function clearDashboardSearch() {
  state.searchQuery = '';
  const input = document.getElementById('dashboard-search-input');
  if (input) input.value = '';
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) globalSearch.value = '';
  const clearBtn = document.getElementById('dashboard-search-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderDashboardGanttChart();
  renderDashboardServiceTable();
  if (input) input.focus();
}

// -------------------------------------------------------------
// GANTT CHART & PROJECT TIMELINE MONITORING TABLE RENDERER
// (KHUSUS PRODUK MANUFAKTUR & PROJECT FABRIKASI)
// -------------------------------------------------------------
function renderDashboardGanttChart() {
  const tbody = document.getElementById('gantt-chart-table-body');
  if (!tbody) return;

  // Saring: HANYA produk manufaktur & non-jasa
  const orders = (state.orders || []).filter(o => !isServiceOrder(o));
  const projects = (state.projects || []).filter(p => !isProjectService(p));
  const todayStr = new Date().toISOString().split('T')[0];

  let totalCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let overdueCount = 0;
  let holdCount = 0;

  // Process all project items (both Orders and Direct Projects)
  const processedItems = [];
  const processedOrderIds = new Set();

  orders.forEach(order => {
    processedOrderIds.add(order.id);
    const project = projects.find(p => p.orderId === order.id);
    const firstItemName = order.items?.[0]?.itemName || 'Produk Pesanan';
    const startDate = project?.startDate || order.orderDate || '-';
    const dueDate = project?.dueDate || order.dueDate || '';

    // Milestones summary & timeline check
    const milestones = project?.milestones || [];
    const totalMs = milestones.length;
    const completedMs = milestones.filter(m => m.status === 'Completed').length;
    const inProgressMs = milestones.filter(m => m.status === 'In Progress').length;
    const overdueTasksCount = milestones.filter(m => m.dueDate && m.dueDate < todayStr && m.status !== 'Completed').length;
    const hasTimeline = totalMs > 0;

    // Calculate Progress %
    let progress = 0;
    if (hasTimeline) {
      if (typeof project?.progressPercent === 'number' && project.progressPercent > 0) {
        progress = project.progressPercent;
      } else {
        progress = Math.min(100, Math.round(((completedMs + (inProgressMs * 0.5)) / totalMs) * 100));
      }
    } else {
      progress = 0;
    }

    // Determine Schedule Health & Overdue status
    let healthKey = 'PENDING';
    let healthLabel = 'Pending (Belum Mulai)';
    let healthBadge = 'badge-secondary';
    let healthIcon = 'pause-circle';

    const isCompleted = hasTimeline && (progress >= 100 || project?.status === 'Completed' || order.status === 'Delivered');
    const isOnHold = project?.status === 'On Hold' || (project?.notes && project.notes.toLowerCase().includes('kendala'));
    const isOverdue = hasTimeline && dueDate && dueDate < todayStr && !isCompleted;
    const isStarted = hasTimeline && (inProgressMs > 0 || completedMs > 0 || project?.status === 'In Progress' || progress > 0);

    if (isCompleted) {
      healthKey = 'COMPLETED';
      healthLabel = 'Completed';
      healthBadge = 'badge-success';
      healthIcon = 'check-circle';
      completedCount++;
    } else if (isOnHold) {
      healthKey = 'ON_HOLD';
      healthLabel = 'Ada Kendala / Hold';
      healthBadge = 'badge-amber';
      healthIcon = 'alert-triangle';
      holdCount++;
      inProgressCount++;
    } else if (isOverdue) {
      healthKey = 'OVERDUE';
      healthLabel = 'Overdue / Lewat Jadwal';
      healthBadge = 'badge-danger';
      healthIcon = 'clock';
      overdueCount++;
      inProgressCount++;
    } else if (isStarted) {
      healthKey = 'IN_PROGRESS';
      healthLabel = 'On Track (Berjalan)';
      healthBadge = 'badge-purple';
      healthIcon = 'play-circle';
      inProgressCount++;
    } else {
      healthKey = 'PENDING';
      healthLabel = 'Pending (Belum Mulai)';
      healthBadge = 'badge-secondary';
      healthIcon = 'clock';
    }

    totalCount++;

    // Calculate days remaining or days late
    let diffDays = 0;
    let overdueDays = 0;
    let daysLabel = '';
    if (dueDate) {
      const diffMs = new Date(dueDate).getTime() - new Date(todayStr).getTime();
      diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      overdueDays = diffDays < 0 ? Math.abs(diffDays) : 0;

      if (isCompleted) {
        daysLabel = `<span class="badge badge-success" style="font-size: 10px; padding: 2px 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check" style="width: 10px; height: 10px;"></i> 0 Overdue (Selesai)</span>`;
      } else if (overdueDays > 0) {
        daysLabel = `<span class="badge badge-danger" style="font-size: 10px; padding: 2px 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="alert-circle" style="width: 10px; height: 10px;"></i> Overdue ${overdueDays} Hari</span>`;
      } else if (diffDays === 0) {
        daysLabel = `<span class="badge badge-amber" style="font-size: 10px; padding: 2px 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="clock" style="width: 10px; height: 10px;"></i> Deadline Hari Ini</span>`;
      } else {
        daysLabel = `<span class="badge badge-info" style="font-size: 10px; padding: 2px 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="clock" style="width: 10px; height: 10px;"></i> 0 Overdue (Sisa ${diffDays} hari)</span>`;
      }
    } else {
      daysLabel = '<span class="text-muted font-sm">-</span>';
    }

    const projectName = order.projectName || project?.projectName || firstItemName;

    processedItems.push({
      order,
      project,
      projectName,
      firstItemName,
      startDate,
      dueDate,
      diffDays,
      overdueDays,
      daysLabel,
      progress,
      isCompleted,
      healthKey,
      healthLabel,
      healthBadge,
      healthIcon,
      teamCount: project?.team?.length || 0,
      projectLead: project?.projectLead || 'Belum diassign',
      completedMs,
      inProgressMs,
      totalMs,
      overdueTasksCount,
      hasInProgressMilestone: (inProgressMs > 0 || completedMs > 0),
      isDirect: false
    });
  });

  // Direct Projects (seperti Training Center yang dibuat mandiri di Project Management)
  projects.forEach(project => {
    if (project.isDirect || !project.orderId || !processedOrderIds.has(project.orderId)) {
      const mockOrder = {
        id: project.id,
        customerName: project.customerName || 'Internal UBM',
        customerPhone: '',
        orderDate: project.startDate || todayStr,
        dueDate: project.dueDate || '',
        projectName: project.projectName || 'Project Mandiri',
        status: project.status || 'In Progress',
        grandTotal: 0,
        isDirect: true
      };

      const startDate = project.startDate || '-';
      const dueDate = project.dueDate || '';
      const milestones = project.milestones || [];
      const totalMs = milestones.length;
      const completedMs = milestones.filter(m => m.status === 'Completed').length;
      const inProgressMs = milestones.filter(m => m.status === 'In Progress').length;
      const overdueTasksCount = milestones.filter(m => m.dueDate && m.dueDate < todayStr && m.status !== 'Completed').length;
      const hasTimeline = totalMs > 0;

      let progress = 0;
      if (hasTimeline) {
        if (typeof project.progressPercent === 'number' && project.progressPercent > 0) {
          progress = project.progressPercent;
        } else {
          progress = Math.min(100, Math.round(((completedMs + (inProgressMs * 0.5)) / totalMs) * 100));
        }
      }

      let healthKey = 'PENDING';
      let healthLabel = 'Pending (Belum Mulai)';
      let healthBadge = 'badge-secondary';
      let healthIcon = 'pause-circle';

      const isCompleted = hasTimeline && (progress >= 100 || project.status === 'Completed');
      const isOnHold = project.status === 'On Hold' || (project.notes && project.notes.toLowerCase().includes('kendala'));
      const isOverdue = hasTimeline && dueDate && dueDate < todayStr && !isCompleted;
      const isStarted = hasTimeline && (inProgressMs > 0 || completedMs > 0 || project.status === 'In Progress' || progress > 0);

      if (isCompleted) {
        healthKey = 'COMPLETED';
        healthLabel = 'Completed';
        healthBadge = 'badge-success';
        healthIcon = 'check-circle';
        completedCount++;
      } else if (isOnHold) {
        healthKey = 'ON_HOLD';
        healthLabel = 'Ada Kendala / Hold';
        healthBadge = 'badge-amber';
        healthIcon = 'alert-triangle';
        holdCount++;
        inProgressCount++;
      } else if (isOverdue) {
        healthKey = 'OVERDUE';
        healthLabel = 'Overdue / Lewat Jadwal';
        healthBadge = 'badge-danger';
        healthIcon = 'clock';
        overdueCount++;
        inProgressCount++;
      } else if (isStarted) {
        healthKey = 'IN_PROGRESS';
        healthLabel = 'On Track (Berjalan)';
        healthBadge = 'badge-purple';
        healthIcon = 'play-circle';
        inProgressCount++;
      } else {
        healthKey = 'PENDING';
        healthLabel = 'Pending (Belum Mulai)';
        healthBadge = 'badge-secondary';
        healthIcon = 'clock';
      }

      totalCount++;

      let diffDays = 0;
      let overdueDays = 0;
      let daysLabel = '';
      if (dueDate) {
        const diffMs = new Date(dueDate).getTime() - new Date(todayStr).getTime();
        diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        overdueDays = diffDays < 0 ? Math.abs(diffDays) : 0;

        if (isCompleted) {
          daysLabel = `<span class="badge badge-success" style="font-size: 10px; padding: 2px 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check" style="width: 10px; height: 10px;"></i> 0 Overdue (Selesai)</span>`;
        } else if (overdueDays > 0) {
          daysLabel = `<span class="badge badge-danger" style="font-size: 10px; padding: 2px 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="alert-circle" style="width: 10px; height: 10px;"></i> Overdue ${overdueDays} Hari</span>`;
        } else if (diffDays === 0) {
          daysLabel = `<span class="badge badge-amber" style="font-size: 10px; padding: 2px 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="clock" style="width: 10px; height: 10px;"></i> Deadline Hari Ini</span>`;
        } else {
          daysLabel = `<span class="badge badge-info" style="font-size: 10px; padding: 2px 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="clock" style="width: 10px; height: 10px;"></i> 0 Overdue (Sisa ${diffDays} hari)</span>`;
        }
      } else {
        daysLabel = '<span class="text-muted font-sm">-</span>';
      }

      processedItems.push({
        order: mockOrder,
        project,
        projectName: project.projectName || 'Project Mandiri',
        firstItemName: project.projectName || 'Direct Project',
        startDate,
        dueDate,
        diffDays,
        overdueDays,
        daysLabel,
        progress,
        isCompleted,
        healthKey,
        healthLabel,
        healthBadge,
        healthIcon,
        teamCount: project.team?.length || 0,
        projectLead: project.projectLead || 'Belum diassign',
        completedMs,
        inProgressMs,
        totalMs,
        overdueTasksCount,
        hasInProgressMilestone: (inProgressMs > 0 || completedMs > 0),
        isDirect: true
      });
    }
  });

  // Update Project Summary KPI Cards
  const overduePercent = totalCount > 0 ? Math.round((overdueCount / totalCount) * 100) : 0;
  
  const elProjInprogressVal = document.getElementById('kpi-proj-inprogress-val');
  const elProjInprogressSub = document.getElementById('kpi-proj-inprogress-sub');
  if (elProjInprogressVal) elProjInprogressVal.textContent = `${inProgressCount} Project`;
  if (elProjInprogressSub) elProjInprogressSub.textContent = inProgressCount > 0 ? `${inProgressCount} Project Sedang Berjalan` : 'Tidak Ada Project Berjalan';

  const elProjCompletedVal = document.getElementById('kpi-proj-completed-val');
  const elProjCompletedSub = document.getElementById('kpi-proj-completed-sub');
  if (elProjCompletedVal) elProjCompletedVal.textContent = `${completedCount} Project`;
  if (elProjCompletedSub) elProjCompletedSub.textContent = totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% dari Total Project` : 'Selesai 100%';

  const elProjOverdueVal = document.getElementById('kpi-proj-overdue-val');
  const elProjOverdueSub = document.getElementById('kpi-proj-overdue-sub');
  if (elProjOverdueVal) elProjOverdueVal.textContent = `${overduePercent}%`;
  if (elProjOverdueSub) elProjOverdueSub.textContent = `${overdueCount} dari ${totalCount} Project Lewat Deadline`;

  // Sort chronologically (ascending) so new projects appear at the bottom
  processedItems.sort((a, b) => {
    const dateA = a.order.orderDate || a.order.createdAt || '';
    const dateB = b.order.orderDate || b.order.createdAt || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.order.id || '').localeCompare(b.order.id || '');
  });

  // Search filter (Mendukung input global search di header maupun input di dashboard)
  const searchInput = document.getElementById('dashboard-search-input');
  const globalSearch = document.getElementById('global-search');
  const rawQuery = (state.searchQuery || searchInput?.value || globalSearch?.value || '').trim();
  const query = rawQuery.toLowerCase();
  const resultHint = document.getElementById('dashboard-search-result-hint');

  let displayItems = processedItems;
  const isSearchActive = query.length > 0;

  if (isSearchActive) {
    displayItems = processedItems.filter(item => {
      const id = (item.order.id || '').toLowerCase();
      const custName = (item.order.customerName || '').toLowerCase();
      const custPhone = (item.order.customerPhone || '').toLowerCase();
      const projName = (item.projectName || '').toLowerCase();
      const firstItem = (item.firstItemName || '').toLowerCase();
      const lead = (item.projectLead || '').toLowerCase();
      const start = (item.startDate || '').toLowerCase();
      const due = (item.dueDate || '').toLowerCase();
      const status = (item.healthLabel || '').toLowerCase();

      return id.includes(query) ||
             custName.includes(query) ||
             custPhone.includes(query) ||
             projName.includes(query) ||
             firstItem.includes(query) ||
             lead.includes(query) ||
             start.includes(query) ||
             due.includes(query) ||
             status.includes(query);
    });
  }

  // Update Result Hint Info
  if (resultHint) {
    if (isSearchActive) {
      resultHint.innerHTML = `Ditemukan <strong>${displayItems.length}</strong> dari <strong>${processedItems.length}</strong> project untuk "<em>${escapeHtml(rawQuery)}</em>"`;
    } else {
      resultHint.innerHTML = `Total <strong>${processedItems.length}</strong> project terdaftar`;
    }
  }

  if (displayItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted" style="padding: 28px;">
          ${isSearchActive 
            ? `Tidak ada data project yang sesuai dengan pencarian "<strong>${escapeHtml(rawQuery)}</strong>".` 
            : 'Belum ada data project order penjualan.'}
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Render Table Rows (10 Kolom Terpisah untuk Jadwal Keseluruhan & Overdue Milestone)
  tbody.innerHTML = displayItems.map((item, idx) => {
    return `
      <tr>
        <td style="vertical-align: middle; text-align: center;">
          <span style="font-weight: 700; color: #64748b; font-size: 11.5px;">${idx + 1}</span>
        </td>
        <td style="vertical-align: middle;">
          ${item.isDirect 
            ? `<span class="mono-id font-bold" style="font-size: 11px; background: rgba(79, 70, 229, 0.1); color: #4338ca; padding: 2px 6px; border-radius: 4px;">${escapeHtml(item.order.id)}</span><div style="font-size: 9.5px; color: #6366f1; font-weight: 700; margin-top: 2px;">DIRECT PROJECT</div>`
            : `<span class="mono-id font-bold text-primary" style="font-size: 11.5px;">${escapeHtml(item.order.id)}</span>`}
        </td>
        <td style="vertical-align: middle;">
          <div class="font-bold text-main" style="font-size: 12.5px;">${escapeHtml(item.order.customerName)}</div>
          ${item.order.customerPhone ? `<div class="text-muted font-sm" style="font-size: 11px; margin-top: 1px;">📞 ${escapeHtml(item.order.customerPhone)}</div>` : (item.isDirect ? '<div class="text-muted font-sm" style="font-size: 10.5px; margin-top: 1px;">Project Mandiri / Internal</div>' : '')}
        </td>
        <td style="vertical-align: middle;">
          <div class="font-bold text-main" style="font-size: 12.5px; color: #1e40af; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="folder-kanban" style="width: 14px; height: 14px; color: #4f46e5; flex-shrink: 0;"></i>
            <span>${escapeHtml(item.projectName)}</span>
          </div>
        </td>
        <td style="vertical-align: middle;">
          <div class="font-medium text-main" style="font-size: 12px;">${escapeHtml(item.projectLead)}</div>
          ${item.teamCount > 0 ? `<div class="text-muted font-sm" style="font-size: 11px;">+${item.teamCount} anggota tim</div>` : ''}
        </td>
        <td style="vertical-align: middle;">
          <div style="font-size: 11.5px; color: #1e293b; font-weight: 600;">
            <span>${item.startDate} &rarr; <strong>${item.dueDate || '-'}</strong></span>
          </div>
          ${!item.isCompleted && item.dueDate ? `
            <div style="margin-top: 3px;">
              ${item.overdueDays > 0
                ? `<span class="text-danger font-bold font-sm">Lewat ${item.overdueDays} hari!</span>`
                : item.diffDays === 0
                  ? `<span class="text-danger font-bold font-sm">Deadline Hari Ini</span>`
                  : `<span class="text-muted font-sm">Sisa ${item.diffDays} hari</span>`
              }
            </div>
          ` : ''}
        </td>
        <td style="vertical-align: middle; text-align: center;">
          ${item.isCompleted
            ? `<span class="badge badge-success" style="font-size: 10px; padding: 2px 7px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check-check" style="width: 10px; height: 10px;"></i> 0 Overdue</span><div class="text-muted" style="font-size: 9.5px; margin-top: 2px;">Tuntas</div>`
            : item.overdueTasksCount > 0
              ? `<span class="badge badge-danger" style="font-size: 10px; padding: 2px 7px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="alert-triangle" style="width: 10px; height: 10px;"></i> ${item.overdueTasksCount} Milestone</span><div style="font-size: 9.5px; color: #dc2626; font-weight: 600; margin-top: 2px;">Lewat Tanggal</div>`
              : `<span class="badge badge-success" style="font-size: 10px; padding: 2px 7px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check" style="width: 10px; height: 10px;"></i> 0 Overdue</span><div class="text-muted" style="font-size: 9.5px; margin-top: 2px;">On Schedule</div>`
          }
        </td>
        <td style="vertical-align: middle;">
          <div style="min-width: 115px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 3px;">
              <span class="font-bold text-primary">${item.progress}%</span>
              <span style="font-size: 10px; font-weight: 700; color: #16a34a; background: #ecfdf4; padding: 1px 5px; border-radius: 4px; border: 1px solid #bbf7d0;">✓ ${item.completedMs}/${item.totalMs}</span>
            </div>
            <div style="height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-bottom: 2px;">
              <div style="width: ${item.progress}%; height: 100%; background: ${item.progress >= 100 ? '#16a34a' : '#4f46e5'}; border-radius: 99px;"></div>
            </div>
            <div style="font-size: 10px; color: #475569;">
              <strong class="text-success">${item.completedMs}</strong> dari <strong>${item.totalMs}</strong> task selesai
            </div>
          </div>
        </td>
        <td style="vertical-align: middle; text-align: center;">
          <span class="badge ${item.healthBadge}" style="font-size: 10px; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="${item.healthIcon}" style="width: 11px; height: 11px;"></i> ${item.healthLabel}
          </span>
        </td>
        <td style="vertical-align: middle; text-align: right;">
          ${item.hasInProgressMilestone ? `
            <button class="btn btn-sm btn-primary" title="Buka Detail Monitoring Timeline & Gantt Chart" style="background: #4f46e5; border-color: #4f46e5; padding: 5px 12px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; white-space: nowrap;" onclick="openGanttDetailModal('${item.project?.id || item.order.id}')">
              <i data-lucide="bar-chart-2" style="width: 13px; height: 13px;"></i> Gantt Chart
            </button>
          ` : `
            <button class="btn btn-sm" title="Gantt Chart belum dapat dibuka karena belum ada milestone yang berstatus 'In Progress'" style="background: #f1f5f9; color: #94a3b8; border: 1px solid #cbd5e1; padding: 5px 12px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; white-space: nowrap; cursor: not-allowed; opacity: 0.65;" onclick="showToast('⚠️ Gantt Chart belum dapat diakses karena belum ada milestone yang berstatus In Progress. Silakan update timeline project terlebih dahulu!', 'warning')">
              <i data-lucide="bar-chart-2" style="width: 13px; height: 13px;"></i> Gantt Chart
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// =========================================================
// TABLE RENDERER: MONITORING SALES ORDER JASA & OPERASIONAL
// =========================================================
function renderDashboardServiceTable() {
  const tbody = document.getElementById('table-dashboard-service-body');
  if (!tbody) return;

  const serviceOrders = (state.orders || []).filter(o => isServiceOrder(o));
  const serviceExpenses = state.service_expenses || [];
  const rawQuery = (state.searchQuery || '').trim().toLowerCase();

  let filtered = serviceOrders;
  if (rawQuery) {
    filtered = serviceOrders.filter(o => {
      const id = (o.id || '').toLowerCase();
      const cust = (o.customerName || '').toLowerCase();
      const phone = (o.customerPhone || '').toLowerCase();
      const proj = (o.projectName || '').toLowerCase();
      const notes = (o.notes || '').toLowerCase();
      const items = (o.items || []).map(i => i.itemName || '').join(' ').toLowerCase();
      return id.includes(rawQuery) || cust.includes(rawQuery) || phone.includes(rawQuery) || proj.includes(rawQuery) || notes.includes(rawQuery) || items.includes(rawQuery);
    });
  }

  const countBadge = document.getElementById('table-service-orders-count-text');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} Pesanan Jasa${rawQuery ? ' (Difilter)' : ''}`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 28px;">
          ${rawQuery ? `Tidak ada pesanan jasa yang cocok dengan pencarian "<strong>${escapeHtml(rawQuery)}</strong>".` : 'Belum ada data Order Penjualan bertipe Jasa.'}
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map((ord, idx) => {
    // Cari apakah ada pengajuan biaya untuk order ini
    const relatedExpenses = serviceExpenses.filter(e => 
      e.orderId === ord.id || 
      (e.customerName && ord.customerName && e.customerName.toLowerCase() === ord.customerName.toLowerCase())
    );

    const totalExpenseClaimed = relatedExpenses.reduce((sum, e) => {
      const tot = Number(e.totalAmount) || ((Number(e.transportAmount) || 0) + (Number(e.mealAmount) || 0));
      return sum + tot;
    }, 0);

    const hasDisbursed = relatedExpenses.some(e => e.status === 'Dicairkan');
    const hasPending = relatedExpenses.some(e => e.status !== 'Dicairkan' && e.status !== 'Ditolak');

    let expenseStatusBadge = `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10px; padding: 2px 7px;">Belum Diajukan</span>`;
    if (relatedExpenses.length > 0) {
      if (hasDisbursed && !hasPending) {
        expenseStatusBadge = `<span class="badge badge-success" style="font-size: 10px; padding: 2px 7px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check-check" style="width: 10px; height: 10px;"></i> Dicairkan</span>`;
      } else if (hasPending) {
        expenseStatusBadge = `<span class="badge badge-amber" style="font-size: 10px; padding: 2px 7px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="clock" style="width: 10px; height: 10px;"></i> Menunggu Cair</span>`;
      } else {
        expenseStatusBadge = `<span class="badge badge-danger" style="font-size: 10px; padding: 2px 7px;">Ditolak</span>`;
      }
    }

    const firstItemName = ord.items?.[0]?.itemName || ord.projectName || 'Layanan Jasa & Servis';
    const technicianName = ord.projectLead || ord.pic || relatedExpenses[0]?.pic || relatedExpenses[0]?.team || 'Tim Teknisi Lapangan';

    return `
      <tr>
        <td style="vertical-align: middle; text-align: center;">
          <span style="font-weight: 700; color: #9a3412; font-size: 11.5px;">${idx + 1}</span>
        </td>
        <td style="vertical-align: middle;">
          <span class="mono-id font-bold" style="font-size: 11px; background: #ffedd5; color: #c2410c; padding: 2px 7px; border-radius: 4px; border: 1px solid #fed7aa;">
            ${escapeHtml(ord.id)}
          </span>
          <div style="font-size: 9.5px; color: #ea580c; font-weight: 700; margin-top: 2px;">ORDER JASA</div>
        </td>
        <td style="vertical-align: middle;">
          <div class="font-bold text-main" style="font-size: 12.5px;">${escapeHtml(ord.customerName || '-')}</div>
          <div style="font-size: 11.5px; color: #475569; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            <i data-lucide="wrench" style="width: 12px; height: 12px; color: #ea580c; flex-shrink: 0;"></i>
            <span>${escapeHtml(firstItemName)}</span>
          </div>
          ${ord.customerPhone ? `<div class="text-muted font-sm" style="font-size: 10.5px; margin-top: 1px;">📞 ${escapeHtml(ord.customerPhone)}</div>` : ''}
        </td>
        <td style="vertical-align: middle;">
          <div class="font-medium text-main" style="font-size: 12px; display: flex; align-items: center; gap: 4px;">
            <i data-lucide="user-check" style="width: 13px; height: 13px; color: #0284c7;"></i>
            <span>${escapeHtml(technicianName)}</span>
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
            Tanggal: ${ord.orderDate || ord.createdAt ? String(ord.orderDate || ord.createdAt).slice(0, 10) : '-'}
          </div>
        </td>
        <td style="vertical-align: middle; text-align: right;">
          <div class="font-mono font-bold" style="font-size: 12.5px; color: #0f172a;">
            ${formatRupiah(ord.grandTotal || 0)}
          </div>
          <div style="font-size: 10px; color: #64748b;">Nilai Tagihan</div>
        </td>
        <td style="vertical-align: middle; text-align: right;">
          <div class="font-mono font-bold" style="font-size: 12.5px; color: #ea580c;">
            ${formatRupiah(totalExpenseClaimed)}
          </div>
          <div style="font-size: 10px; color: #9a3412;">
            ${relatedExpenses.length > 0 ? `${relatedExpenses.length} Form Klaim Diajukan` : 'Belum Ada Klaim'}
          </div>
        </td>
        <td style="vertical-align: middle; text-align: center;">
          ${expenseStatusBadge}
        </td>
        <td style="vertical-align: middle; text-align: right;">
          <button type="button" class="btn btn-xs btn-primary" onclick="openServiceExpenseModal('${ord.id}')" style="background: #ea580c; border-color: #ea580c; padding: 4px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; white-space: nowrap;">
            <i data-lucide="plus-circle" style="width: 12px; height: 12px;"></i> + Ajukan Biaya
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}
window.renderDashboardServiceTable = renderDashboardServiceTable;

// -------------------------------------------------------------
function openGanttDetailModal(orderOrProjId) {
  const project = (state.projects || []).find(p => p.id === orderOrProjId || p.orderId === orderOrProjId);
  const order = (state.orders || []).find(o => o.id === orderOrProjId || (project && o.id === project.orderId));
  const isDirect = Boolean(project?.isDirect || (!order && project));

  if (!project && !order) return;

  // Jika merupakan order penjualan, validasi PO Pelanggan, Project Lead, dan BOM
  if (!isDirect && order) {
    const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
    const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
    if (!isPOAndAccepted) {
      if (typeof promptPenugasanDisabled === 'function') {
        promptPenugasanDisabled(order.id);
      } else {
        showToast('⚠️ Wajib upload PO Pelanggan dan status Accepted terlebih dahulu!', 'warning');
      }
      return;
    }

    const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
    if (!hasProjectLead) {
      showToast('⚠️ Tentukan Project Leader pada menu Penugasan Tim terlebih dahulu!', 'warning');
      if (typeof openTeamAssignmentPage === 'function') {
        openTeamAssignmentPage(order.id);
      }
      return;
    }

    const hasBOM = (state.bom || []).some(b => b.orderId === order.id || (order.items || []).some(item => b.productName && item.itemName && b.productName.toLowerCase().trim() === item.itemName.toLowerCase().trim()));
    if (!hasBOM) {
      showToast('⚠️ Bill of Materials (BOM) belum diisi untuk order ini. Silakan isi dan simpan BOM terlebih dahulu sebelum membuat Project Management!', 'warning');
      if (typeof createBOMFromOrder === 'function') {
        createBOMFromOrder(order.id);
      }
      return;
    }
  }

  const milestones = project?.milestones || [];
  const inProgressMs = milestones.filter(m => m.status === 'In Progress' || m.status === 'in_progress').length;
  const completedMs = milestones.filter(m => m.status === 'Completed' || m.status === 'completed').length;
  const hasInProgressMilestone = (inProgressMs > 0 || completedMs > 0);

  if (!hasInProgressMilestone) {
    showToast('⚠️ Gantt Chart belum dapat dibuka karena belum ada milestone yang berstatus "In Progress" pada timeline project!', 'warning');
    return;
  }

  const projectName = project?.projectName || order?.projectName || order?.items?.[0]?.itemName || 'Project Pesanan';
  const customerName = project?.customerName || order?.customerName || (isDirect ? 'Internal UBM' : '-');
  const startDate = project?.startDate || order?.orderDate || '-';
  const dueDate = project?.dueDate || order?.dueDate || '-';
  const todayStr = new Date().toISOString().split('T')[0];

  // Header updates
  const orderIdTitle = document.getElementById('gantt-modal-order-id');
  if (orderIdTitle) {
    orderIdTitle.textContent = `${project?.id || order?.id} - ${customerName}`;
  }

  const subtitle = document.getElementById('gantt-modal-subtitle');
  if (subtitle) {
    subtitle.textContent = `Project: ${projectName} | Pelanggan / Entitas: ${customerName}`;
  }

  const editBtn = document.getElementById('gantt-modal-edit-btn');
  if (editBtn) {
    editBtn.onclick = () => {
      closeModal('gantt-detail-modal');
      if (isDirect && project) {
        if (typeof openProjectTimelinePage === 'function') {
          openProjectTimelinePage(project.id);
        } else {
          navigateTo('projects');
        }
      } else if (order) {
        openProjectManagementPage(order.id);
      }
    };
  }

  // Calculate Progress & Health Status
  const hasTimeline = Boolean(project && milestones && milestones.length > 0);
  const completedCount = milestones.filter(m => m.status === 'Completed').length;
  const inProgressCount = milestones.filter(m => m.status === 'In Progress').length;
  const totalCount = milestones.length;

  let progress = 0;
  if (hasTimeline) {
    if (typeof project?.progressPercent === 'number' && project.progressPercent > 0) {
      progress = project.progressPercent;
    } else {
      progress = Math.min(100, Math.round(((completedCount + (inProgressCount * 0.5)) / totalCount) * 100));
    }
  } else {
    progress = 0;
  }

  const isCompleted = hasTimeline && (progress >= 100 || project?.status === 'Completed' || (order && order.status === 'Delivered'));
  const isOnHold = project?.status === 'On Hold' || (project?.notes && project.notes.toLowerCase().includes('kendala'));
  const isOverdue = hasTimeline && dueDate !== '-' && dueDate < todayStr && !isCompleted;
  const isStarted = hasTimeline && (inProgressCount > 0 || completedCount > 0 || progress > 0);

  let healthBadge = isCompleted ? 'badge-success' :
                    isOnHold ? 'badge-amber' :
                    isOverdue ? 'badge-danger' :
                    isStarted ? 'badge-purple' : 'badge-secondary';

  let healthText = isCompleted ? 'Completed (Selesai)' :
                   isOnHold ? 'Ada Kendala / Hold' :
                   isOverdue ? 'Overdue (Lewat Jadwal)' :
                   isStarted ? 'On Track (In Progress)' : 'Pending (Belum Mulai)';

  // Metadata Strip
  const metaContainer = document.getElementById('gantt-modal-meta');
  if (metaContainer) {
    const nilaiOrderHtml = order?.grandTotal ? formatRupiah(order.grandTotal) : (isDirect ? 'Direct / Non-Sales' : '-');
    metaContainer.innerHTML = `
      <div>
        <div class="text-muted font-sm" style="font-size: 11px;">Project Lead / PIC:</div>
        <div class="font-bold text-main" style="font-size: 13px;">${project?.projectLead || 'Belum diassign'}</div>
        <div class="text-muted" style="font-size: 11px;">${project?.department || 'Engineering'}</div>
      </div>
      <div>
        <div class="text-muted font-sm" style="font-size: 11px;">Timeline Project:</div>
        <div class="font-bold text-main" style="font-size: 13px;">${startDate} &rarr; ${dueDate}</div>
        <div class="text-muted" style="font-size: 11px;">Nilai Order: <strong>${nilaiOrderHtml}</strong></div>
      </div>
      <div>
        <div class="text-muted font-sm" style="font-size: 11px;">Status Kesehatan Jadwal:</div>
        <div><span class="badge ${healthBadge}" style="font-size: 11.5px; font-weight: 700;">${healthText}</span></div>
      </div>
      <div>
        <div class="text-muted font-sm" style="font-size: 11px;">Tim Pelaksana:</div>
        <div class="font-bold text-main" style="font-size: 13px;">${project?.team?.length || 0} Orang Terdaftar</div>
      </div>
    `;
  }

  const progressText = document.getElementById('gantt-modal-progress-text');
  if (progressText) progressText.textContent = `${progress}% Selesai`;

  // Render Milestones Gantt Chart Bars
  const contentContainer = document.getElementById('gantt-modal-chart-content');
  if (contentContainer) {
    const milestones = project?.milestones || [];
    if (milestones.length === 0) {
      contentContainer.innerHTML = '<div class="text-center text-muted" style="padding: 24px; font-size: 13px;">Belum ada milestone tahapan pengerjaan yang diinput pada project ini.</div>';
    } else {
      contentContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${milestones.map((ms, idx) => {
            const msStatus = ms.status || 'Pending';
            const msBadgeClass = msStatus === 'Completed' ? 'badge-success' :
                                  msStatus === 'In Progress' ? 'badge-purple' : 'badge-secondary';
            
            const msColor = msStatus === 'Completed' ? '#10b981' :
                            msStatus === 'In Progress' ? '#6366f1' : '#cbd5e1';

            const msPercent = msStatus === 'Completed' ? 100 :
                              msStatus === 'In Progress' ? 55 : 0;

            const msStart = ms.startDate || startDate || '-';
            const msEnd = ms.dueDate || dueDate || '-';

            return `
              <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: #e2e8f0; color: #334155; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">${idx + 1}</span>
                    <div>
                      <div class="font-bold text-main" style="font-size: 13px;">${ms.title}</div>
                      <div class="text-muted" style="font-size: 11px;">PIC: <strong>${ms.pic || 'Belum diisi'}</strong> &bull; Jadwal: <span class="font-mono">${msStart}</span> s/d <span class="font-mono">${msEnd}</span></div>
                    </div>
                  </div>
                  <div>
                    <span class="badge ${msBadgeClass}" style="font-weight: 700; font-size: 11px;">${msStatus}</span>
                  </div>
                </div>

                <!-- Visual Horizontal Gantt Bar for this Milestone -->
                <div style="width: 100%; height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; position: relative;">
                  <div style="width: ${msPercent}%; height: 100%; background: ${msColor}; border-radius: 6px; transition: width 0.3s ease;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }

  openModal('gantt-detail-modal');
  if (window.lucide) lucide.createIcons();
}

// =========================================================
// DASHBOARD TAB NAVIGATION: RINGKASAN & PROJECT
// =========================================================
function switchDashboardTab(tabName) {
  state.dashboardActiveTab = tabName;
  const btnRingkasan = document.getElementById('tab-btn-dashboard-ringkasan');
  const btnProject = document.getElementById('tab-btn-dashboard-project');
  const contentRingkasan = document.getElementById('dashboard-tab-content-ringkasan');
  const contentProject = document.getElementById('dashboard-tab-content-project');

  if (tabName === 'project') {
    if (btnRingkasan) {
      btnRingkasan.classList.remove('active');
      btnRingkasan.style.background = 'transparent';
      btnRingkasan.style.color = '#64748b';
      btnRingkasan.style.boxShadow = 'none';
    }
    if (btnProject) {
      btnProject.classList.add('active');
      btnProject.style.background = '#ffffff';
      btnProject.style.color = '#2563eb';
      btnProject.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
    }
    if (contentRingkasan) contentRingkasan.style.display = 'none';
    if (contentProject) contentProject.style.display = 'block';
    renderDashboardProjectGantt();
    setTimeout(scrollGanttToToday, 100);
  } else {
    if (btnProject) {
      btnProject.classList.remove('active');
      btnProject.style.background = 'transparent';
      btnProject.style.color = '#64748b';
      btnProject.style.boxShadow = 'none';
    }
    if (btnRingkasan) {
      btnRingkasan.classList.add('active');
      btnRingkasan.style.background = '#ffffff';
      btnRingkasan.style.color = '#2563eb';
      btnRingkasan.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
    }
    if (contentProject) contentProject.style.display = 'none';
    if (contentRingkasan) contentRingkasan.style.display = 'block';
    renderDashboardGanttChart();
    renderDashboardServiceTable();
    const savedSegment = localStorage.getItem('ubm_dashboard_segment') || 'ALL';
    setDashboardSegment(savedSegment);
  }
  if (window.lucide) lucide.createIcons();
}

function onProjectGanttSearch(val) {
  state.projectGanttSearch = (val || '').trim();
  renderDashboardProjectGantt();
}

function scrollGanttToToday() {
  const container = document.getElementById('gantt-main-scroll-container');
  if (!container) return;
  const todayBadge = container.querySelector('.gantt-today-badge');
  const todayLine = container.querySelector('.gantt-today-line');
  const targetEl = todayBadge || todayLine;
  if (targetEl) {
    const targetScroll = Math.max(0, targetEl.offsetLeft - (container.clientWidth / 2));
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }
}

// Safe collapse state initialization
window.state = window.state || {};
state.ganttCollapsedProjects = state.ganttCollapsedProjects || {};

function toggleGanttProjectCollapse(projId) {
  state.ganttCollapsedProjects = state.ganttCollapsedProjects || {};
  state.ganttCollapsedProjects[projId] = !state.ganttCollapsedProjects[projId];
  renderDashboardProjectGantt();
}

function toggleAllGanttCollapse() {
  state.ganttCollapsedProjects = state.ganttCollapsedProjects || {};
  const projects = state.projects || [];
  const anyOpen = projects.some(p => !state.ganttCollapsedProjects[p.id]);
  projects.forEach(p => {
    state.ganttCollapsedProjects[p.id] = anyOpen;
  });
  renderDashboardProjectGantt();
}

// =========================================================
// GANTT CHART FULL SCREEN CONTROLLER
// =========================================================
// GANTT CHART FULL SCREEN CONTROLLER (NATIVE POWERPOINT PRESENTATION MODE)
// =========================================================
async function toggleGanttFullScreen() {
  // Pastikan tab Project (Gantt Chart Berjalan) aktif terlebih dahulu
  if (typeof switchDashboardTab === 'function') {
    switchDashboardTab('project');
  }

  const wrapper = document.querySelector('.dashboard-gantt-wrapper') || document.getElementById('view-dashboard');
  if (!wrapper) return;

  const isAlreadyNative = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

  if (!isAlreadyNative) {
    try {
      if (wrapper.requestFullscreen) {
        await wrapper.requestFullscreen();
      } else if (wrapper.webkitRequestFullscreen) {
        await wrapper.webkitRequestFullscreen();
      } else if (wrapper.msRequestFullscreen) {
        await wrapper.msRequestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Native requestFullscreen could not be launched:', err);
    }
    wrapper.classList.add('gantt-fullscreen-mode');
  } else {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch (err) {
      console.warn('Native exitFullscreen failed:', err);
    }
    wrapper.classList.remove('gantt-fullscreen-mode');
  }

  updateGanttFullScreenUI();
}
window.toggleGanttFullScreen = toggleGanttFullScreen;

function updateGanttFullScreenUI() {
  const wrapper = document.querySelector('.dashboard-gantt-wrapper');
  const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement || (wrapper && wrapper.classList.contains('gantt-fullscreen-mode')));

  if (wrapper) {
    if (isFull) {
      wrapper.classList.add('gantt-fullscreen-mode');
    } else {
      wrapper.classList.remove('gantt-fullscreen-mode');
    }
  }

  // Update button icon & text di toolbar Gantt
  const icon = document.getElementById('btn-gantt-fullscreen-icon');
  const text = document.getElementById('btn-gantt-fullscreen-text');
  if (icon) {
    icon.setAttribute('data-lucide', isFull ? 'minimize-2' : 'maximize');
  }
  if (text) {
    text.textContent = isFull ? 'Keluar Fullscreen (ESC)' : 'Layar Penuh (PowerPoint)';
  }

  // Update button icon & text di header atas
  const topIcon = document.getElementById('btn-top-fullscreen-icon');
  const topText = document.getElementById('btn-top-fullscreen-text');
  if (topIcon) topIcon.setAttribute('data-lucide', isFull ? 'minimize-2' : 'maximize');
  if (topText) topText.textContent = isFull ? 'Keluar Layar Penuh' : 'Layar Penuh (PowerPoint)';

  // Prevent background scrolling when in full screen
  document.body.style.overflow = isFull ? 'hidden' : '';

  if (window.lucide) {
    lucide.createIcons();
  }

  // Recalculate layout and Gantt width for the fullscreen width
  setTimeout(() => {
    renderDashboardProjectGantt();
  }, 80);
}

// Event listener native fullscreen change (ESC key atau F11 browser)
document.addEventListener('fullscreenchange', updateGanttFullScreenUI);
document.addEventListener('webkitfullscreenchange', updateGanttFullScreenUI);
document.addEventListener('mozfullscreenchange', updateGanttFullScreenUI);
document.addEventListener('MSFullscreenChange', updateGanttFullScreenUI);

// ESC key to exit full screen fallback
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const isAlreadyNative = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (isAlreadyNative && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    const wrapper = document.querySelector('.dashboard-gantt-wrapper');
    if (wrapper && wrapper.classList.contains('gantt-fullscreen-mode')) {
      wrapper.classList.remove('gantt-fullscreen-mode');
      updateGanttFullScreenUI();
    }
  }
});

// Fit Screen Toggle: Menyesuaikan Lebar Timeline agar Pas di Layar Laptop Tanpa Scroll Horizontal
function toggleGanttFitScreen() {
  state.ganttFitScreen = (state.ganttFitScreen === false) ? true : false;
  try { localStorage.setItem('ubm_gantt_fitscreen', state.ganttFitScreen); } catch (e) {}
  updateFitScreenBtnUI();
  renderDashboardProjectGantt();
}
window.toggleGanttFitScreen = toggleGanttFitScreen;

function updateFitScreenBtnUI() {
  const isFit = state.ganttFitScreen !== false; // default true
  const btn = document.getElementById('btn-gantt-fitscreen');
  const scrollContainer = document.getElementById('gantt-main-scroll-container');
  if (btn) {
    if (isFit) {
      btn.style.background = '#eff6ff';
      btn.style.color = '#1d4ed8';
      btn.style.borderColor = '#bfdbfe';
      btn.innerHTML = `<i data-lucide="shrink" style="width: 14px; height: 14px;"></i> <span>Fit Layar (No Scroll)</span>`;
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#475569';
      btn.style.borderColor = '#cbd5e1';
      btn.innerHTML = `<i data-lucide="zoom-in" style="width: 14px; height: 14px;"></i> <span>Detail Harian (Scroll)</span>`;
    }
  }
  if (scrollContainer) {
    if (isFit) {
      scrollContainer.classList.add('fit-screen');
    } else {
      scrollContainer.classList.remove('fit-screen');
    }
  }
  if (window.lucide) lucide.createIcons();
}

function openGanttMilestoneDetail(projId, msId) {
  const p = (state.projects || []).find(x => x.id === projId || x.orderId === projId);
  if (p) {
    currentActiveProjectData = p;
    currentActiveProjectOrderId = p.id || p.orderId;
    if (typeof openMilestoneDetailModal === 'function') {
      openMilestoneDetailModal(msId);
      return;
    }
  }
  if (typeof openProjectTimelinePage === 'function') {
    openProjectTimelinePage(projId);
  }
}

// Global Gantt Tooltip Singleton
function initGanttTooltip() {
  let tip = document.getElementById('dashboard-gantt-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'dashboard-gantt-tooltip';
    tip.className = 'gantt-tooltip';
    tip.style.position = 'fixed';
    tip.style.display = 'none';
    tip.style.pointerEvents = 'none';
    tip.style.zIndex = '99999';
    document.body.appendChild(tip);
  }
  return tip;
}

function showGanttTooltip(e, html) {
  const tip = initGanttTooltip();
  if (!tip) return;
  tip.innerHTML = html;
  tip.style.display = 'block';
  tip.classList.add('visible');
  moveGanttTooltip(e);
}

function moveGanttTooltip(e) {
  const tip = document.getElementById('dashboard-gantt-tooltip');
  if (!tip || tip.style.display === 'none') return;
  const tipWidth = tip.offsetWidth || 280;
  const tipHeight = tip.offsetHeight || 120;
  let x = e.clientX + 14;
  let y = e.clientY + 14;
  if (x + tipWidth > window.innerWidth - 10) {
    x = Math.max(10, e.clientX - tipWidth - 14);
  }
  if (y + tipHeight > window.innerHeight - 10) {
    y = Math.max(10, e.clientY - tipHeight - 14);
  }
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

function hideGanttTooltip() {
  const tip = document.getElementById('dashboard-gantt-tooltip');
  if (tip) {
    tip.style.display = 'none';
    tip.classList.remove('visible');
    tip.innerHTML = '';
  }
}

function formatGanttDate(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = parseInt(parts[2], 10);
      const m = parseInt(parts[1], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${d} ${months[m - 1]} ${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getPicAvatar(name) {
  if (!name || name === 'Belum diassign') return '??';
  const clean = name.replace(/^(Ir\.|Dr\.|Drs\.|Dra\.|Prof\.)\s*/i, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

// =========================================================
// GANTT CHART ENGINE: ALL RUNNING PROJECTS
// =========================================================
function renderDashboardProjectGantt() {
  const container = document.getElementById('dashboard-project-gantt-view');
  if (!container) return;

  // 1. Data Source Riil dari Seluruh Modul Terkait
  const allOrders = state.orders || [];
  const allProjects = state.projects || [];
  const allExpenses = state.service_expenses || [];
  const allLogs = state.activity_logs || [];
  const todayStr = new Date().toISOString().split('T')[0];

  const combinedProjects = [];
  const processedOrderIds = new Set();
  const processedProjectNames = new Set();

  // A. Proyek dari `state.projects` (Direct Project maupun Linked Order)
  allProjects.forEach(p => {
    const matchingOrder = p.orderId ? allOrders.find(o => o.id === p.orderId) : null;
    if (p.orderId) processedOrderIds.add(p.orderId);

    const isSvc = isProjectService(p) || (matchingOrder ? isServiceOrder(matchingOrder) : false);
    const orderItems = matchingOrder?.items || [];
    const firstItemName = orderItems[0]?.itemName || '';

    // Nama Project & Customer Riil
    const projName = p.projectName || matchingOrder?.projectName || (firstItemName ? `${firstItemName}` : (isSvc ? 'Proyek Jasa' : 'Proyek Engineering'));
    const custName = p.customerName || matchingOrder?.customerName || (p.isDirect ? 'Internal Politeknik Takumi' : '-');
    processedProjectNames.add(projName.toLowerCase().trim());

    const start = p.startDate || matchingOrder?.orderDate || todayStr;
    const due = p.dueDate || matchingOrder?.dueDate || '';

    // Milestones Riil:
    // Prioritas 1: Milestones yang sudah diinput pada Project Management
    let msList = Array.isArray(p.milestones) && p.milestones.length > 0 ? [...p.milestones] : [];

    // Prioritas 2: Jika belum ada milestones, bentuk dari Item Pesanan & Pengeluaran Riil
    if (msList.length === 0) {
      if (isSvc && matchingOrder) {
        // Item jasa nyata dari penawaran / PO
        orderItems.forEach((itm, idx) => {
          msList.push({
            id: `${p.id}-ITM-${idx + 1}`,
            title: `Layanan: ${itm.itemName} (${itm.qty} ${itm.unit || 'Unit'})`,
            status: matchingOrder.status === 'Completed' || matchingOrder.status === 'Delivered' ? 'Completed' : 'In Progress',
            startDate: start,
            dueDate: due || start,
            pic: idx === 0 ? (p.projectLead || 'Tim Jasa') : ((p.team && p.team[0]?.name) || p.projectLead || 'Tim Pelaksana'),
            notes: `Item resmi PO Pelanggan: Rp ${(itm.total || 0).toLocaleString('id-ID')}`
          });
        });

        // Pengeluaran operasional nyata dari modul keuangan jasa
        const relatedExpenses = allExpenses.filter(e => e.orderId === matchingOrder.id || (e.customerName && e.customerName.toLowerCase() === custName.toLowerCase()));
        relatedExpenses.forEach((exp, eIdx) => {
          const isDone = exp.status === 'Disetujui' || exp.status === 'Selesai';
          msList.push({
            id: `${p.id}-EXP-${eIdx + 1}`,
            title: `Operasional Lapangan: ${exp.transportRoute || exp.serviceName || 'Transport & Akomodasi'} (${exp.transportType || 'Transportasi'})`,
            status: isDone ? 'Completed' : 'In Progress',
            startDate: exp.date || start,
            dueDate: due || exp.date || start,
            pic: exp.picName || p.projectLead || 'Koordinator Lapangan',
            notes: `Biaya: Rp ${(exp.totalExpense || 0).toLocaleString('id-ID')} • Status: ${exp.status || 'Diajukan'}`
          });
        });

        // Task BAST & Serah Terima Riil
        msList.push({
          id: `${p.id}-BAST`,
          title: `Serah Terima & BAST ${projName}`,
          status: matchingOrder.status === 'Completed' || matchingOrder.status === 'Delivered' ? 'Completed' : 'Pending',
          startDate: due || start,
          dueDate: due || start,
          pic: 'Admin Proyek & Keuangan',
          notes: 'Penyusunan Berita Acara Serah Terima pekerjaan'
        });
      } else if (!isSvc && matchingOrder) {
        // Produk manufaktur nyata
        orderItems.forEach((itm, idx) => {
          msList.push({
            id: `${p.id}-PROD-${idx + 1}`,
            title: `Fabrikasi & Produksi: ${itm.itemName} (${itm.qty} ${itm.unit || 'Pcs'})`,
            status: matchingOrder.status === 'In Production' ? 'In Progress' : (matchingOrder.status === 'Delivered' ? 'Completed' : 'Pending'),
            startDate: start,
            dueDate: due || start,
            pic: p.projectLead || 'Tim Produksi',
            notes: `Pesanan: ${itm.qty} unit`
          });
        });
        msList.push({
          id: `${p.id}-QC`,
          title: `Quality Control & Testing ${projName}`,
          status: matchingOrder.status === 'Testing & QC' ? 'In Progress' : (matchingOrder.status === 'Delivered' ? 'Completed' : 'Pending'),
          startDate: due || start,
          dueDate: due || start,
          pic: 'Tim QC & Engineering',
          notes: 'Uji fungsi dan pengecekan kelayakan'
        });
      }
    }

    combinedProjects.push({
      id: p.id,
      orderId: p.orderId || null,
      projectName: projName,
      customerName: custName,
      projectLead: p.projectLead || (isSvc ? 'Tim Jasa' : 'Belum diassign'),
      department: p.department || (isSvc ? 'Service & Ops' : 'Engineering'),
      status: p.status || (matchingOrder ? (matchingOrder.status === 'Accepted' || matchingOrder.status === 'In Production' ? 'In Progress' : matchingOrder.status) : 'In Progress'),
      startDate: start,
      dueDate: due,
      progressPercent: typeof p.progressPercent === 'number' && p.progressPercent > 0 ? p.progressPercent : (msList.length > 0 ? Math.round((msList.filter(m => m.status === 'Completed').length / msList.length) * 100) : 0),
      milestones: msList,
      team: p.team || [],
      isDirect: Boolean(p.isDirect || !p.orderId),
      isService: isSvc,
      order: matchingOrder
    });
  });

  // B. Order Penjualan Aktif yang belum memiliki record project
  allOrders.forEach(ord => {
    if (!processedOrderIds.has(ord.id) && ord.status !== 'Delivered' && ord.status !== 'Cancelled') {
      const isSvc = isServiceOrder(ord);
      const items = ord.items || [];
      const firstItemName = items[0]?.itemName || (isSvc ? 'Layanan Jasa' : 'Produk Pesanan');
      const projName = ord.projectName || `${firstItemName}`;
      const custName = ord.customerName || '-';
      processedProjectNames.add(projName.toLowerCase().trim());

      const start = ord.orderDate || todayStr;
      const due = ord.dueDate || '';

      const msList = [];
      if (isSvc) {
        items.forEach((itm, idx) => {
          msList.push({
            id: `ORD-${ord.id}-ITM-${idx + 1}`,
            title: `Layanan: ${itm.itemName} (${itm.qty} ${itm.unit || 'Unit'})`,
            status: ord.status === 'Accepted' ? 'In Progress' : 'Pending',
            startDate: start,
            dueDate: due || start,
            pic: ord.createdBy || 'Tim Jasa',
            notes: `Total: Rp ${(itm.total || 0).toLocaleString('id-ID')}`
          });
        });

        const relatedExpenses = allExpenses.filter(e => e.orderId === ord.id);
        relatedExpenses.forEach((exp, eIdx) => {
          msList.push({
            id: `ORD-${ord.id}-EXP-${eIdx + 1}`,
            title: `Operasional: ${exp.transportRoute || exp.serviceName} (${exp.transportType || 'Transport'})`,
            status: exp.status === 'Disetujui' ? 'Completed' : 'In Progress',
            startDate: exp.date || start,
            dueDate: due || exp.date || start,
            pic: exp.picName || 'Koordinator Lapangan',
            notes: `Biaya: Rp ${(exp.totalExpense || 0).toLocaleString('id-ID')}`
          });
        });
      } else {
        items.forEach((itm, idx) => {
          msList.push({
            id: `ORD-${ord.id}-PROD-${idx + 1}`,
            title: `Produksi: ${itm.itemName} (${itm.qty} ${itm.unit || 'Pcs'})`,
            status: ord.status === 'Accepted' || ord.status === 'In Production' ? 'In Progress' : 'Pending',
            startDate: start,
            dueDate: due || start,
            pic: 'Tim Produksi',
            notes: `Pesanan Pelanggan: ${custName}`
          });
        });
      }

      combinedProjects.push({
        id: `PRJ-${ord.id}`,
        orderId: ord.id,
        projectName: projName,
        customerName: custName,
        projectLead: isSvc ? (ord.createdBy || 'Tim Jasa') : 'Belum diassign',
        department: isSvc ? 'Service & Ops' : 'Engineering',
        status: ord.status === 'Accepted' || ord.status === 'In Production' ? 'In Progress' : 'Planning',
        startDate: start,
        dueDate: due,
        progressPercent: msList.length > 0 ? Math.round((msList.filter(m => m.status === 'Completed').length / msList.length) * 100) : 15,
        milestones: msList,
        team: [],
        isDirect: false,
        isService: isSvc,
        order: ord
      });
    }
  });

  // C. Proyek Mandiri / Internal Riil dari `state.activity_logs`
  // Mengelompokkan aktivitas real yang sedang berjalan di UBM (misal: "Smart Laundry", "UBM")
  const logsByProject = {};
  allLogs.forEach(log => {
    const pName = (log.projectName || '').trim();
    if (!pName) return;
    if (!logsByProject[pName]) logsByProject[pName] = [];
    logsByProject[pName].push(log);
  });

  Object.keys(logsByProject).forEach(pName => {
    // Jangan duplikasi jika project name sudah terdaftar dari project resmi / order
    if (processedProjectNames.has(pName.toLowerCase())) return;

    const projLogs = logsByProject[pName];
    // Hanya masukkan jika memiliki log berstatus 'Sedang Berjalan' atau log aktif
    const hasRunningLogs = projLogs.some(l => l.status === 'Sedang Berjalan');
    if (!hasRunningLogs) return;

    const runningLogList = projLogs.filter(l => l.status === 'Sedang Berjalan' || l.status === 'Selesai');
    if (runningLogList.length === 0) return;

    // Ambil tanggal mulai terawal dan tanggal target
    const dates = runningLogList.map(l => l.startDate).filter(Boolean);
    const endDates = runningLogList.map(l => l.endDate).filter(Boolean);
    const startStr = dates.length > 0 ? dates.sort()[0] : todayStr;
    const dueStr = endDates.length > 0 ? endDates.sort().reverse()[0] : todayStr;

    // PIC terbanyak / terdepan
    const picCount = {};
    runningLogList.forEach(l => {
      if (l.pic) picCount[l.pic] = (picCount[l.pic] || 0) + 1;
    });
    const mainPic = Object.keys(picCount).sort((a, b) => picCount[b] - picCount[a])[0] || 'Tim UBM';

    const msList = runningLogList.map((l, lIdx) => ({
      id: `INT-${pName}-${lIdx + 1}`,
      title: l.task || 'Aktivitas Proyek',
      status: l.status === 'Selesai' ? 'Completed' : 'In Progress',
      startDate: l.startDate || startStr,
      dueDate: l.endDate || dueStr,
      pic: l.pic || mainPic,
      notes: l.notes || ''
    }));

    const compCount = msList.filter(m => m.status === 'Completed').length;
    const progress = Math.round((compCount / msList.length) * 100);

    combinedProjects.push({
      id: `DIR-${pName.replace(/\s+/g, '-').toUpperCase()}`,
      orderId: null,
      projectName: pName,
      customerName: 'Internal Politeknik Takumi',
      projectLead: mainPic,
      department: runningLogList[0]?.category || 'Operasional',
      status: 'In Progress',
      startDate: startStr,
      dueDate: dueStr,
      progressPercent: progress,
      milestones: msList,
      team: [],
      isDirect: true,
      isInternal: true,
      isService: false,
      order: null
    });
  });

  // Helper Project Running
  function isProjectRunning(p) {
    if (p.status === 'Completed' || p.status === 'Cancelled') return false;
    if (p.order && (p.order.status === 'Delivered' || p.order.status === 'Cancelled')) return false;
    return true;
  }

  // Count running projects for badge and stats
  const runningProjects = combinedProjects.filter(isProjectRunning);
  const badgeTab = document.getElementById('badge-dashboard-project-count');
  if (badgeTab) badgeTab.textContent = runningProjects.length;

  const kpiRunning = document.getElementById('kpi-gantt-running-count');
  const kpiRunningSub = document.getElementById('kpi-gantt-running-sub');
  const runningSvcCount = runningProjects.filter(p => p.isService).length;
  const runningProdCount = runningProjects.filter(p => !p.isService && !p.isInternal).length;
  const runningIntCount = runningProjects.filter(p => p.isInternal).length;

  if (kpiRunning) kpiRunning.textContent = `${runningProjects.length} Project`;
  if (kpiRunningSub) {
    const parts = [];
    if (runningProdCount > 0) parts.push(`${runningProdCount} Produk`);
    if (runningSvcCount > 0) parts.push(`${runningSvcCount} Jasa`);
    if (runningIntCount > 0) parts.push(`${runningIntCount} Mandiri`);
    kpiRunningSub.textContent = parts.length > 0 ? `${parts.join(' • ')} Aktif` : 'Tidak Ada Project Berjalan';
  }

  // Calculate task-level stats across running projects
  let totalTasks = 0;
  let activeTasks = 0;
  let completedTasks = 0;
  let overdueTasks = 0;

  runningProjects.forEach(p => {
    const msList = p.milestones || [];
    totalTasks += msList.length;
    msList.forEach(m => {
      const isComp = m.status === 'Completed';
      const isOver = !isComp && m.dueDate && m.dueDate < todayStr;
      if (isComp) completedTasks++;
      else if (m.status === 'In Progress') activeTasks++;
      if (isOver) overdueTasks++;
    });
  });

  const kpiTotalTasks = document.getElementById('kpi-gantt-total-tasks');
  const kpiActiveTasks = document.getElementById('kpi-gantt-active-tasks');
  if (kpiTotalTasks) kpiTotalTasks.textContent = `${totalTasks} Task`;
  if (kpiActiveTasks) kpiActiveTasks.textContent = `${activeTasks} Sedang Dikerjakan`;

  const kpiCompTasks = document.getElementById('kpi-gantt-completed-tasks');
  const kpiCompPercent = document.getElementById('kpi-gantt-completed-percent');
  const compPercentVal = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  if (kpiCompTasks) kpiCompTasks.textContent = `${completedTasks} Task`;
  if (kpiCompPercent) kpiCompPercent.textContent = `${compPercentVal}% Selesai`;

  const kpiOverdueTasks = document.getElementById('kpi-gantt-overdue-tasks');
  const kpiOverdueSub = document.getElementById('kpi-gantt-overdue-sub');
  if (kpiOverdueTasks) kpiOverdueTasks.textContent = `${overdueTasks} Task`;
  if (kpiOverdueSub) kpiOverdueSub.textContent = overdueTasks > 0 ? `${overdueTasks} Task Melewati Deadline!` : 'Semua Task On Schedule';

  // 2. Apply Filters (Status Filter, Type Filter & Search Filter)
  const filterSelect = document.getElementById('gantt-status-filter');
  const filterMode = filterSelect?.value || 'ALL';
  const typeFilterSelect = document.getElementById('gantt-type-filter');
  const typeFilter = typeFilterSelect?.value || 'ALL';

  let displayProjects = combinedProjects;

  // Filter Type: ALL, PRODUCT, SERVICE, INTERNAL
  if (typeFilter === 'PRODUCT') {
    displayProjects = displayProjects.filter(p => !p.isService && !p.isInternal);
  } else if (typeFilter === 'SERVICE') {
    displayProjects = displayProjects.filter(p => p.isService);
  } else if (typeFilter === 'INTERNAL') {
    displayProjects = displayProjects.filter(p => p.isInternal);
  }

  // Filter Status
  if (filterMode === 'RUNNING') {
    displayProjects = displayProjects.filter(isProjectRunning);
  } else if (filterMode === 'OVERDUE') {
    displayProjects = displayProjects.filter(p => {
      const isOver = p.dueDate && p.dueDate < todayStr && p.status !== 'Completed';
      const hasOverTask = (p.milestones || []).some(m => m.dueDate && m.dueDate < todayStr && m.status !== 'Completed');
      return isOver || hasOverTask;
    });
  } else if (filterMode === 'ON_TRACK') {
    displayProjects = displayProjects.filter(p => {
      const isOver = p.dueDate && p.dueDate < todayStr;
      const hasOverTask = (p.milestones || []).some(m => m.dueDate && m.dueDate < todayStr && m.status !== 'Completed');
      return isProjectRunning(p) && !isOver && !hasOverTask;
    });
  }

  // Search input filter
  const searchQuery = (state.projectGanttSearch || '').toLowerCase().trim();
  if (searchQuery) {
    displayProjects = displayProjects.filter(p => {
      const name = (p.projectName || '').toLowerCase();
      const cust = (p.customerName || '').toLowerCase();
      const lead = (p.projectLead || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      const orderId = (p.orderId || '').toLowerCase();
      const msMatch = (p.milestones || []).some(m => {
        return (m.title || '').toLowerCase().includes(searchQuery) || (m.pic || '').toLowerCase().includes(searchQuery);
      });
      return name.includes(searchQuery) || cust.includes(searchQuery) || lead.includes(searchQuery) || id.includes(searchQuery) || orderId.includes(searchQuery) || msMatch;
    });
  }

  // Empty state handling
  if (displayProjects.length === 0) {
    container.innerHTML = `
      <div style="padding: 48px 24px; text-align: center; color: #64748b;">
        <i data-lucide="folder-kanban" style="width: 48px; height: 48px; color: #94a3b8; margin-bottom: 12px; stroke-width: 1.5;"></i>
        <h4 style="font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 6px 0;">Tidak Ada Project Ditemukan</h4>
        <p style="font-size: 12.5px; color: #64748b; margin: 0 0 16px 0; max-width: 440px; margin-left: auto; margin-right: auto;">
          ${searchQuery ? `Tidak ada project atau task yang cocok dengan kata kunci "<strong>${escapeHtml(searchQuery)}</strong>".` : 'Tidak ada project yang memenuhi filter yang dipilih.'}
        </p>
        <button type="button" class="btn btn-primary" onclick="navigateTo('projects')" style="display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="plus"></i> Buka Project Management
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // 3. Compute dynamic date bounds for weekly timeline (Format MINGGU bukan hari)
  const todayDate = new Date(todayStr);
  todayDate.setHours(0, 0, 0, 0);

  const activeDates = [todayDate];
  displayProjects.forEach(p => {
    if (p.startDate && p.startDate !== '-') activeDates.push(new Date(p.startDate));
    if (p.dueDate && p.dueDate !== '-') activeDates.push(new Date(p.dueDate));
    (p.milestones || []).forEach(m => {
      if (m.startDate && m.startDate !== '-') activeDates.push(new Date(m.startDate));
      if (m.dueDate && m.dueDate !== '-') activeDates.push(new Date(m.dueDate));
    });
  });

  const minTimeRaw = Math.min(...activeDates.map(d => d.getTime()));
  const maxTimeRaw = Math.max(...activeDates.map(d => d.getTime()));

  // Helper untuk mendapatkan awal minggu (Senin) & akhir minggu (Minggu)
  function getMondayOfWeek(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    dt.setDate(diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function getSundayOfWeek(d) {
    const mon = getMondayOfWeek(d);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return sun;
  }

  // Batasi rentang awal maksimal 2 minggu sebelum hari ini agar timeline tidak melar ke masa lalu
  const maxPastLimit = new Date(todayDate);
  maxPastLimit.setDate(maxPastLimit.getDate() - 14);

  const effectiveMinTime = Math.max(minTimeRaw, maxPastLimit.getTime());
  const startMonday = getMondayOfWeek(effectiveMinTime);

  // Pastikan rentang akhir minimal 4 minggu ke depan dari hari ini
  const minFutureLimit = new Date(todayDate);
  minFutureLimit.setDate(minFutureLimit.getDate() + 28);
  const effectiveMaxTime = Math.max(maxTimeRaw, minFutureLimit.getTime());
  const endSunday = getSundayOfWeek(effectiveMaxTime);

  // Generate Array Minggu (Weeks)
  const weeks = [];
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthNamesIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  let iterMon = new Date(startMonday);
  let weekIndex = 1;

  while (iterMon <= endSunday) {
    const iterSun = new Date(iterMon);
    iterSun.setDate(iterSun.getDate() + 6);
    iterSun.setHours(23, 59, 59, 999);

    const sDay = iterMon.getDate();
    const eDay = iterSun.getDate();
    const sMonth = monthNamesShort[iterMon.getMonth()];
    const eMonth = monthNamesShort[iterSun.getMonth()];

    // Label rentang minggu sangat ringkas: misal "20-26 Okt" atau "27 Okt-2 Nov"
    const rangeLabel = (sMonth === eMonth) ? `${sDay}-${eDay} ${sMonth}` : `${sDay} ${sMonth}-${eDay} ${eMonth}`;
    const isCurrentWeek = (todayDate >= iterMon && todayDate <= iterSun);

    weeks.push({
      index: weekIndex++,
      startDate: new Date(iterMon),
      endDate: new Date(iterSun),
      startTime: iterMon.getTime(),
      endTime: iterSun.getTime(),
      label: `M${weekIndex - 1}`,
      rangeLabel,
      monthName: monthNamesIndo[iterMon.getMonth()],
      monthIdx: iterMon.getMonth(),
      year: iterMon.getFullYear(),
      isCurrentWeek
    });

    iterMon.setDate(iterMon.getDate() + 7);
  }

  // Grouping Minggu berdasarkan Bulan untuk Header Baris 1
  const monthGroups = [];
  let currentGroup = null;
  weeks.forEach(w => {
    const label = `${w.monthName.toUpperCase()} ${w.year}`;
    if (!currentGroup || currentGroup.label !== label) {
      if (currentGroup) monthGroups.push(currentGroup);
      currentGroup = { label, weekCount: 1 };
    } else {
      currentGroup.weekCount++;
    }
  });
  if (currentGroup) monthGroups.push(currentGroup);

  // Hitung Lebar Layout Timeline (Fit Screen & Compact)
  const scrollContainer = document.querySelector('.gantt-scroll-container');
  const isFitScreen = state.ganttFitScreen !== false;
  if (scrollContainer) {
    if (isFitScreen) scrollContainer.classList.add('fit-screen');
    else scrollContainer.classList.remove('fit-screen');
  }

  const stickyWidth = 515; // 220 + 110 + 100 + 85 = 515px
  const containerClientWidth = scrollContainer ? (scrollContainer.clientWidth || window.innerWidth - 280) : 1100;
  const availableTimelineWidth = Math.max(450, containerClientWidth - stickyWidth - 4);

  const weekWidth = isFitScreen 
    ? Math.max(75, Math.floor(availableTimelineWidth / weeks.length)) 
    : 85;
  const totalTimelineWidth = weeks.length * weekWidth;

  const timelineStartTime = weeks[0].startTime;
  const timelineEndTime = weeks[weeks.length - 1].endTime;
  const totalTimelineMs = timelineEndTime - timelineStartTime;

  // Posisi Garis Hari Ini (Merah)
  const todayTime = todayDate.getTime();
  const todayLeftPx = (todayTime >= timelineStartTime && todayTime <= timelineEndTime)
    ? Math.round(((todayTime - timelineStartTime) / totalTimelineMs) * totalTimelineWidth)
    : -100;

  // Helper kalkulasi posisi bar proyek / task
  function calculateBarMetrics(startStr, endStr) {
    const sStr = startStr && startStr !== '-' ? startStr : todayStr;
    const eStr = endStr && endStr !== '-' ? endStr : sStr;

    const sDate = new Date(sStr);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(eStr);
    eDate.setHours(23, 59, 59, 999);

    const sTime = sDate.getTime();
    const eTime = Math.max(sTime, eDate.getTime());

    const clampedSTime = Math.max(timelineStartTime, Math.min(timelineEndTime, sTime));
    const clampedETime = Math.max(timelineStartTime, Math.min(timelineEndTime, eTime));

    const leftPx = Math.round(((clampedSTime - timelineStartTime) / totalTimelineMs) * totalTimelineWidth);
    const rightPx = Math.round(((clampedETime - timelineStartTime) / totalTimelineMs) * totalTimelineWidth);
    const widthPx = Math.max(18, rightPx - leftPx);

    const durationDays = Math.max(1, Math.round((eTime - sTime) / (1000 * 60 * 60 * 24)) + 1);

    return { leftPx, widthPx, durationDays };
  }

  // 4. Render Table Header dengan Skala Mingguan
  const headerHtml = `
    <thead>
      <tr style="height: 48px;">
        <th class="gantt-col-task" style="position: sticky; left: 0; z-index: 20; background: #f8fafc; width: 220px; min-width: 220px; max-width: 220px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 6px 8px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <i data-lucide="layers" style="width: 13px; height: 13px; color: #4f46e5;"></i>
            <span style="font-weight: 700; font-size: 11px; color: #334155;">PROYEK & TAHAPAN</span>
          </div>
        </th>
        <th class="gantt-col-pic" style="position: sticky; left: 220px; z-index: 20; background: #f8fafc; width: 110px; min-width: 110px; max-width: 110px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 6px 8px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <i data-lucide="user-check" style="width: 13px; height: 13px; color: #0284c7;"></i>
            <span style="font-weight: 700; font-size: 11px; color: #334155;">PIC / LEAD</span>
          </div>
        </th>
        <th class="gantt-col-schedule" style="position: sticky; left: 330px; z-index: 20; background: #f8fafc; width: 100px; min-width: 100px; max-width: 100px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 6px 8px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <i data-lucide="calendar" style="width: 13px; height: 13px; color: #16a34a;"></i>
            <span style="font-weight: 700; font-size: 11px; color: #334155;">JADWAL</span>
          </div>
        </th>
        <th class="gantt-col-status" style="position: sticky; left: 430px; z-index: 20; background: #f8fafc; width: 85px; min-width: 85px; max-width: 85px; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1; padding: 6px 8px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <i data-lucide="activity" style="width: 13px; height: 13px; color: #d97706;"></i>
            <span style="font-weight: 700; font-size: 11px; color: #334155;">STATUS</span>
          </div>
        </th>
        <th class="gantt-col-timeline" style="width: ${totalTimelineWidth}px; min-width: ${totalTimelineWidth}px; padding: 0;">
          <div class="gantt-timeline-header-container" style="width: ${totalTimelineWidth}px;">
            <!-- Bulan Row -->
            <div class="gantt-month-row" style="height: 22px;">
              ${monthGroups.map(mg => `
                <div class="gantt-month-cell" style="width: ${mg.weekCount * weekWidth}px; font-weight: 700; font-size: 10.5px; color: #334155; border-right: 1px solid #cbd5e1; line-height: 22px;">
                  ${mg.label}
                </div>
              `).join('')}
            </div>
            <!-- Minggu Row (Weekly Scale) -->
            <div class="gantt-weeks-row" style="position: relative; height: 26px;">
              ${weeks.map(w => `
                <div class="gantt-week-cell ${w.isCurrentWeek ? 'current-week' : ''}" style="width: ${weekWidth}px;">
                  <span style="font-size: 8px; font-weight: 700; text-transform: uppercase;">${w.label}</span>
                  <span style="font-weight: 600; font-size: 9px;">${w.rangeLabel}</span>
                </div>
              `).join('')}
              ${todayLeftPx >= 0 ? `
                <div class="gantt-today-badge" style="left: ${todayLeftPx}px;">HARI INI</div>
              ` : ''}
            </div>
          </div>
        </th>
      </tr>
    </thead>
  `;

  // Registry Tooltip Terpusat (Bebas Quoting Bug)
  window._ganttTooltips = {};

  // 5. Render Table Body (Projects and Nested Milestones)
  let rowsHtml = '';

  displayProjects.forEach(proj => {
    const isCollapsed = Boolean(state.ganttCollapsedProjects && state.ganttCollapsedProjects[proj.id]);
    const milestones = proj.milestones || [];
    const totalMs = milestones.length;
    const completedMs = milestones.filter(m => m.status === 'Completed').length;
    const inProgressMs = milestones.filter(m => m.status === 'In Progress').length;
    const overdueMs = milestones.filter(m => m.dueDate && m.dueDate < todayStr && m.status !== 'Completed').length;

    // Calculate project progress
    let projProgress = proj.progressPercent;
    if (typeof projProgress !== 'number') {
      if (proj.status === 'Completed') projProgress = 100;
      else if (totalMs > 0) projProgress = Math.round((completedMs / totalMs) * 100);
      else projProgress = 0;
    }

    // Determine status badge
    let statusBadgeClass = 'badge-secondary';
    let statusLabel = proj.status || 'Planning';

    if (projProgress >= 100 || proj.status === 'Completed') {
      statusBadgeClass = 'badge-success';
      statusLabel = 'Done';
    } else if (overdueMs > 0 || (proj.dueDate && proj.dueDate < todayStr && proj.status !== 'Completed')) {
      statusBadgeClass = 'badge-danger';
      statusLabel = 'Overdue';
    } else if (inProgressMs > 0 || proj.status === 'In Progress') {
      statusBadgeClass = proj.isService ? 'badge-warning' : (proj.isInternal ? 'badge-info' : 'badge-purple');
      statusLabel = 'Progress';
    }

    const projMetrics = calculateBarMetrics(proj.startDate, proj.dueDate);
    const codeBadge = proj.orderId ? escapeHtml(proj.orderId) : (proj.isDirect ? (proj.isInternal ? 'INTERNAL' : 'DIRECT') : escapeHtml(proj.id));
    const codeClass = proj.isService ? 'text-amber-700' : (proj.isInternal ? 'text-teal-700' : 'text-primary');
    const barClass = proj.isService ? 'service-summary' : (proj.isInternal ? 'internal-summary' : 'project-summary');

    // Label kategori
    let typeTag = '';
    if (proj.isService) {
      typeTag = '<span class="badge" style="font-size: 8px; padding: 1px 3px; background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; font-weight: 700; flex-shrink: 0;">🛠️ JASA</span>';
    } else if (proj.isInternal) {
      typeTag = '<span class="badge" style="font-size: 8px; padding: 1px 3px; background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; font-weight: 700; flex-shrink: 0;">🏢 MANDIRI</span>';
    } else {
      typeTag = '<span class="badge" style="font-size: 8px; padding: 1px 3px; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; font-weight: 700; flex-shrink: 0;">📦 PRODUK</span>';
    }

    // Aksi tombol & klik yang aman tanpa error toast
    let actionBtnHtml = '';
    let barOnClickAttr = '';

    if (proj.isService) {
      actionBtnHtml = `
        <button type="button" class="btn btn-xs btn-outline" onclick="if (typeof openServiceExpenseModal === 'function') openServiceExpenseModal('${proj.orderId || proj.id}');" title="Pengajuan Biaya Operasional Jasa" style="font-size: 8px; padding: 1px 4px; color: #ea580c; border-color: #fed7aa; background: #fff7ed; flex-shrink: 0; white-space: nowrap;">
          <i data-lucide="car" style="width: 10px; height: 10px;"></i> Biaya Ops
        </button>
      `;
      barOnClickAttr = `if (typeof openServiceExpenseModal === 'function') openServiceExpenseModal('${proj.orderId || proj.id}');`;
    } else if (proj.isInternal) {
      actionBtnHtml = `
        <button type="button" class="btn btn-xs btn-outline" onclick="navigateTo('logs')" title="Lihat Aktivitas Log UBM" style="font-size: 8px; padding: 1px 4px; color: #0d9488; border-color: #99f6e4; background: #f0fdfa; flex-shrink: 0; white-space: nowrap;">
          <i data-lucide="list" style="width: 10px; height: 10px;"></i> Log
        </button>
      `;
      barOnClickAttr = `navigateTo('logs');`;
    } else {
      actionBtnHtml = `
        <button type="button" class="btn btn-xs btn-outline" onclick="openProjectTimelinePage('${proj.orderId || proj.id}')" title="Detail Timeline Gantt" style="font-size: 8px; padding: 1px 4px; flex-shrink: 0; white-space: nowrap;">
          <i data-lucide="external-link" style="width: 10px; height: 10px;"></i> Timeline
        </button>
      `;
      barOnClickAttr = `openProjectTimelinePage('${proj.orderId || proj.id}');`;
    }

    // Registrasi Tooltip Project ke Registry
    const projTipKey = `tip_proj_${proj.id}`;
    window._ganttTooltips[projTipKey] = `
      <div style="font-weight: 700; color: ${proj.isService ? '#fdba74' : (proj.isInternal ? '#5eead4' : '#a5b4fc')}; font-size: 11px; margin-bottom: 2px;">
        ${proj.isService ? '🛠️ PROYEK JASA' : (proj.isInternal ? '🏢 PROYEK MANDIRI UBM' : '📦 PROYEK MANUFAKTUR')}
      </div>
      <div style="font-weight: 700; font-size: 12.5px; margin-bottom: 5px;">${escapeHtml(proj.projectName)}</div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">🏢 Klien: <strong style="color: #fff;">${escapeHtml(proj.customerName)}</strong></div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">👤 PIC: <strong style="color: #fff;">${escapeHtml(proj.projectLead)}</strong> (${escapeHtml(proj.department)})</div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">📅 Jadwal: <strong style="color: #fff;">${formatGanttDate(proj.startDate)} &rarr; ${formatGanttDate(proj.dueDate)}</strong> (${projMetrics.durationDays} hari)</div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">📊 Progress: <strong style="color: #4ade80;">${projProgress}%</strong> (${completedMs}/${totalMs} Task Selesai)</div>
      <div style="font-size: 11px; color: #cbd5e1;">⚡ Status: <strong style="color: #facc15;">${statusLabel}</strong></div>
    `;

    // A. Project Parent Row (Compact: height 32px)
    rowsHtml += `
      <tr class="gantt-project-header-row ${proj.isService ? 'is-service-project' : ''}" style="height: 32px;">
        <!-- Col 1: Project Info (Width: 220px, Left: 0) -->
        <td class="gantt-col-task" style="position: sticky; left: 0; z-index: 10; background: #f8fafc; width: 220px; min-width: 220px; max-width: 220px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 4px 6px;">
          <div style="display: flex; align-items: center; gap: 4px; overflow: hidden;">
            <button type="button" class="btn-ghost btn-xs" onclick="toggleGanttProjectCollapse('${proj.id}')" title="${isCollapsed ? 'Buka Task' : 'Tutup Task'}" style="padding: 1px; display: inline-flex; align-items: center; justify-content: center; color: #475569; flex-shrink: 0;">
              <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" style="width: 13px; height: 13px;"></i>
            </button>
            <div style="min-width: 0; flex: 1; overflow: hidden;">
              <div class="font-bold text-main" style="font-size: 11px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;" title="${escapeAttr(proj.projectName)}">
                ${escapeHtml(proj.projectName)}
              </div>
              <div style="display: flex; align-items: center; gap: 4px; margin-top: 1px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                ${typeTag}
                <span class="mono-id font-bold ${codeClass}" style="font-size: 8.5px; background: rgba(0,0,0,0.04); padding: 0 3px; border-radius: 3px;">${codeBadge}</span>
                <span style="font-size: 9px; color: #64748b; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(proj.customerName)}</span>
              </div>
            </div>
            ${actionBtnHtml}
          </div>
        </td>

        <!-- Col 2: PIC Lead (Width: 110px, Left: 220px) -->
        <td class="gantt-col-pic" style="position: sticky; left: 220px; z-index: 10; background: #f8fafc; width: 110px; min-width: 110px; max-width: 110px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 4px 6px;">
          <div style="display: flex; align-items: center; gap: 5px; overflow: hidden;">
            <div style="width: 18px; height: 18px; border-radius: 50%; background: ${proj.isService ? '#ea580c' : (proj.isInternal ? '#0f766e' : '#4f46e5')}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 700; flex-shrink: 0;">
              ${getPicAvatar(proj.projectLead)}
            </div>
            <div style="min-width: 0; overflow: hidden;">
              <div class="font-bold text-main" style="font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(proj.projectLead)}">${escapeHtml(proj.projectLead)}</div>
            </div>
          </div>
        </td>

        <!-- Col 3: Schedule (Width: 100px, Left: 330px) -->
        <td class="gantt-col-schedule" style="position: sticky; left: 330px; z-index: 10; background: #f8fafc; width: 100px; min-width: 100px; max-width: 100px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 4px 6px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${formatGanttDate(proj.startDate)} &rarr; ${formatGanttDate(proj.dueDate)}
          </div>
          <div style="margin-top: 1px;">
            <span class="badge badge-secondary" style="font-size: 8px; padding: 0 4px; font-weight: 600;">
              ${projMetrics.durationDays}h
            </span>
          </div>
        </td>

        <!-- Col 4: Status & Progress (Width: 85px, Left: 430px) -->
        <td class="gantt-col-status" style="position: sticky; left: 430px; z-index: 10; background: #f8fafc; width: 85px; min-width: 85px; max-width: 85px; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1; padding: 4px 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; margin-bottom: 2px;">
            <span class="badge ${statusBadgeClass}" style="font-size: 8px; padding: 1px 3px;">
              ${statusLabel}
            </span>
            <span class="font-bold font-mono" style="font-size: 8.5px; color: #1e293b;">${projProgress}%</span>
          </div>
          <div style="height: 3px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
            <div style="width: ${projProgress}%; height: 100%; background: ${projProgress >= 100 ? '#10b981' : (proj.isService ? '#ea580c' : (proj.isInternal ? '#0f766e' : '#4f46e5'))};"></div>
          </div>
        </td>

        <!-- Col 5: Gantt Bar Track Canvas -->
        <td class="gantt-col-timeline" style="width: ${totalTimelineWidth}px; padding: 0;">
          <div class="gantt-track-canvas" style="width: ${totalTimelineWidth}px; height: 32px;">
            <!-- Grid lines per week -->
            ${weeks.map((w, wIdx) => `
              <div class="gantt-grid-line ${w.isCurrentWeek ? 'current-week-grid' : ''}" style="left: ${wIdx * weekWidth}px; width: ${weekWidth}px;"></div>
            `).join('')}

            <!-- Today marker line -->
            ${todayLeftPx >= 0 ? `<div class="gantt-today-line" style="left: ${todayLeftPx}px;"></div>` : ''}

            <!-- Project Summary Bar -->
            <div class="gantt-bar-item ${barClass}" 
                 style="left: ${projMetrics.leftPx}px; width: ${projMetrics.widthPx}px; height: 18px; border-radius: 4px;"
                 data-gantt-tip="${projTipKey}"
                 onclick="${barOnClickAttr}">
              <div class="gantt-bar-progress-fill" style="width: ${projProgress}%;"></div>
              <span class="gantt-bar-text" style="font-size: 9px; padding: 0 4px;">
                <i data-lucide="${proj.isService ? 'wrench' : (proj.isInternal ? 'briefcase' : 'folder')}" style="width: 10px; height: 10px; flex-shrink: 0;"></i>
                ${projMetrics.widthPx >= 45 ? `<strong>${escapeHtml(proj.projectName)}</strong> (${projProgress}%)` : ''}
              </span>
            </div>
          </div>
        </td>
      </tr>
    `;

    // B. Project Tasks / Milestones Rows (when expanded - Compact: height 24px)
    if (!isCollapsed) {
      if (milestones.length === 0) {
        rowsHtml += `
          <tr class="gantt-task-row" style="height: 24px;">
            <td class="gantt-col-task" style="position: sticky; left: 0; z-index: 5; background: #ffffff; width: 220px; min-width: 220px; max-width: 220px; padding-left: 20px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding-top: 2px; padding-bottom: 2px;">
              <div style="font-size: 10px; color: #94a3b8; font-style: italic;">
                Belum ada rincian tugas.
              </div>
            </td>
            <td class="gantt-col-pic" style="position: sticky; left: 220px; z-index: 5; background: #ffffff; width: 110px; min-width: 110px; max-width: 110px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
              <span class="text-muted" style="font-size: 9px;">-</span>
            </td>
            <td class="gantt-col-schedule" style="position: sticky; left: 330px; z-index: 5; background: #ffffff; width: 100px; min-width: 100px; max-width: 100px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
              <span class="text-muted" style="font-size: 9px;">-</span>
            </td>
            <td class="gantt-col-status" style="position: sticky; left: 430px; z-index: 5; background: #ffffff; width: 85px; min-width: 85px; max-width: 85px; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1;">
              <span class="text-muted" style="font-size: 9px;">-</span>
            </td>
            <td class="gantt-col-timeline" style="width: ${totalTimelineWidth}px; padding: 0;">
              <div class="gantt-track-canvas" style="width: ${totalTimelineWidth}px; height: 24px;">
                ${weeks.map((w, wIdx) => `
                  <div class="gantt-grid-line ${w.isCurrentWeek ? 'current-week-grid' : ''}" style="left: ${wIdx * weekWidth}px; width: ${weekWidth}px;"></div>
                `).join('')}
                ${todayLeftPx >= 0 ? `<div class="gantt-today-line" style="left: ${todayLeftPx}px;"></div>` : ''}
              </div>
            </td>
          </tr>
        `;
      } else {
        milestones.forEach((ms, mIdx) => {
          const isComp = ms.status === 'Completed';
          const isOver = !isComp && ms.dueDate && ms.dueDate < todayStr;
          const isInProg = ms.status === 'In Progress';

          let msClass = proj.isService ? 'service-bar' : (proj.isInternal ? 'internal-bar' : 'status-pending');
          let msBadgeClass = 'badge-secondary';
          let msStatusText = ms.status || 'Pending';

          if (isComp) {
            msClass = 'status-completed';
            msBadgeClass = 'badge-success';
            msStatusText = 'Done';
          } else if (isOver) {
            msClass = 'status-overdue';
            msBadgeClass = 'badge-danger';
            msStatusText = 'Overdue';
          } else if (isInProg) {
            msClass = proj.isService ? 'service-bar' : (proj.isInternal ? 'internal-bar' : 'status-in-progress');
            msBadgeClass = proj.isService ? 'badge-warning' : (proj.isInternal ? 'badge-info' : 'badge-purple');
            msStatusText = 'Progress';
          }

          const msMetrics = calculateBarMetrics(ms.startDate || proj.startDate, ms.dueDate || proj.dueDate);
          const msPic = ms.pic || proj.projectLead || '-';

          // Registrasi Tooltip Milestone ke Registry
          const msTipKey = `tip_ms_${proj.id}_${ms.id || mIdx}`;
          window._ganttTooltips[msTipKey] = `
            <div style="font-weight: 700; color: ${proj.isService ? '#fdba74' : (proj.isInternal ? '#5eead4' : '#93c5fd')}; font-size: 11px; margin-bottom: 2px;">
              ${proj.isService ? '🛠️ TAHAPAN JASA' : 'TASK'} ${mIdx + 1} &bull; ${escapeHtml(proj.projectName)}
            </div>
            <div style="font-weight: 700; font-size: 12px; margin-bottom: 4px;">${escapeHtml(ms.title)}</div>
            <div style="font-size: 10.5px; color: #cbd5e1; margin-bottom: 2px;">👤 PIC: <strong style="color: #fff;">${escapeHtml(msPic)}</strong></div>
            <div style="font-size: 10.5px; color: #cbd5e1; margin-bottom: 2px;">📅 Jadwal: <strong style="color: #fff;">${formatGanttDate(ms.startDate || proj.startDate)} &rarr; ${formatGanttDate(ms.dueDate || proj.dueDate)}</strong> (${msMetrics.durationDays} hari)</div>
            <div style="font-size: 10.5px; color: #cbd5e1;">⚡ Status: <strong style="color: #facc15;">${msStatusText}</strong></div>
            ${ms.notes ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 3px; border-top: 1px dashed #334155; padding-top: 3px;">📝 ${escapeHtml(ms.notes)}</div>` : ''}
          `;

          const isLast = (mIdx === milestones.length - 1);
          const branchChar = isLast ? '└──' : '├──';

          rowsHtml += `
            <tr class="gantt-task-row" style="height: 24px;">
              <!-- Col 1: Task Title (Width: 220px, Left: 0) -->
              <td class="gantt-col-task" style="position: sticky; left: 0; z-index: 5; background: #ffffff; width: 220px; min-width: 220px; max-width: 220px; padding-left: 14px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding-top: 2px; padding-bottom: 2px;">
                <div style="display: flex; align-items: center; gap: 4px; overflow: hidden;">
                  <span style="color: #94a3b8; font-family: monospace; font-size: 10px; user-select: none; flex-shrink: 0;">${branchChar}</span>
                  <div class="font-medium text-main" style="font-size: 10px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${escapeAttr(ms.title)}">
                    ${escapeHtml(ms.title)}
                  </div>
                </div>
              </td>

              <!-- Col 2: Task PIC (Width: 110px, Left: 220px) -->
              <td class="gantt-col-pic" style="position: sticky; left: 220px; z-index: 5; background: #ffffff; width: 110px; min-width: 110px; max-width: 110px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 2px 6px;">
                <div style="display: flex; align-items: center; gap: 4px; overflow: hidden;">
                  <div style="width: 16px; height: 16px; border-radius: 50%; background: ${proj.isService ? '#f97316' : (proj.isInternal ? '#14b8a6' : '#0284c7')}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; flex-shrink: 0;">
                    ${getPicAvatar(msPic)}
                  </div>
                  <div class="font-medium text-main" style="font-size: 9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(msPic)}">
                    ${escapeHtml(msPic)}
                  </div>
                </div>
              </td>

              <!-- Col 3: Task Schedule (Width: 100px, Left: 330px) -->
              <td class="gantt-col-schedule" style="position: sticky; left: 330px; z-index: 5; background: #ffffff; width: 100px; min-width: 100px; max-width: 100px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); padding: 2px 6px;">
                <div style="font-size: 9px; color: #334155; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${formatGanttDate(ms.startDate || proj.startDate)} &rarr; ${formatGanttDate(ms.dueDate || proj.dueDate)}
                </div>
              </td>

              <!-- Col 4: Task Status (Width: 85px, Left: 430px) -->
              <td class="gantt-col-status" style="position: sticky; left: 430px; z-index: 5; background: #ffffff; width: 85px; min-width: 85px; max-width: 85px; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1; padding: 2px 6px;">
                <span class="badge ${msBadgeClass}" style="font-size: 8px; padding: 0 4px;">
                  ${msStatusText}
                </span>
              </td>

              <!-- Col 5: Milestone Gantt Bar Track Canvas -->
              <td class="gantt-col-timeline" style="width: ${totalTimelineWidth}px; padding: 0;">
                <div class="gantt-track-canvas" style="width: ${totalTimelineWidth}px; height: 24px;">
                  <!-- Grid lines per week -->
                  ${weeks.map((w, wIdx) => `
                    <div class="gantt-grid-line ${w.isCurrentWeek ? 'current-week-grid' : ''}" style="left: ${wIdx * weekWidth}px; width: ${weekWidth}px;"></div>
                  `).join('')}

                  <!-- Today line -->
                  ${todayLeftPx >= 0 ? `<div class="gantt-today-line" style="left: ${todayLeftPx}px;"></div>` : ''}

                  <!-- Milestone Bar -->
                  <div class="gantt-bar-item ${msClass}" 
                       style="left: ${msMetrics.leftPx}px; width: ${msMetrics.widthPx}px; height: 14px; border-radius: 3px;"
                       data-gantt-tip="${msTipKey}"
                       onclick="${barOnClickAttr}">
                    <span class="gantt-bar-text" style="font-size: 8.5px; padding: 0 3px;">
                      ${isComp ? '✓' : isInProg ? '⚡' : isOver ? '⚠' : ''}
                      ${msMetrics.widthPx >= 35 ? `<strong>${escapeHtml(ms.title)}</strong>` : ''}
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          `;
        });
      }
    }
  });

  // Assemble full table
  container.innerHTML = `
    <table class="gantt-table">
      ${headerHtml}
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  // Delegasi Event Tooltip Terpusat (Bebas dari bug kutip string atribut HTML)
  container.onmouseover = function(e) {
    const bar = e.target.closest('[data-gantt-tip]');
    if (bar) {
      const key = bar.getAttribute('data-gantt-tip');
      if (window._ganttTooltips && window._ganttTooltips[key]) {
        showGanttTooltip(e, window._ganttTooltips[key]);
      }
    }
  };
  container.onmousemove = function(e) {
    if (e.target.closest('[data-gantt-tip]')) {
      moveGanttTooltip(e);
    }
  };
  container.onmouseout = function(e) {
    if (e.target.closest('[data-gantt-tip]')) {
      hideGanttTooltip();
    }
  };

  if (window.lucide) lucide.createIcons();
}

