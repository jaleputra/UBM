// =========================================================
// UBM - Purchase Order (PO) Module
// =========================================================

function renderPOTable() {
  const tbody = document.getElementById('table-po-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-po-status')?.value || 'ALL';
  let list = state.po || [];

  if (statusFilter !== 'ALL') {
    list = list.filter(p => p.status === statusFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => 
      p.id.toLowerCase().includes(q) || 
      p.vendorName.toLowerCase().includes(q) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 24px;">Tidak ada data purchase order ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(po => {
    const badgeClass = po.status === 'Received' ? 'badge-success' :
                       po.status === 'Approved' ? 'badge-info' :
                       po.status === 'Sent' ? 'badge-purple' : 'badge-secondary';

    return `
      <tr>
        <td class="mono-id">${po.id}</td>
        <td>
          <div class="font-bold">${po.vendorName}</div>
          <div class="text-muted font-sm">${po.vendorContact || ''}</div>
        </td>
        <td>${po.poDate}</td>
        <td>${po.expectedDelivery || '-'}</td>
        <td><span class="badge badge-secondary">${po.items?.length || 0} Item</span></td>
        <td class="font-bold">${formatRupiah(po.totalAmount)}</td>
        <td><span class="badge ${badgeClass}">${po.status}</span></td>
        <td class="text-right">
          <div class="table-actions">
            <button class="btn-icon" title="Lihat PO" onclick="viewPODetail('${po.id}')"><i data-lucide="eye"></i></button>
            <button class="btn-icon" title="Edit PO" onclick="editPO('${po.id}')"><i data-lucide="edit-3"></i></button>
            <button class="btn-icon btn-danger-ghost" title="Hapus PO" onclick="deleteResource('po', '${po.id}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function openPOModal(poData = null) {
  const isEdit = !!poData;
  const modalTitle = document.getElementById('form-modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = `<i data-lucide="file-spreadsheet" style="color: #2563eb;"></i> ${isEdit ? 'Edit Purchase Order: ' + poData.id : 'Buat Purchase Order (PO) Baru'}`;
  }
  
  // Expand modal container width for spacious clean layout
  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '980px';
    modalContainer.style.width = '92vw';
  }

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="po-form" onsubmit="submitPO(event, '${isEdit ? poData.id : ''}')" style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- CARD 1: INFORMASI UTAMA VENDOR & PURCHASE ORDER -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="building-2" style="width: 16px; height: 16px; color: #2563eb;"></i> Informasi Vendor & Purchase Order
        </h4>
        
        <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Nama Vendor / Supplier *</label>
            <input type="text" name="vendorName" class="form-control" required placeholder="PT / CV Supplier Mitra" value="${escapeAttr(poData?.vendorName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Kontak / Sales Vendor</label>
            <input type="text" name="vendorContact" class="form-control" placeholder="Nama Sales / No. HP / Email" value="${escapeAttr(poData?.vendorContact || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Status Purchase Order</label>
            <select name="status" class="form-control" style="font-weight: 600;">
              <option value="Draft" ${poData?.status === 'Draft' ? 'selected' : ''}>📝 Draft</option>
              <option value="Sent" ${poData?.status === 'Sent' ? 'selected' : ''}>📤 Sent to Vendor</option>
              <option value="Approved" ${poData?.status === 'Approved' ? 'selected' : ''}>🟢 Approved</option>
              <option value="Received" ${poData?.status === 'Received' ? 'selected' : ''}>📦 Received / Selesai</option>
              <option value="Cancelled" ${poData?.status === 'Cancelled' ? 'selected' : ''}>🔴 Cancelled</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Alamat Lengkap Vendor</label>
            <input type="text" name="vendorAddress" class="form-control" placeholder="Alamat kantor, gudang, atau workshop vendor" value="${escapeAttr(poData?.vendorAddress || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal PO *</label>
            <input type="date" name="poDate" class="form-control" required value="${poData?.poDate || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Target Pengiriman (Expected)</label>
            <input type="date" name="expectedDelivery" class="form-control" value="${poData?.expectedDelivery || ''}">
          </div>
        </div>
      </div>

      <!-- CARD 2: RINCIAN BARANG YANG DIPESAN -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="package" style="width: 16px; height: 16px; color: #10b981;"></i> Rincian Barang & Material yang Dipesan
            </h4>
            <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">Input nama barang/material, spesifikasi part, jumlah, dan harga beli satuan</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="addPOItemRow()" style="font-size: 11.5px;">
            <i data-lucide="plus"></i> Tambah Baris Barang
          </button>
        </div>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
          <div style="display: grid; grid-template-columns: minmax(0, 2.5fr) minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: #475569;">
            <div>Nama Barang / Spesifikasi Material</div>
            <div>Part No / SKU</div>
            <div>Qty</div>
            <div>Satuan</div>
            <div>Harga Satuan (Rp)</div>
            <div>Total (Rp)</div>
            <div></div>
          </div>
          <div id="po-items-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff;">
            <!-- Dynamically populated rows -->
          </div>
        </div>
      </div>

      <!-- CARD 3: SYARAT PEMBAYARAN & KALKULASI FINANSIAL -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 14px; height: 14px; color: #64748b;"></i> Syarat & Ketentuan Pembayaran (TOP)
          </label>
          <textarea name="notes" class="form-control" rows="3" placeholder="Term of Payment, garansi vendor, tempat serah terima barang...">${escapeAttr(poData?.notes || 'Term of Payment: 30 Hari setelah barang diterima lengkap dan lolos uji QC.')}</textarea>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <span class="text-muted font-bold">Subtotal Pembelian:</span>
              <span id="po-subtotal" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="text-muted font-bold">PPN Masukan (%):</span>
                <input type="number" id="po-tax-rate" name="taxRate" value="${poData?.taxRate ?? 11}" min="0" max="100" style="width: 55px; height: 26px; padding: 2px 6px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px;" oninput="calculatePOTotals()">
              </div>
              <span id="po-tax-amount" class="font-mono text-muted">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 15px; border-top: 1px dashed var(--border-color); padding-top: 10px;">
              <span style="font-weight: 800; color: #0f172a;">Total Nilai PO:</span>
              <span id="po-grand-total" class="font-mono font-bold text-primary" style="font-size: 16px; color: #2563eb;">Rp 0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- BOTTOM ACTION BAR -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 4px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 9px 24px; font-weight: 600;">
          <i data-lucide="save"></i> ${isEdit ? 'Perbarui Purchase Order' : 'Terbitkan Purchase Order'}
        </button>
      </div>
    </form>
  `;

  const itemsContainer = document.getElementById('po-items-list');
  if (poData && poData.items && poData.items.length > 0) {
    poData.items.forEach(item => addPOItemRow(item));
  } else {
    addPOItemRow();
  }

  calculatePOTotals();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function addPOItemRow(item = null) {
  const container = document.getElementById('po-items-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'item-row po-item-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 2.5fr) minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; align-items: center; background: #f8fafc; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0;';
  
  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm po-item-name" placeholder="Nama Barang / Part *" required value="${escapeAttr(item?.itemName || '')}" style="font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm po-item-sku" placeholder="Part No / SKU" value="${escapeAttr(item?.sku || '')}">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm po-item-qty" placeholder="1" min="0.01" step="any" required value="${item?.qty || 1}" oninput="calculatePOTotals()" style="text-align: right; font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm po-item-unit" placeholder="Pcs/Unit/Kg" value="${escapeAttr(item?.unit || 'Pcs')}">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm po-item-price" placeholder="0" min="0" required value="${item?.unitPrice || 0}" oninput="calculatePOTotals()" style="text-align: right; font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm po-item-total font-mono" readonly value="${formatRupiah((item?.qty || 1) * (item?.unitPrice || 0))}" style="text-align: right; background: #ffffff; font-weight: 700;">
    </div>
    <div style="display: flex; justify-content: center;">
      <button type="button" class="btn-icon btn-danger-ghost btn-sm" title="Hapus Baris" onclick="this.closest('.po-item-row').remove(); calculatePOTotals();">
        <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

function calculatePOTotals() {
  const rows = document.querySelectorAll('#po-items-list .po-item-row');
  let subtotal = 0;
  
  rows.forEach(r => {
    const qty = parseFloat(r.querySelector('.po-item-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.po-item-price')?.value) || 0;
    const total = qty * price;
    subtotal += total;
    const totalInput = r.querySelector('.po-item-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const taxRate = parseFloat(document.getElementById('po-tax-rate')?.value) || 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + taxAmount;

  const subEl = document.getElementById('po-subtotal');
  const taxEl = document.getElementById('po-tax-amount');
  const grandEl = document.getElementById('po-grand-total');

  if (subEl) subEl.textContent = formatRupiah(subtotal);
  if (taxEl) taxEl.textContent = formatRupiah(taxAmount);
  if (grandEl) grandEl.textContent = formatRupiah(grandTotal);

  return { subtotal, taxRate, taxAmount, grandTotal };
}

async function submitPO(e, editId = '') {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const items = [];
  document.querySelectorAll('#po-items-list .po-item-row').forEach(r => {
    items.push({
      itemName: r.querySelector('.po-item-name').value,
      sku: r.querySelector('.po-item-sku')?.value?.trim() || '',
      qty: parseFloat(r.querySelector('.po-item-qty').value) || 1,
      unit: r.querySelector('.po-item-unit').value || 'Pcs',
      unitPrice: parseFloat(r.querySelector('.po-item-price').value) || 0,
      totalCost: (parseFloat(r.querySelector('.po-item-qty').value) || 1) * (parseFloat(r.querySelector('.po-item-price').value) || 0)
    });
  });

  if (items.length === 0) {
    showToast('Harap tambahkan minimal 1 item pesanan', 'warning');
    return;
  }

  const totals = calculatePOTotals();
  const payload = {
    vendorName: formData.get('vendorName'),
    vendorContact: formData.get('vendorContact'),
    vendorAddress: formData.get('vendorAddress'),
    poDate: formData.get('poDate'),
    expectedDelivery: formData.get('expectedDelivery'),
    status: formData.get('status'),
    items,
    subtotal: totals.subtotal,
    taxRate: totals.taxRate,
    taxAmount: totals.taxAmount,
    totalAmount: totals.grandTotal,
    notes: formData.get('notes')
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`/api/po/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('form-modal');
      showToast(`Purchase Order berhasil ${editId ? 'diperbarui' : 'dibuat'}!`, 'success');
      await fetchResource('po');
      renderPOTable();
      updateSidebarBadges();
    } else {
      showToast('Gagal menyimpan Purchase Order', 'error');
    }
  } catch (err) {
    console.error('Error saving PO:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

function viewPODetail(poId) {
  const po = state.po.find(p => p.id === poId);
  if (!po) return;

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
          <h2 style="font-size: 20px; font-weight: 800; color: #1e293b;">PURCHASE ORDER</h2>
          <div class="font-mono font-bold text-primary">${po.id}</div>
          <div class="font-sm text-muted">Tanggal PO: ${po.poDate}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding: 14px; background: #f8fafc; border-radius: 6px;">
        <div>
          <div class="font-sm font-bold text-muted">VENDOR / SUPPLIER:</div>
          <div class="font-bold text-main" style="font-size: 15px;">${po.vendorName}</div>
          <div>${po.vendorContact || '-'}</div>
          <div class="font-sm text-muted">${po.vendorAddress || ''}</div>
        </div>
        <div class="text-right">
          <div class="font-sm font-bold text-muted">TARGET PENGIRIMAN:</div>
          <div>Status: <span class="badge badge-info">${po.status}</span></div>
          <div>Expected: <strong>${po.expectedDelivery || '-'}</strong></div>
        </div>
      </div>

      <table class="doc-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Barang & Spesifikasi</th>
            <th class="text-center">Qty</th>
            <th class="text-center">Satuan</th>
            <th class="text-right">Harga Satuan</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(po.items || []).map((it, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td class="font-bold">${it.itemName}</td>
              <td class="text-center font-bold">${it.qty}</td>
              <td class="text-center">${it.unit || 'Pcs'}</td>
              <td class="text-right">${formatRupiah(it.unitPrice)}</td>
              <td class="text-right font-bold">${formatRupiah(it.totalCost || (it.qty * it.unitPrice))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="doc-totals">
        <div class="calc-summary" style="margin-left: auto;">
          <div class="calc-row"><span>Subtotal:</span><span>${formatRupiah(po.subtotal || po.totalAmount)}</span></div>
          <div class="calc-row"><span>PPN (${po.taxRate || 11}%):</span><span>${formatRupiah(po.taxAmount || 0)}</span></div>
          <div class="calc-row total"><span>Total Pembelian:</span><span>${formatRupiah(po.totalAmount)}</span></div>
        </div>
      </div>

      ${po.notes ? `<div class="mt-4 p-3 bg-light rounded font-sm"><strong>Syarat & Ketentuan:</strong> ${po.notes}</div>` : ''}

      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center;">
        <div>
          <div class="font-sm text-muted">Dibuat Oleh (Purchasing),</div>
          <div style="margin-top: 50px; font-weight: bold;">( Purchasing Officer )</div>
        </div>
        <div>
          <div class="font-sm text-muted">Disetujui Oleh Vendor,</div>
          <div style="margin-top: 50px; font-weight: bold;">( ${po.vendorName} )</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
}

function editPO(poId) {
  const po = state.po.find(p => p.id === poId);
  if (po) openPOModal(po);
}
