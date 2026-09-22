// =========================================================
// UBM - Quotations Module (Surat Penawaran Harga)
// =========================================================

function renderQuotationsTable() {
  const tbody = document.getElementById('table-quotations-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-quotation-status')?.value || 'ALL';
  let list = state.quotations || [];

  if (statusFilter !== 'ALL') {
    list = list.filter(q => q.status === statusFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(item => 
      item.id.toLowerCase().includes(q) || 
      item.customerName.toLowerCase().includes(q) ||
      (item.picName && item.picName.toLowerCase().includes(q)) ||
      (item.customerPhone && item.customerPhone.toLowerCase().includes(q)) ||
      (item.items && item.items.some(it => it.itemName?.toLowerCase().includes(q)))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted" style="padding: 28px;">Tidak ada data quotation penawaran harga ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(quo => {
    const badgeClass = quo.status === 'Accepted' ? 'badge-success' :
                        quo.status === 'Pengajuan' ? 'badge-amber' :
                        quo.status === 'Sent' ? 'badge-info' :
                        quo.status === 'Rejected' ? 'badge-danger' :
                        quo.status === 'Expired' ? 'badge-secondary' : 'badge-amber';

    const isJasa = quo.quotationType === 'jasa';
    const itemCount = quo.items ? quo.items.length : 0;
    const phone = quo.customerPhone || '';
    const warrantyText = quo.warranty || (quo.items && quo.items.find(i => i.warranty)?.warranty) || (isJasa ? 'Garansi Pengerjaan' : 'Garansi Standar');
    const isExpired = quo.validUntil && new Date(quo.validUntil) < new Date(new Date().toDateString());

    const isAccepted = quo.status === 'Accepted';
    const isPengajuan = quo.status === 'Pengajuan';
    const existingOrder = (state.orders || []).find(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id)));
    const isConverted = !!existingOrder;

    return `
      <tr class="${isAccepted ? 'row-accepted' : (isPengajuan ? 'row-pengajuan' : '')}" style="${isAccepted ? 'background-color: #f0fdf4;' : (isPengajuan ? 'background-color: #fffbeb;' : '')}; cursor: pointer;" onclick="if (!event.target.closest('.table-actions, button, a, input, select, textarea')) viewQuotationDetail('${quo.id}')" title="Klik untuk melihat rincian surat penawaran ${quo.id}">
        <td style="font-size: 11px; padding: 8px 6px;">
          <span class="mono-id font-bold text-primary" style="font-size: 11px; padding: 2px 4px; word-break: break-all;">${quo.id}</span>
          <div style="margin-top: 3px;">
            <span class="badge ${isJasa ? 'badge-info' : 'badge-outline'}" style="font-size: 9px; padding: 1.5px 5px; font-weight: 700;">
              ${isJasa ? '🛠️ Jasa' : '📦 Produk'}
            </span>
          </div>
        </td>
        <td>
          <div class="font-bold text-main" style="word-break: break-word;">${escapeHtml(quo.customerName)}</div>
          ${quo.projectName ? `<div class="text-primary font-bold" style="font-size: 11px; margin-top: 1px;"><i data-lucide="folder-kanban" style="width: 11px; height: 11px; display: inline; vertical-align: middle; color: #4f46e5;"></i> ${escapeHtml(quo.projectName)}</div>` : ''}
          ${quo.picName ? `<div class="text-muted font-sm" style="font-size: 10px;">UP: ${escapeHtml(quo.picName)}</div>` : ''}
        </td>
        <td>
          <div style="display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap;">
            <span class="font-mono font-sm" style="font-size: 11.5px;">${phone || '-'}</span>
            ${phone ? `
              <button type="button" class="btn-icon" style="color: #25d366; padding: 0; width: 22px; height: 22px;" title="Share WhatsApp (Format PDF)" onclick="shareQuotationWhatsApp('${quo.id}')">
                <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
              </button>
            ` : ''}
          </div>
        </td>
        <td style="font-size: 11.5px;">${quo.quotationDate || '-'}</td>
        <td style="font-size: 11.5px;">
          <span style="${isExpired ? 'color: #e11d48; font-weight: 600;' : ''}">${quo.validUntil || '-'}</span>
          ${isExpired ? '<br><span class="badge badge-danger" style="font-size: 9.5px; padding: 1px 4px; margin-top: 2px;">Expired</span>' : ''}
        </td>
        <td>
          <div style="font-size: 11px; line-height: 1.35; word-break: break-word;" title="${escapeAttr(warrantyText)}">
            <span class="badge badge-outline" style="font-size: 10px; border-color: #cbd5e1; white-space: normal; text-align: left; padding: 2px 6px;">
              <i data-lucide="shield-check" style="width: 11px; height: 11px; color: #10b981; display: inline; vertical-align: middle; flex-shrink: 0;"></i> ${escapeHtml(warrantyText)}
            </span>
          </div>
        </td>
        <td style="text-align: center;"><span class="badge badge-secondary font-bold" style="font-size: 10.5px;">${itemCount} Item</span></td>
        <td class="font-bold font-mono text-main" style="font-size: 12px; word-break: break-word;">${formatRupiah(quo.grandTotal)}</td>
        <td style="text-align: center;"><span class="badge ${badgeClass}" style="font-size: 10px; padding: 2px 6px;">${quo.status}</span></td>
        <td class="text-right" style="padding-right: 12px;">
          <div class="table-actions" style="display: inline-flex; gap: 4px; justify-content: flex-end; align-items: center; width: 100%;">
            <button class="btn-icon" style="color: #0284c7; width: 28px; height: 28px; border-radius: 4px;" title="Pratinjau & Cetak Dokumen PDF" onclick="viewQuotationDetail('${quo.id}')">
              <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="btn-icon" style="color: #16a34a; width: 28px; height: 28px; border-radius: 4px;" title="Share WhatsApp (Format PDF)" onclick="shareQuotationWhatsApp('${quo.id}')">
              <i data-lucide="share-2" style="width: 14px; height: 14px;"></i>
            </button>
            ${isConverted ? `
              <button class="btn-icon" style="color: #10b981; background: #ecfdf5; border: 1px solid #a7f3d0; width: 28px; height: 28px; border-radius: 4px; cursor: default;" title="Sudah Dikonversi ke Order Penjualan #${existingOrder.id}" onclick="showToast('Surat Penawaran ini sudah dikonversi ke Order Penjualan #${existingOrder.id}', 'info')">
                <i data-lucide="check-check" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn-icon" style="width: 28px; height: 28px; border-radius: 4px; color: #94a3b8; background: #f8fafc; cursor: not-allowed; border: 1px solid #e2e8f0;" title="Quotation Terkunci (Sudah Dikonversi ke Order Penjualan #${existingOrder.id})" onclick="showToast('Surat Penawaran #${quo.id} terkunci dan tidak dapat diedit karena sudah dikonversi ke Order Penjualan #${existingOrder.id}!', 'warning')">
                <i data-lucide="lock" style="width: 14px; height: 14px; color: #94a3b8;"></i>
              </button>
            ` : `
              <button class="btn-icon" style="color: #4f46e5; width: 28px; height: 28px; border-radius: 4px;" title="Konversi ke Order Penjualan" onclick="convertQuotationToOrder('${quo.id}')">
                <i data-lucide="arrow-right-circle" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn-icon" style="width: 28px; height: 28px; border-radius: 4px;" title="Edit Quotation" onclick="editQuotation('${quo.id}')">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
              </button>
            `}
            <button class="btn-icon btn-danger-ghost" style="width: 28px; height: 28px; border-radius: 4px;" title="${isConverted ? 'Quotation sudah dikonversi ke order' : 'Hapus Quotation'}" onclick="${isConverted ? `showToast('Surat Penawaran #${quo.id} tidak dapat dihapus karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!', 'warning')` : `deleteResource('quotations', '${quo.id}')`}">
              <i data-lucide="trash-2" style="width: 14px; height: 14px; ${isConverted ? 'opacity: 0.4;' : ''}"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterQuotations() {
  renderQuotationsTable();
}

// -------------------------------------------------------------
// TOGGLE TIPE PENAWARAN (PRODUK MANUFAKTUR vs JASA)
// -------------------------------------------------------------
function toggleQuotationTypeUI(type) {
  const isJasa = type === 'jasa';
  
  // Update toggle styling
  const optProduk = document.getElementById('quo-opt-produk-label');
  const optJasa = document.getElementById('quo-opt-jasa-label');
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

  // Update Section 1 title & descriptions
  const titleEl = document.getElementById('quo-section-1-title');
  const descEl = document.getElementById('quo-section-1-desc');
  const addBtnText = document.getElementById('quo-btn-add-item-text');
  const colName = document.getElementById('quo-col-item-name');
  const colSku = document.getElementById('quo-col-item-sku');
  const colPrice = document.getElementById('quo-col-item-price');
  const subTotalLabel = document.getElementById('quo-label-main-items-total');

  if (isJasa) {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="wrench" style="width: 16px; height: 16px; color: #10b981;"></i> 1. Rincian Penawaran Jasa & Layanan Pekerjaan (Non-BOM)';
    if (descEl) descEl.textContent = 'Rincian pekerjaan/jasa yang akan langsung diproses ke Penugasan Tim & Project Management (Tanpa formulasi BOM).';
    if (addBtnText) addBtnText.textContent = 'Tambah Baris Jasa/Pekerjaan';
    if (colName) colName.textContent = 'Nama Jasa / Uraian Pekerjaan *';
    if (colSku) colSku.textContent = 'Kode Jasa';
    if (colPrice) colPrice.textContent = 'Tarif / Biaya (Rp) *';
    if (subTotalLabel) subTotalLabel.textContent = 'Total Biaya Jasa Utama:';
  } else {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="package" style="width: 16px; height: 16px; color: #10b981;"></i> 1. Rincian Penawaran Harga Produk Utama';
    if (descEl) descEl.textContent = 'Barang/produk utama yang akan diproses ke Order Penjualan, formulasi BOM, & Purchasing';
    if (addBtnText) addBtnText.textContent = 'Tambah Baris Produk';
    if (colName) colName.textContent = 'Nama Produk / Deskripsi Item *';
    if (colSku) colSku.textContent = 'Kode / SKU';
    if (colPrice) colPrice.textContent = 'Harga Satuan (Rp) *';
    if (subTotalLabel) subTotalLabel.textContent = 'Total Produk Utama:';
  }

  // Update placeholders in existing rows
  document.querySelectorAll('.quotation-item-row').forEach(row => {
    const nameInput = row.querySelector('.item-name');
    const skuInput = row.querySelector('.item-sku');
    const unitInput = row.querySelector('.item-unit');
    const warrantyInput = row.querySelector('.item-warranty');

    if (nameInput) nameInput.placeholder = isJasa ? 'Uraian pekerjaan / layanan jasa' : 'Nama produk penawaran';
    if (skuInput) skuInput.placeholder = isJasa ? 'KODE-JASA' : 'SKU / Kode';
    if (unitInput && (!unitInput.value || unitInput.value === 'Unit' || unitInput.value === 'Lot')) {
      unitInput.value = isJasa ? 'Lot' : 'Unit';
      unitInput.placeholder = isJasa ? 'Lot/Bulan/Titik' : 'Unit/Pcs';
    }
    if (warrantyInput && (!warrantyInput.value || warrantyInput.value === '12 Bulan' || warrantyInput.value === '30 Hari Pengerjaan')) {
      warrantyInput.value = isJasa ? '30 Hari Pengerjaan' : '12 Bulan';
    }
  });

  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// FORMULIR QUOTATION (MODAL CREATE & EDIT)
// -------------------------------------------------------------
function openQuotationModal(quotationData = null) {
  if (quotationData && quotationData.id) {
    const existingOrder = (state.orders || []).find(o => o.quotationId === quotationData.id || (o.notes && o.notes.includes(quotationData.id)));
    if (existingOrder) {
      showToast(`⚠️ Surat Penawaran #${quotationData.id} tidak dapat diedit karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!`, 'warning');
      return;
    }
  }

  const isEdit = !!quotationData;
  const isJasa = quotationData?.quotationType === 'jasa';

  document.getElementById('form-modal-title').innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <i data-lucide="${isEdit ? 'edit-3' : 'file-plus'}" style="color: #2563eb;"></i>
      ${isEdit ? `Edit Surat Penawaran: <span class="mono-id">${quotationData.id}</span>` : 'Buat Surat Penawaran Harga (Quotation) Baru'}
    </span>
  `;
  
  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '1020px';
    modalContainer.style.width = '94vw';
  }

  const today = new Date().toISOString().split('T')[0];
  const defaultValidDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="quotation-form" onsubmit="submitQuotation(event, '${isEdit ? quotationData.id : ''}')" style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- CARD 1: PILIHAN TIPE PENAWARAN & INFORMASI CUSTOMER -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        
        <!-- PILIHAN TIPE PENAWARAN (PRODUK MANUFAKTUR vs JASA NON-BOM) -->
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <label class="form-label font-bold" style="font-size: 12px; margin-bottom: 2px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="layers" style="width: 15px; height: 15px; color: #2563eb;"></i> Kategori / Tipe Penawaran *
            </label>
            <span style="font-size: 11px; color: #64748b;">Pilih produk manufaktur (memerlukan BOM) atau jasa/layanan pekerjaan (Non-BOM pada Order Penjualan).</span>
          </div>
          <div style="display: inline-flex; gap: 10px; align-items: center;">
            <label id="quo-opt-produk-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1.5px solid ${isJasa ? '#cbd5e1' : '#3b82f6'}; background: ${isJasa ? '#f8fafc' : '#eff6ff'}; font-weight: ${isJasa ? '500' : '700'}; color: ${isJasa ? '#64748b' : '#1d4ed8'}; font-size: 12px; transition: all 0.2s;">
              <input type="radio" name="quotationType" value="produk" ${!isJasa ? 'checked' : ''} onchange="toggleQuotationTypeUI('produk')" style="cursor: pointer;">
              <span>📦 Produk Manufaktur (BOM)</span>
            </label>
            <label id="quo-opt-jasa-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1.5px solid ${isJasa ? '#10b981' : '#cbd5e1'}; background: ${isJasa ? '#ecfdf5' : '#f8fafc'}; font-weight: ${isJasa ? '700' : '500'}; color: ${isJasa ? '#047857' : '#64748b'}; font-size: 12px; transition: all 0.2s;">
              <input type="radio" name="quotationType" value="jasa" ${isJasa ? 'checked' : ''} onchange="toggleQuotationTypeUI('jasa')" style="cursor: pointer;">
              <span>🛠️ Jasa / Layanan (Non-BOM)</span>
            </label>
          </div>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="building-2" style="width: 16px; height: 16px; color: #2563eb;"></i> Informasi Calon Pelanggan & Status Penawaran
        </h4>

        <div style="display: grid; grid-template-columns: 1.4fr 1.4fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Nama Calon Pelanggan / Perusahaan *</label>
            <input type="text" name="customerName" class="form-control" placeholder="PT / CV / Instansi / Perorangan" required value="${escapeAttr(quotationData?.customerName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Project / Pekerjaan *</label>
            <input type="text" name="projectName" class="form-control" placeholder="Contoh: Smart Water IoT Monitoring System" required value="${escapeAttr(quotationData?.projectName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama PIC / Kontak Person</label>
            <input type="text" name="picName" class="form-control" placeholder="Contoh: Bpk. Hendra Gunawan" value="${escapeAttr(quotationData?.picName || '')}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">No. Telepon / WhatsApp *</label>
            <input type="text" name="customerPhone" class="form-control" placeholder="Contoh: 081234567890" required value="${escapeAttr(quotationData?.customerPhone || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Email Pelanggan</label>
            <input type="email" name="customerEmail" class="form-control" placeholder="email@perusahaan.com" value="${escapeAttr(quotationData?.customerEmail || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Penawaran *</label>
            <input type="date" name="quotationDate" class="form-control" required value="${quotationData?.quotationDate || today}">
          </div>
          <div class="form-group">
            <label class="form-label">Masa Berlaku Hingga (Valid Until)</label>
            <input type="date" name="validUntil" class="form-control" value="${quotationData?.validUntil || defaultValidDate}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-top: 14px;">
          <div class="form-group">
            <label class="form-label">Alamat Lengkap Customer</label>
            <input type="text" name="customerAddress" class="form-control" placeholder="Kawasan industri, alamat kantor atau pabrik calon pembeli" value="${escapeAttr(quotationData?.customerAddress || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Status Penawaran</label>
            <input type="hidden" name="status" value="${quotationData?.status || 'Sent'}">
            <div class="form-control" style="background: #f8fafc; border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${quotationData?.status === 'Accepted' ? '#16a34a' : (quotationData?.status === 'Pengajuan' ? '#b45309' : '#0284c7')}; cursor: default;">
              <i data-lucide="${quotationData?.status === 'Accepted' ? 'check-circle-2' : (quotationData?.status === 'Pengajuan' ? 'clock' : 'send')}" style="width: 15px; height: 15px;"></i>
              ${quotationData?.status === 'Accepted' ? '✅ Accepted (Disetujui)' : (quotationData?.status === 'Pengajuan' ? '🟡 Pengajuan (Dikonversi ke Order Penjualan)' : '✉️ Sent (Otomatis Terkirim saat Diterbitkan)')}
            </div>
          </div>
        </div>
      </div>

      <!-- CARD 2: RINCIAN PRODUK / JASA UTAMA & SUB RINCIAN JASA / INSTALASI -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        
        <!-- BAGIAN 1: PRODUK / JASA UTAMA -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 id="quo-section-1-title" style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="${isJasa ? 'wrench' : 'package'}" style="width: 16px; height: 16px; color: #10b981;"></i> ${isJasa ? '1. Rincian Penawaran Jasa & Layanan Pekerjaan (Non-BOM)' : '1. Rincian Penawaran Harga Produk Utama'}
            </h4>
            <p id="quo-section-1-desc" style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">${isJasa ? 'Rincian pekerjaan/jasa yang akan langsung diproses ke Penugasan Tim & Project Management (Tanpa formulasi BOM).' : 'Barang/produk utama yang akan diproses ke Order Penjualan, formulasi BOM, & Purchasing'}</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="addQuotationItemRow()" style="font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="plus"></i> <span id="quo-btn-add-item-text">${isJasa ? 'Tambah Baris Jasa/Pekerjaan' : 'Tambah Baris Produk'}</span>
          </button>
        </div>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 18px;">
          <div style="display: grid; grid-template-columns: minmax(0, 2.4fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: #475569;">
            <div id="quo-col-item-name">${isJasa ? 'Nama Jasa / Uraian Pekerjaan *' : 'Nama Produk / Deskripsi Item *'}</div>
            <div id="quo-col-item-sku">${isJasa ? 'Kode Jasa' : 'Kode / SKU'}</div>
            <div>Garansi</div>
            <div>Qty *</div>
            <div>Satuan</div>
            <div id="quo-col-item-price">${isJasa ? 'Tarif / Biaya (Rp) *' : 'Harga Satuan (Rp) *'}</div>
            <div>Total (Rp)</div>
            <div></div>
          </div>
          <div id="quotation-items-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff; max-height: 220px; overflow-y: auto; overflow-x: hidden;">
            <!-- Dynamically populated rows -->
          </div>
        </div>

        <!-- BAGIAN 2: SUB INPUT JASA & INSTALASI (KETERANGAN PENAWARAN) -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h4 style="font-size: 13px; font-weight: 700; color: #166534; margin: 0; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="wrench" style="width: 16px; height: 16px; color: #16a34a;"></i> 2. Sub Rincian Biaya Jasa Tambahan (Instalasi, Setting, Comm, dll.)
              </h4>
              <p style="font-size: 11px; color: #15803d; margin: 2px 0 0 0;">
                💡 <strong>Keterangan:</strong> Biaya jasa ini <strong>masuk ke Total Harga & tercetak di Quotation PDF</strong>, namun <strong>tidak terhubung ke BOM & Purchasing</strong>.
              </p>
            </div>
            <button type="button" class="btn btn-sm" onclick="addQuotationServiceRow()" style="background: #16a34a; color: #ffffff; border-color: #16a34a; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="plus"></i> Tambah Sub Jasa / Instalasi
            </button>
          </div>

          <div style="border: 1px solid #86efac; border-radius: 6px; overflow: hidden; background: #ffffff;">
            <div style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; background: #ecfdf5; padding: 8px 12px; border-bottom: 1px solid #86efac; font-size: 11px; font-weight: 700; color: #166534;">
              <div>Deskripsi Jasa / Biaya Tambahan (Instalasi, Commissioning, dll.)</div>
              <div>Qty</div>
              <div>Satuan</div>
              <div>Biaya Satuan (Rp)</div>
              <div>Total (Rp)</div>
              <div></div>
            </div>
            <div id="quotation-services-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff; max-height: 180px; overflow-y: auto; overflow-x: hidden;">
              <!-- Dynamically populated service rows -->
            </div>
          </div>
        </div>

      </div>

      <!-- CARD 3: KETENTUAN GARANSI, WAKTU PENGIRIMAN & PEMBAYARAN -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="shield-check" style="width: 16px; height: 16px; color: #8b5cf6;"></i> Ketentuan Garansi, Lead Time & Pembayaran
        </h4>

        <div style="display: grid; grid-template-columns: 1.2fr 1fr 1.2fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Klausul Garansi Produk / Pengerjaan</label>
            <input type="text" name="warranty" class="form-control" placeholder="Contoh: Garansi 12 Bulan suku cadang & servis" value="${escapeAttr(quotationData?.warranty || (isJasa ? 'Garansi pengerjaan 30 hari kalender setelah serah terima' : 'Garansi resmi 12 bulan untuk suku cadang dan servis'))}">
          </div>
          <div class="form-group">
            <label class="form-label">Estimasi Waktu Pelaksanaan / Pengiriman (Lead Time)</label>
            <input type="text" name="leadTime" class="form-control" placeholder="Contoh: 14 hari kerja setelah PO" value="${escapeAttr(quotationData?.leadTime || (isJasa ? '7-14 hari kerja setelah PO resmi' : '14 hari kerja setelah PO resmi diterima'))}">
          </div>
          <div class="form-group">
            <label class="form-label">Syarat Pembayaran (Payment Terms)</label>
            <input type="text" name="paymentTerms" class="form-control" placeholder="Contoh: DP 50%, Pelunasan sebelum kirim" value="${escapeAttr(quotationData?.paymentTerms || 'DP 50% saat PO, Pelunasan setelah serah terima / BAST')}">
          </div>
        </div>
      </div>

      <!-- CARD 4: CATATAN & KALKULASI FINANSIAL -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 14px; height: 14px; color: #64748b;"></i> Syarat & Ketentuan Tambahan
          </label>
          <textarea name="notes" class="form-control" rows="5" placeholder="Ketentuan ruang lingkup pekerjaan, akomodasi, toleransi, dll...">${escapeAttr(quotationData?.notes || '1. Harga sudah termasuk biaya instalasi dan pengetesan fungsi di lokasi.\n2. Penawaran harga ini mengikat selama masa berlaku penawaran.')}</textarea>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px;">
              <span class="text-muted" id="quo-label-main-items-total">${isJasa ? 'Total Biaya Jasa Utama:' : 'Total Produk Utama:'}</span>
              <span id="quo-main-items-total" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #15803d;">
              <span>Sub Jasa & Instalasi:</span>
              <span id="quo-services-total" class="font-mono font-bold">+ Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
              <span class="text-muted font-bold">Total Nilai Penawaran:</span>
              <span id="quo-items-total" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; background: #f0fdf4; padding: 6px 10px; border-radius: 6px; border: 1px dashed #86efac;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="font-bold text-success" style="color: #16a34a; font-size: 12.5px;">+ Biaya Garansi (5%):</span>
              </div>
              <span id="quo-warranty-fee" class="font-mono font-bold text-success" style="color: #16a34a;">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <span class="text-muted font-bold">Subtotal (Item + Garansi):</span>
              <span id="quo-subtotal" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="text-muted font-bold">Potongan / Diskon (Rp):</span>
              </div>
              <input type="number" id="quo-discount" name="discount" value="${quotationData?.discount ?? 0}" min="0" style="width: 130px; height: 28px; padding: 2px 8px; font-size: 12px; font-family: monospace; border: 1px solid var(--border-color); border-radius: 4px; text-align: right;" oninput="calculateQuotationTotals()">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="text-muted font-bold">PPN (%):</span>
                <input type="number" id="quo-tax-rate" name="taxRate" value="${quotationData?.taxRate ?? 11}" min="0" max="100" style="width: 55px; height: 26px; padding: 2px 6px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px;" oninput="calculateQuotationTotals()">
              </div>
              <span id="quo-tax-amount" class="font-mono text-muted">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #0f172a; padding-top: 10px; font-size: 15px;">
              <span class="font-bold text-main">Grand Total:</span>
              <span id="quo-grand-total" class="font-mono font-bold text-primary" style="font-size: 18px;">Rp 0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL FOOTER ACTIONS -->
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding-top: 16px; border-top: 1px solid var(--border-color); margin-top: 6px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
          <i data-lucide="save"></i> ${isEdit ? 'Perbarui Quotation' : 'Simpan & Terbitkan Quotation'}
        </button>
      </div>
    </form>
  `;

  const itemsContainer = document.getElementById('quotation-items-list');
  if (quotationData && quotationData.items && quotationData.items.length > 0) {
    quotationData.items.forEach(item => addQuotationItemRow(item));
  } else {
    addQuotationItemRow();
  }

  // Populate additional services if present
  if (quotationData && quotationData.additionalServices && quotationData.additionalServices.length > 0) {
    quotationData.additionalServices.forEach(svc => addQuotationServiceRow(svc));
  }

  calculateQuotationTotals();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function addQuotationItemRow(item = null) {
  const container = document.getElementById('quotation-items-list');
  if (!container) return;

  const typeRadio = document.querySelector('input[name="quotationType"]:checked');
  const isJasa = typeRadio ? (typeRadio.value === 'jasa') : false;

  const defaultUnit = item?.unit || (isJasa ? 'Lot' : 'Unit');
  const defaultWarranty = item?.warranty || (isJasa ? '30 Hari Pengerjaan' : '12 Bulan');

  const row = document.createElement('div');
  row.className = 'quotation-item-row';
  row.style = 'display: grid; grid-template-columns: minmax(0, 2.4fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; align-items: center;';

  row.innerHTML = `
    <div>
      <input type="text" class="form-control item-name" placeholder="${isJasa ? 'Uraian pekerjaan / layanan jasa' : 'Nama produk penawaran'}" required value="${escapeAttr(item?.itemName || '')}">
    </div>
    <div>
      <input type="text" class="form-control item-sku" placeholder="${isJasa ? 'KODE-JASA' : 'SKU / Kode'}" value="${escapeAttr(item?.sku || '')}">
    </div>
    <div>
      <input type="text" class="form-control item-warranty" placeholder="Garansi item" value="${escapeAttr(defaultWarranty)}">
    </div>
    <div>
      <input type="number" class="form-control item-qty" placeholder="1" min="1" step="any" required value="${item?.qty || 1}" oninput="calculateQuotationTotals()">
    </div>
    <div>
      <input type="text" class="form-control item-unit" placeholder="${isJasa ? 'Lot/Bulan' : 'Unit/Pcs'}" value="${escapeAttr(defaultUnit)}">
    </div>
    <div>
      <input type="number" class="form-control item-price" placeholder="0" min="0" step="500" required value="${item?.unitPrice || 0}" oninput="calculateQuotationTotals()">
    </div>
    <div>
      <input type="text" class="form-control item-total" readonly style="background: #f8fafc; font-family: monospace; font-weight: 600;" value="Rp 0">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris" onclick="removeQuotationItemRow(this)">
        <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  calculateQuotationTotals();
}

function removeQuotationItemRow(btn) {
  const container = document.getElementById('quotation-items-list');
  if (!container) return;
  if (container.querySelectorAll('.quotation-item-row').length <= 1) {
    showToast('Minimal harus ada 1 baris item produk utama!', 'warning');
    return;
  }
  btn.closest('.quotation-item-row').remove();
  calculateQuotationTotals();
}

function addQuotationServiceRow(service = null) {
  const container = document.getElementById('quotation-services-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'quotation-service-row';
  row.style = 'display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; align-items: center;';

  row.innerHTML = `
    <div>
      <input type="text" class="form-control service-name" placeholder="Contoh: Jasa Instalasi & Penarikan Kabel di Lokasi" required value="${escapeAttr(service?.serviceName || '')}">
    </div>
    <div>
      <input type="number" class="form-control service-qty" placeholder="1" min="1" step="any" required value="${service?.qty || 1}" oninput="calculateQuotationTotals()">
    </div>
    <div>
      <input type="text" class="form-control service-unit" placeholder="Lot/Titik/Hari" value="${escapeAttr(service?.unit || 'Lot')}">
    </div>
    <div>
      <input type="number" class="form-control service-price" placeholder="0" min="0" step="500" required value="${service?.unitPrice || 0}" oninput="calculateQuotationTotals()">
    </div>
    <div>
      <input type="text" class="form-control service-total" readonly style="background: #f8fafc; font-family: monospace; font-weight: 600;" value="Rp 0">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris Jasa" onclick="removeQuotationServiceRow(this)">
        <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  calculateQuotationTotals();
}

function removeQuotationServiceRow(btn) {
  btn.closest('.quotation-service-row').remove();
  calculateQuotationTotals();
}

function calculateQuotationTotals() {
  const itemRows = document.querySelectorAll('.quotation-item-row');
  let mainItemsTotal = 0;

  itemRows.forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
    const total = qty * price;
    mainItemsTotal += total;

    const totalInput = row.querySelector('.item-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const serviceRows = document.querySelectorAll('.quotation-service-row');
  let servicesTotal = 0;

  serviceRows.forEach(row => {
    const qty = parseFloat(row.querySelector('.service-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.service-price')?.value) || 0;
    const total = qty * price;
    servicesTotal += total;

    const totalInput = row.querySelector('.service-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  // Biaya Garansi 5% dihitung dari total Produk & Jasa
  const itemsTotal = mainItemsTotal + servicesTotal;
  const warrantyFee = itemsTotal > 0 ? Math.round(itemsTotal * 0.05) : 0;
  const subtotal = itemsTotal + warrantyFee;

  const discountInput = document.getElementById('quo-discount');
  const discount = Math.max(0, parseFloat(discountInput?.value) || 0);

  const taxableAmount = Math.max(0, subtotal - discount);

  const taxRateInput = document.getElementById('quo-tax-rate');
  const taxRate = parseFloat(taxRateInput?.value) || 0;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100));
  const grandTotal = taxableAmount + taxAmount;

  const mainItemsTotalEl = document.getElementById('quo-main-items-total');
  if (mainItemsTotalEl) mainItemsTotalEl.textContent = formatRupiah(mainItemsTotal);

  const servicesTotalEl = document.getElementById('quo-services-total');
  if (servicesTotalEl) servicesTotalEl.textContent = formatRupiah(servicesTotal);

  const itemsTotalEl = document.getElementById('quo-items-total');
  if (itemsTotalEl) itemsTotalEl.textContent = formatRupiah(itemsTotal);

  const warrantyFeeEl = document.getElementById('quo-warranty-fee');
  if (warrantyFeeEl) warrantyFeeEl.textContent = formatRupiah(warrantyFee);

  const subtotalEl = document.getElementById('quo-subtotal');
  if (subtotalEl) subtotalEl.textContent = formatRupiah(subtotal);

  const taxEl = document.getElementById('quo-tax-amount');
  if (taxEl) taxEl.textContent = formatRupiah(taxAmount);

  const grandEl = document.getElementById('quo-grand-total');
  if (grandEl) grandEl.textContent = formatRupiah(grandTotal);

  return { mainItemsTotal, servicesTotal, itemsTotal, warrantyFee, subtotal, discount, taxRate, taxAmount, grandTotal };
}

// -------------------------------------------------------------
// SUBMIT QUOTATION (POST & PUT)
// -------------------------------------------------------------
async function submitQuotation(event, id) {
  event.preventDefault();
  const form = event.target;
  const isEdit = !!id;

  if (isEdit) {
    const existingOrder = (state.orders || []).find(o => o.quotationId === id || (o.notes && o.notes.includes(id)));
    if (existingOrder) {
      showToast(`⚠️ Surat Penawaran #${id} tidak dapat diedit/disimpan karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!`, 'error');
      return;
    }
  }

  const items = [];
  const rows = document.querySelectorAll('.quotation-item-row');
  rows.forEach(row => {
    const itemName = row.querySelector('.item-name')?.value.trim();
    const sku = row.querySelector('.item-sku')?.value.trim();
    const warranty = row.querySelector('.item-warranty')?.value.trim();
    const qty = parseFloat(row.querySelector('.item-qty')?.value) || 1;
    const unit = row.querySelector('.item-unit')?.value.trim() || 'Unit';
    const unitPrice = parseFloat(row.querySelector('.item-price')?.value) || 0;
    const total = qty * unitPrice;

    if (itemName) {
      items.push({ itemName, sku, warranty, qty, unit, unitPrice, total });
    }
  });

  if (items.length === 0) {
    showToast('Harap masukkan minimal 1 barang/produk penawaran utama!', 'warning');
    return;
  }

  const additionalServices = [];
  document.querySelectorAll('.quotation-service-row').forEach(row => {
    const serviceName = row.querySelector('.service-name')?.value.trim();
    const qty = parseFloat(row.querySelector('.service-qty')?.value) || 1;
    const unit = row.querySelector('.service-unit')?.value.trim() || 'Lot';
    const unitPrice = parseFloat(row.querySelector('.service-price')?.value) || 0;
    const total = qty * unitPrice;
    if (serviceName) {
      additionalServices.push({ serviceName, qty, unit, unitPrice, total });
    }
  });

  const { mainItemsTotal, servicesTotal, itemsTotal, warrantyFee, subtotal, discount, taxRate, taxAmount, grandTotal } = calculateQuotationTotals();
  const quotationType = form.querySelector('input[name="quotationType"]:checked')?.value || 'produk';

  const payload = {
    quotationType,
    customerName: form.customerName.value.trim(),
    projectName: form.projectName ? form.projectName.value.trim() : '',
    picName: form.picName.value.trim(),
    customerPhone: form.customerPhone.value.trim(),
    customerEmail: form.customerEmail.value.trim(),
    customerAddress: form.customerAddress.value.trim(),
    quotationDate: form.quotationDate.value,
    validUntil: form.validUntil.value,
    status: isEdit ? (form.status?.value || 'Sent') : 'Sent',
    warranty: form.warranty.value.trim(),
    warrantyFee,
    mainItemsTotal,
    servicesTotal,
    itemsTotal,
    leadTime: form.leadTime.value.trim(),
    paymentTerms: form.paymentTerms.value.trim(),
    notes: form.notes.value.trim(),
    items,
    additionalServices,
    subtotal,
    discount,
    taxRate,
    taxAmount,
    grandTotal
  };

  try {
    const url = isEdit ? `/api/quotations/${id}` : '/api/quotations';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeModal('form-modal');
      showToast(isEdit ? `Quotation ${id} berhasil diperbarui!` : 'Quotation baru berhasil diterbitkan & tersimpan di database!', 'success');
      await fetchResource('quotations');
      renderQuotationsTable();
      updateSidebarBadges();
    } else {
      const err = await res.json();
      showToast(err.error || 'Gagal menyimpan penawaran', 'error');
    }
  } catch (err) {
    console.error('Error saving quotation:', err);
    showToast('Terjadi kesalahan jaringan saat menyimpan', 'error');
  }
}

function editQuotation(id) {
  const quotation = (state.quotations || []).find(q => q.id === id);
  if (!quotation) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }
  const existingOrder = (state.orders || []).find(o => o.quotationId === quotation.id || (o.notes && o.notes.includes(quotation.id)));
  if (existingOrder) {
    showToast(`⚠️ Surat Penawaran #${quotation.id} terkunci dan tidak dapat diedit karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!`, 'warning');
    return;
  }
  openQuotationModal(quotation);
}

// -------------------------------------------------------------
// DOKUMEN CETAK / PRATINJAU QUOTATION (PDF)
// -------------------------------------------------------------
function buildQuotationPrintableHtml(quo) {
  const isJasa = quo.quotationType === 'jasa';
  const discountRow = quo.discount > 0 ? `
    <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
      <span>Potongan / Diskon:</span>
      <span class="text-danger" style="color: #ef4444;">- ${formatRupiah(quo.discount)}</span>
    </div>
  ` : '';

  const mainItemsTotalVal = quo.mainItemsTotal !== undefined ? quo.mainItemsTotal : (quo.items ? quo.items.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0);
  const servicesTotalVal = quo.servicesTotal !== undefined ? quo.servicesTotal : (quo.additionalServices ? quo.additionalServices.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0);
  const itemsTotalVal = quo.itemsTotal || (mainItemsTotalVal + servicesTotalVal) || quo.subtotal;
  const warrantyFeeVal = quo.warrantyFee !== undefined ? quo.warrantyFee : Math.round(itemsTotalVal * 0.05);

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'UNIT BISNIS MANDIRI (UBM)',
    parentInstitution: 'POLITEKNIK TAKUMI',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi - Jawa Barat',
    phone: '(021) 8990-1234',
    email: 'ubm@takumi.ac.id',
    website: 'ubm.takumi.ac.id',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  return `
    <div class="doc-preview" style="background: #ffffff; color: #0f172a; width: 100%; max-width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- HEADER KOP SURAT UBM -->
      <div class="doc-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">${escapeHtml(compSettings.companyName.toUpperCase())}</div>
          <div style="font-size: 13px; font-weight: 700; color: #2563eb;">${escapeHtml(compSettings.parentInstitution.toUpperCase())}</div>
          <div class="text-muted font-sm" style="margin-top: 4px; line-height: 1.4; font-size: 11px;">
            ${escapeHtml(compSettings.address)}<br>
            Telp: ${escapeHtml(compSettings.phone)} &bull; Email: ${escapeHtml(compSettings.email)} &bull; Web: ${escapeHtml(compSettings.website)}
          </div>
        </div>
        <div class="text-right" style="text-align: right;">
          <h2 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">SURAT PENAWARAN HARGA</h2>
          <div class="font-mono font-bold text-primary" style="font-size: 13.5px; margin-top: 4px;">${quo.id}</div>
          <div style="margin-top: 2px;">
            <span class="badge ${isJasa ? 'badge-info' : 'badge-outline'}" style="font-size: 9.5px; padding: 2px 6px;">
              ${isJasa ? '🛠️ Penawaran Jasa & Layanan' : '📦 Penawaran Produk Manufaktur'}
            </span>
          </div>
          <div class="font-sm text-muted" style="margin-top: 2px; font-size: 11.5px;">Tanggal: <strong>${quo.quotationDate || '-'}</strong></div>
          <div class="font-sm" style="color: #e11d48; margin-top: 2px; font-size: 11.5px;">Berlaku s/d: <strong>${quo.validUntil || '-'}</strong></div>
        </div>
      </div>

      <!-- KEPADA YTH & INFORMASI PELANGGAN -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; padding: 12px 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1;">
        <div>
          <div class="font-sm font-bold text-muted" style="margin-bottom: 4px; font-size: 10.5px; text-transform: uppercase;">KEPADA YTH (CALON CUSTOMER):</div>
          <div class="font-bold text-main" style="font-size: 14px;">${escapeHtml(quo.customerName)}</div>
          ${quo.projectName ? `<div class="font-sm font-bold" style="font-size: 12px; color: #1e40af; margin-top: 2px;">Project: ${escapeHtml(quo.projectName)}</div>` : ''}
          ${quo.picName ? `<div class="font-sm font-bold text-primary" style="font-size: 11.5px; margin-top: 2px;">UP: ${escapeHtml(quo.picName)}</div>` : ''}
          <div class="font-sm text-muted" style="margin-top: 2px; font-size: 11px;">${quo.customerAddress || 'Alamat tidak dicantumkan'}</div>
          <div class="font-sm" style="margin-top: 4px; font-size: 11px;">
            Telp / WA: <strong>${quo.customerPhone || '-'}</strong>
            ${quo.customerEmail ? ` &bull; Email: ${escapeHtml(quo.customerEmail)}` : ''}
          </div>
        </div>
        <div style="border-left: 1px dashed #cbd5e1; padding-left: 14px;">
          <div class="font-sm font-bold text-muted" style="margin-bottom: 4px; font-size: 10.5px; text-transform: uppercase;">INFORMASI PENAWARAN:</div>
          <div class="font-sm" style="font-size: 11.5px;">No. Referensi: <strong class="font-mono">${quo.id}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Tipe: <strong>${isJasa ? 'Jasa / Layanan' : 'Produk Manufaktur'}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Tanggal Terbit: <strong>${quo.quotationDate || '-'}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Masa Berlaku: <strong>${quo.validUntil || '-'}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Estimasi Lead Time: <strong>${quo.leadTime || (isJasa ? '7-14 hari kerja' : '14 hari kerja')}</strong></div>
        </div>
      </div>

      <!-- TABEL DAFTAR BARANG / JASA (STRICTLY NO HORIZONTAL SCROLL) -->
      <table class="doc-table" style="width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-bottom: 16px;">
        <colgroup>
          <col style="width: 5%;">
          <col style="width: 36%;">
          <col style="width: 14%;">
          <col style="width: 8%;">
          <col style="width: 9%;">
          <col style="width: 13%;">
          <col style="width: 15%;">
        </colgroup>
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">No</th>
            <th style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">${isJasa ? 'Uraian Pekerjaan / Layanan Jasa' : 'Deskripsi Produk / Layanan Teknik'}</th>
            <th style="font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">Garansi</th>
            <th style="text-align: center; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">Qty</th>
            <th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">Satuan</th>
            <th style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${isJasa ? 'Tarif Satuan' : 'Harga Satuan'}</th>
            <th style="text-align: right; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">Total (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${(quo.items || []).map((it, idx) => `
            <tr>
              <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${idx + 1}</td>
              <td style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; word-break: break-word;">
                <div class="font-bold">${escapeHtml(it.itemName)}</div>
                ${it.sku ? `<div class="font-sm text-muted font-mono font-xs" style="font-size: 10px;">${isJasa ? 'Kode' : 'SKU'}: ${escapeHtml(it.sku)}</div>` : ''}
              </td>
              <td style="font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1; word-break: break-word;">
                <span class="badge badge-secondary font-xs" style="font-size: 9.5px; padding: 2px 4px;">${escapeHtml(it.warranty || quo.warranty || (isJasa ? '30 Hari' : '12 Bulan'))}</span>
              </td>
              <td style="text-align: center; font-weight: 700; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">${it.qty}</td>
              <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${escapeHtml(it.unit || (isJasa ? 'Lot' : 'Unit'))}</td>
              <td style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(it.unitPrice)}</td>
              <td style="text-align: right; font-weight: 700; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(it.total || (it.qty * it.unitPrice))}</td>
            </tr>
          `).join('')}
          ${(quo.additionalServices && quo.additionalServices.length > 0) ? `
            <tr style="background: #f8fafc;">
              <td colspan="7" style="padding: 6px 8px; font-weight: 700; font-size: 10.5px; color: #4338ca; border: 1px solid #cbd5e1; text-transform: uppercase;">
                Rincian Jasa, Instalasi & Layanan Tambahan (Keterangan Non-BOM)
              </td>
            </tr>
            ${quo.additionalServices.map((svc, sIdx) => `
              <tr>
                <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${(quo.items?.length || 0) + sIdx + 1}</td>
                <td colspan="2" style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; color: #4338ca; word-break: break-word;">
                  <div class="font-bold">${escapeHtml(svc.serviceName)}</div>
                </td>
                <td style="text-align: center; font-weight: 700; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">${svc.qty}</td>
                <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${escapeHtml(svc.unit || 'Lot')}</td>
                <td style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(svc.unitPrice)}</td>
                <td style="text-align: right; font-weight: 700; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; color: #4338ca;" class="font-mono">${formatRupiah(svc.total || (svc.qty * svc.unitPrice))}</td>
              </tr>
            `).join('')}
          ` : ''}
        </tbody>
      </table>

      <!-- KALKULASI FINANSIAL -->
      <div class="doc-totals" style="margin-bottom: 20px;">
        <div class="calc-summary" style="margin-left: auto; width: 340px;">
          ${mainItemsTotalVal > 0 && servicesTotalVal > 0 ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
              <span class="text-muted">${isJasa ? 'Total Jasa Utama:' : 'Total Produk Utama:'}</span>
              <span class="font-mono">${formatRupiah(mainItemsTotalVal)}</span>
            </div>
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; color: #4338ca;">
              <span>Subtotal Jasa & Instalasi:</span>
              <span class="font-mono">+${formatRupiah(servicesTotalVal)}</span>
            </div>
          ` : ''}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; font-weight: 600;">
            <span>Total Produk & Jasa:</span>
            <span class="font-mono">${formatRupiah(itemsTotalVal)}</span>
          </div>
          ${warrantyFeeVal > 0 ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; color: #16a34a; font-weight: 600;">
              <span>+ Biaya Garansi (5%):</span>
              <span class="font-mono">+${formatRupiah(warrantyFeeVal)}</span>
            </div>
          ` : ''}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; font-weight: 700; border-top: 1px dashed #cbd5e1;">
            <span>Subtotal (Item + Garansi):</span>
            <span class="font-mono">${formatRupiah(quo.subtotal)}</span>
          </div>
          ${discountRow}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
            <span>PPN (${quo.taxRate || 11}%):</span>
            <span class="font-mono">${formatRupiah(quo.taxAmount)}</span>
          </div>
          <div class="calc-row total" style="border-top: 2px solid #0f172a; padding-top: 6px; font-size: 13.5px; display: flex; justify-content: space-between; font-weight: 700;">
            <span>Grand Total:</span>
            <span class="font-mono text-primary">${formatRupiah(quo.grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- KETENTUAN DAN GARANSI -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; margin-bottom: 24px; font-size: 11px; line-height: 1.55;">
        <div class="font-bold text-main" style="margin-bottom: 5px; font-size: 11.5px;">Syarat & Ketentuan Penawaran (Terms & Conditions):</div>
        <ol style="margin: 0; padding-left: 18px;">
          <li><strong>Garansi ${isJasa ? 'Pengerjaan / Layanan' : 'Produk / Pengerjaan'}:</strong> ${escapeHtml(quo.warranty || (isJasa ? 'Garansi pengerjaan 30 hari kalender.' : 'Garansi 12 bulan untuk servis dan suku cadang.'))}</li>
          <li><strong>Waktu Penyerahan (Lead Time):</strong> ${escapeHtml(quo.leadTime || (isJasa ? 'Sesuai kesepakatan target milestone.' : 'Sesuai kesepakatan setelah PO diterima.'))}</li>
          <li><strong>Ketentuan Pembayaran:</strong> ${escapeHtml(quo.paymentTerms || 'DP 50%, Pelunasan sebelum barang diserahterimakan.')}</li>
          <li><strong>Masa Berlaku Penawaran:</strong> Penawaran harga ini berlaku hingga tanggal <strong>${quo.validUntil || '-'}</strong>.</li>
          ${quo.notes ? `<li><strong>Catatan Khusus:</strong> ${escapeHtml(quo.notes).replace(/\n/g, '<br>')}</li>` : ''}
        </ol>
      </div>

      <!-- KOLOM TANDA TANGAN RESMI -->
      <div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 16px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 11px;">
        <div style="width: 250px;">
          <div class="text-muted" style="font-weight: 600;">Disetujui Oleh (Calon Pelanggan),</div>
          <div style="margin-top: 55px; font-weight: bold;">
            ( ..................................... )
          </div>
          <div class="text-muted" style="font-size: 10px; margin-top: 4px;">Tanda Tangan & Cap Perusahaan</div>
        </div>

        <div style="width: 250px;">
          <div class="text-muted" style="font-weight: 600;">Hormat Kami,</div>
          <div class="font-bold" style="color: #1e40af;">${escapeHtml(compSettings.companyName || 'Unit Bisnis Mandiri (UBM)')}</div>
          <div style="margin-top: 55px; font-weight: bold;">
            ( ${escapeHtml(compSettings.leaderName || 'Ir. Hendra Wijaya, M.T.')} )
          </div>
          <div class="text-muted" style="font-size: 10px; margin-top: 2px;">${escapeHtml(compSettings.leaderRole || 'Ketua Unit Bisnis Mandiri (UBM)')}</div>
        </div>
      </div>
    </div>
  `;
}

function viewQuotationDetail(id) {
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }

  const content = document.getElementById('preview-modal-content');
  if (!content) return;

  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `
      <span style="display: inline-flex; align-items: center; gap: 8px;">
        <i data-lucide="file-check-2" style="color: #2563eb;"></i>
        Surat Penawaran Resmi: <span class="mono-id">${quo.id}</span>
      </span>
    `;
  }

  const docHtml = buildQuotationPrintableHtml(quo);

  const existingOrder = (state.orders || []).find(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id)));
  const isConverted = !!existingOrder;

  content.innerHTML = `
    <!-- STRIP AKSI INTERAKTIF MODAL (NO-PRINT) -->
    <div class="no-print" style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="font-sm font-bold text-muted">Status:</span>
        <span class="badge ${quo.status === 'Accepted' ? 'badge-success' : (quo.status === 'Pengajuan' ? 'badge-amber' : 'badge-info')}" style="${quo.status === 'Pengajuan' ? 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700;' : ''}">${quo.status}</span>
        ${isConverted ? `
          <span class="badge badge-success" style="font-size: 11px; padding: 2px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="check-check" style="width: 13px; height: 13px;"></i> Dikonversi ke Order #${existingOrder.id}
          </span>
        ` : ''}
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn btn-sm btn-outline" style="color: #16a34a; border-color: #86efac; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="shareQuotationWhatsApp('${quo.id}')">
          <i data-lucide="message-circle"></i> Share WhatsApp (PDF)
        </button>
        ${isConverted ? `
          <button type="button" class="btn btn-sm" style="background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px;" title="Quotation tidak dapat diedit karena sudah dikonversi ke Order Penjualan #${existingOrder.id}" onclick="showToast('Surat Penawaran #${quo.id} terkunci dan tidak dapat diedit karena sudah dikonversi ke Order Penjualan #${existingOrder.id}!', 'warning')">
            <i data-lucide="lock" style="width: 13px; height: 13px; color: #94a3b8;"></i> Edit Terkunci
          </button>
          <button type="button" class="btn btn-sm" style="background: #e2e8f0; color: #64748b; border: 1px solid #cbd5e1; cursor: not-allowed; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;" disabled title="Quotation ini sudah pernah dikonversi ke Order Penjualan #${existingOrder.id}">
            <i data-lucide="check-circle-2" style="color: #16a34a;"></i> Sudah Dikonversi
          </button>
        ` : `
          <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('preview-modal'); editQuotation('${quo.id}')">
            <i data-lucide="edit-3"></i> Edit
          </button>
          <button type="button" class="btn btn-sm btn-primary" style="background: #4f46e5; border-color: #4f46e5; display: inline-flex; align-items: center; gap: 6px;" onclick="closeModal('preview-modal'); convertQuotationToOrder('${quo.id}')">
            <i data-lucide="shopping-cart"></i> Konversi ke Order
          </button>
        `}
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="quotation-printable-area">
      ${docHtml}
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

function printQuotationPDF(id) {
  viewQuotationDetail(id);
  setTimeout(() => {
    printCurrentDocument();
  }, 250);
}

// -------------------------------------------------------------
// SHARE OTOMATIS KE WHATSAPP DALAM FORMAT PDF
// -------------------------------------------------------------
let activeQuotationShareData = null;
let activeQuotationPdfBlob = null;
let activeQuotationPdfFile = null;
let activeQuotationPdfUrl = '';

async function shareQuotationWhatsApp(id) {
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }

  let phone = quo.customerPhone ? quo.customerPhone.trim() : '';

  // Prompt jika nomor telepon belum ada
  if (!phone) {
    const inputPhone = prompt(`Nomor WhatsApp customer "${quo.customerName}" belum tersimpan.\nMasukkan nomor WhatsApp (contoh: 081234567890):`);
    if (!inputPhone) return;
    phone = inputPhone.trim();
  }

  // Format sanitasi nomor telepon Indonesia (+62)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  } else if (cleanPhone.startsWith('8')) {
    cleanPhone = '62' + cleanPhone;
  }

  activeQuotationShareData = { ...quo, cleanPhone };

  // Buka modal share WhatsApp dengan status loading awal
  const modalBody = document.getElementById('wa-share-modal-body');
  if (modalBody) {
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 24px 10px;">
        <div class="loading-spinner" style="width: 38px; height: 38px; border: 3px solid #e2e8f0; border-top-color: #16a34a; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px auto;"></div>
        <h4 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">Menyiapkan Dokumen PDF Quotation...</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Mengonversi surat penawaran resmi <strong>${quo.id}</strong> menjadi berkas PDF berkualitas tinggi.</p>
      </div>
    `;
    openModal('wa-share-modal');
  }

  try {
    // 1. Siapkan wrapper container dokumen resmi
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '790px';
    container.style.padding = '20px 24px';
    container.style.background = '#ffffff';
    container.style.boxSizing = 'border-box';
    container.innerHTML = buildQuotationPrintableHtml(quo);
    document.body.appendChild(container);

    let pdfFileUrl = quo.pdfUrl || '';
    let pdfBlob = null;

    // 2. Generate PDF via html2pdf
    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Quotation_${quo.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = html2pdf().set(opt).from(container);
      pdfBlob = await worker.output('blob');
      const pdfBase64 = await worker.output('datauristring');

      // Simpan ke disk server UBM agar memiliki link download permanen
      try {
        const uploadRes = await fetch(`/api/quotations/${quo.id}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64,
            filename: `Quotation_${quo.id}.pdf`
          })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          pdfFileUrl = uploadData.fileUrl;
          quo.pdfUrl = pdfFileUrl;
        }
      } catch (errUpload) {
        console.warn('Gagal menyimpan file PDF ke server disk:', errUpload);
      }

      // Otomatis download file PDF ke komputer/perangkat
      if (pdfBlob) {
        activeQuotationPdfBlob = pdfBlob;
        activeQuotationPdfFile = new File([pdfBlob], `Quotation_${quo.id}.pdf`, { type: 'application/pdf' });
        activeQuotationPdfUrl = pdfFileUrl ? `${window.location.origin}${pdfFileUrl}` : `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;

        const downloadUrl = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Quotation_${quo.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        }, 1200);
      }
    }

    container.remove();

    const fullPdfLink = activeQuotationPdfUrl || `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;
    const canNativeFileShare = !!(activeQuotationPdfFile && navigator.canShare && navigator.canShare({ files: [activeQuotationPdfFile] }));

    // Tampilkan Konten Modal Siap Kirim PDF
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 18px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background: #dcfce7; color: #16a34a; margin-bottom: 8px;">
            <i data-lucide="check-circle" style="width: 28px; height: 28px;"></i>
          </div>
          <h4 style="font-size: 16px; font-weight: 700; margin: 0; color: #0f172a;">Dokumen PDF Siap Dikirim!</h4>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0;">
            Berkas <strong class="text-primary font-mono">Quotation_${quo.id}.pdf</strong> telah otomatis diunduh ke perangkat Anda.
          </p>
        </div>

        <!-- Kartu Metadata Dokumen -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #fee2e2; color: #e11d48; padding: 8px 10px; border-radius: 6px; font-weight: 800; font-size: 11.5px; display: flex; align-items: center; gap: 4px;">
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> PDF
            </div>
            <div>
              <div style="font-weight: 700; font-size: 13px; color: #0f172a;">Quotation_${quo.id}.pdf</div>
              <div style="font-size: 11px; color: var(--text-muted);">
                Kepada: <strong>${escapeHtml(quo.customerName)}</strong> &bull; WA: <strong>${cleanPhone}</strong>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-outline" style="font-size: 11px;" onclick="downloadCurrentQuotationPdf()" title="Unduh Ulang Berkas PDF">
            <i data-lucide="download"></i> Unduh PDF
          </button>
        </div>

        <!-- Tombol Aksi Kirim -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;">
          ${canNativeFileShare ? `
          <button type="button" class="btn btn-primary" style="background: #16a34a; border-color: #16a34a; padding: 12px; font-size: 13.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="triggerNativeSharePDF()">
            <i data-lucide="share-2"></i> Kirim Berkas File PDF Langsung ke WhatsApp
          </button>
          ` : ''}

          <button type="button" class="btn btn-primary" style="background: #16a34a; border-color: #16a34a; padding: 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="openWhatsAppChatWithPdfLink()">
            <i data-lucide="message-circle"></i> Buka WhatsApp Web & Kirim Dokumen PDF
          </button>

          <button type="button" class="btn btn-outline" style="padding: 9px; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="copyQuotationImageToClipboard()">
            <i data-lucide="copy"></i> Salin Gambar Dokumen (Bisa Langsung Paste / Ctrl+V di WhatsApp)
          </button>
        </div>

        <!-- Panduan Lampiran PDF di WhatsApp Web -->
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; font-size: 11.5px; color: #1e40af; line-height: 1.55;">
          <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="info" style="width: 14px; height: 14px; flex-shrink: 0;"></i> Cara Mengirim Dokumen PDF di WhatsApp Web:
          </div>
          <ol style="margin: 0; padding-left: 18px;">
            <li>File <strong>Quotation_${quo.id}.pdf</strong> sudah otomatis terunduh di komputer Anda.</li>
            <li>Klik tombol <strong>"Buka WhatsApp Web"</strong> di atas.</li>
            <li>Di chat WhatsApp, cukup <strong>drag & drop (tarik) file PDF yang baru terunduh tersebut ke dalam chat</strong>, atau klik ikon klip kertas (📎) &rarr; Dokumen.</li>
            <li>Tautan unduh dokumen PDF resmi juga telah otomatis terisi pada pesan chat.</li>
          </ol>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }

  } catch (err) {
    console.error('Error in shareQuotationWhatsApp:', err);
    showToast('Gagal memproses berkas PDF untuk WhatsApp', 'error');
  }
}

// Handler: Download Berkas PDF yang aktif
function downloadCurrentQuotationPdf() {
  if (!activeQuotationPdfBlob || !activeQuotationShareData) {
    showToast('Berkas PDF belum siap', 'warning');
    return;
  }
  const downloadUrl = window.URL.createObjectURL(activeQuotationPdfBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `Quotation_${activeQuotationShareData.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }, 1000);
  showToast(`File Quotation_${activeQuotationShareData.id}.pdf diunduh!`, 'success');
}

// Handler: Native Share File PDF (Jika didukung OS/Browser)
async function triggerNativeSharePDF() {
  if (!activeQuotationPdfFile || !activeQuotationShareData) return;
  const quo = activeQuotationShareData;
  const fullPdfLink = activeQuotationPdfUrl || `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;

  const message = 
`*SURAT PENAWARAN HARGA RESMI (QUOTATION)*
*UNIT BISNIS MANDIRI (UBM) - POLITEKNIK TAKUMI*
--------------------------------------------------
Kepada Yth: *${quo.customerName}*
${quo.picName ? `UP: ${quo.picName}\n` : ''}No. Penawaran : *${quo.id}*
Tanggal       : ${quo.quotationDate || '-'}
Masa Berlaku  : s/d ${quo.validUntil || '-'}
Grand Total   : *${formatRupiah(quo.grandTotal)}*
Garansi       : ${quo.warranty || (quo.quotationType === 'jasa' ? 'Garansi Pengerjaan' : '12 Bulan')}
Lead Time     : ${quo.leadTime || (quo.quotationType === 'jasa' ? '7-14 hari kerja' : '14 hari kerja')}
--------------------------------------------------
📄 *DOKUMEN FORMAT PDF RESMI TERLAMPIR*
Tautan file: ${fullPdfLink}
--------------------------------------------------
Terima kasih.
*Sales & Engineering Team UBM Takumi*`;

  try {
    await navigator.share({
      files: [activeQuotationPdfFile],
      title: `Quotation_${quo.id}.pdf`,
      text: message
    });
    showToast('✅ Berkas PDF berhasil dibagikan ke WhatsApp!', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Native share gagal, membuka WhatsApp web:', err);
      openWhatsAppChatWithPdfLink();
    }
  }
}

// Handler: Buka Chat WhatsApp Web dengan Pesan Dokumen PDF
function openWhatsAppChatWithPdfLink() {
  if (!activeQuotationShareData) return;
  const quo = activeQuotationShareData;
  const fullPdfLink = activeQuotationPdfUrl || `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;

  const message = 
`*SURAT PENAWARAN HARGA RESMI (QUOTATION)*
*UNIT BISNIS MANDIRI (UBM) - POLITEKNIK TAKUMI*
--------------------------------------------------
Kepada Yth:
*${quo.customerName}*
${quo.picName ? `UP: ${quo.picName}\n` : ''}${quo.customerAddress ? `Alamat: ${quo.customerAddress}\n` : ''}
No. Penawaran : *${quo.id}*
Tipe          : *${quo.quotationType === 'jasa' ? '🛠️ Jasa & Layanan Pekerjaan' : '📦 Produk Manufaktur'}*
Tanggal       : ${quo.quotationDate || '-'}
Masa Berlaku  : *s/d ${quo.validUntil || '-'}*
Grand Total   : *${formatRupiah(quo.grandTotal)}*
Garansi       : ${quo.warranty || (quo.quotationType === 'jasa' ? 'Garansi Pengerjaan' : '12 Bulan')}
Lead Time     : ${quo.leadTime || (quo.quotationType === 'jasa' ? '7-14 hari kerja' : '14 hari kerja')}
--------------------------------------------------
📄 *DOKUMEN RESMI FORMAT PDF:*
Silakan unduh atau buka berkas PDF resmi melalui tautan di bawah ini:
👉 ${fullPdfLink}
--------------------------------------------------

*(Berkas file PDF asli juga telah kami lampirkan/unduh ke komputer)*

Silakan konfirmasi jika penawaran harga ini telah disetujui. Terima kasih.

*Sales & Engineering Team UBM*
Politeknik Takumi
Web: ubm.takumi.ac.id`;

  // Pastikan file PDF juga terunduh
  downloadCurrentQuotationPdf();

  const waUrl = `https://wa.me/${quo.cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  showToast(`✅ WhatsApp Web terbuka! Silakan drag file PDF yang baru terunduh ke dalam chat.`, 'success');
}

// Handler: Salin Gambar Dokumen Penawaran ke Clipboard (Ctrl+V di WhatsApp)
async function copyQuotationImageToClipboard() {
  if (!activeQuotationShareData) return;
  const quo = activeQuotationShareData;

  showToast('⏳ Menyalin gambar dokumen penawaran ke clipboard...', 'info');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '790px';
  container.style.padding = '20px 24px';
  container.style.background = '#ffffff';
  container.style.boxSizing = 'border-box';
  container.innerHTML = buildQuotationPrintableHtml(quo);
  document.body.appendChild(container);

  try {
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      container.remove();

      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast('Gagal membuat gambar dokumen', 'error');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('📋 Gambar Dokumen Quotation disalin! Buka WhatsApp Web lalu tekan Ctrl+V / Paste!', 'success');
        } catch (errClip) {
          console.warn('Clipboard write image error:', errClip);
          showToast('Browser membatasi penyalinan gambar otomatis. Gunakan file PDF yang telah terunduh.', 'warning');
        }
      }, 'image/png');
    } else {
      container.remove();
      showToast('Engine konversi gambar tidak tersedia', 'warning');
    }
  } catch (err) {
    container.remove();
    console.error('Error copying quotation image:', err);
    showToast('Gagal menyalin gambar dokumen', 'error');
  }
}

// -------------------------------------------------------------
// KONVERSI QUOTATION KE ORDER PENJUALAN
// -------------------------------------------------------------
function convertQuotationToOrder(id) {
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }

  // Validasi: Konversi ke order penjualan dari quotation hanya bisa dilakukan 1 kali saja
  const existingOrder = (state.orders || []).find(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id)));
  if (existingOrder) {
    showToast(`⚠️ Quotation ini sudah pernah dikonversi ke Order Penjualan #${existingOrder.id}! Tidak dapat dikonversi kembali.`, 'warning');
    return;
  }

  const isJasa = quo.quotationType === 'jasa';

  if (!confirm(`Konversi Quotation ${isJasa ? 'Jasa' : 'Produk'} "${quo.id}" menjadi Order Penjualan baru?`)) {
    return;
  }

  // Otomatis ubah status Quotation menjadi 'Pengajuan' di halaman quotation
  quo.status = 'Pengajuan';
  fetch(`/api/quotations/${quo.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...quo, status: 'Pengajuan' })
  }).catch(err => console.error('Error updating quotation status to Pengajuan:', err));

  if (typeof renderQuotationsTable === 'function') {
    renderQuotationsTable();
  }

  // Siapkan keterangan rincian jasa tambahan (non-BOM) jika ada
  let serviceNotes = '';
  if (quo.additionalServices && quo.additionalServices.length > 0) {
    serviceNotes = '\n\n[KETERANGAN JASA & INSTALASI (NON-BOM)]:\n' + 
      quo.additionalServices.map((s, idx) => `${idx + 1}. ${s.serviceName} (${s.qty} ${s.unit || 'Lot'} @ ${formatRupiah(s.unitPrice)}) = ${formatRupiah(s.total)}`).join('\n');
  }

  // Siapkan data Order baru dari Quotation dengan status 'Pengajuan'
  // CATATAN: items HANYA berisi produk manufaktur utama (quo.items) agar BOM & Purchasing hanya memproses produk fisik
  const orderData = {
    quotationId: quo.id,
    orderType: quo.quotationType || 'produk',
    quotationType: quo.quotationType || 'produk',
    customerName: quo.customerName,
    projectName: quo.projectName || (quo.items?.[0]?.itemName || ''),
    customerPhone: quo.customerPhone || '',
    customerAddress: quo.customerAddress || '',
    orderDate: new Date().toISOString().split('T')[0],
    dueDate: quo.validUntil || '',
    status: 'Pengajuan',
    notes: `Dikonversi dari Surat Penawaran Harga (${isJasa ? 'JASA' : 'PRODUK'}) #${quo.id}.\nKetentuan Garansi: ${quo.warranty || '-'}.\nLead time: ${quo.leadTime || '-'}.${serviceNotes}${quo.notes ? `\n\nCatatan Tambahan:\n${quo.notes}` : ''}`,
    items: (quo.items || []).map(it => ({ ...it })),
    additionalServices: quo.additionalServices || [],
    mainItemsTotal: quo.mainItemsTotal,
    servicesTotal: quo.servicesTotal,
    itemsTotal: quo.itemsTotal,
    warrantyFee: quo.warrantyFee,
    discount: quo.discount || 0,
    taxRate: quo.taxRate ?? 11,
    subtotal: quo.subtotal || 0,
    taxAmount: quo.taxAmount || 0,
    grandTotal: quo.grandTotal || 0
  };

  // Navigasi ke orders dan buka form modal terisi
  navigateTo('orders');
  setTimeout(() => {
    openOrderModal(orderData);
    showToast(`Status Quotation ${quo.id} otomatis menjadi "Pengajuan" & dimuat ke formulir Order!`, 'info');
  }, 150);
}
