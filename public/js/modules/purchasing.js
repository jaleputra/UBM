// =========================================================
// UBM - Purchasing Module (Request Pengadaan Barang / PR)
// & Proses Pembelian Barang & Database Master Barang (PR)
// =========================================================

let activePurchasingTab = 'docs';

function switchPurchasingTab(tabName) {
  activePurchasingTab = tabName;
  const docsBtn = document.getElementById('tab-btn-pr-docs');
  const processBtn = document.getElementById('tab-btn-pr-process');
  const itemsBtn = document.getElementById('tab-btn-pr-items');

  const docsContent = document.getElementById('purchasing-docs-tab-content');
  const processContent = document.getElementById('purchasing-process-tab-content');
  const itemsContent = document.getElementById('purchasing-items-tab-content');

  // Reset all buttons and content
  [docsBtn, processBtn, itemsBtn].forEach(btn => btn && btn.classList.remove('active'));
  [docsContent, processContent, itemsContent].forEach(cnt => cnt && (cnt.style.display = 'none'));

  if (tabName === 'process') {
    if (processBtn) processBtn.classList.add('active');
    if (processContent) processContent.style.display = 'block';
    renderPurchasingProcessTable();
  } else if (tabName === 'items') {
    if (itemsBtn) itemsBtn.classList.add('active');
    if (itemsContent) itemsContent.style.display = 'block';
    renderPurchasingItemsTable();
  } else {
    if (docsBtn) docsBtn.classList.add('active');
    if (docsContent) docsContent.style.display = 'block';
    renderPurchasingTable();
  }

  if (window.lucide) lucide.createIcons();
}

function renderPurchasingTable() {
  const tbody = document.getElementById('table-purchasing-body');
  const prList = state.purchasing || [];

  // 1. Hitung counter untuk Dokumen PR
  const badgeDocs = document.getElementById('badge-tab-pr-docs-count');
  if (badgeDocs) badgeDocs.textContent = prList.length;

  // 2. Hitung counter untuk Barang yang Disetujui (Tab Proses Pembelian)
  const approvedPRs = prList.filter(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');
  let totalApprovedItemsCount = 0;
  let matchedMasterItemsCount = 0;

  approvedPRs.forEach(pr => {
    (pr.items || []).forEach(item => {
      totalApprovedItemsCount++;
      if (item.itemStatus === 'Sesuai') {
        matchedMasterItemsCount++;
      }
    });
  });

  const badgeProcess = document.getElementById('badge-tab-pr-process-count');
  if (badgeProcess) badgeProcess.textContent = totalApprovedItemsCount;

  const badgeItems = document.getElementById('badge-tab-pr-items-count');
  if (badgeItems) badgeItems.textContent = matchedMasterItemsCount;

  // Update render tabel lain agar data selalu segar
  if (activePurchasingTab === 'process') {
    renderPurchasingProcessTable();
  } else if (activePurchasingTab === 'items') {
    renderPurchasingItemsTable();
  }

  if (!tbody) return;

  const statusFilter = document.getElementById('filter-purchasing-status')?.value || 'ALL';
  let list = [...prList];

  if (statusFilter !== 'ALL') {
    list = list.filter(p => {
      if (statusFilter === 'Pengajuan' || statusFilter === 'Pending') {
        return p.status === 'Pengajuan' || p.status === 'Pending' || !p.status;
      }
      if (statusFilter === 'Disetujui' || statusFilter === 'Stock' || statusFilter === 'Approved') {
        return p.status === 'Disetujui' || p.status === 'Stock' || p.status === 'Approved';
      }
      return p.status === statusFilter;
    });
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => 
      p.id.toLowerCase().includes(q) || 
      (p.requestor && p.requestor.toLowerCase().includes(q)) ||
      (p.department && p.department.toLowerCase().includes(q)) ||
      (p.purpose && p.purpose.toLowerCase().includes(q)) ||
      (p.items && p.items.some(it => it.itemName && it.itemName.toLowerCase().includes(q)))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 24px;">Tidak ada data request pengadaan barang (PR) ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(pr => {
    const isApproved = pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved';
    const isRejected = pr.status === 'Ditolak' || pr.status === 'Rejected';
    const isPengajuan = !isApproved && !isRejected;

    let statusHtml = '';
    if (isApproved) {
      statusHtml = `
        <span class="badge" style="font-size: 11.5px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; border-radius: 4px; border: 1px solid #86efac; background-color: #dcfce7; color: #15803d; cursor: default;" title="Status terkunci: Disetujui">
          <i data-lucide="check-circle" style="width: 13px; height: 13px;"></i> Disetujui
        </span>
      `;
    } else if (isRejected) {
      statusHtml = `
        <span class="badge" style="font-size: 11.5px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; border-radius: 4px; border: 1px solid #fca5a5; background-color: #fee2e2; color: #b91c1c; cursor: default;" title="Status terkunci: Ditolak. Gunakan tombol 'Salin' untuk mengajukan kembali">
          <i data-lucide="x-circle" style="width: 13px; height: 13px;"></i> Ditolak
        </span>
      `;
    } else {
      statusHtml = `
        <div style="display: flex; justify-content: flex-start; align-items: center;">
          <select class="pr-status-select status-pengajuan"
                  onchange="updatePurchasingStatusDirect('${pr.id}', this.value)"
                  title="Pilih status persetujuan Request Pengadaan (Hanya bisa dipilih satu kali)">
            <option value="Pengajuan" selected>🟡 Pengajuan</option>
            <option value="Disetujui">🟢 Disetujui</option>
            <option value="Ditolak">🔴 Ditolak</option>
          </select>
        </div>
      `;
    }

    return `
      <tr style="${isApproved ? 'background-color: #f0fdf4;' : (isRejected ? 'background-color: #fef2f2;' : '')}">
        <td class="mono-id">${pr.id}</td>
        <td>
          <div class="font-bold">${escapeAttr(pr.requestor || '-')}</div>
          <div class="text-muted font-sm">${escapeAttr(pr.department || 'Umum')}</div>
        </td>
        <td>${pr.requestDate || '-'}</td>
        <td><span class="badge ${pr.urgency === 'High' ? 'badge-danger' : pr.urgency === 'Medium' ? 'badge-purple' : 'badge-secondary'}">${pr.urgency || 'Normal'}</span></td>
        <td>
          <span class="badge ${isApproved ? 'badge-primary' : 'badge-secondary'}" style="cursor: pointer;" onclick="switchPurchasingTab('${isApproved ? 'process' : 'docs'}')" title="${isApproved ? 'Lihat di Tab Proses Pembelian' : 'Rincian barang PR'}">
            ${pr.items?.length || 0} Barang ${isApproved ? '➔' : ''}
          </span>
        </td>
        <td class="font-bold text-primary">${formatRupiah(pr.totalEstimated || 0)}</td>
        <td>${statusHtml}</td>
        <td class="text-right">
          <div class="table-actions" style="justify-content: flex-end;">
            ${isRejected ? `<button class="btn-icon" style="color: #2563eb;" title="Salin & Ajukan Ulang PR yang Ditolak" onclick="event.stopPropagation(); duplicateAndReapplyPR('${pr.id}')"><i data-lucide="copy"></i></button>` : ''}
            <button class="btn-icon" title="Lihat Dokumen PR" onclick="viewPurchasingDetail('${pr.id}')"><i data-lucide="eye"></i></button>
            ${isApproved ?
              `<button class="btn-icon" style="opacity: 0.35; cursor: not-allowed;" title="⚠️ PR sudah Disetujui (Terkunci & Tidak dapat diedit)" onclick="event.stopPropagation(); showToast('⚠️ Request Pengadaan yang sudah Disetujui telah terkunci dan tidak dapat diedit lagi!', 'warning')"><i data-lucide="lock"></i></button>` :
              `<button class="btn-icon" title="Edit PR" onclick="editPurchasing('${pr.id}')"><i data-lucide="edit-3"></i></button>`}
            ${isApproved ?
              `<button class="btn-icon btn-danger-ghost" style="opacity: 0.35; cursor: not-allowed;" title="⚠️ PR sudah Disetujui tidak dapat dihapus" onclick="event.stopPropagation(); showToast('⚠️ Request Pengadaan yang sudah Disetujui tidak dapat dihapus!', 'warning')"><i data-lucide="trash-2"></i></button>` :
              `<button class="btn-icon btn-danger-ghost" title="Hapus PR" onclick="deleteResource('purchasing', '${pr.id}')"><i data-lucide="trash-2"></i></button>`}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Function update status PR langsung dari tabel (Pengajuan <-> Disetujui <-> Ditolak)
async function updatePurchasingStatusDirect(prId, newStatus) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr) {
    showToast('Data Request Pengadaan tidak ditemukan', 'warning');
    return;
  }

  const oldStatus = pr.status || 'Pengajuan';
  if (oldStatus === newStatus) return;

  if (oldStatus === 'Disetujui' || oldStatus === 'Stock' || oldStatus === 'Approved') {
    showToast('⚠️ Status Persetujuan PR yang sudah Disetujui telah terkunci permanen dan tidak dapat diubah kembali!', 'warning');
    renderPurchasingTable();
    return;
  }

  pr.status = newStatus;

  try {
    const res = await fetch(`/api/purchasing/${prId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pr)
    });

    if (res.ok) {
      if (newStatus === 'Disetujui' || newStatus === 'Stock' || newStatus === 'Approved') {
        showToast(`✅ PR ${prId} DISETUJUI & TERKUNCI! Dokumen tidak dapat diedit lagi, barang masuk ke tab "Proses Pembelian Barang".`, 'success');
      } else if (newStatus === 'Ditolak') {
        showToast(`🔴 Request Pengadaan ${prId} DITOLAK.`, 'info');
      } else {
        showToast(`🟡 Status PR ${prId} diubah menjadi PENGAJUAN.`, 'info');
      }
      renderPurchasingTable();
      renderPurchasingProcessTable();
      renderPurchasingItemsTable();
      updateSidebarBadges();
    } else {
      pr.status = oldStatus;
      showToast('Gagal memperbarui status PR di server', 'error');
      renderPurchasingTable();
    }
  } catch (err) {
    console.error('Error updating PR status:', err);
    pr.status = oldStatus;
    showToast('Terjadi kesalahan jaringan', 'error');
    renderPurchasingTable();
  }
}

// =========================================================
// TAB 2: PROSES PEMBELIAN BARANG (BARANG DARI PR DISETUJUI)
// =========================================================

function renderPurchasingProcessTable() {
  const tbody = document.getElementById('table-purchasing-process-body');
  const prList = state.purchasing || [];

  // Ambil hanya PR yang berstatus Disetujui / Stock / Approved
  const approvedPRs = prList.filter(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');

  // Kumpulkan semua item dari PR yang disetujui
  const allApprovedItems = [];
  approvedPRs.forEach(pr => {
    (pr.items || []).forEach((item, itemIdx) => {
      const qty = parseFloat(item.qty) || 1;
      const unitPrice = parseFloat(item.purchasePrice !== undefined ? item.purchasePrice : (item.actualPrice !== undefined ? item.actualPrice : (item.estimatedPrice || item.unitPrice || 0))) || 0;
      const total = qty * unitPrice;
      const itemStatus = item.itemStatus || 'Belum Dipesan';

      allApprovedItems.push({
        prId: pr.id,
        itemIndex: itemIdx,
        requestor: pr.requestor || '-',
        department: pr.department || 'Umum',
        requestDate: pr.requestDate || '-',
        itemName: (item.itemName || '').trim(),
        specs: (item.specs || '').trim(),
        qty: qty,
        unit: item.unit || 'Pcs',
        estimatedPrice: parseFloat(item.estimatedPrice || item.unitPrice || 0),
        purchasePrice: unitPrice,
        totalCost: total,
        orderDate: item.orderDate || '',
        orderLink: item.orderLink || '',
        arrivalDate: item.arrivalDate || item.receivedDate || '',
        recipientName: item.recipientName || item.recipient || item.receivedBy || '',
        itemPhoto: item.itemPhoto || item.photo || '',
        itemStatus: itemStatus,
        notes: item.notes || ''
      });
    });
  });

  // 1. Hitung Statistik KPI Tab Proses Pembelian
  const totalApproved = allApprovedItems.length;
  const totalPending = allApprovedItems.filter(it => it.itemStatus === 'Belum Dipesan' || it.itemStatus === 'Dalam Pengiriman').length;
  const totalMatched = allApprovedItems.filter(it => it.itemStatus === 'Sesuai').length;
  const totalRejected = allApprovedItems.filter(it => it.itemStatus === 'Tidak Sesuai' || it.itemStatus === 'Dikembalikan').length;

  const statTotalEl = document.getElementById('pr-proc-stat-total');
  if (statTotalEl) statTotalEl.textContent = `${totalApproved} Item`;

  const statPendingEl = document.getElementById('pr-proc-stat-pending');
  if (statPendingEl) statPendingEl.textContent = `${totalPending} Item`;

  const statMatchedEl = document.getElementById('pr-proc-stat-matched');
  if (statMatchedEl) statMatchedEl.textContent = `${totalMatched} Item`;

  const statRejectedEl = document.getElementById('pr-proc-stat-rejected');
  if (statRejectedEl) statRejectedEl.textContent = `${totalRejected} Item`;

  // Update Tab Badge
  const badgeProcess = document.getElementById('badge-tab-pr-process-count');
  if (badgeProcess) badgeProcess.textContent = totalApproved;

  if (!tbody) return;

  // 2. Filter Table Data
  let filteredList = [...allApprovedItems];

  const searchInput = document.getElementById('filter-purchasing-process-search');
  const searchVal = (searchInput ? searchInput.value : '') || state.searchQuery || '';
  if (searchVal.trim()) {
    const q = searchVal.trim().toLowerCase();
    filteredList = filteredList.filter(it => 
      it.itemName.toLowerCase().includes(q) ||
      it.specs.toLowerCase().includes(q) ||
      it.prId.toLowerCase().includes(q) ||
      it.requestor.toLowerCase().includes(q) ||
      it.orderLink.toLowerCase().includes(q) ||
      it.recipientName.toLowerCase().includes(q) ||
      it.notes.toLowerCase().includes(q)
    );
  }

  const statusFilter = document.getElementById('filter-purchasing-process-status')?.value || 'ALL';
  if (statusFilter !== 'ALL') {
    filteredList = filteredList.filter(it => it.itemStatus === statusFilter);
  }

  const deptFilter = document.getElementById('filter-purchasing-process-dept')?.value || 'ALL';
  if (deptFilter !== 'ALL') {
    filteredList = filteredList.filter(it => it.department === deptFilter);
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted" style="padding: 32px 20px;">
          <i data-lucide="shopping-cart" style="width: 32px; height: 32px; color: #94a3b8; margin: 0 auto 8px auto; display: block;"></i>
          <strong>Tidak ada data proses pembelian barang ditemukan.</strong>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
            ${allApprovedItems.length === 0 ? 'Barang akan muncul di sini secara otomatis setelah dokumen PR berstatus <strong>Disetujui</strong>.' : 'Coba ubah kata kunci pencarian atau filter status barang di atas.'}
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filteredList.map((item, idx) => {
    // Status Select styling
    const statusClass = item.itemStatus === 'Sesuai' ? 'status-sesuai' :
                        item.itemStatus === 'Tidak Sesuai' ? 'status-tidak-sesuai' :
                        item.itemStatus === 'Dikembalikan' ? 'status-retur' :
                        item.itemStatus === 'Dalam Pengiriman' ? 'status-in-transit' : 'status-pending-order';

    // Link Pemesanan UI
    let linkHtml = '<span class="text-muted font-xs">-</span>';
    if (item.orderLink && item.orderLink.trim()) {
      let rawLink = item.orderLink.trim();
      if (!rawLink.startsWith('http://') && !rawLink.startsWith('https://')) {
        rawLink = 'https://' + rawLink;
      }
      let domain = 'Buka Link';
      try {
        const u = new URL(rawLink);
        domain = u.hostname.replace('www.', '');
      } catch (e) {}

      linkHtml = `
        <a href="${escapeAttr(rawLink)}" target="_blank" rel="noopener noreferrer" class="order-link-btn" title="Buka tautan pembelian: ${escapeAttr(rawLink)}">
          <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
          <span>${escapeAttr(domain)}</span>
        </a>
      `;
    }

    // Foto / Bukti Barang UI
    let photoHtml = '';
    if (item.itemPhoto) {
      photoHtml = `
        <div class="item-thumb-container" onclick="previewPurchasingItemImage('${escapeAttr(item.itemPhoto)}', '${escapeAttr(item.itemName)}')" title="Klik untuk memperbesar foto barang">
          <img src="${escapeAttr(item.itemPhoto)}" class="item-thumb-img" alt="Foto ${escapeAttr(item.itemName)}">
        </div>
      `;
    } else {
      photoHtml = `
        <button type="button" class="btn btn-xs btn-outline" onclick="openProcessPurchasingItemModal('${item.prId}', ${item.itemIndex})" title="Upload foto / bukti barang" style="color: #64748b; border-style: dashed; padding: 4px 8px;">
          <i data-lucide="image-plus" style="width: 13px; height: 13px;"></i>
        </button>
      `;
    }

    const isItemSesuai = item.itemStatus === 'Sesuai';

    // Direct Status Select Dropdown or Locked Badge
    let statusSelectHtml = '';
    if (isItemSesuai) {
      statusSelectHtml = `
        <span class="badge" style="font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; border-radius: 4px; border: 1px solid #86efac; background-color: #dcfce7; color: #15803d; cursor: default;" title="Status terkunci: Sesuai (Resmi masuk Database Master Barang)">
          <i data-lucide="check-circle" style="width: 13px; height: 13px;"></i> Sesuai
        </span>
      `;
    } else {
      statusSelectHtml = `
        <select class="procurement-status-select ${statusClass}" 
                onchange="updateProcessItemStatusDirect('${item.prId}', ${item.itemIndex}, this.value)"
                title="Ubah status pemeriksaan barang">
          <option value="Belum Dipesan" ${item.itemStatus === 'Belum Dipesan' ? 'selected' : ''}>🟡 Belum Dipesan</option>
          <option value="Dalam Pengiriman" ${item.itemStatus === 'Dalam Pengiriman' ? 'selected' : ''}>🔵 Dalam Pengiriman</option>
          <option value="Sesuai" ${item.itemStatus === 'Sesuai' ? 'selected' : ''}>🟢 Sesuai (Master)</option>
          <option value="Tidak Sesuai" ${item.itemStatus === 'Tidak Sesuai' ? 'selected' : ''}>🔴 Tidak Sesuai</option>
          <option value="Dikembalikan" ${item.itemStatus === 'Dikembalikan' ? 'selected' : ''}>↩️ Dikembalikan</option>
        </select>
      `;
    }

    return `
      <tr style="${item.itemStatus === 'Sesuai' ? 'background-color: #f0fdf4;' : (item.itemStatus === 'Tidak Sesuai' ? 'background-color: #fef2f2;' : (item.itemStatus === 'Dikembalikan' ? 'background-color: #faf5ff;' : ''))}">
        <td class="text-center font-bold text-muted">${idx + 1}</td>
        <td>
          <div class="font-bold text-main" style="font-size: 13.5px;">${escapeAttr(item.itemName)}</div>
          ${item.specs ? `<div class="text-muted font-sm" style="font-size: 11.5px; margin-top: 2px;">${escapeAttr(item.specs)}</div>` : ''}
          <div style="margin-top: 3px;">
            <span class="badge badge-secondary font-sm" style="font-size: 10.5px; font-weight: 700;">Qty: ${item.qty} ${escapeAttr(item.unit)}</span>
          </div>
        </td>
        <td>
          <span class="badge badge-outline mono-id font-sm" style="font-size: 11px; cursor: pointer;" onclick="viewPurchasingDetail('${item.prId}')" title="Klik untuk lihat dokumen PR">${item.prId}</span>
          <div class="font-bold" style="font-size: 11.5px; margin-top: 2px;">${escapeAttr(item.requestor)}</div>
          <div class="text-muted font-sm" style="font-size: 10.5px;">${escapeAttr(item.department)}</div>
        </td>
        <td>
          ${item.orderDate ? `<span class="badge badge-outline font-mono font-sm" style="font-size: 11px;">${item.orderDate}</span>` : '<span class="text-muted font-xs">-</span>'}
        </td>
        <td>${linkHtml}</td>
        <td class="text-right font-mono">
          <div style="font-size: 12px; font-weight: 600;">${formatRupiah(item.purchasePrice)}</div>
          <div class="text-primary font-bold" style="font-size: 11px; margin-top: 1px;">Tot: ${formatRupiah(item.totalCost)}</div>
        </td>
        <td>
          ${item.arrivalDate ? `<span class="badge badge-outline font-mono font-sm" style="font-size: 11px; color: #15803d; border-color: #bbf7d0;">${item.arrivalDate}</span>` : '<span class="text-muted font-xs">-</span>'}
          ${item.recipientName ? `<div style="font-size: 11px; font-weight: 600; color: #334155; margin-top: 3px; display: flex; align-items: center; gap: 3px;"><i data-lucide="user-check" style="width: 11px; height: 11px; color: #2563eb;"></i> ${escapeAttr(item.recipientName)}</div>` : ''}
        </td>
        <td class="text-center" style="vertical-align: middle;">
          <div style="display: flex; justify-content: center; align-items: center;">
            ${photoHtml}
          </div>
        </td>
        <td class="text-center">
          ${statusSelectHtml}
        </td>
        <td class="text-right">
          <div class="table-actions" style="justify-content: flex-end; gap: 4px;">
            ${isItemSesuai ? `
              <button class="btn btn-sm btn-outline" onclick="openProcessPurchasingItemModal('${item.prId}', ${item.itemIndex}, true)" title="Lihat Detail Pemeriksaan Barang (Terkunci Sesuai)" style="padding: 5px 10px; font-size: 11.5px; color: #15803d; border-color: #86efac; background: #f0fdf4;">
                <i data-lucide="eye"></i> Detail
              </button>
            ` : `
              <button class="btn btn-sm btn-primary" onclick="openProcessPurchasingItemModal('${item.prId}', ${item.itemIndex}, false)" title="Update / Input Data Proses Pembelian" style="padding: 5px 10px; font-size: 11.5px;">
                <i data-lucide="edit-3"></i> Update
              </button>
            `}
            <button class="btn-icon" title="Lihat Dokumen PR" onclick="viewPurchasingDetail('${item.prId}')">
              <i data-lucide="file-text"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// =========================================================
// MODAL INPUT / UPDATE PROSES PEMBELIAN
// =========================================================

function openProcessPurchasingItemModal(prId, itemIndex, isViewOnly = false) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr || !pr.items || !pr.items[itemIndex]) {
    showToast('Data barang PR tidak ditemukan', 'error');
    return;
  }

  const item = pr.items[itemIndex];
  const isLocked = isViewOnly || item.itemStatus === 'Sesuai';
  const qty = parseFloat(item.qty) || 1;
  const currentPrice = item.purchasePrice !== undefined ? item.purchasePrice : (item.actualPrice !== undefined ? item.actualPrice : (item.estimatedPrice || item.unitPrice || 0));

  // Set hidden inputs
  const prIdInput = document.getElementById('proc-item-pr-id');
  const indexInput = document.getElementById('proc-item-index');
  const photoDataInput = document.getElementById('proc-item-photo-data');
  const photoFileInput = document.getElementById('proc-item-photo-file');

  if (prIdInput) prIdInput.value = pr.id;
  if (indexInput) indexInput.value = itemIndex;
  if (photoDataInput) photoDataInput.value = item.itemPhoto || item.photo || '';
  if (photoFileInput) photoFileInput.value = '';

  // Set header display info
  const prBadge = document.getElementById('proc-item-pr-badge');
  const deptInfo = document.getElementById('proc-item-dept-info');
  const qtyBadge = document.getElementById('proc-item-qty-badge');
  const nameDisplay = document.getElementById('proc-item-name-display');
  const specsDisplay = document.getElementById('proc-item-specs-display');

  if (prBadge) prBadge.textContent = pr.id;
  if (deptInfo) deptInfo.textContent = `• Pemohon: ${escapeAttr(pr.requestor || '-')} (${escapeAttr(pr.department || 'Umum')})`;
  if (qtyBadge) qtyBadge.textContent = `${qty} ${escapeAttr(item.unit || 'Pcs')}`;
  if (nameDisplay) nameDisplay.textContent = item.itemName || 'Barang Pengadaan';
  if (specsDisplay) specsDisplay.textContent = item.specs ? `Spesifikasi: ${escapeAttr(item.specs)}` : 'Tidak ada catatan spesifikasi khusus';

  // Set form inputs
  const orderDateInput = document.getElementById('proc-item-order-date');
  const orderLinkInput = document.getElementById('proc-item-order-link');
  const priceInput = document.getElementById('proc-item-price');
  const arrivalDateInput = document.getElementById('proc-item-arrival-date');
  const recipientInput = document.getElementById('proc-item-recipient');
  const statusSelect = document.getElementById('proc-item-status');
  const notesInput = document.getElementById('proc-item-notes');

  if (orderDateInput) {
    orderDateInput.value = item.orderDate || '';
    orderDateInput.disabled = isLocked;
  }
  if (orderLinkInput) {
    orderLinkInput.value = item.orderLink || '';
    orderLinkInput.disabled = isLocked;
  }
  if (priceInput) {
    priceInput.value = currentPrice;
    priceInput.disabled = isLocked;
  }
  if (arrivalDateInput) {
    arrivalDateInput.value = item.arrivalDate || item.receivedDate || '';
    arrivalDateInput.disabled = isLocked;
  }
  if (recipientInput) {
    recipientInput.value = item.recipientName || item.recipient || item.receivedBy || '';
    recipientInput.disabled = isLocked;
  }
  if (statusSelect) {
    statusSelect.value = item.itemStatus || 'Belum Dipesan';
    statusSelect.disabled = isLocked;
    statusSelect.onchange = handleProcStatusChange;
  }
  if (notesInput) {
    notesInput.value = item.notes || '';
    notesInput.disabled = isLocked;
  }

  // Set Photo Preview Box
  const emptyState = document.getElementById('proc-photo-empty-state');
  const filledState = document.getElementById('proc-photo-filled-state');
  const previewImg = document.getElementById('proc-photo-preview-img');
  const photoBox = document.getElementById('proc-photo-preview-box');

  if (photoBox) {
    photoBox.style.cursor = isLocked ? 'default' : 'pointer';
    photoBox.onclick = isLocked ? null : () => document.getElementById('proc-item-photo-file')?.click();
  }

  if (item.itemPhoto || item.photo) {
    if (previewImg) previewImg.src = item.itemPhoto || item.photo;
    if (emptyState) emptyState.style.display = 'none';
    if (filledState) filledState.style.display = 'flex';
  } else {
    if (previewImg) previewImg.src = '';
    if (emptyState) emptyState.style.display = 'block';
    if (filledState) filledState.style.display = 'none';
  }

  // Handle Alerts & Buttons for Locked state
  const lockedAlert = document.getElementById('proc-item-locked-alert');
  const normalAlert = document.getElementById('proc-item-normal-alert');
  const submitBtn = document.getElementById('proc-item-submit-btn');
  const closeBtn = document.getElementById('proc-item-close-btn');

  if (lockedAlert) lockedAlert.style.display = isLocked ? 'flex' : 'none';
  if (normalAlert) normalAlert.style.display = isLocked ? 'none' : 'flex';
  if (submitBtn) submitBtn.style.display = isLocked ? 'none' : 'inline-flex';
  if (closeBtn) closeBtn.textContent = isLocked ? 'Tutup' : 'Batal';

  handleProcStatusChange();
  calculateProcItemTotal();
  openModal('modal-process-purchasing-item');
  if (window.lucide) lucide.createIcons();
}

function handleProcStatusChange() {
  const statusSelect = document.getElementById('proc-item-status');
  const reqMark = document.getElementById('proc-link-required-mark');
  const hint = document.getElementById('proc-link-hint');
  const orderLinkInput = document.getElementById('proc-item-order-link');

  const isSesuai = statusSelect && statusSelect.value === 'Sesuai';
  if (reqMark) reqMark.style.display = isSesuai ? 'inline' : 'none';
  if (hint) {
    hint.style.display = isSesuai ? 'block' : 'none';
    hint.style.color = isSesuai ? '#b91c1c' : '#64748b';
  }
  if (orderLinkInput) {
    orderLinkInput.placeholder = isSesuai 
      ? 'Wajib diisi: https://tokopedia.com/... atau https://shopee.co.id/...'
      : 'Opsional: https://tokopedia.com/... (Bisa dikosongkan)';
  }
}

function calculateProcItemTotal() {
  const prId = document.getElementById('proc-item-pr-id')?.value;
  const itemIndex = parseInt(document.getElementById('proc-item-index')?.value, 10);
  const pr = (state.purchasing || []).find(p => p.id === prId);
  const item = (pr && pr.items) ? pr.items[itemIndex] : null;

  const qty = item ? (parseFloat(item.qty) || 1) : 1;
  const price = parseFloat(document.getElementById('proc-item-price')?.value) || 0;
  const total = qty * price;

  const totalInput = document.getElementById('proc-item-total');
  if (totalInput) {
    totalInput.value = formatRupiah(total);
  }
}

function handleProcPhotoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran file foto maksimal 5MB', 'warning');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    const photoDataInput = document.getElementById('proc-item-photo-data');
    const emptyState = document.getElementById('proc-photo-empty-state');
    const filledState = document.getElementById('proc-photo-filled-state');
    const previewImg = document.getElementById('proc-photo-preview-img');

    if (photoDataInput) photoDataInput.value = dataUrl;
    if (previewImg) previewImg.src = dataUrl;
    if (emptyState) emptyState.style.display = 'none';
    if (filledState) filledState.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
  };
  reader.readAsDataURL(file);
}

function removeProcPhoto() {
  const photoDataInput = document.getElementById('proc-item-photo-data');
  const photoFileInput = document.getElementById('proc-item-photo-file');
  const emptyState = document.getElementById('proc-photo-empty-state');
  const filledState = document.getElementById('proc-photo-filled-state');
  const previewImg = document.getElementById('proc-photo-preview-img');

  if (photoDataInput) photoDataInput.value = '';
  if (photoFileInput) photoFileInput.value = '';
  if (previewImg) previewImg.src = '';
  if (emptyState) emptyState.style.display = 'block';
  if (filledState) filledState.style.display = 'none';
  if (window.lucide) lucide.createIcons();
}

async function saveProcessPurchasingItem(e) {
  e.preventDefault();
  const prId = document.getElementById('proc-item-pr-id')?.value;
  const itemIndex = parseInt(document.getElementById('proc-item-index')?.value, 10);

  if (!prId || isNaN(itemIndex)) {
    showToast('Identifikasi PR / Barang tidak valid', 'error');
    return;
  }

  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr || !pr.items || !pr.items[itemIndex]) {
    showToast('Dokumen PR tidak ditemukan', 'error');
    return;
  }

  const targetItem = pr.items[itemIndex];
  if (targetItem.itemStatus === 'Sesuai') {
    showToast('🔒 Data barang berstatus Sesuai telah terkunci dan tidak dapat diedit kembali.', 'info');
    closeModal('modal-process-purchasing-item');
    return;
  }

  const orderDate = document.getElementById('proc-item-order-date')?.value || '';
  const orderLink = document.getElementById('proc-item-order-link')?.value.trim() || '';
  const purchasePrice = parseFloat(document.getElementById('proc-item-price')?.value) || 0;
  const arrivalDate = document.getElementById('proc-item-arrival-date')?.value || '';
  const recipientName = document.getElementById('proc-item-recipient')?.value.trim() || '';
  const itemPhoto = document.getElementById('proc-item-photo-data')?.value || '';
  const itemStatus = document.getElementById('proc-item-status')?.value || 'Belum Dipesan';
  const notes = document.getElementById('proc-item-notes')?.value.trim() || '';

  // VALIDASI: Jika status diubah menjadi Sesuai (Master), Link Pemesanan WAJIB diisi!
  if (itemStatus === 'Sesuai' && !orderLink) {
    showToast('⚠️ Link Pemesanan wajib diisi jika status barang diubah menjadi Sesuai (Master)!', 'warning');
    const orderLinkInput = document.getElementById('proc-item-order-link');
    if (orderLinkInput) {
      orderLinkInput.focus();
      orderLinkInput.style.borderColor = '#dc2626';
      orderLinkInput.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.25)';
      setTimeout(() => {
        orderLinkInput.style.borderColor = '';
        orderLinkInput.style.boxShadow = '';
      }, 3000);
    }
    return;
  }

  const qty = parseFloat(targetItem.qty) || 1;
  const total = qty * purchasePrice;

  // Backup old item in case of network failure
  const oldItemData = { ...targetItem };

  // Update item data optimistically in memory for instant speed
  const updatedItemData = {
    ...targetItem,
    orderDate,
    orderLink,
    purchasePrice,
    actualPrice: purchasePrice,
    total: total,
    arrivalDate,
    recipientName,
    recipient: recipientName,
    receivedBy: recipientName,
    itemPhoto,
    itemStatus,
    notes
  };

  pr.items[itemIndex] = updatedItemData;

  // Instantly close modal and render UI (0ms perceived latency)
  closeModal('modal-process-purchasing-item');
  if (itemStatus === 'Sesuai') {
    showToast(`✅ Data barang "${targetItem.itemName}" disimpan! Status SESUAI ➔ Resmi masuk ke Database Master Barang (Terkunci).`, 'success');
  } else {
    showToast(`✅ Data proses pembelian "${targetItem.itemName}" berhasil disimpan!`, 'success');
  }
  renderPurchasingTable();
  renderPurchasingProcessTable();
  renderPurchasingItemsTable();
  updateSidebarBadges();

  const payload = {
    ...pr,
    items: pr.items
  };

  // Asynchronous network update to server and Supabase
  try {
    const res = await fetch(`/api/purchasing/${prId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      // Revert if failed
      pr.items[itemIndex] = oldItemData;
      renderPurchasingTable();
      renderPurchasingProcessTable();
      renderPurchasingItemsTable();
      updateSidebarBadges();
      showToast('Gagal menyimpan data proses pembelian di server/database', 'error');
    }
  } catch (err) {
    console.error('Error saving process purchasing item:', err);
    pr.items[itemIndex] = oldItemData;
    renderPurchasingTable();
    renderPurchasingProcessTable();
    renderPurchasingItemsTable();
    updateSidebarBadges();
    showToast('Terjadi kesalahan jaringan saat menyimpan ke server', 'error');
  }
}

// Update status barang cepat langsung dari select tabel proses pembelian
async function updateProcessItemStatusDirect(prId, itemIndex, newStatus) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr || !pr.items || !pr.items[itemIndex]) {
    showToast('Data barang tidak ditemukan', 'error');
    return;
  }

  const targetItem = pr.items[itemIndex];
  const oldStatus = targetItem.itemStatus || 'Belum Dipesan';
  if (oldStatus === 'Sesuai') {
    showToast('🔒 Status barang sudah "Sesuai" (Terkunci) dan tidak dapat diubah lagi!', 'warning');
    renderPurchasingProcessTable();
    return;
  }

  if (oldStatus === newStatus) return;

  // VALIDASI: Jika memilih status "Sesuai" dari tabel langsung, cek apakah link pemesanan sudah ada
  if (newStatus === 'Sesuai' && (!targetItem.orderLink || !targetItem.orderLink.trim())) {
    showToast('⚠️ Link Pemesanan belum diisi! Silakan isi Link Pemesanan terlebih dahulu sebelum mengubah status ke Sesuai.', 'warning');
    renderPurchasingProcessTable();
    // Buka modal secara otomatis dan arahkan user ke input Link Pemesanan
    openProcessPurchasingItemModal(prId, itemIndex, false);
    setTimeout(() => {
      const statusSelect = document.getElementById('proc-item-status');
      if (statusSelect) {
        statusSelect.value = 'Sesuai';
        handleProcStatusChange();
      }
      const linkInput = document.getElementById('proc-item-order-link');
      if (linkInput) {
        linkInput.focus();
        linkInput.style.borderColor = '#dc2626';
        linkInput.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.25)';
        setTimeout(() => {
          linkInput.style.borderColor = '';
          linkInput.style.boxShadow = '';
        }, 3000);
      }
    }, 250);
    return;
  }

  // Optimistic update
  targetItem.itemStatus = newStatus;

  if (newStatus === 'Sesuai') {
    showToast(`🟢 Barang "${targetItem.itemName}" diset SESUAI! Otomatis masuk ke Database Master Barang (Status Terkunci).`, 'success');
  } else if (newStatus === 'Tidak Sesuai') {
    showToast(`🔴 Barang "${targetItem.itemName}" diset TIDAK SESUAI.`, 'info');
  } else if (newStatus === 'Dikembalikan') {
    showToast(`↩️ Barang "${targetItem.itemName}" diset DIKEMBALIKAN (Retur ke Vendor).`, 'info');
  } else {
    showToast(`🟡 Status proses barang "${targetItem.itemName}" diubah menjadi ${newStatus}.`, 'info');
  }

  renderPurchasingProcessTable();
  renderPurchasingItemsTable();
  updateSidebarBadges();

  const payload = {
    ...pr,
    items: pr.items
  };

  try {
    const res = await fetch(`/api/purchasing/${prId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      targetItem.itemStatus = oldStatus;
      showToast('Gagal mengubah status barang di database', 'error');
      renderPurchasingProcessTable();
      renderPurchasingItemsTable();
      updateSidebarBadges();
    }
  } catch (err) {
    console.error('Error updating process item status:', err);
    targetItem.itemStatus = oldStatus;
    showToast('Terjadi kesalahan jaringan', 'error');
    renderPurchasingProcessTable();
    renderPurchasingItemsTable();
    updateSidebarBadges();
  }
}

// Lightbox preview foto barang
function previewPurchasingItemImage(imgSrc, title = 'Foto Bukti Barang') {
  if (!imgSrc) return;
  const imgEl = document.getElementById('purchasing-image-preview-img');
  const titleEl = document.getElementById('purchasing-image-preview-title');
  if (imgEl) imgEl.src = imgSrc;
  if (titleEl) titleEl.textContent = `Foto Bukti: ${title}`;
  openModal('modal-purchasing-image-preview');
  if (window.lucide) lucide.createIcons();
}

// Export Proses Pembelian to CSV
function exportPurchasingProcessToCSV() {
  const prList = state.purchasing || [];
  const approvedPRs = prList.filter(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');

  const rows = [
    ['No', 'No PR', 'Pemohon', 'Departemen', 'Nama Barang', 'Spesifikasi', 'Qty', 'Satuan', 'Tgl Pemesanan', 'Link Pemesanan', 'Harga Beli Satuan (Rp)', 'Total Biaya (Rp)', 'Tgl Sampai', 'Nama Penerima', 'Status Barang', 'Catatan']
  ];

  let counter = 1;
  approvedPRs.forEach(pr => {
    (pr.items || []).forEach(it => {
      const qty = parseFloat(it.qty) || 1;
      const price = parseFloat(it.purchasePrice !== undefined ? it.purchasePrice : (it.actualPrice !== undefined ? it.actualPrice : (it.estimatedPrice || it.unitPrice || 0))) || 0;
      rows.push([
        counter++,
        `"${pr.id}"`,
        `"${(pr.requestor || '').replace(/"/g, '""')}"`,
        `"${(pr.department || '').replace(/"/g, '""')}"`,
        `"${(it.itemName || '').replace(/"/g, '""')}"`,
        `"${(it.specs || '').replace(/"/g, '""')}"`,
        qty,
        it.unit || 'Pcs',
        it.orderDate || '',
        `"${(it.orderLink || '').replace(/"/g, '""')}"`,
        price,
        qty * price,
        it.arrivalDate || it.receivedDate || '',
        `"${(it.recipientName || it.recipient || it.receivedBy || '').replace(/"/g, '""')}"`,
        `"${it.itemStatus || 'Belum Dipesan'}"`,
        `"${(it.notes || '').replace(/"/g, '""')}"`
      ]);
    });
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Proses_Pembelian_Barang_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================
// TAB 3: DATABASE MASTER BARANG (PR) - HANYA STATUS 'SESUAI'
// =========================================================

function renderPurchasingItemsTable() {
  const tbody = document.getElementById('table-purchasing-items-body');
  const prList = state.purchasing || [];

  // Ambil hanya PR yang disetujui
  const approvedPRs = prList.filter(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');

  // KETENTUAN UTAMA: HANYA BARANG DENGAN STATUS 'Sesuai' YANG MASUK DATABASE MASTER BARANG
  const masterMap = new Map();

  approvedPRs.forEach(pr => {
    (pr.items || []).forEach((item, itemIdx) => {
      // Pastikan status barang sudah 'Sesuai'
      if (item.itemStatus !== 'Sesuai') return;

      const name = (item.itemName || '').trim();
      const specs = (item.specs || '').trim();
      if (!name) return;

      const key = `${name.toLowerCase()}:::${specs.toLowerCase()}`;
      const qty = parseFloat(item.qty) || 0;
      const unitCost = parseFloat(item.purchasePrice !== undefined ? item.purchasePrice : (item.actualPrice !== undefined ? item.actualPrice : (item.estimatedPrice || item.unitPrice || 0))) || 0;

      if (!masterMap.has(key)) {
        masterMap.set(key, {
          key,
          itemName: name,
          specs: specs,
          unit: item.unit || 'Pcs',
          qty: qty,
          unitCost: unitCost,
          totalCost: qty * unitCost,
          departments: new Set(pr.department ? [pr.department] : []),
          sources: [{
            prId: pr.id,
            itemIndex: itemIdx,
            requestor: pr.requestor || '-',
            department: pr.department || 'Umum',
            requestDate: pr.requestDate || '-',
            orderDate: item.orderDate || '-',
            arrivalDate: item.arrivalDate || '-',
            qty: qty,
            unitCost: unitCost,
            total: parseFloat(item.total) || (qty * unitCost)
          }]
        });
      } else {
        const existing = masterMap.get(key);
        existing.qty += qty;
        if (unitCost > 0) existing.unitCost = unitCost; // Update harga satuan terbaru
        existing.totalCost = existing.qty * existing.unitCost;
        if (pr.department) existing.departments.add(pr.department);
        existing.sources.push({
          prId: pr.id,
          itemIndex: itemIdx,
          requestor: pr.requestor || '-',
          department: pr.department || 'Umum',
          requestDate: pr.requestDate || '-',
          orderDate: item.orderDate || '-',
          arrivalDate: item.arrivalDate || '-',
          qty: qty,
          unitCost: unitCost,
          total: parseFloat(item.total) || (qty * unitCost)
        });
      }
    });
  });

  const masterList = Array.from(masterMap.values());

  // Hitung KPI Stat Cards Master Barang
  const totalMasterCount = masterList.length;
  const totalQty = masterList.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
  const totalValue = masterList.reduce((sum, it) => sum + (parseFloat(it.totalCost) || 0), 0);
  
  const allDepts = new Set();
  masterList.forEach(it => it.departments.forEach(d => allDepts.add(d)));
  const uniqueDepts = allDepts.size;

  const statItemsEl = document.getElementById('pr-stat-total-items');
  if (statItemsEl) statItemsEl.textContent = `${totalMasterCount} Master Barang`;

  const statQtyEl = document.getElementById('pr-stat-total-qty');
  if (statQtyEl) statQtyEl.textContent = `${totalQty.toLocaleString('id-ID')} Unit`;

  const statValEl = document.getElementById('pr-stat-total-val');
  if (statValEl) statValEl.textContent = formatRupiah(totalValue);

  const statDeptsEl = document.getElementById('pr-stat-total-depts');
  if (statDeptsEl) statDeptsEl.textContent = `${uniqueDepts} Divisi`;

  // Update Tab 3 Badge Count
  const badgeItems = document.getElementById('badge-tab-pr-items-count');
  if (badgeItems) badgeItems.textContent = totalMasterCount;

  if (!tbody) return;

  // Filter master items
  let filteredItems = [...masterList];

  const searchInput = document.getElementById('filter-purchasing-items-search');
  const searchVal = (searchInput ? searchInput.value : '') || state.searchQuery || '';
  if (searchVal.trim()) {
    const q = searchVal.trim().toLowerCase();
    filteredItems = filteredItems.filter(it => 
      it.itemName.toLowerCase().includes(q) ||
      it.specs.toLowerCase().includes(q) ||
      it.unit.toLowerCase().includes(q) ||
      it.sources.some(s => s.prId.toLowerCase().includes(q) || s.requestor.toLowerCase().includes(q))
    );
  }

  const deptFilter = document.getElementById('filter-purchasing-items-dept')?.value || 'ALL';
  if (deptFilter !== 'ALL') {
    filteredItems = filteredItems.filter(it => it.departments.has(deptFilter));
  }

  if (filteredItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted" style="padding: 32px 20px;">
          <i data-lucide="database" style="width: 32px; height: 32px; color: #94a3b8; margin: 0 auto 8px auto; display: block;"></i>
          <strong>Belum ada barang berstatus "Sesuai" di Database Master Barang.</strong>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 5px; max-width: 500px; margin-left: auto; margin-right: auto;">
            Barang pengadaan akan otomatis masuk ke Database Master Barang saat status pemeriksaan barang pada tab <strong>Proses Pembelian Barang</strong> diset menjadi <strong>🟢 Sesuai</strong>.
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="switchPurchasingTab('process')" style="margin-top: 12px;">
            <i data-lucide="shopping-cart"></i> Buka Tab Proses Pembelian Barang
          </button>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filteredItems.map((item, idx) => {
    const deptListStr = Array.from(item.departments).join(', ') || 'Umum';
    const isOutOfStock = item.qty <= 0;
    const prBadges = item.sources.map(s => 
      `<span class="badge badge-outline mono-id font-sm" style="font-size: 10px; cursor: pointer; padding: 1px 5px; margin: 1px;" onclick="viewPurchasingDetail('${s.prId}')" title="PR: ${s.prId} (Qty Masuk: ${s.qty} ${escapeAttr(item.unit)})">${s.prId}</span>`
    ).join(' ');

    const latestSource = item.sources[item.sources.length - 1];

    return `
      <tr>
        <td class="text-center font-bold text-muted">${idx + 1}</td>
        <td>
          <div class="font-bold text-main" style="font-size: 13.5px;">
            ${escapeAttr(item.itemName)}
          </div>
          ${item.specs ? `<div class="text-muted font-sm" style="font-size: 11.5px; margin-top: 2px;">${escapeAttr(item.specs)}</div>` : ''}
        </td>
        <td>
          <div style="font-size: 11.5px; font-weight: 600; color: #334155; margin-bottom: 2px;">${escapeAttr(deptListStr)}</div>
          <div style="display: flex; flex-wrap: wrap; gap: 2px; align-items: center;">
            <span class="text-muted font-sm" style="font-size: 10.5px;">PR:</span>
            ${prBadges}
          </div>
        </td>
        <td class="text-center font-bold" style="font-size: 14px; color: ${isOutOfStock ? '#dc2626' : '#15803d'};">
          ${item.qty}
        </td>
        <td class="text-center"><span class="badge badge-outline" style="font-size: 11px;">${escapeAttr(item.unit)}</span></td>
        <td class="text-right font-mono">${formatRupiah(item.unitCost)}</td>
        <td class="text-right font-mono font-bold text-primary">${formatRupiah(item.totalCost)}</td>
        <td class="text-center">
          <span class="badge ${isOutOfStock ? 'badge-danger' : 'badge-success'}" style="font-size: 11px; font-weight: 600;">
            ${isOutOfStock ? '🔴 Habis (0)' : '🟢 Sesuai & Tersedia'}
          </span>
        </td>
        <td class="text-right">
          <div class="table-actions" style="justify-content: flex-end; gap: 4px;">
            <button class="btn-icon" style="color: #15803d;" title="Lihat Detail Proses Pemeriksaan Barang (Terkunci Sesuai)" onclick="openProcessPurchasingItemModal('${latestSource.prId}', ${latestSource.itemIndex}, true)">
              <i data-lucide="eye"></i>
            </button>
            <button class="btn-icon" title="Lihat Dokumen PR Terkait" onclick="viewPurchasingDetail('${latestSource.prId}')">
              <i data-lucide="file-text"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// =========================================================
// MODAL EDIT DATA BARANG PR
// =========================================================

function openEditPurchasingItemModal(prId, itemIndex) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr || !pr.items || !pr.items[itemIndex]) {
    showToast('Data barang PR tidak ditemukan', 'error');
    return;
  }

  const item = pr.items[itemIndex];
  
  // Set hidden inputs
  const prIdInput = document.getElementById('edit-pr-item-pr-id');
  const indexInput = document.getElementById('edit-pr-item-index');
  const sourceInfo = document.getElementById('edit-pr-item-source-info');
  const nameInput = document.getElementById('edit-pr-item-name');
  const specsInput = document.getElementById('edit-pr-item-specs');
  const qtyInput = document.getElementById('edit-pr-item-qty');
  const unitInput = document.getElementById('edit-pr-item-unit');
  const priceInput = document.getElementById('edit-pr-item-price');

  if (prIdInput) prIdInput.value = pr.id;
  if (indexInput) indexInput.value = itemIndex;
  if (sourceInfo) sourceInfo.innerHTML = `<strong>${pr.id}</strong> — Pemohon: ${escapeAttr(pr.requestor || '-')} (${escapeAttr(pr.department || 'Umum')}) | Status: <span class="badge badge-sm badge-info">${pr.status || 'Pending'}</span>`;
  if (nameInput) nameInput.value = item.itemName || '';
  if (specsInput) specsInput.value = item.specs || '';
  if (qtyInput) qtyInput.value = item.qty || 1;
  if (unitInput) unitInput.value = item.unit || 'Pcs';
  if (priceInput) priceInput.value = item.purchasePrice !== undefined ? item.purchasePrice : (item.actualPrice !== undefined ? item.actualPrice : (item.estimatedPrice || item.unitPrice || 0));

  calculateEditPRItemTotal();
  openModal('modal-edit-purchasing-item');
  if (window.lucide) lucide.createIcons();
}

function calculateEditPRItemTotal() {
  const qty = parseFloat(document.getElementById('edit-pr-item-qty')?.value) || 0;
  const price = parseFloat(document.getElementById('edit-pr-item-price')?.value) || 0;
  const total = qty * price;

  const totalInput = document.getElementById('edit-pr-item-total');
  if (totalInput) {
    totalInput.value = formatRupiah(total);
  }
}

async function saveEditedPurchasingItem(e) {
  e.preventDefault();
  const prId = document.getElementById('edit-pr-item-pr-id')?.value;
  const itemIndex = parseInt(document.getElementById('edit-pr-item-index')?.value, 10);

  if (!prId || isNaN(itemIndex)) {
    showToast('Identifikasi PR / Barang tidak valid', 'error');
    return;
  }

  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr || !pr.items || !pr.items[itemIndex]) {
    showToast('Dokumen PR tidak ditemukan', 'error');
    return;
  }

  const itemName = document.getElementById('edit-pr-item-name')?.value.trim();
  const specs = document.getElementById('edit-pr-item-specs')?.value.trim();
  const qty = parseFloat(document.getElementById('edit-pr-item-qty')?.value) || 1;
  const unit = document.getElementById('edit-pr-item-unit')?.value.trim() || 'Pcs';
  const estimatedPrice = parseFloat(document.getElementById('edit-pr-item-price')?.value) || 0;
  const total = qty * estimatedPrice;

  if (!itemName) {
    showToast('Nama barang wajib diisi', 'warning');
    return;
  }

  // Clone items and update the specific item
  const updatedItems = [...pr.items];
  updatedItems[itemIndex] = {
    ...updatedItems[itemIndex],
    itemName,
    specs,
    qty,
    unit,
    estimatedPrice,
    unitPrice: estimatedPrice,
    purchasePrice: estimatedPrice,
    actualPrice: estimatedPrice,
    total
  };

  // Recalculate total estimated for the whole PR
  const newTotalEstimated = updatedItems.reduce((sum, it) => {
    const itTot = parseFloat(it.total) || ((parseFloat(it.qty) || 0) * (parseFloat(it.estimatedPrice || it.unitPrice) || 0));
    return sum + itTot;
  }, 0);

  const payload = {
    ...pr,
    items: updatedItems,
    totalEstimated: newTotalEstimated
  };

  try {
    const res = await fetch(`/api/purchasing/${prId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeModal('modal-edit-purchasing-item');
      showToast(`Data barang "${itemName}" pada ${prId} berhasil diperbarui!`, 'success');
      await fetchResource('purchasing');
      renderPurchasingTable();
      renderPurchasingProcessTable();
      renderPurchasingItemsTable();
      updateSidebarBadges();
    } else {
      showToast('Gagal menyimpan perubahan data barang', 'error');
    }
  } catch (err) {
    console.error('Error updating purchasing item:', err);
    showToast('Terjadi kesalahan jaringan saat menyimpan', 'error');
  }
}

// =========================================================
// HAPUS DATA BARANG DARI PR
// =========================================================

async function deletePurchasingItem(prId, itemIndex) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr || !pr.items || !pr.items[itemIndex]) {
    showToast('Data barang tidak ditemukan', 'error');
    return;
  }

  const item = pr.items[itemIndex];
  const itemName = item.itemName || `Barang #${itemIndex + 1}`;

  if (!confirm(`Apakah Anda yakin ingin menghapus barang:\n\n"${itemName}" (Qty: ${item.qty} ${item.unit || 'Pcs'})\n\ndari Dokumen Request Pengadaan ${prId}?`)) {
    return;
  }

  const updatedItems = pr.items.filter((_, idx) => idx !== itemIndex);
  const newTotalEstimated = updatedItems.reduce((sum, it) => {
    const itTot = parseFloat(it.total) || ((parseFloat(it.qty) || 0) * (parseFloat(it.estimatedPrice || it.unitPrice) || 0));
    return sum + itTot;
  }, 0);

  const payload = {
    ...pr,
    items: updatedItems,
    totalEstimated: newTotalEstimated
  };

  try {
    const res = await fetch(`/api/purchasing/${prId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(`Barang "${itemName}" berhasil dihapus dari ${prId}!`, 'success');
      await fetchResource('purchasing');
      renderPurchasingTable();
      renderPurchasingProcessTable();
      renderPurchasingItemsTable();
      updateSidebarBadges();
    } else {
      showToast('Gagal menghapus barang dari server', 'error');
    }
  } catch (err) {
    console.error('Error deleting purchasing item:', err);
    showToast('Terjadi kesalahan jaringan saat menghapus', 'error');
  }
}

// =========================================================
// EXPORT PR ITEMS TO CSV
// =========================================================

function exportPurchasingItemsToCSV() {
  const prList = state.purchasing || [];
  const approvedPRs = prList.filter(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');

  const masterMap = new Map();
  approvedPRs.forEach(pr => {
    (pr.items || []).forEach(it => {
      if (it.itemStatus !== 'Sesuai') return;
      const name = (it.itemName || '').trim();
      const specs = (it.specs || '').trim();
      if (!name) return;

      const key = `${name.toLowerCase()}:::${specs.toLowerCase()}`;
      const qty = parseFloat(it.qty) || 0;
      const unitCost = parseFloat(it.purchasePrice !== undefined ? it.purchasePrice : (it.actualPrice !== undefined ? it.actualPrice : (it.estimatedPrice || it.unitPrice || 0))) || 0;

      if (!masterMap.has(key)) {
        masterMap.set(key, {
          itemName: name,
          specs: specs,
          unit: it.unit || 'Pcs',
          qty: qty,
          unitCost: unitCost,
          totalCost: qty * unitCost,
          departments: [pr.department || 'Umum'],
          sources: [pr.id]
        });
      } else {
        const existing = masterMap.get(key);
        existing.qty += qty;
        if (unitCost > 0) existing.unitCost = unitCost;
        existing.totalCost = existing.qty * existing.unitCost;
        if (pr.department && !existing.departments.includes(pr.department)) existing.departments.push(pr.department);
        if (!existing.sources.includes(pr.id)) existing.sources.push(pr.id);
      }
    });
  });

  const rows = [
    ['No', 'Nama Barang', 'Spesifikasi', 'Departemen', 'Total Stok (Qty)', 'Satuan', 'Harga Beli Satuan (Rp)', 'Total Nilai Stok (Rp)', 'Status Stok', 'Sumber Dokumen PR']
  ];

  let counter = 1;
  masterMap.forEach(item => {
    rows.push([
      counter++,
      `"${item.itemName.replace(/"/g, '""')}"`,
      `"${item.specs.replace(/"/g, '""')}"`,
      `"${item.departments.join(', ').replace(/"/g, '""')}"`,
      item.qty,
      item.unit,
      item.unitCost,
      item.totalCost,
      item.qty > 0 ? 'Tersedia' : 'Habis',
      `"${item.sources.join(', ')}"`
    ]);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Database_Master_Barang_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================
// FORM MODAL DOKUMEN PR (CREATE / EDIT)
// =========================================================

function openPurchasingModal(prData = null, isClone = false) {
  const isEdit = !isClone && !!(prData && prData.id);
  const statusValue = isEdit ? (prData?.status || 'Pengajuan') : 'Pengajuan';
  const isApproved = !isClone && (statusValue === 'Disetujui' || statusValue === 'Stock' || statusValue === 'Approved');

  if (isEdit && isApproved) {
    showToast(`⚠️ Request Pengadaan ${prData.id} sudah berstatus Disetujui (Terkunci) sehingga tidak dapat diedit lagi!`, 'warning');
    return;
  }
  
  let modalTitle = 'Form Request Pengadaan Barang (PR)';
  if (isEdit) {
    modalTitle = `Edit Request Pengadaan: ${prData.id}`;
  } else if (isClone) {
    modalTitle = prData?.isClonedFrom ? `Salin & Ajukan Ulang PR (dari ${prData.isClonedFrom})` : 'Salin & Buat Pengajuan Baru';
  }
  document.getElementById('form-modal-title').textContent = modalTitle;
  
  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '980px';
    modalContainer.style.width = '92vw';
  }

  // Jika isEdit atau isClone, isi form sesuai data yang disediakan. Jika form baru biasa, kosongkan bersih.
  const hasPrefilledData = isEdit || isClone;
  const formRequestor = hasPrefilledData ? (prData?.requestor || '') : '';
  const formDepartment = hasPrefilledData ? (prData?.department || '') : '';
  const formUrgency = hasPrefilledData ? (prData?.urgency || '') : '';
  const formPurpose = hasPrefilledData ? (prData?.purpose || '') : '';
  const formRequestDate = hasPrefilledData ? (prData?.requestDate || (isClone ? new Date().toISOString().split('T')[0] : '')) : '';
  const formRequiredDate = hasPrefilledData ? (prData?.requiredDate || '') : '';
  const formNotes = hasPrefilledData ? (prData?.notes || '') : '';

  const isRejected = statusValue === 'Ditolak' || statusValue === 'Rejected';
  const statusBadge = isApproved ? 'badge-success' :
                      isRejected ? 'badge-danger' : 'badge-amber';
  const statusLabel = isApproved ? '🟢 Disetujui' :
                      isRejected ? '🔴 Ditolak' : '🟡 Pengajuan';

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="purchasing-form" onsubmit="submitPurchasing(event, '${isEdit ? prData.id : ''}')" style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- CARD 1: INFORMASI PEMOHON & STATUS PENGADAAN -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="clipboard-check" style="width: 16px; height: 16px; color: #2563eb;"></i> Informasi Pemohon & Status Pengadaan (PR)
        </h4>

        <div style="display: grid; grid-template-columns: 1.5fr 1.2fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Nama Pemohon (Requestor) *</label>
            <input type="text" name="requestor" class="form-control" placeholder="Nama pemohon / penanggung jawab" required value="${escapeAttr(formRequestor)}">
          </div>
          <div class="form-group">
            <label class="form-label">Departemen / Divisi *</label>
            <select name="department" class="form-control" required style="font-weight: 600;">
              <option value="" disabled ${!formDepartment ? 'selected' : ''}>-- Pilih Departemen / Divisi --</option>
              <option value="Engineering & Produksi" ${formDepartment === 'Engineering & Produksi' ? 'selected' : ''}>Engineering & Produksi</option>
              <option value="Fabrikasi & Las" ${formDepartment === 'Fabrikasi & Las' ? 'selected' : ''}>Fabrikasi & Las</option>
              <option value="Quality Control (QC)" ${formDepartment === 'Quality Control (QC)' ? 'selected' : ''}>Quality Control (QC)</option>
              <option value="Logistik & Gudang" ${formDepartment === 'Logistik & Gudang' ? 'selected' : ''}>Logistik & Gudang</option>
              <option value="Umum & Operasional" ${formDepartment === 'Umum & Operasional' ? 'selected' : ''}>Umum & Operasional</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tingkat Urgensi</label>
            <select name="urgency" class="form-control" style="font-weight: 600;">
              <option value="" disabled ${!formUrgency ? 'selected' : ''}>-- Pilih Tingkat Urgensi --</option>
              <option value="Normal" ${formUrgency === 'Normal' ? 'selected' : ''}>🟢 Normal (7 Hari)</option>
              <option value="Medium" ${formUrgency === 'Medium' ? 'selected' : ''}>🟡 Medium (3-5 Hari)</option>
              <option value="High" ${formUrgency === 'High' ? 'selected' : ''}>🔴 High / Urgent (1-2 Hari)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status Persetujuan</label>
            <input type="hidden" name="status" value="${escapeAttr(statusValue)}">
            <div class="form-control" style="background-color: #f8fafc; font-weight: 700; display: flex; align-items: center; justify-content: space-between; cursor: default; border-color: #cbd5e1;">
              <span class="badge ${statusBadge}" style="font-size: 11px; padding: 4px 8px;">${statusLabel}</span>
              <span class="text-muted font-sm" style="font-size: 10px; font-weight: 500;">${isClone ? 'Status Baru: Pengajuan' : 'Otomatis'}</span>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Tujuan / Keperluan Pengadaan</label>
            <input type="text" name="purpose" class="form-control" placeholder="Keperluan / tujuan pengadaan material" value="${escapeAttr(formPurpose)}">
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Pengajuan *</label>
            <input type="date" name="requestDate" class="form-control" required value="${formRequestDate}">
          </div>
          <div class="form-group">
            <label class="form-label">Target Tanggal Dibutuhkan</label>
            <input type="date" name="requiredDate" class="form-control" value="${formRequiredDate}">
          </div>
        </div>
      </div>

      <!-- CARD 2: DAFTAR BARANG / MATERIAL YANG DIAJUKAN -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="boxes" style="width: 16px; height: 16px; color: #10b981;"></i> Rincian Barang & Material yang Diajukan
            </h4>
            <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">
              💡 Pilih nama barang dari <strong>Database Master Barang</strong> untuk menambah stok yang sudah ada, atau ketik nama baru untuk mendaftarkan barang baru.
            </p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="addPurchasingItemRow()" style="font-size: 11.5px;">
            <i data-lucide="plus"></i> Tambah Baris Barang
          </button>
        </div>

        <datalist id="purchasing-master-items-datalist">
          ${getMasterItemsList().map(m => `<option value="${escapeAttr(m.itemName)}">${escapeAttr(m.itemName)} (${m.specs ? escapeAttr(m.specs) + ' | ' : ''}Stok Master: ${m.qty} ${m.unit} | Rp ${m.unitCost.toLocaleString('id-ID')})</option>`).join('')}
        </datalist>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
          <div style="display: grid; grid-template-columns: minmax(0, 2.5fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: #475569;">
            <div>Nama Barang (Ketik Baru / Pilih dari Master)</div>
            <div>Qty</div>
            <div>Satuan</div>
            <div>Estimasi Harga Satuan (Rp)</div>
            <div>Total Estimasi (Rp)</div>
            <div></div>
          </div>
          <div id="purchasing-items-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff;">
            <!-- Dynamically populated rows -->
          </div>
        </div>
      </div>

      <!-- CARD 3: CATATAN & KALKULASI FINANSIAL -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 14px; height: 14px; color: #64748b;"></i> Catatan Tambahan / Alasan Khusus
          </label>
          <textarea name="notes" class="form-control" rows="3" placeholder="Instruksi merk spesifik, toleransi komponen, catatan urgensi lapangan, dll...">${escapeAttr(formNotes)}</textarea>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <span class="text-muted font-bold">Subtotal Estimasi:</span>
              <span id="purchasing-subtotal-est" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 15px;">
              <span class="font-bold text-main">Total Estimasi Biaya PR:</span>
              <span id="purchasing-total-est" class="font-mono font-bold text-primary" style="font-size: 17px;">Rp 0</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border-color); margin-top: 4px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 9px 24px;">
          <i data-lucide="${isEdit ? 'save' : 'send'}"></i> ${isEdit ? 'Perbarui Pengajuan' : (isClone ? 'Ajukan Pengadaan Baru' : 'Kirim Request Pengadaan')}
        </button>
      </div>
    </form>
  `;

  const itemsContainer = document.getElementById('purchasing-items-list');
  if (prData && prData.items && prData.items.length > 0) {
    prData.items.forEach(item => addPurchasingItemRow(item));
  } else {
    addPurchasingItemRow();
  }

  calculatePurchasingTotals();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

// Helper: Ambil daftar Master Barang unik yang berstatus 'Sesuai'
function getMasterItemsList() {
  const prList = state.purchasing || [];
  const approvedPRs = prList.filter(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');
  const masterMap = new Map();

  approvedPRs.forEach(pr => {
    (pr.items || []).forEach((item, itemIdx) => {
      if (item.itemStatus !== 'Sesuai') return;
      const name = (item.itemName || '').trim();
      const specs = (item.specs || '').trim();
      if (!name) return;

      const key = `${name.toLowerCase()}:::${specs.toLowerCase()}`;
      const qty = parseFloat(item.qty) || 0;
      const unitCost = parseFloat(item.purchasePrice !== undefined ? item.purchasePrice : (item.actualPrice !== undefined ? item.actualPrice : (item.estimatedPrice || item.unitPrice || 0))) || 0;

      if (!masterMap.has(key)) {
        masterMap.set(key, {
          key,
          itemName: name,
          specs: specs,
          unit: item.unit || 'Pcs',
          qty: qty,
          unitCost: unitCost,
          sourcePrId: pr.id
        });
      } else {
        const existing = masterMap.get(key);
        existing.qty += qty;
        if (unitCost > 0) existing.unitCost = unitCost;
      }
    });
  });

  return Array.from(masterMap.values());
}

function onSelectMasterItemName(inputEl) {
  if (!inputEl) return;
  const val = inputEl.value?.trim().toLowerCase();
  const masterItems = getMasterItemsList();
  const matched = masterItems.find(m => m.itemName.toLowerCase() === val);
  const row = inputEl.closest('.item-row');
  if (!row) return;

  const hintEl = row.querySelector('.pr-master-item-badge');

  if (matched) {
    const unitInput = row.querySelector('.pr-item-unit');
    const priceInput = row.querySelector('.pr-item-price');

    if (unitInput && !unitInput.value) unitInput.value = matched.unit || 'Pcs';
    if (priceInput && (!priceInput.value || parseFloat(priceInput.value) === 0)) {
      priceInput.value = matched.unitCost || 0;
    }

    if (hintEl) {
      hintEl.innerHTML = `<span class="badge badge-success" style="font-size: 10px; padding: 2px 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="database" style="width: 10px; height: 10px;"></i> Master Terdaftar (Stok: ${matched.qty} ${matched.unit})</span>`;
      hintEl.style.display = 'block';
      if (window.lucide) lucide.createIcons();
    }
    calculatePurchasingTotals();
  } else {
    if (hintEl) {
      hintEl.innerHTML = val ? `<span class="badge badge-secondary" style="font-size: 10px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="plus-circle" style="width: 10px; height: 10px;"></i> Barang Baru</span>` : '';
      hintEl.style.display = val ? 'block' : 'none';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function addPurchasingItemRow(item = null) {
  const container = document.getElementById('purchasing-items-list');
  if (!container) return;

  const isSesuai = item && item.itemStatus === 'Sesuai';
  const row = document.createElement('div');
  row.className = 'item-row';
  row.style.cssText = `display: grid; grid-template-columns: minmax(0, 2.5fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; align-items: center; background: ${isSesuai ? '#f0fdf4' : '#ffffff'}; padding: 6px 8px; border-radius: 6px; border: 1px solid ${isSesuai ? '#bbf7d0' : '#e2e8f0'};`;
  
  const qtyVal = (item && item.qty !== undefined) ? item.qty : '';
  const unitVal = (item && item.unit !== undefined) ? item.unit : '';
  const priceVal = (item && (item.estimatedPrice !== undefined || item.unitPrice !== undefined || item.purchasePrice !== undefined))
    ? (item.estimatedPrice ?? item.unitPrice ?? item.purchasePrice)
    : '';
  const totalVal = (item && item.qty && (item.estimatedPrice || item.unitPrice || item.purchasePrice))
    ? formatRupiah(item.qty * (item.estimatedPrice || item.unitPrice || item.purchasePrice))
    : 'Rp 0';

  row.innerHTML = `
    <div>
      <input type="text" list="purchasing-master-items-datalist" class="form-control form-control-sm pr-item-name" placeholder="Pilih / ketik nama barang..." required value="${escapeAttr(item?.itemName || '')}" ${isSesuai ? 'readonly' : ''} oninput="onSelectMasterItemName(this)" style="font-size: 12px; ${isSesuai ? 'background: #f8fafc; font-weight: 600;' : ''}">
      <div class="pr-master-item-badge" style="margin-top: 3px; display: none;"></div>
    </div>
    <div>
      <input type="number" class="form-control form-control-sm pr-item-qty" placeholder="Qty" min="0.01" step="any" required value="${qtyVal}" ${isSesuai ? 'readonly' : ''} oninput="calculatePurchasingTotals()" style="font-size: 12px; font-weight: 600; ${isSesuai ? 'background: #f8fafc;' : ''}">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm pr-item-unit" placeholder="Pcs/Kg/Set" required value="${escapeAttr(unitVal)}" ${isSesuai ? 'readonly' : ''} style="font-size: 12px; ${isSesuai ? 'background: #f8fafc;' : ''}">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm pr-item-price" placeholder="Estimasi Harga" required value="${priceVal}" ${isSesuai ? 'readonly' : ''} oninput="calculatePurchasingTotals()" style="font-size: 12px; font-weight: 600; ${isSesuai ? 'background: #f8fafc;' : ''}">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm pr-item-total" readonly value="${totalVal}" style="font-size: 12px; font-weight: 700; background: #f8fafc; color: #1e293b;">
    </div>
    <div style="text-align: center;">
      ${isSesuai ? `
        <span title="Terkunci: Barang sudah Sesuai & masuk Master Barang" style="color: #15803d; font-size: 13px; cursor: default; display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="lock" style="width: 14px; height: 14px;"></i></span>
      ` : `
        <button type="button" class="btn-icon btn-danger-ghost btn-sm" title="Hapus Baris" onclick="this.closest('.item-row').remove(); calculatePurchasingTotals();"><i data-lucide="trash-2"></i></button>
      `}
    </div>
  `;

  container.appendChild(row);
  const nameInput = row.querySelector('.pr-item-name');
  if (nameInput && nameInput.value) {
    onSelectMasterItemName(nameInput);
  }
  if (window.lucide) lucide.createIcons();
}

function calculatePurchasingTotals() {
  const rows = document.querySelectorAll('#purchasing-items-list .item-row');
  let totalEst = 0;
  
  rows.forEach(r => {
    const qty = parseFloat(r.querySelector('.pr-item-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.pr-item-price')?.value) || 0;
    const total = qty * price;
    totalEst += total;
    const totalInput = r.querySelector('.pr-item-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const subEl = document.getElementById('purchasing-subtotal-est');
  if (subEl) subEl.textContent = formatRupiah(totalEst);

  const totEl = document.getElementById('purchasing-total-est');
  if (totEl) totEl.textContent = formatRupiah(totalEst);

  return totalEst;
}

async function submitPurchasing(e, editId = '') {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const items = [];
  document.querySelectorAll('#purchasing-items-list .item-row').forEach(r => {
    const itemName = r.querySelector('.pr-item-name')?.value?.trim();
    if (!itemName) return;
    const qty = parseFloat(r.querySelector('.pr-item-qty')?.value) || 1;
    const unit = r.querySelector('.pr-item-unit')?.value?.trim() || 'Pcs';
    const estimatedPrice = parseFloat(r.querySelector('.pr-item-price')?.value) || 0;
    items.push({
      itemName,
      qty,
      unit,
      estimatedPrice,
      unitPrice: estimatedPrice,
      purchasePrice: estimatedPrice,
      actualPrice: estimatedPrice,
      total: qty * estimatedPrice,
      itemStatus: 'Belum Dipesan'
    });
  });

  if (items.length === 0) {
    showToast('Harap tambahkan minimal 1 barang pengadaan', 'warning');
    return;
  }

  const isActuallyEdit = editId && editId !== '' && editId !== 'undefined' && editId !== 'null';
  const existingPR = isActuallyEdit ? (state.purchasing || []).find(p => p.id === editId) : null;

  if (isActuallyEdit && existingPR && (existingPR.status === 'Disetujui' || existingPR.status === 'Stock' || existingPR.status === 'Approved')) {
    showToast(`⚠️ Request Pengadaan ${existingPR.id} sudah berstatus Disetujui (Terkunci) sehingga tidak dapat diedit lagi!`, 'warning');
    closeModal('form-modal');
    return;
  }

  // Preserve existing item process data if editing
  if (existingPR && existingPR.items) {
    items.forEach((newItem, idx) => {
      if (existingPR.items[idx]) {
        const oldIt = existingPR.items[idx];
        if (oldIt.orderDate) newItem.orderDate = oldIt.orderDate;
        if (oldIt.orderLink) newItem.orderLink = oldIt.orderLink;
        if (oldIt.purchasePrice !== undefined) newItem.purchasePrice = oldIt.purchasePrice;
        if (oldIt.arrivalDate) newItem.arrivalDate = oldIt.arrivalDate;
        if (oldIt.recipientName || oldIt.recipient || oldIt.receivedBy) {
          newItem.recipientName = oldIt.recipientName || oldIt.recipient || oldIt.receivedBy;
          newItem.recipient = newItem.recipientName;
          newItem.receivedBy = newItem.recipientName;
        }
        if (oldIt.itemPhoto) newItem.itemPhoto = oldIt.itemPhoto;
        if (oldIt.itemStatus) newItem.itemStatus = oldIt.itemStatus;
        if (oldIt.notes) newItem.notes = oldIt.notes;
      }
    });
  }

  const totalEstimated = calculatePurchasingTotals();
  const payload = {
    requestor: formData.get('requestor') || 'Umum',
    department: formData.get('department') || 'Engineering & Produksi',
    requestDate: formData.get('requestDate') || new Date().toISOString().split('T')[0],
    requiredDate: formData.get('requiredDate') || '',
    urgency: formData.get('urgency') || 'Normal',
    purpose: formData.get('purpose') || '',
    status: isActuallyEdit ? (existingPR?.status || formData.get('status') || 'Pengajuan') : 'Pengajuan',
    items,
    totalEstimated,
    notes: formData.get('notes') || ''
  };

  try {
    let res;
    if (isActuallyEdit) {
      res = await fetch(`/api/purchasing/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/purchasing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('form-modal');
      showToast(`Request Pengadaan berhasil ${isActuallyEdit ? 'diperbarui' : 'diajukan'}! Dokumen masuk ke Daftar Dokumen PR.`, 'success');
      await fetchResource('purchasing');
      switchPurchasingTab('docs');
      renderPurchasingTable();
      renderPurchasingProcessTable();
      renderPurchasingItemsTable();
      updateSidebarBadges();
    } else {
      showToast('Gagal menyimpan request pengadaan', 'error');
    }
  } catch (err) {
    console.error('Error saving purchasing:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

function viewPurchasingDetail(prId) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr) return;

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'Unit Bisnis Mandiri (UBM) Politeknik Takumi',
    tagline: 'Engineering, Manufacturing, & Automation Solutions',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi'
  };

  const content = document.getElementById('preview-modal-content');
  content.innerHTML = `
    <div class="doc-preview">
      <div class="doc-header">
        <div>
          <div class="company-name">${escapeHtml(compSettings.companyName)}</div>
          <div class="text-muted font-sm">${escapeHtml(compSettings.tagline)}</div>
          <div class="font-xs text-muted" style="margin-top: 2px;">${escapeHtml(compSettings.address || '')}</div>
        </div>
        <div class="text-right">
          <h2 style="font-size: 20px; font-weight: 800; color: #1e293b;">PURCHASE REQUISITION</h2>
          <div class="font-mono font-bold text-primary">${pr.id}</div>
          <div class="font-sm text-muted">Tanggal: ${pr.requestDate}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding: 14px; background: #f8fafc; border-radius: 6px;">
        <div>
          <div class="font-sm font-bold text-muted">PEMOHON (REQUESTOR):</div>
          <div class="font-bold text-main" style="font-size: 15px;">${escapeAttr(pr.requestor)}</div>
          <div>Divisi: <strong>${escapeAttr(pr.department)}</strong></div>
          <div class="font-sm text-muted">Keperluan: ${escapeAttr(pr.purpose || '-')}</div>
        </div>
        <div class="text-right">
          <div class="font-sm font-bold text-muted">URGENSI & STATUS:</div>
          <div>Urgensi: <span class="badge badge-purple">${pr.urgency || 'Normal'}</span></div>
          <div>Status PR: <span class="badge ${pr.status === 'Disetujui' || pr.status === 'Stock' ? 'badge-success' : (pr.status === 'Ditolak' ? 'badge-danger' : 'badge-info')}">${pr.status || 'Pengajuan'}</span></div>
        </div>
      </div>

      <table class="doc-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Barang / Material & Spesifikasi</th>
            <th class="text-center">Qty</th>
            <th class="text-center">Satuan</th>
            <th class="text-right">Estimasi / Harga Beli</th>
            <th class="text-right">Total</th>
            <th class="text-center">Status Pembelian</th>
          </tr>
        </thead>
        <tbody>
          ${(pr.items || []).map((it, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td class="font-bold">
                ${escapeAttr(it.itemName)}
                ${it.specs ? `<div class="text-muted font-sm font-normal">${escapeAttr(it.specs)}</div>` : ''}
              </td>
              <td class="text-center font-bold">${it.qty}</td>
              <td class="text-center">${escapeAttr(it.unit || 'Pcs')}</td>
              <td class="text-right">${formatRupiah(it.purchasePrice !== undefined ? it.purchasePrice : (it.actualPrice !== undefined ? it.actualPrice : (it.estimatedPrice || it.unitPrice || 0)))}</td>
              <td class="text-right font-bold">${formatRupiah(it.total || (it.qty * (it.purchasePrice !== undefined ? it.purchasePrice : (it.estimatedPrice || it.unitPrice || 0))))}</td>
              <td class="text-center">
                <span class="badge ${it.itemStatus === 'Sesuai' ? 'badge-success' : (it.itemStatus === 'Tidak Sesuai' ? 'badge-danger' : (it.itemStatus === 'Dalam Pengiriman' ? 'badge-primary' : 'badge-secondary'))}">
                  ${it.itemStatus || 'Belum Dipesan'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="doc-totals">
        <div class="calc-summary" style="margin-left: auto;">
          <div class="calc-row total"><span>Total Estimasi Biaya:</span><span>${formatRupiah(pr.totalEstimated || 0)}</span></div>
        </div>
      </div>

      ${pr.notes ? `<div class="mt-4 p-3 bg-light rounded font-sm"><strong>Catatan Khusus:</strong> ${escapeAttr(pr.notes)}</div>` : ''}

      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center;">
        <div>
          <div class="font-sm text-muted">Pemohon,</div>
          <div style="margin-top: 50px; font-weight: bold;">( ${escapeAttr(pr.requestor)} )</div>
        </div>
        <div>
          <div class="font-sm text-muted">Disetujui Oleh (Head of Dept),</div>
          <div style="margin-top: 50px; font-weight: bold;">( Department Manager )</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
}

function editPurchasing(prId) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr) return;
  const isApproved = pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved';
  if (isApproved) {
    showToast(`⚠️ Request Pengadaan ${pr.id} sudah berstatus Disetujui (Terkunci) sehingga tidak dapat diedit lagi!`, 'warning');
    return;
  }
  openPurchasingModal(pr);
}

// Salin Data PR dan Buka Form untuk Diajukan Kembali sebagai PR Baru
function duplicateAndReapplyPR(prId) {
  const pr = (state.purchasing || []).find(p => p.id === prId);
  if (!pr) {
    showToast('Data Request Pengadaan tidak ditemukan', 'warning');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const clonedData = {
    requestor: pr.requestor || '',
    department: pr.department || '',
    urgency: pr.urgency || 'Normal',
    purpose: pr.purpose ? `${pr.purpose} (Salinan dari ${pr.id})` : `Salinan dari ${pr.id}`,
    requestDate: today,
    requiredDate: pr.requiredDate || '',
    notes: pr.notes ? `${pr.notes} (Diajukan ulang dari ${pr.id})` : `Diajukan ulang dari ${pr.id}`,
    status: 'Pengajuan',
    isClonedFrom: pr.id,
    items: (pr.items || []).map(it => {
      const unitPrice = parseFloat(it.estimatedPrice !== undefined ? it.estimatedPrice : (it.unitPrice !== undefined ? it.unitPrice : (it.purchasePrice || 0))) || 0;
      const qty = parseFloat(it.qty) || 1;
      return {
        itemName: it.itemName || '',
        qty: qty,
        unit: it.unit || 'Pcs',
        estimatedPrice: unitPrice,
        unitPrice: unitPrice,
        purchasePrice: unitPrice,
        actualPrice: unitPrice,
        total: qty * unitPrice,
        itemStatus: 'Belum Dipesan'
      };
    })
  };

  openPurchasingModal(clonedData, true);
  showToast(`Data PR ${pr.id} berhasil disalin! Silakan sesuaikan rincian dan klik 'Ajukan Pengadaan Baru'.`, 'info');
}

