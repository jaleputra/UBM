// =========================================================
// UBM - Orders Module (Order Penjualan / Sales Order)
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

// Menghitung status order secara otomatis sesuai posisi tahapan pengerjaan
function calculateAutoOrderStatus(order) {
  if (!order) return 'Pengajuan';
  // 1. Jika masih tahap Pengajuan (menunggu disetujui via tabel), tetap Pengajuan
  if (order.status === 'Pengajuan' || !order.status) {
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

  // 6. Posisi Awal setelah disetujui dari Pengajuan: Accepted (Menunggu upload PO Pelanggan)
  return 'Accepted';
}

function renderOrdersTable() {
  const tbody = document.getElementById('table-orders-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-order-status')?.value || document.getElementById('order-status-filter')?.value || 'ALL';
  let list = state.orders || [];

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
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted" style="padding: 28px;">Tidak ada data order penjualan ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(order => {
    const isPengajuan = order.status === 'Pengajuan';
    const isAccepted = order.status === 'Accepted';
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

    // Dokumen PO Column: View PO (Hijau) jika sudah upload, Upload PO (Merah) jika belum
    const poColumnHtml = hasPO ?
      `<button type="button" class="btn btn-xs btn-outline" style="color: #059669; border-color: #a7f3d0; background: #ecfdf5; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; padding: 2.5px 6px; white-space: nowrap;" onclick="event.stopPropagation(); viewOrderPODocument('${order.id}')" title="Klik untuk menampilkan dokumen PO Pelanggan (PDF)">
         <i data-lucide="eye" style="width: 11px; height: 11px;"></i> View PO
       </button>` :
      `<button type="button" class="btn btn-xs btn-primary" style="background: #e11d48; border-color: #e11d48; font-size: 10px; font-weight: 700; padding: 2.5px 6px; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap;" onclick="event.stopPropagation(); openUploadPOModal('${order.id}')" title="Wajib upload PO Pelanggan (PDF)">
         <i data-lucide="upload-cloud" style="width: 11px; height: 11px;"></i> Upload PO
       </button>`;

    // Syarat akses berjenjang (Sequential Workflow Pipeline):
    // 1. PO sudah diupload DAN status sudah Accepted
    const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
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

    // Tombol 1: Penugasan Tim (Aktif pertama kali setelah PO diupload & status Accepted)
    const btnPenugasan = isPOAndAccepted ?
      `<button class="btn-icon" style="color: #4f46e5;" title="Penugasan Tim & PIC (Project Leader)" onclick="event.stopPropagation(); openTeamAssignmentPage('${order.id}')"><i data-lucide="users"></i></button>` :
      `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Wajib upload PO Pelanggan dan status Accepted untuk mengakses Penugasan Tim" onclick="event.stopPropagation(); promptPenugasanDisabled('${order.id}')"><i data-lucide="users"></i></button>`;

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
    } else {
      btnBOM = `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="${!isPOAndAccepted ? '⚠️ Wajib upload PO Pelanggan dan status Accepted terlebih dahulu' : '⚠️ Tentukan Project Leader terlebih dahulu pada Penugasan Tim sebelum mengisi BOM'}" onclick="event.stopPropagation(); promptBOMDisabled('${order.id}')"><i data-lucide="boxes"></i></button>`;
    }

    // Tombol 3: Project Management (Untuk Jasa: aktif jika PO Accepted & Project Lead ada. Untuk Produk: wajib BOM valid)
    const hasValidBOM = isService || (hasBOM && !isBOMDitolak);
    const isProjectActiveAllowed = isPOAndAccepted && hasProjectLead && hasValidBOM;
    const btnProject = isProjectActiveAllowed ?
      `<button class="btn-icon" style="color: #8b5cf6;" title="Project Management (Timeline & Milestone)" onclick="event.stopPropagation(); openProjectTimelinePage('${order.id}')"><i data-lucide="folder-kanban"></i></button>` :
      `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="${!isPOAndAccepted ? '⚠️ Wajib upload PO Pelanggan dan status Accepted terlebih dahulu' : (!hasProjectLead ? '⚠️ Tentukan Project Leader pada Penugasan Tim terlebih dahulu' : (isBOMDitolak ? '⚠️ Formula BOM Ditolak. Harap perbaiki dan ajukan ulang BOM terlebih dahulu.' : '⚠️ Isi dan simpan Bill of Materials (BOM) terlebih dahulu sebelum membuat Project Management'))}" onclick="event.stopPropagation(); promptProjectManagementDisabled('${order.id}')"><i data-lucide="folder-kanban"></i></button>`;

    // Tombol 4: Hapus Order
    const btnDelete = isPOAndAccepted ?
      `<button class="btn-icon btn-danger-ghost" title="Hapus Order" onclick="event.stopPropagation(); deleteResource('orders', '${order.id}')"><i data-lucide="trash-2"></i></button>` :
      `<button class="btn-icon" style="color: #94a3b8; cursor: not-allowed; opacity: 0.35;" title="⚠️ Wajib upload PO Pelanggan dan status Accepted untuk menghapus Order" onclick="event.stopPropagation(); promptPOAndAcceptedRequired('${order.id}')"><i data-lucide="trash-2"></i></button>`;

    // Action Buttons: Penugasan -> BOM -> Project Management -> Hapus
    const actionsHtml = `
      <div class="table-actions" onclick="event.stopPropagation()">
        ${btnPenugasan}
        ${btnBOM}
        ${btnProject}
        ${btnDelete}
      </div>
    `;

    // Status Column: Jika status sudah Accepted (atau status pengerjaan lanjutan), kunci permanen dan tidak bisa diubah lagi
    const isStatusLocked = order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status);

    let statusSelectHtml = '';
    if (isStatusLocked) {
      statusSelectHtml = `
        <div style="display: flex; justify-content: center; width: 100%;">
          <span class="badge badge-success" style="font-size: 10px; font-weight: 700; padding: 3.5px 8px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px; background: #dcfce7; color: #15803d; border: 1px solid #86efac; cursor: default;" title="Status Order: Accepted (Terkunci Permanen)">
            <i data-lucide="check-circle-2" style="width: 11px; height: 11px;"></i> Accepted
          </span>
        </div>
      `;
    } else {
      // Masih berstatus Pengajuan: dapat dipilih untuk diubah menjadi Accepted
      statusSelectHtml = `
        <div style="display: flex; justify-content: center; width: 100%;" onclick="event.stopPropagation()">
          <select class="order-status-select status-pengajuan"
                  onclick="event.stopPropagation()"
                  onchange="updateOrderStatusDirect('${order.id}', this.value)"
                  title="Klik untuk menyetujui / mengubah status menjadi Accepted">
            <option value="Pengajuan" selected>🟡 Pengajuan</option>
            <option value="Accepted">🟢 Accepted</option>
          </select>
        </div>
      `;
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
          ${statusSelectHtml}
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
// 1 OPSI DARI PENGAJUAN MENJADI ACCEPTED PADA TABEL (DROPDOWN)
// -------------------------------------------------------------
async function updateOrderStatusDirect(orderId, newStatus = 'Accepted') {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  // Jika status sudah Accepted atau status pengerjaan lanjutan, tolak perubahan (terkunci permanen)
  if (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status)) {
    showToast(`Status Order #${orderId} sudah "Accepted" dan tidak dapat diubah lagi.`, 'warning');
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

    // Jika diubah menjadi Accepted, sinkronkan juga Quotation terkait dan Faktur Tagihan (Invoice)
    if (newStatus === 'Accepted') {
      if (typeof syncAcceptedOrdersToInvoices === 'function') {
        syncAcceptedOrdersToInvoices();
      }

      const quoRef = order.quotationId || (order.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]);
      if (quoRef) {
        const targetQuo = (state.quotations || []).find(q => q.id === quoRef);
        if (targetQuo && targetQuo.status !== 'Accepted') {
          targetQuo.status = 'Accepted';
          fetch(`/api/quotations/${quoRef}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...targetQuo, status: 'Accepted' })
          }).catch(e => console.warn('Sync quotation status error:', e));

          if (typeof renderQuotationsTable === 'function') {
            renderQuotationsTable();
          }
        }
      }
    }

    showToast(`Status Order #${orderId} berhasil diubah menjadi "${newStatus}" dan telah terkunci permanen.`, 'success');
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

  if (!hasPO && order?.status === 'Pengajuan') {
    showToast('⚠️ Unggah dokumen PO Pelanggan dan ubah status menjadi "Accepted" terlebih dahulu untuk mengaktifkan Penugasan Tim!', 'warning');
    openUploadPOModal(orderId);
  } else if (!hasPO) {
    showToast('⚠️ Unggah dokumen PO Pelanggan terlebih dahulu untuk mengaktifkan Penugasan Tim!', 'warning');
    openUploadPOModal(orderId);
  } else if (order?.status === 'Pengajuan' || order?.status !== 'Accepted') {
    showToast('⚠️ Status order masih "Pengajuan". Ubah status menjadi "Accepted" pada tabel untuk membuka menu Penugasan Tim!', 'warning');
  }
}

function promptBOMDisabled(orderId) {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (isServiceOrder(order)) {
    showToast('💡 Order ini bertipe Jasa/Layanan dan tidak memerlukan Bill of Materials (BOM). Alur langsung ke Penugasan Tim & Project Management.', 'info');
    return;
  }
  const hasPO = Boolean(order?.poDocument?.url || order?.poFileUrl || order?.poDocument?.name || order?.poFileName);
  const isAccepted = order?.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order?.status);

  if (!hasPO || !isAccepted) {
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
  const order = (state.orders || []).find(o => o.id === orderId);
  const isService = isServiceOrder(order);
  const hasPO = Boolean(order?.poDocument?.url || order?.poFileUrl || order?.poDocument?.name || order?.poFileName);
  const isAccepted = order?.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order?.status);

  if (!hasPO || !isAccepted) {
    promptPenugasanDisabled(orderId);
    return;
  }

  const project = (state.projects || []).find(p => p.orderId === orderId);
  const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');

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

  if (form.customerName) form.customerName.value = quo.customerName || '';
  if (form.projectName) form.projectName.value = quo.projectName || (quo.items?.[0]?.itemName || '');
  if (form.customerPhone) form.customerPhone.value = quo.customerPhone || '';
  if (form.customerAddress) form.customerAddress.value = quo.customerAddress || '';
  if (form.dueDate && quo.validUntil) form.dueDate.value = quo.validUntil;

  let serviceNotes = '';
  if (quo.additionalServices && quo.additionalServices.length > 0) {
    serviceNotes = '\n\n[KETERANGAN JASA & INSTALASI (NON-BOM)]:\n' +
      quo.additionalServices.map((s, idx) => `${idx + 1}. ${s.serviceName} (${s.qty} ${s.unit || 'Lot'} @ ${formatRupiah(s.unitPrice)}) = ${formatRupiah(s.total)}`).join('\n');
  }

  if (form.notes) {
    form.notes.value = `Dikonversi dari Surat Penawaran Harga (${isQuoJasa ? 'JASA' : 'PRODUK'}) #${quo.id}.\nKetentuan Garansi: ${quo.warranty || '-'}.\nLead time: ${quo.leadTime || '-'}.${serviceNotes}${quo.notes ? `\n\nCatatan Tambahan:\n${quo.notes}` : ''}`;
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
  const quotationId = orderData?.quotationId || (orderData?.notes && (orderData.notes.match(/QUO-[\w-]+/i) || [])[0]) || '';
  const isService = isServiceOrder(orderData);

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
            ${(state.quotations || []).map(q => {
    const alreadyUsedOrder = (state.orders || []).find(o => (!isEdit || o.id !== orderData?.id) && (o.quotationId === q.id || (o.notes && o.notes.includes(q.id))));
    if (alreadyUsedOrder) {
      return `<option value="${q.id}" ${(quotationId === q.id) ? 'selected' : 'disabled'} style="color: #94a3b8; background: #f8fafc;">
                  [${q.id}] ${q.customerName} - ⚠️ Sudah Dikonversi (Order #${alreadyUsedOrder.id})
                </option>`;
    }
    const qTypeBadge = q.quotationType === 'jasa' ? '🛠️ Jasa' : '📦 Produk';
    return `<option value="${q.id}" ${(quotationId === q.id) ? 'selected' : ''}>
                [${q.id}] [${qTypeBadge}] ${q.customerName} - ${formatRupiah(q.grandTotal)} (${q.status === 'Accepted' ? '✅ Disetujui' : q.status === 'Sent' ? '✉️ Terkirim' : q.status})
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
            <label class="form-label font-bold" style="font-size: 11px; color: #475569;">Status Pengerjaan (Otomatis)</label>
            ${!isEdit ? `
              <input type="hidden" name="status" value="Pengajuan">
              <div class="form-control" style="background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-weight: 700; font-size: 11.5px; display: flex; align-items: center; gap: 8px; cursor: default; height: 38px;">
                <i data-lucide="clock" style="width: 15px; height: 15px; color: #d97706;"></i>
                <span>🟡 Pengajuan (Otomatis dibuat saat simpan)</span>
              </div>
            ` : `
              <input type="hidden" name="status" value="${orderData?.status || 'Pengajuan'}">
              <div class="form-control" style="background: #f8fafc; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11.5px; display: flex; align-items: center; gap: 8px; cursor: default; height: 38px;">
                <i data-lucide="${orderData?.status === 'Accepted' ? 'check-circle-2' : (orderData?.status === 'Confirmed' ? 'file-check' : (orderData?.status === 'In Production' ? 'boxes' : (orderData?.status === 'Delivered' ? 'truck' : 'clock')))}" style="width: 15px; height: 15px;"></i>
                <span>${orderData?.status === 'Pengajuan' ? '🟡 Pengajuan (Menunggu Persetujuan)' :
      orderData?.status === 'Accepted' ? '🟢 Accepted (Disetujui)' :
        orderData?.status === 'Confirmed' ? '🔵 Confirmed (PO Terverifikasi)' :
          orderData?.status === 'In Production' ? '🟣 In Production (Proses Produksi)' :
            orderData?.status === 'Delivered' ? '🚚 Delivered (Selesai Terkirim)' :
              orderData?.status === 'Cancelled' ? '🔴 Cancelled' : (orderData?.status || '🟡 Pengajuan')}</span>
              </div>
            `}
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
          <textarea name="notes" class="form-control" rows="6" placeholder="Instruksi toleransi presisi, perlakuan khusus, syarat termin pembayaran, dll...">${escapeAttr(orderData?.notes || '')}</textarea>
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
        <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600;">
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

  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    if (res.ok) {
      closeModal('form-modal');
      showToast(`Dokumen PO Pelanggan untuk Order #${orderId} berhasil diunggah! Seluruh menu aksi telah aktif.`, 'success');
      await fetchResource('orders');
      renderOrdersTable();
      updateSidebarBadges();
    } else {
      const err = await res.json();
      showToast(err.error || 'Gagal menyimpan PO', 'error');
    }
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

  const form = e.target;
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
  const poFileUrl = formData.get('poFileUrl') || '';
  const poFileName = formData.get('poFileName') || '';

  const poDocument = (poFileUrl || poFileName) ? {
    name: poFileName || 'PO-Pelanggan.pdf',
    url: poFileUrl,
    uploadedAt: new Date().toISOString()
  } : null;

  const payload = {
    quotationId: quotationId,
    orderType: orderType,
    quotationType: orderType,
    customerName: formData.get('customerName'),
    projectName: formData.get('projectName')?.trim() || '',
    customerPhone: formData.get('customerPhone'),
    customerAddress: formData.get('customerAddress'),
    orderDate: formData.get('orderDate'),
    dueDate: formData.get('dueDate'),
    status: !editId ? 'Pengajuan' : (formData.get('status') || 'Pengajuan'),
    notes: formData.get('notes'),
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
      closeModal('form-modal');

      await fetchResource('orders');
      if (typeof renderOrdersTable === 'function') {
        renderOrdersTable();
      }

      // Sinkronisasi status Quotation terkait sesuai status Order
      const linkedQuoId = quotationId || (payload.notes && (payload.notes.match(/QUO-[\w-]+/i) || [])[0]);
      if (linkedQuoId) {
        try {
          let targetQuo = (state.quotations || []).find(q => q.id === linkedQuoId);
          if (!targetQuo) {
            const getQuo = await fetch(`/api/quotations/${linkedQuoId}`);
            if (getQuo.ok) targetQuo = await getQuo.json();
          }
          if (targetQuo) {
            const expectedQuoStatus = payload.status === 'Accepted' ? 'Accepted' : 'Pengajuan';
            if (targetQuo.status !== expectedQuoStatus) {
              const updateQuoRes = await fetch(`/api/quotations/${linkedQuoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...targetQuo, status: expectedQuoStatus })
              });
              if (updateQuoRes.ok) {
                targetQuo.status = expectedQuoStatus;
                await fetchResource('quotations');
                if (typeof renderQuotationsTable === 'function') {
                  renderQuotationsTable();
                }
              }
            }
          }
        } catch (quoErr) {
          console.error('Error syncing quotation status:', quoErr);
        }
      }

      showToast(editId ? 'Order penjualan berhasil diperbarui!' : 'Order penjualan baru berhasil disimpan!', 'success');
    } else {
      const errData = await res.json().catch(() => ({}));
      showToast(errData.error || errData.message || 'Gagal menyimpan order', 'error');
    }
  } catch (err) {
    console.error('Error saving order:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

function viewOrderDetail(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const project = (state.projects || []).find(p => p.orderId === orderId);
  const orderBOMs = (state.bom || []).filter(b => b.orderId === orderId || (b.productName && order.items?.some(it => it.itemName.toLowerCase().includes(b.productName.toLowerCase()))));
  const acceptedBOM = orderBOMs.find(b => b.status === 'Accepted');
  const pengajuanBOM = orderBOMs.find(b => b.status === 'Pengajuan');
  const rejectedBOM = orderBOMs.find(b => b.status === 'Ditolak');
  const bom = acceptedBOM || pengajuanBOM || rejectedBOM || null;

  const todayStr = new Date().toISOString().split('T')[0];
  const startDate = project?.startDate || order.orderDate || '-';
  const dueDate = project?.dueDate || order.dueDate || '-';

  // Calculate Progress & Health
  let progress = project?.progressPercent;
  if (progress === undefined || progress === null) {
    progress = order.status === 'Delivered' ? 100 :
      order.status === 'In Production' ? 50 : 25;
  }

  const isCompleted = progress >= 100 || project?.status === 'Completed' || order.status === 'Delivered';
  const isOnHold = project?.status === 'On Hold' || (project?.notes && project.notes.toLowerCase().includes('kendala'));
  const isOverdue = dueDate !== '-' && dueDate < todayStr && !isCompleted;

  const healthBadge = isCompleted ? 'badge-success' :
    isOnHold ? 'badge-amber' :
      isOverdue ? 'badge-danger' : 'badge-purple';

  const healthText = isCompleted ? 'Completed (Selesai)' :
    isOnHold ? 'Ada Kendala / Hold' :
      isOverdue ? 'Overdue (Lewat Deadline)' : 'On Track (In Progress)';

  const milestones = project?.milestones || [];
  const team = project?.team || [];

  const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
  const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
  const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
  const hasBOM = Boolean(bom);
  const isBOMAccepted = Boolean(acceptedBOM);
  const isBOMDitolak = !acceptedBOM && !pengajuanBOM && Boolean(rejectedBOM);

  const penugasanBtnModal = isPOAndAccepted ?
    `<button type="button" class="btn btn-sm btn-outline" style="color: #4f46e5; border-color: #c7d2fe; font-size: 11.5px;" onclick="closeModal('preview-modal'); openTeamAssignmentPage('${order.id}')">
       <i data-lucide="users"></i> Penugasan Tim
     </button>` :
    `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="promptPenugasanDisabled('${order.id}')" title="⚠️ Wajib upload PO dan status Accepted">
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
      <button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="promptBOMDisabled('${order.id}')" title="⚠️ Wajib tentukan Project Leader terlebih dahulu">
        <i data-lucide="boxes"></i> + Buat BOM
      </button>
    `;
  }

  const hasValidBOM = isService || (hasBOM && !isBOMDitolak);
  const timelineBtnModal = (isPOAndAccepted && hasProjectLead && hasValidBOM) ?
    `<button type="button" class="btn btn-sm btn-primary" style="background: #4f46e5; border-color: #4f46e5; font-size: 11.5px;" onclick="closeModal('preview-modal'); openProjectTimelinePage('${order.id}')">
       <i data-lucide="folder-kanban"></i> Timeline & Milestone
     </button>` :
    `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="promptProjectManagementDisabled('${order.id}')" title="${isBOMDitolak ? '⚠️ Formula BOM Ditolak. Harap ajukan ulang BOM terlebih dahulu.' : (!isService ? '⚠️ Wajib isi BOM terlebih dahulu' : '⚠️ Wajib tentukan Project Lead')}">
       <i data-lucide="folder-kanban"></i> Timeline & Milestone
     </button>`;

  const projForOrder = (state.projects || []).find(p => p.orderId === order.id);
  const projMilestones = projForOrder?.milestones || [];
  const hasInProgressMsOrder = projMilestones.some(m => m.status === 'In Progress' || m.status === 'in_progress' || m.status === 'Completed' || m.status === 'completed');

  const ganttBtnModal = (isPOAndAccepted && hasProjectLead && hasValidBOM && hasInProgressMsOrder) ?
    `<button type="button" class="btn btn-sm btn-outline" style="font-size: 11.5px;" onclick="closeModal('preview-modal'); openGanttDetailModal('${order.id}')">
       <i data-lucide="bar-chart-2"></i> Gantt Chart
     </button>` :
    `<button type="button" class="btn btn-sm btn-outline" style="color: #94a3b8; border-color: #e2e8f0; opacity: 0.5; font-size: 11.5px; cursor: not-allowed;" onclick="showToast('⚠️ Gantt Chart belum dapat dibuka karena belum ada milestone yang berstatus In Progress!', 'warning')" title="${!hasInProgressMsOrder ? '⚠️ Milestone belum ada yang In Progress' : '⚠️ Wajib isi data pengerjaan & Penugasan Tim terlebih dahulu'}">
       <i data-lucide="bar-chart-2"></i> Gantt Chart
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
          ${penugasanBtnModal}
          ${bomBtnModal}
          ${timelineBtnModal}
          ${ganttBtnModal}
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
            <div class="font-bold text-main">${startDate} &rarr; ${dueDate}</div>
            <div class="text-muted font-sm">${isCompleted ? '<span class="text-success">Selesai 100%</span>' : isOverdue ? '<span class="text-danger font-bold">Overdue / Terlambat</span>' : '<span class="text-primary">Dalam Pengerjaan</span>'}</div>
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

      ${order.notes ? `
        <div class="mt-3 p-3 bg-light rounded font-sm">
          <strong>Catatan Khusus:</strong><br>
          ${order.notes}
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
  const order = state.orders.find(o => o.id === orderId);
  if (order) openOrderModal(order);
}
