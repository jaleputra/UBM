// =========================================================
// UBM - Dashboard & Gantt Chart Timeline Monitoring Module
// =========================================================

async function loadDashboardData() {
  try {
    // 1. Pastikan data orders dan projects sudah tersedia sebelum render agar Gantt Chart tidak kosong
    if (!state.projects || !state.orders || state.projects.length === 0) {
      await Promise.allSettled([
        fetchResource('orders'),
        fetchResource('projects')
      ]);
    }

    const res = await fetch(`/api/stats?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const data = await res.json();
    state.stats = data;

    // Render Summary KPI Cards
    const summary = data.summary || {};
    const kpiQuotationsVal = document.getElementById('kpi-quotations-val');
    const kpiQuotationsAmount = document.getElementById('kpi-quotations-amount');
    if (kpiQuotationsVal) kpiQuotationsVal.textContent = `${summary.totalQuotations || 0} Penawaran`;
    if (kpiQuotationsAmount) kpiQuotationsAmount.textContent = formatRupiah(summary.totalQuotationValue || 0);

    const kpiOrdersVal = document.getElementById('kpi-orders-val');
    const kpiOrdersAmount = document.getElementById('kpi-orders-amount');
    if (kpiOrdersVal) kpiOrdersVal.textContent = `${summary.totalOrders || 0} Order`;
    if (kpiOrdersAmount) kpiOrdersAmount.textContent = formatRupiah(summary.totalOrderValue || 0);

    const kpiInvoicesVal = document.getElementById('kpi-invoices-val');
    const kpiInvoicesAmount = document.getElementById('kpi-invoices-amount');
    if (kpiInvoicesVal) kpiInvoicesVal.textContent = `${(summary.totalInvoices || 0) - (summary.paidInvoices || 0)} Faktur`;
    if (kpiInvoicesAmount) kpiInvoicesAmount.textContent = formatRupiah(summary.unpaidInvoicesValue || 0);

    const kpiDeliveryVal = document.getElementById('kpi-delivery-val');
    const kpiDeliveryActive = document.getElementById('kpi-delivery-active');
    if (kpiDeliveryVal) kpiDeliveryVal.textContent = `${summary.totalDeliveries || 0} Pengiriman`;
    if (kpiDeliveryActive) kpiDeliveryActive.textContent = `${summary.activeDeliveries || 0} Pengiriman Aktif`;

    // Render Gantt Chart Project Timeline Table (Tab Ringkasan)
    renderDashboardGanttChart();

    // Render Project Tab Gantt Chart & Sync Stats
    renderDashboardProjectGantt();

    // Selalu pastikan tab Project (Gantt Chart Berjalan) aktif saat dashboard dibuka
    try { localStorage.removeItem('ubm_dashboard_active_tab'); } catch (e) {}
    switchDashboardTab('project');

    // Render Recent Activities
    const actList = document.getElementById('dashboard-activity-list');
    if (actList) {
      if (data.recentActivities && data.recentActivities.length > 0) {
        actList.innerHTML = data.recentActivities.map(act => `
          <div class="activity-item">
            <div class="activity-left">
              <span class="activity-tag tag-${act.type}">${act.type}</span>
              <div>
                <div class="activity-text">${act.title}</div>
                <div class="activity-sub">${act.date} &bull; Status: <span class="text-warning">${act.status || 'Active'}</span></div>
              </div>
            </div>
            ${act.amount ? `<div class="font-mono font-bold font-sm">${formatRupiah(act.amount)}</div>` : ''}
          </div>
        `).join('');
      } else {
        actList.innerHTML = '<div class="text-muted p-3 text-center">Belum ada riwayat aktivitas.</div>';
      }
    }

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
  if (input) input.focus();
}

// -------------------------------------------------------------
// GANTT CHART & PROJECT TIMELINE MONITORING TABLE RENDERER
// -------------------------------------------------------------
function renderDashboardGanttChart() {
  const tbody = document.getElementById('gantt-chart-table-body');
  if (!tbody) return;

  const orders = state.orders || [];
  const projects = state.projects || [];
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
function toggleGanttFullScreen() {
  // Ensure dashboard Project tab is open first
  if (typeof switchDashboardTab === 'function') {
    switchDashboardTab('project');
  }

  const wrapper = document.querySelector('.dashboard-gantt-wrapper');
  if (!wrapper) return;
  const isFull = wrapper.classList.toggle('gantt-fullscreen-mode');

  // Update button icon & text
  const icon = document.getElementById('btn-gantt-fullscreen-icon');
  const text = document.getElementById('btn-gantt-fullscreen-text');
  if (icon) {
    icon.setAttribute('data-lucide', isFull ? 'minimize-2' : 'maximize');
  }
  if (text) {
    text.textContent = isFull ? 'Keluar Fullscreen (ESC)' : 'Layar Penuh';
  }

  // Prevent background scrolling when in full screen
  document.body.style.overflow = isFull ? 'hidden' : '';

  if (window.lucide) {
    lucide.createIcons();
  }

  // Ensure scroll is centered on current position or today
  setTimeout(scrollGanttToToday, 120);
}
window.toggleGanttFullScreen = toggleGanttFullScreen;

// ESC key to exit full screen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const wrapper = document.querySelector('.dashboard-gantt-wrapper');
    if (wrapper && wrapper.classList.contains('gantt-fullscreen-mode')) {
      toggleGanttFullScreen();
    }
  }
});

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
  if (document.getElementById('dashboard-gantt-tooltip')) return;
  const tip = document.createElement('div');
  tip.id = 'dashboard-gantt-tooltip';
  tip.className = 'gantt-tooltip';
  document.body.appendChild(tip);
}

function showGanttTooltip(e, html) {
  initGanttTooltip();
  const tip = document.getElementById('dashboard-gantt-tooltip');
  if (!tip) return;
  tip.innerHTML = html;
  tip.classList.add('visible');
  moveGanttTooltip(e);
}

function moveGanttTooltip(e) {
  const tip = document.getElementById('dashboard-gantt-tooltip');
  if (!tip || !tip.classList.contains('visible')) return;
  const x = e.clientX + 14;
  const y = e.clientY + 14;
  tip.style.left = `${Math.min(window.innerWidth - 300, x)}px`;
  tip.style.top = `${Math.min(window.innerHeight - 150, y)}px`;
}

function hideGanttTooltip() {
  const tip = document.getElementById('dashboard-gantt-tooltip');
  if (tip) tip.classList.remove('visible');
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

  const orders = state.orders || [];
  const projects = state.projects || [];
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Gather all projects (both direct projects and order-linked projects)
  const combinedProjects = [];
  const processedOrderIds = new Set();

  projects.forEach(p => {
    const matchingOrder = p.orderId ? orders.find(o => o.id === p.orderId) : null;
    if (p.orderId) processedOrderIds.add(p.orderId);

    const firstItem = matchingOrder?.items?.[0]?.itemName || '';
    const projName = p.projectName || matchingOrder?.projectName || (firstItem ? `${firstItem} (${matchingOrder?.customerName || ''})` : 'Project Mandiri');
    const custName = p.customerName || matchingOrder?.customerName || (p.isDirect ? 'Internal UBM' : '-');
    const start = p.startDate || matchingOrder?.orderDate || todayStr;
    const due = p.dueDate || matchingOrder?.dueDate || '';

    combinedProjects.push({
      id: p.id,
      orderId: p.orderId || null,
      projectName: projName,
      customerName: custName,
      projectLead: p.projectLead || 'Belum diassign',
      department: p.department || 'Engineering',
      status: p.status || 'In Progress',
      startDate: start,
      dueDate: due,
      progressPercent: typeof p.progressPercent === 'number' ? p.progressPercent : 0,
      milestones: p.milestones || [],
      team: p.team || [],
      isDirect: Boolean(p.isDirect || !p.orderId),
      order: matchingOrder
    });
  });

  // Include active orders that don't have an explicit projects record
  orders.forEach(ord => {
    if (!processedOrderIds.has(ord.id) && ord.status !== 'Delivered' && ord.status !== 'Cancelled') {
      const firstItem = ord.items?.[0]?.itemName || 'Produk Pesanan';
      combinedProjects.push({
        id: `PRJ-${ord.id}`,
        orderId: ord.id,
        projectName: ord.projectName || `${firstItem} (${ord.customerName || ''})`,
        customerName: ord.customerName || '-',
        projectLead: 'Belum diassign',
        department: 'Engineering',
        status: ord.status === 'Accepted' || ord.status === 'In Production' ? 'In Progress' : 'Planning',
        startDate: ord.orderDate || todayStr,
        dueDate: ord.dueDate || '',
        progressPercent: 0,
        milestones: [],
        team: [],
        isDirect: false,
        order: ord
      });
    }
  });

  // Calculate Running Project Status Helper
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
  if (kpiRunning) kpiRunning.textContent = `${runningProjects.length} Project`;
  if (kpiRunningSub) kpiRunningSub.textContent = runningProjects.length > 0 ? `${runningProjects.length} Project Aktif Dikerjakan` : 'Tidak Ada Project Berjalan';

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

  // 2. Apply Filters (Status Filter & Search Filter)
  const filterSelect = document.getElementById('gantt-status-filter');
  const filterMode = filterSelect?.value || 'ALL';

  let displayProjects = combinedProjects;
  if (filterMode === 'RUNNING') {
    displayProjects = runningProjects;
  } else if (filterMode === 'OVERDUE') {
    displayProjects = combinedProjects.filter(p => {
      const isOver = p.dueDate && p.dueDate < todayStr && p.status !== 'Completed';
      const hasOverTask = (p.milestones || []).some(m => m.dueDate && m.dueDate < todayStr && m.status !== 'Completed');
      return isOver || hasOverTask;
    });
  } else if (filterMode === 'ON_TRACK') {
    displayProjects = runningProjects.filter(p => {
      const isOver = p.dueDate && p.dueDate < todayStr;
      const hasOverTask = (p.milestones || []).some(m => m.dueDate && m.dueDate < todayStr && m.status !== 'Completed');
      return !isOver && !hasOverTask;
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
        <h4 style="font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 6px 0;">Tidak Ada Project Berjalan Ditemukan</h4>
        <p style="font-size: 12.5px; color: #64748b; margin: 0 0 16px 0; max-width: 440px; margin-left: auto; margin-right: auto;">
          ${searchQuery ? `Tidak ada project atau task yang cocok dengan pencarian "<strong>${escapeHtml(searchQuery)}</strong>".` : 'Saat ini belum ada project berstatus berjalan. Buat project baru melalui menu Project Management atau Order Penjualan.'}
        </p>
        <button type="button" class="btn btn-primary" onclick="navigateTo('projects')" style="display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="plus"></i> Buka Project Management
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // 3. Compute dynamic date bounds for timeline
  const allDateObjects = [];
  displayProjects.forEach(p => {
    if (p.startDate && p.startDate !== '-') allDateObjects.push(new Date(p.startDate));
    if (p.dueDate && p.dueDate !== '-') allDateObjects.push(new Date(p.dueDate));
    (p.milestones || []).forEach(m => {
      if (m.startDate && m.startDate !== '-') allDateObjects.push(new Date(m.startDate));
      if (m.dueDate && m.dueDate !== '-') allDateObjects.push(new Date(m.dueDate));
    });
  });

  const todayDate = new Date(todayStr);
  allDateObjects.push(todayDate);

  let minTime = Math.min(...allDateObjects.map(d => d.getTime()));
  let maxTime = Math.max(...allDateObjects.map(d => d.getTime()));

  // Add margin around dates
  const minDate = new Date(minTime);
  minDate.setDate(minDate.getDate() - 3);

  const maxDate = new Date(maxTime);
  maxDate.setDate(maxDate.getDate() + 5);

  // Ensure minimum 21 days for aesthetic spacing
  const diffTimeMs = maxDate.getTime() - minDate.getTime();
  const diffDaysCount = Math.round(diffTimeMs / (1000 * 60 * 60 * 24));
  if (diffDaysCount < 21) {
    maxDate.setDate(maxDate.getDate() + (21 - diffDaysCount));
  }

  // Generate sequence of days
  const days = [];
  const dayWidth = 38; // px width per day column
  const dayNamesShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const monthNamesIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  let iterDate = new Date(minDate);
  while (iterDate <= maxDate) {
    const dStr = iterDate.toISOString().split('T')[0];
    const dayOfWeek = iterDate.getDay();
    const dayNum = iterDate.getDate();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isToday = (dStr === todayStr);

    days.push({
      dateStr: dStr,
      dayNum,
      dayName: dayNamesShort[dayOfWeek],
      monthName: monthNamesIndo[iterDate.getMonth()],
      monthIdx: iterDate.getMonth(),
      year: iterDate.getFullYear(),
      isWeekend,
      isToday,
      time: iterDate.getTime()
    });

    iterDate.setDate(iterDate.getDate() + 1);
  }

  const totalTimelineWidth = days.length * dayWidth;
  const todayIndex = days.findIndex(d => d.isToday);
  const todayLeftPx = todayIndex >= 0 ? (todayIndex * dayWidth + (dayWidth / 2)) : -100;

  // Group consecutive days by Month for Header
  const monthGroups = [];
  let currentGroup = null;
  days.forEach((d, idx) => {
    const label = `${d.monthName} ${d.year}`;
    if (!currentGroup || currentGroup.label !== label) {
      if (currentGroup) monthGroups.push(currentGroup);
      currentGroup = { label, count: 1, startIndex: idx };
    } else {
      currentGroup.count++;
    }
  });
  if (currentGroup) monthGroups.push(currentGroup);

  // Date positioning helper
  function calculateBarMetrics(startStr, endStr) {
    const sStr = startStr && startStr !== '-' ? startStr : todayStr;
    const eStr = endStr && endStr !== '-' ? endStr : sStr;

    const sTime = new Date(sStr).getTime();
    const eTime = new Date(eStr).getTime();

    const minTime = days[0].time;
    const sOffsetDays = Math.max(0, Math.round((sTime - minTime) / (1000 * 60 * 60 * 24)));
    const eOffsetDays = Math.min(days.length - 1, Math.max(sOffsetDays, Math.round((eTime - minTime) / (1000 * 60 * 60 * 24))));

    const durationDays = Math.max(1, (eOffsetDays - sOffsetDays) + 1);
    const leftPx = sOffsetDays * dayWidth + 3;
    const widthPx = Math.max(28, durationDays * dayWidth - 6);

    return { leftPx, widthPx, durationDays };
  }

  // 4. Render Table Header
  const headerHtml = `
    <thead>
      <tr>
        <th class="gantt-col-task" style="position: sticky; left: 0; z-index: 20; background: #f8fafc; width: 320px; min-width: 300px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="layers" style="width: 13px; height: 13px; color: #4f46e5;"></i>
            <span>PROJECT & TAHAPAN TASK</span>
          </div>
        </th>
        <th class="gantt-col-pic" style="position: sticky; left: 320px; z-index: 20; background: #f8fafc; width: 170px; min-width: 160px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="user-check" style="width: 13px; height: 13px; color: #0284c7;"></i>
            <span>PIC (PENANGGUNG JAWAB)</span>
          </div>
        </th>
        <th class="gantt-col-schedule" style="position: sticky; left: 490px; z-index: 20; background: #f8fafc; width: 170px; min-width: 160px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="calendar" style="width: 13px; height: 13px; color: #16a34a;"></i>
            <span>JADWAL (SCHEDULE)</span>
          </div>
        </th>
        <th class="gantt-col-status" style="position: sticky; left: 660px; z-index: 20; background: #f8fafc; width: 150px; min-width: 140px; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="activity" style="width: 13px; height: 13px; color: #d97706;"></i>
            <span>PROGRESS & STATUS</span>
          </div>
        </th>
        <th class="gantt-col-timeline" style="width: ${totalTimelineWidth}px; min-width: ${totalTimelineWidth}px; padding: 0;">
          <div class="gantt-timeline-header-container" style="width: ${totalTimelineWidth}px;">
            <!-- Month Row -->
            <div class="gantt-month-row">
              ${monthGroups.map(mg => `
                <div class="gantt-month-cell" style="width: ${mg.count * dayWidth}px;">
                  ${mg.label}
                </div>
              `).join('')}
            </div>
            <!-- Days Row -->
            <div class="gantt-days-row" style="position: relative;">
              ${days.map(d => `
                <div class="gantt-day-cell ${d.isWeekend ? 'weekend' : ''} ${d.isToday ? 'today' : ''}" style="width: ${dayWidth}px;">
                  <span style="font-size: 8.5px; text-transform: uppercase;">${d.dayName}</span>
                  <span style="font-weight: 700; font-size: 11px;">${d.dayNum}</span>
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
    if (totalMs > 0 && projProgress === 0) {
      projProgress = Math.min(100, Math.round(((completedMs + inProgressMs * 0.5) / totalMs) * 100));
    }

    // Determine status badge
    let statusBadgeClass = 'badge-secondary';
    let statusLabel = proj.status || 'Planning';
    let statusIcon = 'clock';

    if (projProgress >= 100 || proj.status === 'Completed') {
      statusBadgeClass = 'badge-success';
      statusLabel = 'Completed';
      statusIcon = 'check-circle';
    } else if (overdueMs > 0 || (proj.dueDate && proj.dueDate < todayStr)) {
      statusBadgeClass = 'badge-danger';
      statusLabel = 'Overdue';
      statusIcon = 'alert-triangle';
    } else if (inProgressMs > 0 || proj.status === 'In Progress') {
      statusBadgeClass = 'badge-purple';
      statusLabel = 'In Progress';
      statusIcon = 'play-circle';
    }

    const projMetrics = calculateBarMetrics(proj.startDate, proj.dueDate);
    const codeBadge = proj.orderId ? escapeHtml(proj.orderId) : (proj.isDirect ? 'DIRECT' : escapeHtml(proj.id));
    const codeClass = proj.orderId ? 'text-primary' : 'text-purple';

    // Tooltip data for project bar
    const projTooltipHtml = `
      <div style="font-weight: 700; color: #a5b4fc; font-size: 11px; margin-bottom: 3px;">PROJECT INDUK</div>
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">${escapeHtml(proj.projectName)}</div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">🏢 Pelanggan: <strong style="color: #fff;">${escapeHtml(proj.customerName)}</strong></div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">👤 Project Lead: <strong style="color: #fff;">${escapeHtml(proj.projectLead)}</strong></div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">📅 Jadwal: <strong style="color: #fff;">${formatGanttDate(proj.startDate)} &rarr; ${formatGanttDate(proj.dueDate)}</strong> (${projMetrics.durationDays} hari)</div>
      <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">📊 Progress: <strong style="color: #4ade80;">${projProgress}%</strong> (${completedMs}/${totalMs} Task Selesai)</div>
      <div style="font-size: 11px; color: #cbd5e1;">⚡ Status: <strong style="color: #facc15;">${statusLabel}</strong></div>
      <div style="margin-top: 8px; font-size: 10px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 4px;">👉 Klik untuk buka Timeline Project</div>
    `;

    // A. Project Parent Row
    rowsHtml += `
      <tr class="gantt-project-header-row">
        <!-- Col 1: Project Info -->
        <td class="gantt-col-task" style="position: sticky; left: 0; z-index: 10; background: #f8fafc; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="btn-ghost btn-xs" onclick="toggleGanttProjectCollapse('${proj.id}')" title="${isCollapsed ? 'Buka Task' : 'Tutup Task'}" style="padding: 2px 4px; display: inline-flex; align-items: center; justify-content: center; color: #475569;">
              <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" style="width: 15px; height: 15px;"></i>
            </button>
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="mono-id font-bold ${codeClass}" style="font-size: 10.5px; background: rgba(79, 70, 229, 0.08); padding: 1px 5px; border-radius: 4px;">${codeBadge}</span>
                <span class="font-bold text-main" style="font-size: 12.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(proj.projectName)}">${escapeHtml(proj.projectName)}</span>
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                <span>🏢 ${escapeHtml(proj.customerName)}</span>
                <span>&bull;</span>
                <span class="text-primary" style="font-weight: 600;">${totalMs} Task</span>
              </div>
            </div>
            <button type="button" class="btn btn-xs btn-outline" onclick="openProjectTimelinePage('${proj.orderId || proj.id}')" title="Buka Detail Timeline" style="font-size: 10px; padding: 2px 6px; white-space: nowrap;">
              <i data-lucide="external-link" style="width: 11px; height: 11px;"></i>
            </button>
          </div>
        </td>

        <!-- Col 2: PIC Lead -->
        <td class="gantt-col-pic" style="position: sticky; left: 320px; z-index: 10; background: #f8fafc; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center; gap: 7px;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #4f46e5; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">
              ${getPicAvatar(proj.projectLead)}
            </div>
            <div style="min-width: 0;">
              <div class="font-bold text-main" style="font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(proj.projectLead)}">${escapeHtml(proj.projectLead)}</div>
              <div class="text-muted" style="font-size: 10px;">${escapeHtml(proj.department)}</div>
            </div>
          </div>
        </td>

        <!-- Col 3: Schedule -->
        <td class="gantt-col-schedule" style="position: sticky; left: 490px; z-index: 10; background: #f8fafc; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
          <div style="font-size: 11px; font-weight: 700; color: #1e293b;">
            ${formatGanttDate(proj.startDate)} &rarr; ${formatGanttDate(proj.dueDate)}
          </div>
          <div style="margin-top: 2px;">
            <span class="badge badge-secondary" style="font-size: 9.5px; padding: 1px 5px; font-weight: 600;">
              Durasi: ${projMetrics.durationDays} Hari
            </span>
          </div>
        </td>

        <!-- Col 4: Status & Progress -->
        <td class="gantt-col-status" style="position: sticky; left: 660px; z-index: 10; background: #f8fafc; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; margin-bottom: 2px;">
            <span class="badge ${statusBadgeClass}" style="font-size: 9.5px; padding: 2px 6px;">
              <i data-lucide="${statusIcon}" style="width: 10px; height: 10px;"></i> ${statusLabel}
            </span>
            <span class="font-bold text-primary font-mono">${projProgress}%</span>
          </div>
          <div style="height: 5px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
            <div style="width: ${projProgress}%; height: 100%; background: ${projProgress >= 100 ? '#10b981' : '#4f46e5'};"></div>
          </div>
        </td>

        <!-- Col 5: Gantt Bar Track Canvas -->
        <td class="gantt-col-timeline" style="width: ${totalTimelineWidth}px;">
          <div class="gantt-track-canvas" style="width: ${totalTimelineWidth}px;">
            <!-- Grid lines -->
            ${days.map((d, dIdx) => `
              <div class="gantt-grid-line ${d.isWeekend ? 'weekend' : ''}" style="left: ${dIdx * dayWidth}px; width: ${dayWidth}px;"></div>
            `).join('')}

            <!-- Today marker line -->
            ${todayLeftPx >= 0 ? `<div class="gantt-today-line" style="left: ${todayLeftPx}px;"></div>` : ''}

            <!-- Project Summary Bar -->
            <div class="gantt-bar-item project-summary" style="left: ${projMetrics.leftPx}px; width: ${projMetrics.widthPx}px;"
                 onmouseenter="showGanttTooltip(event, \`${projTooltipHtml.replace(/`/g, '\\`')}\`)"
                 onmousemove="moveGanttTooltip(event)"
                 onmouseleave="hideGanttTooltip()"
                 onclick="openProjectTimelinePage('${proj.orderId || proj.id}')">
              <div class="gantt-bar-progress-fill" style="width: ${projProgress}%;"></div>
              <span class="gantt-bar-text">
                <i data-lucide="folder" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
                <strong>${escapeHtml(proj.projectName)}</strong> (${projProgress}% • ${projMetrics.durationDays}h)
              </span>
            </div>
          </div>
        </td>
      </tr>
    `;

    // B. Project Tasks / Milestones Rows (when expanded)
    if (!isCollapsed) {
      if (milestones.length === 0) {
        rowsHtml += `
          <tr class="gantt-task-row">
            <td class="gantt-col-task" style="position: sticky; left: 0; z-index: 5; background: #ffffff; padding-left: 36px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
              <div style="font-size: 11.5px; color: #94a3b8; font-style: italic;">
                Belum ada rincian tahapan task pada project ini.
              </div>
            </td>
            <td class="gantt-col-pic" style="position: sticky; left: 320px; z-index: 5; background: #ffffff; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
              <span class="text-muted" style="font-size: 11px;">-</span>
            </td>
            <td class="gantt-col-schedule" style="position: sticky; left: 490px; z-index: 5; background: #ffffff; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
              <span class="text-muted" style="font-size: 11px;">-</span>
            </td>
            <td class="gantt-col-status" style="position: sticky; left: 660px; z-index: 5; background: #ffffff; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1;">
              <button type="button" class="btn btn-xs btn-outline" onclick="openProjectTimelinePage('${proj.orderId || proj.id}')" style="font-size: 10px; padding: 2px 7px;">
                <i data-lucide="plus"></i> Atur Timeline
              </button>
            </td>
            <td class="gantt-col-timeline" style="width: ${totalTimelineWidth}px;">
              <div class="gantt-track-canvas" style="width: ${totalTimelineWidth}px;">
                ${days.map((d, dIdx) => `
                  <div class="gantt-grid-line ${d.isWeekend ? 'weekend' : ''}" style="left: ${dIdx * dayWidth}px; width: ${dayWidth}px;"></div>
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

          let msClass = 'status-pending';
          let msBadgeClass = 'badge-secondary';
          let msStatusText = ms.status || 'Pending';
          let msIcon = 'clock';

          if (isComp) {
            msClass = 'status-completed';
            msBadgeClass = 'badge-success';
            msStatusText = 'Completed';
            msIcon = 'check-circle';
          } else if (isOver) {
            msClass = 'status-overdue';
            msBadgeClass = 'badge-danger';
            msStatusText = 'Overdue';
            msIcon = 'alert-triangle';
          } else if (isInProg) {
            msClass = 'status-in-progress';
            msBadgeClass = 'badge-purple';
            msStatusText = 'In Progress';
            msIcon = 'play-circle';
          }

          const msMetrics = calculateBarMetrics(ms.startDate || proj.startDate, ms.dueDate || proj.dueDate);
          const subtasks = ms.subtasks || [];
          const subtaskDone = subtasks.filter(s => s.done).length;
          const msPercent = isComp ? 100 : (subtasks.length > 0 ? Math.round((subtaskDone / subtasks.length) * 100) : (isInProg ? 50 : 0));
          const msPic = ms.pic || proj.projectLead || 'Belum diassign';

          const msTooltipHtml = `
            <div style="font-weight: 700; color: #93c5fd; font-size: 11px; margin-bottom: 2px;">TASK ${mIdx + 1} &bull; ${escapeHtml(proj.projectName)}</div>
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">${escapeHtml(ms.title)}</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">👤 PIC: <strong style="color: #fff;">${escapeHtml(msPic)}</strong></div>
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">📅 Jadwal: <strong style="color: #fff;">${formatGanttDate(ms.startDate || proj.startDate)} &rarr; ${formatGanttDate(ms.dueDate || proj.dueDate)}</strong> (${msMetrics.durationDays} hari)</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">⚡ Status: <strong style="color: #facc15;">${msStatusText}</strong></div>
            ${subtasks.length > 0 ? `<div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">📋 Subtask: <strong style="color: #fff;">${subtaskDone} dari ${subtasks.length} selesai (${msPercent}%)</strong></div>` : ''}
            <div style="margin-top: 8px; font-size: 10px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 4px;">👉 Klik untuk membuka detail tugas</div>
          `;

          const isLast = (mIdx === milestones.length - 1);
          const branchChar = isLast ? '└──' : '├──';

          rowsHtml += `
            <tr class="gantt-task-row">
              <!-- Col 1: Task Title -->
              <td class="gantt-col-task" style="position: sticky; left: 0; z-index: 5; background: #ffffff; padding-left: 28px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="color: #94a3b8; font-family: monospace; font-size: 13px; user-select: none;">${branchChar}</span>
                  <div style="min-width: 0; flex: 1;">
                    <div class="font-bold text-main" style="font-size: 12px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(ms.title)}">
                      ${escapeHtml(ms.title)}
                    </div>
                    ${subtasks.length > 0 ? `
                      <div style="font-size: 10px; color: #64748b; margin-top: 1px;">
                        ✓ ${subtaskDone}/${subtasks.length} subtask
                      </div>
                    ` : ''}
                  </div>
                </div>
              </td>

              <!-- Col 2: Task PIC -->
              <td class="gantt-col-pic" style="position: sticky; left: 320px; z-index: 5; background: #ffffff; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <div style="width: 22px; height: 22px; border-radius: 50%; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 700; flex-shrink: 0;">
                    ${getPicAvatar(msPic)}
                  </div>
                  <div class="font-medium text-main" style="font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(msPic)}">
                    ${escapeHtml(msPic)}
                  </div>
                </div>
              </td>

              <!-- Col 3: Task Schedule -->
              <td class="gantt-col-schedule" style="position: sticky; left: 490px; z-index: 5; background: #ffffff; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06);">
                <div style="font-size: 11px; color: #334155; font-weight: 600;">
                  ${formatGanttDate(ms.startDate || proj.startDate)} &rarr; ${formatGanttDate(ms.dueDate || proj.dueDate)}
                </div>
                <div style="font-size: 10px; color: #64748b; margin-top: 1px;">
                  ${msMetrics.durationDays} hari kerja
                </div>
              </td>

              <!-- Col 4: Task Status -->
              <td class="gantt-col-status" style="position: sticky; left: 660px; z-index: 5; background: #ffffff; box-shadow: 3px 0 6px -2px rgba(0,0,0,0.12); border-right: 2px solid #cbd5e1;">
                <span class="badge ${msBadgeClass}" style="font-size: 9.5px; padding: 2px 6px;">
                  <i data-lucide="${msIcon}" style="width: 10px; height: 10px;"></i> ${msStatusText}
                </span>
                ${msPercent > 0 ? `<span style="font-size: 10px; color: #64748b; margin-left: 4px; font-weight: 600;">${msPercent}%</span>` : ''}
              </td>

              <!-- Col 5: Milestone Gantt Bar Track Canvas -->
              <td class="gantt-col-timeline" style="width: ${totalTimelineWidth}px;">
                <div class="gantt-track-canvas" style="width: ${totalTimelineWidth}px;">
                  <!-- Grid lines -->
                  ${days.map((d, dIdx) => `
                    <div class="gantt-grid-line ${d.isWeekend ? 'weekend' : ''}" style="left: ${dIdx * dayWidth}px; width: ${dayWidth}px;"></div>
                  `).join('')}

                  <!-- Today line -->
                  ${todayLeftPx >= 0 ? `<div class="gantt-today-line" style="left: ${todayLeftPx}px;"></div>` : ''}

                  <!-- Milestone Bar -->
                  <div class="gantt-bar-item ${msClass}" style="left: ${msMetrics.leftPx}px; width: ${msMetrics.widthPx}px;"
                       onmouseenter="showGanttTooltip(event, \`${msTooltipHtml.replace(/`/g, '\\`')}\`)"
                       onmousemove="moveGanttTooltip(event)"
                       onmouseleave="hideGanttTooltip()"
                       onclick="openGanttMilestoneDetail('${proj.id}', '${ms.id}')">
                    <div class="gantt-bar-progress-fill" style="width: ${msPercent}%;"></div>
                    <span class="gantt-bar-text">
                      ${isComp ? '✓' : isInProg ? '⚡' : isOver ? '⚠' : '○'}
                      <strong>${escapeHtml(ms.title)}</strong> (${msPic} • ${msMetrics.durationDays}h)
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

  if (window.lucide) lucide.createIcons();
}

