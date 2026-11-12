// =========================================================
// UBM - Orders Module (Order Penjualan / Sales Order)
// =========================================================

// Helper: Memeriksa apakah order bertipe Jasa / Layanan (Non-BOM)
// Hanya true jika Quotation asal atau Order eksplisit bertipe 'jasa'
function isServiceOrder(order) {
  if (!order) return false;
  const quoId = order.quotationId || (order.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]);
  if (quoId && window.state && Array.isArray(state.quotations)) {
    const quo = state.quotations.find(q => q.id === quoId);
    if (quo && quo.quotationType) {
      return String(quo.quotationType).toLowerCase() === 'jasa';
    }
  }
  if (order.id && window.state && Array.isArray(state.quotations)) {
    const linkedQuo = state.quotations.find(q => q.orderId === order.id);
    if (linkedQuo && linkedQuo.quotationType) {
      return String(linkedQuo.quotationType).toLowerCase() === 'jasa';
    }
  }
  if (order.quotationType) return String(order.quotationType).toLowerCase() === 'jasa';
  if (order.orderType) return String(order.orderType).toLowerCase() === 'jasa';
  if (order.notes) {
    const notesLower = order.notes.toLowerCase();
    if (notesLower.includes('surat penawaran harga (produk)') || notesLower.includes('[tipe: produk]')) return false;
    if (notesLower.includes('surat penawaran harga (jasa)') || notesLower.includes('[tipe: jasa]') || notesLower.includes('tipe penawaran: jasa')) return true;
  }
  return false;
}

// Helper: Memeriksa apakah Order telah mendapatkan 2 persetujuan resmi (Ketua UBM & Wakil Direktur I)
function isOrderDualApproved(order) {
  if (!order) return false;
  if (typeof ensureOrderApprovalData === 'function') {
    ensureOrderApprovalData(order);
  }
  return Boolean(order.approvalKetuaUbm && order.approvalWadir1);
}

// Helper: Cek secara ketat apakah user merupakan Project Lead yang ditugaskan pada project untuk order ini
function isStrictProjectLeadForOrder(order, user = null) {
  if (!order) return false;
  const u = user || (typeof getAuthUser === 'function' ? getAuthUser() : null);
  if (!u) return false;
  const uName = (u.name || '').trim().toLowerCase();
  const uEmail = (u.email || '').trim().toLowerCase();
  if (!uName && !uEmail) return false;

  const projects = (typeof state !== 'undefined' && Array.isArray(state.projects)) ? state.projects : [];
  const linkedProject = projects.find(p => p.orderId === order.id || p.id === order.id);
  const rawLead = (linkedProject?.projectLead || order.projectLead || '').trim().toLowerCase();
  if (!rawLead || rawLead === 'belum diassign') return false;

  return Boolean(
    rawLead === uName ||
    rawLead === uEmail ||
    (uName && uName.length > 2 && rawLead.includes(uName)) ||
    (uName && rawLead.length > 2 && uName.includes(rawLead)) ||
    (uEmail && rawLead.includes(uEmail))
  );
}

// Helper: Cek apakah user berhak mengedit Order Penjualan
// - Jika sudah disetujui lengkap oleh Ketua UBM & Wakil Direktur I: tidak dapat diedit oleh role apapun
// - Jika belum disetujui lengkap: hanya Administrator dan Project Lead pada project tersebut
function canUserEditOrderRecord(order, user = null) {
  if (!order) return { allowed: false, reason: 'not_found', message: 'Data Order Penjualan tidak ditemukan.' };
  if (isOrderDualApproved(order)) {
    return {
      allowed: false,
      reason: 'dual_approved',
      message: '🔒 Order Penjualan ini sudah disetujui lengkap oleh Ketua UBM dan Wakil Direktur I sehingga tidak dapat diedit oleh role apapun!'
    };
  }
  const u = user || (typeof getAuthUser === 'function' ? getAuthUser() : null);
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(u) : (u?.role || 'Member');
  if (roleName === 'Administrator' || isStrictProjectLeadForOrder(order, u)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'unauthorized',
    message: '⚠️ Tombol Edit Order Penjualan hanya dapat diakses oleh Administrator dan Project Lead pada project tersebut!'
  };
}
window.isStrictProjectLeadForOrder = isStrictProjectLeadForOrder;
window.canUserEditOrderRecord = canUserEditOrderRecord;

function promptDualApprovalRequired(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  const ketuaOk = Boolean(order?.approvalKetuaUbm);
  const wadirOk = Boolean(order?.approvalWadir1);
  let msg = '⚠️ Seluruh tombol aksi pengerjaan terkunci. Menunggu persetujuan lengkap:';
  if (!ketuaOk) msg += '\n• Akun / Role Ketua UBM (Belum Disetujui)';
  if (!wadirOk) msg += '\n• Akun / Role Wakil Direktur I (Belum Disetujui)';
  showToast(msg, 'warning');
}

// Menghitung status order secara otomatis sesuai posisi tahapan pengerjaan
function calculateAutoOrderStatus(order) {
  if (!order) return 'Pengajuan';

  // 1. Jika belum disetujui keduanya (Ketua UBM & Wakil Direktur I), status tetap Pengajuan
  if (!isOrderDualApproved(order)) {
    return 'Pengajuan';
  }

  // 2. Jika dibatalkan
  if (order.status === 'Cancelled') {
    return 'Cancelled';
  }

  // 3. Posisi Delivered: Jika ada Surat Jalan 'Delivered / Received' atau seluruh project milestone selesai
  const isDelivered = (state.delivery || []).some(d => d.orderId === order.id && (d.status === 'Delivered / Received' || d.status === 'Delivered'));
  const project = (state.projects || []).find(p => p.orderId === order.id);
  const isProjectCompleted = project && (
    project.status === 'Completed' ||
    (project.milestones && project.milestones.length > 0 && project.milestones.every(m => m.status === 'Completed'))
  );
  if (isDelivered || isProjectCompleted || order.status === 'Delivered') {
    return 'Delivered';
  }

  // 4. Posisi In Production: Jika ada Formula Master BOM terdaftar (produk) atau Project Milestone sedang berjalan
  const isService = isServiceOrder(order);
  const hasBOM = !isService && (state.bom || []).some(b => b.orderId === order.id);
  const isProjectActive = project && (
    project.status === 'In Progress' ||
    project.status === 'Testing & QC' ||
    (project.milestones || []).some(m => m.status === 'In Progress' || m.status === 'Completed')
  );
  if (hasBOM || isProjectActive || order.status === 'In Production') {
    return 'In Production';
  }

  // 5. Posisi Confirmed: Jika Dokumen PO Pelanggan sudah ada / diunggah
  const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
  if (hasPO || order.status === 'Confirmed') {
    return 'Confirmed';
  }

  // 6. Posisi Awal setelah disetujui keduanya dari Pengajuan: Accepted (Menunggu upload PO Pelanggan)
  return 'Accepted';
}

function renderOrdersTable() {
  const tbody = document.getElementById('table-orders-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-order-status')?.value || document.getElementById('order-status-filter')?.value || 'ALL';
  let list = (state.orders || []).map(o => (typeof ensureOrderPOData === 'function' ? ensureOrderPOData(o) : o));

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Administrator';

  // Role Member: hanya melihat order penjualan yang project-nya di-assign padanya (sebagai Project Lead atau anggota tim)
  if (roleName === 'Member') {
    list = list.filter(o => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(o.id, activeUser) : true);
  }

  if (statusFilter !== 'ALL') {
    list = list.filter(o => o.status === statusFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    if (roleName === 'Member') {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted" style="padding: 36px;"><p style="font-size: 13.5px; font-weight: 600; color: #475569; margin-bottom: 4px;">Belum Ada Order Penjualan yang Ditugaskan</p><p style="font-size: 12px; color: #94a3b8; margin: 0;">Anda belum terdaftar sebagai Project Lead atau anggota tim pada order/project aktif manapun.</p></td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted" style="padding: 28px;">Tidak ada data order penjualan ditemukan.</td></tr>';
    }
    return;
  }

  tbody.innerHTML = list.map(order => {
    const isDualApproved = isOrderDualApproved(order);
    const isPengajuan = !isDualApproved || order.status === 'Pengajuan';
    const isAccepted = isDualApproved && (order.status === 'Accepted' || !order.status || order.status === 'Pengajuan');
    const isService = isServiceOrder(order);

    const itemCount = order.items ? order.items.length : 0;
    const project = (state.projects || []).find(p => p.orderId === order.id);
    const projectLeadHtml = project?.projectLead && project.projectLead !== 'Belum diassign' ?
      `<div>
         <div class="font-bold text-main" style="font-size: 11px; line-height: 1.25;">${escapeHtml(project.projectLead)}</div>
         <div class="text-muted font-sm" style="font-size: 9.5px; margin-top: 1px;">${escapeHtml(project.department || 'Engineering')}${project.team?.length ? ` &bull; 👥 ${project.team.length}` : ''}</div>
       </div>` :
      `<span class="badge badge-secondary" style="font-size: 9px; padding: 1.5px 5px;">Belum diassign</span>`;

    const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);

    // Dokumen PO Column: Hanya bisa diakses setelah disetujui lengkap oleh Ketua UBM dan Wakil Direktur I
    const poColumnHtml = !isDualApproved ?
      `<button type="button" class="btn btn-xs btn-outline" style="color: #94a3b8; border-color: #cbd5e1; background: #f8fafc; font-size: 9.5px; font-weight: 600; padding: 2.5px 6px; display: inline-flex; align-items: center; gap: 3px; cursor: not-allowed; opacity: 0.65; white-space: nowrap;" onclick="event.stopPropagation(); promptDualApprovalRequired('${order.id}')" title="Upload PO baru dapat dilakukan setelah Order disetujui lengkap oleh Ketua UBM dan Wakil Direktur I">
         <i data-lucide="lock" style="width: 10px; height: 10px;"></i> Upload PO
       </button>` :
      (hasPO ?
        `<button type="button" class="btn btn-xs btn-outline" style="color: #059669; border-color: #a7f3d0; background: #ecfdf5; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; padding: 2.5px 6px; white-space: nowrap;" onclick="event.stopPropagation(); viewOrderPODocument('${order.id}')" title="Klik untuk menampilkan dokumen PO Pelanggan (PDF)">
           <i data-lucide="eye" style="width: 11px; height: 11px;"></i> View PO
         </button>` :
        `<button type="button" class="btn btn-xs btn-primary" style="background: #e11d48; border-color: #e11d48; font-size: 10px; font-weight: 700; padding: 2.5px 6px; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap;" onclick="event.stopPropagation(); openUploadPOModal('${order.id}')" title="Wajib upload PO Pelanggan (PDF)">
           <i data-lucide="upload-cloud" style="width: 11px; height: 11px;"></i> Upload PO
         </button>`);

    // Syarat akses berjenjang (Sequential Workflow Pipeline setelah Dual Approved):
    // 1. PO sudah diupload DAN status tidak Cancelled
    const isPOAndAccepted = hasPO && order.status !== 'Cancelled';
    // 2. Leader Project sudah ditentukan dan disimpan
    const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
    // 3. BOM sudah diisi untuk order ini (Khusus Produk Manufaktur)
    const orderBOMs = (state.bom || []).filter(b => b.orderId === order.id || (order.items || []).some(item => b.productName && item.itemName && b.productName.toLowerCase().trim() === item.itemName.toLowerCase().trim()));
    const acceptedBOM = orderBOMs.find(b => b.status === 'Accepted');
    const pengajuanBOM = orderBOMs.find(b => b.status === 'Pengajuan');
    const rejectedBOM = orderBOMs.find(b => b.status === 'Ditolak');

    const hasBOM = orderBOMs.length > 0;
    const isBOMAccepted = Boolean(acceptedBOM);
    const isBOMPengajuan = !acceptedBOM && Boolean(pengajuanBOM);
    const isBOMDitolak = !acceptedBOM && !pengajuanBOM && Boolean(rejectedBOM);

    // Tombol 1: Penugasan Tim (Aktif seketika setelah PO diupload)
    const btnPenugasan = isPOAndAccepted ?
      `<button class="btn-icon" style="color: #4f46e5;" title="Penugasan Tim & PIC (Project Leader)" onclick="event.stopPropagation(); openTeamAssignmentPage('${order.id}')"><i data-lucide="users"></i></button>` :
      `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Wajib upload PO Pelanggan untuk mengakses Penugasan Tim" onclick="event.stopPropagation(); promptPenugasanDisabled('${order.id}')"><i data-lucide="users"></i></button>`;

    // Tombol 2: BOM (Jika Jasa: Tampilkan status Non-BOM; Jika Produk: Memerlukan Input BOM)
    let btnBOM = '';
    if (isService) {
      btnBOM = `<button class="btn-icon" style="color: #059669; background: #ecfdf5; border: 1px dashed #86efac;" title="Order Jasa / Layanan (Tidak memerlukan BOM)" onclick="event.stopPropagation(); showToast('Order Jasa/Layanan tidak memerlukan Bill of Materials (BOM). Alur pengerjaan langsung ke Penugasan Tim & Project Management.', 'info')"><i data-lucide="shield-check" style="color: #059669;"></i></button>`;
    } else if (isPOAndAccepted && hasProjectLead) {
      if (isBOMDitolak) {
        btnBOM = `<button class="btn-icon" style="color: #dc2626; background: #fef2f2; border: 1.5px solid #fca5a5;" title="⚠️ Formula BOM Ditolak (Klik untuk Mengedit & Mengajukan Ulang BOM)" onclick="event.stopPropagation(); createBOMFromOrder('${order.id}')"><i data-lucide="edit-3"></i></button>`;
      } else if (isBOMAccepted) {
        btnBOM = `<button class="btn-icon" style="color: #059669;" title="Formula Master BOM Telah Ditetapkan & Terkunci (Accepted)" onclick="event.stopPropagation(); createBOMFromOrder('${order.id}')"><i data-lucide="boxes"></i></button>`;
      } else if (isBOMPengajuan) {
        btnBOM = `<button class="btn-icon" style="color: #d97706;" title="Formula BOM Status Pengajuan (Klik untuk Melihat)" onclick="event.stopPropagation(); createBOMFromOrder('${order.id}')"><i data-lucide="boxes"></i></button>`;
      } else {
        btnBOM = `<button class="btn-icon" style="color: #2563eb;" title="Input / Formula BOM untuk Order ini" onclick="event.stopPropagation(); createBOMFromOrder('${order.id}')"><i data-lucide="boxes"></i></button>`;
      }
    } else if (isPOAndAccepted) {
      btnBOM = `<button class="btn-icon" style="color: #6366f1; background: #f5f3ff;" title="Tentukan Project Leader pada Penugasan Tim untuk mulai mengisi BOM (Klik untuk buka Penugasan Tim)" onclick="event.stopPropagation(); openTeamAssignmentPage('${order.id}')"><i data-lucide="boxes"></i></button>`;
    } else {
      btnBOM = `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Wajib upload PO Pelanggan terlebih dahulu" onclick="event.stopPropagation(); promptBOMDisabled('${order.id}')"><i data-lucide="boxes"></i></button>`;
    }

    // Tombol 3: Project Management / Pengajuan Transportasi & Uang Makan (Untuk Jasa)
    let btnProject = '';
    if (isService) {
      btnProject = isPOAndAccepted ?
        `<button class="btn-icon" style="color: #ea580c; background: #fff7ed; border: 1.5px solid #fed7aa;" title="Pengajuan Transportasi dan Uang Makan Pelaksanaan Jasa" onclick="event.stopPropagation(); openServiceExpenseModal('${order.id}')"><i data-lucide="car"></i></button>` :
        `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Wajib upload PO Pelanggan untuk Pengajuan Transportasi & Uang Makan Jasa" onclick="event.stopPropagation(); promptPOAndAcceptedRequired('${order.id}')"><i data-lucide="car"></i></button>`;
    } else {
      const hasValidBOM = hasBOM && !isBOMDitolak;
      const isProjectActiveAllowed = isPOAndAccepted && hasProjectLead && hasValidBOM;
      const canEditTimelineOrder = typeof canUserEditProjectTimeline === 'function'
        ? canUserEditProjectTimeline(project || order.id, activeUser)
        : (roleName === 'Administrator' || isStrictProjectLeadForOrder(order, activeUser));
      const projectBtnTitle = canEditTimelineOrder
        ? 'Project Management (Timeline & Milestone)'
        : 'Project Management - Timeline & Milestone (Mode Lihat)';
      btnProject = isProjectActiveAllowed ?
        `<button class="btn-icon" style="color: #8b5cf6;" title="${projectBtnTitle}" onclick="event.stopPropagation(); openProjectTimelinePage('${order.id}')"><i data-lucide="folder-kanban"></i></button>` :
        (isPOAndAccepted ?
          `<button class="btn-icon" style="color: #a855f7; opacity: 0.75;" title="${!hasProjectLead ? 'Tentukan Project Leader terlebih dahulu (Klik untuk membuka Penugasan Tim)' : 'Isi dan simpan BOM terlebih dahulu'}" onclick="event.stopPropagation(); promptProjectManagementDisabled('${order.id}')"><i data-lucide="folder-kanban"></i></button>` :
          `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Wajib upload PO Pelanggan terlebih dahulu" onclick="event.stopPropagation(); promptProjectManagementDisabled('${order.id}')"><i data-lucide="folder-kanban"></i></button>`);
    }

    // Tombol Cetak / Preview Surat Tugas Resmi (Tersedia jika Lead Project sudah ditetapkan)
    const btnSuratTugas = hasProjectLead ?
      `<button class="btn-icon" style="color: #4338ca;" title="Cetak / Preview Surat Tugas Resmi" onclick="event.stopPropagation(); if (typeof exportTeamAssignmentLetterPDF === 'function') exportTeamAssignmentLetterPDF('${order.id}');"><i data-lucide="printer"></i></button>` : '';

    // Tombol 4: Edit Order (Hanya Administrator & Project Lead pada project terkait, serta TERKUNCI TOTAL jika sudah disetujui Ketua UBM & Wadir I)
    const editAccess = canUserEditOrderRecord(order, activeUser);
    const btnEdit = isDualApproved
      ? `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="🔒 Terkunci: Order sudah disetujui oleh Ketua UBM & Wadir I (Tidak dapat diedit oleh role apapun)" onclick="event.stopPropagation(); showToast('🔒 Order Penjualan ini sudah disetujui lengkap oleh Ketua UBM dan Wakil Direktur I sehingga tidak dapat diedit oleh role apapun!', 'warning')"><i data-lucide="edit-2"></i></button>`
      : (editAccess.allowed
        ? `<button class="btn-icon" title="Edit Order Penjualan" onclick="event.stopPropagation(); editOrder('${order.id}')"><i data-lucide="edit-2"></i></button>`
        : '');

    // Tombol 5: Hapus Order (Hanya dapat diakses oleh Administrator)
    const isStrictAdmin = roleName === 'Administrator';
    const btnDelete = isStrictAdmin
      ? `<button class="btn-icon btn-danger-ghost" title="Hapus Order" onclick="event.stopPropagation(); deleteResource('orders', '${order.id}')"><i data-lucide="trash-2"></i></button>`
      : '';

    // Action Buttons: Jika BELUM disetujui keduanya, tombol pengerjaan terkunci; namun tombol Edit aktif bagi Administrator & Project Lead terkait
    let actionsHtml = '';
    if (!isDualApproved) {
      actionsHtml = `
        <div class="table-actions" onclick="event.stopPropagation()">
          <button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Menunggu persetujuan lengkap Ketua UBM & Wadir I" onclick="event.stopPropagation(); promptDualApprovalRequired('${order.id}')"><i data-lucide="users"></i></button>
          <button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Menunggu persetujuan lengkap Ketua UBM & Wadir I" onclick="event.stopPropagation(); promptDualApprovalRequired('${order.id}')"><i data-lucide="printer"></i></button>
          <button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Menunggu persetujuan lengkap Ketua UBM & Wadir I" onclick="event.stopPropagation(); promptDualApprovalRequired('${order.id}')"><i data-lucide="boxes"></i></button>
          <button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Menunggu persetujuan lengkap Ketua UBM & Wadir I" onclick="event.stopPropagation(); promptDualApprovalRequired('${order.id}')"><i data-lucide="${isService ? 'car' : 'folder-kanban'}"></i></button>
          ${btnEdit}
          ${btnDelete}
        </div>
      `;
    } else {
      actionsHtml = `
        <div class="table-actions" onclick="event.stopPropagation()">
          ${btnPenugasan}
          ${btnSuratTugas}
          ${btnBOM}
          ${btnProject}
          ${btnEdit}
          ${btnDelete}
        </div>
      `;
    }

    // Status Column (2 Kolom Terpisah: Ketua UBM & Wakil Direktur I)
    const isAdmin = roleName === 'Administrator' || roleName === 'Direktur';
    const isKetuaUbm = roleName === 'Ketua UBM';
    const isWadir1 = roleName === 'Wakil Direktur I';

    // 1. Kolom Persetujuan Ketua UBM
    const isKetuaApproved = Boolean(order.approvalKetuaUbm);
    const canManageKetua = (isAdmin || isKetuaUbm);

    let statusKetuaUbmHtml = '';
    if (isKetuaApproved) {
      statusKetuaUbmHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
          <span class="badge" style="font-size: 9.5px; font-weight: 700; padding: 2.5px 7px; border-radius: 4px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 3px;" title="Disetujui oleh: ${escapeAttr(order.approvalKetuaUbmBy || 'Ketua UBM')}">
            <i data-lucide="check-circle" style="width: 10px; height: 10px; color: #10b981;"></i> Disetujui
          </span>
          <span style="font-size: 8px; color: #047857; font-weight: 600; line-height: 1.1; max-width: 95px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(order.approvalKetuaUbmBy || 'Ketua UBM')}
          </span>
        </div>
      `;
    } else {
      if (canManageKetua) {
        statusKetuaUbmHtml = `
          <div style="display: flex; gap: 3px; justify-content: center; align-items: center; flex-wrap: nowrap;">
            <button type="button" class="btn btn-xs" style="background: #16a34a; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); approveOrderByRole('${order.id}', 'Ketua UBM')" title="Setujui order ini sebagai Ketua UBM">
              <i data-lucide="check" style="width: 9px; height: 9px;"></i> Setuju
            </button>
            <button type="button" class="btn btn-xs" style="background: #ef4444; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); rejectOrderByRole('${order.id}', 'Ketua UBM')" title="Tolak order ini dan kembalikan ke Surat Penawaran (Quotation)">
              <i data-lucide="x" style="width: 9px; height: 9px;"></i> Tidak
            </button>
          </div>
        `;
      } else {
        statusKetuaUbmHtml = `
          <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 2px;" title="Menunggu persetujuan Ketua UBM">
            <i data-lucide="clock" style="width: 8px; height: 8px;"></i> Menunggu
          </span>
        `;
      }
    }

    // 2. Kolom Persetujuan Wakil Direktur I
    const isWadirApproved = Boolean(order.approvalWadir1);
    const canManageWadir = (isAdmin || isWadir1);

    let statusWadir1Html = '';
    if (isWadirApproved) {
      statusWadir1Html = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
          <span class="badge" style="font-size: 9.5px; font-weight: 700; padding: 2.5px 7px; border-radius: 4px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 3px;" title="Disetujui oleh: ${escapeAttr(order.approvalWadir1By || 'Wakil Direktur I')}">
            <i data-lucide="check-circle" style="width: 10px; height: 10px; color: #10b981;"></i> Disetujui
          </span>
          <span style="font-size: 8px; color: #047857; font-weight: 600; line-height: 1.1; max-width: 95px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(order.approvalWadir1By || 'Wakil Direktur I')}
          </span>
        </div>
      `;
    } else {
      if (canManageWadir) {
        statusWadir1Html = `
          <div style="display: flex; gap: 3px; justify-content: center; align-items: center; flex-wrap: nowrap;">
            <button type="button" class="btn btn-xs" style="background: #0284c7; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); approveOrderByRole('${order.id}', 'Wakil Direktur I')" title="Setujui order ini sebagai Wakil Direktur I">
              <i data-lucide="check" style="width: 9px; height: 9px;"></i> Setuju
            </button>
            <button type="button" class="btn btn-xs" style="background: #ef4444; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); rejectOrderByRole('${order.id}', 'Wakil Direktur I')" title="Tolak order ini dan kembalikan ke Surat Penawaran (Quotation)">
              <i data-lucide="x" style="width: 9px; height: 9px;"></i> Tidak
            </button>
          </div>
        `;
      } else {
        statusWadir1Html = `
          <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 2px;" title="Menunggu persetujuan Wakil Direktur I">
            <i data-lucide="clock" style="width: 8px; height: 8px;"></i> Menunggu
          </span>
        `;
      }
    }

    return `
      <tr class="${isAccepted ? 'row-accepted' : (isPengajuan ? 'row-pengajuan' : '')}" style="${isAccepted ? 'background-color: #f0fdf4;' : (isPengajuan ? 'background-color: #fffbeb;' : '')}; cursor: pointer;" onclick="if (!event.target.closest('.table-actions, button, a, select, input, textarea, .btn-icon, .btn')) viewOrderDetail('${order.id}')" title="Klik untuk melihat detail order & project ${order.id}">
        <td style="font-size: 10px; padding: 6px 4px;">
          <span class="mono-id font-bold text-primary" style="font-size: 10px; padding: 1px 3px; word-break: break-all;">${order.id}</span>
          <div style="margin-top: 2px;">
            <span class="badge ${isService ? 'badge-info' : 'badge-outline'}" style="font-size: 8.5px; padding: 1px 4px; font-weight: 700;">
              ${isService ? '🛠️ Jasa' : '📦 Produk'}
            </span>
          </div>
        </td>
        <td style="padding: 6px 4px;">
          <div class="font-bold text-main" style="font-size: 11px; line-height: 1.3; word-break: break-word;">${escapeHtml(order.customerName)}</div>
          ${order.projectName ? `<div class="text-primary font-bold" style="font-size: 10px; margin-top: 1px;"><i data-lucide="folder-kanban" style="width: 10px; height: 10px; display: inline; vertical-align: middle; color: #4f46e5;"></i> ${escapeHtml(order.projectName)}</div>` : ''}
          ${order.customerPhone ? `<div class="text-muted font-sm" style="font-size: 9.5px; margin-top: 1px;">📞 ${escapeHtml(order.customerPhone)}</div>` : ''}
        </td>
        <td style="padding: 6px 4px; font-size: 10.5px;">${projectLeadHtml}</td>
        <td style="text-align: center; padding: 6px 3px;" onclick="event.stopPropagation()">${poColumnHtml}</td>
        <td style="font-size: 10.5px; color: #334155; padding: 6px 4px; white-space: nowrap;">${order.orderDate || '-'}</td>
        <td style="font-size: 10.5px; color: #334155; padding: 6px 4px; white-space: nowrap;">${order.dueDate || '-'}</td>
        <td style="text-align: center; padding: 6px 3px;"><span class="badge badge-secondary font-bold" style="font-size: 9px; padding: 1.5px 4px;">${itemCount} Item</span></td>
        <td class="font-bold font-mono text-main" style="font-size: 10.5px; padding: 6px 4px; white-space: nowrap; text-align: right;">${formatRupiah(order.grandTotal)}</td>
        <td style="text-align: center; padding: 5px 3px;" onclick="event.stopPropagation()">
          ${statusKetuaUbmHtml}
        </td>
        <td style="text-align: center; padding: 5px 3px;" onclick="event.stopPropagation()">
          ${statusWadir1Html}
        </td>
        <td class="text-right" style="padding: 5px 4px;" onclick="event.stopPropagation()">
          ${actionsHtml}
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// DUAL APPROVAL SYSTEM: KETUA UBM & WAKIL DIREKTUR I
// -------------------------------------------------------------
async function approveOrderByRole(orderId, approverRole) {
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Member';
  const isAdmin = currentRole === 'Administrator' || currentRole === 'Direktur';

  // Validasi kewenangan role
  if (approverRole === 'Ketua UBM') {
    if (!isAdmin && currentRole !== 'Ketua UBM') {
      showToast('⚠️ Hanya Ketua UBM atau Administrator yang dapat memberikan persetujuan ini.', 'warning');
      return;
    }
  } else if (approverRole === 'Wakil Direktur I') {
    if (!isAdmin && currentRole !== 'Wakil Direktur I') {
      showToast('⚠️ Hanya Wakil Direktur I atau Administrator yang dapat memberikan persetujuan ini.', 'warning');
      return;
    }
  } else {
    showToast('⚠️ Role persetujuan tidak valid.', 'error');
    return;
  }

  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) {
    showToast('Data order tidak ditemukan!', 'error');
    return;
  }

  // Guard: Jika role ini sudah menyetujui, tidak bisa diubah lagi!
  if (approverRole === 'Ketua UBM' && order.approvalKetuaUbm) {
    showToast('Persetujuan Ketua UBM sudah disetujui secara permanen.', 'info');
    return;
  }
  if (approverRole === 'Wakil Direktur I' && order.approvalWadir1) {
    showToast('Persetujuan Wakil Direktur I sudah disetujui secara permanen.', 'info');
    return;
  }

  const approverName = activeUser?.name || approverRole;
  const nowIso = new Date().toISOString();

  if (approverRole === 'Ketua UBM') {
    order.approvalKetuaUbm = true;
    order.approvalKetuaUbmBy = approverName;
    order.approvalKetuaUbmDate = nowIso;
  } else if (approverRole === 'Wakil Direktur I') {
    order.approvalWadir1 = true;
    order.approvalWadir1By = approverName;
    order.approvalWadir1Date = nowIso;
  }

  const isDualApproved = Boolean(order.approvalKetuaUbm && order.approvalWadir1);
  if (isDualApproved) {
    if (!['Confirmed', 'In Production', 'Delivered'].includes(order.status)) {
      order.status = 'Accepted';
    }
  }

  if (typeof embedApprovalInNotes === 'function') {
    const targetNotes = order._rawNotes || order.notes || '';
    const embedded = embedApprovalInNotes(targetNotes, order);
    order._rawNotes = embedded;
    order.notes = embedded;
  }

  // Update UI secara instan (optimistic)
  renderOrdersTable();

  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    if (!res.ok) throw new Error('Gagal menyimpan persetujuan ke server');

    const savedOrder = await res.json().catch(() => null);
    if (savedOrder && typeof savedOrder === 'object') {
      if (order.approvalKetuaUbm) {
        savedOrder.approvalKetuaUbm = true;
        savedOrder.approvalKetuaUbmBy = order.approvalKetuaUbmBy;
        savedOrder.approvalKetuaUbmDate = order.approvalKetuaUbmDate;
      }
      if (order.approvalWadir1) {
        savedOrder.approvalWadir1 = true;
        savedOrder.approvalWadir1By = order.approvalWadir1By;
        savedOrder.approvalWadir1Date = order.approvalWadir1Date;
      }
      if (typeof ensureOrderApprovalData === 'function') {
        ensureOrderApprovalData(savedOrder);
      }
      const orderIdx = (state.orders || []).findIndex(o => o.id === orderId);
      if (orderIdx !== -1) {
        state.orders[orderIdx] = savedOrder;
      }
    }

    if (typeof directSupabaseUpsertNativeRow === 'function') {
      directSupabaseUpsertNativeRow('orders', order).catch(() => {});
    }
    if (typeof directSupabaseSyncResource === 'function' && Array.isArray(state.orders)) {
      directSupabaseSyncResource('orders', state.orders).catch(() => {});
    }

    if (isDualApproved) {
      if (typeof syncAcceptedOrdersToInvoices === 'function') {
        syncAcceptedOrdersToInvoices();
      }

      const quoRef = order.quotationId || (order.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]);
      if (quoRef) {
        const targetQuo = (state.quotations || []).find(q => q.id === quoRef);
        if (targetQuo && targetQuo.status !== 'Accepted') {
          targetQuo.status = 'Accepted';
          targetQuo.isDraft = false;
          targetQuo.publishedAt = targetQuo.publishedAt || new Date().toISOString();
          fetch(`/api/quotations/${quoRef}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...targetQuo, status: 'Accepted', isDraft: false })
          }).catch(e => console.warn('Sync quotation error:', e));
          if (typeof directSupabaseUpsertNativeRow === 'function') {
            directSupabaseUpsertNativeRow('quotations', targetQuo).catch(() => {});
          }
          if (typeof directSupabaseSyncResource === 'function' && Array.isArray(state.quotations)) {
            directSupabaseSyncResource('quotations', state.quotations).catch(() => {});
          }

          if (typeof renderQuotationsTable === 'function') {
            renderQuotationsTable();
          }
        }
      }

      showToast(`🎉 Persetujuan LENGKAP (Ketua UBM & Wadir I)! Order #${orderId} resmi disetujui (Accepted) dan seluruh tombol aksi telah terbuka.`, 'success');
    } else {
      showToast(`✓ Persetujuan ${approverRole} berhasil dicatat. Menunggu 1 persetujuan lagi untuk membuka aksi pengerjaan.`, 'info');
    }
  } catch (err) {
    console.error('Error in approveOrderByRole:', err);
    showToast('Gagal memproses persetujuan: ' + err.message, 'error');
    renderOrdersTable();
  }
}

// -------------------------------------------------------------
// PENOLAKAN ORDER: KEMBALI KE QUOTATION (DRAFT)
// -------------------------------------------------------------
async function rejectOrderByRole(orderId, rejectorRole = '') {
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Member';
  const isAdmin = currentRole === 'Administrator' || currentRole === 'Direktur';

  // Periksa kewenangan
  if (rejectorRole === 'Ketua UBM') {
    if (!isAdmin && currentRole !== 'Ketua UBM') {
      showToast('⚠️ Hanya Ketua UBM atau Administrator yang dapat menolak pada kolom Ketua UBM.', 'warning');
      return;
    }
  } else if (rejectorRole === 'Wakil Direktur I') {
    if (!isAdmin && currentRole !== 'Wakil Direktur I') {
      showToast('⚠️ Hanya Wakil Direktur I atau Administrator yang dapat menolak pada kolom Wakil Direktur I.', 'warning');
      return;
    }
  } else if (!isAdmin && currentRole !== 'Ketua UBM' && currentRole !== 'Wakil Direktur I') {
    showToast('⚠️ Hanya Ketua UBM, Wakil Direktur I, atau Administrator yang memiliki wewenang menolak order.', 'warning');
    return;
  }

  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) {
    showToast('Data order tidak ditemukan!', 'error');
    return;
  }

  const roleLabel = rejectorRole || (currentRole === 'Administrator' ? 'Administrator' : currentRole);
  const reason = prompt(
    `Tolak Order Penjualan #${orderId} (${roleLabel}) dan kembalikan ke Surat Penawaran (Quotation)?\n\nMasukkan catatan penolakan/alasan revisi:`,
    'Perlu penyesuaian harga / spesifikasi teknis penawaran'
  );
  if (reason === null) return; // User membatalkan

  const approverName = activeUser?.name || roleLabel;
  const dateStr = new Date().toLocaleDateString('id-ID');
  const rejectionNote = `[Ditolak oleh ${roleLabel} (${approverName}) pada ${dateStr}]: ${reason.trim() || 'Perlu peninjauan & revisi ulang penawaran'}`;

  try {
    const quoRef = order.quotationId || (order.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]);
    let targetQuo = quoRef ? (state.quotations || []).find(q => q.id === quoRef) : null;

    if (targetQuo) {
      targetQuo.status = 'Draft';
      targetQuo.isDraft = true;
      targetQuo.publishedAt = null;
      targetQuo.approvalKetuaUbm = false;
      targetQuo.approvalKetuaUbmBy = null;
      targetQuo.approvalKetuaUbmDate = null;
      targetQuo.approvalDirektur = false;
      targetQuo.approvalDirekturBy = null;
      targetQuo.approvalDirekturDate = null;
      targetQuo.orderId = null;
      targetQuo.rejectionNotes = rejectionNote;
      const cleanPrevNotes = typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(targetQuo._rawNotes || targetQuo.notes || '') : (targetQuo.notes || '');
      targetQuo.notes = cleanPrevNotes ? `${rejectionNote}\n\n${cleanPrevNotes}` : rejectionNote;
      targetQuo._rawNotes = targetQuo.notes;

      await fetch(`/api/quotations/${targetQuo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetQuo)
      }).catch(() => {});
      if (typeof directSupabaseUpsertNativeRow === 'function') {
        await directSupabaseUpsertNativeRow('quotations', targetQuo).catch(() => {});
      }
      if (typeof directSupabaseSyncResource === 'function' && Array.isArray(state.quotations)) {
        await directSupabaseSyncResource('quotations', state.quotations).catch(() => {});
      }
    } else {
      // Jika order dibuat langsung tanpa quotation asal, buatkan Quotation baru berstatus Draft agar data tidak hilang
      const newQuoId = 'QUO-' + (order.id ? order.id.replace('ORD-', '') : Date.now());
      const newQuo = {
        id: newQuoId,
        customerName: order.customerName,
        projectName: order.projectName || order.customerName,
        customerPhone: order.customerPhone || '',
        customerAddress: order.customerAddress || '',
        quotationDate: order.orderDate || new Date().toISOString().split('T')[0],
        validUntil: order.dueDate || '',
        status: 'Draft',
        isDraft: true,
        publishedAt: null,
        createdBy: activeUser?.email || activeUser?.name || '',
        rejectionNotes: rejectionNote,
        approvalKetuaUbm: false,
        approvalDirektur: false,
        quotationType: isServiceOrder(order) ? 'jasa' : 'produk',
        items: order.items || [],
        additionalServices: order.additionalServices || [],
        warranty: 'Garansi standar pengerjaan',
        leadTime: 'Sesuai kesepakatan',
        grandTotal: order.grandTotal || 0,
        subtotal: order.subtotal || order.grandTotal || 0,
        taxRate: order.taxRate ?? 11,
        taxAmount: order.taxAmount || 0,
        notes: `${rejectionNote}\n\nCatatan Asal Order #${order.id}:\n${order.notes || '-'}`
      };
      if (!Array.isArray(state.quotations)) state.quotations = [];
      state.quotations.unshift(newQuo);

      await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuo)
      }).catch(() => {});
      if (typeof directSupabaseUpsertNativeRow === 'function') {
        await directSupabaseUpsertNativeRow('quotations', newQuo).catch(() => {});
      }
      if (typeof directSupabaseSyncResource === 'function' && Array.isArray(state.quotations)) {
        await directSupabaseSyncResource('quotations', state.quotations).catch(() => {});
      }
    }

    // Hapus project terkait jika ada
    const linkedProject = (state.projects || []).find(p => p.orderId === orderId);
    if (linkedProject) {
      await fetch(`/api/projects/${linkedProject.id}`, { method: 'DELETE' }).catch(e => console.warn('Delete project error:', e));
      state.projects = (state.projects || []).filter(p => p.id !== linkedProject.id);
    }

    // Hapus Order dari server & state
    await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    state.orders = (state.orders || []).filter(o => o.id !== orderId);

    // Render ulang tabel Orders dan Quotations
    renderOrdersTable();
    if (typeof renderQuotationsTable === 'function') {
      renderQuotationsTable();
    }

    showToast(`Order #${orderId} telah ditolak oleh ${roleLabel} dan berhasil dikembalikan ke Surat Penawaran (Quotation) untuk direvisi.`, 'success');
  } catch (err) {
    console.error('Error rejecting order:', err);
    showToast('Gagal menolak order: ' + err.message, 'error');
  }
}

// -------------------------------------------------------------
// STATUS ORDER GUARD
// -------------------------------------------------------------
async function updateOrderStatusDirect(orderId, newStatus = 'Accepted') {
  if (typeof hasRolePermission === 'function' && !hasRolePermission('canApproveOrder')) {
    showToast('⚠️ Hanya Ketua UBM, Wakil Direktur I, dan Administrator yang memiliki wewenang pada order penjualan.', 'warning');
    renderOrdersTable();
    return;
  }

  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  if (!isOrderDualApproved(order) && newStatus !== 'Pengajuan' && newStatus !== 'Cancelled') {
    showToast('⚠️ Order membutuhkan 2 persetujuan: Ketua UBM dan Wakil Direktur I sebelum status dapat diubah.', 'warning');
    renderOrdersTable();
    return;
  }

  const oldStatus = order.status;
  order.status = newStatus;
  renderOrdersTable();

  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    if (!res.ok) {
      throw new Error('Gagal memperbarui status order di server');
    }

    if (newStatus === 'Accepted') {
      if (typeof syncAcceptedOrdersToInvoices === 'function') {
        syncAcceptedOrdersToInvoices();
      }

      const quoRef = order.quotationId || (order.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]);
      if (quoRef) {
        const targetQuo = (state.quotations || []).find(q => q.id === quoRef);
        if (targetQuo && targetQuo.status !== 'Accepted') {
          targetQuo.status = 'Accepted';
          targetQuo.isDraft = false;
          targetQuo.publishedAt = targetQuo.publishedAt || new Date().toISOString();
          fetch(`/api/quotations/${quoRef}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...targetQuo, status: 'Accepted', isDraft: false })
          }).catch(e => console.warn('Sync quotation status error:', e));
          if (typeof directSupabaseUpsertNativeRow === 'function') {
            directSupabaseUpsertNativeRow('quotations', targetQuo).catch(() => {});
          }
          if (typeof directSupabaseSyncResource === 'function' && Array.isArray(state.quotations)) {
            directSupabaseSyncResource('quotations', state.quotations).catch(() => {});
          }

          if (typeof renderQuotationsTable === 'function') {
            renderQuotationsTable();
          }
        }
      }
    }

    showToast(`Status Order #${orderId} berhasil diubah menjadi "${newStatus}".`, 'success');
  } catch (err) {
    console.error('Error updating order status directly:', err);
    order.status = oldStatus;
    renderOrdersTable();
    showToast('Gagal mengubah status: ' + err.message, 'error');
  }
}

function filterOrders() {
  renderOrdersTable();
}

function promptPenugasanDisabled(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  const hasPO = Boolean(order?.poDocument?.url || order?.poFileUrl || order?.poDocument?.name || order?.poFileName);

  if (!hasPO) {
    showToast('⚠️ Unggah berkas dokumen PO Pelanggan terlebih dahulu untuk mengaktifkan Penugasan Tim & menu aksi!', 'warning');
    openUploadPOModal(orderId);
  }
}

function promptBOMDisabled(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (isServiceOrder(order)) {
    showToast('💡 Order ini bertipe Jasa/Layanan dan tidak memerlukan Bill of Materials (BOM). Alur langsung ke Penugasan Tim & Project Management.', 'info');
    return;
  }
  const hasPO = Boolean(order?.poDocument?.url || order?.poFileUrl || order?.poDocument?.name || order?.poFileName);

  if (!hasPO) {
    promptPenugasanDisabled(orderId);
    return;
  }

  const project = (state.projects || []).find(p => p.orderId === orderId);
  const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');

  if (!hasProjectLead) {
    showToast('⚠️ Tentukan dan simpan Project Leader terlebih dahulu pada menu Penugasan Tim sebelum mengisi BOM!', 'warning');
    openTeamAssignmentPage(orderId);
  }
}

function promptProjectManagementDisabled(orderId) {
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || 'Member');
  const order = (state.orders || []).find(o => o.id === orderId);
  const isService = isServiceOrder(order);
  const hasPO = Boolean(order?.poDocument?.url || order?.poFileUrl || order?.poDocument?.name || order?.poFileName);
  const isAccepted = order?.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order?.status);
  const project = (state.projects || []).find(p => p.orderId === orderId);
  const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');

  if (roleName === 'PPIC') {
    if (project && typeof openProjectTimelinePage === 'function') {
      openProjectTimelinePage(orderId);
      return;
    }
    showToast('⚠️ Timeline Project Management belum tersedia (PO Pelanggan, Project Leader, atau BOM belum lengkap). Role PPIC hanya dapat melihat apabila Timeline telah tersedia.', 'warning');
    return;
  }

  if (!hasPO || !isAccepted) {
    promptPenugasanDisabled(orderId);
    return;
  }

  if (!hasProjectLead) {
    showToast('⚠️ Tentukan Project Leader terlebih dahulu pada menu Penugasan Tim!', 'warning');
    openTeamAssignmentPage(orderId);
    return;
  }

  if (!isService) {
    const hasBOM = (state.bom || []).some(b => b.orderId === orderId || (order?.items || []).some(item => b.productName && item.itemName && b.productName.toLowerCase().trim() === item.itemName.toLowerCase().trim()));

    if (!hasBOM) {
      showToast('⚠️ Isi dan simpan Bill of Materials (BOM) terlebih dahulu sebelum membuat Project Management!', 'warning');
      createBOMFromOrder(orderId);
    }
  }
}

function promptPOAndAcceptedRequired(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  const hasPO = Boolean(order?.poDocument?.url || order?.poFileUrl || order?.poDocument?.name || order?.poFileName);

  if (!hasPO && order?.status === 'Pengajuan') {
    showToast('⚠️ Unggah dokumen PO Pelanggan dan ubah status menjadi "Accepted" terlebih dahulu untuk membuka akses tombol!', 'warning');
    openUploadPOModal(orderId);
  } else if (!hasPO) {
    showToast('⚠️ Unggah dokumen PO Pelanggan terlebih dahulu untuk membuka akses tombol!', 'warning');
    openUploadPOModal(orderId);
  } else if (order?.status === 'Pengajuan') {
    showToast('⚠️ Status order masih "Pengajuan". Ubah status menjadi "Accepted" pada tabel untuk mengaktifkan seluruh tombol aksi!', 'warning');
  }
}

function promptUploadPORequired(orderId) {
  promptPOAndAcceptedRequired(orderId);
}

function toggleOrderTypeUI(type) {
  const isJasa = type === 'jasa';
  const optProduk = document.getElementById('order-opt-produk-label');
  const optJasa = document.getElementById('order-opt-jasa-label');
  if (optProduk && optJasa) {
    if (isJasa) {
      optProduk.style.borderColor = '#cbd5e1';
      optProduk.style.background = '#f8fafc';
      optProduk.style.color = '#64748b';
      optProduk.style.fontWeight = '500';

      optJasa.style.borderColor = '#10b981';
      optJasa.style.background = '#ecfdf5';
      optJasa.style.color = '#047857';
      optJasa.style.fontWeight = '700';
    } else {
      optProduk.style.borderColor = '#3b82f6';
      optProduk.style.background = '#eff6ff';
      optProduk.style.color = '#1d4ed8';
      optProduk.style.fontWeight = '700';

      optJasa.style.borderColor = '#cbd5e1';
      optJasa.style.background = '#f8fafc';
      optJasa.style.color = '#64748b';
      optJasa.style.fontWeight = '500';
    }
  }

  const titleEl = document.getElementById('order-card2-title');
  const descEl = document.getElementById('order-card2-desc');
  if (titleEl) {
    titleEl.innerHTML = isJasa
      ? '<i data-lucide="wrench" style="width: 16px; height: 16px; color: #10b981;"></i> Rincian Jasa & Pekerjaan Utama (Non-BOM)'
      : '<i data-lucide="shopping-cart" style="width: 16px; height: 16px; color: #10b981;"></i> Rincian Produk Utama Pesanan (Manufaktur & BOM)';
  }
  if (descEl) {
    descEl.textContent = isJasa
      ? 'Daftar layanan jasa/pekerjaan yang akan diproses langsung ke Penugasan Tim & Project Management (Tanpa BOM).'
      : 'Daftar produk fisik yang akan diproses ke BOM, Purchasing Material, dan Produksi Fabrikasi.';
  }
  if (window.lucide) lucide.createIcons();
}

function autoFillOrderFromQuotation(quoId) {
  if (!quoId) {
    const hiddenQuoId = document.getElementById('order-form-quotation-id');
    if (hiddenQuoId) hiddenQuoId.value = '';
    return;
  }

  const quo = (state.quotations || []).find(q => q.id === quoId);
  if (!quo) return;

  if (quo.status === 'Draft' || Boolean(quo.isDraft)) {
    showToast(`📝 Quotation ${quoId} masih berstatus Draft (Belum Terbit). Terbitkan dan lengkapi persetujuan terlebih dahulu!`, 'warning');
    const select = document.getElementById('order-quotation-select');
    if (select) select.value = '';
    return;
  }

  const form = document.getElementById('order-form');
  if (!form) return;

  // Validasi: Cegah auto-fill quotation yang sudah dikonversi ke order lain
  const existingOrder = (state.orders || []).find(o => o.quotationId === quoId || (o.notes && o.notes.includes(quoId)));
  if (existingOrder) {
    showToast(`⚠️ Surat Penawaran ${quoId} sudah pernah dikonversi ke Order Penjualan #${existingOrder.id}! Tidak dapat dikonversi kembali.`, 'warning');
    const select = document.getElementById('order-quotation-select');
    if (select) select.value = '';
    return;
  }

  const hiddenQuoId = document.getElementById('order-form-quotation-id');
  if (hiddenQuoId) hiddenQuoId.value = quo.id;

  const isQuoJasa = quo.quotationType === 'jasa';
  const radioJasa = document.querySelector('input[name="orderType"][value="jasa"]');
  const radioProduk = document.querySelector('input[name="orderType"][value="produk"]');
  if (isQuoJasa && radioJasa) {
    radioJasa.checked = true;
    toggleOrderTypeUI('jasa');
  } else if (!isQuoJasa && radioProduk) {
    radioProduk.checked = true;
    toggleOrderTypeUI('produk');
  }

  const safeCust = (quo.customerName && quo.customerName !== 'Calon Pelanggan (Ditulis Tangan)') ? quo.customerName : '';
  if (form.customerName) form.customerName.value = safeCust;
  if (form.projectName) form.projectName.value = quo.projectName || (quo.items?.[0]?.itemName || '');
  if (form.customerPhone) form.customerPhone.value = quo.customerPhone || '';
  if (form.customerAddress) form.customerAddress.value = quo.customerAddress || '';
  if (form.dueDate && quo.validUntil) form.dueDate.value = quo.validUntil;

  let serviceNotes = '';
  if (quo.additionalServices && quo.additionalServices.length > 0) {
    serviceNotes = '\n\n[KETERANGAN JASA & INSTALASI (NON-BOM)]:\n' +
      quo.additionalServices.map((s, idx) => `${idx + 1}. ${s.serviceName} (${s.qty} ${s.unit || 'Lot'} @ ${formatRupiah(s.unitPrice)}) = ${formatRupiah(s.total)}`).join('\n');
  }

  const cleanQuoNotes = typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(quo.notes) : (quo.notes || '');
  if (form.notes) {
    form.notes.value = `Dikonversi dari Surat Penawaran Harga (${isQuoJasa ? 'JASA' : 'PRODUK'}) #${quo.id}.\nKetentuan Garansi: ${quo.warranty || '-'}.\nLead time: ${quo.leadTime || '-'}.${serviceNotes}${cleanQuoNotes ? `\n\nCatatan Tambahan:\n${cleanQuoNotes}` : ''}`;
  }

  const taxInput = document.getElementById('order-tax-rate');
  if (taxInput && quo.taxRate !== undefined) {
    taxInput.value = quo.taxRate;
  }

  const discountInput = document.getElementById('order-discount');
  if (discountInput && quo.discount !== undefined) {
    discountInput.value = quo.discount;
  }

  const warrantyCheck = document.getElementById('order-include-warranty');
  if (warrantyCheck) {
    warrantyCheck.checked = (quo.warrantyFee !== undefined && quo.warrantyFee > 0);
  }

  // Populate main products (masuk BOM, Purchasing & Produksi)
  const itemsContainer = document.getElementById('order-items-list');
  if (itemsContainer) {
    itemsContainer.innerHTML = '';
    if (quo.items && quo.items.length > 0) {
      quo.items.forEach(it => addOrderItemRow(it));
    } else {
      addOrderItemRow();
    }
  }

  // Populate additional services (sub produk / instalasi / non-BOM)
  const servicesContainer = document.getElementById('order-services-list');
  if (servicesContainer) {
    servicesContainer.innerHTML = '';
    if (quo.additionalServices && quo.additionalServices.length > 0) {
      quo.additionalServices.forEach(svc => addOrderServiceRow(svc));
    }
  }

  calculateOrderTotals();
  showToast(`Data dari Quotation ${quo.id} (${isQuoJasa ? 'Jasa Non-BOM' : 'Produk BOM'}) termasuk sub-jasa & total harga berhasil dimuat!`, 'info');
}

function openOrderModal(orderData = null) {
  const isEdit = !!(orderData && orderData.id && orderData.id !== 'undefined');
  if (isEdit) {
    const editAccess = canUserEditOrderRecord(orderData);
    if (!editAccess.allowed) {
      showToast(editAccess.message, 'warning');
      return;
    }
  }
  const quotationId = orderData?.quotationId || (orderData?.notes && (orderData.notes.match(/QUO-[\w-]+/i) || [])[0]) || '';
  const isService = isServiceOrder(orderData);
  const canApprove = (typeof hasRolePermission === 'function') ? hasRolePermission('canApproveOrder') : true;

  document.getElementById('form-modal-title').textContent = isEdit
    ? `Edit Order Penjualan: ${orderData.id}`
    : (quotationId ? `Buat Order Penjualan Baru (Referensi Quotation #${quotationId})` : 'Buat Order Penjualan Baru');

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '1020px';
    modalContainer.style.width = '94vw';
  }

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="order-form" onsubmit="submitOrder(event, '${isEdit ? orderData.id : ''}')" style="display: flex; flex-direction: column; gap: 20px;">
      <input type="hidden" name="quotationId" id="order-form-quotation-id" value="${escapeAttr(quotationId)}">
      
      <!-- CARD 1: INFORMASI PELANGGAN & PEMESANAN -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        
        <!-- PILIHAN TIPE ORDER (PRODUK MANUFAKTUR vs JASA NON-BOM) -->
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div>
            <label class="form-label font-bold" style="font-size: 11.5px; margin-bottom: 1px; color: #0f172a; display: flex; align-items: center; gap: 5px;">
              <i data-lucide="layers" style="width: 14px; height: 14px; color: #2563eb;"></i> Tipe Order Penjualan *
            </label>
            <span style="font-size: 10.5px; color: #64748b;">Produk Manufaktur (Memerlukan BOM) atau Jasa/Layanan (Non-BOM)</span>
          </div>
          <div style="display: inline-flex; gap: 8px; align-items: center;">
            <label id="order-opt-produk-label" style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; cursor: pointer; border: 1.5px solid ${isService ? '#cbd5e1' : '#3b82f6'}; background: ${isService ? '#f8fafc' : '#eff6ff'}; font-weight: ${isService ? '500' : '700'}; color: ${isService ? '#64748b' : '#1d4ed8'}; font-size: 11.5px;">
              <input type="radio" name="orderType" value="produk" ${!isService ? 'checked' : ''} onchange="toggleOrderTypeUI('produk')" style="cursor: pointer;">
              <span>📦 Produk (BOM)</span>
            </label>
            <label id="order-opt-jasa-label" style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; cursor: pointer; border: 1.5px solid ${isService ? '#10b981' : '#cbd5e1'}; background: ${isService ? '#ecfdf5' : '#f8fafc'}; font-weight: ${isService ? '700' : '500'}; color: ${isService ? '#047857' : '#64748b'}; font-size: 11.5px;">
              <input type="radio" name="orderType" value="jasa" ${isService ? 'checked' : ''} onchange="toggleOrderTypeUI('jasa')" style="cursor: pointer;">
              <span>🛠️ Jasa (Non-BOM)</span>
            </label>
          </div>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="user-check" style="width: 16px; height: 16px; color: #2563eb;"></i> Informasi Pelanggan & Status Order
        </h4>

        <!-- DROPDOWN REFERENSI QUOTATION -->
        <div style="margin-bottom: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <label class="form-label" style="font-weight: 700; color: #1e40af; margin-bottom: 0; font-size: 11.5px; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="file-check-2" style="width: 14px; height: 14px; color: #2563eb;"></i> Referensi Surat Penawaran (Quotation)
            </label>
            <span style="font-size: 10.5px; color: #64748b;">Pilih untuk auto-fill pelanggan & rincian pesanan</span>
          </div>
          <select id="order-quotation-select" class="form-control" onchange="autoFillOrderFromQuotation(this.value)" ${isEdit ? 'disabled' : ''} style="font-size: 12px; background: #ffffff;">
            <option value="">-- Tanpa Referensi Quotation (Order Baru Lepas) --</option>
            ${(state.quotations || []).filter(q => (quotationId === q.id) || !(q.status === 'Draft' || Boolean(q.isDraft))).map(q => {
    const alreadyUsedOrder = (state.orders || []).find(o => (!isEdit || o.id !== orderData?.id) && (o.quotationId === q.id || (o.notes && o.notes.includes(q.id))));
    const qCust = (q.customerName && q.customerName !== 'Calon Pelanggan (Ditulis Tangan)') ? q.customerName : (q.projectName || 'Calon Pelanggan');
    if (alreadyUsedOrder) {
      return `<option value="${q.id}" ${(quotationId === q.id) ? 'selected' : 'disabled'} style="color: #94a3b8; background: #f8fafc;">
                  [${q.id}] ${escapeHtml(qCust)} - ⚠️ Sudah Dikonversi (Order #${alreadyUsedOrder.id})
                </option>`;
    }
    const qTypeBadge = q.quotationType === 'jasa' ? '🛠️ Jasa' : '📦 Produk';
    return `<option value="${q.id}" ${(quotationId === q.id) ? 'selected' : ''}>
                [${q.id}] [${qTypeBadge}] ${escapeHtml(qCust)} - ${formatRupiah(q.grandTotal)} (${q.status === 'Accepted' ? '✅ Disetujui' : q.status === 'Sent' ? '✉️ Terkirim' : q.status})
              </option>`;
  }).join('')}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1.4fr 1.4fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Nama Pelanggan / Perusahaan *</label>
            <input type="text" name="customerName" class="form-control" placeholder="PT / CV / Nama Perorangan" required value="${escapeAttr(orderData?.customerName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Project / Pekerjaan *</label>
            <input type="text" name="projectName" class="form-control" placeholder="Contoh: Smart Water IoT Monitoring System" required value="${escapeAttr(orderData?.projectName || orderData?.items?.[0]?.itemName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">No. Telepon / WhatsApp</label>
            <input type="text" name="customerPhone" class="form-control" placeholder="Contoh: 0812-3456-7890" value="${escapeAttr(orderData?.customerPhone || '')}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Alamat Lengkap Pengiriman (Delivery Address)</label>
            <input type="text" name="customerAddress" class="form-control" placeholder="Alamat pabrik, gudang, atau kantor penerima" value="${escapeAttr(orderData?.customerAddress || '')}">
          </div>
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11px; color: #475569;">Status Order</label>
            ${!isEdit ? `
              <input type="hidden" name="status" value="Pengajuan">
              <div class="form-control" style="background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-weight: 700; font-size: 11.5px; display: flex; align-items: center; gap: 8px; cursor: default; height: 38px;">
                <i data-lucide="clock" style="width: 15px; height: 15px; color: #d97706;"></i>
                <span>🟡 Pengajuan (Menunggu Persetujuan Ketua UBM & Wadir I)</span>
              </div>
            ` : (isOrderDualApproved(orderData) ? `
              <input type="hidden" name="status" value="${orderData?.status || 'Accepted'}">
              <div class="form-control" style="background: #ecfdf5; border: 1px solid #86efac; color: #15803d; font-weight: 700; font-size: 11.5px; display: flex; align-items: center; gap: 8px; cursor: default; height: 38px;" title="Order telah disetujui lengkap oleh Ketua UBM dan Wakil Direktur I. Status terkunci permanen.">
                <i data-lucide="check-check" style="width: 15px; height: 15px; color: #16a34a;"></i>
                <span>🟢 ${orderData?.status || 'Accepted'} (Disetujui Ketua UBM & Wadir I - Terkunci)</span>
              </div>
            ` : `
              <input type="hidden" name="status" value="Pengajuan">
              <div class="form-control" style="background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-weight: 700; font-size: 11.5px; display: flex; align-items: center; gap: 8px; cursor: default; height: 38px;" title="Order belum disetujui lengkap oleh Ketua UBM dan Wakil Direktur I.">
                <i data-lucide="clock" style="width: 15px; height: 15px; color: #d97706;"></i>
                <span>🟡 Pengajuan (Menunggu Persetujuan Ketua UBM & Wadir I)</span>
              </div>
            `)}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Tanggal Order *</label>
            <input type="date" name="orderDate" class="form-control" required value="${orderData?.orderDate || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Target Deadline Selesai</label>
            <input type="date" name="dueDate" class="form-control" value="${orderData?.dueDate || ''}">
          </div>
        </div>
      </div>

      <!-- CARD 2: DAFTAR BARANG / PRODUK UTAMA PESANAN -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 id="order-card2-title" style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="${isService ? 'wrench' : 'shopping-cart'}" style="width: 16px; height: 16px; color: #10b981;"></i> ${isService ? 'Rincian Jasa & Pekerjaan Utama (Non-BOM)' : 'Rincian Produk Utama Pesanan (Manufaktur & BOM)'}
            </h4>
            <p id="order-card2-desc" style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">${isService ? 'Daftar layanan jasa/pekerjaan yang akan diproses langsung ke Penugasan Tim & Project Management (Tanpa BOM).' : 'Daftar produk fisik yang akan diproses ke BOM, Purchasing Material, dan Produksi Fabrikasi.'}</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="addOrderItemRow()" style="font-size: 11.5px;">
            <i data-lucide="plus"></i> Tambah Baris Item
          </button>
        </div>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
          <div style="display: grid; grid-template-columns: minmax(0, 2.5fr) minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: #475569;">
            <div>Nama Item / Spesifikasi Pekerjaan</div>
            <div>Kode / SKU</div>
            <div style="text-align: center;">Qty</div>
            <div style="text-align: center;">Satuan</div>
            <div style="text-align: right;">Harga Satuan (Rp)</div>
            <div style="text-align: right;">Total (Rp)</div>
            <div></div>
          </div>
          <div id="order-items-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff;">
            <!-- Dynamically populated rows -->
          </div>
        </div>
      </div>

      <!-- CARD 2B: RINCIAN JASA & INSTALASI TAMBAHAN (NON-BOM) -->
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="font-size: 12.5px; font-weight: 700; color: #4338ca; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="wrench" style="width: 15px; height: 15px; color: #6366f1;"></i> Rincian Jasa & Instalasi Tambahan (Keterangan Non-BOM)
            </h4>
            <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">Sub penawaran (Instalasi, Setting, Commissioning). Masuk kalkulasi total harga tapi <strong>tidak diproses ke BOM / Purchasing produksi</strong>.</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline" onclick="addOrderServiceRow()" style="font-size: 11px; border-color: #c7d2fe; color: #4338ca; background: #ffffff;">
            <i data-lucide="plus"></i> Tambah Jasa / Instalasi
          </button>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #ffffff;">
          <div style="display: grid; grid-template-columns: minmax(0, 2.8fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; background: #f1f5f9; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #475569;">
            <div>Deskripsi Jasa / Layanan Instalasi</div>
            <div style="text-align: center;">Qty</div>
            <div style="text-align: center;">Satuan</div>
            <div style="text-align: right;">Harga Satuan (Rp)</div>
            <div style="text-align: right;">Total (Rp)</div>
            <div></div>
          </div>
          <div id="order-services-list" style="padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; background: #ffffff;">
            <!-- Service rows dynamically populated -->
          </div>
        </div>
      </div>

      <!-- CARD 3: CATATAN & KALKULASI FINANSIAL -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 14px; height: 14px; color: #64748b;"></i> Catatan Khusus & Syarat Pengerjaan
          </label>
          <textarea name="notes" class="form-control" rows="6" placeholder="Instruksi toleransi presisi, perlakuan khusus, syarat termin pembayaran, dll...">${escapeAttr(typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(orderData?.notes || '') : (orderData?.notes || ''))}</textarea>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12.5px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="text-muted">Subtotal Produk/Jasa Utama:</span>
              <span id="order-main-items-total" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: #4338ca;">
              <span>Subtotal Jasa & Instalasi:</span>
              <span id="order-services-total" class="font-mono font-bold">+Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 4px; font-weight: 600;">
              <span>Total Nilai Pesanan:</span>
              <span id="order-items-total" class="font-mono">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; margin: 0; color: #16a34a; font-weight: 600;">
                <input type="checkbox" id="order-include-warranty" name="includeWarranty" ${orderData?.warrantyFee !== 0 ? 'checked' : ''} onchange="calculateOrderTotals()" style="cursor: pointer;">
                <span>+ Biaya Garansi (5%)</span>
              </label>
              <span id="order-warranty-fee" class="font-mono text-success" style="color: #16a34a; font-weight: 600;">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 4px; font-weight: 700;">
              <span class="text-main">Subtotal (Item + Garansi):</span>
              <span id="order-subtotal" class="font-mono text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="text-muted">Potongan / Diskon (Rp):</span>
              <input type="number" id="order-discount" name="discount" value="${orderData?.discount || 0}" min="0" style="width: 110px; height: 26px; padding: 2px 6px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px; text-align: right;" oninput="calculateOrderTotals()">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="text-muted">PPN (%):</span>
                <input type="number" id="order-tax-rate" name="taxRate" value="${orderData?.taxRate ?? 11}" min="0" max="100" style="width: 55px; height: 26px; padding: 2px 6px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px;" oninput="calculateOrderTotals()">
              </div>
              <span id="order-tax-amount" class="font-mono text-muted">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #0f172a; padding-top: 8px; font-size: 14.5px;">
              <span class="font-bold text-main">Grand Total:</span>
              <span id="order-grand-total" class="font-mono font-bold text-primary" style="font-size: 16.5px;">Rp 0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL FOOTER ACTIONS -->
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding-top: 16px; border-top: 1px solid var(--border-color); margin-top: 6px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" id="order-form-submit-btn" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600;">
          <i data-lucide="save"></i> ${isEdit ? 'Perbarui Order Penjualan' : 'Simpan Order Penjualan'}
        </button>
      </div>
    </form>
  `;

  const itemsContainer = document.getElementById('order-items-list');
  if (orderData && orderData.items && orderData.items.length > 0) {
    orderData.items.forEach(item => addOrderItemRow(item));
  } else {
    addOrderItemRow();
  }

  const servicesContainer = document.getElementById('order-services-list');
  if (orderData && orderData.additionalServices && orderData.additionalServices.length > 0) {
    orderData.additionalServices.forEach(svc => addOrderServiceRow(svc));
  }

  calculateOrderTotals();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// QUICK UPLOAD PO MODAL FOR ORDERS (PDF ONLY)
// -------------------------------------------------------------
function openUploadPOModal(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  const modalTitle = document.getElementById('form-modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = `<i data-lucide="file-text" style="color: #e11d48;"></i> Unggah Dokumen PO Pelanggan (PDF): ${orderId}`;
  }

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '600px';
    modalContainer.style.width = '90vw';
  }

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <div style="padding: 8px 4px;">
      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px;">
        <div style="font-weight: 700; color: #9f1239; font-size: 12.5px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i> Persyaratan Aktivasi Order
        </div>
        <p style="font-size: 11.5px; color: #881337; margin: 0; line-height: 1.4;">
          Unggah berkas Purchase Order resmi berformat <strong>PDF (*.pdf)</strong> dari pelanggan <strong>${escapeAttr(order.customerName)}</strong> untuk mengaktifkan seluruh aksi modul order (BOM/Jasa, Tim & PIC, Timeline, Detail, Edit, dan Hapus).
        </p>
      </div>

      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label font-bold" style="font-size: 12px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="file-type-2" style="color: #e11d48; width: 16px; height: 16px;"></i> Pilih Berkas Dokumen PO (Khusus PDF) *
        </label>
        <input type="file" id="direct-po-upload-input" accept=".pdf,application/pdf" class="form-control" onchange="handleDirectPOFileSelect(event)" style="padding: 10px;">
        <input type="hidden" id="direct-po-url">
        <input type="hidden" id="direct-po-name">
        <p style="font-size: 11px; color: var(--text-muted); margin: 6px 0 0 0;">
          * Hanya berkas berekstensi <strong>.pdf</strong> yang dapat diunggah.
        </p>
      </div>

      <div id="direct-po-preview-info" style="display: none; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 18px; align-items: center; gap: 8px;">
        <i data-lucide="file-check" style="color: #16a34a; width: 18px; height: 18px;"></i>
        <span style="font-size: 12px; font-weight: 600; color: #166534;" id="direct-po-name-display">File terpilih</span>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="button" class="btn btn-primary" style="background: #e11d48; border-color: #e11d48; font-weight: 600; padding: 8px 20px;" onclick="saveDirectUploadedPO('${orderId}')">
          <i data-lucide="check"></i> Simpan Dokumen PO
        </button>
      </div>
    </div>
  `;

  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function handleDirectPOFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Strict PDF Validation
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    showToast('Hanya file dokumen berformat PDF (*.pdf) yang diperbolehkan!', 'error');
    event.target.value = '';
    const previewInfo = document.getElementById('direct-po-preview-info');
    if (previewInfo) previewInfo.style.display = 'none';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const directPoUrl = document.getElementById('direct-po-url');
    const directPoName = document.getElementById('direct-po-name');
    const previewInfo = document.getElementById('direct-po-preview-info');
    const nameDisplay = document.getElementById('direct-po-name-display');

    if (directPoUrl) directPoUrl.value = e.target.result;
    if (directPoName) directPoName.value = file.name;
    if (nameDisplay) nameDisplay.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    if (previewInfo) previewInfo.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

async function saveDirectUploadedPO(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  const directPoUrl = document.getElementById('direct-po-url')?.value;
  const directPoName = document.getElementById('direct-po-name')?.value;

  if (!directPoUrl && !directPoName) {
    showToast('Harap pilih berkas PDF dokumen PO terlebih dahulu!', 'warning');
    return;
  }

  order.poFileUrl = directPoUrl;
  order.poFileName = directPoName;
  order.poDocument = {
    name: directPoName || 'PO-Pelanggan.pdf',
    url: directPoUrl,
    uploadedAt: new Date().toISOString()
  };

  // Otomatis aktifkan status order menjadi Accepted jika sebelumnya Pengajuan atau kosong
  if (!order.status || order.status === 'Pengajuan') {
    order.status = 'Accepted';
  }

  // Embed PO document metadata and data URL into order.notes for guaranteed persistence in Supabase
  if (typeof embedPOInNotes === 'function') {
    order.notes = embedPOInNotes(order.notes, order.poDocument);
  }

  // Update optimistik lokal langsung agar UI tabel dan tombol aksi langsung aktif seketika
  const localIdx = (state.orders || []).findIndex(o => o.id === orderId);
  if (localIdx !== -1) {
    state.orders[localIdx] = { ...state.orders[localIdx], ...order };
  }
  renderOrdersTable();
  updateSidebarBadges();

  try {
    // 1. Direct Native Supabase upsert (saves directly to Supabase PostgreSQL orders table)
    const directNativeCall = (typeof directSupabaseUpsertNativeRow === 'function')
      ? directSupabaseUpsertNativeRow('orders', order)
      : Promise.resolve();

    // 2. Direct Cloud Store sync to Supabase delivery table (__SYS_SYNC_orders__)
    const directSyncCall = (typeof directSupabaseSyncResource === 'function')
      ? directSupabaseSyncResource('orders', state.orders)
      : Promise.resolve();

    // 3. Server API PUT request
    const apiCall = fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    closeModal('form-modal');
    showToast(`✅ Dokumen PO Pelanggan untuk Order #${orderId} berhasil disimpan ke Supabase! Seluruh menu aksi telah aktif.`, 'success');

    await Promise.allSettled([directNativeCall, directSyncCall, apiCall]);

    // 4. Refresh resources dari Supabase
    await Promise.allSettled([
      fetchResource('orders'),
      fetchResource('quotations'),
      fetchResource('invoices'),
      fetchResource('projects')
    ]);

    const target = (state.orders || []).find(o => o.id === orderId);
    if (target) {
      if (!target.poDocument) target.poDocument = order.poDocument;
      if (!target.poFileUrl) target.poFileUrl = order.poFileUrl;
      if (!target.poFileName) target.poFileName = order.poFileName;
      if (typeof ensureOrderPOData === 'function') ensureOrderPOData(target);
    }
    renderOrdersTable();
    updateSidebarBadges();
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error saving direct PO:', err);
    showToast('Terjadi kesalahan jaringan saat menyimpan PO', 'error');
  }
}

function viewOrderPODocument(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  const poDoc = order.poDocument || (order.poFileUrl ? { name: order.poFileName || 'PO-Pelanggan.pdf', url: order.poFileUrl } : null);
  if (!poDoc || !poDoc.url) {
    showToast('Dokumen PO belum diunggah untuk order ini.', 'warning');
    return;
  }

  const modalTitle = document.getElementById('preview-modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = `<i data-lucide="file-text" style="color: #2563eb;"></i> Dokumen PO Pelanggan (PDF): ${orderId}`;
  }

  const content = document.getElementById('preview-modal-content');
  if (content) {
    content.innerHTML = `
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color);">
        <div>
          <strong>Berkas:</strong> ${escapeHtml(poDoc.name || 'Dokumen-PO.pdf')}
          ${poDoc.uploadedAt ? `<span class="text-muted font-sm" style="margin-left: 8px;">(Diunggah: ${poDoc.uploadedAt.split('T')[0]})</span>` : ''}
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="${poDoc.url}" download="${poDoc.name || 'PO-Pelanggan.pdf'}" class="btn btn-sm btn-outline" style="display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="download"></i> Download PO
          </a>
          <button type="button" class="btn btn-sm btn-primary" style="background: #e11d48; border-color: #e11d48;" onclick="closeModal('preview-modal'); openUploadPOModal('${orderId}')">
            <i data-lucide="upload-cloud"></i> Ganti File PO
          </button>
        </div>
      </div>
      <div style="height: 72vh; width: 100%; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; background: #525659;">
        <iframe src="${poDoc.url}" style="width: 100%; height: 100%; border: none;"></iframe>
      </div>
    `;
  }

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

function addOrderItemRow(item = null) {
  const container = document.getElementById('order-items-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 2.5fr) minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; align-items: center;';

  const defaultQty = item?.qty !== undefined ? item.qty : 1;
  const defaultPrice = item?.unitPrice !== undefined ? item.unitPrice : 0;
  const defaultTotal = item?.total !== undefined ? item.total : (defaultQty * defaultPrice);

  row.innerHTML = `
    <div>
      <input type="text" class="form-control item-name" placeholder="Nama barang / deskripsi produk" required value="${escapeAttr(item?.itemName || '')}">
    </div>
    <div>
      <input type="text" class="form-control item-sku" placeholder="SKU" value="${escapeAttr(item?.sku || '')}">
    </div>
    <div>
      <input type="number" class="form-control item-qty font-bold text-center" placeholder="1" min="1" step="any" required value="${defaultQty}" oninput="calculateOrderTotals()">
    </div>
    <div>
      <input type="text" class="form-control item-unit text-center" placeholder="Unit" value="${escapeAttr(item?.unit || 'Unit')}">
    </div>
    <div>
      <input type="number" class="form-control item-price font-mono" placeholder="0" required value="${defaultPrice}" oninput="calculateOrderTotals()">
    </div>
    <div>
      <input type="text" class="form-control item-total font-mono font-bold" readonly style="background: #f8fafc;" value="${formatRupiah(defaultTotal)}">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris" onclick="this.closest('.order-item-row').remove(); calculateOrderTotals();">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

function addOrderServiceRow(service = null) {
  const container = document.getElementById('order-services-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'order-service-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 2.8fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;';

  const defaultQty = service?.qty !== undefined ? service.qty : 1;
  const defaultPrice = service?.unitPrice !== undefined ? service.unitPrice : 0;
  const defaultTotal = service?.total !== undefined ? service.total : (defaultQty * defaultPrice);

  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm service-name" placeholder="Nama Jasa / Instalasi (misal: Instalasi, Setting, Commissioning)" required value="${escapeAttr(service?.serviceName || '')}">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm service-qty font-bold text-center" placeholder="1" min="1" step="any" required value="${defaultQty}" oninput="calculateOrderTotals()">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm service-unit text-center" placeholder="Lot" value="${escapeAttr(service?.unit || 'Lot')}">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm service-price font-mono" placeholder="0" required value="${defaultPrice}" oninput="calculateOrderTotals()">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm service-total font-mono font-bold" readonly style="background: #f8fafc; color: #4338ca;" value="${formatRupiah(defaultTotal)}">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris Jasa" onclick="this.closest('.order-service-row').remove(); calculateOrderTotals();">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

function calculateOrderTotals() {
  const itemRows = document.querySelectorAll('#order-items-list .order-item-row');
  let mainItemsTotal = 0;
  itemRows.forEach(r => {
    const qty = parseFloat(r.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.item-price')?.value) || 0;
    const total = qty * price;
    mainItemsTotal += total;
    const totalInput = r.querySelector('.item-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const serviceRows = document.querySelectorAll('#order-services-list .order-service-row');
  let servicesTotal = 0;
  serviceRows.forEach(r => {
    const qty = parseFloat(r.querySelector('.service-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.service-price')?.value) || 0;
    const total = qty * price;
    servicesTotal += total;
    const totalInput = r.querySelector('.service-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const itemsTotal = mainItemsTotal + servicesTotal;

  const warrantyCheck = document.getElementById('order-include-warranty');
  const hasWarranty = warrantyCheck ? warrantyCheck.checked : true;
  const warrantyFee = (hasWarranty && itemsTotal > 0) ? Math.round(itemsTotal * 0.05) : 0;
  const subtotal = itemsTotal + warrantyFee;

  const discountInput = document.getElementById('order-discount');
  const discount = Math.max(0, parseFloat(discountInput?.value) || 0);

  const taxableAmount = Math.max(0, subtotal - discount);

  const taxRate = parseFloat(document.getElementById('order-tax-rate')?.value) || 0;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100));
  const grandTotal = taxableAmount + taxAmount;

  const mainEl = document.getElementById('order-main-items-total');
  const svcEl = document.getElementById('order-services-total');
  const itemsEl = document.getElementById('order-items-total');
  const warrantyEl = document.getElementById('order-warranty-fee');
  const subEl = document.getElementById('order-subtotal');
  const taxEl = document.getElementById('order-tax-amount');
  const grandEl = document.getElementById('order-grand-total');

  if (mainEl) mainEl.textContent = formatRupiah(mainItemsTotal);
  if (svcEl) svcEl.textContent = (servicesTotal > 0 ? `+${formatRupiah(servicesTotal)}` : '+Rp 0');
  if (itemsEl) itemsEl.textContent = formatRupiah(itemsTotal);
  if (warrantyEl) warrantyEl.textContent = (warrantyFee > 0 ? `+${formatRupiah(warrantyFee)}` : 'Rp 0');
  if (subEl) subEl.textContent = formatRupiah(subtotal);
  if (taxEl) taxEl.textContent = formatRupiah(taxAmount);
  if (grandEl) grandEl.textContent = formatRupiah(grandTotal);

  return { mainItemsTotal, servicesTotal, itemsTotal, warrantyFee, subtotal, discount, taxRate, taxAmount, grandTotal };
}

async function submitOrder(e, editId = '') {
  e.preventDefault();

  // Guard: if editId is string 'undefined' or 'null', reset to empty string
  if (editId === 'undefined' || editId === 'null') {
    editId = '';
  }

  if (editId) {
    const existingForGuard = (state.orders || []).find(o => o.id === editId);
    if (existingForGuard) {
      const editAccess = canUserEditOrderRecord(existingForGuard);
      if (!editAccess.allowed) {
        showToast(editAccess.message, 'warning');
        return;
      }
    }
  }

  const form = e.target;
  const submitBtn = document.getElementById('order-form-submit-btn') || form.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.75';
    submitBtn.style.cursor = 'wait';
    submitBtn.innerHTML = `
      <span style="display:inline-flex; align-items:center; gap:8px;">
        <svg class="animate-spin" style="width: 15px; height: 15px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>${editId ? 'Memperbarui...' : 'Menyimpan...'}</span>
      </span>
    `;
  }

  const formData = new FormData(form);
  const quotationSelect = document.getElementById('order-quotation-select');
  const quotationId = formData.get('quotationId') || (quotationSelect ? quotationSelect.value : '') || '';
  const orderType = formData.get('orderType') || form.querySelector('input[name="orderType"]:checked')?.value || 'produk';

  // Item Pesanan Utama
  const items = [];
  document.querySelectorAll('#order-items-list .order-item-row').forEach(r => {
    const name = r.querySelector('.item-name')?.value?.trim();
    if (name) {
      items.push({
        itemName: name,
        sku: r.querySelector('.item-sku')?.value?.trim() || '',
        qty: parseFloat(r.querySelector('.item-qty')?.value) || 1,
        unit: r.querySelector('.item-unit')?.value?.trim() || (orderType === 'jasa' ? 'Lot' : 'Unit'),
        unitPrice: parseFloat(r.querySelector('.item-price')?.value) || 0,
        total: (parseFloat(r.querySelector('.item-qty')?.value) || 1) * (parseFloat(r.querySelector('.item-price')?.value) || 0)
      });
    }
  });

  if (items.length === 0) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      submitBtn.innerHTML = originalBtnHtml;
    }
    showToast('Harap tambahkan minimal 1 item produk/jasa pesanan utama!', 'warning');
    return;
  }

  // Jasa & Instalasi Tambahan (Non-BOM)
  const additionalServices = [];
  document.querySelectorAll('#order-services-list .order-service-row').forEach(r => {
    const serviceName = r.querySelector('.service-name')?.value?.trim();
    if (serviceName) {
      const qty = parseFloat(r.querySelector('.service-qty')?.value) || 1;
      const unit = r.querySelector('.service-unit')?.value?.trim() || 'Lot';
      const unitPrice = parseFloat(r.querySelector('.service-price')?.value) || 0;
      const total = qty * unitPrice;
      additionalServices.push({ serviceName, qty, unit, unitPrice, total });
    }
  });

  const totals = calculateOrderTotals();
  const existingOrder = editId ? (state.orders || []).find(o => o.id === editId) : null;
  const poFileUrl = formData.get('poFileUrl') || existingOrder?.poFileUrl || existingOrder?.poDocument?.url || '';
  const poFileName = formData.get('poFileName') || existingOrder?.poFileName || existingOrder?.poDocument?.name || '';

  const poDocument = (poFileUrl || poFileName) ? {
    name: poFileName || 'PO-Pelanggan.pdf',
    url: poFileUrl,
    uploadedAt: existingOrder?.poDocument?.uploadedAt || new Date().toISOString()
  } : (existingOrder?.poDocument || null);

  const isExistingDualApproved = Boolean(existingOrder && isOrderDualApproved(existingOrder));

  const payload = {
    quotationId: quotationId || existingOrder?.quotationId || '',
    orderType: orderType,
    quotationType: orderType,
    customerName: formData.get('customerName'),
    projectName: formData.get('projectName')?.trim() || '',
    customerPhone: formData.get('customerPhone'),
    customerAddress: formData.get('customerAddress'),
    orderDate: formData.get('orderDate'),
    dueDate: formData.get('dueDate'),
    status: !editId ? 'Pengajuan' : (isExistingDualApproved ? (existingOrder?.status || 'Accepted') : 'Pengajuan'),
    approvalKetuaUbm: editId ? (existingOrder?.approvalKetuaUbm || false) : false,
    approvalKetuaUbmBy: editId ? (existingOrder?.approvalKetuaUbmBy || null) : null,
    approvalKetuaUbmDate: editId ? (existingOrder?.approvalKetuaUbmDate || null) : null,
    approvalWadir1: editId ? (existingOrder?.approvalWadir1 || false) : false,
    approvalWadir1By: editId ? (existingOrder?.approvalWadir1By || null) : null,
    approvalWadir1Date: editId ? (existingOrder?.approvalWadir1Date || null) : null,
    notes: (typeof embedPOInNotes === 'function' && poDocument)
      ? embedPOInNotes(formData.get('notes'), poDocument)
      : formData.get('notes'),
    poDocument: poDocument,
    poFileUrl: poFileUrl,
    poFileName: poFileName,
    items,
    additionalServices,
    mainItemsTotal: totals.mainItemsTotal,
    servicesTotal: totals.servicesTotal,
    itemsTotal: totals.itemsTotal,
    warrantyFee: totals.warrantyFee,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxRate: totals.taxRate,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal
  };

  try {
    // Validasi pencegahan ganda konversi quotation saat membuat order baru
    if (!editId && quotationId) {
      const duplicateOrder = (state.orders || []).find(o => o.quotationId === quotationId || (o.notes && o.notes.includes(quotationId)));
      if (duplicateOrder) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
          submitBtn.innerHTML = originalBtnHtml;
        }
        showToast(`⚠️ Quotation ${quotationId} sudah pernah dikonversi ke Order Penjualan #${duplicateOrder.id}! Tidak bisa dikonversi ulang.`, 'warning');
        return;
      }
    }

    let res;
    if (editId) {
      res = await fetch(`/api/orders/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      const savedResult = await res.json().catch(() => ({}));
      const currentOrderId = editId || savedResult.id || payload.id;

      // Tutup modal secepatnya tanpa memblokir rendering
      closeModal('form-modal');

      // Optimistic update state.orders in memory
      if (currentOrderId) {
        const oIdx = (state.orders || []).findIndex(o => o.id === currentOrderId);
        if (oIdx !== -1) {
          state.orders[oIdx] = { ...state.orders[oIdx], ...payload, id: currentOrderId };
        } else if (!editId && savedResult.id) {
          state.orders.unshift(savedResult);
        }
      }

      // Optimistic update linked project in state.projects agar Surat Tugas & Timeline langsung tersinkron
      if (currentOrderId) {
        const linkedProj = (state.projects || []).find(p => p.orderId === currentOrderId || p.id === currentOrderId);
        if (linkedProj) {
          Object.assign(linkedProj, {
            projectName: payload.projectName,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            customerAddress: payload.customerAddress,
            orderDate: payload.orderDate,
            dueDate: payload.dueDate,
            notes: payload.notes,
            items: payload.items,
            additionalServices: payload.additionalServices,
            orderType: payload.orderType,
            poDocument: payload.poDocument,
            poFileName: payload.poFileName,
            poFileUrl: payload.poFileUrl,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Re-render UI seketika secara responsif dan ringan!
      if (typeof renderOrdersTable === 'function') {
        renderOrdersTable();
      }
      if (typeof renderQuotationsTable === 'function' && state.currentView === 'quotations') {
        renderQuotationsTable();
      }
      if (typeof renderProjectsTableView === 'function' && state.currentView === 'projects') {
        renderProjectsTableView();
      }
      updateSidebarBadges();

      showToast(editId ? 'Order penjualan berhasil diperbarui!' : 'Order penjualan baru berhasil disimpan!', 'success');

      // Jalankan sinkronisasi background secara silent dan non-blocking (tidak membebani UI)
      setTimeout(() => {
        if (typeof directSupabaseUpsertNativeRow === 'function' && currentOrderId) {
          directSupabaseUpsertNativeRow('orders', { id: currentOrderId, ...payload }).catch(() => {});
        }
        if (typeof directSupabaseSyncResource === 'function') {
          directSupabaseSyncResource('orders', state.orders).catch(() => {});
          directSupabaseSyncResource('projects', state.projects).catch(() => {});
        }
        Promise.allSettled([
          fetchResource('orders'),
          fetchResource('quotations'),
          fetchResource('invoices'),
          fetchResource('projects')
        ]).then(() => {
          if (typeof renderOrdersTable === 'function') renderOrdersTable();
          if (typeof renderQuotationsTable === 'function' && state.currentView === 'quotations') renderQuotationsTable();
          if (typeof renderProjectsTableView === 'function' && state.currentView === 'projects') renderProjectsTableView();
          updateSidebarBadges();
        }).catch(() => {});
      }, 50);

    } else {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.innerHTML = originalBtnHtml;
      }
      const errData = await res.json().catch(() => ({}));
      showToast(errData.error || errData.message || 'Gagal menyimpan order', 'error');
    }
  } catch (err) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      submitBtn.innerHTML = originalBtnHtml;
    }
    console.error('Error saving order:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

function viewOrderDetail(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  if (typeof ensureOrderPOData === 'function') ensureOrderPOData(order);

  const project = (state.projects || []).find(p => p.orderId === orderId);
  const orderBOMs = (state.bom || []).filter(b => b.orderId === orderId || (b.productName && order.items?.some(it => it.itemName.toLowerCase().includes(b.productName.toLowerCase()))));
  const acceptedBOM = orderBOMs.find(b => b.status === 'Accepted');
  const pengajuanBOM = orderBOMs.find(b => b.status === 'Pengajuan');
  const rejectedBOM = orderBOMs.find(b => b.status === 'Ditolak');
  const bom = acceptedBOM || pengajuanBOM || rejectedBOM || null;

  const todayStr = new Date().toISOString().split('T')[0];
  const milestones = project?.milestones || [];
  const hasTimeline = Array.isArray(milestones) && milestones.length > 0;
  const startDate = hasTimeline ? (project?.startDate || order.orderDate || '-') : '-';
  const dueDate = hasTimeline ? (project?.dueDate || order.dueDate || '-') : '-';

  // Calculate Progress & Health
  let progress = 0;
  if (hasTimeline) {
    if (typeof project?.progressPercent === 'number' && project.progressPercent > 0) {
      progress = project.progressPercent;
    } else {
      const completedMs = milestones.filter(m => m.status === 'Completed').length;
      const inProgressMs = milestones.filter(m => m.status === 'In Progress').length;
      progress = Math.min(100, Math.round(((completedMs + (inProgressMs * 0.5)) / milestones.length) * 100));
    }
  }

  const isCompleted = hasTimeline && (progress >= 100 || project?.status === 'Completed' || order.status === 'Delivered');
  const isOnHold = project?.status === 'On Hold' || (project?.notes && project.notes.toLowerCase().includes('kendala'));
  const isOverdue = hasTimeline && dueDate !== '-' && dueDate < todayStr && !isCompleted;

  const healthBadge = !hasTimeline ? 'badge-secondary' :
    isCompleted ? 'badge-success' :
      isOnHold ? 'badge-amber' :
        isOverdue ? 'badge-danger' : 'badge-purple';

  const healthText = !hasTimeline ? 'Belum Input Timeline' :
    isCompleted ? 'Completed (Selesai)' :
      isOnHold ? 'Ada Kendala / Hold' :
        isOverdue ? 'Overdue (Lewat Deadline)' : 'On Track (In Progress)';

  const team = project?.team || [];

  const isDualApproved = isOrderDualApproved(order);
  const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
  const isPOAndAccepted = isDualApproved && hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
  const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
  const hasBOM = Boolean(bom);
  const isBOMAccepted = Boolean(acceptedBOM);
  const isBOMDitolak = !acceptedBOM && !pengajuanBOM && Boolean(rejectedBOM);

  const penugasanBtnModal = isPOAndAccepted ?
    `<button type="button" class="btn btn-sm btn-outline" style="color: #4f46e5; border-color: #c7d2fe; font-size: 11.5px;" onclick="closeModal('preview-modal'); openTeamAssignmentPage('${order.id}')">
       <i data-lucide="users"></i> Penugasan Tim
     </button>` :
    `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="${!isDualApproved ? `promptDualApprovalRequired('${order.id}')` : `promptPenugasanDisabled('${order.id}')`}" title="${!isDualApproved ? '⚠️ Menunggu persetujuan Ketua UBM & Wadir I' : '⚠️ Wajib upload PO'}">
       <i data-lucide="users"></i> Penugasan Tim
     </button>`;

  const isService = isServiceOrder(order);
  const isAcceptedBOM = Boolean(acceptedBOM);
  const isBOMPengajuan = !acceptedBOM && Boolean(pengajuanBOM);

  let bomBtnModal = '';
  if (isService) {
    bomBtnModal = `
      <button type="button" class="btn btn-sm btn-outline" style="color: #059669; border-color: #a7f3d0; background: #ecfdf5; font-size: 11.5px;" onclick="showToast('Order Jasa/Layanan tidak memerlukan Bill of Materials (BOM).', 'info')">
        <i data-lucide="shield-check"></i> Non-BOM (Jasa)
      </button>
    `;
  } else if (isPOAndAccepted && hasProjectLead) {
    if (isBOMDitolak) {
      bomBtnModal = `
        <button type="button" class="btn btn-sm btn-outline" style="color: #dc2626; background: #fef2f2; border-color: #fca5a5; font-size: 11.5px;" onclick="closeModal('preview-modal'); createBOMFromOrder('${order.id}')">
          <i data-lucide="edit-3"></i> Edit BOM Ditolak
        </button>
      `;
    } else if (isAcceptedBOM) {
      bomBtnModal = `
        <button type="button" class="btn btn-sm btn-outline" style="color: #059669; border-color: #a7f3d0; font-size: 11.5px;" onclick="closeModal('preview-modal'); createBOMFromOrder('${order.id}')">
          <i data-lucide="shield-check"></i> Lihat BOM (Accepted)
        </button>
      `;
    } else if (hasBOM) {
      bomBtnModal = `
        <button type="button" class="btn btn-sm btn-outline" style="color: #d97706; border-color: #fde68a; font-size: 11.5px;" onclick="closeModal('preview-modal'); createBOMFromOrder('${order.id}')">
          <i data-lucide="boxes"></i> Lihat BOM (Pengajuan)
        </button>
      `;
    } else {
      bomBtnModal = `
        <button type="button" class="btn btn-sm btn-outline" style="color: #2563eb; border-color: #bfdbfe; font-size: 11.5px;" onclick="closeModal('preview-modal'); createBOMFromOrder('${order.id}')">
          <i data-lucide="boxes"></i> + Buat BOM
        </button>
      `;
    }
  } else {
    bomBtnModal = `
      <button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="${!isDualApproved ? `promptDualApprovalRequired('${order.id}')` : `promptBOMDisabled('${order.id}')`}" title="${!isDualApproved ? '⚠️ Menunggu persetujuan Ketua UBM & Wadir I' : '⚠️ Wajib tentukan Project Leader terlebih dahulu'}">
        <i data-lucide="boxes"></i> + Buat BOM
      </button>
    `;
  }

  let timelineBtnModal = '';
  let ganttBtnModal = '';

  if (isService) {
    timelineBtnModal = isPOAndAccepted ?
      `<button type="button" class="btn btn-sm btn-primary" style="background: #ea580c; border-color: #ea580c; font-size: 11.5px; font-weight: 700; color: #ffffff;" onclick="closeModal('preview-modal'); openServiceExpenseModal('${order.id}')">
         <i data-lucide="car"></i> Pengajuan Transport & Uang Makan Jasa
       </button>` :
      `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="${!isDualApproved ? `promptDualApprovalRequired('${order.id}')` : `promptPOAndAcceptedRequired('${order.id}')`}" title="${!isDualApproved ? '⚠️ Menunggu persetujuan Ketua UBM & Wadir I' : '⚠️ Wajib upload PO Pelanggan'}">
         <i data-lucide="car"></i> Pengajuan Transport & Uang Makan Jasa
       </button>`;
  } else {
    const hasValidBOM = hasBOM && !isBOMDitolak;
    const activeUserOrderModal = typeof getAuthUser === 'function' ? getAuthUser() : null;
    const roleNameOrderModal = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUserOrderModal) : (activeUserOrderModal?.role || 'Member');
    const canEditTimelineModal = typeof canUserEditProjectTimeline === 'function'
      ? canUserEditProjectTimeline(order.id, activeUserOrderModal)
      : (roleNameOrderModal === 'Administrator' || isStrictProjectLeadForOrder(order, activeUserOrderModal));
    const timelineBtnLabel = canEditTimelineModal ? 'Timeline & Milestone' : 'Lihat Timeline & Milestone';
    timelineBtnModal = (isPOAndAccepted && hasProjectLead && hasValidBOM) ?
      `<button type="button" class="btn btn-sm btn-primary" style="background: #4f46e5; border-color: #4f46e5; font-size: 11.5px;" onclick="closeModal('preview-modal'); openProjectTimelinePage('${order.id}')">
         <i data-lucide="folder-kanban"></i> ${timelineBtnLabel}
       </button>` :
      `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="${!isDualApproved ? `promptDualApprovalRequired('${order.id}')` : `promptProjectManagementDisabled('${order.id}')`}" title="${!isDualApproved ? '⚠️ Menunggu persetujuan Ketua UBM & Wadir I' : isBOMDitolak ? '⚠️ Formula BOM Ditolak' : '⚠️ Wajib isi BOM terlebih dahulu'}">
         <i data-lucide="folder-kanban"></i> ${timelineBtnLabel}
       </button>`;

    const projForOrder = (state.projects || []).find(p => p.orderId === order.id);
    const projMilestones = projForOrder?.milestones || [];
    const hasInProgressMsOrder = projMilestones.some(m => m.status === 'In Progress' || m.status === 'in_progress' || m.status === 'Completed' || m.status === 'completed');

    ganttBtnModal = (isPOAndAccepted && hasProjectLead && hasValidBOM && hasInProgressMsOrder) ?
      `<button type="button" class="btn btn-sm btn-outline" style="font-size: 11.5px;" onclick="closeModal('preview-modal'); openGanttDetailModal('${order.id}')">
         <i data-lucide="bar-chart-2"></i> Gantt Chart
       </button>` :
      `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="${!isDualApproved ? `promptDualApprovalRequired('${order.id}')` : `showToast('⚠️ Gantt Chart belum dapat dibuka karena belum ada milestone yang berstatus In Progress!', 'warning')`}" title="${!isDualApproved ? '⚠️ Menunggu persetujuan Ketua UBM & Wadir I' : !hasInProgressMsOrder ? '⚠️ Milestone belum ada yang In Progress' : '⚠️ Wajib isi data pengerjaan & Penugasan Tim'}">
         <i data-lucide="bar-chart-2"></i> Gantt Chart
       </button>`;
  }

  const modalEditAccess = canUserEditOrderRecord(order);
  const editBtnModal = modalEditAccess.allowed ?
    `<button type="button" class="btn btn-sm btn-outline" style="font-size: 11.5px;" onclick="closeModal('preview-modal'); editOrder('${order.id}')">
       <i data-lucide="edit-2"></i> Edit Order
     </button>` :
    (isDualApproved ?
      `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="showToast('🔒 Order Penjualan ini sudah disetujui lengkap oleh Ketua UBM dan Wakil Direktur I sehingga tidak dapat diedit oleh role apapun!', 'warning')" title="🔒 Terkunci: Sudah disetujui Ketua UBM & Wadir I">
         <i data-lucide="lock"></i> Edit Terkunci
       </button>` : '');

  const suratTugasBtnModal = (isDualApproved && hasProjectLead) ?
    `<button type="button" class="btn btn-sm btn-outline" style="color: #4338ca; border-color: #c7d2fe; font-size: 11.5px;" onclick="closeModal('preview-modal'); if (typeof exportTeamAssignmentLetterPDF === 'function') exportTeamAssignmentLetterPDF('${order.id}');" title="Cetak / Preview Surat Tugas Resmi">
       <i data-lucide="printer"></i> Surat Tugas
     </button>` :
    `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="${!isDualApproved ? `promptDualApprovalRequired('${order.id}')` : `showToast('⚠️ Tentukan Project Leader terlebih dahulu!', 'warning')`}" title="${!isDualApproved ? '⚠️ Menunggu persetujuan Ketua UBM & Wadir I' : '⚠️ Tentukan Project Leader terlebih dahulu'}">
       <i data-lucide="printer"></i> Surat Tugas
     </button>`;

  const content = document.getElementById('preview-modal-content') || document.getElementById('preview-modal-body');
  if (!content) return;
  content.innerHTML = `
    <div class="doc-preview">
      <!-- HEADER & TOP ACTION BUTTONS -->
      <div class="doc-header no-print" style="margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div class="company-name" style="font-size: 15px; font-weight: 800; color: #0f172a;">Unit Bisnis Mandiri Politeknik Takumi</div>
          <div class="text-muted font-sm">Engineering, Manufacturing, & Automation Solutions</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${editBtnModal}
          ${penugasanBtnModal}
          ${suratTugasBtnModal}
          ${bomBtnModal}
          ${timelineBtnModal}
          ${ganttBtnModal}
        </div>
      </div>

      <!-- DUAL APPROVAL STATUS BANNER -->
      <div style="margin-bottom: 16px; padding: 10px 14px; border-radius: 6px; ${isDualApproved ? 'background: #f0fdf4; border: 1px solid #bbf7d0;' : 'background: #fffbeb; border: 1px solid #fde68a;'} display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i data-lucide="${isDualApproved ? 'check-check' : 'clock'}" style="width: 18px; height: 18px; color: ${isDualApproved ? '#16a34a' : '#d97706'};"></i>
          <div>
            <div style="font-weight: 700; font-size: 12px; color: ${isDualApproved ? '#15803d' : '#92400e'};">
              ${isDualApproved ? 'Status Persetujuan: Disetujui Lengkap (Terkunci Permanen)' : 'Status Persetujuan: Menunggu Persetujuan Lengkap'}
            </div>
            <div style="font-size: 10.5px; color: ${isDualApproved ? '#166534' : '#b45309'}; margin-top: 1px;">
              Ketua UBM: ${order.approvalKetuaUbm ? `✅ Disetujui (${order.approvalKetuaUbmBy || 'Ketua UBM'})` : '⏳ Menunggu Persetujuan'} &bull;
              Wakil Direktur I: ${order.approvalWadir1 ? `✅ Disetujui (${order.approvalWadir1By || 'Wadir I'})` : '⏳ Menunggu Persetujuan'}
            </div>
          </div>
        </div>
        <span class="badge" style="${isDualApproved ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;' : 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;'} font-weight: 700; font-size: 11px;">
          ${isDualApproved ? '✓ Disetujui (2/2)' : `⏳ Menunggu (${(order.approvalKetuaUbm ? 1 : 0) + (order.approvalWadir1 ? 1 : 0)}/2)`}
        </span>
      </div>
        </div>
      </div>

      <!-- TITLE & ORDER IDENTITY -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px;">
        <div>
          <h2 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0;">DETAIL ORDER & PROJECT MANAGEMENT</h2>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span class="mono-id font-bold text-primary" style="font-size: 14px;">${order.id}</span>
            <span class="badge ${isService ? 'badge-info' : 'badge-secondary'}" style="font-weight: 700;">${isService ? '🛠️ Jasa (Non-BOM)' : '📦 Produk Manufaktur'}</span>
            <span class="badge ${order.status === 'Confirmed' ? 'badge-info' : order.status === 'In Production' ? 'badge-purple' : 'badge-success'}">${order.status}</span>
            <span class="badge ${healthBadge}">${healthText}</span>
          </div>
        </div>
        <div class="text-right">
          <div class="font-sm text-muted">Tanggal Order: <strong>${order.orderDate}</strong></div>
          <div class="font-sm text-muted">Target Selesai: <strong>${order.dueDate || '-'}</strong></div>
        </div>
      </div>

      <!-- SECTION 1: PROJECT MANAGEMENT & TIMELINE BANNER -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="folder-kanban" style="color: #4f46e5; width: 16px; height: 16px;"></i> Penugasan Tim & Status Project
          </h4>
          <span class="font-bold text-primary" style="font-size: 12.5px;">Progress: ${progress}% Selesai</span>
        </div>

        <!-- Progress Bar -->
        <div style="width: 100%; height: 9px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 14px;">
          <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #6366f1, #10b981); border-radius: 999px;"></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; font-size: 12px;">
          <div>
            <span class="text-muted font-bold">Project Lead / PIC:</span>
            <div class="font-bold text-main" style="font-size: 13px;">${project?.projectLead || '<span class="text-warning">Belum diassign</span>'}</div>
            <div class="text-muted font-sm">${project?.department || 'Divisi Pelaksana'}</div>
          </div>
          <div>
            <span class="text-muted font-bold">Timeline Pengerjaan:</span>
            <div class="font-bold text-main">${hasTimeline ? `${startDate} &rarr; ${dueDate}` : '<span class="text-muted">Belum diinput di Project Management</span>'}</div>
            <div class="text-muted font-sm">${!hasTimeline ? '<span class="text-muted">Silakan klik tombol Timeline & Milestone</span>' : isCompleted ? '<span class="text-success">Selesai 100%</span>' : isOverdue ? '<span class="text-danger font-bold">Overdue / Terlambat</span>' : '<span class="text-primary">Dalam Pengerjaan</span>'}</div>
          </div>
          <div>
            <span class="text-muted font-bold">${isService ? 'Tipe Pengerjaan:' : 'Formula BOM Terkait:'}</span>
            <div>${isService ? '<span class="badge badge-info" style="font-size: 11px;">🛠️ Jasa / Layanan (Non-BOM)</span>' : (bom ? `<span class="badge badge-purple" style="font-size: 11px;">${bom.id} (${bom.productName})</span>` : '<span class="badge badge-secondary">Belum dibuat BOM</span>')}</div>
          </div>
        </div>

        <!-- Team Members Pill Badges -->
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
          <span class="text-muted font-bold" style="font-size: 11px; display: block; margin-bottom: 6px;">Anggota Tim Pelaksana (${team.length} Orang):</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${team.length > 0 ? team.map(m => `
              <span style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 999px; padding: 3px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 5px;">
                <i data-lucide="user" style="width: 12px; height: 12px; color: #4f46e5;"></i>
                <strong>${m.name}</strong> <span class="text-muted">(${m.role || 'Member'})</span>
              </span>
            `).join('') : '<span class="text-muted font-sm">Belum ada tim yang didaftarkan.</span>'}
          </div>
        </div>
      </div>

      <!-- SECTION 2: TIMELINE MILESTONES (IF ANY) -->
      ${milestones.length > 0 ? `
        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="calendar-check" style="color: #10b981; width: 16px; height: 16px;"></i> Tahapan Kerja & Milestone Project
          </h4>
          <table class="doc-table" style="margin-bottom: 0;">
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th>Tahapan Kerja / Milestone</th>
                <th>Dari Tanggal</th>
                <th>Sampai Tanggal</th>
                <th>PIC Tahap</th>
                <th style="width: 100px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${milestones.map((ms, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="font-bold">${ms.title}</td>
                  <td>${ms.startDate || '-'}</td>
                  <td>${ms.dueDate || '-'}</td>
                  <td>${ms.pic || '-'}</td>
                  <td class="text-center">
                    <span class="badge ${ms.status === 'Completed' ? 'badge-success' : ms.status === 'In Progress' ? 'badge-purple' : 'badge-secondary'}" style="font-size: 10.5px;">${ms.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- SECTION 3: INFORMASI PELANGGAN & ITEM PESANAN -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; padding: 14px; background: #f8fafc; border-radius: 6px;">
        <div>
          <div class="font-sm font-bold text-muted">DATA PELANGGAN:</div>
          <div class="font-bold text-main" style="font-size: 14px;">${order.customerName}</div>
          <div>${order.customerPhone || '-'}</div>
          <div class="font-sm text-muted">${order.customerAddress || '-'}</div>
        </div>
        <div class="text-right">
          <div class="font-sm font-bold text-muted">RINGKASAN TOTAL ORDER:</div>
          <div class="font-mono font-bold text-primary" style="font-size: 18px;">${formatRupiah(order.grandTotal)}</div>
          <div class="font-sm text-muted">Jumlah Item: <strong>${order.items?.length || 0} Barang</strong></div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0;">Daftar Item Barang & Jasa Dipesan</h4>
      <table class="doc-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Deskripsi Barang / Jasa</th>
            <th>Kode / SKU</th>
            <th class="text-center">Qty</th>
            <th class="text-center">Satuan</th>
            <th class="text-right">Harga Satuan</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(order.items || []).map((it, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td class="font-bold">${escapeHtml(it.itemName)}</td>
              <td class="mono-id font-sm">${escapeHtml(it.sku || '-')}</td>
              <td class="text-center font-bold">${it.qty}</td>
              <td class="text-center">${escapeHtml(it.unit || 'Unit')}</td>
              <td class="text-right">${formatRupiah(it.unitPrice)}</td>
              <td class="text-right font-bold">${formatRupiah(it.total || (it.qty * it.unitPrice))}</td>
            </tr>
          `).join('')}
          ${(order.additionalServices && order.additionalServices.length > 0) ? `
            <tr style="background: #f8fafc;">
              <td colspan="7" style="padding: 6px 8px; font-weight: 700; font-size: 10.5px; color: #4338ca; text-transform: uppercase;">
                Rincian Jasa, Instalasi & Layanan Tambahan (Keterangan Non-BOM)
              </td>
            </tr>
            ${order.additionalServices.map((svc, sIdx) => `
              <tr>
                <td>${(order.items?.length || 0) + sIdx + 1}</td>
                <td class="font-bold" style="color: #3730a3;">
                  <div>${escapeHtml(svc.serviceName)}</div>
                  <div class="font-sm text-muted font-xs">Jasa / Instalasi / Commissioning</div>
                </td>
                <td class="mono-id font-sm">-</td>
                <td class="text-center font-bold">${svc.qty}</td>
                <td class="text-center">${escapeHtml(svc.unit || 'Lot')}</td>
                <td class="text-right">${formatRupiah(svc.unitPrice)}</td>
                <td class="text-right font-bold">${formatRupiah(svc.total || (svc.qty * svc.unitPrice))}</td>
              </tr>
            `).join('')}
          ` : ''}
        </tbody>
      </table>

      <!-- KALKULASI FINANSIAL ORDER -->
      <div class="doc-totals">
        <div class="calc-summary" style="margin-left: auto; width: 340px;">
          ${(order.servicesTotal > 0 || (order.additionalServices && order.additionalServices.length > 0)) ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 2px 0;">
              <span>Subtotal Produk Utama:</span>
              <span class="font-mono">${formatRupiah(order.mainItemsTotal !== undefined ? order.mainItemsTotal : (order.items || []).reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0))}</span>
            </div>
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 2px 0; color: #4338ca;">
              <span>Subtotal Jasa & Instalasi:</span>
              <span class="font-mono">+${formatRupiah(order.servicesTotal !== undefined ? order.servicesTotal : (order.additionalServices || []).reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0))}</span>
            </div>
          ` : ''}
          ${order.itemsTotal !== undefined ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 2px 0; font-weight: 600;">
              <span>Total Produk & Jasa:</span>
              <span class="font-mono">${formatRupiah(order.itemsTotal)}</span>
            </div>
          ` : ''}
          ${order.warrantyFee > 0 ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 2px 0; color: #16a34a; font-weight: 600;">
              <span>+ Biaya Garansi (5%):</span>
              <span class="font-mono">+${formatRupiah(order.warrantyFee)}</span>
            </div>
          ` : ''}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 2px 0; font-weight: 700; border-top: 1px dashed #cbd5e1;">
            <span>Subtotal (Item + Garansi):</span>
            <span class="font-mono">${formatRupiah(order.subtotal)}</span>
          </div>
          ${order.discount > 0 ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 2px 0; color: #ef4444;">
              <span>Potongan / Diskon:</span>
              <span class="font-mono">- ${formatRupiah(order.discount)}</span>
            </div>
          ` : ''}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 2px 0;">
            <span>PPN (${order.taxRate || 11}%):</span>
            <span class="font-mono">${formatRupiah(order.taxAmount)}</span>
          </div>
          <div class="calc-row total" style="border-top: 2px solid #0f172a; padding-top: 6px; font-size: 13.5px; display: flex; justify-content: space-between; font-weight: 700;">
            <span>Grand Total:</span>
            <span class="font-mono text-primary">${formatRupiah(order.grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- DOKUMEN PO STATUS CARD -->
      ${hasPO ? `
        <div class="mt-3 p-3 rounded font-sm" style="background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: #166534; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="file-check" style="width: 16px; height: 16px;"></i> Dokumen PO Pelanggan Terlampir
            </div>
            <div class="text-muted font-xs" style="margin-top: 2px;">
              Berkas: <strong>${escapeHtml(order.poDocument?.name || order.poFileName || 'PO-Pelanggan.pdf')}</strong>
              ${order.poDocument?.uploadedAt ? ` &bull; Diunggah: ${order.poDocument.uploadedAt.split('T')[0]}` : ''}
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-outline" style="color: #059669; border-color: #a7f3d0; background: #ffffff; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="viewOrderPODocument('${order.id}')">
            <i data-lucide="eye"></i> Buka Dokumen PO
          </button>
        </div>
      ` : `
        <div class="mt-3 p-3 rounded font-sm" style="background: #fff1f2; border: 1px solid #fecdd3; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: #9f1239; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i> Dokumen PO Pelanggan Belum Diunggah
            </div>
            <div class="font-xs" style="color: #881337; margin-top: 2px;">
              Unggah berkas PDF PO untuk mengaktifkan seluruh aksi modul order & project.
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-primary" style="background: #e11d48; border-color: #e11d48; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="closeModal('preview-modal'); openUploadPOModal('${order.id}')">
            <i data-lucide="upload-cloud"></i> Upload PO Sekarang
          </button>
        </div>
      `}

      ${(order.notes && (typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(order.notes) : order.notes)) ? `
        <div class="mt-3 p-3 bg-light rounded font-sm">
          <strong>Catatan Khusus:</strong><br>
          ${escapeHtml(typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(order.notes) : order.notes)}
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 18px; border-top: 1px dashed #cbd5e1; text-align: center;">
        <div>
          <div class="font-sm text-muted">Dipesan Oleh (Customer),</div>
          <div style="margin-top: 45px; font-weight: bold;">( ${order.customerName} )</div>
        </div>
        <div>
          <div class="font-sm text-muted">Diterima & Disetujui Oleh,</div>
          <div style="margin-top: 45px; font-weight: bold;">( Sales & Production UBM )</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

function editOrder(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;
  const editAccess = canUserEditOrderRecord(order);
  if (!editAccess.allowed) {
    showToast(editAccess.message, 'warning');
    return;
  }
  openOrderModal(order);
}

// Global Window Exports
window.isOrderDualApproved = isOrderDualApproved;
window.promptDualApprovalRequired = promptDualApprovalRequired;
window.approveOrderByRole = approveOrderByRole;
window.rejectOrderByRole = rejectOrderByRole;
window.calculateAutoOrderStatus = calculateAutoOrderStatus;
window.renderOrdersTable = renderOrdersTable;
window.openOrderModal = openOrderModal;
window.viewOrderDetail = viewOrderDetail;
window.editOrder = editOrder;
