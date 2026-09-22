// =========================================================
// UBM - Project Management Module (Team Assignment & Timeline Milestone)
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

let currentActiveProjectOrderId = null;

// -------------------------------------------------------------
// 1. PROJECT MANAGEMENT OVERVIEW TABLE & DETAIL POPUP
// -------------------------------------------------------------
function renderProjectsTableView() {
  const tbody = document.getElementById('table-projects-body');
  if (!tbody) return;

  let list = state.projects || [];
  const statusFilter = document.getElementById('filter-project-status')?.value || 'ALL';

  if (statusFilter !== 'ALL') {
    list = list.filter(p => p.status === statusFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => 
      p.id.toLowerCase().includes(q) ||
      (p.projectName && p.projectName.toLowerCase().includes(q)) ||
      (p.customerName && p.customerName.toLowerCase().includes(q)) ||
      (p.projectLead && p.projectLead.toLowerCase().includes(q)) ||
      (p.department && p.department.toLowerCase().includes(q)) ||
      (p.team && p.team.some(m => m.name?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q)))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 32px;">Tidak ada data project ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(p => {
    const teamCount = p.team ? p.team.length : 0;
    const progress = p.progressPercent || 0;
    const isCompleted = p.status === 'Completed';
    const badgeClass = isCompleted ? 'badge-success' :
                       p.status === 'Planning' ? 'badge-info' :
                       p.status === 'In Progress' ? 'badge-amber' :
                       p.status === 'Testing & QC' ? 'badge-purple' :
                       p.status === 'On Hold' ? 'badge-secondary' : 'badge-info';

    const teamChips = (p.team || []).slice(0, 2).map(m => `
      <span class="badge badge-outline" style="font-size: 10px; padding: 2px 6px; border-color: #cbd5e1; margin-right: 3px; background: #ffffff;">
        <i data-lucide="user" style="width: 10px; height: 10px; display: inline;"></i> ${escapeHtml(m.name)}
      </span>
    `).join('');

    const moreTeam = teamCount > 2 ? `<span class="badge badge-secondary" style="font-size: 9.5px;">+${teamCount - 2}</span>` : '';

    const dateRange = p.startDate && p.dueDate ? `${p.startDate} s/d ${p.dueDate}` : (p.dueDate ? `Deadline: ${p.dueDate}` : '-');

    return `
      <tr style="cursor: pointer; transition: background-color 0.15s ease;" class="project-row" onclick="openProjectTimelinePage('${p.orderId || p.id}')" title="Klik untuk membuka Detail Timeline & Milestone">
        <td>
          <span class="mono-id font-bold text-primary" style="font-size: 11px;">${p.id}</span>
          ${p.orderId ? `<div class="font-xs text-muted font-mono" style="font-size: 10px; margin-top: 2px;">Ref: ${p.orderId}</div>` : ''}
        </td>
        <td>
          <div class="font-bold text-main" style="word-break: break-word; font-size: 13px; color: #1e40af;">${escapeHtml(p.projectName || 'Project Engineering')}</div>
          <div class="text-muted font-sm" style="font-size: 11.5px; margin-top: 2px;"><i data-lucide="building" style="width: 11px; height: 11px; display: inline;"></i> ${escapeHtml(p.customerName || '-')}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 7px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0;">
              ${(p.projectLead || 'P').charAt(0)}
            </div>
            <div>
              <div class="font-bold text-main" style="font-size: 12px;">${escapeHtml(p.projectLead || 'Belum diassign')}</div>
              <div class="text-muted font-xs" style="font-size: 10.5px;">${escapeHtml(p.department || 'Engineering')}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 2px;">
            ${teamChips || '<span class="text-muted font-sm font-italic">Belum ada tim</span>'}
            ${moreTeam}
          </div>
        </td>
        <td style="font-size: 11px; font-weight: 600; color: #334155; line-height: 1.4;">
          ${dateRange}
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1; background: #e2e8f0; height: 7px; border-radius: 4px; overflow: hidden;">
              <div style="background: ${isCompleted ? '#10b981' : progress > 50 ? '#3b82f6' : '#f59e0b'}; height: 100%; width: ${progress}%;"></div>
            </div>
            <span class="font-mono font-bold font-xs" style="font-size: 11px; min-width: 34px;">${progress}%</span>
          </div>
        </td>
        <td style="text-align: center;"><span class="badge ${badgeClass}" style="font-size: 10px; padding: 3px 7px;">${p.status || 'Planning'}</span></td>
        <td class="text-right" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-outline" style="color: #4f46e5; border-color: #c7d2fe; font-size: 11px; padding: 4px 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: #fdf4ff;" onclick="openProjectTimelinePage('${p.orderId || p.id}')" title="Buka Detail Timeline & Milestone">
            <i data-lucide="folder-kanban" style="width: 13px; height: 13px;"></i> Timeline &rarr;
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterProjectsTable() {
  renderProjectsTableView();
}

function viewProjectDetail(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan!', 'error');
    return;
  }

  const modal = document.getElementById('project-detail-modal');
  const body = document.getElementById('project-detail-modal-body');
  if (!modal || !body) return;

  const teamList = p.team || [];
  const milestones = p.milestones || [];
  const progress = p.progressPercent || 0;
  const isCompleted = p.status === 'Completed';

  body.innerHTML = `
    <!-- HEADER STRIP -->
    <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span class="mono-id font-bold text-primary" style="font-size: 13px;">${p.id}</span>
          ${p.orderId ? `<span class="badge badge-outline font-mono">Ref Order: ${p.orderId}</span>` : ''}
          <span class="badge ${isCompleted ? 'badge-success' : (p.status === 'Planning' ? 'badge-info' : 'badge-amber')}">${p.status || 'Planning'}</span>
        </div>
        <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0;">${escapeHtml(p.projectName)}</h3>
        <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
          Customer: <strong class="text-main">${escapeHtml(p.customerName)}</strong> &bull; Target Selesai: <strong>${p.dueDate || '-'}</strong>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Overall Progress</div>
        <div style="font-size: 22px; font-weight: 800; color: ${isCompleted ? '#10b981' : '#4f46e5'}; font-family: monospace;">${progress}%</div>
      </div>
    </div>

    <!-- 2 KOLOM: LEAD & TIM -->
    <div style="display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 16px; margin-bottom: 20px;">
      
      <!-- KARTU LEAD & DIVISI -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="user-check" style="width: 15px; height: 15px; color: #4f46e5;"></i> Penanggung Jawab Utama (Project Lead)
        </h4>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; background: #f8fafc; padding: 12px; border-radius: 6px;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;">
            ${(p.projectLead || 'P').charAt(0)}
          </div>
          <div>
            <div style="font-weight: 700; font-size: 13.5px; color: #0f172a;">${escapeHtml(p.projectLead || 'Belum diassign')}</div>
            <div style="font-size: 11px; color: #6366f1; font-weight: 600;">${escapeHtml(p.department || 'Engineering Division')}</div>
          </div>
        </div>
        <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.5;">
          <div>Mulai Pengerjaan: <strong>${p.startDate || '-'}</strong></div>
          <div>Batas Waktu (Deadline): <strong>${p.dueDate || '-'}</strong></div>
        </div>
      </div>

      <!-- KARTU DAFTAR ANGGOTA TIM -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="users" style="width: 15px; height: 15px; color: #10b981;"></i> Anggota Tim Pelaksana (${teamList.length} Orang)
          </h4>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 160px; overflow-y: auto;">
          ${teamList.length === 0 ? '<div class="text-muted font-sm">Belum ada anggota tim terdaftar.</div>' : teamList.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9;">
              <div>
                <div style="font-weight: 700; font-size: 12px; color: #1e293b;">${escapeHtml(m.name)}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(m.role || 'Teknisi')}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="font-mono font-xs" style="font-size: 11px; color: #64748b;">${m.phone || '-'}</span>
                ${m.phone ? `
                  <a href="https://wa.me/${m.phone.replace(/[^0-9]/g,'')}" target="_blank" class="btn-icon" style="color: #25d366; width: 22px; height: 22px;" title="WhatsApp Tim">
                    <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
                  </a>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- TAHAPAN / MILESTONES -->
    <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <h4 style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; display: flex; align-items: center; gap: 6px;">
        <i data-lucide="check-square" style="width: 15px; height: 15px; color: #8b5cf6;"></i> Tahapan Milestone Pengerjaan
      </h4>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${milestones.length === 0 ? '<div class="text-muted font-sm">Belum ada milestone tahapan pengerjaan.</div>' : milestones.map((ms, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border-radius: 6px; border-left: 3px solid ${ms.status === 'Completed' ? '#10b981' : ms.status === 'In Progress' ? '#f59e0b' : '#cbd5e1'};">
            <div>
              <div style="font-weight: 700; font-size: 12.5px; color: #0f172a;">${idx + 1}. ${escapeHtml(ms.title)}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                PIC: <strong>${escapeHtml(ms.pic || '-')}</strong> &bull; Periode: ${ms.startDate || '-'} s/d ${ms.dueDate || '-'}
              </div>
            </div>
            <div>
              <span class="badge ${ms.status === 'Completed' ? 'badge-success' : ms.status === 'In Progress' ? 'badge-amber' : 'badge-secondary'}" style="font-size: 10.5px;">
                ${ms.status || 'Pending'}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- ACTION FOOTER -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--border-color);">
      <div style="display: flex; gap: 8px;">
        <button type="button" class="btn btn-sm btn-outline" style="color: #4f46e5; border-color: #c7d2fe;" onclick="closeModal('project-detail-modal'); openTeamAssignmentPage('${p.orderId || ''}')">
          <i data-lucide="edit-3"></i> Edit Penugasan Tim
        </button>
        <button type="button" class="btn btn-sm btn-outline" style="color: #0284c7; border-color: #bae6fd;" onclick="closeModal('project-detail-modal'); openProjectTimelinePage('${p.orderId || ''}')">
          <i data-lucide="folder-kanban"></i> Buka Timeline Gantt Penuh
        </button>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick="closeModal('project-detail-modal')">Tutup</button>
    </div>
  `;

  openModal('project-detail-modal');
  if (window.lucide) lucide.createIcons();
}

function openProjectAssignmentWorkspace() {
  const firstOrder = state.orders.length > 0 ? state.orders[0].id : null;
  openTeamAssignmentPage(firstOrder);
}

// -------------------------------------------------------------
// 2. TEAM & PIC ASSIGNMENT WORKSPACE
// -------------------------------------------------------------
function openProjectManagementPage(orderId = null) {
  openTeamAssignmentPage(orderId);
}

function openTeamAssignmentPage(orderId = null) {
  const targetOrderId = orderId || (state.orders.length > 0 ? state.orders[0].id : null);
  currentActiveProjectOrderId = targetOrderId;

  const orderSelect = document.getElementById('pm-order-select');
  if (orderSelect) {
    if (state.orders.length === 0) {
      orderSelect.innerHTML = '<option value="">-- Belum Ada Order Penjualan --</option>';
    } else {
      orderSelect.innerHTML = state.orders.map(o => `
        <option value="${o.id}" ${o.id === targetOrderId ? 'selected' : ''}>
          [${o.id}] ${o.customerName} - ${o.items?.[0]?.itemName || 'Order'} (${formatRupiah(o.grandTotal)})
        </option>
      `).join('');
    }
  }

  renderTeamAssignmentWorkspace(targetOrderId);
  openModal('team-assignment-modal');
  if (window.lucide) lucide.createIcons();
}

function switchProjectOrder(orderId) {
  currentActiveProjectOrderId = orderId;
  renderTeamAssignmentWorkspace(orderId);
}

function renderTeamAssignmentWorkspace(orderId) {
  if (!orderId) return;

  const order = state.orders.find(o => o.id === orderId);
  let project = (state.projects || []).find(p => p.orderId === orderId);

  // If no project exists yet, generate clean empty default structure
  if (!project) {
    const firstItem = order?.items?.[0]?.itemName || 'Produk Pesanan';
    const projName = order?.projectName || `${firstItem} (${order?.customerName || 'Customer'})`;
    project = {
      orderId: orderId,
      projectName: projName,
      customerName: order?.customerName || '-',
      projectLead: '',
      department: '',
      status: 'Planning',
      progressPercent: 0,
      startDate: order?.orderDate || new Date().toISOString().split('T')[0],
      dueDate: order?.dueDate || '',
      team: [],
      milestones: [],
      notes: ''
    };
  }

  // Update Header & Inputs
  const headerOrderId = document.getElementById('pm-header-order-id');
  if (headerOrderId) headerOrderId.textContent = `${orderId} - ${project.customerName || order?.customerName || ''}`;

  const leadInput = document.getElementById('pm-lead-name');
  const lockBadge = document.getElementById('pm-lead-lock-badge');
  const hintText = document.getElementById('pm-lead-hint');

  // Check if project lead has already been saved/assigned
  const isLeadLocked = Boolean(project.isLeadLocked || (project.id && project.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign'));

  if (leadInput) {
    leadInput.value = project.projectLead || '';
    if (isLeadLocked) {
      leadInput.readOnly = true;
      leadInput.style.backgroundColor = '#f1f5f9';
      leadInput.style.cursor = 'not-allowed';
      leadInput.style.borderColor = '#cbd5e1';
      leadInput.style.color = '#1e293b';
      leadInput.style.fontWeight = '600';
      if (lockBadge) {
        lockBadge.innerHTML = '<span class="badge badge-info" style="font-size: 10px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="lock" style="width: 11px; height: 11px;"></i> Terkunci</span>';
      }
      if (hintText) {
        hintText.innerHTML = '<span style="color: #059669; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;"><i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Project Lead telah disimpan & terkunci permanen. Hanya anggota tim yang dapat diedit.</span>';
      }
    } else {
      leadInput.readOnly = false;
      leadInput.style.backgroundColor = '#ffffff';
      leadInput.style.cursor = 'text';
      leadInput.style.borderColor = '';
      leadInput.style.color = '';
      leadInput.style.fontWeight = 'normal';
      if (lockBadge) {
        lockBadge.innerHTML = '<span class="badge badge-amber" style="font-size: 10px; padding: 2px 6px;">Perlu Disimpan</span>';
      }
      if (hintText) {
        hintText.innerHTML = 'Masukkan nama Project Lead / Penanggung Jawab. Setelah disimpan, Lead Project akan terkunci secara permanen.';
      }
    }
  }

  const deptInput = document.getElementById('pm-department');
  if (deptInput) deptInput.value = project.department || '';

  // Render Team Members
  const teamList = document.getElementById('pm-team-list');
  if (teamList) {
    teamList.innerHTML = '';
    if (project.team && project.team.length > 0) {
      project.team.forEach(m => addProjectTeamMemberRow(m));
    } else {
      addProjectTeamMemberRow();
    }
  }

  // Render Dynamic Next-Step Quick Action Button
  const quickContainer = document.getElementById('pm-quick-action-container');
  if (quickContainer) {
    const isService = isServiceOrder(order);
    const hasBOM = isService || (state.bom || []).some(b => b.orderId === orderId || (order?.items || []).some(item => b.productName && item.itemName && b.productName.toLowerCase().trim() === item.itemName.toLowerCase().trim()));

    if (!isLeadLocked) {
      if (isService) {
        quickContainer.innerHTML = `
          <button type="button" class="btn btn-outline btn-sm" style="color: #94a3b8; opacity: 0.6; cursor: not-allowed;" title="Simpan Project Lead terlebih dahulu" onclick="showToast('Simpan Penugasan Tim terlebih dahulu untuk mengaktifkan Project Management.', 'warning')">
            <i data-lucide="lock" style="width: 12px; height: 12px;"></i> Lanjut: Timeline Gantt &rarr;
          </button>
        `;
      } else {
        quickContainer.innerHTML = `
          <button type="button" class="btn btn-outline btn-sm" style="color: #94a3b8; opacity: 0.6; cursor: not-allowed;" title="Simpan Project Lead terlebih dahulu" onclick="showToast('Simpan Penugasan Tim terlebih dahulu untuk mengaktifkan pengisian BOM.', 'warning')">
            <i data-lucide="lock" style="width: 12px; height: 12px;"></i> Lanjut: Input BOM &rarr;
          </button>
        `;
      }
    } else if (!hasBOM && !isService) {
      quickContainer.innerHTML = `
        <button type="button" class="btn btn-primary btn-sm" style="background: #2563eb; border-color: #2563eb; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px;" onclick="closeModal('team-assignment-modal'); createBOMFromOrder('${orderId}')">
          <i data-lucide="boxes" style="width: 13px; height: 13px;"></i> Lanjut: Input BOM &rarr;
        </button>
      `;
    } else {
      quickContainer.innerHTML = `
        <button type="button" class="btn btn-outline btn-sm" style="color: #4f46e5; border-color: #c7d2fe; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px;" onclick="closeModal('team-assignment-modal'); openProjectTimelinePage('${orderId}')">
          <i data-lucide="folder-kanban" style="color: #4f46e5; width: 13px; height: 13px;"></i> Buka Timeline Gantt &rarr;
        </button>
      `;
    }
  }

  if (window.lucide) lucide.createIcons();
}

function addProjectTeamMemberRow(member = null) {
  const container = document.getElementById('pm-team-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'pm-team-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 8px; align-items: center; background: #ffffff; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px;';
  
  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm pm-member-name" placeholder="Nama Lengkap Anggota" required value="${escapeAttr(member?.name || '')}">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm pm-member-role" placeholder="Role / Keahlian (e.g. Wiring)" value="${escapeAttr(member?.role || '')}">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm pm-member-phone" placeholder="No. HP / Kontak" value="${escapeAttr(member?.phone || '')}">
    </div>
    <div>
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Anggota" onclick="this.closest('.pm-team-row').remove();"><i data-lucide="trash-2"></i></button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

async function saveTeamAssignmentData() {
  if (!currentActiveProjectOrderId) {
    showToast('Pilih order penjualan terlebih dahulu', 'warning');
    return;
  }

  const order = state.orders.find(o => o.id === currentActiveProjectOrderId);
  const existingProject = (state.projects || []).find(p => p.orderId === currentActiveProjectOrderId);

  // Extract Team Members
  const team = [];
  document.querySelectorAll('#pm-team-list .pm-team-row').forEach(r => {
    const name = r.querySelector('.pm-member-name')?.value?.trim();
    const role = r.querySelector('.pm-member-role')?.value?.trim() || 'Team Member';
    const phone = r.querySelector('.pm-member-phone')?.value?.trim() || '';
    if (name) {
      team.push({ name, role, phone });
    }
  });

  const leadName = document.getElementById('pm-lead-name')?.value?.trim() || existingProject?.projectLead || 'Belum diassign';
  const department = document.getElementById('pm-department')?.value?.trim() || 'Engineering';

  const payload = {
    ...(existingProject || {}),
    orderId: currentActiveProjectOrderId,
    projectName: existingProject?.projectName || order?.projectName || `${order?.items?.[0]?.itemName || 'Project'} (${order?.customerName || 'Customer'})`,
    customerName: order?.customerName || existingProject?.customerName || '-',
    projectLead: leadName,
    department: department,
    team: team,
    isLeadLocked: true
  };

  try {
    let res;
    if (existingProject && existingProject.id) {
      res = await fetch(`/api/projects/${existingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('team-assignment-modal');
      showToast('Penugasan Tim berhasil disimpan! Project Lead terkunci permanen. Sekarang Anda dapat melanjutkan ke pengisian BOM.', 'success');
      await fetchResource('projects');
      renderProjectsTableView();
      renderTeamAssignmentWorkspace(currentActiveProjectOrderId);
      renderOrdersTable();
      updateSidebarBadges();
      loadDashboardData();
    } else {
      showToast('Gagal menyimpan penugasan tim', 'error');
    }
  } catch (err) {
    console.error('Error saving team data:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

// -------------------------------------------------------------
// 2. TIMELINE & MILESTONE WORKSPACE (Buka saat klik tombol Project Management)
// -------------------------------------------------------------
function navigateBackFromTimeline() {
  const target = state.timelineReturnView || state.previousMainView || (state.previousView !== 'timeline' ? state.previousView : null) || 'orders';
  navigateTo(target);
}

function openProjectTimelinePage(orderId = null) {
  const targetOrderId = orderId || (state.orders.length > 0 ? state.orders[0].id : null);

  // Tentukan view asal pemanggil Timeline
  if (state.currentView === 'projects') {
    state.timelineReturnView = 'projects';
  } else if (state.currentView === 'orders' || targetOrderId) {
    state.timelineReturnView = 'orders';
  } else if (!state.timelineReturnView) {
    state.timelineReturnView = (state.previousMainView === 'projects' || state.previousView === 'projects') ? 'projects' : 'orders';
  }

  if (targetOrderId) {
    const order = (state.orders || []).find(o => o.id === targetOrderId);
    if (order) {
      const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
      const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
      if (!isPOAndAccepted) {
        if (typeof promptPenugasanDisabled === 'function') {
          promptPenugasanDisabled(targetOrderId);
        } else {
          showToast('⚠️ Wajib upload PO Pelanggan dan status Accepted terlebih dahulu!', 'warning');
        }
        return;
      }

      const project = (state.projects || []).find(p => p.orderId === targetOrderId);
      const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
      if (!hasProjectLead) {
        showToast('⚠️ Tentukan Project Leader pada menu Penugasan Tim terlebih dahulu!', 'warning');
        if (typeof openTeamAssignmentPage === 'function') {
          openTeamAssignmentPage(targetOrderId);
        }
        return;
      }

      const isService = isServiceOrder(order);
      if (!isService) {
        const hasBOM = (state.bom || []).some(b => b.orderId === targetOrderId || (order.items || []).some(item => b.productName && item.itemName && b.productName.toLowerCase().trim() === item.itemName.toLowerCase().trim()));
        if (!hasBOM) {
          showToast('⚠️ Bill of Materials (BOM) belum diisi untuk order ini. Silakan isi dan simpan BOM terlebih dahulu sebelum membuat Project Management!', 'warning');
          if (typeof createBOMFromOrder === 'function') {
            createBOMFromOrder(targetOrderId);
          }
          return;
        }
      }
    }
  }

  timelineCalendarSelectedYear = null;
  timelineCalendarSelectedMonth = null;
  currentActiveProjectOrderId = targetOrderId;

  const returnLabel = (state.timelineReturnView === 'projects') ? 'Kembali ke Project Management' : 'Kembali ke Order Penjualan';
  const backLinkBtn = document.getElementById('timeline-back-link-btn') || document.querySelector('#view-timeline button[onclick*="navigateBackFromTimeline"], #view-timeline button[onclick*="navigateTo"]');
  if (backLinkBtn) {
    backLinkBtn.setAttribute('onclick', 'navigateBackFromTimeline()');
    backLinkBtn.innerHTML = `<i data-lucide="arrow-left"></i> ${returnLabel}`;
  }

  const closeBtn = document.querySelector('#view-timeline .btn-group button[onclick*="navigateTo"], #view-timeline .btn-group button[onclick*="navigateBackFromTimeline"]');
  if (closeBtn) {
    closeBtn.setAttribute('onclick', 'navigateBackFromTimeline()');
  }

  const orderSelect = document.getElementById('timeline-order-select');
  if (orderSelect) {
    if (state.orders.length === 0) {
      orderSelect.innerHTML = '<option value="">-- Belum Ada Order Penjualan --</option>';
    } else {
      orderSelect.innerHTML = state.orders.map(o => `
        <option value="${o.id}" ${o.id === targetOrderId ? 'selected' : ''}>
          [${o.id}] ${o.customerName} - ${o.items?.[0]?.itemName || 'Order'} (${formatRupiah(o.grandTotal)})
        </option>
      `).join('');
    }
  }

  renderTimelineWorkspace(targetOrderId);
  navigateTo('timeline');
  if (window.lucide) lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchTimelineOrder(orderId) {
  timelineCalendarSelectedYear = null;
  timelineCalendarSelectedMonth = null;
  currentActiveProjectOrderId = orderId;
  renderTimelineWorkspace(orderId);
}

function renderTimelineWorkspace(orderId) {
  if (!orderId) return;

  const order = state.orders.find(o => o.id === orderId);
  let project = (state.projects || []).find(p => p.orderId === orderId);

  if (!project) {
    const firstItem = order?.items?.[0]?.itemName || 'Produk Pesanan';
    const projName = order?.projectName || `${firstItem} (${order?.customerName || 'Customer'})`;
    project = {
      orderId: orderId,
      projectName: projName,
      customerName: order?.customerName || '-',
      projectLead: '',
      department: '',
      status: 'Planning',
      progressPercent: 0,
      startDate: order?.orderDate || new Date().toISOString().split('T')[0],
      dueDate: order?.dueDate || '',
      team: [],
      milestones: [],
      notes: ''
    };
  }

  // Header & Controls
  const headerOrderId = document.getElementById('timeline-header-order-id');
  if (headerOrderId) headerOrderId.textContent = `${project.projectName || 'Project'} (${project.customerName || '-'}) [${orderId}]`;

  const statusSelect = document.getElementById('timeline-status-select');
  if (statusSelect) statusSelect.value = project.status || 'Planning';

  const startInput = document.getElementById('timeline-start-date');
  if (startInput) startInput.value = project.startDate || order?.orderDate || '';

  const dueInput = document.getElementById('timeline-due-date');
  if (dueInput) dueInput.value = project.dueDate || order?.dueDate || '';

  const notesInput = document.getElementById('timeline-notes');
  if (notesInput) notesInput.value = project.notes || '';

  currentActiveProjectData = project;

  // Render Visual Calendar Blocks with different color themes & Month Calendar
  renderMilestoneCalendarBlocks(project);
  renderTimelineMonthCalendar(project);
  syncTimelineMilestonesHiddenList(project);

  calculateTimelineProgress();
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// KALENDER BLOK WARNA & DETAIL MODAL MILESTONE (SUBTASK, LAPORAN, LINK)
// -------------------------------------------------------------
let currentActiveProjectData = null;

const MILESTONE_THEMES = [
  {
    name: 'emerald',
    primary: '#059669',
    secondary: '#10b981',
    lightBg: '#f0fdf4',
    border: '#86efac',
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    badgeBg: '#dcfce7',
    badgeText: '#15803d'
  },
  {
    name: 'indigo',
    primary: '#4338ca',
    secondary: '#6366f1',
    lightBg: '#eef2ff',
    border: '#a5b4fc',
    gradient: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
    badgeBg: '#e0e7ff',
    badgeText: '#3730a3'
  },
  {
    name: 'amber',
    primary: '#d97706',
    secondary: '#f59e0b',
    lightBg: '#fffbeb',
    border: '#fde68a',
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    badgeBg: '#fef3c7',
    badgeText: '#92400e'
  },
  {
    name: 'purple',
    primary: '#7c3aed',
    secondary: '#a855f7',
    lightBg: '#faf5ff',
    border: '#d8b4fe',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6'
  },
  {
    name: 'cyan',
    primary: '#0891b2',
    secondary: '#06b6d4',
    lightBg: '#ecfeff',
    border: '#a5f3fc',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
    badgeBg: '#cffafe',
    badgeText: '#155e75'
  },
  {
    name: 'rose',
    primary: '#e11d48',
    secondary: '#f43f5e',
    lightBg: '#fff1f2',
    border: '#fecdd3',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)',
    badgeBg: '#ffe4e6',
    badgeText: '#9f1239'
  }
];

function renderMilestoneCalendarBlocks(project) {
  const container = document.getElementById('timeline-calendar-blocks');
  if (!container) return;

  const milestones = project?.milestones || [];
  if (milestones.length === 0) {
    container.innerHTML = `
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 24px; text-align: center; color: #64748b;">
        <i data-lucide="calendar" style="width: 28px; height: 28px; margin-bottom: 6px; color: #94a3b8;"></i>
        <div style="font-weight: 600; font-size: 13px;">Belum ada tahapan kerja atau milestone terdaftar.</div>
        <div style="font-size: 11.5px; margin-top: 4px;">Klik tombol <strong>"+ Tambah Milestone"</strong> di atas untuk membuat tahapan kerja baru.</div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = milestones.map((ms, idx) => {
    const msId = ms.id || (`ms-item-${idx}`);
    ms.id = msId;
    const theme = MILESTONE_THEMES[idx % MILESTONE_THEMES.length];
    
    const subtasks = ms.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.done).length;
    const totalSubtasks = subtasks.length;
    const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : (ms.status === 'Completed' ? 100 : ms.status === 'In Progress' ? 50 : 0);
    
    const hasReport = Boolean(ms.report?.description && ms.report.description.trim());
    const hasLink = Boolean(ms.report?.reportUrl && ms.report.reportUrl.trim());
    const images = ms.report?.images || [];
    const comments = ms.comments || [];

    const isCompleted = ms.status === 'Completed';
    const isInProgress = ms.status === 'In Progress';
    const statusBg = isCompleted ? '#10b981' : isInProgress ? '#f59e0b' : '#64748b';

    return `
      <div class="milestone-color-block" id="block-${msId}" onclick="openMilestoneDetailModal('${msId}')"
           style="background: #ffffff; border: 1px solid ${theme.border}; border-left: 7px solid ${theme.primary}; border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
           onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 14px rgba(0,0,0,0.08)';"
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)';">
        
        <!-- TOP HEADER BAR WITH THEME ACCENT -->
        <div style="padding: 12px 18px; background: ${theme.lightBg}; border-bottom: 1px solid ${theme.border}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: ${theme.gradient}; color: #ffffff; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.3px;">
              Tahap ${idx + 1}
            </span>
            <span style="font-weight: 800; font-size: 14px; color: #0f172a;">
              ${escapeHtml(ms.title || 'Tahapan Kerja')}
            </span>
            <span style="background: ${statusBg}; color: #ffffff; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">
              ${ms.status === 'Completed' ? '🟢 Completed' : (ms.status === 'In Progress' ? '🟡 In Progress' : '⚪ Pending (Belum Mulai)')}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="font-size: 11.5px; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 5px;">
              <i data-lucide="calendar" style="width: 13px; height: 13px; color: ${theme.primary};"></i>
              ${ms.startDate || '-'} s/d ${ms.dueDate || '-'}
            </div>
            <div style="font-size: 11.5px; color: #475569; display: flex; align-items: center; gap: 5px;">
              <i data-lucide="user" style="width: 13px; height: 13px; color: ${theme.primary};"></i>
              <strong>${escapeHtml(ms.pic || 'Belum ada PIC')}</strong>
            </div>
          </div>
        </div>

        <!-- DETAILS PILLS & TEASERS (SUBTASK, LAPORAN, LINK, FOTO) -->
        <div style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Subtask Badge -->
            <span class="badge" style="background: ${totalSubtasks > 0 && completedSubtasks === totalSubtasks ? '#dcfce7' : '#f1f5f9'}; color: ${totalSubtasks > 0 && completedSubtasks === totalSubtasks ? '#15803d' : '#334155'}; font-size: 11px; padding: 4px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="check-square" style="width: 12px; height: 12px; color: ${theme.primary};"></i>
              Sub-Task: <strong>${completedSubtasks}/${totalSubtasks}</strong> Selesai
            </span>

            <!-- Link Badge -->
            ${hasLink ? `
              <span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 11px; padding: 4px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" onclick="event.stopPropagation(); window.open('${escapeAttr(ms.report.reportUrl)}', '_blank');" title="Klik untuk membuka link">
                <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
                Link Dokumen / CAD ↗
              </span>
            ` : '<span style="font-size: 11px; color: #94a3b8;"><i data-lucide="link" style="width: 11px; height: 11px; display: inline;"></i> Tanpa link</span>'}

            <!-- Report Teaser -->
            ${hasReport ? `
              <span class="badge" style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 11px; padding: 4px 8px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttr(ms.report.description)}">
                <i data-lucide="file-text" style="width: 12px; height: 12px; color: ${theme.primary};"></i>
                ${escapeHtml(ms.report.description)}
              </span>
            ` : ''}

            <!-- Photos & Comments -->
            ${images.length > 0 ? `
              <span class="badge" style="background: #fdf4ff; color: #9333ea; font-size: 11px; padding: 4px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="image" style="width: 12px; height: 12px;"></i> ${images.length} Foto
              </span>
            ` : ''}

            ${comments.length > 0 ? `
              <span class="badge" style="background: #f0fdfa; color: #0f766e; font-size: 11px; padding: 4px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="message-square" style="width: 12px; height: 12px;"></i> ${comments.length} Diskusi
              </span>
            ` : ''}
          </div>

          <!-- Action CTA -->
          <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: ${theme.primary};">
            <span>Buka Detail Subtask, Laporan & Link</span>
            <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
          </div>
        </div>

        <!-- BOTTOM THIN PROGRESS BAR -->
        <div style="background: #f1f5f9; height: 6px; width: 100%;">
          <div style="background: ${theme.gradient}; height: 100%; width: ${subtaskPercent}%; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

let timelineCalendarSelectedYear = null;
let timelineCalendarSelectedMonth = null; // 0-indexed: 0 = Jan, 11 = Dec

function getProjectDefaultCalendarMonth(project) {
  const milestones = project?.milestones || [];
  let refDateStr = milestones[0]?.startDate || project?.startDate || '2026-09-01';
  let refDate = new Date(refDateStr);
  if (isNaN(refDate.getTime())) refDate = new Date();
  return {
    year: refDate.getFullYear(),
    month: refDate.getMonth()
  };
}

function changeTimelineMonth(delta) {
  if (timelineCalendarSelectedYear === null || timelineCalendarSelectedMonth === null) {
    const def = getProjectDefaultCalendarMonth(currentActiveProjectData);
    timelineCalendarSelectedYear = def.year;
    timelineCalendarSelectedMonth = def.month;
  }

  let m = timelineCalendarSelectedMonth + delta;
  let y = timelineCalendarSelectedYear;

  if (m < 0) {
    m = 11;
    y -= 1;
  } else if (m > 11) {
    m = 0;
    y += 1;
  }

  timelineCalendarSelectedYear = y;
  timelineCalendarSelectedMonth = m;
  renderTimelineMonthCalendar(currentActiveProjectData);
}

function handleTimelineMonthSelectChange() {
  const mSelect = document.getElementById('timeline-month-select');
  const ySelect = document.getElementById('timeline-year-select');
  if (!mSelect || !ySelect) return;

  timelineCalendarSelectedMonth = parseInt(mSelect.value, 10);
  timelineCalendarSelectedYear = parseInt(ySelect.value, 10);
  renderTimelineMonthCalendar(currentActiveProjectData);
}

function resetTimelineMonthToProject() {
  const def = getProjectDefaultCalendarMonth(currentActiveProjectData);
  timelineCalendarSelectedYear = def.year;
  timelineCalendarSelectedMonth = def.month;
  renderTimelineMonthCalendar(currentActiveProjectData);
}

function renderTimelineMonthCalendar(project) {
  const container = document.getElementById('timeline-month-calendar');
  if (!container) return;

  const milestones = project?.milestones || [];

  // Determine active year and month
  if (timelineCalendarSelectedYear === null || timelineCalendarSelectedMonth === null) {
    const def = getProjectDefaultCalendarMonth(project);
    timelineCalendarSelectedYear = def.year;
    timelineCalendarSelectedMonth = def.month;
  }

  const year = timelineCalendarSelectedYear;
  const month = timelineCalendarSelectedMonth;

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthTitle = `${monthNames[month]} ${year}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const dayHeaders = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  // Month select options
  const monthOptionsHtml = monthNames.map((mName, mIdx) => {
    return `<option value="${mIdx}" ${mIdx === month ? 'selected' : ''}>${mName}</option>`;
  }).join('');

  // Year select options (spanning 2024 to 2028 or dynamic)
  const yearsList = [];
  for (let y = Math.min(2024, year - 1); y <= Math.max(2028, year + 2); y++) {
    yearsList.push(y);
  }
  const yearOptionsHtml = yearsList.map(yVal => {
    return `<option value="${yVal}" ${yVal === year ? 'selected' : ''}>${yVal}</option>`;
  }).join('');

  let cellsHtml = '';
  // Empty cells before start of month
  for (let i = 0; i < firstDayIndex; i++) {
    cellsHtml += '<div style="min-height: 72px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; opacity: 0.5;"></div>';
  }

  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const padD = String(d).padStart(2, '0');
    const padM = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${padM}-${padD}`;

    // Find milestones active on this day
    const activeMilestones = [];
    milestones.forEach((ms, idx) => {
      const theme = MILESTONE_THEMES[idx % MILESTONE_THEMES.length];
      if (ms.startDate && ms.dueDate) {
        if (ms.startDate <= dateStr && dateStr <= ms.dueDate) {
          activeMilestones.push({ ms, idx, theme });
        }
      } else if (ms.dueDate === dateStr || ms.startDate === dateStr) {
        activeMilestones.push({ ms, idx, theme });
      }
    });

    const hasEvents = activeMilestones.length > 0;

    cellsHtml += `
      <div style="min-height: 72px; background: #ffffff; border: 1px solid ${hasEvents ? '#cbd5e1' : '#e2e8f0'}; border-radius: 6px; padding: 4px 6px; display: flex; flex-direction: column; gap: 3px; overflow: hidden;">
        <div style="font-size: 11px; font-weight: 700; color: ${hasEvents ? '#0f172a' : '#64748b'}; text-align: right;">
          ${d}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 48px;">
          ${activeMilestones.map(({ ms, idx, theme }) => `
            <div onclick="event.stopPropagation(); openMilestoneDetailModal('${ms.id}')"
                 style="background: ${theme.gradient}; color: #ffffff; font-size: 9.5px; font-weight: 700; padding: 2px 5px; border-radius: 3px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;"
                 title="Tahap ${idx + 1}: ${escapeAttr(ms.title)} (${ms.startDate} s/d ${ms.dueDate})">
              T${idx + 1}: ${escapeHtml(ms.title)}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div style="font-weight: 800; font-size: 13.5px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="calendar" style="width: 16px; height: 16px; color: #4f46e5;"></i>
          Kalender Bulanan:
        </div>

        <!-- Month & Year Controls -->
        <div style="display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 6px;">
          <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 7px; font-size: 11px; height: 26px; display: inline-flex; align-items: center;" onclick="changeTimelineMonth(-1)" title="Bulan Sebelumnya">
            <i data-lucide="chevron-left" style="width: 13px; height: 13px;"></i>
          </button>
          
          <select id="timeline-month-select" class="form-control form-control-sm" style="font-weight: 700; font-size: 12px; height: 26px; padding: 1px 6px; width: auto; color: #4f46e5; border-color: #c7d2fe; background: #ffffff;" onchange="handleTimelineMonthSelectChange()">
            ${monthOptionsHtml}
          </select>
          
          <select id="timeline-year-select" class="form-control form-control-sm" style="font-weight: 700; font-size: 12px; height: 26px; padding: 1px 6px; width: auto; color: #4f46e5; border-color: #c7d2fe; background: #ffffff;" onchange="handleTimelineMonthSelectChange()">
            ${yearOptionsHtml}
          </select>

          <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 7px; font-size: 11px; height: 26px; display: inline-flex; align-items: center;" onclick="changeTimelineMonth(1)" title="Bulan Berikutnya">
            <i data-lucide="chevron-right" style="width: 13px; height: 13px;"></i>
          </button>

          <button type="button" class="btn btn-sm btn-ghost" style="padding: 2px 8px; font-size: 11px; height: 26px; font-weight: 600; color: #4f46e5; display: inline-flex; align-items: center; gap: 4px;" onclick="resetTimelineMonthToProject()" title="Kembali ke Bulan Project">
            <i data-lucide="rotate-ccw" style="width: 12px; height: 12px;"></i> Bulan Project
          </button>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-muted);">
        <span>💡 Klik blok warna pada tanggal kalender untuk membuka rincian subtask & laporan</span>
      </div>
    </div>

    <!-- Day Header -->
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center; margin-bottom: 6px;">
      ${dayHeaders.map(dh => `<div style="font-weight: 700; font-size: 11px; color: #64748b; padding: 4px;">${dh}</div>`).join('')}
    </div>

    <!-- Month Grid -->
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
      ${cellsHtml}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function syncTimelineMilestonesHiddenList(project) {
  const container = document.getElementById('timeline-milestones-list');
  if (!container) return;
  container.innerHTML = '';
  (project?.milestones || []).forEach(ms => addTimelineMilestoneRow(ms));
}

// Helper to get all team member options (Leader + Anggota) for a project
function getProjectPICOfficialOptions(project, selectedPic = '') {
  const options = [];
  const addedNames = new Set();

  // 1. Project Lead
  if (project?.projectLead && project.projectLead !== 'Belum diassign' && project.projectLead.trim() !== '') {
    const leadName = project.projectLead.trim();
    options.push({
      name: leadName,
      role: 'Project Lead',
      label: `👑 ${leadName} (Project Lead)`
    });
    addedNames.add(leadName.toLowerCase());
  }

  // 2. Anggota Tim Pelaksana
  if (project?.team && Array.isArray(project.team)) {
    project.team.forEach(m => {
      const memberName = typeof m === 'string' ? m.trim() : (m?.name ? m.name.trim() : '');
      const memberRole = typeof m === 'object' && m?.role ? m.role.trim() : 'Anggota Tim';
      if (memberName && !addedNames.has(memberName.toLowerCase())) {
        options.push({
          name: memberName,
          role: memberRole,
          label: `👤 ${memberName} (${memberRole})`
        });
        addedNames.add(memberName.toLowerCase());
      }
    });
  }

  // 3. Fallback jika ada PIC tersimpan yang belum ada di daftar
  if (selectedPic && selectedPic.trim() !== '' && !addedNames.has(selectedPic.toLowerCase())) {
    options.push({
      name: selectedPic.trim(),
      role: 'PIC Khusus',
      label: `👤 ${selectedPic.trim()} (PIC)`
    });
  }

  return options;
}

// -------------------------------------------------------------
// INTERACTIVE MODAL DETAIL MILESTONE
// -------------------------------------------------------------
let currentEditingMilestoneId = null;

function openMilestoneDetailModal(msId) {
  if (!currentActiveProjectData) return;
  const milestones = currentActiveProjectData.milestones || [];
  const idx = milestones.findIndex(m => m.id === msId);
  if (idx === -1) return;

  currentEditingMilestoneId = msId;
  const ms = milestones[idx];
  const theme = MILESTONE_THEMES[idx % MILESTONE_THEMES.length];

  const header = document.getElementById('milestone-modal-header');
  if (header) {
    header.style.background = theme.gradient;
  }
  const titleEl = document.getElementById('milestone-modal-title');
  if (titleEl) {
    titleEl.textContent = `Tahap ${idx + 1}: ${ms.title || 'Milestone'}`;
  }
  const subEl = document.getElementById('milestone-modal-subtitle');
  if (subEl) {
    subEl.textContent = `📅 ${ms.startDate || '-'} s/d ${ms.dueDate || '-'} • PIC: ${ms.pic || 'Belum ada PIC'}`;
  }

  const body = document.getElementById('milestone-modal-body');
  if (!body) return;

  const subtasks = ms.subtasks || [];
  const report = ms.report || { description: '', reportUrl: '', images: [] };
  const images = report.images || [];
  const comments = ms.comments || [];

  const completedCount = subtasks.filter(s => s.done).length;
  const totalCount = subtasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (ms.status === 'Completed' ? 100 : 0);

  const picList = getProjectPICOfficialOptions(currentActiveProjectData, ms.pic);
  let picOptionsHtml = '<option value="">-- Pilih Penanggung Jawab (Leader / Anggota) --</option>';
  picList.forEach(opt => {
    const isSel = ms.pic && ms.pic.trim().toLowerCase() === opt.name.toLowerCase();
    picOptionsHtml += `<option value="${escapeAttr(opt.name)}" ${isSel ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`;
  });

  body.innerHTML = `
    <form id="milestone-detail-form" onsubmit="event.preventDefault(); saveMilestoneDetailModal('${msId}');">
      <!-- 1. INFORMASI UTAMA & STATUS -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 18px;">
        <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr 1.2fr; gap: 12px; margin-bottom: 10px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label font-bold" style="font-size: 11px;">Nama Tahapan Milestone *</label>
            <input type="text" id="modal-ms-title" class="form-control form-control-sm" required value="${escapeAttr(ms.title || '')}" style="font-weight: 700;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label font-bold" style="font-size: 11px;">Tanggal Mulai</label>
            <input type="date" id="modal-ms-start" class="form-control form-control-sm" value="${ms.startDate || ''}">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label font-bold" style="font-size: 11px;">Deadline Selesai</label>
            <input type="date" id="modal-ms-due" class="form-control form-control-sm" value="${ms.dueDate || ''}">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label font-bold" style="font-size: 11px;">Status Tahapan</label>
            <select id="modal-ms-status" class="form-control form-control-sm" style="font-weight: 700;">
              <option value="Pending" ${ms.status === 'Pending' ? 'selected' : ''}>⚪ Pending (Belum Mulai)</option>
              <option value="In Progress" ${ms.status === 'In Progress' ? 'selected' : ''}>🟡 In Progress (Pengerjaan)</option>
              <option value="Completed" ${ms.status === 'Completed' ? 'selected' : ''}>🟢 Completed (Selesai)</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin: 0; max-width: 380px;">
          <label class="form-label font-bold" style="font-size: 11px; display: flex; align-items: center; gap: 5px;">
            <i data-lucide="user-check" style="width: 13px; height: 13px; color: #4f46e5;"></i> Penanggung Jawab (PIC Tahap)
          </label>
          <select id="modal-ms-pic" class="form-control form-control-sm" style="font-weight: 600; background: #ffffff;">
            ${picOptionsHtml}
          </select>
        </div>
      </div>

      <!-- 2. DUA KOLOM: SUBTASKS & LAPORAN/LINK -->
      <div style="display: grid; grid-template-columns: 1.15fr 1.25fr; gap: 18px; margin-bottom: 18px;">
        
        <!-- KOLOM KIRI: SUB-TASKS CHECKLIST -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="check-circle" style="width: 16px; height: 16px; color: ${theme.primary};"></i>
              Sub-Task & Checklist Pengerjaan
            </div>
            <button type="button" class="btn btn-xs btn-outline" style="color: ${theme.primary}; border-color: ${theme.border}; font-weight: 600;" onclick="addModalSubtaskRow()">
              <i data-lucide="plus"></i> + Sub-Task
            </button>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="flex: 1; background: #e2e8f0; height: 6px; border-radius: 4px; overflow: hidden;">
              <div id="modal-subtask-progress-bar" style="background: ${theme.gradient}; height: 100%; width: ${percent}%;"></div>
            </div>
            <span id="modal-subtask-counter" style="font-size: 11px; font-weight: 700; color: #475569; min-width: 40px; text-align: right;">${completedCount}/${totalCount}</span>
          </div>

          <div id="modal-subtasks-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto;">
            <!-- Render subtasks -->
          </div>
          <p style="font-size: 10.5px; color: var(--text-muted); margin: 8px 0 0 0;">
            💡 <em>Centang subtask saat pekerjaan selesai untuk otomatis mengupdate progres milestone.</em>
          </p>
        </div>

        <!-- KOLOM KANAN: LAPORAN, LINK & DOKUMENTASI -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- LAPORAN PEKERJAAN -->
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <label class="form-label font-bold" style="font-size: 12px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="file-text" style="width: 14px; height: 14px; color: ${theme.primary};"></i> Laporan Hasil Pengerjaan / Progress
            </label>
            <textarea id="modal-ms-report-desc" class="form-control" rows="3" placeholder="Tuliskan ringkasan hasil pekerjaan, kendala teknis, atau catatan pengujian..." style="font-size: 12px;">${escapeHtml(report.description || '')}</textarea>
          </div>

          <!-- TAUTAN / LINK DOKUMEN -->
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <label class="form-label font-bold" style="font-size: 12px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="external-link" style="width: 14px; height: 14px; color: ${theme.primary};"></i> Tautan / Link Hasil Pengerjaan (CAD / Drive / GitHub)
            </label>
            <div style="display: flex; gap: 8px;">
              <input type="url" id="modal-ms-report-url" class="form-control form-control-sm" placeholder="https://drive.google.com/... atau link dokumen" value="${escapeAttr(report.reportUrl || '')}" style="font-size: 11.5px; flex: 1;">
              <button type="button" class="btn btn-sm btn-outline" style="color: #0369a1; border-color: #bae6fd; font-weight: 700; white-space: nowrap;" onclick="openModalReportUrl()">
                Buka Link ↗
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. FOTO DOKUMENTASI & DISKUSI -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px;">
        
        <!-- FOTO DOKUMENTASI -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="image" style="width: 14px; height: 14px; color: #9333ea;"></i> Foto Dokumentasi Pengerjaan
            </div>
            <button type="button" class="btn btn-xs btn-outline" onclick="addModalImageAttachment()">+ Tambah Foto</button>
          </div>
          <div id="modal-images-container" style="display: flex; gap: 8px; flex-wrap: wrap; max-height: 120px; overflow-y: auto;">
            <!-- Render images -->
          </div>
        </div>

        <!-- DISKUSI TIM -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
          <div style="font-weight: 700; font-size: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="message-square" style="width: 14px; height: 14px; color: #0f766e;"></i> Catatan & Diskusi Tim
          </div>
          <div id="modal-comments-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 110px; overflow-y: auto; margin-bottom: 8px;">
            <!-- Render comments -->
          </div>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="modal-new-comment-input" class="form-control form-control-sm" placeholder="Tulis komentar atau instruksi tim..." style="font-size: 11px;">
            <button type="button" class="btn btn-sm btn-primary" style="background: #0f766e; border-color: #0f766e; font-size: 11px; padding: 4px 12px;" onclick="addModalCommentAction()">Kirim</button>
          </div>
        </div>
      </div>

      <!-- 4. FOOTER ACTIONS -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--border-color);">
        <button type="button" class="btn btn-sm btn-danger-ghost" onclick="deleteCurrentMilestoneModal('${msId}')" style="color: #ef4444;">
          <i data-lucide="trash-2"></i> Hapus Tahapan Ini
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeModal('milestone-detail-modal')">Tutup</button>
          <button type="submit" class="btn btn-primary btn-sm" style="background: ${theme.primary}; border-color: ${theme.primary}; font-weight: 700; padding: 6px 20px;">
            <i data-lucide="save"></i> Simpan Perubahan Milestone
          </button>
        </div>
      </div>
    </form>
  `;

  // Render Subtasks
  subtasks.forEach(st => addModalSubtaskRow(st));
  if (subtasks.length === 0) addModalSubtaskRow();

  // Render Images
  renderModalImages(images);

  // Render Comments
  renderModalComments(comments);

  openModal('milestone-detail-modal');
  if (window.lucide) lucide.createIcons();
}

function addModalSubtaskRow(st = null) {
  const container = document.getElementById('modal-subtasks-container');
  if (!container) return;

  const stId = st?.id || ('st-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
  const isDone = Boolean(st && st.done);

  const row = document.createElement('div');
  row.className = 'modal-subtask-item';
  row.id = `modal-st-${stId}`;
  row.style = 'display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; transition: all 0.2s ease;';

  row.innerHTML = `
    <input type="checkbox" class="modal-st-check" ${isDone ? 'checked' : ''} onchange="handleModalSubtaskToggle(this)" style="width: 16px; height: 16px; cursor: pointer; accent-color: #10b981;">
    <input type="text" class="modal-st-title form-control form-control-sm" placeholder="Nama sub-task..." value="${escapeAttr(st?.title || '')}" style="border: none; background: transparent; font-size: 11.5px; flex: 1; text-decoration: ${isDone ? 'line-through' : 'none'}; color: ${isDone ? '#64748b' : '#0f172a'};" oninput="calculateModalSubtaskStats()">
    <button type="button" class="btn-icon btn-danger-ghost btn-xs" onclick="document.getElementById('modal-st-${stId}').remove(); calculateModalSubtaskStats();" title="Hapus sub-task">
      <i data-lucide="x" style="width: 13px; height: 13px;"></i>
    </button>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  calculateModalSubtaskStats();
}

function handleModalSubtaskToggle(checkbox) {
  const row = checkbox.closest('.modal-subtask-item');
  const input = row?.querySelector('.modal-st-title');
  if (input) {
    if (checkbox.checked) {
      input.style.textDecoration = 'line-through';
      input.style.color = '#64748b';
    } else {
      input.style.textDecoration = 'none';
      input.style.color = '#0f172a';
    }
  }
  calculateModalSubtaskStats();
}

function calculateModalSubtaskStats() {
  const container = document.getElementById('modal-subtasks-container');
  if (!container) return;

  const checks = container.querySelectorAll('.modal-st-check');
  const total = checks.length;
  let done = 0;
  checks.forEach(c => { if (c.checked) done++; });

  const counter = document.getElementById('modal-subtask-counter');
  if (counter) counter.textContent = `${done}/${total}`;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('modal-subtask-progress-bar');
  if (bar) bar.style.width = `${percent}%`;

  const statusSelect = document.getElementById('modal-ms-status');
  if (statusSelect && total > 0) {
    if (done === total) statusSelect.value = 'Completed';
    else if (done > 0 && statusSelect.value === 'Pending') statusSelect.value = 'In Progress';
  }
}

function openModalReportUrl() {
  const urlInput = document.getElementById('modal-ms-report-url');
  const url = urlInput?.value?.trim();
  if (!url) {
    showToast('Masukkan link/tautan hasil pengerjaan terlebih dahulu', 'warning');
    return;
  }
  window.open(url, '_blank');
}

function renderModalImages(images) {
  const container = document.getElementById('modal-images-container');
  if (!container) return;
  if (images.length === 0) {
    container.innerHTML = '<span class="text-muted font-xs" style="font-size: 11px;">Belum ada lampiran foto.</span>';
    return;
  }
  container.innerHTML = images.map((img, i) => `
    <div style="position: relative; width: 50px; height: 50px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;">
      <img src="${escapeAttr(img.url || img)}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${escapeAttr(img.url || img)}', '_blank')">
      <button type="button" onclick="removeModalImage(${i})" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
    </div>
  `).join('');
}

function addModalImageAttachment() {
  const url = prompt('Masukkan URL gambar dokumentasi (contoh: /uploads/... atau https://...):');
  if (!url) return;
  if (!currentActiveProjectData || !currentEditingMilestoneId) return;

  const ms = currentActiveProjectData.milestones?.find(m => m.id === currentEditingMilestoneId);
  if (!ms) return;
  if (!ms.report) ms.report = { description: '', reportUrl: '', images: [] };
  if (!ms.report.images) ms.report.images = [];
  ms.report.images.push({ url: url.trim(), name: 'Dokumentasi' });
  renderModalImages(ms.report.images);
}

function removeModalImage(index) {
  if (!currentActiveProjectData || !currentEditingMilestoneId) return;
  const ms = currentActiveProjectData.milestones?.find(m => m.id === currentEditingMilestoneId);
  if (!ms || !ms.report?.images) return;
  ms.report.images.splice(index, 1);
  renderModalImages(ms.report.images);
}

function renderModalComments(comments) {
  const container = document.getElementById('modal-comments-container');
  if (!container) return;
  if (comments.length === 0) {
    container.innerHTML = '<span class="text-muted font-xs" style="font-size: 11px;">Belum ada catatan diskusi.</span>';
    return;
  }
  container.innerHTML = comments.map(c => `
    <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; padding: 6px 8px; font-size: 11px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <strong style="color: #0f172a;">${escapeHtml(c.sender || 'Tim')}</strong>
        <span class="text-muted" style="font-size: 10px;">${escapeHtml(c.timestamp || '')}</span>
      </div>
      <div style="color: #334155;">${escapeHtml(c.text || '')}</div>
    </div>
  `).join('');
}

function addModalCommentAction() {
  const input = document.getElementById('modal-new-comment-input');
  const text = input?.value?.trim();
  if (!text) return;
  if (!currentActiveProjectData || !currentEditingMilestoneId) return;

  const ms = currentActiveProjectData.milestones?.find(m => m.id === currentEditingMilestoneId);
  if (!ms) return;
  if (!ms.comments) ms.comments = [];

  const now = new Date();
  const timeStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  ms.comments.push({
    id: 'cm-' + Date.now(),
    sender: 'Lead / Tim Pelaksana',
    role: 'Technical Team',
    text: text,
    timestamp: timeStr
  });

  input.value = '';
  renderModalComments(ms.comments);
}

function deleteCurrentMilestoneModal(msId) {
  if (!confirm('Apakah Anda yakin ingin menghapus tahapan milestone ini?')) return;
  if (!currentActiveProjectData) return;

  currentActiveProjectData.milestones = (currentActiveProjectData.milestones || []).filter(m => m.id !== msId);
  closeModal('milestone-detail-modal');
  renderMilestoneCalendarBlocks(currentActiveProjectData);
  renderTimelineMonthCalendar(currentActiveProjectData);
  syncTimelineMilestonesHiddenList(currentActiveProjectData);
  calculateTimelineProgress();
  showToast('Tahapan milestone berhasil dihapus', 'info');
}

function saveMilestoneDetailModal(msId) {
  if (!currentActiveProjectData) return;
  const ms = (currentActiveProjectData.milestones || []).find(m => m.id === msId);
  if (!ms) return;

  ms.title = document.getElementById('modal-ms-title')?.value?.trim() || ms.title;
  ms.startDate = document.getElementById('modal-ms-start')?.value || '';
  ms.dueDate = document.getElementById('modal-ms-due')?.value || '';
  ms.status = document.getElementById('modal-ms-status')?.value || 'Pending';
  ms.pic = document.getElementById('modal-ms-pic')?.value?.trim() || '';

  // Collect subtasks
  const subtasks = [];
  document.querySelectorAll('#modal-subtasks-container .modal-subtask-item').forEach(item => {
    const cb = item.querySelector('.modal-st-check');
    const txt = item.querySelector('.modal-st-title')?.value?.trim();
    if (txt) {
      subtasks.push({
        id: item.id.replace('modal-st-', ''),
        title: txt,
        done: Boolean(cb && cb.checked)
      });
    }
  });
  ms.subtasks = subtasks;

  // Collect report & link
  if (!ms.report) ms.report = { description: '', reportUrl: '', images: [] };
  ms.report.description = document.getElementById('modal-ms-report-desc')?.value?.trim() || '';
  ms.report.reportUrl = document.getElementById('modal-ms-report-url')?.value?.trim() || '';

  closeModal('milestone-detail-modal');

  // Re-render blocks and calendar
  renderMilestoneCalendarBlocks(currentActiveProjectData);
  renderTimelineMonthCalendar(currentActiveProjectData);
  syncTimelineMilestonesHiddenList(currentActiveProjectData);
  calculateTimelineProgress();

  // Auto-sync with server
  saveProjectTimelineData(false);
  showToast(`✅ Tahapan "${ms.title}" berhasil diperbarui!`, 'success');
}

function addNewMilestoneInteractive() {
  if (!currentActiveProjectData) {
    showToast('Pilih project terlebih dahulu', 'warning');
    return;
  }
  if (!currentActiveProjectData.milestones) currentActiveProjectData.milestones = [];

  const newIdx = currentActiveProjectData.milestones.length + 1;
  const newMs = {
    id: 'ms-' + Date.now(),
    title: '',
    startDate: currentActiveProjectData.startDate || '',
    dueDate: currentActiveProjectData.dueDate || '',
    pic: currentActiveProjectData.projectLead || '',
    status: 'Pending',
    subtasks: [],
    report: { description: '', reportUrl: '', images: [] },
    comments: []
  };

  currentActiveProjectData.milestones.push(newMs);
  renderMilestoneCalendarBlocks(currentActiveProjectData);
  renderTimelineMonthCalendar(currentActiveProjectData);
  syncTimelineMilestonesHiddenList(currentActiveProjectData);
  calculateTimelineProgress();

  openMilestoneDetailModal(newMs.id);
}

function addTimelineMilestoneRow(ms = null) {
  const container = document.getElementById('timeline-milestones-list');
  if (!container) return;

  const msId = ms?.id || ('ms-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
  const row = document.createElement('div');
  row.className = 'timeline-milestone-row card';
  row.id = `milestone-card-${msId}`;
  row.setAttribute('data-ms-id', msId);
  row.style.cssText = 'background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 14px; overflow: hidden; box-shadow: var(--shadow-sm);';
  
  const status = ms?.status || 'Pending';
  const subtasks = ms?.subtasks || [];
  const comments = ms?.comments || [];
  const report = ms?.report || { description: '', reportUrl: '', images: [] };
  const images = report?.images || [];

  const completedSubtasks = subtasks.filter(st => st.done).length;
  const totalSubtasks = subtasks.length;

  row.innerHTML = `
    <!-- 1. MILESTONE HEADER BAR (KLIK UNTUK BUKA/TUTUP DETAIL) -->
    <div class="milestone-card-header" onclick="toggleMilestoneAccordion('${msId}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 10px; cursor: pointer; transition: background 0.2s ease;">
      <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 260px;">
        <button type="button" class="btn-icon btn-sm" onclick="event.stopPropagation(); toggleMilestoneAccordion('${msId}')" title="Buka/Tutup Rincian" style="background: #e2e8f0;">
          <i data-lucide="chevron-down" id="chevron-${msId}" style="transition: transform 0.2s ease; transform: rotate(-90deg);"></i>
        </button>
        <div style="flex: 1;" onclick="event.stopPropagation();">
          <input type="text" class="form-control form-control-sm tm-ms-title" placeholder="Nama Tahapan / Milestone Project *" required value="${escapeAttr(ms?.title || '')}" style="font-weight: 700; font-size: 13.5px; background: #ffffff;">
        </div>
      </div>

      <!-- Dates, PIC & Status Dropdown -->
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;" onclick="event.stopPropagation();">
        <div style="display: flex; align-items: center; gap: 4px;">
          <label style="font-size: 10.5px; color: var(--text-muted); font-weight: 600;">Dari:</label>
          <input type="date" class="form-control form-control-sm tm-ms-start" value="${ms?.startDate || ''}" title="Tanggal Mulai" style="width: 125px; font-size: 11px;">
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <label style="font-size: 10.5px; color: var(--text-muted); font-weight: 600;">Sampai:</label>
          <input type="date" class="form-control form-control-sm tm-ms-due" value="${ms?.dueDate || ''}" title="Tanggal Selesai" style="width: 125px; font-size: 11px;">
        </div>
        <div style="width: 170px;">
          <select class="form-control form-control-sm tm-ms-pic" title="Penanggung Jawab (PIC Tahap)" style="font-size: 11px; font-weight: 600;">
            <option value="">-- Pilih PIC Tahap --</option>
            ${(() => {
              const project = currentActiveProjectData || (state.projects || []).find(p => p.orderId === currentActiveProjectOrderId);
              const picList = getProjectPICOfficialOptions(project, ms?.pic);
              return picList.map(opt => {
                const isSel = ms?.pic && ms.pic.trim().toLowerCase() === opt.name.toLowerCase();
                return `<option value="${escapeAttr(opt.name)}" ${isSel ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`;
              }).join('');
            })()}
          </select>
        </div>
        <div style="width: 170px;">
          <select class="form-control form-control-sm tm-ms-status" id="ms-status-select-${msId}" onchange="calculateTimelineProgress()" style="font-weight: 700; font-size: 11px;">
            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>⚪ Pending (Belum Mulai)</option>
            <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>🟡 In Progress</option>
            <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>🟢 Completed</option>
          </select>
        </div>
        <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Milestone Ini" onclick="event.stopPropagation(); document.getElementById('milestone-card-${msId}').remove(); calculateTimelineProgress();">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>

    <!-- 2. SUMMARY PILLS (KLIK UNTUK BUKA/TUTUP DETAIL) -->
    <div onclick="toggleMilestoneAccordion('${msId}')" style="display: flex; align-items: center; gap: 10px; padding: 7px 16px; background: #ffffff; border-bottom: 1px dashed #e2e8f0; font-size: 11px; flex-wrap: wrap; cursor: pointer;">
      <span id="ms-subtask-summary-${msId}" class="badge ${completedSubtasks === totalSubtasks && totalSubtasks > 0 ? 'badge-success' : 'badge-secondary'}" style="display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="check-square" style="width: 12px; height: 12px;"></i> Sub-Task: <strong id="ms-subtask-count-${msId}">${completedSubtasks}/${totalSubtasks}</strong> Selesai
      </span>
      <span id="ms-comment-summary-${msId}" class="badge badge-info" style="display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="message-square" style="width: 12px; height: 12px;"></i> <span id="ms-comment-count-${msId}">${comments.length}</span> Komentar
      </span>
      <span id="ms-image-summary-${msId}" class="badge badge-purple" style="display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="image" style="width: 12px; height: 12px;"></i> <span id="ms-image-count-${msId}">${images.length}</span> Foto Dokumentasi
      </span>
      <button type="button" class="btn btn-xs btn-outline" id="btn-toggle-text-${msId}" onclick="event.stopPropagation(); toggleMilestoneAccordion('${msId}')" style="margin-left: auto; font-size: 11px; font-weight: 600; color: #4f46e5; border-color: #c7d2fe;">
        <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i> Buka Detail Milestone
      </button>
    </div>

    <!-- 3. EXPANDABLE BODY: TERSEMBUNYI SECARA DEFAULT -->
    <div class="milestone-details-body" id="ms-details-${msId}" style="display: none; padding: 16px 18px; background: #ffffff; border-top: 1px solid #e2e8f0;">
      
      <div style="display: grid; grid-template-columns: 1.1fr 1.3fr; gap: 18px;">
        
        <!-- LEFT COLUMN: SUB-TASKS CHECKLIST -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="check-circle" style="width: 15px; height: 15px; color: #2563eb;"></i> Sub-Task & Checklist Pengerjaan
            </div>
            <button type="button" class="btn btn-xs btn-outline" onclick="addMilestoneSubtaskRow('${msId}')">
              <i data-lucide="plus"></i> + Sub-Task
            </button>
          </div>
          <p style="font-size: 10.5px; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">
            💡 <em>Jika semua sub-task dicentang, status milestone otomatis berubah menjadi <strong>Completed</strong></em>.
          </p>

          <div id="ms-subtasks-list-${msId}" class="ms-subtasks-container" style="display: flex; flex-direction: column; gap: 6px;">
            <!-- Dynamically populated subtasks -->
          </div>
        </div>

        <!-- RIGHT COLUMN: ACTIVITY REPORT, REPORT LINK & PHOTOS -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 15px; height: 15px; color: #10b981;"></i> Laporan Hasil Kegiatan & Dokumentasi
          </div>

          <!-- Description -->
          <div style="margin-bottom: 10px;">
            <label class="form-label" style="font-size: 11px; margin-bottom: 3px; font-weight: 600;">Deskripsi Hasil Kegiatan</label>
            <textarea class="form-control form-control-sm tm-ms-report-desc" rows="2" placeholder="Tuliskan kemajuan pekerjaan, pencapaian teknis, atau catatan pengujian lapangan..." style="font-size: 11.5px;">${escapeAttr(report?.description || '')}</textarea>
          </div>

          <!-- Report URL Link -->
          <div style="margin-bottom: 12px;">
            <label class="form-label" style="font-size: 11px; margin-bottom: 3px; font-weight: 600;">Link Laporan Hasil (Google Drive / Dokumen)</label>
            <div style="display: flex; gap: 6px;">
              <input type="url" class="form-control form-control-sm tm-ms-report-url" placeholder="https://drive.google.com/... atau link laporan" value="${escapeAttr(report?.reportUrl || '')}" style="font-size: 11.5px; flex: 1;">
              <button type="button" class="btn btn-sm btn-outline" onclick="openMilestoneReportLink(this)" title="Buka Link di Tab Baru" style="padding: 4px 10px;">
                <i data-lucide="external-link"></i>
              </button>
            </div>
          </div>

          <!-- Image Attachments / Upload -->
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label class="form-label" style="font-size: 11px; margin: 0; font-weight: 600;">Foto Dokumentasi Lapangan</label>
              <label class="btn btn-xs btn-primary" style="margin: 0; cursor: pointer; background: #4f46e5; border-color: #4f46e5; font-size: 11px;">
                <i data-lucide="camera"></i> + Unggah Foto
                <input type="file" accept="image/*" multiple style="display: none;" onchange="handleMilestoneImageUpload(event, '${msId}')">
              </label>
            </div>

            <div id="ms-image-gallery-${msId}" class="ms-image-gallery" style="display: flex; flex-wrap: wrap; gap: 8px; min-height: 48px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px;">
              <!-- Uploaded image cards dynamically rendered -->
            </div>
          </div>

        </div>

      </div>

      <!-- 4. THREADED COMMENTS & TEAM DISCUSSION -->
      <div style="margin-top: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="messages-square" style="width: 15px; height: 15px; color: #6366f1;"></i> Diskusi & Balas Komentar Tim
          </div>
          <span class="text-muted font-sm" style="font-size: 11px;">Koordinasi langsung antara Project Lead & Tim Pelaksana</span>
        </div>

        <!-- Comments Stream -->
        <div id="ms-comments-stream-${msId}" class="ms-comments-stream" style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; margin-bottom: 12px; padding-right: 4px;">
          <!-- Dynamically populated comments -->
        </div>

        <!-- Add Comment Input Box -->
        <div style="display: grid; grid-template-columns: 180px 1fr auto; gap: 8px; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px;">
          <input type="text" id="ms-comment-author-${msId}" class="form-control form-control-sm" placeholder="Nama / PIC Anda" value="${escapeAttr(ms?.pic || '')}" style="font-size: 11.5px; font-weight: 600;">
          <input type="text" id="ms-comment-text-${msId}" class="form-control form-control-sm" placeholder="Tulis komentar, pertanyaan, atau catatan kemajuan..." style="font-size: 11.5px;" onkeydown="if(event.key==='Enter') addMilestoneComment('${msId}')">
          <button type="button" class="btn btn-sm btn-primary" onclick="addMilestoneComment('${msId}')" style="background: #4f46e5; border-color: #4f46e5; font-size: 11.5px; padding: 5px 14px;">
            <i data-lucide="send"></i> Kirim
          </button>
        </div>
      </div>

    </div>
  `;

  container.appendChild(row);

  // Populate subtasks
  const subtasksContainer = document.getElementById(`ms-subtasks-list-${msId}`);
  if (subtasks.length > 0) {
    subtasks.forEach(st => addMilestoneSubtaskRow(msId, st));
  } else {
    // Add 2 default initial subtasks if new
    addMilestoneSubtaskRow(msId, { title: 'Persiapan gambar kerja & material', done: false });
    addMilestoneSubtaskRow(msId, { title: 'Eksekusi pengerjaan & perakitan', done: false });
  }

  // Populate images
  const imageGallery = document.getElementById(`ms-image-gallery-${msId}`);
  if (images.length > 0) {
    images.forEach(img => addMilestoneImageCard(msId, img));
  } else {
    imageGallery.innerHTML = '<span class="text-muted font-sm" style="font-size: 11px; padding: 4px;">Belum ada foto dokumentasi diunggah.</span>';
  }

  // Populate comments
  const commentsStream = document.getElementById(`ms-comments-stream-${msId}`);
  if (comments.length > 0) {
    comments.forEach(c => renderMilestoneCommentBubble(msId, c));
  } else {
    commentsStream.innerHTML = '<span class="text-muted font-sm text-center" style="font-size: 11px; padding: 8px;">Belum ada diskusi komentar untuk milestone ini. Tulis komentar pertama Anda di bawah.</span>';
  }

  if (window.lucide) lucide.createIcons();
  calculateMilestoneSubtaskProgress(msId);
  calculateTimelineProgress();
}

function toggleMilestoneAccordion(msId) {
  const body = document.getElementById(`ms-details-${msId}`);
  const chevron = document.getElementById(`chevron-${msId}`);
  const toggleBtn = document.getElementById(`btn-toggle-text-${msId}`);
  if (!body) return;

  const isHidden = (body.style.display === 'none' || !body.style.display);
  if (isHidden) {
    body.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    if (toggleBtn) toggleBtn.innerHTML = '<i data-lucide="chevron-up" style="width: 12px; height: 12px;"></i> Tutup Detail';
  } else {
    body.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
    if (toggleBtn) toggleBtn.innerHTML = '<i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i> Buka Detail Milestone';
  }
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// SUB-TASKS MANAGEMENT & AUTO-COMPLETION
// -------------------------------------------------------------
function addMilestoneSubtaskRow(msId, subtask = null) {
  const container = document.getElementById(`ms-subtasks-list-${msId}`);
  if (!container) return;

  const stId = subtask?.id || ('st-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
  const isDone = Boolean(subtask?.done);

  const row = document.createElement('div');
  row.className = 'ms-subtask-item';
  row.id = `subtask-row-${stId}`;
  row.style.cssText = 'display: flex; align-items: center; gap: 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; transition: all 0.2s ease;';
  
  row.innerHTML = `
    <input type="checkbox" class="ms-subtask-check" ${isDone ? 'checked' : ''} onchange="handleSubtaskCheckChange('${msId}', this)" style="width: 16px; height: 16px; cursor: pointer; accent-color: #10b981;">
    <input type="text" class="form-control form-control-sm ms-subtask-text" placeholder="Uraian sub-task pengerjaan..." value="${escapeAttr(subtask?.title || '')}" style="border: none; background: transparent; font-size: 12px; flex: 1; text-decoration: ${isDone ? 'line-through' : 'none'}; color: ${isDone ? '#64748b' : '#0f172a'};" oninput="calculateMilestoneSubtaskProgress('${msId}')">
    <button type="button" class="btn-icon btn-danger-ghost btn-xs" title="Hapus Sub-Task" onclick="document.getElementById('subtask-row-${stId}').remove(); handleSubtaskCheckChange('${msId}');">
      <i data-lucide="x" style="width: 13px; height: 13px;"></i>
    </button>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  calculateMilestoneSubtaskProgress(msId);
}

function handleSubtaskCheckChange(msId, checkbox = null) {
  if (checkbox) {
    const textInput = checkbox.closest('.ms-subtask-item')?.querySelector('.ms-subtask-text');
    if (textInput) {
      if (checkbox.checked) {
        textInput.style.textDecoration = 'line-through';
        textInput.style.color = '#64748b';
      } else {
        textInput.style.textDecoration = 'none';
        textInput.style.color = '#0f172a';
      }
    }
  }

  calculateMilestoneSubtaskProgress(msId);
}

function calculateMilestoneSubtaskProgress(msId) {
  const container = document.getElementById(`ms-subtasks-list-${msId}`);
  if (!container) return;

  const checkboxes = container.querySelectorAll('.ms-subtask-check');
  const total = checkboxes.length;
  let done = 0;

  checkboxes.forEach(cb => {
    if (cb.checked) done++;
  });

  const countBadge = document.getElementById(`ms-subtask-count-${msId}`);
  const summaryPill = document.getElementById(`ms-subtask-summary-${msId}`);
  if (countBadge) countBadge.textContent = `${done}/${total}`;

  const statusSelect = document.getElementById(`ms-status-select-${msId}`);
  if (statusSelect) {
    if (total > 0 && done === total) {
      statusSelect.value = 'Completed';
      if (summaryPill) {
        summaryPill.className = 'badge badge-success';
      }
    } else if (done > 0) {
      statusSelect.value = 'In Progress';
      if (summaryPill) {
        summaryPill.className = 'badge badge-amber';
      }
    } else {
      statusSelect.value = 'Pending';
      if (summaryPill) {
        summaryPill.className = 'badge badge-secondary';
      }
    }
  }

  calculateTimelineProgress();
}

// -------------------------------------------------------------
// IMAGE UPLOAD & GALLERY ATTACHMENTS
// -------------------------------------------------------------
function handleMilestoneImageUpload(event, msId) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const gallery = document.getElementById(`ms-image-gallery-${msId}`);
  if (!gallery) return;

  // Clear empty state text
  const emptySpan = gallery.querySelector('span.text-muted');
  if (emptySpan) emptySpan.remove();

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const imgData = {
        id: 'img-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        name: file.name,
        url: e.target.result,
        uploadedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      addMilestoneImageCard(msId, imgData);
      updateMilestoneImageCount(msId);
    };
    reader.readAsDataURL(file);
  });

  event.target.value = '';
}

function addMilestoneImageCard(msId, imgData) {
  const gallery = document.getElementById(`ms-image-gallery-${msId}`);
  if (!gallery) return;

  const card = document.createElement('div');
  card.className = 'ms-image-card';
  card.setAttribute('data-img-url', imgData.url);
  card.setAttribute('data-img-name', imgData.name);
  card.style.cssText = 'position: relative; width: 72px; height: 72px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; cursor: pointer; box-shadow: var(--shadow-sm);';
  
  card.innerHTML = `
    <img src="${imgData.url}" alt="${escapeAttr(imgData.name)}" style="width: 100%; height: 100%; object-fit: cover;" onclick="previewFullImage('${escapeAttr(imgData.url)}', '${escapeAttr(imgData.name)}')">
    <button type="button" class="btn-close" style="position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; background: rgba(0,0,0,0.6); color: #ffffff; border: none; border-radius: 50%; font-size: 10px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); this.closest('.ms-image-card').remove(); updateMilestoneImageCount('${msId}');">
      &times;
    </button>
  `;

  gallery.appendChild(card);
  updateMilestoneImageCount(msId);
}

function updateMilestoneImageCount(msId) {
  const gallery = document.getElementById(`ms-image-gallery-${msId}`);
  const countEl = document.getElementById(`ms-image-count-${msId}`);
  if (!gallery || !countEl) return;

  const cards = gallery.querySelectorAll('.ms-image-card');
  countEl.textContent = cards.length;
}

function previewFullImage(url, title = 'Foto Dokumentasi') {
  const modalContent = document.getElementById('preview-modal-content');
  const modalTitle = document.getElementById('preview-modal-title');
  if (modalTitle) modalTitle.innerHTML = `<i data-lucide="image" style="color: #4f46e5;"></i> ${title}`;
  if (modalContent) {
    modalContent.innerHTML = `
      <div style="text-align: center; padding: 10px;">
        <img src="${url}" alt="${escapeAttr(title)}" style="max-width: 100%; max-height: 75vh; border-radius: 8px; box-shadow: var(--shadow-lg);">
        <div style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">${title}</div>
      </div>
    `;
  }
  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

function openMilestoneReportLink(btn) {
  const input = btn.closest('div')?.querySelector('.tm-ms-report-url');
  const url = input?.value?.trim();
  if (url) {
    const validUrl = url.startsWith('http') ? url : `https://${url}`;
    window.open(validUrl, '_blank');
  } else {
    showToast('Masukkan link laporan hasil terlebih dahulu', 'warning');
  }
}

// -------------------------------------------------------------
// THREADED COMMENTS & DISCUSSION
// -------------------------------------------------------------
function addMilestoneComment(msId) {
  const authorInput = document.getElementById(`ms-comment-author-${msId}`);
  const textInput = document.getElementById(`ms-comment-text-${msId}`);
  const stream = document.getElementById(`ms-comments-stream-${msId}`);
  if (!textInput || !stream) return;

  const text = textInput.value.trim();
  if (!text) {
    showToast('Tuliskan isi komentar terlebih dahulu', 'warning');
    return;
  }

  const author = authorInput?.value?.trim() || 'Tim Pelaksana';
  const now = new Date();
  const timeStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ', ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const commentObj = {
    id: 'c-' + Date.now(),
    sender: author,
    role: author.includes('Ir.') || author.includes('Lead') ? 'Project Lead' : 'Pelaksana Tim',
    text: text,
    timestamp: timeStr
  };

  // Remove empty text if present
  const emptySpan = stream.querySelector('span.text-muted');
  if (emptySpan) emptySpan.remove();

  renderMilestoneCommentBubble(msId, commentObj);
  textInput.value = '';

  const countEl = document.getElementById(`ms-comment-count-${msId}`);
  if (countEl) {
    const bubbles = stream.querySelectorAll('.ms-comment-bubble');
    countEl.textContent = bubbles.length;
  }

  showToast('Komentar berhasil ditambahkan!', 'success');
}

function renderMilestoneCommentBubble(msId, comment) {
  const stream = document.getElementById(`ms-comments-stream-${msId}`);
  if (!stream) return;

  const bubble = document.createElement('div');
  bubble.className = 'ms-comment-bubble';
  bubble.setAttribute('data-comment-id', comment.id || '');
  bubble.setAttribute('data-comment-sender', comment.sender || '');
  bubble.setAttribute('data-comment-role', comment.role || '');
  bubble.setAttribute('data-comment-text', comment.text || '');
  bubble.setAttribute('data-comment-time', comment.timestamp || '');
  bubble.style.cssText = 'display: flex; gap: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; align-items: flex-start;';
  
  const isLead = (comment.sender || '').includes('Ir.') || (comment.role || '').includes('Lead');
  const avatarBg = isLead ? '#4f46e5' : '#059669';
  const initials = (comment.sender || 'U').substring(0, 2).toUpperCase();

  bubble.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${avatarBg}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; flex-shrink: 0;">
      ${initials}
    </div>
    <div style="flex: 1;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="font-weight: 700; font-size: 12px; color: #0f172a;">${escapeAttr(comment.sender)}</span>
        <span style="font-size: 10.5px; color: #64748b;">${escapeAttr(comment.timestamp)}</span>
      </div>
      <div style="font-size: 12px; color: #334155; line-height: 1.4;">${escapeAttr(comment.text)}</div>
    </div>
  `;

  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
}

// -------------------------------------------------------------
// OVERALL TIMELINE PROGRESS CALCULATION
// -------------------------------------------------------------
function calculateTimelineProgress() {
  const activeMs = currentActiveProjectData?.milestones;
  if (activeMs && activeMs.length > 0) {
    const total = activeMs.length;
    let completed = 0;
    let inProgress = 0;
    activeMs.forEach(m => {
      if (m.status === 'Completed') completed++;
      else if (m.status === 'In Progress') inProgress += 0.5;
    });
    const percent = Math.min(100, Math.round(((completed + inProgress) / total) * 100));
    setTimelineProgressUI(percent);
    return percent;
  }

  const rows = document.querySelectorAll('#timeline-milestones-list .timeline-milestone-row');
  const total = rows.length;
  if (total === 0) {
    setTimelineProgressUI(0);
    return 0;
  }

  let completed = 0;
  let inProgress = 0;

  rows.forEach(r => {
    const status = r.querySelector('.tm-ms-status')?.value;
    if (status === 'Completed') completed++;
    else if (status === 'In Progress') inProgress += 0.5;
  });

  const percent = Math.min(100, Math.round(((completed + inProgress) / total) * 100));
  setTimelineProgressUI(percent);
  return percent;
}

function setTimelineProgressUI(percent) {
  const bar = document.getElementById('timeline-progress-bar');
  const label = document.getElementById('timeline-progress-label');
  if (bar) bar.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}% Selesai`;
}

function updateTimelineHeaderBadge() {
  // Hook for visual badge updates
}

// -------------------------------------------------------------
// SAVE ALL TIMELINE & MILESTONE (SUBTASKS, REPORTS, IMAGES, COMMENTS)
// -------------------------------------------------------------
async function saveProjectTimelineData(redirect = true) {
  if (!currentActiveProjectOrderId) {
    showToast('Pilih order penjualan terlebih dahulu', 'warning');
    return;
  }

  const order = state.orders.find(o => o.id === currentActiveProjectOrderId);
  const existingProject = (state.projects || []).find(p => p.orderId === currentActiveProjectOrderId);

  // Extract all rich milestones data
  let milestones = [];
  if (currentActiveProjectData?.milestones && currentActiveProjectData.milestones.length > 0) {
    milestones = currentActiveProjectData.milestones;
  } else {
    document.querySelectorAll('#timeline-milestones-list .timeline-milestone-row').forEach(r => {
      const msId = r.getAttribute('data-ms-id') || ('ms-' + Math.random());
      const title = r.querySelector('.tm-ms-title')?.value?.trim();
      const startDate = r.querySelector('.tm-ms-start')?.value || '';
      const dueDate = r.querySelector('.tm-ms-due')?.value || '';
      const pic = r.querySelector('.tm-ms-pic')?.value?.trim() || '';
      const status = r.querySelector('.tm-ms-status')?.value || 'Pending';

      // Subtasks
      const subtasks = [];
      r.querySelectorAll('.ms-subtask-item').forEach(stRow => {
        const cb = stRow.querySelector('.ms-subtask-check');
        const text = stRow.querySelector('.ms-subtask-text')?.value?.trim();
        if (text) {
          subtasks.push({
            id: stRow.id.replace('subtask-row-', ''),
            title: text,
            done: Boolean(cb && cb.checked)
          });
        }
      });

      // Report
      const reportDesc = r.querySelector('.tm-ms-report-desc')?.value?.trim() || '';
      const reportUrl = r.querySelector('.tm-ms-report-url')?.value?.trim() || '';
      const images = [];
      r.querySelectorAll('.ms-image-card').forEach(imgCard => {
        const url = imgCard.getAttribute('data-img-url');
        const name = imgCard.getAttribute('data-img-name');
        if (url) images.push({ url, name });
      });

      // Comments
      const comments = [];
      r.querySelectorAll('.ms-comment-bubble').forEach(b => {
        comments.push({
          id: b.getAttribute('data-comment-id'),
          sender: b.getAttribute('data-comment-sender'),
          role: b.getAttribute('data-comment-role'),
          text: b.getAttribute('data-comment-text'),
          timestamp: b.getAttribute('data-comment-time')
        });
      });

      if (title) {
        milestones.push({
          id: msId,
          title,
          startDate,
          dueDate,
          pic,
          status,
          subtasks,
          report: {
            description: reportDesc,
            reportUrl: reportUrl,
            images: images
          },
          comments
        });
      }
    });
  }

  const status = document.getElementById('timeline-status-select')?.value || 'Planning';
  const startDate = document.getElementById('timeline-start-date')?.value || '';
  const dueDate = document.getElementById('timeline-due-date')?.value || '';
  const notes = document.getElementById('timeline-notes')?.value || '';
  const progressPercent = calculateTimelineProgress();

  const payload = {
    ...(existingProject || {}),
    orderId: currentActiveProjectOrderId,
    projectName: existingProject?.projectName || `${order?.items?.[0]?.itemName || 'Project'} (${order?.customerName || 'Customer'})`,
    customerName: order?.customerName || existingProject?.customerName || '-',
    status: status,
    startDate: startDate,
    dueDate: dueDate,
    notes: notes,
    progressPercent: progressPercent,
    milestones: milestones
  };

  try {
    let res;
    if (existingProject && existingProject.id) {
      res = await fetch(`/api/projects/${existingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      showToast('Seluruh data Timeline, Sub-Task, Laporan & Diskusi berhasil disimpan!', 'success');
      await fetchResource('projects');
      renderOrdersTable();
      updateSidebarBadges();
      loadDashboardData();
      if (redirect) {
        navigateTo('orders');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      showToast('Gagal menyimpan timeline project', 'error');
    }
  } catch (err) {
    console.error('Error saving timeline data:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

// -------------------------------------------------------------
// 3. SURAT TUGAS PENUGASAN TIM & PIC (EXPORT PDF / PRINT)
// -------------------------------------------------------------
function exportTeamAssignmentLetterPDF(orderId = null) {
  // Automatically close team-assignment-modal if open
  closeModal('team-assignment-modal');

  const targetOrderId = orderId || currentActiveProjectOrderId || (state.orders.length > 0 ? state.orders[0].id : null);
  if (!targetOrderId) {
    showToast('Pilih order penjualan terlebih dahulu', 'warning');
    return;
  }

  const order = state.orders.find(o => o.id === targetOrderId);
  const project = (state.projects || []).find(p => p.orderId === targetOrderId);

  const leadName = document.getElementById('pm-lead-name')?.value?.trim() || project?.projectLead || 'Ir. Budi Santoso';
  const department = document.getElementById('pm-department')?.value?.trim() || project?.department || 'Engineering & Assembly';
  
  // Collect team members
  let team = [];
  const domRows = document.querySelectorAll('#pm-team-list .pm-team-row');
  if (domRows.length > 0) {
    domRows.forEach(r => {
      const name = r.querySelector('.pm-member-name')?.value?.trim();
      const role = r.querySelector('.pm-member-role')?.value?.trim() || 'Pelaksana Teknis';
      const phone = r.querySelector('.pm-member-phone')?.value?.trim() || '-';
      if (name) team.push({ name, role, phone });
    });
  } else if (project?.team && project.team.length > 0) {
    team = project.team;
  }

  if (team.length === 0) {
    team = [
      { name: 'Ahmad Fauzi', role: 'Wiring & Enclosure Specialist', phone: '0812-3344-5566' },
      { name: 'Deni Prasetyo', role: 'PLC & QC Engineer', phone: '0813-7788-9900' }
    ];
  }

  const firstItem = order?.items?.[0]?.itemName || 'Proyek Solusi Otomasi & Fabrikasi';
  const orderNumCode = targetOrderId.replace(/[^0-9]/g, '') || '001';
  const currentYear = new Date().getFullYear();
  const letterNumber = `ST/UBM-ENG/${currentYear}/${orderNumCode}`;
  const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const content = document.getElementById('preview-modal-content') || document.getElementById('preview-modal-body');
  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) titleEl.innerHTML = `<i data-lucide="file-check-2" style="color: #4f46e5;"></i> Surat Tugas Penugasan Tim Proyek - ${targetOrderId}`;

  if (content) {
    const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
      companyName: 'Unit Bisnis Mandiri (UBM) Politeknik Takumi',
      institutionName: 'Yayasan Takumi Bina Karya',
      parentInstitution: 'Politeknik Takumi',
      address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Kab. Bekasi, Jawa Barat 17530',
      website: 'takumi.ac.id',
      email: 'ubm@takumi.ac.id',
      phone: '(021) 8990-1234',
      city: 'Cikarang',
      leaderName: 'Ir. Hendra Wijaya, M.T.',
      leaderNip: '19850412 201012 1 002',
      leaderRole: 'Ketua Unit Bisnis Mandiri (UBM)',
      wadir1Name: 'Dr. Eng. Tri Wahyudi, M.Eng.',
      wadir1Nip: '19820315 200804 1 003',
      wadir1Role: 'Wakil Direktur I Politeknik Takumi',
      copyrightText: 'Copyright © Bisnis Digital Takumi'
    };

    content.innerHTML = `
      <div class="doc-preview" style="font-family: 'Times New Roman', Times, serif; color: #000000; line-height: 1.5; padding: 10px 15px;">
        
        <!-- KOP SURAT RESMI POLITEKNIK TAKUMI & UBM -->
        <div style="text-align: center; border-bottom: 3px double #000000; padding-bottom: 12px; margin-bottom: 20px;">
          <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">${escapeHtml(compSettings.institutionName)}</div>
          <div style="font-size: 19px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">${escapeHtml(compSettings.parentInstitution)}</div>
          <div style="font-size: 15px; font-weight: bold; color: #1e3a8a; text-transform: uppercase;">${escapeHtml(compSettings.companyName)}</div>
          <div style="font-size: 11px; margin-top: 4px;">${escapeHtml(compSettings.address)}</div>
          <div style="font-size: 11px;">Website: ${escapeHtml(compSettings.website)} | Email: ${escapeHtml(compSettings.email)} | Telp: ${escapeHtml(compSettings.phone)}</div>
        </div>

        <!-- JUDUL SURAT TUGAS -->
        <div style="text-align: center; margin-bottom: 22px;">
          <div style="font-size: 16px; font-weight: bold; text-decoration: underline; text-transform: uppercase;">SURAT TUGAS PELAKSANAAN PROYEK</div>
          <div style="font-size: 12px; margin-top: 2px;">Nomor: <strong>${letterNumber}</strong></div>
        </div>

        <!-- PREAMBULE -->
        <div style="font-size: 12.5px; text-align: justify; margin-bottom: 14px;">
          Yang bertanda tangan di bawah ini, Pimpinan <strong>${escapeHtml(compSettings.companyName)}</strong> bersama dengan <strong>${escapeHtml(compSettings.wadir1Role)}</strong>, dengan ini memberikan penugasan resmi kepada nama-nama personil berikut untuk memimpin dan melaksanakan seluruh tahapan pengerjaan proyek pesanan pelanggan:
        </div>

        <!-- DETAIL REFERENSI PROYEK -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12.5px;">
          <tr>
            <td style="width: 220px; padding: 4px 0; font-weight: bold;">Nama Proyek / Produk</td>
            <td style="width: 15px; padding: 4px 0;">:</td>
            <td style="padding: 4px 0; font-weight: bold; color: #0f172a;">${firstItem}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">No. Order Penjualan</td>
            <td style="padding: 4px 0;">:</td>
            <td style="padding: 4px 0;"><strong>${targetOrderId}</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Pelanggan / Klien</td>
            <td style="padding: 4px 0;">:</td>
            <td style="padding: 4px 0;">${order?.customerName || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Divisi / Departemen Pelaksana</td>
            <td style="padding: 4px 0;">:</td>
            <td style="padding: 4px 0;">${department}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Target Waktu Penyelesaian</td>
            <td style="padding: 4px 0;">:</td>
            <td style="padding: 4px 0;">${order?.dueDate || 'Sesuai Timeline Milestone'}</td>
          </tr>
        </table>

        <!-- SUSUNAN TIM PELAKSANA -->
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px;">
          I. PENANGGUNG JAWAB UTAMA (PROJECT LEAD)
        </div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 14px; margin-bottom: 16px; font-size: 12.5px;">
          <div style="display: flex; justify-content: space-between;">
            <div>
              <strong>Nama Project Lead:</strong> <span style="font-size: 13.5px; font-weight: bold; color: #1e3a8a;">${leadName}</span>
            </div>
            <div>
              <strong>Jabatan / Peran:</strong> Lead Project Engineer & Penanggung Jawab Mutu
            </div>
          </div>
        </div>

        <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px;">
          II. DAFTAR ANGGOTA TIM PELAKSANA PROYEK
        </div>
        <table class="doc-table" style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px; font-family: 'Times New Roman', Times, serif;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">No.</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: left;">Nama Anggota Tim</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: left;">Peran / Tugas Khusus</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 140px;">Kontak / No. HP</th>
            </tr>
          </thead>
          <tbody>
            ${team.map((m, idx) => `
              <tr>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${m.name}</td>
                <td style="border: 1px solid #000; padding: 6px;">${m.role || 'Teknisi Pelaksana'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${m.phone || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- KETENTUAN DAN TANGGUNG JAWAB -->
        <div style="font-size: 12px; text-align: justify; margin-bottom: 24px;">
          <strong>Ketentuan Penugasan:</strong>
          <ol style="margin: 4px 0 0 18px; padding: 0;">
            <li>Melaksanakan pekerjaan proyek sesuai spesifikasi teknis, standar keselamatan kerja (K3), dan standar mutu ${escapeHtml(compSettings.parentInstitution)}.</li>
            <li>Melakukan koordinasi aktif bersama Project Lead dan Ketua UBM terkait perkembangan milestone dan kebutuhan logistik material.</li>
            <li>Surat Tugas ini berlaku terhitung sejak tanggal diterbitkan sampai dengan selesainya serah terima pekerjaan (Berita Acara Serah Terima) kepada pihak pelanggan.</li>
          </ol>
        </div>

        <!-- TANDA TANGAN RESMI (KETUA UBM & WAKIL DIREKTUR I) -->
        <div style="margin-top: 30px; page-break-inside: avoid; font-size: 12px;">
          <div style="text-align: right; margin-bottom: 16px; font-weight: 500;">${escapeHtml(compSettings.city || 'Bekasi')}, ${todayFormatted}</div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
            
            <!-- 1. KETUA UBM -->
            <div>
              <div style="font-weight: bold;">Yang Menugaskan,</div>
              <div style="font-weight: bold; font-size: 12px;">${escapeHtml(compSettings.leaderRole)}</div>
              <div style="font-size: 11px; color: #475569;">${escapeHtml(compSettings.parentInstitution)}</div>
              <div style="height: 70px; display: flex; align-items: center; justify-content: center; font-style: italic; color: #64748b; font-size: 11px;">
                (Tanda Tangan & Cap UBM)
              </div>
              <div style="font-weight: bold; text-decoration: underline; font-size: 12.5px;">${escapeHtml(compSettings.leaderName)}</div>
              <div style="font-size: 11px;">NIP/NIK. ${escapeHtml(compSettings.leaderNip || '-')}</div>
            </div>

            <!-- 2. WAKIL DIREKTUR I -->
            <div>
              <div style="font-weight: bold;">Mengetahui & Mengesahkan,</div>
              <div style="font-weight: bold; font-size: 12px;">${escapeHtml(compSettings.wadir1Role)}</div>
              <div style="font-size: 11px; color: #475569;">${escapeHtml(compSettings.parentInstitution)}</div>
              <div style="height: 70px; display: flex; align-items: center; justify-content: center; font-style: italic; color: #64748b; font-size: 11px;">
                (Tanda Tangan & Cap)
              </div>
              <div style="font-weight: bold; text-decoration: underline; font-size: 12.5px;">${escapeHtml(compSettings.wadir1Name)}</div>
              <div style="font-size: 11px;">NIP/NIK. ${escapeHtml(compSettings.wadir1Nip || '-')}</div>
            </div>

          </div>
        </div>

        <!-- FOOTER DOKUMEN -->
        <div style="margin-top: 30px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
          <span>${escapeHtml(compSettings.copyrightText)}</span>
          <span>Dokumen Resmi Sistem Manajemen ${escapeHtml(compSettings.companyShortName)}</span>
        </div>

      </div>
    `;
  }

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}
