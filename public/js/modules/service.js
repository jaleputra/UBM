// =========================================================
// UBM - Service & Warranty Module (After Sales)
// Tab 1: Garansi Project (Completed Project Warranty & Warranty Claims)
// Tab 2: Service & Pengajuan Biaya (Non-Warranty / Manual Service)
// =========================================================

let currentActiveServiceTab = 'warranty';

function isProjectCompletedForService(project) {
  if (!project) return false;
  const validOrderExists = (state.orders || []).some(o => o.id === project.orderId || o.id === project.id);
  if (!validOrderExists) return false;

  if (project.status === 'Completed') return true;
  if (project.progressPercent === 100) return true;
  if (Array.isArray(project.milestones) && project.milestones.length > 0) {
    return project.milestones.every(m => m.status === 'Completed');
  }
  const bast = (state.bast || []).find(b => b.projectId === project.id || b.projectName === project.projectName);
  if (bast && bast.status === 'Completed') return true;

  return false;
}

function getProjectWarrantyInfo(project) {
  if (!project) return null;
  const order = (state.orders || []).find(o => o.id === project.orderId || o.id === project.id);
  const quotationId = order?.quotationId || (order?.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]);
  const quotation = (state.quotations || []).find(q => q.id === quotationId || (q.projectName && q.projectName.toLowerCase() === project.projectName?.toLowerCase()));
  const bast = (state.bast || []).find(b => b.projectId === project.id || b.projectName === project.projectName);

  // Ambil teks garansi dari Quotation (prioritas utama), Order, atau BAST
  let warrantyText = quotation?.warranty || order?.warranty || bast?.warrantyPeriod || 'Garansi resmi 12 bulan untuk suku cadang dan servis';
  
  // Tentukan item warranty jika ada di items quotation / order
  const itemWarranties = (quotation?.items || order?.items || []).map(it => ({
    name: it.itemName || it.name || 'Unit Produk',
    warranty: it.warranty || quotation?.warranty || '12 Bulan',
    qty: it.qty || 1,
    unit: it.unit || 'Unit',
    unitPrice: parseFloat(it.unitPrice || 0) || 0,
    total: parseFloat(it.total || 0) || 0
  }));

  // Total Nilai Produk & Jasa Sebelum Pajak (DPP / Sesuai Quotation Items Total)
  const itemsTotal = parseFloat(
    quotation?.itemsTotal || 
    (quotation?.items && quotation.items.length > 0 ? quotation.items.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0) ||
    (order?.items && order.items.length > 0 ? order.items.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0) ||
    order?.subtotal || 
    quotation?.subtotal || 
    0
  ) || 0;

  // Total Nilai Order / Penjualan (Grand Total jika ada, atau itemsTotal / project budget)
  const orderTotal = parseFloat(order?.grandTotal || quotation?.grandTotal || (itemsTotal > 0 ? itemsTotal : (project?.totalBudget || 0))) || 0;

  // Nominal Biaya / Plafon Garansi 5% yang Ditentukan (Terkunci Sesuai Penawaran / Quotation)
  let allocatedWarrantyAmount = 0;
  if (quotation?.warrantyFee !== undefined && quotation?.warrantyFee !== null && parseFloat(quotation.warrantyFee) > 0) {
    allocatedWarrantyAmount = parseFloat(quotation.warrantyFee);
  } else if (order?.warrantyFee !== undefined && order?.warrantyFee !== null && parseFloat(order.warrantyFee) > 0) {
    allocatedWarrantyAmount = parseFloat(order.warrantyFee);
  } else if (order?.warrantyAmount) {
    allocatedWarrantyAmount = parseFloat(order.warrantyAmount);
  } else if (quotation?.warrantyAmount) {
    allocatedWarrantyAmount = parseFloat(quotation.warrantyAmount);
  } else if (project?.warrantyBudget) {
    allocatedWarrantyAmount = parseFloat(project.warrantyBudget);
  } else {
    // Sesuai rumus Quotation: 5% dari total produk & jasa (itemsTotal sebelum pajak)
    allocatedWarrantyAmount = itemsTotal > 0 ? Math.round(itemsTotal * 0.05) : (orderTotal > 0 ? Math.round(orderTotal * 0.05) : 1000000);
  }

  // Riwayat klaim garansi untuk project ini
  const claims = (state.warranty_claims || []).filter(c => c.projectId === project.id || c.orderId === (project.orderId || project.id));
  const totalClaimed = claims.reduce((sum, c) => sum + (parseFloat(c.claimCost || c.cost || 0) || 0), 0);
  const remainingWarrantyBalance = allocatedWarrantyAmount - totalClaimed;

  // Hitung tanggal mulai garansi (berdasarkan BAST, tanggal milestone terakhir, atau order date)
  let startDateStr = bast?.bastDate || project.updatedAt?.split('T')[0] || order?.orderDate || new Date().toISOString().split('T')[0];
  const startDate = new Date(startDateStr);

  // Parsing durasi garansi (default 12 bulan jika tidak ada angka spesifik)
  let months = 12;
  const monthMatch = warrantyText.match(/(\d+)\s*(bulan|month|thn|tahun|year)/i);
  if (monthMatch) {
    const val = parseInt(monthMatch[1], 10);
    const unit = monthMatch[2].toLowerCase();
    if (unit.startsWith('t') || unit.startsWith('y')) {
      months = val * 12;
    } else {
      months = val;
    }
  }

  // Hitung tanggal selesai garansi
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  const endDateStr = endDate.toISOString().split('T')[0];

  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = diffDays < 0;

  return {
    project,
    order,
    quotation,
    bast,
    claims,
    totalClaimed,
    orderTotal,
    allocatedWarrantyAmount,
    remainingWarrantyBalance,
    warrantyText,
    itemWarranties,
    startDateStr,
    endDateStr,
    months,
    diffDays,
    isExpired
  };
}

// -------------------------------------------------------------
// 0. TAB SWITCHER (GARANSI vs SERVICE NON-GARANSI)
// -------------------------------------------------------------
function switchServiceTab(tabName) {
  currentActiveServiceTab = tabName;

  const btnWarranty = document.getElementById('tab-btn-service-warranty');
  const btnTickets = document.getElementById('tab-btn-service-tickets');
  const contentWarranty = document.getElementById('service-warranty-tab-content');
  const contentTickets = document.getElementById('service-tickets-tab-content');

  if (tabName === 'warranty') {
    if (btnWarranty) btnWarranty.classList.add('active');
    if (btnTickets) btnTickets.classList.remove('active');
    if (contentWarranty) contentWarranty.style.display = 'block';
    if (contentTickets) contentTickets.style.display = 'none';
    renderServiceTable();
  } else {
    if (btnTickets) btnTickets.classList.add('active');
    if (btnWarranty) btnWarranty.classList.remove('active');
    if (contentWarranty) contentWarranty.style.display = 'none';
    if (contentTickets) contentTickets.style.display = 'block';
    renderServiceTicketsTable();
  }

  updateServiceTabBadges();
}

function updateServiceTabBadges() {
  const completedProjects = (state.projects || []).filter(p => isProjectCompletedForService(p));
  const badgeWarranty = document.getElementById('badge-tab-service-warranty-count');
  if (badgeWarranty) badgeWarranty.textContent = completedProjects.length;

  const tickets = state.service_tickets || [];
  const badgeTickets = document.getElementById('badge-tab-service-tickets-count');
  if (badgeTickets) badgeTickets.textContent = tickets.length;
}

// -------------------------------------------------------------
// 1. RENDER TAB 1: TABEL GARANSI PROYEK RESMI
// -------------------------------------------------------------
function renderServiceTable() {
  const tbody = document.getElementById('table-service-body');
  if (!tbody) return;

  const filterStatus = document.getElementById('filter-service-status')?.value || 'ALL';
  const allProjects = state.projects || [];
  let completedProjects = allProjects.filter(p => isProjectCompletedForService(p));

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    completedProjects = completedProjects.filter(p =>
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.orderId && p.orderId.toLowerCase().includes(q)) ||
      (p.projectName && p.projectName.toLowerCase().includes(q)) ||
      (p.customerName && p.customerName.toLowerCase().includes(q)) ||
      (p.projectLead && p.projectLead.toLowerCase().includes(q))
    );
  }

  // Filter Status Garansi
  if (filterStatus === 'Active') {
    completedProjects = completedProjects.filter(p => {
      const info = getProjectWarrantyInfo(p);
      return info && !info.isExpired;
    });
  } else if (filterStatus === 'Expired') {
    completedProjects = completedProjects.filter(p => {
      const info = getProjectWarrantyInfo(p);
      return info && info.isExpired;
    });
  }

  if (completedProjects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted" style="padding: 36px 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <i data-lucide="shield-alert" style="width: 36px; height: 36px; color: #94a3b8;"></i>
            <div style="font-weight: 700; color: #475569; font-size: 14px;">Tidak ada data garansi project</div>
            <div style="font-size: 12px; color: #94a3b8;">Hanya project berstatus <strong>Completed</strong> dengan klausul garansi dari Quotation yang ditampilkan di sini.</div>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = completedProjects.map(p => {
    const info = getProjectWarrantyInfo(p);
    const quoId = info.quotation?.id || (info.order?.quotationId) || '-';

    return `
      <tr style="transition: background-color 0.15s ease;">
        <td>
          <span class="mono-id font-bold text-primary" style="font-size: 11.5px;">${p.id}</span>
          ${p.orderId ? `<div class="font-xs text-muted font-mono" style="font-size: 10px; margin-top: 2px;">Ref: ${p.orderId}</div>` : ''}
          ${quoId !== '-' ? `<div class="font-xs text-purple font-mono" style="font-size: 10px;">Quo: ${quoId}</div>` : ''}
        </td>
        <td>
          <div class="font-bold text-main" style="word-break: break-word; font-size: 13px; color: #0f172a;">${escapeHtml(p.projectName || 'Project')}</div>
          <div class="text-muted font-sm" style="font-size: 11.5px; margin-top: 2px;"><i data-lucide="building" style="width: 11px; height: 11px; display: inline;"></i> ${escapeHtml(p.customerName || '-')}</div>
        </td>
        <td>
          <div style="font-size: 12px; font-weight: 600; color: #1e293b; max-width: 240px; line-height: 1.35;">
            <i data-lucide="shield-check" style="width: 13px; height: 13px; color: #16a34a; display: inline; vertical-align: middle;"></i>
            ${escapeHtml(info.warrantyText)}
          </div>
          <div style="margin-top: 5px; font-size: 11px; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; gap: 6px;">
              <span class="text-muted font-xs">Plafon Garansi:</span>
              <strong class="font-mono" style="color: #0f172a;">${formatRupiah(info.allocatedWarrantyAmount)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 6px; margin-top: 2px; border-top: 1px dashed #e2e8f0; padding-top: 2px;">
              <span class="text-muted font-xs">Sisa Plafon:</span>
              <strong class="font-mono" style="color: ${info.remainingWarrantyBalance >= 0 ? '#15803d' : '#b91c1c'};">
                ${formatRupiah(info.remainingWarrantyBalance)}
              </strong>
            </div>
            ${info.claims.length > 0 ? `
              <div style="margin-top: 3px; font-size: 10px; color: #64748b; text-align: right;">
                <span class="badge badge-secondary" style="font-size: 9.5px; padding: 1px 5px;">${info.claims.length} Klaim Diajukan</span>
              </div>
            ` : ''}
          </div>
        </td>
        <td style="font-size: 11.5px;">
          <div><span class="text-muted font-xs">Mulai:</span> <strong>${info.startDateStr}</strong></div>
          <div style="margin-top: 2px;"><span class="text-muted font-xs">Selesai:</span> <strong>${info.endDateStr}</strong></div>
        </td>
        <td style="text-align: center;">
          ${!info.isExpired ? `
            <span class="badge badge-success font-bold" style="font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="clock" style="width: 12px; height: 12px;"></i> Sisa ${info.diffDays} Hari
            </span>
            <div class="font-xs text-muted" style="font-size: 10px; margin-top: 3px;">Durasi ${info.months} Bulan</div>
          ` : `
            <span class="badge badge-outline" style="color: #ef4444; border-color: #fca5a5; font-size: 11px; padding: 3px 8px; background: #fef2f2; font-weight: 700;">
              <i data-lucide="alert-triangle" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> Telah Berakhir
            </span>
          `}
        </td>
        <td style="text-align: center;">
          ${!info.isExpired ? `
            <span class="badge badge-outline" style="color: #059669; border-color: #a7f3d0; background: #ecfdf5; font-size: 11px; padding: 3px 8px; font-weight: 700;">
              🟢 Garansi Aktif
            </span>
          ` : `
            <span class="badge badge-outline" style="color: #64748b; border-color: #cbd5e1; background: #f8fafc; font-size: 11px; padding: 3px 8px;">
              🔴 Expired
            </span>
          `}
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div style="display: inline-flex; gap: 5px; align-items: center; justify-content: flex-end;">
            <button class="btn btn-sm btn-outline" style="color: #b45309; border-color: #f59e0b; background: #fffbeb; font-size: 11px; padding: 5px 9px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="openWarrantyClaimModal('${p.id}')" title="Ajukan / Input Klaim Garansi untuk Proyek Ini">
              <i data-lucide="shield-alert" style="width: 13px; height: 13px; color: #d97706;"></i> Klaim Garansi
            </button>
            <button class="btn btn-sm btn-primary" style="background: #2563eb; border-color: #2563eb; font-size: 11px; padding: 5px 9px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="viewWarrantyCard('${p.id}')" title="Lihat & Cetak Kartu Garansi Resmi">
              <i data-lucide="file-badge" style="width: 13px; height: 13px;"></i> Cetak Kartu
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  updateServiceTabBadges();
}

function filterServiceTable() {
  renderServiceTable();
}

// -------------------------------------------------------------
// 1.1 MODAL KLAIM GARANSI (OFFICIAL WARRANTY CLAIM MODAL)
// -------------------------------------------------------------
function openWarrantyClaimModal(projectId, editClaimId = null) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan', 'error');
    return;
  }

  const info = getProjectWarrantyInfo(p);
  const existingClaim = editClaimId ? (state.warranty_claims || []).find(c => c.id === editClaimId) : null;
  
  // Hitung total klaim sebelumnya di luar klaim yang sedang diedit (jika edit mode)
  const previousClaims = (info.claims || []).filter(c => !editClaimId || c.id !== editClaimId);
  const previousClaimsTotal = previousClaims.reduce((s, c) => s + (parseFloat(c.claimCost || c.cost || 0) || 0), 0);
  const currentRemaining = info.allocatedWarrantyAmount - previousClaimsTotal;

  // Generate ID Klaim baru jika tidak ada
  const claimId = existingClaim?.id || `CLM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100 + Math.random() * 900)}`;

  const modalTitle = document.getElementById('form-modal-title');
  const modalBody = document.getElementById('form-modal-body');
  if (!modalTitle || !modalBody) return;

  modalTitle.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <i data-lucide="shield-alert" style="color: #d97706; width: 20px; height: 20px;"></i>
      <span>Formulir Klaim Garansi Project: <strong>${escapeHtml(p.projectName)}</strong> (${p.id})</span>
    </div>
  `;

  // Item list html dari quotation / order
  const itemsHtml = info.itemWarranties.map((it, idx) => `
    <tr>
      <td style="text-align: center; font-size: 11px; padding: 6px 8px; border: 1px solid #e2e8f0;">${idx + 1}</td>
      <td style="font-weight: 700; font-size: 11.5px; color: #0f172a; padding: 6px 8px; border: 1px solid #e2e8f0;">${escapeHtml(it.name)}</td>
      <td style="text-align: center; font-size: 11.5px; font-family: monospace; padding: 6px 8px; border: 1px solid #e2e8f0;">${it.qty} ${escapeHtml(it.unit)}</td>
      <td style="text-align: center; font-size: 11.5px; font-weight: 700; color: #16a34a; padding: 6px 8px; border: 1px solid #e2e8f0;">${escapeHtml(it.warranty)}</td>
      <td style="text-align: right; font-size: 11.5px; font-family: monospace; padding: 6px 8px; border: 1px solid #e2e8f0;">${formatRupiah(it.unitPrice)}</td>
      <td style="text-align: right; font-size: 11.5px; font-family: monospace; font-weight: 700; color: #2563eb; padding: 6px 8px; border: 1px solid #e2e8f0;">${formatRupiah(it.total)}</td>
    </tr>
  `).join('');

  // Riwayat klaim HTML jika ada
  const claimsHistoryHtml = (info.claims || []).map((c, idx) => `
    <tr style="font-size: 11px;">
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; font-weight: 700;" class="font-mono text-primary">${c.id}</td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px;">${c.claimDate || '-'}</td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; font-weight: 600;">${escapeHtml(c.reporterName || '-')}</td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.issueDescription || '-')}</td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #b45309;">${formatRupiah(c.claimCost || c.cost || 0)}</td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;">
        <span class="badge ${c.status === 'Resolved' || c.status === 'Disetujui & Selesai' ? 'badge-success' : 'badge-warning'}" style="font-size: 9.5px; padding: 2px 6px;">
          ${c.status || 'Diajukan'}
        </span>
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: right;">
        <button type="button" class="btn btn-xs btn-outline" style="padding: 2px 6px; font-size: 10px;" onclick="viewWarrantyClaimPrint('${c.id}')" title="Cetak Dokumen Klaim Garansi">
          <i data-lucide="printer" style="width: 11px; height: 11px; display: inline;"></i> Cetak
        </button>
      </td>
    </tr>
  `).join('');

  modalBody.innerHTML = `
    <form id="form-warranty-claim" onsubmit="submitWarrantyClaim(event, '${p.id}', '${editClaimId || ''}')" style="display: flex; flex-direction: column; gap: 16px;">
      <input type="hidden" name="claimId" value="${claimId}">
      <input type="hidden" name="projectId" value="${p.id}">
      <input type="hidden" name="orderId" value="${p.orderId || p.id}">
      <input type="hidden" name="projectName" value="${escapeAttr(p.projectName || '')}">
      <input type="hidden" name="customerName" value="${escapeAttr(p.customerName || '')}">

      <!-- CARD 1: DETAIL QUOTATION & ORDER PENJUALAN (READ-ONLY ACCORDING TO QUOTATION/ORDER) -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-check" style="width: 16px; height: 16px; color: #2563eb;"></i>
            Detail Penawaran (Quotation) & Order Penjualan (SO) Terkait
          </div>
          <div>
            ${!info.isExpired ? `
              <span class="badge badge-success font-bold" style="font-size: 11px; padding: 3px 8px;">
                <i data-lucide="shield-check" style="width: 12px; height: 12px; display: inline;"></i> Garansi Aktif (Hingga ${info.endDateStr})
              </span>
            ` : `
              <span class="badge badge-outline" style="color: #ef4444; border-color: #fca5a5; background: #fef2f2; font-weight: 700;">Garansi Telah Berakhir</span>
            `}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 12px; margin-bottom: 12px;">
          <div>
            <span class="text-muted font-xs">Pelanggan / Customer:</span>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${escapeHtml(p.customerName || '-')}</div>
            <div class="text-muted font-xs" style="margin-top: 2px;">PIC: ${escapeHtml(info.quotation?.picName || info.order?.customerPhone || '-')}</div>
          </div>
          <div>
            <span class="text-muted font-xs">Ref Order Penjualan (SO):</span>
            <div class="mono-id font-bold" style="color: #2563eb; font-size: 12px;">${p.orderId || p.id}</div>
            <div class="text-muted font-xs" style="margin-top: 2px;">Tgl Order: ${info.order?.orderDate || '-'}</div>
          </div>
          <div>
            <span class="text-muted font-xs">Ref Surat Penawaran (Quotation):</span>
            <div class="mono-id font-bold text-purple" style="font-size: 12px;">${info.quotation?.id || '-'}</div>
            <div class="text-muted font-xs" style="margin-top: 2px;">Tgl Penawaran: ${info.quotation?.quotationDate || '-'}</div>
          </div>
          <div>
            <span class="text-muted font-xs">Ketentuan Klausul Garansi:</span>
            <div style="font-weight: 700; color: #15803d;">${escapeHtml(info.warrantyText)}</div>
            <div class="text-muted font-xs" style="margin-top: 2px;">Masa Berlaku: ${info.startDateStr} s/d ${info.endDateStr}</div>
          </div>
        </div>

        <!-- Tabel Item Barang dari Quotation / Order -->
        <div style="margin-top: 8px;">
          <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 5px;">Rincian Barang / Unit Hasil Order Penjualan:</div>
          <div class="table-responsive" style="max-height: 140px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
            <table class="data-table" style="margin: 0; width: 100%;">
              <thead>
                <tr style="background: #f1f5f9; font-size: 10.5px;">
                  <th style="width: 35px; text-align: center;">No</th>
                  <th>Nama Barang / Produk</th>
                  <th style="width: 90px; text-align: center;">Qty</th>
                  <th style="width: 100px; text-align: center;">Garansi</th>
                  <th style="width: 110px; text-align: right;">Harga Satuan</th>
                  <th style="width: 120px; text-align: right;">Total Nilai</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- CARD 2: NOMINAL BIAYA GARANSI YANG DITENTUKAN & KALKULASI REAL-TIME (LOCKED PLAFON) -->
      <div style="background: #ffffff; border: 1.5px solid #2563eb; border-radius: 8px; padding: 14px 16px;">
        <div style="font-size: 13px; font-weight: 800; color: #1e40af; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="calculator" style="width: 16px; height: 16px; color: #2563eb;"></i>
            <span>Alokasi Plafon Garansi & Kalkulasi Sisa Biaya</span>
          </div>
          <div style="font-size: 11px; background: #eff6ff; color: #1e40af; padding: 3px 8px; border-radius: 4px; border: 1px solid #bfdbfe; font-weight: 700;">
            <i data-lucide="lock" style="width: 11px; height: 11px; display: inline;"></i> Plafon Garansi Terkunci (Sesuai Kontrak)
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 14px;">
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 11.5px; color: #64748b;">Total Nilai Order / Penjualan (Rp)</label>
            <input type="text" class="form-control font-mono font-bold" readonly value="${formatRupiah(info.orderTotal)}" style="background: #f8fafc; color: #334155; font-size: 12.5px;">
          </div>
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 11.5px; color: #1e3a8a;">
              Nominal Biaya Garansi Ditentukan (Plafon) *
            </label>
            <input type="text" id="locked-warranty-plafon-display" class="form-control font-mono font-bold" readonly value="${formatRupiah(info.allocatedWarrantyAmount)}" style="background: #f1f5f9; color: #0f172a; font-size: 13.5px; border-color: #94a3b8;">
            <input type="hidden" id="locked-warranty-plafon" name="allocatedWarrantyAmount" value="${info.allocatedWarrantyAmount}">
            <small class="text-muted" style="font-size: 10px; display: block; margin-top: 3px;">
              <i data-lucide="lock" style="width: 10px; height: 10px; display: inline;"></i> Plafon garansi resmi tidak dapat diubah secara manual.
            </small>
          </div>
          <div>
            <label class="form-label" style="font-weight: 600; font-size: 11.5px; color: #64748b;">Total Klaim Sebelumnya (Rp)</label>
            <input type="text" class="form-control font-mono font-bold" readonly value="${formatRupiah(previousClaimsTotal)}" style="background: #f8fafc; color: #b45309; font-size: 12.5px;">
          </div>
        </div>

        <!-- INPUT BIAYA KLAIM MANUAL & PENGURANGAN OTOMATIS -->
        <div style="background: #fffbeb; border: 1.5px dashed #f59e0b; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
          <div style="display: grid; grid-template-columns: 1.2fr 1.5fr; gap: 14px; align-items: center;">
            <div>
              <label class="form-label font-bold" style="font-size: 12.5px; color: #92400e; margin-bottom: 4px;">
                Input Biaya Klaim Garansi Manual (Rp) *
              </label>
              <input type="number" id="input-claim-manual-cost" name="claimCost" class="form-control font-mono font-bold" min="0" step="any" required value="${existingClaim?.claimCost || existingClaim?.cost || 0}" placeholder="0" oninput="calculateWarrantyClaimBalance(${info.allocatedWarrantyAmount}, ${previousClaimsTotal})" style="font-size: 16px; color: #b45309; background: #ffffff; border: 2px solid #f59e0b;">
              <small style="font-size: 10.5px; color: #78350f; margin-top: 3px; display: block;">Masukkan estimasi biaya perbaikan / suku cadang klaim ini.</small>
            </div>

            <!-- LIVE BALANCE DISPLAY -->
            <div style="background: #ffffff; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Sisa Saldo Plafon Garansi:</span>
                <span id="claim-balance-badge" class="badge badge-success" style="font-size: 10px; padding: 2px 6px;">🟢 Saldo Cukup</span>
              </div>
              <div id="claim-remaining-balance-display" class="font-mono font-bold" style="font-size: 18px; color: #15803d; margin-top: 4px;">
                ${formatRupiah(currentRemaining - (existingClaim?.claimCost || existingClaim?.cost || 0))}
              </div>
              <div id="claim-balance-hint" class="font-xs text-muted" style="font-size: 10.5px; margin-top: 2px;">
                (Plafon: ${formatRupiah(info.allocatedWarrantyAmount)} - Klaim Sebelumnya: ${formatRupiah(previousClaimsTotal)} - Klaim Saat Ini)
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CARD 3: FORMULIR DETAIL PENGAJUAN KLAIM GARANSI -->
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="clipboard-list" style="width: 16px; height: 16px; color: #2563eb;"></i>
          Formulir & Rincian Klaim Garansi
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">No. Tiket Klaim Garansi</label>
            <input type="text" class="form-control font-mono font-bold" readonly value="${claimId}" style="background: #f8fafc; font-size: 12px;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Tanggal Pengajuan Klaim *</label>
            <input type="date" name="claimDate" class="form-control" required value="${existingClaim?.claimDate || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">PIC Pelapor (Customer) *</label>
            <input type="text" name="reporterName" class="form-control" required placeholder="Nama PIC Pelapor" value="${escapeAttr(existingClaim?.reporterName || info.quotation?.picName || '')}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Teknisi PIC Penanggung Jawab (UBM) *</label>
            <input type="text" name="technicianName" class="form-control" required placeholder="Nama Teknisi UBM" value="${escapeAttr(existingClaim?.technicianName || p.projectLead || 'Teknisi UBM')}">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Status Klaim Garansi *</label>
            <select name="status" class="form-control font-bold" required>
              <option value="Diajukan" ${existingClaim?.status === 'Diajukan' ? 'selected' : ''}>🔵 Diajukan (Menunggu Pengecekan)</option>
              <option value="Dalam Pengerjaan" ${existingClaim?.status === 'Dalam Pengerjaan' ? 'selected' : ''}>🟡 Dalam Pengerjaan (Perbaikan Garansi)</option>
              <option value="Disetujui & Selesai" ${existingClaim?.status === 'Disetujui & Selesai' || existingClaim?.status === 'Resolved' ? 'selected' : ''}>🟢 Disetujui & Selesai (Covered)</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Deskripsi Kendala / Kerusakan yang Diklaim *</label>
          <textarea name="issueDescription" class="form-control" rows="2" required placeholder="Jelaskan secara detail malfungsi, cacat pengerjaan, atau kerusakan komponen yang diklaim customer...">${escapeAttr(existingClaim?.issueDescription || '')}</textarea>
        </div>

        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Tindakan Perbaikan & Suku Cadang yang Dicover Garansi *</label>
          <textarea name="actionTaken" class="form-control" rows="2" required placeholder="Contoh: Penggantian modul sensor proximity, kalibrasi ulang motor driver, dan pengujian fungsi tanpa biaya tambahan.">${escapeAttr(existingClaim?.actionTaken || existingClaim?.actionPlan || 'Pemeriksaan teknis dan penggantian suku cadang garansi resmi.')}</textarea>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Catatan Tambahan</label>
          <input type="text" name="notes" class="form-control" placeholder="Catatan hasil inspeksi, nomor surat tugas, dll" value="${escapeAttr(existingClaim?.notes || '')}">
        </div>
      </div>

      <!-- CARD 4: RIWAYAT KLAIM GARANSI TERDAHULU JIKA ADA -->
      ${info.claims.length > 0 ? `
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 8px;">
            Riwayat Klaim Garansi Proyek Ini (${info.claims.length} Klaim Diajukan):
          </div>
          <div class="table-responsive" style="max-height: 160px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
            <table class="data-table" style="margin: 0; width: 100%;">
              <thead>
                <tr style="background: #f1f5f9; font-size: 10.5px;">
                  <th style="width: 120px;">No. Klaim</th>
                  <th style="width: 90px;">Tanggal</th>
                  <th style="width: 120px;">Pelapor</th>
                  <th>Keluhan Kerusakan</th>
                  <th style="width: 110px; text-align: right;">Biaya Klaim</th>
                  <th style="width: 110px; text-align: center;">Status</th>
                  <th style="width: 70px; text-align: right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${claimsHistoryHtml}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- MODAL FOOTER BUTTONS -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 14px; border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 10px;">
        <div>
          ${existingClaim ? `
            <button type="button" class="btn btn-outline btn-sm" style="color: #4338ca; border-color: #c7d2fe;" onclick="viewWarrantyClaimPrint('${existingClaim.id}')">
              <i data-lucide="printer"></i> Cetak Formulir Klaim
            </button>
          ` : ''}
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
          <button type="submit" class="btn btn-primary" style="padding: 9px 24px; background: #2563eb; border-color: #2563eb; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="check-circle"></i> ${existingClaim ? 'Simpan Perubahan Klaim Garansi' : 'Simpan & Ajukan Klaim Garansi'}
          </button>
        </div>
      </div>
    </form>
  `;

  openModal('form-modal');
  calculateWarrantyClaimBalance(info.allocatedWarrantyAmount, previousClaimsTotal);
  if (window.lucide) lucide.createIcons();
}

function calculateWarrantyClaimBalance(allocatedWarrantyAmount, previousClaimsTotal) {
  const manualCostInput = document.getElementById('input-claim-manual-cost');
  const balanceDisplay = document.getElementById('claim-remaining-balance-display');
  const balanceBadge = document.getElementById('claim-balance-badge');
  const balanceHint = document.getElementById('claim-balance-hint');

  const manualCost = parseFloat(manualCostInput?.value || 0) || 0;
  const currentRemaining = allocatedWarrantyAmount - previousClaimsTotal - manualCost;

  if (balanceDisplay) {
    balanceDisplay.textContent = formatRupiah(currentRemaining);
    balanceDisplay.style.color = currentRemaining >= 0 ? '#15803d' : '#b91c1c';
  }

  if (balanceBadge) {
    if (currentRemaining >= 0) {
      balanceBadge.className = 'badge badge-success';
      balanceBadge.innerHTML = '🟢 Saldo Cukup';
    } else {
      balanceBadge.className = 'badge badge-danger';
      balanceBadge.innerHTML = `⚠️ Melebihi Plafon (${formatRupiah(Math.abs(currentRemaining))})`;
    }
  }

  if (balanceHint) {
    balanceHint.innerHTML = `Plafon: ${formatRupiah(allocatedWarrantyAmount)} - Klaim Sebelum: ${formatRupiah(previousClaimsTotal)} - Klaim Ini: ${formatRupiah(manualCost)} = <strong>${formatRupiah(currentRemaining)}</strong>`;
  }
}

async function submitWarrantyClaim(event, projectId, editClaimId) {
  event.preventDefault();
  const form = event.target;

  const claimCost = parseFloat(form.claimCost.value) || 0;
  const allocatedWarrantyAmount = parseFloat(form.allocatedWarrantyAmount.value) || 0;

  const payload = {
    id: form.claimId.value,
    projectId: form.projectId.value,
    orderId: form.orderId.value,
    projectName: form.projectName.value,
    customerName: form.customerName.value,
    claimDate: form.claimDate.value,
    reporterName: form.reporterName.value,
    technicianName: form.technicianName.value,
    issueDescription: form.issueDescription.value,
    actionTaken: form.actionTaken.value,
    claimCost: claimCost,
    allocatedWarrantyAmount: allocatedWarrantyAmount,
    status: form.status.value,
    notes: form.notes.value || '',
    updatedAt: new Date().toISOString()
  };

  try {
    const isEdit = !!editClaimId;
    const url = isEdit ? `/api/warranty_claims/${editClaimId}` : '/api/warranty_claims';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }

    const savedData = await res.json();

    // Update local state
    if (!state.warranty_claims) state.warranty_claims = [];
    const idx = state.warranty_claims.findIndex(c => c.id === savedData.id);
    if (idx !== -1) {
      state.warranty_claims[idx] = savedData;
    } else {
      state.warranty_claims.unshift(savedData);
    }

    closeModal('form-modal');
    showToast(`Klaim garansi #${savedData.id} berhasil disimpan!`, 'success');
    renderServiceTable();
  } catch (err) {
    console.error('Error saving warranty claim:', err);
    showToast('Gagal menyimpan klaim garansi: ' + err.message, 'error');
  }
}

// -------------------------------------------------------------
// 1.2 CETAK DOKUMEN BUKTI KLAIM GARANSI (WARRANTY CLAIM SHEET)
// -------------------------------------------------------------
function viewWarrantyClaimPrint(claimId) {
  const claim = (state.warranty_claims || []).find(c => c.id === claimId);
  if (!claim) {
    showToast('Data klaim garansi tidak ditemukan', 'error');
    return;
  }

  const p = (state.projects || []).find(item => item.id === claim.projectId || item.orderId === claim.projectId || item.orderId === claim.orderId);
  const info = p ? getProjectWarrantyInfo(p) : null;

  const content = document.getElementById('preview-modal-content');
  const title = document.getElementById('preview-modal-title');
  if (!content || !title) return;

  title.innerHTML = `<i data-lucide="shield-alert" style="color: #d97706;"></i> Berita Acara & Lembar Klaim Garansi #${claim.id}`;

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'UBM POLITEKNIK TAKUMI',
    tagline: 'Unit Bisnis Mahasiswa - Teaching Factory & Engineering Solutions',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi | Email: ubm@takumi.ac.id',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  const claimCostVal = parseFloat(claim.claimCost || claim.cost || 0);
  const plafonVal = parseFloat(claim.allocatedWarrantyAmount || info?.allocatedWarrantyAmount || 0);

  content.innerHTML = `
    <!-- NO-PRINT ACTIONS -->
    <div class="no-print" style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="font-sm font-bold text-muted">Status Klaim Garansi:</span>
        <span class="badge ${claim.status === 'Disetujui & Selesai' || claim.status === 'Resolved' ? 'badge-success' : 'badge-warning'}" style="font-weight: 700;">
          ${claim.status || 'Diajukan'}
        </span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn btn-sm btn-primary" style="background: #2563eb; border-color: #2563eb; display: inline-flex; align-items: center; gap: 6px;" onclick="printCurrentDocument()">
          <i data-lucide="printer"></i> Cetak Lembar Klaim (PDF)
        </button>
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="quotation-printable-area" class="print-container">
      <div class="print-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 19px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">${escapeHtml(compSettings.companyName.toUpperCase())}</h1>
            <div style="font-size: 11.5px; font-weight: 700; color: #1e40af; margin-top: 2px;">${escapeHtml(compSettings.tagline)}</div>
            <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">${escapeHtml(compSettings.address)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: #d97706; letter-spacing: 0.5px;">BERITA ACARA KLAIM GARANSI</div>
            <div class="mono-id" style="font-size: 12px; color: #334155; margin-top: 2px;">No: ${claim.id}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">OFFICIAL WARRANTY CLAIM SERVICE</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 140px; color: #64748b; padding: 3px 0;">Nama Project / Mesin:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(claim.projectName || p?.projectName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Nama Pelanggan:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(claim.customerName || p?.customerName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">PIC Pelapor Kerusakan:</td>
              <td style="font-weight: 600;">${escapeHtml(claim.reporterName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">No. Ref Order Penjualan:</td>
              <td style="font-family: monospace; font-weight: 600;">${claim.orderId || p?.orderId || '-'}</td>
            </tr>
          </table>
        </div>
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 140px; color: #64748b; padding: 3px 0;">Tanggal Klaim Garansi:</td>
              <td style="font-weight: 600;">${claim.claimDate || '-'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Teknisi Penanggung Jawab:</td>
              <td style="font-weight: 700; color: #2563eb;">${escapeHtml(claim.technicianName || 'Teknisi UBM')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Status Klaim:</td>
              <td style="font-weight: 700; color: #16a34a;">${claim.status || 'Diajukan'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Ketentuan Garansi:</td>
              <td style="font-weight: 600;">${escapeHtml(info?.warrantyText || 'Garansi Resmi UBM')}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- DESKRIPSI KLAIM & PERBAIKAN -->
      <div style="margin-bottom: 18px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; font-size: 12px;">
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px;">Keluhan / Kerusakan yang Dilaporkan Customer:</div>
        <div style="color: #475569; line-height: 1.5;">${escapeHtml(claim.issueDescription || '-')}</div>
        <div style="font-weight: 700; color: #334155; margin-top: 10px; margin-bottom: 4px;">Tindakan Perbaikan & Suku Cadang yang Diganti (Covered):</div>
        <div style="color: #475569; line-height: 1.5;">${escapeHtml(claim.actionTaken || claim.actionPlan || '-')}</div>
        ${claim.notes ? `
          <div style="font-weight: 700; color: #334155; margin-top: 10px; margin-bottom: 4px;">Catatan Tambahan:</div>
          <div style="color: #475569; line-height: 1.5;">${escapeHtml(claim.notes)}</div>
        ` : ''}
      </div>

      <!-- REKAPITULASI BIAYA KLAIM VS PLAFON -->
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">
          Rekapitulasi Biaya Klaim & Plafon Garansi Kontrak
        </h4>
        <table class="data-table" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 11px;">
              <th style="width: 40px; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Uraian Pos Alokasi Biaya Garansi</th>
              <th style="width: 220px; text-align: right; border: 1px solid #cbd5e1; padding: 8px;">Jumlah Nominal (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">1</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">
                <strong>Alokasi Plafon Biaya Garansi yang Ditentukan (Kontrak)</strong>
                <div class="text-muted font-xs">Batas alokasi anggaran garansi resmi yang disediakan UBM Takumi</div>
              </td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-weight: 700; font-size: 12.5px;">${formatRupiah(plafonVal)}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">2</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">
                <strong>Nominal Biaya Perbaikan & Sparepart Klaim Ini</strong>
                <div class="text-muted font-xs">Total biaya aktual pekerjaan perbaikan & suku cadang garansi yang ditanggung</div>
              </td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-weight: 700; font-size: 12.5px; color: #b45309;">${formatRupiah(claimCostVal)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a;">
              <td colspan="2" style="text-align: right; padding: 10px 12px; font-size: 13px; color: #0f172a; text-transform: uppercase;">
                Sisa Saldo Plafon Garansi Setelah Klaim Ini:
              </td>
              <td style="text-align: right; padding: 10px 12px; font-family: monospace; font-size: 15px; color: ${plafonVal - claimCostVal >= 0 ? '#15803d' : '#b91c1c'}; border: 1px solid #cbd5e1;">
                ${formatRupiah(plafonVal - claimCostVal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- SIGNATURE SECTION -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; page-break-inside: avoid;">
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Pelapor (Pelanggan),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(claim.reporterName || claim.customerName || 'Pelapor')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">PIC Pelanggan</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Teknisi Pelaksana,</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(claim.technicianName || 'Teknisi UBM')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">UBM Service Engineer</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Menyetujui (Management),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(compSettings.leaderName || 'Ir. Hendra Wijaya, M.T.')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Head of After Sales / UBM</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// 2. RENDER TAB 2: TABEL SERVICE & PENGAJUAN BIAYA NON-GARANSI
// -------------------------------------------------------------
function renderServiceTicketsTable() {
  const tbody = document.getElementById('table-service-tickets-body');
  if (!tbody) return;

  const filterStatus = document.getElementById('filter-ticket-status')?.value || 'ALL';
  let tickets = state.service_tickets || [];

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tickets = tickets.filter(t =>
      (t.id && t.id.toLowerCase().includes(q)) ||
      (t.unitName && t.unitName.toLowerCase().includes(q)) ||
      (t.projectName && t.projectName.toLowerCase().includes(q)) ||
      (t.customerName && t.customerName.toLowerCase().includes(q)) ||
      (t.technicianName && t.technicianName.toLowerCase().includes(q)) ||
      (t.serviceCategory && t.serviceCategory.toLowerCase().includes(q)) ||
      (t.issueDescription && t.issueDescription.toLowerCase().includes(q))
    );
  }

  // Filter Status
  if (filterStatus !== 'ALL') {
    tickets = tickets.filter(t => t.status === filterStatus);
  }

  // Sort descending by date
  tickets = tickets.sort((a, b) => new Date(b.requestDate || b.createdAt || 0) - new Date(a.requestDate || a.createdAt || 0));

  // Hitung KPI
  const totalCost = tickets.reduce((s, t) => s + (parseFloat(t.cost || t.totalCost || 0) || 0), 0);
  const openCount = tickets.filter(t => t.status === 'Open').length;
  const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;

  const kpiTotalTickets = document.getElementById('kpi-service-total-tickets');
  if (kpiTotalTickets) kpiTotalTickets.textContent = `${tickets.length} Pengajuan`;

  const kpiTotalCost = document.getElementById('kpi-service-total-cost');
  if (kpiTotalCost) kpiTotalCost.textContent = formatRupiah(totalCost);

  const kpiProgressCount = document.getElementById('kpi-service-progress-count');
  if (kpiProgressCount) kpiProgressCount.textContent = `${inProgressCount} Berjalan / ${openCount} Open`;

  const kpiResolvedCount = document.getElementById('kpi-service-resolved-count');
  if (kpiResolvedCount) kpiResolvedCount.textContent = `${resolvedCount} Selesai`;

  if (tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 36px 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <i data-lucide="wrench" style="width: 36px; height: 36px; color: #94a3b8;"></i>
            <div style="font-weight: 700; color: #475569; font-size: 14px;">Belum ada data service & pengajuan biaya non-garansi</div>
            <div style="font-size: 12px; color: #94a3b8;">Klik tombol <strong>+ Input Service & Pengajuan Biaya</strong> untuk mencatat perbaikan manual di luar garansi beserta estimasi biaya perbaikan.</div>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    let statusBadge = `<span class="badge badge-outline" style="color: #0284c7; border-color: #bae6fd; background: #f0f9ff; font-weight: 700;">🔵 Open / Diajukan</span>`;
    if (t.status === 'In Progress') {
      statusBadge = `<span class="badge badge-amber" style="font-weight: 700; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;"><i data-lucide="clock" style="width: 12px; height: 12px; display: inline;"></i> In Progress</span>`;
    } else if (t.status === 'Resolved') {
      statusBadge = `<span class="badge badge-success" style="font-weight: 700;"><i data-lucide="check-circle-2" style="width: 12px; height: 12px; display: inline;"></i> Selesai (Resolved)</span>`;
    }

    const totalCostVal = parseFloat(t.cost || t.totalCost || 0) || 0;
    const laborCostVal = parseFloat(t.laborCost || 0);
    const partCostVal = parseFloat(t.partCost || 0);
    const transportCostVal = parseFloat(t.transportCost || 0);
    const unitDisplay = t.unitName || t.projectName || 'Unit / Mesin Pelanggan';

    return `
      <tr>
        <td>
          <span class="mono-id font-bold text-primary" style="font-size: 11.5px;">${t.id}</span>
          <div class="font-xs text-muted" style="font-size: 10px; margin-top: 2px;">Tgl: ${t.requestDate || '-'}</div>
        </td>
        <td>
          <div class="font-bold text-main" style="font-size: 12.5px; color: #0f172a;">${escapeHtml(t.customerName || '-')}</div>
          <div class="text-muted font-xs" style="margin-top: 2px;"><i data-lucide="cpu" style="width: 10px; height: 10px; display: inline;"></i> ${escapeHtml(unitDisplay)} ${t.customerPhone ? `&bull; ${escapeHtml(t.customerPhone)}` : ''}</div>
        </td>
        <td>
          <div style="font-weight: 600; font-size: 12px; color: #1e293b;">${escapeHtml(t.serviceCategory || 'Service Non-Garansi')}</div>
          <div class="text-muted font-xs" style="font-size: 11px; margin-top: 2px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(t.issueDescription || '-')}</div>
        </td>
        <td>
          <div style="font-size: 12px; font-weight: 700; color: #334155;">${escapeHtml(t.technicianName || '-')}</div>
          <div class="text-muted font-xs" style="font-size: 10px;">Teknisi UBM</div>
        </td>
        <td style="font-size: 11px;">
          ${laborCostVal > 0 ? `<div><span class="text-muted">Jasa:</span> <strong class="font-mono">${formatRupiah(laborCostVal)}</strong></div>` : ''}
          ${partCostVal > 0 ? `<div><span class="text-muted">Part:</span> <strong class="font-mono">${formatRupiah(partCostVal)}</strong></div>` : ''}
          ${transportCostVal > 0 ? `<div><span class="text-muted">Ops:</span> <strong class="font-mono">${formatRupiah(transportCostVal)}</strong></div>` : ''}
          ${laborCostVal === 0 && partCostVal === 0 && transportCostVal === 0 ? `<div class="text-muted font-xs">Pengajuan langsung</div>` : ''}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: 800; font-size: 13px; color: #2563eb;">
          ${formatRupiah(totalCostVal)}
        </td>
        <td style="text-align: center;">
          ${statusBadge}
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: flex-end;">
            <button class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="viewServiceTicketPrint('${t.id}')" title="Pratinjau & Cetak Form Pengajuan Biaya">
              <i data-lucide="printer" style="width: 13px; height: 13px;"></i> Cetak
            </button>
            <button class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="openEditServiceModal('${t.id}')" title="Edit Service & Pengajuan Biaya">
              <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color: #fca5a5;" onclick="deleteServiceTicket('${t.id}')" title="Hapus Data Service">
              <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  updateServiceTabBadges();
}

function filterServiceTicketsTable() {
  renderServiceTicketsTable();
}

// -------------------------------------------------------------
// 3. CREATE & EDIT MODAL (TAB 2: SERVICE & PENGAJUAN BIAYA)
// -------------------------------------------------------------
function openCreateServiceModal() {
  openServiceTicketFormModal(null);
}

function openEditServiceModal(ticketId) {
  const t = (state.service_tickets || []).find(item => item.id === ticketId);
  if (!t) {
    showToast('Tiket service tidak ditemukan', 'error');
    return;
  }
  openServiceTicketFormModal(t);
}

function openServiceTicketFormModal(existingTicket = null) {
  const modalTitle = document.getElementById('form-modal-title');
  const modalBody = document.getElementById('form-modal-body');
  if (!modalTitle || !modalBody) return;

  const isEdit = !!existingTicket;
  const ticketId = existingTicket?.id || `SRV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100 + Math.random() * 900)}`;

  modalTitle.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <i data-lucide="wrench" style="color: #2563eb; width: 20px; height: 20px;"></i>
      <span>${isEdit ? 'Edit Formulir Service & Pengajuan Biaya' : 'Input Service & Pengajuan Biaya Perbaikan (Non-Garansi)'}</span>
    </div>
  `;

  // Opsi preset dari order/project jika ingin autofill customer
  const projectOptions = (state.projects || []).map(p => `
    <option value="${p.id}" ${existingTicket?.projectId === p.id ? 'selected' : ''}>
      ${p.id} - ${escapeHtml(p.projectName)} (${escapeHtml(p.customerName || 'Customer')})
    </option>
  `).join('');

  modalBody.innerHTML = `
    <form id="form-service-ticket" onsubmit="submitServiceTicket(event, '${existingTicket?.id || ''}')" style="display: flex; flex-direction: column; gap: 14px;">
      <input type="hidden" name="ticketId" value="${ticketId}">

      <!-- ROW 1: NO TIKET & TANGGAL -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">No. Tiket Service</label>
          <input type="text" class="form-control font-mono font-bold" value="${ticketId}" readonly style="background: #f8fafc; font-size: 12px;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Tanggal Masuk / Permintaan Service *</label>
          <input type="date" name="requestDate" class="form-control" required value="${existingTicket?.requestDate || new Date().toISOString().split('T')[0]}">
        </div>
      </div>

      <!-- ROW 2: PILIH PRESET CUSTOMER ATAU INPUT MANUAL -->
      <div class="form-group" style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px dashed var(--border-color);">
        <label class="form-label" style="font-weight: 600; font-size: 11.5px; color: #475569; margin-bottom: 4px;">
          <i data-lucide="link" style="width: 12px; height: 12px; display: inline;"></i> Hubungkan dengan Data Project / Customer Terdaftar (Opsional):
        </label>
        <select id="select-claim-project" name="projectId" class="form-control" onchange="onServiceProjectPresetSelected(this.value)">
          <option value="">-- Input Manual (Customer Bebas / Unit Eksternal) --</option>
          ${projectOptions}
        </select>
      </div>

      <!-- ROW 3: INFORMASI PELANGGAN & UNIT MESIN -->
      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Nama Pelanggan / Perusahaan *</label>
          <input type="text" id="input-service-customer" name="customerName" class="form-control" required value="${escapeAttr(existingTicket?.customerName || '')}" placeholder="Contoh: PT Tri Mitra Mandiri">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Kontak / No. Telepon Pelanggan</label>
          <input type="text" id="input-service-phone" name="customerPhone" class="form-control" value="${escapeAttr(existingTicket?.customerPhone || '')}" placeholder="0812-xxxx-xxxx">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Nama Unit Mesin / Peralatan yang Diservis *</label>
          <input type="text" id="input-service-unit" name="unitName" class="form-control" required value="${escapeAttr(existingTicket?.unitName || existingTicket?.projectName || '')}" placeholder="Contoh: CNC Milling 3-Axis / Conveyor Belt Assembly">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Lokasi Pengerjaan</label>
          <input type="text" name="serviceLocation" class="form-control" value="${escapeAttr(existingTicket?.serviceLocation || 'Workshop UBM Takumi')}" placeholder="Workshop UBM / On-site Customer">
        </div>
      </div>

      <!-- ROW 4: KATEGORI & TEKNISI -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Kategori Layanan Service *</label>
          <select name="serviceCategory" class="form-control" required>
            <option value="Perbaikan Kerusakan Mekanikal" ${existingTicket?.serviceCategory === 'Perbaikan Kerusakan Mekanikal' ? 'selected' : ''}>Perbaikan Kerusakan Mekanikal</option>
            <option value="Penggantian Sparepart & Komponen" ${existingTicket?.serviceCategory === 'Penggantian Sparepart & Komponen' ? 'selected' : ''}>Penggantian Sparepart & Komponen</option>
            <option value="Troubleshooting Kelistrikan & Sensor" ${existingTicket?.serviceCategory === 'Troubleshooting Kelistrikan & Sensor' ? 'selected' : ''}>Troubleshooting Kelistrikan & Sensor</option>
            <option value="Overhaul & Retrofit Mesin" ${existingTicket?.serviceCategory === 'Overhaul & Retrofit Mesin' ? 'selected' : ''}>Overhaul & Retrofit Mesin</option>
            <option value="Fabrikasi & Modifikasi Part" ${existingTicket?.serviceCategory === 'Fabrikasi & Modifikasi Part' ? 'selected' : ''}>Fabrikasi & Modifikasi Part</option>
            <option value="Setting & Kalibrasi Presisi" ${existingTicket?.serviceCategory === 'Setting & Kalibrasi Presisi' ? 'selected' : ''}>Setting & Kalibrasi Presisi</option>
            <option value="Maintenance & Servis Berkala Non-Garansi" ${existingTicket?.serviceCategory === 'Maintenance & Servis Berkala Non-Garansi' ? 'selected' : ''}>Maintenance & Servis Berkala Non-Garansi</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Teknisi / PIC Penanggung Jawab *</label>
          <input type="text" name="technicianName" class="form-control" required value="${escapeAttr(existingTicket?.technicianName || 'Teknisi UBM')}" placeholder="Nama Teknisi Pelaksana">
        </div>
      </div>

      <!-- ROW 5: KELUHAN & TINDAKAN -->
      <div class="form-group">
        <label class="form-label" style="font-weight: 600; font-size: 12px;">Deskripsi Gejala / Keluhan Kerusakan *</label>
        <textarea name="issueDescription" class="form-control" rows="2" required placeholder="Jelaskan detail kendala teknis, indikasi kerusakan, atau perbaikan yang dibutuhkan...">${escapeAttr(existingTicket?.issueDescription || '')}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight: 600; font-size: 12px;">Rencana Tindakan / Pekerjaan Perbaikan</label>
        <input type="text" name="actionPlan" class="form-control" placeholder="Contoh: Pembongkaran motor spindle, penggantian bearing & setting ulang presisi" value="${escapeAttr(existingTicket?.actionPlan || 'Pemeriksaan menyeluruh dan perbaikan unit')}">
      </div>

      <!-- RINCIAN BIAYA SERVICE & PENGAJUAN (NON-GARANSI) -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
        <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="calculator" style="width: 16px; height: 16px; color: #2563eb;"></i>
          Rincian Pengajuan Biaya Service (Non-Garansi)
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Biaya Jasa Servis (Rp)</label>
            <input type="number" id="input-cost-labor" name="laborCost" class="form-control" min="0" value="${existingTicket?.laborCost ?? 0}" placeholder="0" oninput="calculateServiceTotalCost()">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Biaya Sparepart / Bahan (Rp)</label>
            <input type="number" id="input-cost-part" name="partCost" class="form-control" min="0" value="${existingTicket?.partCost ?? 0}" placeholder="0" oninput="calculateServiceTotalCost()">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-weight: 600; font-size: 11.5px;">Biaya Transport / Ops (Rp)</label>
            <input type="number" id="input-cost-transport" name="transportCost" class="form-control" min="0" value="${existingTicket?.transportCost ?? 0}" placeholder="0" oninput="calculateServiceTotalCost()">
          </div>
        </div>

        <!-- TOTAL PENGAJUAN BIAYA -->
        <div style="margin-top: 12px; padding: 12px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #1e40af;">Total Biaya Service yang Diajukan:</div>
            <div class="font-xs text-muted">Biaya di luar garansi yang akan ditagihkan kepada pelanggan</div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="hidden" id="input-cost-total" name="cost" value="${existingTicket?.cost || existingTicket?.totalCost || 0}">
            <span id="label-cost-total-display" class="font-mono font-bold" style="font-size: 18px; color: #1e3a8a;">
              ${formatRupiah(existingTicket?.cost || existingTicket?.totalCost || 0)}
            </span>
          </div>
        </div>
      </div>

      <!-- STATUS & CATATAN -->
      <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Status Service *</label>
          <select name="status" class="form-control" required>
            <option value="Open" ${existingTicket?.status === 'Open' ? 'selected' : ''}>🔵 Open (Diajukan / Menunggu Persetujuan)</option>
            <option value="In Progress" ${existingTicket?.status === 'In Progress' ? 'selected' : ''}>🟡 In Progress (Sedang Ditangani Teknisi)</option>
            <option value="Resolved" ${existingTicket?.status === 'Resolved' ? 'selected' : ''}>🟢 Resolved (Perbaikan Selesai)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Catatan Tambahan</label>
          <input type="text" name="notes" class="form-control" placeholder="Catatan garansi part baru, nomor PO, dll" value="${escapeAttr(existingTicket?.notes || '')}">
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 14px; border-top: 1px solid var(--border-color);">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 8px 22px; background: #2563eb; border-color: #2563eb; font-weight: 700;">
          <i data-lucide="check"></i> ${existingTicket ? 'Simpan Perubahan Service' : 'Simpan & Ajukan Biaya Service'}
        </button>
      </div>
    </form>
  `;

  openModal('form-modal');
  calculateServiceTotalCost();
  if (window.lucide) lucide.createIcons();
}

function onServiceProjectPresetSelected(selectedProjectId) {
  if (!selectedProjectId) return;
  const p = (state.projects || []).find(item => item.id === selectedProjectId || item.orderId === selectedProjectId);
  if (!p) return;

  const custInput = document.getElementById('input-service-customer');
  if (custInput && (!custInput.value || custInput.value.trim() === '')) {
    custInput.value = p.customerName || '';
  }

  const unitInput = document.getElementById('input-service-unit');
  if (unitInput && (!unitInput.value || unitInput.value.trim() === '')) {
    unitInput.value = p.projectName || '';
  }

  const order = (state.orders || []).find(o => o.id === p.orderId || o.id === p.id);
  const phoneInput = document.getElementById('input-service-phone');
  if (phoneInput && (!phoneInput.value || phoneInput.value.trim() === '') && order?.customerPhone) {
    phoneInput.value = order.customerPhone;
  }
}

function calculateServiceTotalCost() {
  const labor = parseFloat(document.getElementById('input-cost-labor')?.value || 0) || 0;
  const part = parseFloat(document.getElementById('input-cost-part')?.value || 0) || 0;
  const transport = parseFloat(document.getElementById('input-cost-transport')?.value || 0) || 0;

  const total = labor + part + transport;
  const totalHidden = document.getElementById('input-cost-total');
  const displayLabel = document.getElementById('label-cost-total-display');

  if (totalHidden) totalHidden.value = total;
  if (displayLabel) displayLabel.textContent = formatRupiah(total);
}

async function submitServiceTicket(event, editId) {
  event.preventDefault();
  const form = event.target;
  const selectedProjectId = document.getElementById('select-claim-project')?.value || '';

  const laborCost = parseFloat(form.laborCost.value) || 0;
  const partCost = parseFloat(form.partCost.value) || 0;
  const transportCost = parseFloat(form.transportCost.value) || 0;
  const cost = laborCost + partCost + transportCost;

  const ticketPayload = {
    id: form.ticketId.value,
    projectId: selectedProjectId || '',
    customerName: form.customerName.value,
    customerPhone: form.customerPhone.value || '',
    unitName: form.unitName.value,
    serviceLocation: form.serviceLocation.value || 'Workshop UBM Takumi',
    serviceCategory: form.serviceCategory.value,
    technicianName: form.technicianName.value,
    issueDescription: form.issueDescription.value,
    actionPlan: form.actionPlan.value || '',
    laborCost: laborCost,
    partCost: partCost,
    transportCost: transportCost,
    cost: cost,
    totalCost: cost,
    status: form.status.value,
    requestDate: form.requestDate.value,
    notes: form.notes.value || '',
    updatedAt: new Date().toISOString()
  };

  try {
    const isEdit = !!editId;
    const url = isEdit ? `/api/service_tickets/${editId}` : '/api/service_tickets';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketPayload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }

    const savedData = await res.json();

    // Update local state
    if (!state.service_tickets) state.service_tickets = [];
    const idx = state.service_tickets.findIndex(t => t.id === savedData.id);
    if (idx !== -1) {
      state.service_tickets[idx] = savedData;
    } else {
      state.service_tickets.unshift(savedData);
    }

    closeModal('form-modal');
    showToast(`Data service #${savedData.id} berhasil disimpan!`, 'success');
    renderServiceTicketsTable();
  } catch (err) {
    console.error('Error saving service ticket:', err);
    showToast('Gagal menyimpan tiket service: ' + err.message, 'error');
  }
}

async function deleteServiceTicket(ticketId) {
  if (!confirm(`Apakah Anda yakin ingin menghapus data service #${ticketId}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/service_tickets/${ticketId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    state.service_tickets = (state.service_tickets || []).filter(t => t.id !== ticketId);
    showToast(`Data service #${ticketId} berhasil dihapus`, 'info');
    renderServiceTicketsTable();
  } catch (err) {
    console.error('Error deleting service ticket:', err);
    showToast('Gagal menghapus tiket service: ' + err.message, 'error');
  }
}

// -------------------------------------------------------------
// 4. PRINT PREVIEW: KARTU GARANSI RESMI PROJECT (TAB 1)
// -------------------------------------------------------------
function viewWarrantyCard(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan', 'error');
    return;
  }

  const info = getProjectWarrantyInfo(p);
  const content = document.getElementById('preview-modal-content');
  const title = document.getElementById('preview-modal-title');
  if (!content || !title) return;

  title.innerHTML = `<i data-lucide="shield-check" style="color: #2563eb;"></i> Kartu Garansi Resmi: ${p.projectName} (${p.id})`;

  const itemsHtml = info.itemWarranties.map((it, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">${idx + 1}</td>
      <td style="font-weight: 700; border: 1px solid #cbd5e1; padding: 8px; font-size: 12.5px; color: #0f172a;">${escapeHtml(it.name)}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; font-family: monospace;">${it.qty} ${escapeHtml(it.unit)}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; font-weight: 700; color: #16a34a;">${escapeHtml(it.warranty)}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11.5px; color: #475569;">Cover suku cadang, servis dan perbaikan manufaktur</td>
    </tr>
  `).join('');

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'UBM POLITEKNIK TAKUMI',
    tagline: 'Unit Bisnis Mahasiswa - Teaching Factory & Engineering Solutions',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi | Email: ubm@takumi.ac.id',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  content.innerHTML = `
    <!-- NO-PRINT HEADER ACTIONS -->
    <div class="no-print" style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="font-sm font-bold text-muted">Status Garansi:</span>
        ${!info.isExpired ? `
          <span class="badge badge-success" style="font-weight: 700;"><i data-lucide="shield-check" style="width: 13px; height: 13px; display: inline;"></i> Garansi Aktif (Hingga ${info.endDateStr})</span>
        ` : `
          <span class="badge badge-outline" style="color: #ef4444; border-color: #fca5a5; background: #fef2f2; font-weight: 700;">Garansi Telah Berakhir</span>
        `}
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn btn-sm btn-outline" style="color: #b45309; border-color: #f59e0b;" onclick="openWarrantyClaimModal('${p.id}')">
          <i data-lucide="shield-alert"></i> Ajukan Klaim Garansi
        </button>
        <button type="button" class="btn btn-sm btn-primary" style="background: #2563eb; border-color: #2563eb; display: inline-flex; align-items: center; gap: 6px;" onclick="printCurrentDocument()">
          <i data-lucide="printer"></i> Cetak Kartu Garansi (PDF)
        </button>
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="quotation-printable-area" class="print-container">
      <div class="print-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 19px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">${escapeHtml(compSettings.companyName.toUpperCase())}</h1>
            <div style="font-size: 11.5px; font-weight: 700; color: #1e40af; margin-top: 2px;">${escapeHtml(compSettings.tagline)}</div>
            <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">${escapeHtml(compSettings.address)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: #4338ca; letter-spacing: 0.5px;">SERTIFIKAT & KARTU GARANSI</div>
            <div class="mono-id" style="font-size: 12px; color: #334155; margin-top: 2px;">No: WAR-${p.orderId || p.id}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">OFFICIAL WARRANTY CERTIFICATE</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border-left: 4px solid #4338ca; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 135px; color: #64748b; padding: 3px 0;">Nama Project / Mesin:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(p.projectName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Pemilik / Pelanggan:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(p.customerName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">No. Ref Quotation:</td>
              <td style="font-family: monospace; font-weight: 600; color: #7c3aed;">${info.quotation?.id || '-'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">No. Ref Order Penjualan:</td>
              <td style="font-family: monospace; font-weight: 600;">${p.orderId || '-'}</td>
            </tr>
          </table>
        </div>
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 135px; color: #64748b; padding: 3px 0;">Tanggal Serah Terima:</td>
              <td style="font-weight: 600;">${info.startDateStr}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Masa Berlaku Garansi:</td>
              <td style="font-weight: 700; color: #16a34a;">${info.startDateStr} s/d ${info.endDateStr}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Durasi Garansi:</td>
              <td style="font-weight: 700; color: #0f172a;">${info.months} Bulan Resmi UBM</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Penyelenggara Service:</td>
              <td style="font-weight: 600; color: #2563eb;">UBM Politeknik Takumi After Sales</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">
          Daftar Produk & Ketentuan Perlindungan Garansi
        </h4>
        <table class="data-table" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 11px;">
              <th style="width: 35px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">No</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">Nama Produk / Modul</th>
              <th style="width: 80px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">Qty</th>
              <th style="width: 130px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">Masa Garansi</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">Cakupan Jaminan</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-size: 11.5px;">
        <div style="font-weight: 800; color: #334155; margin-bottom: 6px;">SYARAT & KETENTUAN GARANSI RESMI UBM POLITEKNIK TAKUMI:</div>
        <ol style="margin: 0; padding-left: 18px; color: #475569; line-height: 1.6;">
          <li>Garansi berlaku sejak tanggal serah terima pekerjaan (BAST) untuk jangka waktu yang tercantum di atas sesuai kesepakatan Surat Penawaran Harga (Quotation).</li>
          <li>Garansi mencakup penggantian suku cadang, perbaikan malfungsi mekanikal/elektronik, dan dukungan teknis akibat cacat produksi dalam pemakaian wajar.</li>
          <li>Garansi tidak berlaku apabila kerusakan terjadi akibat bencana alam, kelalaian operasional (human error), modifikasi sistem tanpa izin teknis UBM Takumi, atau tegangan listrik eksternal yang tidak stabil.</li>
          <li>Untuk klaim layanan service dan perbaikan, hubungi Unit Bisnis Mahasiswa (UBM) Politeknik Takumi dengan mencantumkan No. Dokumen ini.</li>
        </ol>
      </div>

      <!-- SIGNATURE SECTION -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; page-break-inside: avoid;">
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 55px;">Diterima Oleh (Pelanggan),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 160px; padding-bottom: 2px;">
            ${escapeHtml(p.customerName || 'Client')}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">PIC / Perwakilan Pelanggan</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 55px;">Pemberi Garansi Resmi,</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 160px; padding-bottom: 2px;">
            ${escapeHtml(compSettings.leaderName || 'Ir. Hendra Wijaya, M.T.')}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(compSettings.leaderRole || 'Ketua Unit Bisnis Mandiri (UBM)')}</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// 5. PRINT PREVIEW: LEMBAR PENGAJUAN BIAYA SERVICE (TAB 2)
// -------------------------------------------------------------
function viewServiceTicketPrint(ticketId) {
  const t = (state.service_tickets || []).find(item => item.id === ticketId);
  if (!t) {
    showToast('Data tiket service tidak ditemukan', 'error');
    return;
  }

  const content = document.getElementById('preview-modal-content');
  const title = document.getElementById('preview-modal-title');
  if (!content || !title) return;

  title.innerHTML = `<i data-lucide="wrench" style="color: #2563eb;"></i> Formulir Pengajuan Biaya Service #${t.id}`;

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'UBM POLITEKNIK TAKUMI',
    tagline: 'Unit Bisnis Mahasiswa - Teaching Factory & Engineering Solutions',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi | Email: ubm@takumi.ac.id',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  const totalCostVal = parseFloat(t.cost || t.totalCost || 0) || 0;
  const laborCostVal = parseFloat(t.laborCost || 0);
  const partCostVal = parseFloat(t.partCost || 0);
  const transportCostVal = parseFloat(t.transportCost || 0);

  content.innerHTML = `
    <!-- NO-PRINT ACTIONS -->
    <div class="no-print" style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="font-sm font-bold text-muted">Status Layanan:</span>
        <span class="badge ${t.status === 'Resolved' ? 'badge-success' : 'badge-amber'}" style="font-weight: 700;">
          ${t.status === 'Resolved' ? 'Selesai (Resolved)' : (t.status === 'In Progress' ? 'Dalam Pengerjaan' : 'Open / Diajukan')}
        </span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn btn-sm btn-primary" style="background: #2563eb; border-color: #2563eb; display: inline-flex; align-items: center; gap: 6px;" onclick="printCurrentDocument()">
          <i data-lucide="printer"></i> Cetak Lembar Biaya (PDF)
        </button>
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="quotation-printable-area" class="print-container">
      <div class="print-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 19px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">${escapeHtml(compSettings.companyName.toUpperCase())}</h1>
            <div style="font-size: 11.5px; font-weight: 700; color: #1e40af; margin-top: 2px;">${escapeHtml(compSettings.tagline)}</div>
            <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">${escapeHtml(compSettings.address)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: #2563eb; letter-spacing: 0.5px;">LEMBAR KERJA & PENGAJUAN BIAYA SERVICE</div>
            <div class="mono-id" style="font-size: 12px; color: #334155; margin-top: 2px;">No: ${t.id}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">LAYANAN PERBAIKAN NON-GARANSI</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 130px; color: #64748b; padding: 3px 0;">Nama Pelanggan:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(t.customerName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Kontak Pelanggan:</td>
              <td style="font-weight: 600;">${escapeHtml(t.customerPhone || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Nama Unit / Mesin:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(t.unitName || t.projectName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Lokasi Pengerjaan:</td>
              <td style="font-weight: 600;">${escapeHtml(t.serviceLocation || 'Workshop UBM Takumi')}</td>
            </tr>
          </table>
        </div>
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 130px; color: #64748b; padding: 3px 0;">Tanggal Masuk / Service:</td>
              <td style="font-weight: 600;">${t.requestDate || '-'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Kategori Service:</td>
              <td style="font-weight: 700; color: #2563eb;">${escapeHtml(t.serviceCategory || 'Service Non-Garansi')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Teknisi PIC Pelaksana:</td>
              <td style="font-weight: 700; color: #16a34a;">${escapeHtml(t.technicianName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Status Layanan:</td>
              <td style="font-weight: 700; color: #0f172a;">${t.status || 'Open'}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="margin-bottom: 18px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; font-size: 12px;">
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px;">Deskripsi Gejala / Keluhan Kerusakan:</div>
        <div style="color: #475569; line-height: 1.5;">${escapeHtml(t.issueDescription || '-')}</div>
        <div style="font-weight: 700; color: #334155; margin-top: 10px; margin-bottom: 4px;">Tindakan / Solusi Pekerjaan yang Dilakukan:</div>
        <div style="color: #475569; line-height: 1.5;">${escapeHtml(t.actionPlan || '-')}</div>
        ${t.notes ? `
          <div style="font-weight: 700; color: #334155; margin-top: 10px; margin-bottom: 4px;">Catatan Tambahan:</div>
          <div style="color: #475569; line-height: 1.5;">${escapeHtml(t.notes)}</div>
        ` : ''}
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">
          Rincian & Rekapitulasi Pengajuan Biaya Perbaikan (Non-Garansi)
        </h4>
        <table class="data-table" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 11px;">
              <th style="width: 40px; text-align: center; border: 1px solid #cbd5e1; padding: 8px;">No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px;">Uraian Komponen / Pekerjaan Biaya</th>
              <th style="width: 220px; text-align: right; border: 1px solid #cbd5e1; padding: 8px;">Biaya yang Diajukan (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">1</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">
                <strong>Biaya Jasa Servis & Tenaga Kerja Teknisi</strong>
                <div class="text-muted font-xs">Inspeksi, analisa problem, perbaikan, pembongkaran & perakitan</div>
              </td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-weight: 700; font-size: 12.5px;">${formatRupiah(laborCostVal)}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">2</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">
                <strong>Biaya Penggantian Sparepart & Material</strong>
                <div class="text-muted font-xs">Komponen pengganti, suku cadang baru, pelumas & consumables</div>
              </td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-weight: 700; font-size: 12.5px;">${formatRupiah(partCostVal)}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">3</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px;">
                <strong>Biaya Transportasi, Akomodasi & Operasional</strong>
                <div class="text-muted font-xs">Mobilisasi teknisi dan logistik pengiriman komponen</div>
              </td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-weight: 700; font-size: 12.5px;">${formatRupiah(transportCostVal)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a;">
              <td colspan="2" style="text-align: right; padding: 10px 12px; font-size: 13px; color: #0f172a; text-transform: uppercase;">
                Total Pengajuan Biaya Service:
              </td>
              <td style="text-align: right; padding: 10px 12px; font-family: monospace; font-size: 15px; color: #2563eb; border: 1px solid #cbd5e1;">
                ${formatRupiah(totalCostVal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- KETENTUAN SERVICE -->
      <div style="margin-bottom: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #475569;">
        <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">KETENTUAN SERVICE & PERBAIKAN:</div>
        <ul style="margin: 0; padding-left: 16px; line-height: 1.5;">
          <li>Pekerjaan perbaikan dilakukan setelah lembar pengajuan biaya ini disetujui oleh pihak Pelanggan.</li>
          <li>Suku cadang baru yang diganti mendapatkan garansi pengerjaan selama 30 hari kalender sejak tanggal penyerahan unit.</li>
          <li>Pembayaran biaya service dilakukan sesuai invoice yang diterbitkan oleh UBM Politeknik Takumi.</li>
        </ul>
      </div>

      <!-- SIGNATURE SECTION -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; page-break-inside: avoid;">
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Teknisi Pelaksana,</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(t.technicianName || 'Teknisi')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">UBM Service Engineer</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Pelanggan / Pemilik Unit,</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(t.customerName || 'Pelanggan')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Persetujuan / Pemesan</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Menyetujui (Management),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(compSettings.leaderName || 'UBM Politeknik Takumi')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Head of After Sales</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

// =============================================================
// TAB 3: KEUANGAN PROJECT (FINANCIAL & PROFITABILITY MODULE)
// =============================================================

/**
 * Menghitung rincian finansial proyek yang terintegrasi langsung dengan status & pembayaran Invoice:
 * - Nilai Kontrak Dasar (DPP Quotation / SO)
 * - Status Pembayaran Invoice (Paid / Partial / Unpaid)
 * - Jumlah Terbayar pada Invoice (Paid Amount)
 * - Harga Jual Realisasi: Berubah dinamis mengikuti status dan pembayaran invoice
 * - Harga Modal (HPP: Material/BOM + Tenaga Kerja + Overhead)
 * - Alokasi Garansi (5% Nilai Kontrak) & Realisasi Klaim Garansi Terpakai
 * - Keuntungan Bersih (Net Profit) & Margin Laba (%) mengikuti realisasi pembayaran
 */
function getProjectFinancialData(project) {
  if (!project) return null;
  const warrantyInfo = typeof getProjectWarrantyInfo === 'function' ? getProjectWarrantyInfo(project) : null;
  const order = warrantyInfo?.order || (state.orders || []).find(o => o.id === project.orderId || o.id === project.id);
  const quotation = warrantyInfo?.quotation || (state.quotations || []).find(q => 
    q.id === order?.quotationId || 
    (order?.notes && (order.notes.match(/QUO-[\w-]+/i) || [])[0]) || 
    (q.projectName && q.projectName.toLowerCase() === project.projectName?.toLowerCase())
  );

  // 1. NILAI KONTRAK DASAR (DPP Penjualan Quotation / SO)
  const mainItemsVal = parseFloat(
    quotation?.itemsTotal ||
    (quotation?.items && quotation.items.length > 0 ? quotation.items.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0) ||
    (order?.items && order.items.length > 0 ? order.items.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0) ||
    order?.subtotal ||
    quotation?.subtotal ||
    0
  ) || 0;

  const contractSellingPrice = mainItemsVal > 0 ? mainItemsVal : (parseFloat(order?.grandTotal || quotation?.grandTotal || project?.totalBudget || 0) || 0);

  // 2. KORELASI DENGAN INVOICE & REALISASI PEMBAYARAN
  const linkedInvoices = (state.invoices || []).filter(inv => 
    (project.orderId && inv.orderId === project.orderId) ||
    (inv.orderId === project.id) ||
    (project.orderId && inv.id === `INV-${project.orderId.replace('ORD-', '')}`) ||
    (inv.id === `INV-${project.id.replace('PRJ-', '')}`) ||
    (inv.notes && (
      (project.orderId && inv.notes.includes(project.orderId)) ||
      (project.id && inv.notes.includes(project.id))
    ))
  );

  let hasInvoice = linkedInvoices.length > 0;
  let primaryInvoice = hasInvoice ? linkedInvoices[0] : null;
  let invoiceId = primaryInvoice?.id || (project.orderId ? `INV-${project.orderId.replace('ORD-', '')}` : '-');
  let invoiceGrandTotal = 0;
  let totalPaidAmount = 0;
  let balanceDue = 0;
  let invoiceStatus = 'Unpaid';
  let invoiceStatusLabel = 'Belum Dibayar';
  let invoiceBadgeClass = 'badge-danger';
  let paymentPercentage = 0;

  if (hasInvoice) {
    invoiceGrandTotal = linkedInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);
    totalPaidAmount = linkedInvoices.reduce((sum, inv) => sum + (parseFloat(inv.paidAmount) || 0), 0);
    balanceDue = Math.max(0, invoiceGrandTotal - totalPaidAmount);
    paymentPercentage = invoiceGrandTotal > 0 ? Math.min(100, (totalPaidAmount / invoiceGrandTotal) * 100) : (totalPaidAmount > 0 ? 100 : 0);

    const allPaid = linkedInvoices.every(inv => inv.status === 'Paid' || (parseFloat(inv.paidAmount) >= parseFloat(inv.grandTotal)));
    const hasPartial = linkedInvoices.some(inv => inv.status === 'Partial' || (parseFloat(inv.paidAmount) > 0));

    if (allPaid || (totalPaidAmount >= invoiceGrandTotal && invoiceGrandTotal > 0)) {
      invoiceStatus = 'Paid';
      invoiceStatusLabel = 'Lunas (Paid)';
      invoiceBadgeClass = 'badge-success';
    } else if (hasPartial || totalPaidAmount > 0) {
      invoiceStatus = 'Partial';
      invoiceStatusLabel = 'Sebagian (Partial)';
      invoiceBadgeClass = 'badge-amber';
    } else {
      invoiceStatus = 'Unpaid';
      invoiceStatusLabel = 'Belum Dibayar (Unpaid)';
      invoiceBadgeClass = 'badge-danger';
    }
  } else {
    invoiceGrandTotal = contractSellingPrice;
    totalPaidAmount = 0;
    balanceDue = contractSellingPrice;
    invoiceStatus = 'Unpaid';
    invoiceStatusLabel = 'Belum Ada Tagihan';
    invoiceBadgeClass = 'badge-secondary';
    paymentPercentage = 0;
  }

  // 3. HARGA JUAL REALISASI (SELLING PRICE AKTIF MENGIKUTI PEMBAYARAN INVOICE)
  let sellingPrice = 0;
  if (invoiceStatus === 'Paid') {
    sellingPrice = contractSellingPrice > 0 ? contractSellingPrice : totalPaidAmount;
  } else if (invoiceStatus === 'Partial' || totalPaidAmount > 0) {
    if (invoiceGrandTotal > 0 && contractSellingPrice > 0) {
      sellingPrice = Math.round((totalPaidAmount / invoiceGrandTotal) * contractSellingPrice);
    } else {
      sellingPrice = totalPaidAmount;
    }
  } else {
    sellingPrice = 0;
  }

  // 4. HARGA MODAL (HPP / COGS)
  let materialCost = 0;
  let laborCost = 0;
  let overheadCost = 0;
  let isCustomCost = false;

  if (project.modalCost && typeof project.modalCost === 'object') {
    isCustomCost = true;
    materialCost = parseFloat(project.modalCost.material) || 0;
    laborCost = parseFloat(project.modalCost.labor) || 0;
    overheadCost = parseFloat(project.modalCost.overhead) || 0;
  } else {
    if (project.actualUsageReport?.items && project.actualUsageReport.items.length > 0) {
      materialCost = project.actualUsageReport.items.reduce((sum, item) => {
        const qty = parseFloat(item.actualQty ?? item.planQty ?? 0) || 0;
        const cost = parseFloat(item.unitCost ?? item.unitPrice ?? 0) || 0;
        return sum + (qty * cost);
      }, 0);
    } else {
      const linkedBom = (state.bom || []).find(b => 
        b.projectId === project.id || 
        b.orderId === (project.orderId || project.id) || 
        (quotation?.id && b.quotationId === quotation.id) ||
        (b.projectName && b.projectName.toLowerCase() === project.projectName?.toLowerCase())
      );
      if (linkedBom && (linkedBom.totalEstimatedCost || linkedBom.materialCost || linkedBom.totalCost || (linkedBom.items && linkedBom.items.length > 0))) {
        materialCost = parseFloat(linkedBom.materialCost || linkedBom.totalEstimatedCost || linkedBom.totalCost || 0);
        if (materialCost === 0 && linkedBom.items) {
          materialCost = linkedBom.items.reduce((sum, it) => sum + (parseFloat(it.totalCost || it.total || (it.qty * (it.unitCost || it.unitPrice || 0))) || 0), 0);
        }
      } else {
        const linkedPRs = (state.purchasing || []).filter(pr => 
          pr.projectId === project.id || 
          pr.orderId === (project.orderId || project.id) ||
          (pr.purpose && pr.purpose.toLowerCase().includes(project.projectName?.toLowerCase()))
        );
        if (linkedPRs.length > 0) {
          materialCost = linkedPRs.reduce((sum, pr) => sum + (parseFloat(pr.totalEstimated || pr.totalAmount || 0) || (pr.items || []).reduce((isum, it) => isum + (it.qty * (it.actualPrice || it.unitPrice || 0)), 0)), 0);
        } else {
          materialCost = contractSellingPrice > 0 ? Math.round(contractSellingPrice * 0.55) : 0;
        }
      }
    }

    const serviceItemsTotal = parseFloat(quotation?.servicesTotal || 0);
    if (serviceItemsTotal > 0) {
      laborCost = Math.round(serviceItemsTotal * 0.6);
    } else {
      laborCost = contractSellingPrice > 0 ? Math.round(contractSellingPrice * 0.12) : 0;
    }

    overheadCost = contractSellingPrice > 0 ? Math.round(contractSellingPrice * 0.05) : 0;
  }

  const modalTotal = materialCost + laborCost + overheadCost;

  // 5. GARANSI (Alokasi 5% dari Kontrak & Realisasi Klaim Terpakai)
  const allocatedWarranty = warrantyInfo ? warrantyInfo.allocatedWarrantyAmount : Math.round(contractSellingPrice * 0.05);
  const claimedWarranty = warrantyInfo ? warrantyInfo.totalClaimed : 0;
  const remainingWarranty = allocatedWarranty - claimedWarranty;

  // 6. KEUNTUNGAN BERSIH & MARGIN LABA (MENGIKUTI REALISASI PEMBAYARAN)
  const grossProfit = sellingPrice - modalTotal;
  const netProfit = grossProfit - claimedWarranty;
  const profitMargin = sellingPrice > 0 ? ((netProfit / sellingPrice) * 100) : (modalTotal + claimedWarranty > 0 ? -100 : 0);

  // Status & Indikator Profit
  let profitLevel = 'GOOD';
  let profitLabel = 'Menguntungkan';
  let profitBadgeClass = 'badge-primary';
  let profitColor = '#2563eb';

  if (invoiceStatus === 'Unpaid' || (totalPaidAmount === 0 && sellingPrice === 0)) {
    profitLevel = 'UNPAID';
    profitLabel = 'Belum Dibayar (Defisit Modal)';
    profitBadgeClass = 'badge-danger';
    profitColor = '#dc2626';
  } else if (invoiceStatus === 'Partial' && netProfit < 0) {
    profitLevel = 'PARTIAL_DEFICIT';
    profitLabel = 'Sebagian (Belum Balik Modal)';
    profitBadgeClass = 'badge-warning';
    profitColor = '#d97706';
  } else if (profitMargin >= 30) {
    profitLevel = 'HIGH';
    profitLabel = 'Sangat Menguntungkan';
    profitBadgeClass = 'badge-success';
    profitColor = '#15803d';
  } else if (profitMargin >= 10) {
    profitLevel = 'GOOD';
    profitLabel = 'Menguntungkan';
    profitBadgeClass = 'badge-primary';
    profitColor = '#2563eb';
  } else if (profitMargin >= 0) {
    profitLevel = 'LOW';
    profitLabel = 'Margin Tipis';
    profitBadgeClass = 'badge-warning';
    profitColor = '#d97706';
  } else {
    profitLevel = 'LOSS';
    profitLabel = 'Defisit / Rugi';
    profitBadgeClass = 'badge-danger';
    profitColor = '#dc2626';
  }

  return {
    project,
    order,
    quotation,
    warrantyInfo,
    contractSellingPrice,
    sellingPrice,
    hasInvoice,
    primaryInvoice,
    invoiceId,
    invoiceGrandTotal,
    totalPaidAmount,
    balanceDue,
    invoiceStatus,
    invoiceStatusLabel,
    invoiceBadgeClass,
    paymentPercentage,
    materialCost,
    laborCost,
    overheadCost,
    modalTotal,
    isCustomCost,
    allocatedWarranty,
    claimedWarranty,
    remainingWarranty,
    grossProfit,
    netProfit,
    profitMargin,
    profitLevel,
    profitLabel,
    profitBadgeClass,
    profitColor
  };
}

/**
 * Merender Tabel Finansial & KPI Ringkasan
 */
function renderServiceFinanceTable() {
  const tbody = document.getElementById('table-service-finance-body');
  if (!tbody) return;

  const allProjects = state.projects || [];
  let completedProjects = allProjects.filter(p => isProjectCompletedForService(p));
  
  // Jika tidak ada project completed, ambil project yang memiliki order agar tabel tetap informatif
  if (completedProjects.length === 0 && allProjects.length > 0) {
    completedProjects = allProjects.filter(p => (state.orders || []).some(o => o.id === p.orderId));
  }

  // Hitung KPI Keuangan Keseluruhan
  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalWarranty = 0;
  let totalClaims = 0;
  let totalNetProfit = 0;

  const financialDataList = completedProjects.map(p => {
    const fin = getProjectFinancialData(p);
    totalRevenue += fin.sellingPrice;
    totalCOGS += fin.modalTotal;
    totalWarranty += fin.allocatedWarranty;
    totalClaims += fin.claimedWarranty;
    totalNetProfit += fin.netProfit;
    return fin;
  });

  const avgMargin = totalRevenue > 0 ? ((totalNetProfit / totalRevenue) * 100) : 0;

  // Update KPI Metric Cards
  const kpiRev = document.getElementById('kpi-finance-total-revenue');
  const kpiCogs = document.getElementById('kpi-finance-total-cogs');
  const kpiWar = document.getElementById('kpi-finance-total-warranty');
  const kpiClaims = document.getElementById('kpi-finance-total-claims');
  const kpiNet = document.getElementById('kpi-finance-total-net-profit');
  const kpiAvgMargin = document.getElementById('kpi-finance-avg-margin');

  if (kpiRev) kpiRev.textContent = formatRupiah(totalRevenue);
  if (kpiCogs) kpiCogs.textContent = formatRupiah(totalCOGS);
  if (kpiWar) kpiWar.textContent = formatRupiah(totalWarranty);
  if (kpiClaims) kpiClaims.textContent = formatRupiah(totalClaims);
  if (kpiNet) {
    kpiNet.textContent = formatRupiah(totalNetProfit);
    kpiNet.style.color = totalNetProfit >= 0 ? '#15803d' : '#dc2626';
  }
  if (kpiAvgMargin) {
    kpiAvgMargin.textContent = `Avg. Margin: ${avgMargin.toFixed(1)}%`;
    kpiAvgMargin.style.color = avgMargin >= 10 ? '#15803d' : (avgMargin >= 0 ? '#d97706' : '#dc2626');
  }

  // Filter Data
  let filteredList = [...financialDataList];

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filteredList = filteredList.filter(f =>
      (f.project.id && f.project.id.toLowerCase().includes(q)) ||
      (f.project.orderId && f.project.orderId.toLowerCase().includes(q)) ||
      (f.project.projectName && f.project.projectName.toLowerCase().includes(q)) ||
      (f.project.customerName && f.project.customerName.toLowerCase().includes(q)) ||
      (f.project.projectLead && f.project.projectLead.toLowerCase().includes(q))
    );
  }

  // Status Filter
  const filterProfitStatus = document.getElementById('filter-finance-profit-status')?.value || 'ALL';
  if (filterProfitStatus !== 'ALL') {
    filteredList = filteredList.filter(f => f.profitLevel === filterProfitStatus);
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 40px 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <i data-lucide="calculator" style="width: 40px; height: 40px; color: #94a3b8;"></i>
            <div style="font-weight: 700; color: #475569; font-size: 14px;">Tidak ada data keuangan project yang cocok</div>
            <div style="font-size: 12px; color: #94a3b8;">Silakan sesuaikan kata kunci pencarian atau filter profitabilitas.</div>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filteredList.map(f => {
    const p = f.project;
    const quoId = f.quotation?.id || f.order?.quotationId || '-';
    const isProfitable = f.netProfit >= 0;

    return `
      <tr style="transition: background-color 0.15s ease;">
        <td>
          <span class="mono-id font-bold text-primary" style="font-size: 11.5px;">${p.id}</span>
          ${p.orderId ? `<div class="font-xs text-muted font-mono" style="font-size: 10px; margin-top: 2px;">Ref: ${p.orderId}</div>` : ''}
          ${quoId !== '-' ? `<div class="font-xs text-purple font-mono" style="font-size: 10px;">Quo: ${quoId}</div>` : ''}
        </td>
        <td>
          <div class="font-bold text-main" style="word-break: break-word; font-size: 13px; color: #0f172a;">${escapeHtml(p.projectName || 'Project')}</div>
          <div class="text-muted font-sm" style="font-size: 11.5px; margin-top: 2px;"><i data-lucide="building" style="width: 11px; height: 11px; display: inline;"></i> ${escapeHtml(p.customerName || '-')}</div>
          ${p.projectLead ? `<div class="font-xs text-muted" style="font-size: 10.5px; margin-top: 1px;">PIC: <strong>${escapeHtml(p.projectLead)}</strong></div>` : ''}
        </td>
        <td style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 13px; color: #b45309;">${formatRupiah(f.modalTotal)}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            Bahan: ${formatRupiah(f.materialCost)}
          </div>
          <div style="font-size: 10px; color: #64748b;">
            Jasa & OH: ${formatRupiah(f.laborCost + f.overheadCost)}
          </div>
          ${f.isCustomCost ? `<span class="badge badge-secondary" style="font-size: 9px; padding: 1px 4px; margin-top: 2px;">Manual HPP</span>` : ''}
        </td>
        <td style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 13.5px; color: #0f172a;">${formatRupiah(f.sellingPrice)}</div>
          <div class="text-muted" style="font-size: 10px; margin-top: 2px;">DPP Quotation / SO</div>
        </td>
        <td>
          <div style="font-size: 11px; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; gap: 4px;">
              <span class="text-muted font-xs">Plafon:</span>
              <strong class="font-mono" style="color: #7c3aed;">${formatRupiah(f.allocatedWarranty)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 4px; margin-top: 2px; border-top: 1px dashed #e2e8f0; padding-top: 2px;">
              <span class="text-muted font-xs">Klaim:</span>
              <strong class="font-mono" style="color: ${f.claimedWarranty > 0 ? '#dc2626' : '#64748b'};">
                ${formatRupiah(f.claimedWarranty)}
              </strong>
            </div>
          </div>
        </td>
        <td style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 14px; color: ${isProfitable ? '#15803d' : '#dc2626'};">
            ${formatRupiah(f.netProfit)}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            Laba Kotor: ${formatRupiah(f.grossProfit)}
          </div>
        </td>
        <td style="text-align: center;">
          <div class="badge ${f.profitBadgeClass}" style="font-size: 11.5px; font-weight: 800; padding: 4px 8px; font-family: monospace;">
            ${f.profitMargin.toFixed(1)}%
          </div>
          <div style="font-size: 10px; color: ${f.profitColor}; font-weight: 700; margin-top: 3px;">
            ${f.profitLabel}
          </div>
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: flex-end;">
            <button class="btn btn-sm btn-outline" style="color: #2563eb; border-color: #93c5fd; background: #eff6ff; font-size: 11px; padding: 5px 8px; font-weight: 700;" onclick="openProjectFinanceDetailModal('${p.id}')" title="Lihat Analisis Rinci Finansial">
              <i data-lucide="eye" style="width: 12px; height: 12px;"></i> Detail
            </button>
            <button class="btn btn-sm btn-outline" style="color: #b45309; border-color: #fde68a; background: #fffbeb; font-size: 11px; padding: 5px 8px; font-weight: 700;" onclick="openAdjustProjectModalCostModal('${p.id}')" title="Sesuaikan / Edit Harga Modal (HPP)">
              <i data-lucide="dollar-sign" style="width: 12px; height: 12px;"></i> Ubah HPP
            </button>
            <button class="btn btn-sm btn-primary" style="background: #0f172a; border-color: #0f172a; font-size: 11px; padding: 5px 8px; font-weight: 700;" onclick="printProjectFinanceReport('${p.id}')" title="Cetak Laporan Keuangan Proyek">
              <i data-lucide="printer" style="width: 12px; height: 12px;"></i> Cetak
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  updateServiceTabBadges();
}

function filterServiceFinanceTable() {
  renderServiceFinanceTable();
}

// -------------------------------------------------------------
// 3.1 DETAIL ANALISIS KEUANGAN & PROFITABILITAS PROYEK
// -------------------------------------------------------------
function openProjectFinanceDetailModal(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan', 'error');
    return;
  }

  const fin = getProjectFinancialData(p);
  const compSettings = state.company_settings || {};
  const isProfitable = fin.netProfit >= 0;

  const modal = document.getElementById('preview-modal');
  const modalBody = modal.querySelector('.modal-body') || modal;

  modalBody.innerHTML = `
    <div style="max-width: 860px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 8px; font-family: 'Inter', system-ui, sans-serif;">
      
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <span class="badge ${fin.profitBadgeClass}" style="font-size: 11px; padding: 3px 8px; margin-bottom: 6px; display: inline-block;">
            ${fin.profitLabel} (Margin ${fin.profitMargin.toFixed(1)}%)
          </span>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">Analisis Keuangan & Profitabilitas Proyek</h2>
          <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
            ${escapeHtml(p.projectName || 'Proyek')} &bull; Pelanggan: <strong>${escapeHtml(p.customerName || '-')}</strong>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 14px; color: #2563eb;">${p.id}</div>
          <div class="font-mono text-muted" style="font-size: 11px; margin-top: 2px;">Ref SO: ${p.orderId || '-'}</div>
          ${fin.quotation?.id ? `<div class="font-mono text-purple" style="font-size: 11px;">Quo: ${fin.quotation.id}</div>` : ''}
        </div>
      </div>

      <!-- KEY FINANCIAL METRICS CARDS -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Harga Jual (DPP)</div>
          <div class="font-mono" style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatRupiah(fin.sellingPrice)}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Nilai Penjualan</div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #92400e; font-weight: 700; text-transform: uppercase;">Harga Modal (HPP)</div>
          <div class="font-mono" style="font-size: 16px; font-weight: 800; color: #b45309; margin-top: 4px;">${formatRupiah(fin.modalTotal)}</div>
          <div style="font-size: 10px; color: #92400e; margin-top: 2px;">Biaya Produksi & OH</div>
        </div>
        <div style="background: #f5f3ff; border: 1px solid #ede9fe; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #5b21b6; font-weight: 700; text-transform: uppercase;">Alokasi Garansi (5%)</div>
          <div class="font-mono" style="font-size: 16px; font-weight: 800; color: #7c3aed; margin-top: 4px;">${formatRupiah(fin.allocatedWarranty)}</div>
          <div style="font-size: 10px; color: #5b21b6; margin-top: 2px;">Klaim: ${formatRupiah(fin.claimedWarranty)}</div>
        </div>
        <div style="background: ${isProfitable ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isProfitable ? '#dcfce7' : '#fee2e2'}; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; color: ${isProfitable ? '#166534' : '#991b1b'}; font-weight: 700; text-transform: uppercase;">Keuntungan Bersih</div>
          <div class="font-mono" style="font-size: 17px; font-weight: 800; color: ${isProfitable ? '#15803d' : '#dc2626'}; margin-top: 4px;">${formatRupiah(fin.netProfit)}</div>
          <div style="font-size: 10px; color: ${isProfitable ? '#166534' : '#991b1b'}; font-weight: 700; margin-top: 2px;">Margin: ${fin.profitMargin.toFixed(1)}%</div>
        </div>
      </div>

      <!-- RINCIAN BREAKDOWN KOMPONEN BIAYA & PENDAPATAN -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13.5px; font-weight: 700; color: #1e293b; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
          Tabel Rincian Aliran Finansial & Harga Modal (HPP)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #475569;">
              <th style="padding: 9px 12px; text-align: left;">Komponen Finansial</th>
              <th style="padding: 9px 12px; text-align: left;">Keterangan & Dasar Perhitungan</th>
              <th style="padding: 9px 12px; text-align: right; width: 180px;">Nominal (Rp)</th>
              <th style="padding: 9px 12px; text-align: right; width: 110px;">Proporsi (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">1. Harga Jual Proyek (DPP)</td>
              <td style="padding: 9px 12px; color: #64748b;">Total nilai pesanan / quotation sebelum PPN 11%</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">${formatRupiah(fin.sellingPrice)}</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-weight: 700;">100.0%</td>
            </tr>

            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 9px 12px; padding-left: 24px; color: #334155;">&bull; Biaya Bahan & Material (BOM)</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Material mekanik, elektrikal, sensor & komponen terpakai</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.materialCost)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #64748b;">${fin.sellingPrice > 0 ? ((fin.materialCost / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 9px 12px; padding-left: 24px; color: #334155;">&bull; Biaya Tenaga Kerja & Jasa Langsung</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Upah perakitan, programming, wiring & instalasi</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.laborCost)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #64748b;">${fin.sellingPrice > 0 ? ((fin.laborCost / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 9px 12px; padding-left: 24px; color: #334155;">&bull; Biaya Overhead & Operasional Pabrik</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Listrik, depresiasi tools, pengujian QC, transport logistik</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.overheadCost)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #64748b;">${fin.sellingPrice > 0 ? ((fin.overheadCost / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #fffbeb; border-bottom: 2px solid #fef3c7; font-weight: 700;">
              <td style="padding: 9px 12px; color: #92400e;">2. Total Harga Modal (HPP Proyek)</td>
              <td style="padding: 9px 12px; color: #92400e; font-size: 11.5px;">Akumulasi Biaya Bahan + Tenaga Kerja + Overhead</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-size: 13px; color: #b45309;">${formatRupiah(fin.modalTotal)}</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #92400e;">${fin.sellingPrice > 0 ? ((fin.modalTotal / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; font-weight: 700;">
              <td style="padding: 9px 12px; color: #1e293b;">3. Keuntungan Kotor (Gross Profit)</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Harga Jual Proyek dikurangi Total Harga Modal (HPP)</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-size: 13px; color: #0f172a;">${formatRupiah(fin.grossProfit)}</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #0f172a;">${fin.sellingPrice > 0 ? ((fin.grossProfit / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #fdf2f8; border-bottom: 1px solid #fce7f3;">
              <td style="padding: 9px 12px; color: #9d174d;">4. Beban Klaim Garansi Terpakai</td>
              <td style="padding: 9px 12px; color: #9d174d; font-size: 11.5px;">Realisasi klaim after sales dari plafon garansi (${formatRupiah(fin.allocatedWarranty)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #be185d;">(${formatRupiah(fin.claimedWarranty)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #9d174d;">${fin.sellingPrice > 0 ? ((fin.claimedWarranty / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: ${isProfitable ? '#f0fdf4' : '#fef2f2'}; border-top: 2px solid ${isProfitable ? '#22c55e' : '#ef4444'}; font-weight: 800; font-size: 13.5px;">
              <td style="padding: 12px; color: ${isProfitable ? '#15803d' : '#dc2626'};">5. Keuntungan Bersih (Net Profit)</td>
              <td style="padding: 12px; color: ${isProfitable ? '#166534' : '#991b1b'}; font-size: 12px;">Laba Kotor dikurangi Realisasi Beban Klaim Garansi</td>
              <td style="padding: 12px; text-align: right; font-family: monospace; font-size: 15px; color: ${isProfitable ? '#15803d' : '#dc2626'};">${formatRupiah(fin.netProfit)}</td>
              <td style="padding: 12px; text-align: right; font-family: monospace; font-size: 14px; color: ${isProfitable ? '#15803d' : '#dc2626'};">${fin.profitMargin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- RIWAYAT KLAIM GARANSI TERKAIT -->
      ${fin.warrantyInfo?.claims && fin.warrantyInfo.claims.length > 0 ? `
        <div style="margin-bottom: 24px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 14px 16px;">
          <div style="font-weight: 700; color: #6b21a8; font-size: 12.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="shield-alert" style="width: 14px; height: 14px;"></i> Riwayat Klaim Garansi Proyek Ini (${fin.warrantyInfo.claims.length} Klaim)
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
            <thead>
              <tr style="border-bottom: 1px solid #d8b4fe; text-align: left; color: #7e22ce;">
                <th style="padding: 4px 6px;">No. Klaim</th>
                <th style="padding: 4px 6px;">Tanggal</th>
                <th style="padding: 4px 6px;">Kerusakan / Keluhan</th>
                <th style="padding: 4px 6px; text-align: right;">Biaya Klaim</th>
              </tr>
            </thead>
            <tbody>
              ${fin.warrantyInfo.claims.map(c => `
                <tr style="border-bottom: 1px dashed #e9d5ff;">
                  <td style="padding: 4px 6px; font-family: monospace; font-weight: 700; color: #6b21a8;">${c.id}</td>
                  <td style="padding: 4px 6px;">${c.claimDate || '-'}</td>
                  <td style="padding: 4px 6px;">${escapeHtml(c.issueDescription || c.notes || '-')}</td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #dc2626;">${formatRupiah(c.claimCost || c.cost || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- ACTION BUTTONS -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('preview-modal')">Tutup</button>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-outline" style="color: #b45309; border-color: #f59e0b; background: #fffbeb;" onclick="closeModal('preview-modal'); openAdjustProjectModalCostModal('${p.id}')">
            <i data-lucide="dollar-sign"></i> Sesuaikan Harga Modal (HPP)
          </button>
          <button type="button" class="btn btn-primary" style="background: #2563eb; border-color: #2563eb; font-weight: 700;" onclick="closeModal('preview-modal'); printProjectFinanceReport('${p.id}')">
            <i data-lucide="printer"></i> Cetak Laporan Keuangan
          </button>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// 3.2 FORM PENYESUAIAN HARGA MODAL (HPP) PROYEK
// -------------------------------------------------------------
function openAdjustProjectModalCostModal(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan', 'error');
    return;
  }

  const fin = getProjectFinancialData(p);
  const modal = document.getElementById('form-modal');
  const modalBody = modal.querySelector('.modal-body') || modal;

  modalBody.innerHTML = `
    <form id="form-adjust-project-cost" onsubmit="saveAdjustProjectModalCost(event, '${p.id}')" style="font-family: 'Inter', system-ui, sans-serif;">
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="dollar-sign" style="color: #2563eb; width: 20px; height: 20px;"></i>
          Sesuaikan Harga Modal (HPP) Proyek
        </h3>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          Proyek: <strong>${escapeHtml(p.projectName || 'Project')}</strong> (${p.id}) &bull; Klien: <strong>${escapeHtml(p.customerName || '-')}</strong>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span class="text-muted">Harga Jual Proyek (DPP):</span>
          <strong class="font-mono text-primary" style="font-size: 13px;">${formatRupiah(fin.sellingPrice)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span class="text-muted">Beban Klaim Garansi:</span>
          <strong class="font-mono text-danger" style="font-size: 13px;">${formatRupiah(fin.claimedWarranty)}</strong>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 5px;">
            1. Biaya Material & Bahan Baku (BOM) (Rp) <span class="text-danger">*</span>
          </label>
          <input type="number" id="input-cost-material" class="form-control" value="${fin.materialCost}" min="0" required
            oninput="recalculateModalCostAdjustForm(${fin.sellingPrice}, ${fin.claimedWarranty})"
            style="font-family: monospace; font-weight: 700; font-size: 13px;" />
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            Nilai akumulasi komponen sparepart, mikrokontroler, mekanik & material terpakai.
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 5px;">
            2. Biaya Tenaga Kerja & Jasa Langsung (Rp) <span class="text-danger">*</span>
          </label>
          <input type="number" id="input-cost-labor" class="form-control" value="${fin.laborCost}" min="0" required
            oninput="recalculateModalCostAdjustForm(${fin.sellingPrice}, ${fin.claimedWarranty})"
            style="font-family: monospace; font-weight: 700; font-size: 13px;" />
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            Biaya upah tim teknisi perakitan, jasa desain, programming, dan instalasi lapangan.
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 5px;">
            3. Biaya Overhead & Operasional Pabrikasi (Rp) <span class="text-danger">*</span>
          </label>
          <input type="number" id="input-cost-overhead" class="form-control" value="${fin.overheadCost}" min="0" required
            oninput="recalculateModalCostAdjustForm(${fin.sellingPrice}, ${fin.claimedWarranty})"
            style="font-family: monospace; font-weight: 700; font-size: 13px;" />
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            Biaya listrik lab, pengujian mutu QC, konsumsi, dan logistik pengiriman unit.
          </div>
        </div>
      </div>

      <!-- LIVE PREVIEW HASIL PENYESUAIAN -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 6px; text-transform: uppercase;">
          Simulasi Hasil Perhitungan Baru:
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 12px;">
          <div>
            <div class="text-muted font-xs">Total Modal (HPP):</div>
            <div id="preview-adjust-total-cogs" class="font-mono" style="font-weight: 800; font-size: 14px; color: #b45309;">
              ${formatRupiah(fin.modalTotal)}
            </div>
          </div>
          <div>
            <div class="text-muted font-xs">Keuntungan Bersih:</div>
            <div id="preview-adjust-net-profit" class="font-mono" style="font-weight: 800; font-size: 14px; color: #15803d;">
              ${formatRupiah(fin.netProfit)}
            </div>
          </div>
          <div>
            <div class="text-muted font-xs">Margin Laba:</div>
            <div id="preview-adjust-margin" class="font-mono" style="font-weight: 800; font-size: 14px; color: #15803d;">
              ${fin.profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL ACTIONS -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 9px 24px; background: #2563eb; border-color: #2563eb; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="check-circle"></i> Simpan Penyesuaian HPP
        </button>
      </div>
    </form>
  `;

  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function recalculateModalCostAdjustForm(sellingPrice, claimedWarranty) {
  const matVal = parseFloat(document.getElementById('input-cost-material')?.value || 0) || 0;
  const labVal = parseFloat(document.getElementById('input-cost-labor')?.value || 0) || 0;
  const ovhVal = parseFloat(document.getElementById('input-cost-overhead')?.value || 0) || 0;

  const totalCogs = matVal + labVal + ovhVal;
  const netProfit = sellingPrice - totalCogs - claimedWarranty;
  const margin = sellingPrice > 0 ? ((netProfit / sellingPrice) * 100) : 0;

  const dispCogs = document.getElementById('preview-adjust-total-cogs');
  const dispNet = document.getElementById('preview-adjust-net-profit');
  const dispMargin = document.getElementById('preview-adjust-margin');

  if (dispCogs) dispCogs.textContent = formatRupiah(totalCogs);
  if (dispNet) {
    dispNet.textContent = formatRupiah(netProfit);
    dispNet.style.color = netProfit >= 0 ? '#15803d' : '#dc2626';
  }
  if (dispMargin) {
    dispMargin.textContent = `${margin.toFixed(1)}%`;
    dispMargin.style.color = margin >= 10 ? '#15803d' : (margin >= 0 ? '#d97706' : '#dc2626');
  }
}

async function saveAdjustProjectModalCost(event, projectId) {
  if (event) event.preventDefault();

  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan', 'error');
    return;
  }

  const matVal = parseFloat(document.getElementById('input-cost-material')?.value || 0) || 0;
  const labVal = parseFloat(document.getElementById('input-cost-labor')?.value || 0) || 0;
  const ovhVal = parseFloat(document.getElementById('input-cost-overhead')?.value || 0) || 0;
  const totalVal = matVal + labVal + ovhVal;

  p.modalCost = {
    material: matVal,
    labor: labVal,
    overhead: ovhVal,
    total: totalVal,
    updatedAt: new Date().toISOString()
  };

  try {
    const updated = await api.put(`/api/projects/${p.id}`, p);
    // Perbarui state lokal jika perlu
    const idx = (state.projects || []).findIndex(item => item.id === p.id);
    if (idx !== -1) {
      state.projects[idx] = updated || p;
    }
    closeModal('form-modal');
    showToast('Harga Modal (HPP) proyek berhasil disimpan & diperbarui!', 'success');
    renderServiceFinanceTable();
  } catch (err) {
    console.error('Error saving project modal cost:', err);
    // Fallback simpan di state
    closeModal('form-modal');
    showToast('Harga Modal diperbarui pada state lokal', 'info');
    renderServiceFinanceTable();
  }
}

// -------------------------------------------------------------
// 3.3 CETAK LAPORAN KEUANGAN & PROFITABILITAS PROYEK RESMI
// -------------------------------------------------------------
function printProjectFinanceReport(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan', 'error');
    return;
  }

  const fin = getProjectFinancialData(p);
  const compSettings = state.company_settings || {};
  const isProfitable = fin.netProfit >= 0;
  const printDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const modal = document.getElementById('preview-modal');
  const modalBody = modal.querySelector('.modal-body') || modal;

  modalBody.innerHTML = `
    <div style="text-align: right; margin-bottom: 12px;">
      <button class="btn btn-primary" onclick="printDocument()" style="background: #2563eb; border-color: #2563eb; padding: 7px 18px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
        <i data-lucide="printer"></i> Cetak Dokumen / PDF
      </button>
    </div>

    <div id="printable-document" style="font-family: 'Inter', Arial, sans-serif; background: #ffffff; padding: 32px 36px; color: #1e293b; max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      
      <!-- KOP SURAT RESMI -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${compSettings.logoUrl ? `<img src="${compSettings.logoUrl}" style="height: 52px; object-fit: contain;" />` : `<div style="font-weight: 900; font-size: 26px; color: #2563eb; letter-spacing: -1px;">UBM</div>`}
          <div>
            <h1 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              ${escapeHtml(compSettings.companyName || 'UNIT BISNIS & MANUFAKTUR (UBM)')}
            </h1>
            <div style="font-size: 11.5px; color: #475569;">
              ${escapeHtml(compSettings.companySubtitle || 'Politeknik Takumi - Pusat Solusi Otomasi & Rekayasa Presisi')}
            </div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
              ${escapeHtml(compSettings.address || 'Kawasan Industri GIIC Deltamas, Cikarang Pusat, Jawa Barat')}
            </div>
          </div>
        </div>
        <div style="text-align: right; border-left: 1px solid #cbd5e1; padding-left: 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">DOKUMEN KEUANGAN</div>
          <div style="font-size: 13px; font-weight: 800; color: #2563eb; font-family: monospace;">FIN-${p.id}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Tgl: ${printDateStr}</div>
        </div>
      </div>

      <!-- JUDUL LAPORAN -->
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          LAPORAN ANALISIS KEUANGAN & PROFITABILITAS PROYEK
        </h2>
        <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">
          Evaluasi Biaya Modal (HPP), Alokasi Garansi After Sales, dan Realisasi Margin Laba Bersih
        </div>
      </div>

      <!-- INFORMASI PROYEK & KLIEN -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 130px; color: #64748b; padding: 3px 0;">No. Proyek / Ref:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 0;">
              ${p.id} ${p.orderId ? `&bull; Ref SO: ${p.orderId}` : ''} ${fin.quotation?.id ? `&bull; Penawaran: ${fin.quotation.id}` : ''}
            </td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 3px 0;">Nama Proyek:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 0;">${escapeHtml(p.projectName || '-')}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 3px 0;">Klien / Pemesan:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 0;">${escapeHtml(p.customerName || '-')}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 3px 0;">Penanggung Jawab:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 0;">${escapeHtml(p.projectLead || '-')} (${p.department || 'Engineering'})</td>
          </tr>
        </table>
      </div>

      <!-- TABEL REKAPITULASI KEUANGAN -->
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left; width: 40px;">No</th>
              <th style="padding: 8px 10px; text-align: left;">Uraian Pos Keuangan</th>
              <th style="padding: 8px 10px; text-align: left;">Keterangan Komponen</th>
              <th style="padding: 8px 10px; text-align: right; width: 160px;">Jumlah (Rp)</th>
              <th style="padding: 8px 10px; text-align: right; width: 90px;">Rasio (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0; font-weight: 700;">
              <td style="padding: 8px 10px; text-align: center;">1</td>
              <td style="padding: 8px 10px; color: #0f172a;">HARGA JUAL PROYEK (DPP)</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 11px;">Nilai kontrak pesanan (sebelum PPN)</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12.5px;">${formatRupiah(fin.sellingPrice)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace;">100.0%</td>
            </tr>

            <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
              <td style="padding: 6px 10px; text-align: center; color: #94a3b8;">1.1</td>
              <td style="padding: 6px 10px; padding-left: 20px; color: #475569;">Biaya Material / Komponen BOM</td>
              <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">Bahan baku & suku cadang mekanik/elektrik</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.materialCost)})</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #64748b;">${fin.sellingPrice > 0 ? ((fin.materialCost / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
              <td style="padding: 6px 10px; text-align: center; color: #94a3b8;">1.2</td>
              <td style="padding: 6px 10px; padding-left: 20px; color: #475569;">Biaya Tenaga Kerja & Jasa</td>
              <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">Upah teknisi perakitan, wiring, instalasi</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.laborCost)})</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #64748b;">${fin.sellingPrice > 0 ? ((fin.laborCost / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
              <td style="padding: 6px 10px; text-align: center; color: #94a3b8;">1.3</td>
              <td style="padding: 6px 10px; padding-left: 20px; color: #475569;">Biaya Overhead & Operasional</td>
              <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">Listrik, QC inspection, transport pengiriman</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.overheadCost)})</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #64748b;">${fin.sellingPrice > 0 ? ((fin.overheadCost / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 2px solid #cbd5e1; background: #fffbeb; font-weight: 700;">
              <td style="padding: 8px 10px; text-align: center;">2</td>
              <td style="padding: 8px 10px; color: #92400e;">TOTAL HARGA MODAL (HPP)</td>
              <td style="padding: 8px 10px; color: #92400e; font-size: 11px;">Akumulasi biaya langsung proyek</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12.5px; color: #b45309;">${formatRupiah(fin.modalTotal)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #92400e;">${fin.sellingPrice > 0 ? ((fin.modalTotal / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #e2e8f0; font-weight: 700;">
              <td style="padding: 8px 10px; text-align: center;">3</td>
              <td style="padding: 8px 10px; color: #0f172a;">KEUNTUNGAN KOTOR (GROSS PROFIT)</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 11px;">Harga Jual - Total HPP</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12.5px;">${formatRupiah(fin.grossProfit)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace;">${fin.sellingPrice > 0 ? ((fin.grossProfit / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #e2e8f0; color: #9d174d;">
              <td style="padding: 8px 10px; text-align: center;">4</td>
              <td style="padding: 8px 10px;">Beban Klaim Garansi Terpakai</td>
              <td style="padding: 8px 10px; font-size: 11px;">Alokasi: ${formatRupiah(fin.allocatedWarranty)} &bull; Sisa: ${formatRupiah(fin.remainingWarranty)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #be185d;">(${formatRupiah(fin.claimedWarranty)})</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace;">${fin.sellingPrice > 0 ? ((fin.claimedWarranty / fin.sellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: ${isProfitable ? '#f0fdf4' : '#fef2f2'}; border-top: 2px solid #0f172a; font-weight: 800; font-size: 13px;">
              <td style="padding: 10px; text-align: center; color: ${isProfitable ? '#15803d' : '#dc2626'};">5</td>
              <td style="padding: 10px; color: ${isProfitable ? '#15803d' : '#dc2626'};">KEUNTUNGAN BERSIH (NET PROFIT)</td>
              <td style="padding: 10px; color: ${isProfitable ? '#166534' : '#991b1b'}; font-size: 11.5px;">Laba Bersih Akhir Setelah Klaim Garansi</td>
              <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 14px; color: ${isProfitable ? '#15803d' : '#dc2626'};">${formatRupiah(fin.netProfit)}</td>
              <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; color: ${isProfitable ? '#15803d' : '#dc2626'};">${fin.profitMargin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- EVALUASI PROFITABILITAS -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 24px; font-size: 11.5px; color: #334155;">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px;">CATATAN EVALUASI FINANSIAL:</div>
        <div>Tingkat profitabilitas proyek ini dikategorikan <strong>${fin.profitLabel}</strong> dengan margin laba sebesar <strong>${fin.profitMargin.toFixed(1)}%</strong>. Seluruh klaim garansi yang terjadi selama masa pemeliharaan telah diperhitungkan secara akurat ke dalam realisasi laba bersih akhir.</div>
      </div>

      <!-- SIGNATURE SECTION -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; page-break-inside: avoid;">
        <div style="text-align: center; font-size: 11.5px;">
          <div style="color: #64748b; margin-bottom: 45px;">Dibuat Oleh (Finance/Lead),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 130px; padding-bottom: 2px;">
            ${escapeHtml(p.projectLead || 'PIC Keuangan')}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Project / Cost Control</div>
        </div>
        <div style="text-align: center; font-size: 11.5px;">
          <div style="color: #64748b; margin-bottom: 45px;">Diperiksa Oleh,</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 130px; padding-bottom: 2px;">
            Head of Engineering
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Kepala Divisi Teknis</div>
        </div>
        <div style="text-align: center; font-size: 11.5px;">
          <div style="color: #64748b; margin-bottom: 45px;">Mengetahui & Menyetujui,</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 130px; padding-bottom: 2px;">
            ${escapeHtml(compSettings.leaderName || 'UBM Politeknik Takumi')}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Ketua Unit Bisnis UBM</div>
        </div>
      </div>

    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// 3.4 EXPORT DATA KEUANGAN PROJECT KE CSV
// -------------------------------------------------------------
function exportServiceFinanceToCSV() {
  const allProjects = state.projects || [];
  let completedProjects = allProjects.filter(p => isProjectCompletedForService(p));
  if (completedProjects.length === 0 && allProjects.length > 0) {
    completedProjects = allProjects.filter(p => (state.orders || []).some(o => o.id === p.orderId));
  }

  if (completedProjects.length === 0) {
    showToast('Tidak ada data keuangan project untuk diekspor', 'warning');
    return;
  }

  const headers = [
    'No Project',
    'Ref Sales Order',
    'Ref Quotation',
    'Nama Project',
    'Customer',
    'Project Lead',
    'Harga Jual (DPP)',
    'Biaya Material BOM (Rp)',
    'Biaya Tenaga Kerja (Rp)',
    'Biaya Overhead (Rp)',
    'Total Harga Modal HPP (Rp)',
    'Alokasi Garansi (Rp)',
    'Klaim Garansi Terpakai (Rp)',
    'Sisa Garansi (Rp)',
    'Keuntungan Kotor (Rp)',
    'Keuntungan Bersih (Rp)',
    'Margin Laba (%)',
    'Status Profit'
  ];

  const rows = completedProjects.map(p => {
    const fin = getProjectFinancialData(p);
    return [
      `"${p.id}"`,
      `"${p.orderId || ''}"`,
      `"${fin.quotation?.id || ''}"`,
      `"${(p.projectName || '').replace(/"/g, '""')}"`,
      `"${(p.customerName || '').replace(/"/g, '""')}"`,
      `"${(p.projectLead || '').replace(/"/g, '""')}"`,
      fin.sellingPrice,
      fin.materialCost,
      fin.laborCost,
      fin.overheadCost,
      fin.modalTotal,
      fin.allocatedWarranty,
      fin.claimedWarranty,
      fin.remainingWarranty,
      fin.grossProfit,
      fin.netProfit,
      fin.profitMargin.toFixed(2),
      `"${fin.profitLabel}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `UBM_Laporan_Keuangan_Project_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Laporan Keuangan Project berhasil diekspor ke CSV', 'success');
}

// Global window exposure
window.switchServiceTab = switchServiceTab;
window.updateServiceTabBadges = updateServiceTabBadges;
window.getProjectFinancialData = getProjectFinancialData;
window.renderServiceFinanceTable = renderServiceFinanceTable;
window.filterServiceFinanceTable = filterServiceFinanceTable;
window.openProjectFinanceDetailModal = openProjectFinanceDetailModal;
window.openAdjustProjectModalCostModal = openAdjustProjectModalCostModal;
window.recalculateModalCostAdjustForm = recalculateModalCostAdjustForm;
window.saveAdjustProjectModalCost = saveAdjustProjectModalCost;
window.printProjectFinanceReport = printProjectFinanceReport;
window.exportServiceFinanceToCSV = exportServiceFinanceToCSV;
