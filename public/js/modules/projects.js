// =========================================================
// UBM - Project Management Module (Team Assignment & Timeline Milestone)
// =========================================================

// Helper: Memeriksa apakah order bertipe Jasa / Layanan (Non-BOM)
function isServiceOrder(order) {
  if (!order) return false;
  if (order.quotationId) {
    const quo = (state.quotations || []).find(q => q.id === order.quotationId);
    if (quo) {
      if (quo.quotationType === 'produk') return false;
      if (quo.quotationType === 'jasa') return true;
    }
  }
  if (order.quotationType === 'produk' || order.orderType === 'produk') return false;
  if (order.quotationType === 'jasa' || order.orderType === 'jasa') return true;
  if (order.notes) {
    const lower = order.notes.toLowerCase();
    if (lower.includes('surat penawaran harga (produk)') || lower.includes('[tipe: produk]')) return false;
    if (
      lower.includes('surat penawaran harga (jasa)') ||
      lower.includes('[tipe: jasa]') ||
      lower.includes('tipe penawaran: jasa')
    ) return true;
  }
  return false;
}

// Helper: Memeriksa apakah project berasal dari Quotation / Order bertipe Jasa
function isProjectService(p) {
  if (!p) return false;
  if (p.orderId) {
    const order = (state.orders || []).find(o => o.id === p.orderId);
    if (order) return isServiceOrder(order);
  }
  if (p.quotationId) {
    const quo = (state.quotations || []).find(q => q.id === p.quotationId);
    if (quo) {
      if (quo.quotationType === 'produk') return false;
      if (quo.quotationType === 'jasa') return true;
    }
  }
  if (p.projectType === 'produk' || p.quotationType === 'produk') return false;
  if (p.projectType === 'jasa' || p.quotationType === 'jasa') return true;
  if (p.notes) {
    const lower = p.notes.toLowerCase();
    if (lower.includes('surat penawaran harga (produk)') || lower.includes('[tipe: produk]')) return false;
    if (
      lower.includes('surat penawaran harga (jasa)') ||
      lower.includes('[tipe: jasa]') ||
      lower.includes('tipe penawaran: jasa')
    ) return true;
  }
  return false;
}

window.isProjectService = isProjectService;

let currentActiveProjectOrderId = null;

// -------------------------------------------------------------
// 1. PROJECT MANAGEMENT OVERVIEW TABLE & DETAIL POPUP
// -------------------------------------------------------------
function renderProjectsTableView() {
  const tbody = document.getElementById('table-projects-body');
  if (!tbody) return;

  // Project Management KHUSUS Produk Manufaktur (Jasa ditiadakan / tidak masuk ke Project Management)
  let list = (state.projects || []).filter(p => !isProjectService(p));
  const statusFilter = document.getElementById('filter-project-status')?.value || 'ALL';

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Administrator';

  // Role Member: hanya melihat project yang ditugaskan (assigned) padanya sebagai Leader atau anggota Tim
  if (roleName === 'Member') {
    list = list.filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : true);
  }

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
    if (roleName === 'Member') {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 36px;"><p style="font-size: 13.5px; font-weight: 600; color: #475569; margin-bottom: 4px;">Belum Ada Project yang Ditugaskan</p><p style="font-size: 12px; color: #94a3b8; margin: 0;">Anda belum terdaftar dalam tim pelaksana project aktif manapun oleh Lead Project.</p></td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 32px;">Tidak ada data project ditemukan.</td></tr>';
    }
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

    const hasTimeline = Array.isArray(p.milestones) && p.milestones.length > 0;
    const dateRange = hasTimeline
      ? (p.startDate && p.dueDate ? `${p.startDate} s/d ${p.dueDate}` : (p.dueDate ? `Deadline: ${p.dueDate}` : '-'))
      : '<span class="badge badge-secondary" style="font-size: 10px; font-weight: 600;">Belum Input Timeline</span>';

    return `
      <tr style="cursor: pointer; transition: background-color 0.15s ease;" class="project-row" onclick="openProjectTimelinePage('${p.id || p.orderId}')" title="Klik untuk membuka Detail Timeline & Milestone">
        <td>
          <span class="mono-id font-bold text-primary" style="font-size: 11px;">${p.id}</span>
          ${p.orderId ? `<div class="font-xs text-muted font-mono" style="font-size: 10px; margin-top: 2px;">Ref: ${p.orderId}</div>` : `<div class="font-xs text-muted" style="font-size: 10px; margin-top: 2px;"><span class="badge badge-outline" style="font-size: 9px; padding: 1px 5px; color: #4338ca; border-color: #c7d2fe; background: #eef2ff;">Direct / Mandiri</span></div>`}
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
          <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 5px;">
            <button class="btn btn-sm btn-outline" style="color: #4f46e5; border-color: #c7d2fe; font-size: 11px; padding: 4px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: #fdf4ff;" onclick="openProjectTimelinePage('${p.id || p.orderId}')" title="Buka Detail Timeline & Milestone">
              <i data-lucide="folder-kanban" style="width: 13px; height: 13px;"></i> Timeline
            </button>
            <button class="btn-icon btn-danger-ghost" style="width: 28px; height: 28px; border-radius: 4px;" title="Hapus Project" onclick="deleteResource('projects', '${p.id}')">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
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
    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="btn btn-sm btn-outline" style="color: #4f46e5; border-color: #c7d2fe;" onclick="closeModal('project-detail-modal'); openTeamAssignmentPage('${p.orderId || p.id || ''}')">
          <i data-lucide="edit-3"></i> Edit Penugasan Tim
        </button>
        ${(typeof getNormalizedRole === 'function' && getNormalizedRole(typeof getAuthUser === 'function' ? getAuthUser() : null) === 'Administrator') ? `
        <button type="button" class="btn btn-sm btn-primary" style="background: #059669; border-color: #059669; color: #ffffff;" onclick="closeModal('project-detail-modal'); sendTeamAssignmentEmail('${p.orderId || p.id || ''}')">
          <i data-lucide="mail"></i> Kirim Surat Tugas via Email
        </button>
        ` : ''}
        <button type="button" class="btn btn-sm btn-outline" style="color: #0284c7; border-color: #bae6fd;" onclick="closeModal('project-detail-modal'); openProjectTimelinePage('${p.orderId || p.id || ''}')">
          <i data-lucide="folder-kanban"></i> Buka Timeline Gantt Penuh
        </button>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick="closeModal('project-detail-modal')">Tutup</button>
    </div>
  `;

  openModal('project-detail-modal');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// DIRECT / STANDALONE PROJECT MANAGEMENT CREATION
// -------------------------------------------------------------
function openCreateDirectProjectModal() {
  const form = document.getElementById('form-create-direct-project');
  if (form) form.reset();

  const orderSelect = document.getElementById('direct-pm-order-select');
  if (orderSelect) {
    let opts = '<option value="">-- Tanpa Referensi Order (Project Langsung / Mandiri) --</option>';
    const orders = state.orders || [];
    orders.forEach(o => {
      opts += `<option value="${o.id}">[${o.id}] ${escapeHtml(o.customerName)} - ${escapeHtml(o.projectName || o.items?.[0]?.itemName || 'Order')} (${formatRupiah(o.grandTotal)})</option>`;
    });
    orderSelect.innerHTML = opts;
    orderSelect.value = '';
  }

  const nameInput = document.getElementById('direct-pm-name');
  if (nameInput) nameInput.value = '';

  const customerInput = document.getElementById('direct-pm-customer');
  if (customerInput) customerInput.value = 'Internal UBM';

  const deptInput = document.getElementById('direct-pm-department');
  if (deptInput) deptInput.value = 'Engineering';

  const statusSelect = document.getElementById('direct-pm-status');
  if (statusSelect) statusSelect.value = 'Planning';

  const todayStr = new Date().toISOString().split('T')[0];
  const startInput = document.getElementById('direct-pm-start-date');
  if (startInput) startInput.value = todayStr;

  const dueInput = document.getElementById('direct-pm-due-date');
  if (dueInput) {
    const dueObj = new Date();
    dueObj.setDate(dueObj.getDate() + 30);
    dueInput.value = dueObj.toISOString().split('T')[0];
  }

  const leadSelect = document.getElementById('direct-pm-lead-name');
  if (leadSelect) {
    if (typeof getUserDropdownOptions === 'function') {
      leadSelect.innerHTML = getUserDropdownOptions('', '-- Pilih Akun Lead Project --');
    } else {
      const users = state.users || [];
      leadSelect.innerHTML = '<option value="">-- Pilih Akun Lead Project --</option>' +
        users.map(u => `<option value="${escapeAttr(u.name)}">${escapeHtml(u.name)} (${escapeHtml(u.role)})</option>`).join('');
    }
  }

  const teamContainer = document.getElementById('direct-pm-team-list');
  if (teamContainer) {
    teamContainer.innerHTML = '';
    addDirectProjectTeamMemberRow('', 'Teknisi', '');
  }

  const notesInput = document.getElementById('direct-pm-notes');
  if (notesInput) notesInput.value = '';

  openModal('modal-create-direct-project');
  if (window.lucide) lucide.createIcons();
}
window.openCreateDirectProjectModal = openCreateDirectProjectModal;

function onDirectProjectOrderChange(orderId) {
  if (!orderId) {
    const custInput = document.getElementById('direct-pm-customer');
    if (custInput && (!custInput.value || custInput.value.trim() === '')) {
      custInput.value = 'Internal UBM';
    }
    return;
  }

  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  const nameInput = document.getElementById('direct-pm-name');
  if (nameInput) {
    nameInput.value = order.projectName || order.items?.[0]?.itemName || `Project ${order.id}`;
  }

  const custInput = document.getElementById('direct-pm-customer');
  if (custInput) {
    custInput.value = order.customerName || '';
  }

  const startInput = document.getElementById('direct-pm-start-date');
  if (startInput && order.orderDate) {
    startInput.value = order.orderDate;
  }

  const dueInput = document.getElementById('direct-pm-due-date');
  if (dueInput && order.dueDate) {
    dueInput.value = order.dueDate;
  }

  const notesInput = document.getElementById('direct-pm-notes');
  if (notesInput && order.notes) {
    notesInput.value = typeof cleanDisplayNotes === 'function'
      ? cleanDisplayNotes(order.notes)
      : (order.notes || '').replace(/<!--[\s\S]*?-->/g, '').trim();
  }
}
window.onDirectProjectOrderChange = onDirectProjectOrderChange;

function addDirectProjectTeamMemberRow(name = '', role = 'Teknisi', phone = '') {
  const container = document.getElementById('direct-pm-team-list');
  if (!container) return;

  const rowId = 'direct-team-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const row = document.createElement('div');
  row.className = 'direct-team-row';
  row.id = rowId;
  row.style.cssText = 'display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 36px; gap: 8px; align-items: center; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color);';

  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm direct-member-name" placeholder="Nama Anggota Tim" value="${escapeAttr(name)}" list="users-assignment-datalist">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm direct-member-role" placeholder="Peran (Teknisi/QC/Drafter)" value="${escapeAttr(role)}">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm direct-member-phone" placeholder="No. Telp / WA" value="${escapeAttr(phone)}">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" style="width: 28px; height: 28px;" title="Hapus Anggota" onclick="removeDirectProjectTeamMemberRow(this)">
        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}
window.addDirectProjectTeamMemberRow = addDirectProjectTeamMemberRow;

function removeDirectProjectTeamMemberRow(btn) {
  const row = btn.closest('.direct-team-row');
  if (row) row.remove();
}
window.removeDirectProjectTeamMemberRow = removeDirectProjectTeamMemberRow;

async function saveDirectProject(openTimeline = false) {
  const name = document.getElementById('direct-pm-name')?.value?.trim();
  if (!name) {
    showToast('Nama Project wajib diisi!', 'warning');
    document.getElementById('direct-pm-name')?.focus();
    return;
  }

  const lead = document.getElementById('direct-pm-lead-name')?.value?.trim();
  if (!lead) {
    showToast('Pilih Project Lead / Penanggung Jawab Utama terlebih dahulu!', 'warning');
    document.getElementById('direct-pm-lead-name')?.focus();
    return;
  }

  const orderId = document.getElementById('direct-pm-order-select')?.value?.trim() || null;
  const customer = document.getElementById('direct-pm-customer')?.value?.trim() || 'Internal UBM';
  const department = document.getElementById('direct-pm-department')?.value?.trim() || 'Engineering';
  const status = document.getElementById('direct-pm-status')?.value || 'Planning';
  const startDate = document.getElementById('direct-pm-start-date')?.value || new Date().toISOString().split('T')[0];
  const dueDate = document.getElementById('direct-pm-due-date')?.value || '';
  const notes = document.getElementById('direct-pm-notes')?.value?.trim() || '';

  // Extract team
  const team = [];
  document.querySelectorAll('#direct-pm-team-list .direct-team-row').forEach(r => {
    const mName = r.querySelector('.direct-member-name')?.value?.trim();
    const mRole = r.querySelector('.direct-member-role')?.value?.trim() || 'Teknisi';
    const mPhone = r.querySelector('.direct-member-phone')?.value?.trim() || '';
    if (mName) {
      team.push({ name: mName, role: mRole, phone: mPhone });
    }
  });

  const payload = {
    projectName: name,
    customerName: customer,
    orderId: orderId,
    isDirect: !orderId,
    projectLead: lead,
    isLeadLocked: true,
    department: department,
    status: status,
    startDate: startDate,
    dueDate: dueDate,
    team: team,
    progressPercent: 0,
    milestones: [],
    notes: notes,
    createdAt: new Date().toISOString()
  };

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const created = await res.json();
      closeModal('modal-create-direct-project');
      showToast(`Project Management "${escapeHtml(name)}" berhasil dibuat!`, 'success');
      await fetchResource('projects');
      renderProjectsTableView();
      updateSidebarBadges();
      loadDashboardData();

      if (openTimeline) {
        state.timelineReturnView = 'projects';
        openProjectTimelinePage(created.id || created.orderId);
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      showToast(errData.error || 'Gagal membuat project baru', 'error');
    }
  } catch (err) {
    console.error('Error creating direct project:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}
window.saveDirectProject = saveDirectProject;

function openProjectAssignmentWorkspace() {
  openCreateDirectProjectModal();
}

// -------------------------------------------------------------
// 2. TEAM & PIC ASSIGNMENT WORKSPACE
// -------------------------------------------------------------
function openProjectManagementPage(orderId = null) {
  openTeamAssignmentPage(orderId);
}

function openTeamAssignmentPage(orderId = null) {
  const defaultTarget = orderId || (state.projects.length > 0 ? (state.projects[0].id || state.projects[0].orderId) : (state.orders.length > 0 ? state.orders[0].id : null));
  currentActiveProjectOrderId = orderId || defaultTarget;

  const orderSelect = document.getElementById('pm-order-select');
  if (orderSelect) {
    let opts = '';
    const directProjs = (state.projects || []).filter(p => !p.orderId);
    if (directProjs.length > 0) {
      opts += '<optgroup label="Project Mandiri / Direct">';
      directProjs.forEach(dp => {
        const isSel = (dp.id === currentActiveProjectOrderId) ? 'selected' : '';
        opts += `<option value="${dp.id}" ${isSel}>[${dp.id}] ${escapeHtml(dp.projectName)} (${escapeHtml(dp.customerName || 'Mandiri')})</option>`;
      });
      opts += '</optgroup>';
    }

    if (state.orders && state.orders.length > 0) {
      opts += '<optgroup label="Order Penjualan">';
      state.orders.forEach(o => {
        const isSel = (o.id === currentActiveProjectOrderId) ? 'selected' : '';
        opts += `<option value="${o.id}" ${isSel}>[${o.id}] ${escapeHtml(o.customerName)} - ${escapeHtml(o.projectName || o.items?.[0]?.itemName || 'Order')} (${formatRupiah(o.grandTotal)})</option>`;
      });
      opts += '</optgroup>';
    }

    if (!opts) {
      opts = '<option value="">-- Belum Ada Order / Project --</option>';
    }
    orderSelect.innerHTML = opts;
  }

  renderTeamAssignmentWorkspace(currentActiveProjectOrderId);
  openModal('team-assignment-modal');
  if (window.lucide) lucide.createIcons();
}
window.openTeamAssignmentPage = openTeamAssignmentPage;

function switchProjectOrder(orderId) {
  currentActiveProjectOrderId = orderId;
  renderTeamAssignmentWorkspace(orderId);
}
window.switchProjectOrder = switchProjectOrder;

function renderTeamAssignmentWorkspace(orderId) {
  if (!orderId) return;

  const project = (state.projects || []).find(p => p.id === orderId || p.orderId === orderId);
  const order = state.orders.find(o => o.id === (project?.orderId || orderId));

  let activeProj = project;
  if (!activeProj) {
    if (order) {
      const firstItem = order?.items?.[0]?.itemName || 'Produk Pesanan';
      const projName = order?.projectName || `${firstItem} (${order?.customerName || 'Customer'})`;
      activeProj = {
        orderId: order.id,
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
    } else {
      activeProj = {
        id: orderId,
        projectName: 'Project Mandiri',
        customerName: 'Internal UBM',
        projectLead: '',
        department: 'Engineering',
        status: 'Planning',
        progressPercent: 0,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        team: [],
        milestones: [],
        notes: ''
      };
    }
  }

  // Update Header & Inputs
  const headerOrderId = document.getElementById('pm-header-order-id');
  if (headerOrderId) {
    const code = activeProj.orderId ? activeProj.orderId : (activeProj.id || orderId);
    headerOrderId.textContent = `${code} - ${activeProj.projectName || activeProj.customerName || order?.customerName || ''}`;
  }

  // Tampilkan Tanggal Order dan Due Date Riil dari Order (BUKAN dari Quotation)
  const elInfoOrderDate = document.getElementById('pm-info-order-date');
  const elInfoDueDate = document.getElementById('pm-info-due-date');
  const elInfoOrderType = document.getElementById('pm-info-order-type');
  const isSvc = isServiceOrder(order) || isProjectService(activeProj);

  if (elInfoOrderDate) {
    const realOrderDate = order?.orderDate || activeProj.startDate || '-';
    elInfoOrderDate.textContent = typeof formatDate === 'function' ? formatDate(realOrderDate) : realOrderDate;
  }
  if (elInfoDueDate) {
    const realDueDate = order?.dueDate || activeProj.dueDate || '-';
    elInfoDueDate.textContent = typeof formatDate === 'function' ? formatDate(realDueDate) : realDueDate;
  }
  if (elInfoOrderType) {
    if (isSvc) {
      elInfoOrderType.innerHTML = '<span class="badge" style="background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; font-size: 10px; font-weight: 700;">🛠️ Jasa / Layanan (Non-BOM)</span>';
    } else if (activeProj.isDirect || !order) {
      elInfoOrderType.innerHTML = '<span class="badge" style="background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; font-size: 10px; font-weight: 700;">🏢 Project Mandiri UBM</span>';
    } else {
      elInfoOrderType.innerHTML = '<span class="badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 10px; font-weight: 700;">📦 Produk Manufaktur</span>';
    }
  }

  const elInfoCustomer = document.getElementById('pm-info-customer');
  if (elInfoCustomer) {
    const cust = order?.customerName || activeProj.customerName || '-';
    const phone = order?.customerPhone || activeProj.customerPhone || '';
    elInfoCustomer.textContent = phone ? `${cust} (${phone})` : cust;
  }

  const elInfoNotes = document.getElementById('pm-info-notes');
  const notesContainer = document.getElementById('pm-notes-preview-container');
  const rawNotes = (order && order.notes !== undefined) ? order.notes : (activeProj.notes || '');
  const cleanNotes = (typeof cleanDisplayNotes === 'function')
    ? cleanDisplayNotes(rawNotes)
    : (rawNotes || '').replace(/<!--UBM_[\s\S]*?-->/g, '').trim();

  if (notesContainer && elInfoNotes) {
    if (cleanNotes) {
      notesContainer.style.display = 'block';
      elInfoNotes.textContent = cleanNotes;
    } else {
      notesContainer.style.display = 'none';
    }
  }

  const leadInput = document.getElementById('pm-lead-name');
  const lockBadge = document.getElementById('pm-lead-lock-badge');
  const hintText = document.getElementById('pm-lead-hint');

  // Check if project lead has already been saved/assigned or user lacks permission to assign lead
  const isLeadLocked = Boolean(activeProj.isLeadLocked || (activeProj.id && activeProj.projectLead && activeProj.projectLead.trim() !== '' && activeProj.projectLead !== 'Belum diassign'));
  const canAssignLead = (typeof hasRolePermission === 'function') ? hasRolePermission('canAssignLead') : true;

  if (leadInput) {
    if (typeof getUserDropdownOptions === 'function') {
      leadInput.innerHTML = getUserDropdownOptions(activeProj.projectLead || '', '-- Pilih Akun Lead Project --');
    }
    if (!canAssignLead) {
      leadInput.disabled = true;
      leadInput.style.backgroundColor = '#f1f5f9';
      leadInput.style.cursor = 'not-allowed';
      leadInput.style.borderColor = '#cbd5e1';
      leadInput.style.color = '#1e293b';
      leadInput.style.fontWeight = '600';
      if (lockBadge) {
        lockBadge.innerHTML = '<span class="badge badge-info" style="font-size: 10px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="shield" style="width: 11px; height: 11px;"></i> Wewenang Ketua UBM</span>';
      }
      if (hintText) {
        hintText.innerHTML = '<span style="color: #64748b; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;"><i data-lucide="info" style="width: 12px; height: 12px;"></i> Penugasan Lead Project adalah wewenang Ketua UBM / Administrator. Anda dapat mendaftarkan anggota tim di bawah.</span>';
      }
    } else if (isLeadLocked) {
      leadInput.disabled = true;
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
      leadInput.disabled = false;
      leadInput.style.backgroundColor = '#ffffff';
      leadInput.style.cursor = 'pointer';
      leadInput.style.borderColor = '';
      leadInput.style.color = '';
      leadInput.style.fontWeight = 'normal';
      if (lockBadge) {
        lockBadge.innerHTML = '<span class="badge badge-amber" style="font-size: 10px; padding: 2px 6px;">Perlu Disimpan</span>';
      }
      if (hintText) {
        hintText.innerHTML = 'Pilih akun terdaftar sebagai Lead Project. Setelah disimpan, Lead Project akan terkunci secara permanen.';
      }
    }
  }

  const deptInput = document.getElementById('pm-department');
  if (deptInput) deptInput.value = activeProj.department || '';

  // Render Team Members
  const teamList = document.getElementById('pm-team-list');
  if (teamList) {
    teamList.innerHTML = '';
    if (activeProj.team && activeProj.team.length > 0) {
      activeProj.team.forEach(m => addProjectTeamMemberRow(m));
    } else {
      addProjectTeamMemberRow();
    }
  }

  // Wewenang: Hanya Lead Project atau Administrator yang dapat mendaftarkan/mengubah anggota tim
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : '';
  const isAdmin = roleName === 'Administrator';
  const isLead = (typeof isUserProjectLead === 'function' ? isUserProjectLead(orderId, activeUser) : true) || canAssignLead || !activeProj.projectLead || activeProj.projectLead === 'Belum diassign';
  if (deptInput) deptInput.disabled = !isLead;

  const addMemberBtn = document.querySelector('#team-assignment-modal button[onclick*="addProjectTeamMemberRow"]');
  const saveTeamBtn = document.querySelector('#team-assignment-modal button[onclick*="saveTeamAssignmentData"]');
  if (addMemberBtn) addMemberBtn.style.display = isLead ? 'inline-flex' : 'none';
  if (saveTeamBtn) saveTeamBtn.style.display = isLead ? 'inline-flex' : 'none';

  // Tombol Kirim via Email KHUSUS Role Administrator
  const emailBtnHeader = document.getElementById('btn-send-assignment-email-header');
  const emailBtnFooter = document.getElementById('btn-send-assignment-email-footer');
  const emailInfoBox = document.getElementById('pm-admin-email-info-box');
  if (emailBtnHeader) emailBtnHeader.style.display = isAdmin ? 'inline-flex' : 'none';
  if (emailBtnFooter) emailBtnFooter.style.display = isAdmin ? 'inline-flex' : 'none';
  if (emailInfoBox) emailInfoBox.style.display = isAdmin ? 'block' : 'none';
  if (isAdmin && typeof updateTeamAssignmentEmailPreview === 'function') {
    updateTeamAssignmentEmailPreview();
  }

  // Render Dynamic Next-Step Quick Action Button
  const quickContainer = document.getElementById('pm-quick-action-container');
  if (quickContainer) {
    const isService = isServiceOrder(order);
    const hasBOM = isService || (state.bom || []).some(b => b.orderId === orderId || (order?.items || []).some(item => b.productName && item.itemName && b.productName.toLowerCase().trim() === item.itemName.toLowerCase().trim()));

    if (isService) {
      // Untuk Project Jasa / Layanan (Non-BOM): HAPUS tombol Buka Timeline Gantt
      quickContainer.innerHTML = `
        <button type="button" class="btn btn-outline btn-sm" style="color: #ea580c; border-color: #fed7aa; background: #fff7ed; font-size: 11px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600;" onclick="closeModal('team-assignment-modal'); if (typeof openServiceExpenseModal === 'function') openServiceExpenseModal('${order?.id || orderId}');">
          <i data-lucide="car" style="width: 13px; height: 13px; color: #ea580c;"></i> Pengajuan Biaya Ops Jasa &rarr;
        </button>
      `;
    } else if (!isLeadLocked) {
      quickContainer.innerHTML = `
        <button type="button" class="btn btn-outline btn-sm" style="color: #94a3b8; opacity: 0.6; cursor: not-allowed;" title="Simpan Project Lead terlebih dahulu" onclick="showToast('Simpan Penugasan Tim terlebih dahulu untuk mengaktifkan pengisian BOM.', 'warning')">
          <i data-lucide="lock" style="width: 12px; height: 12px;"></i> Lanjut: Input BOM &rarr;
        </button>
      `;
    } else if (!hasBOM) {
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

function autoFillTeamMemberFromAccount(selectEl) {
  if (!selectEl) return;
  const val = (selectEl.value || '').trim();
  const opt = selectEl.options ? selectEl.options[selectEl.selectedIndex] : null;
  const users = (typeof state !== 'undefined' && Array.isArray(state.users)) ? state.users : [];
  const user = users.find(u => u && u.name && u.name.toLowerCase() === val.toLowerCase());
  
  const row = selectEl.closest('.pm-team-row');
  if (row) {
    const roleInp = row.querySelector('.pm-member-role');
    const phoneInp = row.querySelector('.pm-member-phone');
    const autoRole = opt?.getAttribute('data-role') || user?.role || (val ? 'Member' : '');
    const autoPhone = opt?.getAttribute('data-phone') || user?.phone || '';
    const autoEmail = opt?.getAttribute('data-email') || user?.email || '';
    row.setAttribute('data-member-email', autoEmail);
    if (roleInp && autoRole) roleInp.value = autoRole;
    if (phoneInp && autoPhone && !phoneInp.value) phoneInp.value = autoPhone;
  }
  if (typeof updateTeamAssignmentEmailPreview === 'function') {
    updateTeamAssignmentEmailPreview();
  }
}
window.autoFillTeamMemberFromAccount = autoFillTeamMemberFromAccount;

function addProjectTeamMemberRow(member = null) {
  const container = document.getElementById('pm-team-list');
  if (!container) return;

  const currentMemberName = typeof member === 'string' ? member : (member?.name || '');
  const currentMemberEmail = (typeof member === 'object' && member?.email) ? member.email : '';
  const row = document.createElement('div');
  row.className = 'pm-team-row';
  if (currentMemberEmail) row.setAttribute('data-member-email', currentMemberEmail);
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 8px; align-items: center; background: #ffffff; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px;';
  
  const selectHtml = (typeof getUserDropdownOptions === 'function')
    ? getUserDropdownOptions(currentMemberName, '-- Pilih Akun Member --')
    : `<option value="${escapeAttr(currentMemberName)}">${escapeHtml(currentMemberName || '-- Pilih Akun --')}</option>`;

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(currentActiveProjectOrderId, activeUser) : true;

  row.innerHTML = `
    <div>
      <select class="form-control form-control-sm pm-member-name" required onchange="autoFillTeamMemberFromAccount(this)" ${isLead ? '' : 'disabled style="background: #f1f5f9; cursor: not-allowed;"'}>
        ${selectHtml}
      </select>
    </div>
    <div>
      <input type="text" class="form-control form-control-sm pm-member-role" placeholder="Role / Keahlian (e.g. Wiring)" value="${escapeAttr(member?.role || '')}" ${isLead ? '' : 'disabled style="background: #f1f5f9; cursor: not-allowed;"'}>
    </div>
    <div>
      <input type="text" class="form-control form-control-sm pm-member-phone" placeholder="No. HP / Kontak" value="${escapeAttr(member?.phone || '')}" ${isLead ? '' : 'disabled style="background: #f1f5f9; cursor: not-allowed;"'}>
    </div>
    <div>
      ${isLead ? `<button type="button" class="btn-icon btn-danger-ghost" title="Hapus Anggota" onclick="this.closest('.pm-team-row').remove(); if(typeof updateTeamAssignmentEmailPreview === 'function') updateTeamAssignmentEmailPreview();"><i data-lucide="trash-2"></i></button>` : ''}
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  if (typeof updateTeamAssignmentEmailPreview === 'function') {
    updateTeamAssignmentEmailPreview();
  }
}
window.addProjectTeamMemberRow = addProjectTeamMemberRow;

async function saveTeamAssignmentData() {
  if (!currentActiveProjectOrderId) {
    showToast('Pilih order atau project terlebih dahulu', 'warning');
    return;
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const existingProject = (state.projects || []).find(p => p.id === currentActiveProjectOrderId || p.orderId === currentActiveProjectOrderId);
  const order = state.orders.find(o => o.id === (existingProject?.orderId || currentActiveProjectOrderId));

  const canAssignLead = (typeof hasRolePermission === 'function') ? hasRolePermission('canAssignLead') : true;
  const isExistingLeadAssigned = Boolean(existingProject?.projectLead && existingProject.projectLead !== 'Belum diassign');
  const isLead = isExistingLeadAssigned ? ((typeof isUserProjectLead === 'function' ? isUserProjectLead(currentActiveProjectOrderId, activeUser) : true) || canAssignLead) : canAssignLead;
  if (!isLead) {
    showToast('⚠️ Hanya Lead Project yang ditugaskan atau Administrator yang berwenang mendaftarkan dan mengubah tim pelaksana project.', 'warning');
    return;
  }

  // Extract Team Members (beserta email dari akun pengguna)
  const team = [];
  document.querySelectorAll('#pm-team-list .pm-team-row').forEach(r => {
    const sel = r.querySelector('.pm-member-name');
    const name = sel?.value?.trim();
    const role = r.querySelector('.pm-member-role')?.value?.trim() || 'Team Member';
    const phone = r.querySelector('.pm-member-phone')?.value?.trim() || '';
    const optEmail = sel?.options?.[sel.selectedIndex]?.getAttribute('data-email') || r.getAttribute('data-member-email') || '';
    const email = resolveAccountEmailByName(name, optEmail);
    if (name) {
      team.push({ name, role, phone, email });
    }
  });

  const leadSelectEl = document.getElementById('pm-lead-name');
  const leadName = canAssignLead
    ? (leadSelectEl?.value?.trim() || existingProject?.projectLead || 'Belum diassign')
    : (existingProject?.projectLead || 'Belum diassign');
  const leadOptEmail = leadSelectEl?.options?.[leadSelectEl.selectedIndex]?.getAttribute('data-email') || existingProject?.leadEmail || '';
  const leadEmail = resolveAccountEmailByName(leadName, leadOptEmail);
  const department = document.getElementById('pm-department')?.value?.trim() || 'Engineering';

  const payload = {
    ...(existingProject || {}),
    orderId: existingProject?.orderId || (order ? order.id : ''),
    quotationId: existingProject?.quotationId || order?.quotationId || '',
    quotationType: order ? (isServiceOrder(order) ? 'jasa' : 'produk') : (existingProject?.quotationType || 'produk'),
    projectName: existingProject?.projectName || order?.projectName || (order ? `${order?.items?.[0]?.itemName || 'Project'} (${order?.customerName || 'Customer'})` : 'Project Mandiri'),
    customerName: existingProject?.customerName || order?.customerName || 'Internal UBM',
    customerPhone: order?.customerPhone || existingProject?.customerPhone || '',
    customerAddress: order?.customerAddress || existingProject?.customerAddress || '',
    orderDate: order?.orderDate || existingProject?.orderDate || existingProject?.startDate || '',
    startDate: existingProject?.startDate || order?.orderDate || new Date().toISOString().split('T')[0],
    dueDate: order?.dueDate || existingProject?.dueDate || '',
    notes: (order && order.notes !== undefined) ? order.notes : (existingProject?.notes || ''),
    items: (Array.isArray(order?.items) && order.items.length > 0) ? order.items : (existingProject?.items || []),
    additionalServices: (Array.isArray(order?.additionalServices) && order.additionalServices.length > 0) ? order.additionalServices : (existingProject?.additionalServices || []),
    poFileName: order?.poFileName || existingProject?.poFileName || '',
    poDocument: order?.poDocument || existingProject?.poDocument || null,
    projectLead: leadName,
    leadEmail: leadEmail,
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
window.saveTeamAssignmentData = saveTeamAssignmentData;

// -------------------------------------------------------------
// 2. TIMELINE & MILESTONE WORKSPACE (Buka saat klik tombol Project Management)
// -------------------------------------------------------------
function navigateBackFromTimeline() {
  const target = state.timelineReturnView || state.previousMainView || (state.previousView !== 'timeline' ? state.previousView : null) || 'orders';
  navigateTo(target);
}

function openProjectTimelinePage(orderId = null) {
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Administrator';

  let productProjects = (state.projects || []).filter(p => !isProjectService(p));
  let productOrders = (state.orders || []).filter(o => !isServiceOrder(o));

  // Role Member: hanya bisa mengakses timeline project yang di-assign padanya
  if (roleName === 'Member') {
    productProjects = productProjects.filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : true);
    productOrders = productOrders.filter(o => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(o.id, activeUser) : true);
  }

  const defaultTarget = orderId || (productProjects.length > 0 ? (productProjects[0].id || productProjects[0].orderId) : (productOrders.length > 0 ? productOrders[0].id : null));
  const targetOrderId = orderId || defaultTarget;

  if (roleName === 'Member' && targetOrderId) {
    const isAssigned = typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(targetOrderId, activeUser) : false;
    if (!isAssigned) {
      showToast('⚠️ Anda tidak terdaftar sebagai Project Lead atau anggota tim pada project ini.', 'warning');
      return;
    }
  }

  if (roleName === 'Member' && !targetOrderId) {
    showToast('⚠️ Belum ada project atau order yang ditugaskan ke Anda.', 'info');
    navigateTo('projects');
    return;
  }

  // Tentukan view asal pemanggil Timeline
  if (state.currentView === 'projects') {
    state.timelineReturnView = 'projects';
  } else if (state.currentView === 'orders') {
    state.timelineReturnView = 'orders';
  } else if (!state.timelineReturnView) {
    state.timelineReturnView = (state.previousMainView === 'projects' || state.previousView === 'projects') ? 'projects' : 'orders';
  }

  const project = (state.projects || []).find(p => p.id === targetOrderId || p.orderId === targetOrderId);
  const order = (state.orders || []).find(o => o.id === (project?.orderId || targetOrderId));

  // Jika order/project adalah Jasa, tolak karena jasa tidak masuk ke Project Management Manufaktur
  if (isServiceOrder(order) || isProjectService(project)) {
    showToast('⚠️ Kategori Jasa tidak masuk ke Project Management Manufaktur. Silakan gunakan menu Pengajuan Transportasi & Uang Makan Jasa.', 'info');
    if (typeof openServiceExpenseModal === 'function') {
      openServiceExpenseModal(order?.id || targetOrderId);
    }
    return;
  }

  // Validasi khusus jika project terkait langsung dengan Order Penjualan nyata
  if (order && project?.orderId) {
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

  timelineCalendarSelectedYear = null;
  timelineCalendarSelectedMonth = null;
  currentActiveProjectOrderId = project ? (project.id || project.orderId) : targetOrderId;

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
    let opts = '';
    let directProjs = (state.projects || []).filter(p => !p.orderId && !isProjectService(p));
    let validProductOrders = (productOrders || []);

    if (roleName === 'Member') {
      directProjs = directProjs.filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : true);
      validProductOrders = validProductOrders.filter(o => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(o.id, activeUser) : true);
    }

    if (directProjs.length > 0) {
      opts += '<optgroup label="Project Mandiri / Direct">';
      directProjs.forEach(dp => {
        const isSel = (dp.id === currentActiveProjectOrderId) ? 'selected' : '';
        opts += `<option value="${dp.id}" ${isSel}>[${dp.id}] ${escapeHtml(dp.projectName)} (${escapeHtml(dp.customerName || 'Mandiri')})</option>`;
      });
      opts += '</optgroup>';
    }

    if (validProductOrders.length > 0) {
      opts += '<optgroup label="Order Penjualan Produk (Manufaktur)">';
      validProductOrders.forEach(o => {
        const isSel = (o.id === currentActiveProjectOrderId || (project && project.orderId === o.id)) ? 'selected' : '';
        opts += `<option value="${o.id}" ${isSel}>[${o.id}] ${escapeHtml(o.customerName)} - ${escapeHtml(o.projectName || o.items?.[0]?.itemName || 'Order')} (${formatRupiah(o.grandTotal)})</option>`;
      });
      opts += '</optgroup>';
    }

    if (!opts) {
      opts = '<option value="">-- Tidak ada project yang ditugaskan ke Anda --</option>';
    }
    orderSelect.innerHTML = opts;
  }

  renderTimelineWorkspace(currentActiveProjectOrderId);
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

  const project = (state.projects || []).find(p => p.id === orderId || p.orderId === orderId);
  const order = state.orders.find(o => o.id === (project?.orderId || orderId));

  let activeProj = project;
  if (!activeProj) {
    if (order) {
      const firstItem = order?.items?.[0]?.itemName || 'Produk Pesanan';
      const projName = order?.projectName || `${firstItem} (${order?.customerName || 'Customer'})`;
      activeProj = {
        orderId: order.id,
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
    } else {
      activeProj = {
        id: orderId,
        projectName: 'Project Mandiri',
        customerName: 'Internal UBM',
        projectLead: '',
        department: 'Engineering',
        status: 'Planning',
        progressPercent: 0,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        team: [],
        milestones: [],
        notes: ''
      };
    }
  }

  currentActiveProjectOrderId = activeProj.id || activeProj.orderId || orderId;

  // Header & Controls
  const headerOrderId = document.getElementById('timeline-header-order-id');
  if (headerOrderId) {
    const code = activeProj.orderId ? activeProj.orderId : (activeProj.id || 'DIRECT');
    headerOrderId.textContent = `${activeProj.projectName || 'Project'} (${activeProj.customerName || '-'}) [${code}]`;
  }

  const statusSelect = document.getElementById('timeline-status-select');
  if (statusSelect) statusSelect.value = activeProj.status || 'Planning';

  const startInput = document.getElementById('timeline-start-date');
  if (startInput) startInput.value = activeProj.startDate || order?.orderDate || '';

  const dueInput = document.getElementById('timeline-due-date');
  if (dueInput) dueInput.value = activeProj.dueDate || order?.dueDate || '';

  const notesInput = document.getElementById('timeline-notes');
  if (notesInput) {
    const rawNotes = (activeProj && activeProj.notes !== undefined && activeProj.notes !== '')
      ? activeProj.notes
      : (order?.notes || '');
    notesInput.value = typeof cleanDisplayNotes === 'function'
      ? cleanDisplayNotes(rawNotes)
      : (rawNotes || '').replace(/<!--[\s\S]*?-->/g, '').trim();
  }

  currentActiveProjectData = activeProj;

  // Wewenang: Hanya Lead Project atau Administrator yang dapat mengubah timeline & menambah milestone
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(orderId, activeUser) : true;

  const saveBtn = document.querySelector('#view-timeline button[onclick*="saveProjectTimelineData"]');
  const addMsBtn = document.querySelector('#view-timeline button[onclick*="addNewMilestoneInteractive"]');
  if (saveBtn) {
    saveBtn.style.display = isLead ? 'inline-flex' : 'none';
  }
  if (addMsBtn) {
    addMsBtn.style.display = isLead ? 'inline-flex' : 'none';
  }

  // Cek apakah BOM proyek ini sudah disetujui (Accepted / Approved)
  const linkedBom = (state.bom || []).find(b => 
    b.projectId === activeProj.id || 
    b.orderId === (activeProj.orderId || activeProj.id) ||
    (activeProj.bomId && b.id === activeProj.bomId) ||
    (b.projectName && activeProj.projectName && b.projectName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim()) ||
    (b.productName && activeProj.projectName && b.productName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim())
  );

  const isBomApproved = linkedBom && (linkedBom.status === 'Accepted' || linkedBom.status === 'Approved' || linkedBom.status === 'Disetujui');

  const addCompBtn = document.getElementById('btn-timeline-add-component');
  if (addCompBtn) {
    if (isBomApproved) {
      addCompBtn.style.display = 'inline-flex';
    } else {
      addCompBtn.style.display = 'none';
    }
  }

  if (statusSelect) statusSelect.disabled = !isLead;
  if (startInput) startInput.disabled = !isLead;
  if (dueInput) dueInput.disabled = !isLead;
  if (notesInput) notesInput.disabled = !isLead;

  // Render Visual Calendar Blocks with different color themes & Month Calendar
  renderMilestoneCalendarBlocks(project);
  renderTimelineMonthCalendar(project);
  renderTimelineBOMComponentInfo(activeProj, linkedBom, isBomApproved);
  syncTimelineMilestonesHiddenList(project);
  switchTimelineTabMode('blocks');

  calculateTimelineProgress();
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// KALENDER BLOK WARNA & DETAIL MODAL MILESTONE (SUBTASK, LAPORAN, LINK)
// -------------------------------------------------------------
let currentActiveProjectData = null;
let currentTimelineTabMode = 'blocks';

function switchTimelineTabMode(mode) {
  currentTimelineTabMode = mode;
  const blocksContainer = document.getElementById('timeline-calendar-blocks');
  const monthContainer = document.getElementById('timeline-month-calendar');
  const btnBlocks = document.getElementById('tab-timeline-view-blocks');
  const btnCalendar = document.getElementById('tab-timeline-view-calendar');

  if (mode === 'calendar') {
    if (blocksContainer) blocksContainer.style.display = 'none';
    if (monthContainer) monthContainer.style.display = 'block';
    if (btnBlocks) {
      btnBlocks.style.background = 'transparent';
      btnBlocks.style.color = '#64748b';
      btnBlocks.style.boxShadow = 'none';
      btnBlocks.style.fontWeight = '600';
    }
    if (btnCalendar) {
      btnCalendar.style.background = '#ffffff';
      btnCalendar.style.color = '#4f46e5';
      btnCalendar.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
      btnCalendar.style.fontWeight = '700';
    }
  } else {
    // Default: 'blocks'
    if (blocksContainer) blocksContainer.style.display = 'flex';
    if (monthContainer) monthContainer.style.display = 'none';
    if (btnBlocks) {
      btnBlocks.style.background = '#ffffff';
      btnBlocks.style.color = '#4f46e5';
      btnBlocks.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
      btnBlocks.style.fontWeight = '700';
    }
    if (btnCalendar) {
      btnCalendar.style.background = 'transparent';
      btnCalendar.style.color = '#64748b';
      btnCalendar.style.boxShadow = 'none';
      btnCalendar.style.fontWeight = '600';
    }
  }
  if (window.lucide) lucide.createIcons();
}
window.switchTimelineTabMode = switchTimelineTabMode;

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

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(project?.id || project?.orderId, activeUser) : true;

  let milestones = project?.milestones || [];

  // Member hanya melihat task yang diberikan oleh lead project padanya
  if (!isLead && activeUser?.name) {
    const uName = activeUser.name.toLowerCase().trim();
    const uEmail = (activeUser.email || '').toLowerCase().trim();
    milestones = milestones.filter(ms => {
      const isPic = (ms.pic || '').toLowerCase().trim() === uName || (ms.pic || '').toLowerCase().trim() === uEmail;
      const isSubtaskPic = Array.isArray(ms.subtasks) && ms.subtasks.some(st => {
        const stPic = (st.pic || st.assignedTo || '').toLowerCase().trim();
        return stPic === uName || stPic === uEmail;
      });
      return isPic || isSubtaskPic;
    });
  }

  // Update badge jumlah tahapan pada switcher tab
  const badgeCount = document.getElementById('timeline-blocks-count-badge');
  if (badgeCount) badgeCount.textContent = milestones.length;

  if (milestones.length === 0) {
    if (!isLead) {
      container.innerHTML = `
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 18px; text-align: center; color: #64748b;">
          <i data-lucide="check-circle-2" style="width: 22px; height: 22px; margin-bottom: 4px; color: #94a3b8;"></i>
          <div style="font-weight: 700; font-size: 12.5px; color: #334155;">Belum Ada Task yang Ditugaskan Kepada Anda</div>
          <div style="font-size: 11px; margin-top: 2px; color: #64748b;">Anda hanya dapat melihat task/tahapan yang ditugaskan secara resmi oleh Project Lead.</div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 16px; text-align: center; color: #64748b;">
          <i data-lucide="calendar" style="width: 22px; height: 22px; margin-bottom: 4px; color: #94a3b8;"></i>
          <div style="font-weight: 600; font-size: 12.5px;">Belum ada tahapan kerja atau milestone terdaftar.</div>
          <div style="font-size: 11px; margin-top: 2px;">Klik tombol <strong>"+ Tambah Milestone"</strong> di atas untuk membuat tahapan kerja baru.</div>
        </div>
      `;
    }
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
    const addComps = ms.additionalComponents || [];

    const isCompleted = ms.status === 'Completed';
    const isInProgress = ms.status === 'In Progress';
    const statusBg = isCompleted ? '#10b981' : isInProgress ? '#f59e0b' : '#64748b';
    const statusText = isCompleted ? 'Selesai' : isInProgress ? 'Berjalan' : 'Rencana';

    return `
      <div class="milestone-compact-row" id="block-${msId}" onclick="openMilestoneDetailModal('${msId}')"
           style="background: #ffffff; border: 1px solid ${theme.border}; border-left: 5px solid ${theme.primary}; border-radius: 6px; padding: 8px 12px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.03); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;"
           onmouseover="this.style.background='${theme.lightBg}'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.06)';"
           onmouseout="this.style.background='#ffffff'; this.style.boxShadow='0 1px 2px rgba(0,0,0,0.03)';">
        
        <!-- LEFT: TAHAP BADGE + TITLE + STATUS -->
        <div style="display: flex; align-items: center; gap: 8px; min-width: 200px; flex: 1 1 auto;">
          <span style="background: ${theme.gradient}; color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.3px; flex-shrink: 0;">
            T${idx + 1}
          </span>
          <span style="font-weight: 700; font-size: 12.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;" title="${escapeAttr(ms.title || 'Tahapan Kerja')}">
            ${escapeHtml(ms.title || 'Tahapan Kerja')}
          </span>
          <span style="background: ${statusBg}; color: #ffffff; font-size: 9.5px; font-weight: 700; padding: 1.5px 7px; border-radius: 999px; flex-shrink: 0;">
            ${statusText}
          </span>
        </div>

        <!-- CENTER: DATE + PIC + SUBTASKS + BADGES -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <!-- Dates -->
          <span style="font-size: 11px; color: #475569; display: inline-flex; align-items: center; gap: 3px;" title="Periode Pelaksanaan">
            <i data-lucide="calendar" style="width: 12px; height: 12px; color: ${theme.primary};"></i>
            ${ms.startDate || '-'} &rarr; ${ms.dueDate || '-'}
          </span>

          <!-- PIC -->
          <span style="font-size: 11px; color: #334155; display: inline-flex; align-items: center; gap: 3px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="PIC: ${escapeAttr(ms.pic || 'Belum ada PIC')}">
            <i data-lucide="user" style="width: 12px; height: 12px; color: ${theme.primary};"></i>
            <strong>${escapeHtml(ms.pic || '-')}</strong>
          </span>

          <!-- Subtask Count -->
          <span class="badge" style="background: ${totalSubtasks > 0 && completedSubtasks === totalSubtasks ? '#dcfce7' : '#f1f5f9'}; color: ${totalSubtasks > 0 && completedSubtasks === totalSubtasks ? '#15803d' : '#334155'}; font-size: 10px; padding: 2px 5px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;" title="Subtask Selesai: ${completedSubtasks}/${totalSubtasks}">
            <i data-lucide="check-square" style="width: 11px; height: 11px; color: ${theme.primary};"></i>
            ${completedSubtasks}/${totalSubtasks}
          </span>

          <!-- Quick Indicators (Link, Photos, Comments, Additional Components) -->
          <div style="display: flex; align-items: center; gap: 5px;">
            ${hasLink ? `
              <span title="Buka Link CAD / Dokumen" onclick="event.stopPropagation(); window.open('${escapeAttr(ms.report.reportUrl)}', '_blank');" style="color: #0284c7; cursor: pointer; display: inline-flex; align-items: center;">
                <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
              </span>
            ` : ''}

            ${images.length > 0 ? `
              <span title="${images.length} Foto Hasil Kerja" style="color: #9333ea; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">
                <i data-lucide="image" style="width: 11px; height: 11px;"></i>${images.length}
              </span>
            ` : ''}

            ${comments.length > 0 ? `
              <span title="${comments.length} Catatan Diskusi" style="color: #0f766e; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">
                <i data-lucide="message-square" style="width: 11px; height: 11px;"></i>${comments.length}
              </span>
            ` : ''}

            ${addComps.length > 0 ? `
              <span title="${addComps.length} Komponen Tambahan Tahap Ini" style="color: #059669; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 2px;">
                <i data-lucide="boxes" style="width: 11px; height: 11px;"></i>+${addComps.length}
              </span>
            ` : ''}
          </div>
        </div>

        <!-- RIGHT: MINI PROGRESS BAR & ARROW -->
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <div style="width: 50px; height: 5px; background: #e2e8f0; border-radius: 999px; overflow: hidden;" title="Progres Subtask: ${subtaskPercent}%">
            <div style="width: ${subtaskPercent}%; height: 100%; background: ${theme.primary}; border-radius: 999px; transition: width 0.3s ease;"></div>
          </div>
          <span style="font-size: 10.5px; font-weight: 700; color: #475569; min-width: 28px; text-align: right; font-family: monospace;">
            ${subtaskPercent}%
          </span>
          <i data-lucide="chevron-right" style="width: 14px; height: 14px; color: #94a3b8;"></i>
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
    cellsHtml += '<div style="min-height: 40px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 4px; opacity: 0.5;"></div>';
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
      <div style="min-height: 42px; background: #ffffff; border: 1px solid ${hasEvents ? '#cbd5e1' : '#e2e8f0'}; border-radius: 4px; padding: 2px 4px; display: flex; flex-direction: column; gap: 2px; overflow: hidden;">
        <div style="font-size: 10px; font-weight: 700; color: ${hasEvents ? '#0f172a' : '#64748b'}; text-align: right; line-height: 1;">
          ${d}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 28px;">
          ${activeMilestones.map(({ ms, idx, theme }) => `
            <div onclick="event.stopPropagation(); openMilestoneDetailModal('${ms.id}')"
                 style="background: ${theme.gradient}; color: #ffffff; font-size: 8.5px; font-weight: 700; padding: 1px 4px; border-radius: 2px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;"
                 title="Tahap ${idx + 1}: ${escapeAttr(ms.title)} (${ms.startDate} s/d ${ms.dueDate})">
              T${idx + 1}: ${escapeHtml(ms.title)}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <!-- Month & Year Controls -->
        <div style="display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 6px;">
          <button type="button" class="btn btn-xs btn-outline" style="padding: 1px 5px; font-size: 10px; height: 22px; display: inline-flex; align-items: center;" onclick="changeTimelineMonth(-1)" title="Bulan Sebelumnya">
            <i data-lucide="chevron-left" style="width: 12px; height: 12px;"></i>
          </button>
          
          <select id="timeline-month-select" class="form-control form-control-sm" style="font-weight: 700; font-size: 11px; height: 22px; padding: 0 4px; width: auto; color: #4f46e5; border-color: #c7d2fe; background: #ffffff;" onchange="handleTimelineMonthSelectChange()">
            ${monthOptionsHtml}
          </select>
          
          <select id="timeline-year-select" class="form-control form-control-sm" style="font-weight: 700; font-size: 11px; height: 22px; padding: 0 4px; width: auto; color: #4f46e5; border-color: #c7d2fe; background: #ffffff;" onchange="handleTimelineMonthSelectChange()">
            ${yearOptionsHtml}
          </select>

          <button type="button" class="btn btn-xs btn-outline" style="padding: 1px 5px; font-size: 10px; height: 22px; display: inline-flex; align-items: center;" onclick="changeTimelineMonth(1)" title="Bulan Berikutnya">
            <i data-lucide="chevron-right" style="width: 12px; height: 12px;"></i>
          </button>

          <button type="button" class="btn btn-xs btn-ghost" style="padding: 1px 6px; font-size: 10.5px; height: 22px; font-weight: 600; color: #4f46e5; display: inline-flex; align-items: center; gap: 3px;" onclick="resetTimelineMonthToProject()" title="Kembali ke Bulan Project">
            <i data-lucide="rotate-ccw" style="width: 11px; height: 11px;"></i> Bulan Project
          </button>
        </div>
      </div>

      <div style="font-size: 10.5px; color: var(--text-muted);">
        <span>💡 Klik tiket warna pada tanggal untuk detail</span>
      </div>
    </div>

    <!-- Day Header -->
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; margin-bottom: 4px;">
      ${dayHeaders.map(dh => `<div style="font-weight: 700; font-size: 10.5px; color: #64748b; padding: 2px;">${dh}</div>`).join('')}
    </div>

    <!-- Month Grid -->
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
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

// Helper to get all team member options (Hanya Leader dan Member pada project tersebut)
function getProjectPICOfficialOptions(project, selectedPic = '') {
  const options = [];
  const addedNames = new Set();

  let targetProj = project;
  if (!targetProj && typeof currentActiveProjectData !== 'undefined' && currentActiveProjectData) {
    targetProj = currentActiveProjectData;
  }
  if (!targetProj && typeof currentActiveProjectOrderId !== 'undefined' && currentActiveProjectOrderId && typeof state !== 'undefined') {
    targetProj = (state.projects || []).find(p => p.id === currentActiveProjectOrderId || p.orderId === currentActiveProjectOrderId);
  }

  // 1. Project Lead pada project ini
  if (targetProj?.projectLead && targetProj.projectLead !== 'Belum diassign' && targetProj.projectLead.trim() !== '') {
    const leadName = targetProj.projectLead.trim();
    options.push({
      name: leadName,
      role: 'Project Lead',
      label: `${leadName} (Project Lead)`
    });
    addedNames.add(leadName.toLowerCase());
  }

  // 2. Anggota Tim Pelaksana pada project ini
  if (targetProj?.team && Array.isArray(targetProj.team)) {
    targetProj.team.forEach(m => {
      const memberName = typeof m === 'string' ? m.trim() : (m?.name ? m.name.trim() : '');
      const memberRole = typeof m === 'object' && m?.role ? m.role.trim() : 'Anggota Tim';
      if (memberName && !addedNames.has(memberName.toLowerCase())) {
        options.push({
          name: memberName,
          role: memberRole,
          label: `${memberName} (${memberRole || 'Member'})`
        });
        addedNames.add(memberName.toLowerCase());
      }
    });
  }

  // 3. Fallback jika ada PIC tersimpan pada milestone yang belum ada di daftar tim project
  if (selectedPic && selectedPic.trim() !== '' && !addedNames.has(selectedPic.toLowerCase())) {
    options.push({
      name: selectedPic.trim(),
      role: 'PIC Khusus',
      label: selectedPic.trim()
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

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(currentActiveProjectData?.id || currentActiveProjectOrderId, activeUser) : true;

  const targetProj = currentActiveProjectData || (state.projects || []).find(p => p.id === currentActiveProjectOrderId || p.orderId === currentActiveProjectOrderId);
  const picList = getProjectPICOfficialOptions(targetProj, ms.pic);
  let picOptionsHtml = picList.length > 0
    ? '<option value="">-- Pilih Penanggung Jawab (Leader / Anggota Project) --</option>'
    : '<option value="">-- Belum ada Leader / Tim pada project ini --</option>';
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
            <input type="text" id="modal-ms-title" class="form-control form-control-sm" required value="${escapeAttr(ms.title || '')}" style="font-weight: 700; ${isLead ? '' : 'background: #f1f5f9; cursor: not-allowed;'}" ${isLead ? '' : 'disabled'}>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label font-bold" style="font-size: 11px;">Tanggal Mulai</label>
            <input type="date" id="modal-ms-start" class="form-control form-control-sm" value="${ms.startDate || ''}" style="${isLead ? '' : 'background: #f1f5f9; cursor: not-allowed;'}" ${isLead ? '' : 'disabled'}>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label font-bold" style="font-size: 11px;">Deadline Selesai</label>
            <input type="date" id="modal-ms-due" class="form-control form-control-sm" value="${ms.dueDate || ''}" style="${isLead ? '' : 'background: #f1f5f9; cursor: not-allowed;'}" ${isLead ? '' : 'disabled'}>
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
          <select id="modal-ms-pic" class="form-control form-control-sm" style="font-weight: 600; background: ${isLead ? '#ffffff' : '#f1f5f9'}; cursor: ${isLead ? 'pointer' : 'not-allowed'};" ${isLead ? '' : 'disabled'}>
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

      <!-- 4. KOMPONEN & MATERIAL TAMBAHAN UNTUK TAHAP INI -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
          <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="boxes" style="width: 15px; height: 15px; color: #059669;"></i>
            Komponen & Material Tambahan untuk Tahap Ini
          </div>
          <button type="button" class="btn btn-xs btn-outline" style="color: #059669; border-color: #a7f3d0; background: #ecfdf5; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" onclick="closeModal('milestone-detail-modal'); openAddProjectComponentModal('${escapeAttr(ms.title || ms.name)}')">
            <i data-lucide="plus"></i> + Tambah Komponen Tahap Ini
          </button>
        </div>
        ${Array.isArray(ms.additionalComponents) && ms.additionalComponents.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${ms.additionalComponents.map(ac => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
                <div>
                  <strong>${escapeHtml(ac.componentName || ac.itemName)}</strong> &bull; <span class="font-mono font-bold text-primary">${ac.qty} ${ac.unit || 'Pcs'}</span>
                  ${ac.notes ? `<span class="text-muted font-xs"> (${escapeHtml(ac.notes)})</span>` : ''}
                </div>
                <div class="font-mono text-success font-bold" style="font-size: 11.5px;">
                  ${typeof formatRupiah === 'function' ? formatRupiah(ac.subtotal || (ac.qty * (ac.unitCost || 0))) : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="font-size: 11.5px; color: #64748b; font-style: italic;">
            Belum ada komponen tambahan yang dialokasikan khusus pada tahapan ini. Klik tombol di atas untuk menambah komponen.
          </div>
        `}
      </div>

      <!-- 5. FOOTER ACTIONS -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--border-color);">
        ${isLead ? `
          <button type="button" class="btn btn-sm btn-danger-ghost" onclick="deleteCurrentMilestoneModal('${msId}')" style="color: #ef4444;">
            <i data-lucide="trash-2"></i> Hapus Tahapan Ini
          </button>
        ` : '<div></div>'}
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeModal('milestone-detail-modal')">Tutup</button>
          <button type="submit" class="btn btn-primary btn-sm" style="background: ${theme.primary}; border-color: ${theme.primary}; font-weight: 700; padding: 6px 20px;">
            <i data-lucide="save"></i> ${isLead ? 'Simpan Perubahan Milestone' : 'Simpan Progres Task'}
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

async function deleteCurrentMilestoneModal(msId) {
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(currentActiveProjectData?.id || currentActiveProjectOrderId, activeUser) : true;
  if (!isLead) {
    showToast('⚠️ Hanya Lead Project yang ditugaskan atau Administrator yang berwenang menghapus tahapan kerja.', 'warning');
    return;
  }
  if (!confirm('Apakah Anda yakin ingin menghapus tahapan milestone ini?')) return;
  if (!currentActiveProjectData) return;

  currentActiveProjectData.milestones = (currentActiveProjectData.milestones || []).filter(m => m.id !== msId);
  closeModal('milestone-detail-modal');
  renderMilestoneCalendarBlocks(currentActiveProjectData);
  renderTimelineMonthCalendar(currentActiveProjectData);
  syncTimelineMilestonesHiddenList(currentActiveProjectData);
  calculateTimelineProgress();
  await saveProjectTimelineData(false);
  showToast('Tahapan milestone berhasil dihapus & disimpan ke Supabase', 'info');
}

function saveMilestoneDetailModal(msId) {
  if (!currentActiveProjectData) return;
  const ms = (currentActiveProjectData.milestones || []).find(m => m.id === msId);
  if (!ms) return;

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(currentActiveProjectData?.id || currentActiveProjectOrderId, activeUser) : true;

  if (isLead) {
    ms.title = document.getElementById('modal-ms-title')?.value?.trim() || ms.title;
    ms.startDate = document.getElementById('modal-ms-start')?.value || '';
    ms.dueDate = document.getElementById('modal-ms-due')?.value || '';
    ms.pic = document.getElementById('modal-ms-pic')?.value?.trim() || '';
  }
  ms.status = document.getElementById('modal-ms-status')?.value || 'Pending';

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
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(currentActiveProjectData?.id || currentActiveProjectOrderId, activeUser) : true;
  if (!isLead) {
    showToast('⚠️ Hanya Lead Project yang ditugaskan atau Administrator yang berwenang menambahkan tahapan milestone baru.', 'warning');
    return;
  }
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
              const project = currentActiveProjectData || (state.projects || []).find(p => p.id === currentActiveProjectOrderId || p.orderId === currentActiveProjectOrderId);
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
        <div style="display: grid; grid-template-columns: 200px 1fr auto; gap: 8px; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px;">
          <select id="ms-comment-author-${msId}" class="form-control form-control-sm" style="font-size: 11.5px; font-weight: 600;">
            ${(typeof getUserDropdownOptions === 'function') 
                ? getUserDropdownOptions(ms?.pic || (typeof getAuthUser === 'function' ? getAuthUser()?.name : ''), '-- Pilih Akun Penulis --') 
                : `<option value="${escapeAttr(ms?.pic || '')}">${escapeHtml(ms?.pic || 'Pengguna')}</option>`}
          </select>
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
    showToast('Pilih order atau project terlebih dahulu', 'warning');
    return;
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(currentActiveProjectOrderId, activeUser) : true;
  if (!isLead && redirect) {
    showToast('⚠️ Hanya Lead Project yang ditugaskan atau Administrator yang berwenang mengubah timeline & milestone project.', 'warning');
    return;
  }

  const existingProject = (state.projects || []).find(p => p.id === currentActiveProjectOrderId || p.orderId === currentActiveProjectOrderId);
  const order = state.orders.find(o => o.id === (existingProject?.orderId || currentActiveProjectOrderId));

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
  const rawNotesInput = document.getElementById('timeline-notes')?.value || '';
  const cleanInputNotes = (typeof cleanDisplayNotes === 'function')
    ? cleanDisplayNotes(rawNotesInput)
    : (rawNotesInput || '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const progressPercent = calculateTimelineProgress();

  const existingPoDoc = existingProject?.poDocument || order?.poDocument || (typeof extractPOFromNotes === 'function' ? (extractPOFromNotes(existingProject?.notes) || extractPOFromNotes(existingProject?._rawNotes) || extractPOFromNotes(order?.notes) || extractPOFromNotes(order?._rawNotes)) : null);
  const poFileUrl = existingProject?.poFileUrl || order?.poFileUrl || (existingPoDoc?.url || '');
  const poFileName = existingProject?.poFileName || order?.poFileName || (existingPoDoc?.name || '');

  let finalNotes = cleanInputNotes;
  if (existingPoDoc && typeof embedPOInNotes === 'function') {
    finalNotes = embedPOInNotes(cleanInputNotes, existingPoDoc);
  }

  const payload = {
    ...(existingProject || {}),
    orderId: existingProject?.orderId || (order ? order.id : ''),
    projectName: existingProject?.projectName || (order ? `${order?.items?.[0]?.itemName || 'Project'} (${order?.customerName || 'Customer'})` : 'Project Mandiri'),
    customerName: existingProject?.customerName || order?.customerName || 'Internal UBM',
    status: status,
    startDate: startDate,
    dueDate: dueDate,
    notes: finalNotes,
    poDocument: existingPoDoc || undefined,
    poFileName: poFileName || undefined,
    poFileUrl: poFileUrl || undefined,
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
      const notesEl = document.getElementById('timeline-notes');
      if (notesEl) notesEl.value = cleanInputNotes;
      await fetchResource('projects');
      renderOrdersTable();
      renderProjectsTableView();
      updateSidebarBadges();
      loadDashboardData();
      if (redirect) {
        const returnTarget = (state.timelineReturnView === 'projects') ? 'projects' : 'orders';
        navigateTo(returnTarget);
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
// 3. SURAT TUGAS PENUGASAN TIM & PIC (EXPORT PDF / PRINT & KIRIM VIA EMAIL OTOMATIS)
// -------------------------------------------------------------
let activeAssignmentPdfBlob = null;
let activeAssignmentPdfFile = null;
let activeAssignmentPdfUrl = '';
let activeAssignmentEmailData = null;

function resolveAccountEmailByName(nameOrEmail, fallbackEmail = '') {
  const raw = String(nameOrEmail || '').trim();
  if (!raw || raw === 'Belum diassign') return fallbackEmail || '';
  if (raw.includes('@')) return raw.toLowerCase();

  const norm = raw.toLowerCase();
  const users = (typeof state !== 'undefined' && Array.isArray(state.users)) ? state.users : [];
  const matched = users.find(u => {
    if (!u) return false;
    const uName = String(u.name || '').trim().toLowerCase();
    const uEmail = String(u.email || '').trim().toLowerCase();
    return uName === norm || uEmail === norm || (uName && (uName.includes(norm) || norm.includes(uName)));
  });

  if (matched && matched.email) {
    return String(matched.email).trim().toLowerCase();
  }
  return fallbackEmail ? String(fallbackEmail).trim().toLowerCase() : '';
}

function getAdminAccountEmail() {
  // Prioritaskan email akun Administrator yang terdaftar di Pengaturan Profil (state.users / Supabase)
  const users = (typeof state !== 'undefined' && Array.isArray(state.users)) ? state.users : [];
  const adminUser = users.find(u => {
    const r = typeof getNormalizedRole === 'function' ? getNormalizedRole(u) : String(u?.role || '');
    return r === 'Administrator' && u?.email && u.status !== 'Non-Aktif';
  });
  if (adminUser && adminUser.email) {
    return String(adminUser.email).trim().toLowerCase();
  }
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : '';
  if (roleName === 'Administrator' && activeUser?.email && activeUser.email.toLowerCase() !== 'admin@ubm.co.id') {
    return String(activeUser.email).trim().toLowerCase();
  }
  return 'unitbisnis@takumi.ac.id';
}

function getTeamAssignmentLetterData(orderId = null) {
  const targetOrderId = orderId || currentActiveProjectOrderId || (state.orders && state.orders.length > 0 ? state.orders[0].id : null);
  const project = (state.projects || []).find(p => p.id === targetOrderId || p.orderId === targetOrderId);
  const order = (state.orders || []).find(o => o.id === (project?.orderId || targetOrderId) || o.id === targetOrderId);

  if (order && typeof ensureOrderApprovalData === 'function') {
    ensureOrderApprovalData(order);
  }

  const isKetuaApproved = Boolean(order?.approvalKetuaUbm);
  const isWadirApproved = Boolean(order?.approvalWadir1);
  const isDualApproved = Boolean(isKetuaApproved && isWadirApproved);

  const isModalOpen = document.getElementById('team-assignment-modal')?.classList.contains('active') &&
    (!orderId || orderId === currentActiveProjectOrderId);

  const leadSelectEl = document.getElementById('pm-lead-name');
  const leadName = (isModalOpen ? leadSelectEl?.value?.trim() : '') || project?.projectLead || 'Belum diassign';
  const leadOptEmail = (isModalOpen ? leadSelectEl?.options?.[leadSelectEl.selectedIndex]?.getAttribute('data-email') : '') || project?.leadEmail || '';
  const leadEmail = resolveAccountEmailByName(leadName, leadOptEmail);

  const department = (isModalOpen ? document.getElementById('pm-department')?.value?.trim() : '') || project?.department || 'Engineering & Assembly';

  // Collect team members
  let team = [];
  const domRows = isModalOpen ? document.querySelectorAll('#pm-team-list .pm-team-row') : [];
  if (domRows.length > 0) {
    domRows.forEach(r => {
      const sel = r.querySelector('.pm-member-name');
      const name = sel?.value?.trim();
      const role = r.querySelector('.pm-member-role')?.value?.trim() || 'Pelaksana Teknis';
      const phone = r.querySelector('.pm-member-phone')?.value?.trim() || '-';
      const optEmail = sel?.options?.[sel.selectedIndex]?.getAttribute('data-email') || r.getAttribute('data-member-email') || '';
      const email = resolveAccountEmailByName(name, optEmail);
      if (name) team.push({ name, role, phone, email });
    });
  } else if (project?.team && project.team.length > 0) {
    team = project.team.map(m => {
      const mName = typeof m === 'string' ? m : (m.name || '');
      const mEmail = resolveAccountEmailByName(mName, m.email || '');
      return {
        name: mName,
        role: m.role || 'Pelaksana Teknis',
        phone: m.phone || '-',
        email: mEmail
      };
    });
  }

  const firstItem = order?.items?.[0]?.itemName || project?.items?.[0]?.itemName || '';
  const rawProjectName = order?.projectName || project?.projectName || firstItem || 'Project Engineering';
  // Bersihkan nama project jika terdapat embel-embel "(Customer)" agar nama project tetap rapi
  const cleanProjectName = rawProjectName;

  const refCode = order?.id || project?.orderId || project?.id || targetOrderId || 'PRJ-001';
  const orderNumCode = refCode.replace(/[^0-9]/g, '') || '001';
  const currentYear = new Date().getFullYear();
  const letterNumber = `ST/UBM-ENG/${currentYear}/${orderNumCode}`;
  const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const adminEmail = getAdminAccountEmail();
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const adminName = activeUser?.name || 'Administrator UBM';

  const recipientList = [];
  if (leadEmail && leadEmail.includes('@')) {
    recipientList.push({ name: leadName, role: 'Project Lead', email: leadEmail });
  }
  team.forEach(m => {
    if (m.email && m.email.includes('@') && !recipientList.some(r => r.email === m.email)) {
      recipientList.push({ name: m.name, role: m.role || 'Member', email: m.email });
    }
  });

  const emailSubject = `Surat Tugas Project "${cleanProjectName}"`;
  const emailMessage = `Surat Tugas Project "${cleanProjectName}"`;
  const safeFileSlug = cleanProjectName.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Project';
  const pdfFilename = `Surat_Tugas_Project_${safeFileSlug}.pdf`;

  // Ekstraksi lengkap semua input dari form Order Penjualan / Edit Order Penjualan
  const customerName = order?.customerName || project?.customerName || 'Internal UBM';
  const customerPhone = order?.customerPhone || project?.customerPhone || '';
  const customerAddress = order?.customerAddress || project?.customerAddress || '';
  const orderDate = order?.orderDate || project?.orderDate || project?.startDate || '';
  const dueDate = order?.dueDate || project?.dueDate || project?.endDate || 'Sesuai Timeline Milestone';
  const orderType = order?.orderType || project?.orderType || (isServiceOrder(order) ? 'jasa' : 'produk');
  const quotationId = order?.quotationId || project?.quotationId || '';
  const poFileName = order?.poFileName || order?.poDocument?.name || project?.poFileName || project?.poDocument?.name || '';
  const poDocument = order?.poDocument || project?.poDocument || null;

  const items = (Array.isArray(order?.items) && order.items.length > 0)
    ? order.items
    : (Array.isArray(project?.items) && project.items.length > 0 ? project.items : []);

  const additionalServices = (Array.isArray(order?.additionalServices) && order.additionalServices.length > 0)
    ? order.additionalServices
    : (Array.isArray(project?.additionalServices) && project.additionalServices.length > 0 ? project.additionalServices : []);

  const rawNotes = (order && order.notes !== undefined) ? order.notes : (project?.notes || '');
  const cleanNotes = (typeof cleanDisplayNotes === 'function')
    ? cleanDisplayNotes(rawNotes)
    : (rawNotes || '').replace(/<!--UBM_[\s\S]*?-->/g, '').trim();

  function formatLetterDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  return {
    targetOrderId: refCode,
    projectId: project?.id || null,
    orderId: order?.id || project?.orderId || null,
    order,
    project,
    projectName: cleanProjectName,
    customerName,
    customerPhone,
    customerAddress,
    orderDate,
    orderDateFormatted: formatLetterDate(orderDate),
    dueDate,
    dueDateFormatted: formatLetterDate(dueDate),
    orderType,
    quotationId,
    poFileName,
    poDocument,
    items,
    additionalServices,
    notes: rawNotes,
    cleanNotes,
    leadName,
    leadEmail,
    department,
    team,
    letterNumber,
    todayFormatted,
    adminEmail,
    adminName,
    isKetuaApproved,
    isWadirApproved,
    isDualApproved,
    recipientList,
    recipientEmails: recipientList.map(r => r.email),
    emailSubject,
    emailMessage,
    pdfFilename
  };
}

function updateTeamAssignmentEmailPreview() {
  const box = document.getElementById('pm-admin-email-info-box');
  if (!box) return;

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isAdmin = (typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : '') === 'Administrator';
  if (!isAdmin) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  const data = getTeamAssignmentLetterData(currentActiveProjectOrderId);

  const leadBadge = data.leadName && data.leadName !== 'Belum diassign'
    ? `<span class="badge" style="background: #ffffff; color: #065f46; border: 1px solid #6ee7b7; font-size: 10.5px; padding: 2px 7px;">👑 Lead: <strong>${escapeHtml(data.leadName)}</strong> (${escapeHtml(data.leadEmail || 'email belum terdaftar')})</span>`
    : `<span class="badge badge-amber" style="font-size: 10px;">Lead Project belum dipilih</span>`;

  const memberBadges = data.team.length > 0
    ? data.team.map(m => `<span class="badge" style="background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; font-size: 10.5px; padding: 2px 7px;">👤 ${escapeHtml(m.name)} (${escapeHtml(m.email || 'email belum terdaftar')})</span>`).join(' ')
    : `<span class="text-muted" style="font-size: 10.5px;">Belum ada member dipilih</span>`;

  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 240px;">
        <div style="font-weight: 700; font-size: 12px; color: #047857; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <i data-lucide="mail-check" style="width: 15px; height: 15px;"></i> Pengiriman Otomatis Surat Tugas Project via Email (Khusus Administrator)
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #065f46; font-weight: 600;">Pengirim (Admin):</span>
          <strong class="font-mono" style="color: #0f172a;">${escapeHtml(data.adminEmail)}</strong>
        </div>
        <div style="margin-bottom: 6px;">
          <span style="color: #065f46; font-weight: 600;">Pesan & Lampiran PDF:</span>
          <strong style="color: #0f172a;">${escapeHtml(data.emailMessage)}</strong>
          <span class="font-mono" style="font-size: 10.5px; color: #047857;">(${escapeHtml(data.pdfFilename)})</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 5px; align-items: center;">
          <span style="color: #065f46; font-weight: 600;">Penerima Otomatis:</span>
          ${leadBadge}
          ${memberBadges}
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}
window.updateTeamAssignmentEmailPreview = updateTeamAssignmentEmailPreview;

function buildTeamAssignmentLetterHtml(data) {
  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'Unit Bisnis Mandiri (UBM) Politeknik Takumi',
    companyShortName: 'UBM Politeknik Takumi',
    institutionName: 'Yayasan Takumi Bina Karya',
    parentInstitution: 'Politeknik Takumi',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Kab. Bekasi, Jawa Barat 17530',
    website: 'takumi.ac.id',
    email: 'ubm@takumi.ac.id',
    phone: '(021) 8990-1234',
    city: 'Cikarang',
    leaderName: 'Rizaldi Putra, M.Kom.',
    leaderNip: '2049770671130373',
    leaderRole: 'Ketua Unit Bisnis Mandiri (UBM)',
    wadir1Name: 'Agung Kaswadi, M.T.',
    wadir1Nip: '9857752653130142',
    wadir1Role: 'Wakil Direktur I Politeknik Takumi',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  const leaderDisplayName = compSettings.leaderName || 'Rizaldi Putra, M.Kom.';
  const wadir1DisplayName = compSettings.wadir1Name || 'Agung Kaswadi, M.T.';
  const leaderCleanName = leaderDisplayName.replace(/\.+$/, '');
  const wadir1CleanName = wadir1DisplayName.replace(/\.+$/, '');

  // Base URL cerdas (bebas dari ketergantungan IP LAN statis)
  const baseUrl = (typeof getVerificationBaseUrl === 'function')
    ? getVerificationBaseUrl()
    : (window.location.origin || 'http://localhost:3000');

  // URL verifikasi resmi yang saat di-scan oleh smartphone menampilkan gambar resmi
  // "Approved by [Nama Pejabat]" beserta icon checklist terverifikasi digital resmi dan bisa diakses semua orang
  const leaderVerifyUrl = (typeof getSignatureVerificationUrl === 'function')
    ? getSignatureVerificationUrl(leaderCleanName, compSettings.leaderRole || 'Ketua Unit Bisnis Mandiri (UBM)', data.letterNumber || '', data.projectName || 'Surat Tugas Pelaksanaan Proyek')
    : `${baseUrl}/verify-approval?name=${encodeURIComponent(leaderCleanName)}&role=${encodeURIComponent(compSettings.leaderRole || 'Ketua Unit Bisnis Mandiri (UBM)')}&doc=${encodeURIComponent(data.letterNumber || '')}&title=${encodeURIComponent(data.projectName || 'Surat Tugas Pelaksanaan Proyek')}`;

  const wadir1VerifyUrl = (typeof getSignatureVerificationUrl === 'function')
    ? getSignatureVerificationUrl(wadir1CleanName, compSettings.wadir1Role || 'Wakil Direktur I Politeknik Takumi', data.letterNumber || '', data.projectName || 'Surat Tugas Pelaksanaan Proyek')
    : `${baseUrl}/verify-approval?name=${encodeURIComponent(wadir1CleanName)}&role=${encodeURIComponent(compSettings.wadir1Role || 'Wakil Direktur I Politeknik Takumi')}&doc=${encodeURIComponent(data.letterNumber || '')}&title=${encodeURIComponent(data.projectName || 'Surat Tugas Pelaksanaan Proyek')}`;

  const order = data.order || (state.orders || []).find(o => o.id === data.targetOrderId || o.id === data.orderId || o.id === data.project?.orderId);
  if (order && typeof ensureOrderApprovalData === 'function') {
    ensureOrderApprovalData(order);
  }

  const isKetuaApproved = Boolean(order?.approvalKetuaUbm || data.isKetuaApproved);
  const isWadirApproved = Boolean(order?.approvalWadir1 || data.isWadirApproved);
  const isDualApproved = Boolean((isKetuaApproved && isWadirApproved) || data.isDualApproved);

  let ketuaSigHtml = '';
  if (isDualApproved || isKetuaApproved) {
    const qrSvg = (typeof generateQRCodeSvg === 'function')
      ? generateQRCodeSvg(leaderVerifyUrl, 2.3, 1)
      : `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(leaderVerifyUrl)}" style="width: 68px; height: 68px; display: block; margin: 0 auto;" alt="QR Code" />`;

    ketuaSigHtml = `
      <div style="min-height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 12px auto; text-align: center;">
        <a href="${leaderVerifyUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;" title="Klik untuk membuka verifikasi tanda tangan: Approved by ${escapeAttr(leaderCleanName)}">
          <div style="width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; padding: 2px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; margin: 0 auto;">
            ${qrSvg}
          </div>
          <div style="font-size: 8px; color: #047857; font-weight: 700; margin-top: 5px; letter-spacing: 0.2px; text-align: center;">
            ✓ TERVERIFIKASI DIGITAL
          </div>
        </a>
      </div>
    `;
  } else {
    ketuaSigHtml = `
      <div style="height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-style: italic; color: #64748b; font-size: 11px; margin: 12px auto; text-align: center;">
        <div style="border-bottom: 1px dashed #cbd5e1; width: 140px; margin-bottom: 6px;"></div>
        <span>(Tanda Tangan & Cap UBM)</span>
        <span style="font-size: 9px; color: #b45309; margin-top: 2px;">(Menunggu Persetujuan Ketua UBM)</span>
      </div>
    `;
  }

  let wadirSigHtml = '';
  if (isDualApproved || isWadirApproved) {
    const qrSvg = (typeof generateQRCodeSvg === 'function')
      ? generateQRCodeSvg(wadir1VerifyUrl, 2.3, 1)
      : `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(wadir1VerifyUrl)}" style="width: 68px; height: 68px; display: block; margin: 0 auto;" alt="QR Code" />`;

    wadirSigHtml = `
      <div style="min-height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 12px auto; text-align: center;">
        <a href="${wadir1VerifyUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;" title="Klik untuk membuka verifikasi tanda tangan: Approved by ${escapeAttr(wadir1CleanName)}">
          <div style="width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; padding: 2px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; margin: 0 auto;">
            ${qrSvg}
          </div>
          <div style="font-size: 8px; color: #047857; font-weight: 700; margin-top: 5px; letter-spacing: 0.2px; text-align: center;">
            ✓ TERVERIFIKASI DIGITAL
          </div>
        </a>
      </div>
    `;
  } else {
    wadirSigHtml = `
      <div style="height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-style: italic; color: #64748b; font-size: 11px; margin: 12px auto; text-align: center;">
        <div style="border-bottom: 1px dashed #cbd5e1; width: 140px; margin-bottom: 6px;"></div>
        <span>(Tanda Tangan & Cap)</span>
        <span style="font-size: 9px; color: #b45309; margin-top: 2px;">(Menunggu Persetujuan Wadir I)</span>
      </div>
    `;
  }

  const teamRowsHtml = data.team.length > 0
    ? data.team.map((m, idx) => `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${escapeHtml(m.name)}</td>
          <td style="border: 1px solid #000; padding: 6px;">${escapeHtml(m.role || 'Teknisi Pelaksana')}</td>
          <td style="border: 1px solid #000; padding: 6px;">${escapeHtml(m.email || '-')}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${escapeHtml(m.phone || '-')}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="5" style="border: 1px solid #000; padding: 8px; text-align: center; color: #64748b;">Belum ada anggota tim tambahan yang didaftarkan</td>
        </tr>
      `;

  // Item pesanan / ruang lingkup pekerjaan
  const itemRowsHtml = (data.items && data.items.length > 0)
    ? data.items.map((it, idx) => `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${escapeHtml(it.itemName || '-')}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${escapeHtml(it.sku || '-')}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: 600;">${it.qty || 1} ${escapeHtml(it.unit || (data.orderType === 'jasa' ? 'Lot' : 'Unit'))}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="4" style="border: 1px solid #000; padding: 8px; text-align: center; color: #64748b;">${escapeHtml(data.projectName)}</td>
        </tr>
      `;

  const servicesHtml = (data.additionalServices && data.additionalServices.length > 0)
    ? `
      <div style="font-size: 11.5px; font-weight: bold; margin: 8px 0 4px 0; color: #1e3a8a;">
        Layanan / Jasa & Instalasi Pendukung:
      </div>
      <table class="doc-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; font-family: 'Times New Roman', Times, serif;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 36px;">No.</th>
            <th style="border: 1px solid #000; padding: 5px; text-align: left;">Deskripsi Jasa / Layanan Instalasi</th>
            <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 120px;">Volume / Satuan</th>
          </tr>
        </thead>
        <tbody>
          ${data.additionalServices.map((svc, idx) => `
            <tr>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
              <td style="border: 1px solid #000; padding: 5px;">${escapeHtml(svc.serviceName || '-')}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${svc.qty || 1} ${escapeHtml(svc.unit || 'Lot')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '';

  // Ketentuan Penugasan diambil dari input Catatan Khusus & Syarat Pengerjaan pada order penjualan
  const customNotesLines = (data.cleanNotes || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let ketentuanItemsHtml = '';
  if (customNotesLines.length > 0) {
    const parsedNotesItems = customNotesLines.map(line => {
      // Hilangkan penomoran manual jika user mengetik "1. ", "- ", atau "* " agar penomoran <ol> tetap rapi
      const cleanLine = line.replace(/^([0-9]+[\.\)]|[a-zA-Z][\.\)]|[-*•])\s*/, '').trim();
      return `<li style="margin-bottom: 5px;">${escapeHtml(cleanLine || line)}</li>`;
    }).join('');

    ketentuanItemsHtml = `
      <ol style="margin: 6px 0 0 18px; padding: 0; line-height: 1.6;">
        ${parsedNotesItems}
      </ol>
    `;
  } else {
    ketentuanItemsHtml = `
      <div style="font-size: 12px; color: #000000; padding-left: 2px; margin-top: 4px;">-</div>
    `;
  }

  return `
    <div class="doc-preview" style="font-family: 'Times New Roman', Times, serif; color: #000000; line-height: 1.5; padding: 10px 15px; background: #ffffff;">
      
      <!-- KOP SURAT RESMI UBM -->
      <div style="text-align: center; border-bottom: 3px double #000000; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="font-size: 17px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #1e3a8a;">${escapeHtml(compSettings.companyName)}</div>
        ${compSettings.tagline ? `<div style="font-size: 11.5px; font-style: italic; color: #334155; margin-top: 2px;">${escapeHtml(compSettings.tagline)}</div>` : ''}
        <div style="font-size: 11px; margin-top: 4px;">${escapeHtml(compSettings.address)}</div>
        <div style="font-size: 11px;">Website: ${escapeHtml(compSettings.website)} | Email: ${escapeHtml(compSettings.email)} | Telp: ${escapeHtml(compSettings.phone)}</div>
      </div>

      <!-- JUDUL SURAT TUGAS -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 16px; font-weight: bold; text-decoration: underline; text-transform: uppercase;">SURAT TUGAS PELAKSANAAN PROYEK</div>
        <div style="font-size: 12px; margin-top: 2px;">Nomor: <strong>${escapeHtml(data.letterNumber)}</strong></div>
      </div>

      <!-- PREAMBULE -->
      <div style="font-size: 12.5px; text-align: justify; margin-bottom: 14px;">
        Yang bertanda tangan di bawah ini, Pimpinan <strong>${escapeHtml(compSettings.companyName)}</strong> bersama dengan <strong>${escapeHtml(compSettings.wadir1Role)}</strong>, dengan ini memberikan penugasan resmi kepada personil yang tercantum dalam surat ini untuk memimpin dan melaksanakan seluruh tahapan pengerjaan proyek sesuai dengan rincian dan ketentuan berikut:
      </div>

      <!-- DETAIL REFERENSI PROYEK & PEMESAN -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
        <tr>
          <td style="width: 220px; padding: 3px 0; font-weight: bold;">Nama Proyek / Pekerjaan</td>
          <td style="width: 15px; padding: 3px 0;">:</td>
          <td style="padding: 3px 0; font-weight: bold; color: #0f172a;">${escapeHtml(data.projectName)}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">No. Referensi Order / Project</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;"><strong>${escapeHtml(data.targetOrderId)}</strong> ${data.quotationId ? `<span style="font-size: 11px; color: #475569;">(Ref. Quotation #${escapeHtml(data.quotationId)})</span>` : ''}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">Pelanggan / Perusahaan</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;">${escapeHtml(data.customerName)}</td>
        </tr>
        ${data.customerPhone ? `
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">No. Telepon / WhatsApp Klien</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;">${escapeHtml(data.customerPhone)}</td>
        </tr>` : ''}
        ${data.customerAddress ? `
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">Alamat Pengiriman / Lokasi</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;">${escapeHtml(data.customerAddress)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">Jenis Pengerjaan</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;">${data.orderType === 'jasa' ? '🛠️ Jasa & Layanan Teknis (Non-BOM)' : '📦 Produk Manufaktur & Fabrikasi (BOM)'}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">Divisi / Departemen Pelaksana</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;">${escapeHtml(data.department)}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">Tanggal Order / Target Selesai</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;">${escapeHtml(data.orderDateFormatted)} s/d <strong>${escapeHtml(data.dueDateFormatted)}</strong></td>
        </tr>
        ${data.poFileName ? `
        <tr>
          <td style="padding: 3px 0; font-weight: bold;">Dokumen PO Referensi</td>
          <td style="padding: 3px 0;">:</td>
          <td style="padding: 3px 0;">📄 ${escapeHtml(data.poFileName)}</td>
        </tr>` : ''}
      </table>

      <!-- I. RUANG LINGKUP PEKERJAAN & DAFTAR ITEM PESANAN -->
      <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px;">
        I. RUANG LINGKUP PEKERJAAN & DAFTAR ITEM
      </div>
      <table class="doc-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; font-family: 'Times New Roman', Times, serif;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 36px;">No.</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Nama Item / Spesifikasi Pekerjaan</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 130px;">Kode / SKU</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 110px;">Volume / Qty</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>
      ${servicesHtml}

      <!-- II. PENANGGUNG JAWAB UTAMA (PROJECT LEAD) -->
      <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px;">
        II. PENANGGUNG JAWAB UTAMA (PROJECT LEAD)
      </div>
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 14px; margin-bottom: 14px; font-size: 12.5px;">
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong>Nama Project Lead:</strong> <span style="font-size: 13.5px; font-weight: bold; color: #1e3a8a;">${escapeHtml(data.leadName)}</span>
            ${data.leadEmail ? `<div style="font-size: 11.5px; color: #334155;">Email: <strong>${escapeHtml(data.leadEmail)}</strong></div>` : ''}
          </div>
          <div>
            <strong>Jabatan / Peran:</strong> Lead Project Engineer & Penanggung Jawab Mutu
          </div>
        </div>
      </div>

      <!-- III. DAFTAR ANGGOTA TIM PELAKSANA PROYEK -->
      <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px;">
        III. DAFTAR ANGGOTA TIM PELAKSANA PROYEK
      </div>
      <table class="doc-table" style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; font-family: 'Times New Roman', Times, serif;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 36px;">No.</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Nama Anggota Tim</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Peran / Tugas Khusus</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Email Terdaftar</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 120px;">Kontak / No. HP</th>
          </tr>
        </thead>
        <tbody>
          ${teamRowsHtml}
        </tbody>
      </table>

      <!-- IV. KETENTUAN PENUGASAN (DARI CATATAN KHUSUS & SYARAT PENGERJAAN) -->
      <div style="font-size: 12px; text-align: justify; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px;">
          IV. KETENTUAN PENUGASAN & SYARAT PENGERJAAN
        </div>
        ${ketentuanItemsHtml}
      </div>

      <!-- TANDA TANGAN RESMI (KETUA UBM & WAKIL DIREKTUR I) -->
      <div style="margin-top: 26px; page-break-inside: avoid; font-size: 12px;">
        <div style="text-align: right; margin-bottom: 16px; font-weight: 500;">${escapeHtml(compSettings.city || 'Bekasi')}, ${escapeHtml(data.todayFormatted)}</div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
          
          <!-- 1. KETUA UBM (SEBELAH KIRI) -->
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">Yang Menugaskan,</div>
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px; min-height: 18px;">${escapeHtml(compSettings.leaderRole)}</div>
            ${ketuaSigHtml}
            <div style="font-weight: bold; text-decoration: underline; font-size: 12.5px; margin-top: 6px;">${escapeHtml(leaderDisplayName)}</div>
            <div style="font-size: 11px; margin-top: 2px;">NIP/NIK. ${escapeHtml(compSettings.leaderNip || '-')}</div>
          </div>

          <!-- 2. WAKIL DIREKTUR I (SEBELAH KANAN) -->
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">Mengetahui & Mengesahkan,</div>
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px; min-height: 18px;">${escapeHtml(compSettings.wadir1Role)}</div>
            ${wadirSigHtml}
            <div style="font-weight: bold; text-decoration: underline; font-size: 12.5px; margin-top: 6px;">${escapeHtml(wadir1DisplayName)}</div>
            <div style="font-size: 11px; margin-top: 2px;">NIP/NIK. ${escapeHtml(compSettings.wadir1Nip || '-')}</div>
          </div>

        </div>
      </div>

      <!-- FOOTER DOKUMEN -->
      <div style="margin-top: 24px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
        <span>${escapeHtml(compSettings.copyrightText)}</span>
        <span>Dokumen Resmi Sistem Manajemen ${escapeHtml(compSettings.companyShortName || 'UBM')}</span>
      </div>

    </div>
  `;
}

function exportTeamAssignmentLetterPDF(orderId = null) {
  const data = getTeamAssignmentLetterData(orderId);
  if (!data.targetOrderId) {
    showToast('Pilih order penjualan atau project terlebih dahulu', 'warning');
    return;
  }

  closeModal('team-assignment-modal');

  const content = document.getElementById('preview-modal-content') || document.getElementById('preview-modal-body');
  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i data-lucide="file-check-2" style="color: #4f46e5;"></i> Surat Tugas Project "${escapeHtml(data.projectName)}"`;
  }

  if (content) {
    const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
    const isAdmin = (typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : '') === 'Administrator';

    const adminActionTopBar = isAdmin ? `
      <div class="no-print" style="margin-bottom: 14px; padding: 10px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="font-size: 12px; color: #065f46;">
          <strong>Pesan Email:</strong> "${escapeHtml(data.emailMessage)}" &bull; <strong>Dari:</strong> ${escapeHtml(data.adminEmail)} &rarr; <strong>Ke:</strong> ${escapeHtml(data.recipientEmails.join(', ') || 'Lead & Tim')}
        </div>
        <button type="button" class="btn btn-sm btn-primary" style="background: #059669; border-color: #059669; color: #ffffff; font-weight: 700;" onclick="closeModal('preview-modal'); sendTeamAssignmentEmail('${escapeAttr(data.orderId || data.projectId || data.targetOrderId)}')">
          <i data-lucide="send"></i> Kirim via Email ke Lead & Tim
        </button>
      </div>
    ` : '';

    content.innerHTML = adminActionTopBar + buildTeamAssignmentLetterHtml(data);
  }

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}
window.exportTeamAssignmentLetterPDF = exportTeamAssignmentLetterPDF;

async function sendTeamAssignmentEmail(orderId = null) {
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : '';
  if (roleName !== 'Administrator') {
    showToast('⚠️ Akses Ditolak: Hanya role Administrator yang dapat mengirim Surat Tugas via Email!', 'error');
    return;
  }

  // Pastikan daftar akun pengguna (state.users) sudah dimuat agar email Lead & Member terdeteksi akurat
  if (!state.users || state.users.length === 0) {
    try {
      await fetchResource('users');
    } catch (e) {}
  }

  const data = getTeamAssignmentLetterData(orderId);
  if (!data.leadName || data.leadName === 'Belum diassign') {
    showToast('⚠️ Pilih Project Lead terlebih dahulu sebelum mengirim Surat Tugas via Email!', 'warning');
    return;
  }

  if (data.recipientEmails.length === 0) {
    showToast('⚠️ Alamat email Project Lead / Member belum ditemukan pada data Akun Pengguna!', 'warning');
    return;
  }

  // Jika modal Penugasan Tim sedang terbuka, simpan data penugasan tim terlebih dahulu secara otomatis ke database
  const isTeamModalOpen = document.getElementById('team-assignment-modal')?.classList.contains('active');
  if (isTeamModalOpen) {
    try {
      const existingProject = (state.projects || []).find(p => p.id === currentActiveProjectOrderId || p.orderId === currentActiveProjectOrderId);
      const order = state.orders.find(o => o.id === (existingProject?.orderId || currentActiveProjectOrderId));
      const payload = {
        ...(existingProject || {}),
        orderId: existingProject?.orderId || (order ? order.id : ''),
        quotationId: existingProject?.quotationId || order?.quotationId || '',
        quotationType: order ? (isServiceOrder(order) ? 'jasa' : 'produk') : (existingProject?.quotationType || 'produk'),
        projectName: existingProject?.projectName || order?.projectName || data.projectName,
        customerName: existingProject?.customerName || order?.customerName || data.customerName,
        projectLead: data.leadName,
        leadEmail: data.leadEmail,
        department: data.department,
        team: data.team,
        isLeadLocked: true
      };
      if (existingProject && existingProject.id) {
        await fetch(`/api/projects/${existingProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      await fetchResource('projects');
      closeModal('team-assignment-modal');
    } catch (saveErr) {
      console.warn('Auto-save before email failed:', saveErr);
    }
  }

  // Buka modal proses pembuatan & pengiriman PDF via Email
  const shareModal = document.getElementById('wa-share-modal');
  const modalHeaderTitle = shareModal?.querySelector('.modal-header h3');
  const modalHeader = shareModal?.querySelector('.modal-header');
  const modalBody = document.getElementById('wa-share-modal-body');

  if (modalHeader) {
    modalHeader.style.background = '#ecfdf5';
    modalHeader.style.borderBottom = '1px solid #a7f3d0';
  }
  if (modalHeaderTitle) {
    modalHeaderTitle.style.color = '#065f46';
    modalHeaderTitle.innerHTML = `<i data-lucide="mail" style="color: #059669;"></i> Kirim Surat Tugas Project via Email (PDF)`;
  }

  if (modalBody) {
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 28px 16px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; background: #d1fae5; color: #059669; margin-bottom: 12px;">
          <i data-lucide="loader" style="width: 26px; height: 26px;"></i>
        </div>
        <h4 style="font-size: 15.5px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">Menyiapkan PDF & Mengirim Email Otomatis...</h4>
        <p style="font-size: 12.5px; color: #64748b; margin: 0;">
          Membuat berkas <strong>${escapeHtml(data.pdfFilename)}</strong> dengan pesan:<br>
          <strong style="color: #059669;">${escapeHtml(data.emailMessage)}</strong>
        </p>
      </div>
    `;
    openModal('wa-share-modal');
    if (window.lucide) lucide.createIcons();
  }

  try {
    // 1. Render HTML Surat Tugas ke container tersembunyi untuk konversi PDF
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '790px';
    container.style.padding = '20px 24px';
    container.style.background = '#ffffff';
    container.style.boxSizing = 'border-box';
    container.innerHTML = buildTeamAssignmentLetterHtml(data);
    document.body.appendChild(container);

    let pdfBlob = null;
    let pdfBase64 = '';
    let pdfFileUrl = '';

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: data.pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = html2pdf().set(opt).from(container);
      pdfBlob = await worker.output('blob');
      pdfBase64 = await worker.output('datauristring');
    }

    container.remove();

    // 2. Susun isi pesan email resmi (Surat Tugas Project "(Nama project)")
    const defaultPdfLink = `${window.location.origin}/uploads/projects/${data.pdfFilename}`;
    const emailBodyText = [
      `Surat Tugas Project "${data.projectName}"`,
      ``,
      `Yth. Project Lead (${data.leadName}) dan Tim Pelaksana Proyek,`,
      ``,
      `Berikut kami kirimkan dokumen resmi Surat Tugas Project "${data.projectName}" (${data.pdfFilename}) yang telah terlampir pada email ini.`,
      ``,
      `Detail Penugasan:`,
      `- Nama Project : ${data.projectName}`,
      `- No. Referensi : ${data.targetOrderId}`,
      `- Project Lead : ${data.leadName} (${data.leadEmail || '-'})`,
      `- Anggota Tim  : ${data.team.map(m => `${m.name} (${m.role || 'Member'})`).join(', ') || '-'}`,
      ``,
      `Hormat kami,`,
      `${data.adminName}`,
      `Administrator (${data.adminEmail})`
    ].join('\n');

    // 3. Kirim ke endpoint backend /api/projects/send-assignment-email
    // Backend akan menyimpan PDF dan otomatis membuka aplikasi Mail dengan file PDF langsung ter-attach!
    let smtpSent = false;
    let desktopMailOpened = false;
    try {
      const res = await fetch('/api/projects/send-assignment-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: data.projectId,
          orderId: data.orderId || data.targetOrderId,
          projectName: data.projectName,
          senderEmail: data.adminEmail,
          senderName: data.adminName,
          senderRole: roleName,
          leadName: data.leadName,
          leadEmail: data.leadEmail,
          team: data.team,
          recipients: data.recipientEmails,
          subject: data.emailSubject,
          message: data.emailMessage,
          emailBodyText,
          pdfBase64,
          filename: data.pdfFilename
        })
      });
      if (res.ok) {
        const resJson = await res.json();
        pdfFileUrl = resJson.fileUrl || '';
        smtpSent = Boolean(resJson.smtpSent);
        desktopMailOpened = Boolean(resJson.desktopMailOpened);
        if (resJson.senderEmail) {
          data.adminEmail = resJson.senderEmail;
        }
      }
    } catch (apiErr) {
      console.warn('Gagal menghubungi endpoint send-assignment-email:', apiErr);
    }

    // 4. Siapkan objek File PDF di memori & unduh salinan PDF ke perangkat Administrator
    if (pdfBlob) {
      activeAssignmentPdfBlob = pdfBlob;
      activeAssignmentPdfFile = new File([pdfBlob], data.pdfFilename, { type: 'application/pdf' });
      activeAssignmentPdfUrl = (pdfFileUrl && !pdfFileUrl.startsWith('data:'))
        ? `${window.location.origin}${pdfFileUrl}`
        : defaultPdfLink;

      const downloadUrl = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = data.pdfFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }, 1200);
    }

    activeAssignmentEmailData = {
      ...data,
      fullPdfLink: activeAssignmentPdfUrl || defaultPdfLink,
      smtpSent,
      desktopMailOpened,
      emailBodyText
    };

    // Jika aplikasi email belum terbuka dari sisi server dan belum terkirim via SMTP, jalankan fallback pembuka email
    if (!smtpSent && !desktopMailOpened) {
      await triggerAssignmentMailtoClient();
    }

    if (modalBody) {
      const recipientsRowsHtml = data.recipientList.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px;">
          <div>
            <strong>${escapeHtml(r.name)}</strong>
            <span class="badge ${r.role === 'Project Lead' ? 'badge-purple' : 'badge-secondary'}" style="font-size: 10px; margin-left: 6px;">${escapeHtml(r.role)}</span>
          </div>
          <span class="font-mono" style="color: #059669; font-weight: 600;">${escapeHtml(r.email)}</span>
        </div>
      `).join('');

      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background: #dcfce7; color: #16a34a; margin-bottom: 8px;">
            <i data-lucide="check-circle" style="width: 28px; height: 28px;"></i>
          </div>
          <h4 style="font-size: 16px; font-weight: 700; margin: 0; color: #0f172a;">
            ${smtpSent
              ? 'Email & PDF Surat Tugas Berhasil Dikirim Otomatis!'
              : desktopMailOpened
                ? 'Aplikasi Email Dibuka Otomatis dengan File PDF Terlampir!'
                : 'PDF Surat Tugas Siap & Email Otomatis Dibuka!'}
          </h4>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0;">
            Pesan: <strong style="color: #059669;">${escapeHtml(data.emailMessage)}</strong>
          </p>
        </div>

        <!-- Ringkasan Pengirim, Penerima & File PDF -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #cbd5e1;">
            <span class="text-muted font-bold">Email Pengirim (Administrator):</span>
            <strong class="font-mono" style="color: #0f172a;">${escapeHtml(data.adminEmail)}</strong>
          </div>
          <div style="margin-bottom: 8px;">
            <div class="text-muted font-bold" style="margin-bottom: 6px;">Penerima Email (Project Lead & Member - ${data.recipientList.length} Akun):</div>
            <div style="display: flex; flex-direction: column; gap: 5px; max-height: 130px; overflow-y: auto;">
              ${recipientsRowsHtml}
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 800; border: 1px solid #86efac;">📎 PDF TERLAMPIR</span>
              <strong style="color: #0f172a;">${escapeHtml(data.pdfFilename)}</strong>
            </div>
            <button type="button" class="btn btn-xs btn-outline" onclick="downloadCurrentAssignmentPdf()">
              <i data-lucide="download"></i> Unduh PDF
            </button>
          </div>
        </div>

        <!-- Tombol Kirim Email -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn btn-primary" style="background: #059669; border-color: #059669; padding: 11px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="triggerAssignmentMailtoClient()">
            <i data-lucide="paperclip"></i> Buka Aplikasi Email (Otomatis Attach File PDF)
          </button>
          <button type="button" class="btn btn-outline" style="padding: 10px; font-size: 12.5px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="triggerAssignmentGmailCompose()">
            <i data-lucide="mail"></i> Buka Gmail Web (${escapeHtml(data.adminEmail)})
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }

    showToast(`Surat Tugas Project "${data.projectName}" siap dikirim ke ${data.recipientEmails.length} email Lead & Member!`, 'success');
    await fetchResource('projects');
    renderProjectsTableView();
    renderOrdersTable();
  } catch (err) {
    console.error('Error sending team assignment email:', err);
    showToast('Gagal memproses pengiriman email Surat Tugas Project', 'error');
  }
}
window.sendTeamAssignmentEmail = sendTeamAssignmentEmail;

function downloadCurrentAssignmentPdf() {
  if (!activeAssignmentPdfBlob || !activeAssignmentEmailData) {
    showToast('Berkas PDF belum tersedia', 'warning');
    return;
  }
  const downloadUrl = window.URL.createObjectURL(activeAssignmentPdfBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = activeAssignmentEmailData.pdfFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }, 1000);
}
window.downloadCurrentAssignmentPdf = downloadCurrentAssignmentPdf;

async function triggerAssignmentMailtoClient() {
  if (!activeAssignmentEmailData) return;

  // 1. Coba buka aplikasi email desktop (Mail.app) dengan file PDF langsung ter-attach melalui backend
  try {
    const res = await fetch('/api/projects/open-mail-with-attachment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: activeAssignmentEmailData.pdfFilename,
        senderEmail: activeAssignmentEmailData.adminEmail || 'unitbisnis@takumi.ac.id',
        recipients: activeAssignmentEmailData.recipientEmails || [],
        subject: activeAssignmentEmailData.emailSubject,
        bodyText: activeAssignmentEmailData.emailBodyText || activeAssignmentEmailData.emailMessage
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.desktopMailOpened) {
        showToast(`Aplikasi Email dibuka otomatis dengan lampiran ${activeAssignmentEmailData.pdfFilename}!`, 'success');
        return;
      }
    }
  } catch (e) {}

  // 2. Jika browser mendukung Web Share API dengan File PDF (misal Safari macOS / iOS)
  if (activeAssignmentPdfFile && navigator.canShare && navigator.canShare({ files: [activeAssignmentPdfFile] })) {
    try {
      await navigator.share({
        title: activeAssignmentEmailData.emailSubject,
        text: activeAssignmentEmailData.emailBodyText || activeAssignmentEmailData.emailMessage,
        files: [activeAssignmentPdfFile]
      });
      return;
    } catch (shareErr) {}
  }

  // 3. Fallback ke mailto URI standar
  const toList = (activeAssignmentEmailData.recipientEmails || []).join(',');
  const subject = encodeURIComponent(activeAssignmentEmailData.emailSubject);
  const body = encodeURIComponent(activeAssignmentEmailData.emailBodyText || activeAssignmentEmailData.emailMessage);
  const mailtoUrl = `mailto:${toList}?subject=${subject}&body=${body}`;
  window.location.href = mailtoUrl;
}
window.triggerAssignmentMailtoClient = triggerAssignmentMailtoClient;

function triggerAssignmentGmailCompose() {
  if (!activeAssignmentEmailData) return;
  const toList = encodeURIComponent((activeAssignmentEmailData.recipientEmails || []).join(','));
  const subject = encodeURIComponent(activeAssignmentEmailData.emailSubject);
  const body = encodeURIComponent(activeAssignmentEmailData.emailBodyText || activeAssignmentEmailData.emailMessage);
  const authUserEmail = encodeURIComponent(activeAssignmentEmailData.adminEmail || 'unitbisnis@takumi.ac.id');
  const gmailUrl = `https://mail.google.com/mail/?authuser=${authUserEmail}&view=cm&fs=1&to=${toList}&su=${subject}&body=${body}`;
  window.open(gmailUrl, '_blank');
}
window.triggerAssignmentGmailCompose = triggerAssignmentGmailCompose;

// =========================================================================
// PENAMBAHAN KOMPONEN TAMBAHAN KE BOM DARI TIMELINE & MILESTONE PROJECT
// (Aktif Saat BOM Berstatus Disetujui / Accepted)
// =========================================================================

function renderTimelineBOMComponentInfo(project, linkedBom, isBomApproved) {
  const container = document.getElementById('timeline-bom-component-info');
  if (!container) return;

  if (!isBomApproved || !linkedBom) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  const components = linkedBom.components || [];
  const totalCost = linkedBom.materialCost || components.reduce((sum, c) => sum + ((parseFloat(c.qty) || 0) * (parseFloat(c.unitCost) || 0)), 0);

  container.innerHTML = `
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #a7f3d0; border-radius: 6px; padding: 6px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <i data-lucide="boxes" style="width: 16px; height: 16px; color: #059669; flex-shrink: 0;"></i>
        <div style="font-size: 11.5px; color: #065f46; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <strong style="color: #065f46;">BOM Disetujui</strong>
          <span class="badge badge-success" style="font-size: 9.5px; padding: 1px 6px;">${escapeHtml(linkedBom.id)}</span>
          <span style="color: #047857;">&bull; <strong>${components.length}</strong> Material &bull; Total: <strong>${typeof formatRupiah === 'function' ? formatRupiah(totalCost) : 'Rp ' + totalCost.toLocaleString('id-ID')}</strong> &bull; Order: <span class="font-mono">${escapeHtml(linkedBom.orderId || project?.orderId || '-')}</span></span>
        </div>
      </div>
      <div style="display: flex; gap: 6px; align-items: center;">
        <button type="button" class="btn btn-xs btn-outline" style="border-color: #a7f3d0; color: #047857; background: #ffffff; font-size: 10.5px; padding: 2px 7px; height: 24px;" onclick="toggleTimelineBOMComponentsList()">
          <i data-lucide="list" style="width: 12px; height: 12px;"></i> Rincian Material
        </button>
        <button type="button" class="btn btn-xs btn-success" style="background: #059669; border-color: #059669; font-weight: 700; font-size: 10.5px; padding: 2px 8px; height: 24px; display: inline-flex; align-items: center; gap: 3px;" onclick="openAddProjectComponentModal()">
          <i data-lucide="plus-circle" style="width: 12px; height: 12px;"></i> + Tambah
        </button>
      </div>
    </div>
    <div id="timeline-bom-components-dropdown" style="display: none; background: #ffffff; border: 1px solid #d1fae5; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
      <div style="font-size: 11.5px; font-weight: 700; color: #065f46; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>Daftar Material BOM yang Digunakan:</span>
        <span class="font-mono text-muted" style="font-size: 10.5px;">Formula: ${escapeHtml(linkedBom.productName || project?.projectName || '')}</span>
      </div>
      <div class="table-responsive" style="max-height: 180px; overflow-y: auto;">
        <table class="data-table" style="font-size: 11px; margin: 0; width: 100%;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 4px 6px;">No</th>
              <th style="padding: 4px 6px;">Nama Komponen</th>
              <th style="padding: 4px 6px; text-align: center;">Qty</th>
              <th style="padding: 4px 6px; text-align: right;">Biaya</th>
              <th style="padding: 4px 6px; text-align: right;">Subtotal</th>
              <th style="padding: 4px 6px;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${components.map((c, i) => `
              <tr>
                <td style="padding: 4px 6px;">${i + 1}</td>
                <td style="padding: 4px 6px; font-weight: 600;">${escapeHtml(c.componentName || c.itemName || 'Komponen')}</td>
                <td style="padding: 4px 6px; text-align: center;" class="font-mono">${c.qty} ${c.unit || 'Pcs'}</td>
                <td style="padding: 4px 6px; text-align: right;" class="font-mono">${typeof formatRupiah === 'function' ? formatRupiah(c.unitCost || 0) : c.unitCost}</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: 700;" class="font-mono">${typeof formatRupiah === 'function' ? formatRupiah((parseFloat(c.qty) || 0) * (parseFloat(c.unitCost) || 0)) : ''}</td>
                <td style="padding: 4px 6px; color: #64748b; font-size: 10px;">${escapeHtml(c.notes || c.prId || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}
window.renderTimelineBOMComponentInfo = renderTimelineBOMComponentInfo;

function toggleTimelineBOMComponentsList() {
  const dropdown = document.getElementById('timeline-bom-components-dropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}
window.toggleTimelineBOMComponentsList = toggleTimelineBOMComponentsList;

function openAddProjectComponentModal(targetMilestoneName = '') {
  const activeProj = currentActiveProjectData || (state.projects || []).find(p => p.id === currentActiveProjectOrderId || p.orderId === currentActiveProjectOrderId);
  if (!activeProj) {
    showToast('Data project tidak ditemukan', 'error');
    return;
  }

  const linkedBom = (state.bom || []).find(b => 
    b.projectId === activeProj.id || 
    b.orderId === (activeProj.orderId || activeProj.id) ||
    (activeProj.bomId && b.id === activeProj.bomId) ||
    (b.projectName && activeProj.projectName && b.projectName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim()) ||
    (b.productName && activeProj.projectName && b.productName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim())
  );

  const isBomApproved = linkedBom && (linkedBom.status === 'Accepted' || linkedBom.status === 'Approved' || linkedBom.status === 'Disetujui');
  if (!isBomApproved) {
    showToast('⚠️ Fitur Tambah Komponen hanya dapat digunakan saat BOM proyek sudah disetujui (Status: Accepted)!', 'warning');
    return;
  }

  const modal = document.getElementById('form-modal');
  const modalBody = modal?.querySelector('.modal-body') || modal;
  if (!modalBody) return;

  const masterList = typeof getMasterItemsList === 'function' ? getMasterItemsList() : [];
  const milestones = activeProj.milestones || [];
  const existingComponents = linkedBom.components || [];

  modalBody.innerHTML = `
    <div style="font-family: 'Inter', system-ui, sans-serif; max-height: 85vh; overflow-y: auto; padding-right: 4px;">
      <!-- HEADER MODAL -->
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
          <div>
            <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="boxes" style="color: #059669; width: 22px; height: 22px;"></i>
              Tambah Komponen Tambahan Proyek
            </h3>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">
              Proyek: <strong>${escapeHtml(activeProj.projectName)}</strong> &bull; Ref Order: <span class="font-mono">${escapeHtml(activeProj.orderId || '-')}</span> &bull; BOM: <span class="font-mono font-bold text-success">${escapeHtml(linkedBom.id)} (${linkedBom.status})</span>
            </p>
          </div>
          <span class="badge badge-success" style="font-size: 11px; padding: 4px 8px;">
            <i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> BOM Telah Disetujui
          </span>
        </div>
      </div>

      <!-- FORMULIR INPUT KOMPONEN -->
      <form id="form-add-project-component" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
        <datalist id="timeline-master-items-datalist">
          ${masterList.map(m => `<option value="${escapeAttr(m.itemName)}">${escapeAttr(m.itemName)} (${m.specs ? escapeAttr(m.specs) + ' | ' : ''}Stok Tersedia: ${m.qty} ${m.unit} | Rp ${Number(m.unitCost || 0).toLocaleString('id-ID')})</option>`).join('')}
        </datalist>

        <div class="form-group" style="margin: 0;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
            Nama Komponen / Bahan Baku <span class="text-danger">*</span>
          </label>
          <input type="text" id="input-add-comp-name" class="form-control" list="timeline-master-items-datalist" placeholder="Ketik atau pilih dari Master Barang Inventory..." oninput="handleTimelineComponentInput()" required autocomplete="off" style="font-weight: 600; font-size: 13px;">
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            💡 Anda dapat memilih material yang sudah ada di Master Barang atau mengetik nama material baru.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1.5fr; gap: 12px;">
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Spesifikasi Teknis
            </label>
            <input type="text" id="input-add-comp-specs" class="form-control" placeholder="Tipe, ukuran, material..." style="font-size: 12px;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Satuan
            </label>
            <input type="text" id="input-add-comp-unit" class="form-control" value="Pcs" placeholder="Pcs, Set, Mtr..." style="font-size: 12px;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Jumlah Dibutuhkan (Qty) <span class="text-danger">*</span>
            </label>
            <input type="number" id="input-add-comp-qty" class="form-control font-mono font-bold" min="1" step="any" value="1" oninput="handleTimelineComponentInput()" required style="font-size: 13px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.5fr 1.5fr; gap: 12px;">
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Estimasi Biaya Satuan (Rp)
            </label>
            <input type="number" id="input-add-comp-cost" class="form-control font-mono" min="0" value="0" oninput="handleTimelineComponentInput()" style="font-size: 13px;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Estimasi Subtotal Biaya
            </label>
            <div id="preview-add-comp-subtotal" class="form-control font-mono font-bold" style="background: #f8fafc; font-size: 14px; color: #b45309; display: flex; align-items: center;">
              Rp 0
            </div>
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
            Alokasikan ke Tahapan Milestone (Opsional)
          </label>
          <select id="input-add-comp-milestone" class="form-control" style="font-size: 12px;">
            <option value="">-- Alokasi Umum Seluruh Proyek --</option>
            ${milestones.map((m, idx) => `
              <option value="${escapeAttr(m.title || m.name)}" ${targetMilestoneName && (m.title === targetMilestoneName || m.name === targetMilestoneName) ? 'selected' : ''}>
                Tahap ${idx + 1}: ${escapeHtml(m.title || m.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group" style="margin: 0;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
            Keterangan Kebutuhan / Catatan Teknis
          </label>
          <textarea id="input-add-comp-notes" class="form-control" rows="2" placeholder="Alasan penambahan komponen, modifikasi wiring, perkuatan struktur, dll..." style="font-size: 12px;"></textarea>
        </div>

        <!-- LIVE STOCK FEEDBACK BOX -->
        <div id="timeline-component-stock-feedback">
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 12px;">
            Ketik atau pilih nama komponen di atas untuk memeriksa ketersediaan stok di Inventory.
          </div>
        </div>

        <!-- MODAL ACTION BUTTONS -->
        <div id="timeline-component-modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 4px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        </div>
      </form>

      <!-- REFERENSI: KOMPONEN YANG SUDAH ADA DI BOM -->
      <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
        <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>Komponen yang Sudah Terpasang pada BOM Saat Ini (${existingComponents.length} Material):</span>
          <span class="text-muted font-xs">Total BOM HPP: <strong>${typeof formatRupiah === 'function' ? formatRupiah(linkedBom.totalEstimatedCost || linkedBom.materialCost || 0) : 'Rp 0'}</strong></span>
        </div>
        <div class="table-responsive" style="max-height: 160px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
          <table class="data-table" style="font-size: 11px; margin: 0; width: 100%;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 5px 8px;">No</th>
                <th style="padding: 5px 8px;">Komponen</th>
                <th style="padding: 5px 8px; text-align: center;">Qty</th>
                <th style="padding: 5px 8px; text-align: right;">Biaya</th>
                <th style="padding: 5px 8px;">Ref / Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${existingComponents.map((c, i) => `
                <tr>
                  <td style="padding: 5px 8px;">${i + 1}</td>
                  <td style="padding: 5px 8px; font-weight: 600;">${escapeHtml(c.componentName || c.itemName || '-')}</td>
                  <td style="padding: 5px 8px; text-align: center;" class="font-mono">${c.qty} ${c.unit || 'Pcs'}</td>
                  <td style="padding: 5px 8px; text-align: right;" class="font-mono">${typeof formatRupiah === 'function' ? formatRupiah(c.unitCost || 0) : c.unitCost}</td>
                  <td style="padding: 5px 8px; color: #64748b;">${escapeHtml(c.notes || c.prId || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}
window.openAddProjectComponentModal = openAddProjectComponentModal;

function handleTimelineComponentInput() {
  const nameInput = document.getElementById('input-add-comp-name');
  const qtyInput = document.getElementById('input-add-comp-qty');
  const costInput = document.getElementById('input-add-comp-cost');
  const unitInput = document.getElementById('input-add-comp-unit');
  const specsInput = document.getElementById('input-add-comp-specs');
  const feedback = document.getElementById('timeline-component-stock-feedback');
  const previewSubtotal = document.getElementById('preview-add-comp-subtotal');
  const actionContainer = document.getElementById('timeline-component-modal-actions');

  if (!nameInput || !feedback) return;

  const rawName = nameInput.value?.trim() || '';
  const nameLower = rawName.toLowerCase();
  const qty = Math.max(1, parseFloat(qtyInput?.value) || 1);

  // Ambil data master items
  const masterList = typeof getMasterItemsList === 'function' ? getMasterItemsList() : [];
  const matched = masterList.find(m => m.itemName.toLowerCase().trim() === nameLower);

  // Auto-fill unit & cost if matched
  if (matched) {
    if (unitInput && !unitInput.dataset.manualEdited) unitInput.value = matched.unit || 'Pcs';
    if (costInput && (!costInput.value || costInput.value === '0')) costInput.value = matched.unitCost || 0;
    if (specsInput && !specsInput.value && matched.specs) specsInput.value = matched.specs;
  }

  const unitCost = parseFloat(costInput?.value) || (matched?.unitCost || 0);
  const subtotal = qty * unitCost;
  if (previewSubtotal) {
    previewSubtotal.textContent = typeof formatRupiah === 'function' ? formatRupiah(subtotal) : `Rp ${subtotal.toLocaleString('id-ID')}`;
  }

  if (!rawName) {
    feedback.innerHTML = `
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 12px;">
        Ketik atau pilih nama komponen di atas untuk memeriksa ketersediaan stok di Inventory.
      </div>
    `;
    if (actionContainer) actionContainer.innerHTML = `<button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>`;
    return;
  }

  const availableStock = matched ? (parseFloat(matched.qty) || 0) : 0;
  const unit = (unitInput?.value || matched?.unit || 'Pcs').trim();

  if (matched && availableStock >= qty) {
    // KONDISI 1: ADA DI INVENTORY DAN STOK CUKUP -> BISA LANGSUNG DIGUNAKAN & POTONG STOK
    feedback.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #15803d; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> Stok Tersedia di Inventory: <strong>${availableStock} ${unit}</strong>
          </span>
          <span class="badge badge-success" style="font-size: 10.5px;">✓ Siap Digunakan Langsung</span>
        </div>
        <div style="font-size: 11.5px; color: #166534; margin-top: 5px;">
          Komponen <strong>${escapeHtml(matched.itemName)}</strong> tersedia di Master Barang. Klik tombol hijau di bawah untuk <strong>langsung mengalokasikan ${qty} ${unit} ke BOM proyek</strong> dan stok inventory otomatis terpotong.
        </div>
      </div>
    `;
    if (actionContainer) {
      actionContainer.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="button" class="btn btn-success" style="background: #059669; border-color: #059669; padding: 9px 20px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="executeAddDirectComponentToBOM()">
          <i data-lucide="check-circle"></i> Gunakan Langsung & Potong Stok (${qty} ${unit})
        </button>
      `;
    }
  } else {
    // KONDISI 2: TIDAK ADA DI INVENTORY ATAU STOK TIDAK CUKUP -> PENGAJUAN KEMBALI PURCHASING
    const statusText = matched ? `Stok Kurang (Tersedia: ${availableStock} ${unit}, Dibutuhkan: ${qty} ${unit})` : 'Belum Ada di Inventory (Stok: 0)';
    feedback.innerHTML = `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #b45309; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i> ${statusText}
          </span>
          <span class="badge badge-amber" style="font-size: 10.5px; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;">Pengajuan Purchasing Diperlukan</span>
        </div>
        <div style="font-size: 11.5px; color: #92400e; margin-top: 5px;">
          Stok barang tidak mencukupi di inventory untuk kebutuhan proyek ini. Klik tombol di bawah untuk <strong>otomatis mengajukan Request Pengadaan (Purchasing) kembali</strong> ke bagian Purchasing.
        </div>
      </div>
    `;
    if (actionContainer) {
      actionContainer.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="button" class="btn btn-primary" style="background: #d97706; border-color: #d97706; padding: 9px 20px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="executeSubmitPurchasingForComponent()">
          <i data-lucide="shopping-cart"></i> Ajukan Pengadaan Purchasing (${qty} ${unit})
        </button>
      `;
    }
  }

  if (window.lucide) lucide.createIcons();
}
window.handleTimelineComponentInput = handleTimelineComponentInput;

async function executeAddDirectComponentToBOM() {
  const activeProj = currentActiveProjectData;
  if (!activeProj) {
    showToast('Data project aktif tidak ditemukan', 'error');
    return;
  }

  const linkedBom = (state.bom || []).find(b => 
    b.projectId === activeProj.id || 
    b.orderId === (activeProj.orderId || activeProj.id) ||
    (activeProj.bomId && b.id === activeProj.bomId) ||
    (b.projectName && activeProj.projectName && b.projectName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim()) ||
    (b.productName && activeProj.projectName && b.productName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim())
  );

  if (!linkedBom) {
    showToast('Master BOM terkait proyek ini tidak ditemukan', 'error');
    return;
  }

  const nameInput = document.getElementById('input-add-comp-name');
  const qtyInput = document.getElementById('input-add-comp-qty');
  const costInput = document.getElementById('input-add-comp-cost');
  const unitInput = document.getElementById('input-add-comp-unit');
  const specsInput = document.getElementById('input-add-comp-specs');
  const msInput = document.getElementById('input-add-comp-milestone');
  const notesInput = document.getElementById('input-add-comp-notes');

  const itemName = (nameInput?.value || '').trim();
  const qty = parseFloat(qtyInput?.value) || 0;
  const unit = (unitInput?.value || 'Pcs').trim();
  const unitCost = parseFloat(costInput?.value) || 0;
  const specs = (specsInput?.value || '').trim();
  const milestoneName = msInput?.value || '';
  const notes = (notesInput?.value || '').trim();

  if (!itemName) {
    showToast('Harap masukkan nama komponen', 'warning');
    return;
  }
  if (qty <= 0) {
    showToast('Jumlah (Qty) komponen harus lebih dari 0', 'warning');
    return;
  }

  // Cek ketersediaan di Master Barang
  const masterList = typeof getMasterItemsList === 'function' ? getMasterItemsList() : [];
  const mItem = masterList.find(m => m.itemName.toLowerCase().trim() === itemName.toLowerCase().trim());
  const availableStock = mItem ? (parseFloat(mItem.qty) || 0) : 0;

  if (!mItem || availableStock < qty) {
    showToast(`⚠️ Stok di inventory tidak mencukupi (${availableStock} ${unit}). Silakan gunakan tombol Ajukan Pengadaan Purchasing!`, 'warning');
    return;
  }

  // Tambahkan komponen ke dalam BOM
  if (!Array.isArray(linkedBom.components)) linkedBom.components = [];

  const existingIdx = linkedBom.components.findIndex(c => 
    (c.componentName || c.itemName || '').toLowerCase().trim() === itemName.toLowerCase().trim()
  );

  if (existingIdx !== -1) {
    linkedBom.components[existingIdx].qty = (parseFloat(linkedBom.components[existingIdx].qty) || 0) + qty;
    if (unitCost > 0) linkedBom.components[existingIdx].unitCost = unitCost;
    if (specs) linkedBom.components[existingIdx].specs = specs;
    if (notes) linkedBom.components[existingIdx].notes = (linkedBom.components[existingIdx].notes ? `${linkedBom.components[existingIdx].notes}; ` : '') + notes;
  } else {
    linkedBom.components.push({
      componentName: itemName,
      specs: specs || (mItem?.specs || ''),
      qty: qty,
      unit: unit || (mItem?.unit || 'Pcs'),
      unitCost: unitCost || (mItem?.unitCost || 0),
      prId: mItem?.sourcePrId || '',
      notes: notes || (milestoneName ? `Tambahan milestone: ${milestoneName}` : 'Tambahan dari Kalender Milestone')
    });
  }

  // Hitung ulang HPP BOM
  linkedBom.materialCost = linkedBom.components.reduce((sum, c) => sum + ((parseFloat(c.qty) || 0) * (parseFloat(c.unitCost) || 0)), 0);
  linkedBom.totalEstimatedCost = linkedBom.materialCost + (parseFloat(linkedBom.laborCost) || 0) + (parseFloat(linkedBom.overheadCost) || 0);
  linkedBom.updatedAt = new Date().toISOString();

  try {
    // 1. Simpan update BOM ke backend
    const res = await fetch(`/api/bom/${linkedBom.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linkedBom)
    });
    if (!res.ok) throw new Error('Gagal memperbarui data BOM di server');

    // 2. Potong stok inventory (purchasing / master items)
    if (typeof deductBOMComponentsStock === 'function') {
      await deductBOMComponentsStock([{ componentName: itemName, qty: qty, prId: mItem?.sourcePrId }]);
    }

    // 3. Catat di milestone jika dipilih
    if (milestoneName && Array.isArray(activeProj.milestones)) {
      const ms = activeProj.milestones.find(m => m.name === milestoneName || m.title === milestoneName);
      if (ms) {
        if (!Array.isArray(ms.additionalComponents)) ms.additionalComponents = [];
        ms.additionalComponents.push({
          componentName: itemName,
          qty: qty,
          unit: unit,
          unitCost: unitCost,
          subtotal: qty * unitCost,
          notes: notes,
          addedAt: new Date().toISOString()
        });
        await fetch(`/api/projects/${activeProj.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeProj)
        }).catch(e => console.warn(e));
      }
    }

    // 4. Update data finansial proyek di tabel project_finances Supabase
    if (typeof window.syncBOMToProjectFinances === 'function') {
      await window.syncBOMToProjectFinances(linkedBom);
    }

    // 5. Muat ulang resource terkait
    if (typeof fetchResource === 'function') {
      await Promise.allSettled([
        fetchResource('bom'),
        fetchResource('master_items'),
        fetchResource('purchasing'),
        fetchResource('project_finances')
      ]);
    }

    closeModal('form-modal');
    showToast(`✅ Komponen "${itemName}" (${qty} ${unit}) berhasil ditambahkan ke BOM dan stok inventory telah terpotong!`, 'success');

    // Re-render UI Kalender & Milestone
    renderTimelineBOMComponentInfo(activeProj, linkedBom, true);
    renderMilestoneCalendarBlocks(activeProj);
  } catch (err) {
    console.error('Error adding component to BOM:', err);
    showToast('Gagal menambahkan komponen: ' + err.message, 'error');
  }
}
window.executeAddDirectComponentToBOM = executeAddDirectComponentToBOM;

async function executeSubmitPurchasingForComponent() {
  const activeProj = currentActiveProjectData;
  if (!activeProj) {
    showToast('Data project aktif tidak ditemukan', 'error');
    return;
  }

  const linkedBom = (state.bom || []).find(b => 
    b.projectId === activeProj.id || 
    b.orderId === (activeProj.orderId || activeProj.id) ||
    (activeProj.bomId && b.id === activeProj.bomId) ||
    (b.projectName && activeProj.projectName && b.projectName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim()) ||
    (b.productName && activeProj.projectName && b.productName.toLowerCase().trim() === activeProj.projectName.toLowerCase().trim())
  );

  const nameInput = document.getElementById('input-add-comp-name');
  const qtyInput = document.getElementById('input-add-comp-qty');
  const costInput = document.getElementById('input-add-comp-cost');
  const unitInput = document.getElementById('input-add-comp-unit');
  const specsInput = document.getElementById('input-add-comp-specs');
  const msInput = document.getElementById('input-add-comp-milestone');
  const notesInput = document.getElementById('input-add-comp-notes');

  const itemName = (nameInput?.value || '').trim();
  const qty = parseFloat(qtyInput?.value) || 0;
  const unit = (unitInput?.value || 'Pcs').trim();
  const unitCost = parseFloat(costInput?.value) || 0;
  const specs = (specsInput?.value || '').trim();
  const milestoneName = msInput?.value || '';
  const notes = (notesInput?.value || '').trim();

  if (!itemName) {
    showToast('Harap masukkan nama komponen', 'warning');
    return;
  }
  if (qty <= 0) {
    showToast('Jumlah (Qty) komponen harus lebih dari 0', 'warning');
    return;
  }

  const authUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const newPrId = `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100 + Math.random() * 900)}`;

  const newPR = {
    id: newPrId,
    orderId: activeProj.orderId || activeProj.id || '',
    projectId: activeProj.id || '',
    projectName: activeProj.projectName || '',
    bomId: linkedBom?.id || '',
    requestor: authUser?.name || activeProj.projectLead || 'Lead Project',
    department: authUser?.department || 'Engineering & Produksi',
    requestDate: new Date().toISOString().split('T')[0],
    requiredDate: activeProj.dueDate || '',
    urgency: 'High',
    status: 'Pending',
    purpose: `Pengadaan Tambahan Komponen Project: ${activeProj.projectName} (Ref: ${activeProj.orderId || activeProj.id})`,
    notes: notes ? `${notes} [Untuk Milestone: ${milestoneName || 'Umum'}]` : `Kebutuhan komponen tambahan untuk Milestone: ${milestoneName || 'Umum'}`,
    items: [
      {
        itemName: itemName,
        specs: specs || '',
        qty: qty,
        unit: unit || 'Pcs',
        estimatedPrice: unitCost || 0,
        actualPrice: unitCost || 0,
        total: qty * (unitCost || 0),
        itemStatus: 'Belum Dipesan'
      }
    ],
    totalEstimated: qty * (unitCost || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    const res = await fetch('/api/purchasing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPR)
    });
    if (!res.ok) throw new Error('Gagal mengirim pengajuan purchasing ke server');
    const saved = await res.json();
    state.purchasing = state.purchasing || [];
    state.purchasing.unshift(saved || newPR);

    closeModal('form-modal');
    showToast(`📋 Pengajuan Purchasing #${newPrId} berhasil dibuat untuk ${itemName} (${qty} ${unit})! Menunggu proses pembelian & stok masuk.`, 'success');
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
  } catch (err) {
    console.error('Error submitting purchasing:', err);
    showToast('Gagal mengajukan purchasing: ' + err.message, 'error');
  }
}
window.executeSubmitPurchasingForComponent = executeSubmitPurchasingForComponent;
