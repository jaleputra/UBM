// =========================================================
// UBM - Delivery Module (Surat Jalan / DO)
// =========================================================

function renderDeliveryTable() {
  const tbody = document.getElementById('table-delivery-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-delivery-status')?.value || 'ALL';
  let list = state.delivery || [];

  if (statusFilter !== 'ALL') {
    list = list.filter(d => d.status === statusFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(d =>
      d.id.toLowerCase().includes(q) ||
      (d.customerName && d.customerName.toLowerCase().includes(q)) ||
      (d.orderId && d.orderId.toLowerCase().includes(q)) ||
      (d.courierName && d.courierName.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 24px;">Tidak ada data surat jalan pengiriman ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(doItem => {
    const badgeClass = doItem.status === 'Delivered / Received' ? 'badge-success' :
      doItem.status === 'In Transit' ? 'badge-purple' :
        doItem.status === 'Packing / Ready' ? 'badge-info' : 'badge-secondary';

    return `
      <tr>
        <td class="mono-id">${doItem.id}</td>
        <td class="mono-id font-sm">${doItem.orderId || '-'}</td>
        <td>
          <div class="font-bold">${doItem.customerName}</div>
          <div class="text-muted font-sm">${doItem.deliveryAddress || ''}</div>
        </td>
        <td>${doItem.deliveryDate}</td>
        <td>
          <div>${doItem.courierName || 'Armada Sendiri'}</div>
          <div class="text-muted font-sm">${doItem.driverName || '-'}</div>
        </td>
        <td><span class="badge badge-secondary">${doItem.items?.length || 0} Barang</span></td>
        <td><span class="badge ${badgeClass}">${doItem.status}</span></td>
        <td class="text-right">
          <div class="table-actions">
            <button class="btn-icon" title="Cetak Surat Jalan" onclick="viewDeliveryDetail('${doItem.id}')"><i data-lucide="printer"></i></button>
            <button class="btn-icon" title="Edit Surat Jalan" onclick="editDelivery('${doItem.id}')"><i data-lucide="edit-3"></i></button>
            <button class="btn-icon btn-danger-ghost" title="Hapus" onclick="deleteResource('delivery', '${doItem.id}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function openDeliveryModal(doData = null) {
  const isEdit = !!doData;
  document.getElementById('form-modal-title').textContent = isEdit ? `Edit Surat Jalan: ${doData.id}` : 'Terbitkan Surat Jalan (Delivery Order)';

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '980px';
    modalContainer.style.width = '92vw';
  }

  let orderOptions = '<option value="">-- Pilih Referensi Sales Order --</option>';
  (state.orders || []).forEach(o => {
    orderOptions += `<option value="${o.id}" ${doData?.orderId === o.id ? 'selected' : ''}>[${o.id}] ${o.customerName} (${o.items?.length || 0} items)</option>`;
  });

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="delivery-form" onsubmit="submitDelivery(event, '${isEdit ? doData.id : ''}')" style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- CARD 1: INFORMASI PENERIMA & EKSPEDISI PENGIRIMAN -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="truck" style="width: 16px; height: 16px; color: #2563eb;"></i> Informasi Penerima & Ekspedisi Pengiriman
        </h4>

        <div style="display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Terkait Sales Order</label>
            <select name="orderId" class="form-control" onchange="autoFillDeliveryFromOrder(this.value)">
              ${orderOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Penerima / Pelanggan *</label>
            <input type="text" name="customerName" id="do-cust-name" class="form-control" placeholder="PT / CV / Nama Customer" required value="${escapeAttr(doData?.customerName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Pengiriman *</label>
            <input type="date" name="deliveryDate" class="form-control" required value="${doData?.deliveryDate || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Status Pengiriman</label>
            <select name="status" class="form-control" style="font-weight: 600;">
              <option value="Packing / Ready" ${doData?.status === 'Packing / Ready' ? 'selected' : ''}>📦 Packing / Ready</option>
              <option value="In Transit" ${doData?.status === 'In Transit' ? 'selected' : ''}>🚚 In Transit (Jalan)</option>
              <option value="Delivered / Received" ${doData?.status === 'Delivered / Received' ? 'selected' : ''}>🟢 Delivered (Diterima)</option>
              <option value="Returned" ${doData?.status === 'Returned' ? 'selected' : ''}>🔴 Returned (Retur)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1.2fr 1.2fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Alamat Lengkap Tujuan Pengiriman</label>
            <input type="text" name="deliveryAddress" id="do-cust-address" class="form-control" placeholder="Alamat pabrik, gudang, atau site customer" value="${escapeAttr(doData?.deliveryAddress || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Armada / Kurir Ekspedisi</label>
            <input type="text" name="courierName" class="form-control" placeholder="Contoh: Armada UBM Box / Lalamove" value="${escapeAttr(doData?.courierName || 'Armada Operasional UBM')}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Driver / No. Polisi / Resi</label>
            <input type="text" name="driverName" class="form-control" placeholder="Nama Supir atau No. AWB Resi" value="${escapeAttr(doData?.driverName || '')}">
          </div>
        </div>
      </div>

      <!-- CARD 2: DAFTAR BARANG YANG DIKIRIM (DELIVERY ITEMS) -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="package-check" style="width: 16px; height: 16px; color: #10b981;"></i> Rincian Barang yang Dikirimkan
            </h4>
            <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">Daftar item produk jadi atau komponen yang diserahterimakan kepada pihak logistik & customer</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="addDeliveryItemRow()" style="font-size: 11.5px;">
            <i data-lucide="plus"></i> Tambah Baris Barang
          </button>
        </div>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
          <div style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 2fr) 40px; gap: 8px; background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: #475569;">
            <div>Nama Barang & Deskripsi Produk</div>
            <div>Qty Kirim</div>
            <div>Satuan</div>
            <div>No. Seri / Serial Number / Kondisi</div>
            <div></div>
          </div>
          <div id="delivery-items-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff;">
            <!-- Dynamically populated rows -->
          </div>
        </div>
      </div>

      <!-- CARD 3: CATATAN SOPIR & RINGKASAN KUANTITAS -->
      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; align-items: start;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 14px; height: 14px; color: #64748b;"></i> Catatan Tambahan untuk Sopir / Ekspedisi / Penerima
          </label>
          <textarea name="notes" class="form-control" rows="3" placeholder="Instruksi penanganan khusus, jam penerimaan gudang, kontak security pabrik...">${escapeAttr(doData?.notes || '')}</textarea>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <span class="text-muted font-bold">Total Jenis Barang:</span>
              <span id="do-total-kinds" class="font-mono font-bold text-main">0 Jenis</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 15px;">
              <span class="font-bold text-main">Total Unit Dikirim:</span>
              <span id="do-total-qty" class="font-mono font-bold text-primary" style="font-size: 17px;">0 Unit</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border-color); margin-top: 4px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 9px 24px;">
          <i data-lucide="save"></i> ${isEdit ? 'Perbarui Surat Jalan' : 'Cetak & Simpan Surat Jalan'}
        </button>
      </div>
    </form>
  `;

  const itemsContainer = document.getElementById('delivery-items-list');
  if (doData && doData.items && doData.items.length > 0) {
    doData.items.forEach(item => addDeliveryItemRow(item));
  } else {
    addDeliveryItemRow();
  }

  calculateDeliveryTotals();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function autoFillDeliveryFromOrder(orderId) {
  if (!orderId) return;
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const nameEl = document.getElementById('do-cust-name');
  const addrEl = document.getElementById('do-cust-address');
  if (nameEl) nameEl.value = order.customerName || '';
  if (addrEl) addrEl.value = order.customerAddress || '';

  const listContainer = document.getElementById('delivery-items-list');
  if (listContainer && order.items && order.items.length > 0) {
    listContainer.innerHTML = '';
    order.items.forEach(item => {
      addDeliveryItemRow({
        itemName: item.itemName,
        qty: item.qty,
        unit: item.unit,
        serialNumbers: `SN-${item.sku || 'UBM'}`
      });
    });
  }
  calculateDeliveryTotals();
}

function addDeliveryItemRow(item = null) {
  const container = document.getElementById('delivery-items-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'item-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 2fr) 40px; gap: 8px; align-items: center; background: #ffffff; padding: 4px 6px; border-radius: 4px;';

  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm do-item-name" placeholder="Nama Barang & Spesifikasi *" required value="${escapeAttr(item?.itemName || '')}" style="font-size: 12px;">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm do-item-qty" placeholder="1" min="0.01" step="any" required value="${item?.qty || 1}" oninput="calculateDeliveryTotals()" style="font-size: 12px; font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm do-item-unit" placeholder="Pcs/Unit" value="${escapeAttr(item?.unit || 'Unit')}" style="font-size: 12px;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm do-item-serial" placeholder="Serial No. / Kondisi Baik" value="${escapeAttr(item?.serialNumbers || '')}" style="font-size: 12px;">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost btn-sm" title="Hapus Baris" onclick="this.closest('.item-row').remove(); calculateDeliveryTotals();"><i data-lucide="trash-2"></i></button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  calculateDeliveryTotals();
}

function calculateDeliveryTotals() {
  const rows = document.querySelectorAll('#delivery-items-list .item-row');
  let totalKinds = rows.length;
  let totalQty = 0;

  rows.forEach(r => {
    const qty = parseFloat(r.querySelector('.do-item-qty')?.value) || 0;
    totalQty += qty;
  });

  const kindEl = document.getElementById('do-total-kinds');
  if (kindEl) kindEl.textContent = `${totalKinds} Jenis`;

  const qtyEl = document.getElementById('do-total-qty');
  if (qtyEl) qtyEl.textContent = `${totalQty} Unit / Item`;
}

async function submitDelivery(e, editId = '') {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const items = [];
  document.querySelectorAll('#delivery-items-list .item-row').forEach(r => {
    items.push({
      itemName: r.querySelector('.do-item-name').value,
      qty: parseFloat(r.querySelector('.do-item-qty').value) || 1,
      unit: r.querySelector('.do-item-unit').value || 'Unit',
      serialNumbers: r.querySelector('.do-item-serial').value
    });
  });

  if (items.length === 0) {
    showToast('Harap tambahkan minimal 1 item barang yang dikirim', 'warning');
    return;
  }

  const payload = {
    orderId: formData.get('orderId'),
    customerName: formData.get('customerName'),
    deliveryDate: formData.get('deliveryDate'),
    deliveryAddress: formData.get('deliveryAddress'),
    courierName: formData.get('courierName'),
    driverName: formData.get('driverName'),
    status: formData.get('status'),
    items,
    notes: formData.get('notes')
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`/api/delivery/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      // Otomatis ubah status order terkait ke Delivered jika status surat jalan Delivered / Received
      if (payload.orderId && payload.status === 'Delivered / Received') {
        const targetOrder = (state.orders || []).find(o => o.id === payload.orderId);
        if (targetOrder && targetOrder.status !== 'Delivered') {
          targetOrder.status = 'Delivered';
          fetch(`/api/orders/${targetOrder.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(targetOrder)
          }).catch(e => console.warn('Sync order status to Delivered error:', e));
        }
      }

      closeModal('form-modal');
      showToast(`Surat Jalan berhasil ${editId ? 'diperbarui' : 'diterbitkan'}!`, 'success');
      await fetchResource('delivery');
      renderDeliveryTable();
      updateSidebarBadges();
    } else {
      showToast('Gagal menyimpan surat jalan', 'error');
    }
  } catch (err) {
    console.error('Error saving delivery:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

function viewDeliveryDetail(doId) {
  const doItem = state.delivery.find(d => d.id === doId);
  if (!doItem) return;

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
          <h2 style="font-size: 20px; font-weight: 800; color: #1e293b;">SURAT JALAN PENGIRIMAN</h2>
          <div class="font-mono font-bold text-primary">${doItem.id}</div>
          <div class="font-sm text-muted">Tanggal: ${doItem.deliveryDate}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding: 14px; background: #f8fafc; border-radius: 6px;">
        <div>
          <div class="font-sm font-bold text-muted">TUJUAN PENGIRIMAN (PENERIMA):</div>
          <div class="font-bold text-main" style="font-size: 15px;">${doItem.customerName}</div>
          <div class="font-sm text-muted">${doItem.deliveryAddress || '-'}</div>
          ${doItem.orderId ? `<div class="font-sm mt-1">Ref SO: <span class="mono-id font-bold">${doItem.orderId}</span></div>` : ''}
        </div>
        <div class="text-right">
          <div class="font-sm font-bold text-muted">INFORMASI EKSPEDISI / ARMADA:</div>
          <div>Armada: <strong>${doItem.courierName || 'Armada Internal UBM'}</strong></div>
          <div>Supir/Kurir: <strong>${doItem.driverName || '-'}</strong></div>
          <div class="mt-1">Status: <span class="badge badge-info">${doItem.status}</span></div>
        </div>
      </div>

      <table class="doc-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Barang / Deskripsi</th>
            <th class="text-center">Kuantitas</th>
            <th class="text-center">Satuan</th>
            <th>Keterangan / Serial Number</th>
          </tr>
        </thead>
        <tbody>
          ${(doItem.items || []).map((it, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td class="font-bold">${it.itemName}</td>
              <td class="text-center font-bold">${it.qty}</td>
              <td class="text-center">${it.unit || 'Unit'}</td>
              <td class="font-mono font-sm text-muted">${it.serialNumbers || 'Kondisi Baik & Lengkap'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${doItem.notes ? `<div class="mt-4 p-3 bg-light rounded font-sm"><strong>Instruksi Pengiriman:</strong> ${doItem.notes}</div>` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 50px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center;">
        <div>
          <div class="font-sm text-muted">Pengirim (Gudang/Logistik),</div>
          <div style="margin-top: 50px; font-weight: bold;">( Bagian Logistik UBM )</div>
        </div>
        <div>
          <div class="font-sm text-muted">Sopir / Kurir Pembawa,</div>
          <div style="margin-top: 50px; font-weight: bold;">( ${doItem.driverName || 'Driver Ekspedisi'} )</div>
        </div>
        <div>
          <div class="font-sm text-muted">Tanda Tangan Penerima,</div>
          <div style="margin-top: 50px; font-weight: bold;">( ..................................... )</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
}

function editDelivery(doId) {
  const doItem = state.delivery.find(d => d.id === doId);
  if (doItem) openDeliveryModal(doItem);
}
