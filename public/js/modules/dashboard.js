// =========================================================
// UBM - Dashboard & Gantt Chart Timeline Monitoring Module
// =========================================================

async function loadDashboardData() {
  try {
    const res = await fetch('/api/stats');
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

    // Render Gantt Chart Project Timeline Table
    renderDashboardGanttChart();

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

  // Process all project items
  const processedItems = orders.map(order => {
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
      // Jika belum ditentukan Project Management & Timelinenya, PROGRESS tetap 0%
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
      // Belum ditentukan Project Management & Timeline atau status masih Pending (Belum Mulai)
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

    return {
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
      hasInProgressMilestone: (inProgressMs > 0 || completedMs > 0)
    };
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
          <span class="mono-id font-bold text-primary" style="font-size: 11.5px;">${escapeHtml(item.order.id)}</span>
        </td>
        <td style="vertical-align: middle;">
          <div class="font-bold text-main" style="font-size: 12.5px;">${escapeHtml(item.order.customerName)}</div>
          ${item.order.customerPhone ? `<div class="text-muted font-sm" style="font-size: 11px; margin-top: 1px;">📞 ${escapeHtml(item.order.customerPhone)}</div>` : ''}
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
            <button class="btn btn-sm btn-primary" title="Buka Detail Monitoring Timeline & Gantt Chart" style="background: #4f46e5; border-color: #4f46e5; padding: 5px 12px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; white-space: nowrap;" onclick="openGanttDetailModal('${item.order.id}')">
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
function openGanttDetailModal(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
  const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
  if (!isPOAndAccepted) {
    if (typeof promptPenugasanDisabled === 'function') {
      promptPenugasanDisabled(orderId);
    } else {
      showToast('⚠️ Wajib upload PO Pelanggan dan status Accepted terlebih dahulu!', 'warning');
    }
    return;
  }

  const project = (state.projects || []).find(p => p.orderId === orderId);
  const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
  if (!hasProjectLead) {
    showToast('⚠️ Tentukan Project Leader pada menu Penugasan Tim terlebih dahulu!', 'warning');
    if (typeof openTeamAssignmentPage === 'function') {
      openTeamAssignmentPage(orderId);
    }
    return;
  }

  const hasBOM = (state.bom || []).some(b => b.orderId === orderId || (order.items || []).some(item => b.productName && item.itemName && b.productName.toLowerCase().trim() === item.itemName.toLowerCase().trim()));
  if (!hasBOM) {
    showToast('⚠️ Bill of Materials (BOM) belum diisi untuk order ini. Silakan isi dan simpan BOM terlebih dahulu sebelum membuat Project Management!', 'warning');
    if (typeof createBOMFromOrder === 'function') {
      createBOMFromOrder(orderId);
    }
    return;
  }

  const milestones = project?.milestones || [];
  const inProgressMs = milestones.filter(m => m.status === 'In Progress' || m.status === 'in_progress').length;
  const completedMs = milestones.filter(m => m.status === 'Completed' || m.status === 'completed').length;
  const hasInProgressMilestone = (inProgressMs > 0 || completedMs > 0);

  if (!hasInProgressMilestone) {
    showToast('⚠️ Gantt Chart belum dapat dibuka karena belum ada milestone yang berstatus "In Progress" pada timeline project!', 'warning');
    return;
  }

  const projectName = order.projectName || project?.projectName || order.items?.[0]?.itemName || 'Project Pesanan';
  const firstItem = order.items?.[0]?.itemName || 'Produk Pesanan';
  const startDate = project?.startDate || order.orderDate || '-';
  const dueDate = project?.dueDate || order.dueDate || '-';
  const todayStr = new Date().toISOString().split('T')[0];

  // Header updates
  const orderIdTitle = document.getElementById('gantt-modal-order-id');
  if (orderIdTitle) orderIdTitle.textContent = `${order.id} - ${order.customerName}`;

  const subtitle = document.getElementById('gantt-modal-subtitle');
  if (subtitle) subtitle.textContent = `Project: ${projectName} | Pelanggan: ${order.customerName}`;

  const editBtn = document.getElementById('gantt-modal-edit-btn');
  if (editBtn) {
    editBtn.onclick = () => {
      closeModal('gantt-detail-modal');
      openProjectManagementPage(order.id);
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

  const isCompleted = hasTimeline && (progress >= 100 || project?.status === 'Completed' || order.status === 'Delivered');
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
    metaContainer.innerHTML = `
      <div>
        <div class="text-muted font-sm" style="font-size: 11px;">Project Lead / PIC:</div>
        <div class="font-bold text-main" style="font-size: 13px;">${project?.projectLead || 'Ir. Budi Santoso'}</div>
        <div class="text-muted" style="font-size: 11px;">${project?.department || 'Engineering'}</div>
      </div>
      <div>
        <div class="text-muted font-sm" style="font-size: 11px;">Timeline Project:</div>
        <div class="font-bold text-main" style="font-size: 13px;">${startDate} &rarr; ${dueDate}</div>
        <div class="text-muted" style="font-size: 11px;">Nilai Order: <strong>${formatRupiah(order.grandTotal)}</strong></div>
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
