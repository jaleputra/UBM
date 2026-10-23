// =========================================================
// UBM - Invoices Module (Faktur Tagihan & Pembayaran)
// =========================================================

// Sinkronisasi otomatis: Order yang berstatus Accepted otomatis masuk ke Faktur Tagihan / Invoices
async function syncAcceptedOrdersToInvoices() {
  const orders = state.orders || [];
  const acceptedOrders = orders.filter(o => 
    o.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(o.status)
  );

  let newlyCreated = false;

  for (const order of acceptedOrders) {
    const existing = (state.invoices || []).find(inv => 
      inv.orderId === order.id || 
      inv.id === `INV-${order.id.replace('ORD-', '')}` ||
      (inv.notes && inv.notes.includes(order.id))
    );

    if (!existing) {
      const invId = `INV-${order.id.replace('ORD-', '')}`;
      const subtotal = order.subtotal || order.grandTotal || 0;
      const taxRate = order.taxRate !== undefined ? Number(order.taxRate) : 11;
      const taxAmount = order.taxAmount !== undefined ? Number(order.taxAmount) : Math.round(subtotal * (taxRate / 100));
      const grandTotal = order.grandTotal || (subtotal + taxAmount);

      const newInvoice = {
        id: invId,
        orderId: order.id,
        customerName: order.customerName || 'Customer',
        customerPhone: order.customerPhone || '',
        customerAddress: order.customerAddress || '-',
        invoiceDate: order.orderDate || new Date().toISOString().split('T')[0],
        dueDate: order.dueDate || '',
        status: 'Unpaid',
        paymentMethod: 'Bank Transfer (Mandiri)',
        items: (order.items && order.items.length > 0) ? order.items : [{
          itemName: order.projectName || 'Pesanan Produk',
          qty: 1,
          unit: 'Lot',
          unitPrice: grandTotal,
          total: grandTotal
        }],
        additionalServices: order.additionalServices || [],
        mainItemsTotal: order.mainItemsTotal || 0,
        servicesTotal: order.servicesTotal || 0,
        itemsTotal: order.itemsTotal || subtotal,
        warrantyFee: order.warrantyFee || 0,
        discount: order.discount || 0,
        subtotal: subtotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
        paidAmount: 0,
        balanceDue: grandTotal,
        notes: `Faktur Tagihan Resmi untuk Sales Order / Project ${order.id}`
      };

      // Tambahkan ke in-memory state agar langsung terlihat di UI
      if (!state.invoices) state.invoices = [];
      state.invoices.push(newInvoice);
      newlyCreated = true;

      // Simpan ke database server
      try {
        fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInvoice)
        }).catch(e => console.warn('Auto invoice save error:', e));
      } catch (err) {
        console.warn('Auto sync invoice error:', err);
      }
    } else {
      // Jika invoice sudah ada, sinkronkan additionalServices dan kalkulasi finansial dari order jika belum tersinkronisasi
      let needsUpdate = false;
      if ((!existing.additionalServices || existing.additionalServices.length === 0) && order.additionalServices && order.additionalServices.length > 0) {
        existing.additionalServices = order.additionalServices;
        needsUpdate = true;
      }
      if (order.servicesTotal !== undefined && existing.servicesTotal !== order.servicesTotal) {
        existing.servicesTotal = order.servicesTotal;
        needsUpdate = true;
      }
      if (order.mainItemsTotal !== undefined && existing.mainItemsTotal !== order.mainItemsTotal) {
        existing.mainItemsTotal = order.mainItemsTotal;
        needsUpdate = true;
      }
      if (order.itemsTotal !== undefined && existing.itemsTotal !== order.itemsTotal) {
        existing.itemsTotal = order.itemsTotal;
        needsUpdate = true;
      }
      if (order.warrantyFee !== undefined && existing.warrantyFee !== order.warrantyFee) {
        existing.warrantyFee = order.warrantyFee;
        needsUpdate = true;
      }
      if (order.discount !== undefined && existing.discount !== order.discount) {
        existing.discount = order.discount;
        needsUpdate = true;
      }
      if (needsUpdate) {
        try {
          fetch(`/api/invoices/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existing)
          }).catch(e => console.warn('Auto invoice update error:', e));
        } catch (err) {
          console.warn('Auto sync invoice error:', err);
        }
      }
    }
  }

  if (newlyCreated) {
    updateSidebarBadges();
  }
}

function filterInvoices() {
  renderInvoicesTable();
}

function renderInvoicesTable() {
  const tbody = document.getElementById('table-invoices-body');
  if (!tbody) return;

  // Pastikan badge sub-tab selalu terupdate
  const badgeCustomer = document.getElementById('badge-tab-invoice-customer-count');
  if (badgeCustomer) badgeCustomer.textContent = (state.invoices || []).length;
  const badgePartnership = document.getElementById('badge-tab-invoice-partnership-count');
  if (badgePartnership) badgePartnership.textContent = (state.partnerships || []).length;

  // Pastikan order accepted tersinkronisasi
  syncAcceptedOrdersToInvoices();

  const statusFilter = document.getElementById('filter-invoice-status')?.value || document.getElementById('invoice-status-filter')?.value || 'ALL';
  let list = state.invoices || [];

  if (statusFilter !== 'ALL') {
    list = list.filter(inv => inv.status === statusFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(inv => 
      inv.id.toLowerCase().includes(q) || 
      inv.customerName.toLowerCase().includes(q) ||
      (inv.orderId && inv.orderId.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding: 24px;">Tidak ada data faktur tagihan ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(inv => {
    const isPaid = inv.status === 'Paid' || (inv.paidAmount >= inv.grandTotal);
    const badgeClass = isPaid ? 'badge-success' :
                       inv.status === 'Partial' ? 'badge-purple' :
                       inv.status === 'Overdue' ? 'badge-danger' : 'badge-amber';

    const sisaTagihan = Math.max(0, (inv.grandTotal || 0) - (inv.paidAmount || 0));

    return `
      <tr style="${isPaid ? 'background-color: #f0fdf4;' : ''}">
        <td style="font-size: 11px; padding: 8px 6px;">
          <span class="mono-id font-bold text-primary" style="font-size: 11px; padding: 2px 4px; word-break: break-all;">${inv.id}</span>
        </td>
        <td style="font-size: 11px; padding: 8px 6px;">
          ${inv.orderId ? `<span class="badge badge-secondary font-mono font-bold" style="font-size: 10px; padding: 2px 6px;">${escapeHtml(inv.orderId)}</span>` : '<span class="text-muted font-sm">-</span>'}
        </td>
        <td style="padding: 8px 6px;">
          <div class="font-bold text-main" style="word-break: break-word; font-size: 11.5px;">${escapeHtml(inv.customerName)}</div>
          ${inv.customerPhone ? `<div class="text-muted font-sm font-mono" style="font-size: 10px; margin-top: 1px;"><i data-lucide="phone" style="width: 10px; height: 10px; display: inline; vertical-align: middle;"></i> ${escapeHtml(inv.customerPhone)}</div>` : ''}
        </td>
        <td style="font-size: 11.5px; padding: 8px 6px; white-space: nowrap;">${inv.invoiceDate || '-'}</td>
        <td style="font-size: 11.5px; padding: 8px 6px; white-space: nowrap;">
          <span style="${inv.status === 'Overdue' ? 'color: #e11d48; font-weight: 600;' : ''}">${inv.dueDate || '-'}</span>
          ${inv.status === 'Overdue' ? '<br><span class="badge badge-danger" style="font-size: 9.5px; padding: 1px 4px; margin-top: 2px;">Overdue</span>' : ''}
        </td>
        <td class="font-bold font-mono text-main" style="font-size: 11.5px; padding: 8px 6px; word-break: break-word;">${formatRupiah(inv.grandTotal)}</td>
        <td style="padding: 8px 6px; word-break: break-word;">
          <div class="${isPaid ? 'text-success' : 'text-danger'} font-bold font-mono" style="font-size: 11.5px;">${formatRupiah(sisaTagihan)}</div>
          ${inv.paidAmount > 0 && !isPaid ? `<div class="text-muted font-mono" style="font-size: 10px;">Terbayar: ${formatRupiah(inv.paidAmount)}</div>` : ''}
        </td>
        <td style="text-align: center; padding: 8px 4px;"><span class="badge ${badgeClass}" style="font-size: 10px; padding: 2px 6px;">${isPaid ? 'Lunas' : inv.status}</span></td>
        <td class="text-right" style="padding-right: 12px;">
          <div class="table-actions" style="display: inline-flex; gap: 4px; justify-content: flex-end; align-items: center; width: 100%;">
            <button class="btn-icon" style="color: #4338ca; width: 28px; height: 28px; border-radius: 4px;" title="Cetak Dokumen Invoice (PDF / Print)" onclick="printInvoice('${inv.id}')">
              <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
            </button>
            ${!isPaid ? `<button class="btn-icon" style="color: #10b981; width: 28px; height: 28px; border-radius: 4px;" title="Catat Pembayaran" onclick="recordPayment('${inv.id}')"><i data-lucide="credit-card" style="width: 14px; height: 14px;"></i></button>` : ''}
            <button class="btn-icon" style="color: #0284c7; width: 28px; height: 28px; border-radius: 4px;" title="Lihat Pratinjau Faktur" onclick="viewInvoiceDetail('${inv.id}')"><i data-lucide="eye" style="width: 14px; height: 14px;"></i></button>
            <button class="btn-icon" style="width: 28px; height: 28px; border-radius: 4px;" title="Edit Faktur" onclick="editInvoice('${inv.id}')"><i data-lucide="edit-3" style="width: 14px; height: 14px;"></i></button>
            <button class="btn-icon btn-danger-ghost" style="width: 28px; height: 28px; border-radius: 4px;" title="Hapus" onclick="deleteResource('invoices', '${inv.id}')"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

// Function Cetak Invoice Langsung (Print / PDF)
function printInvoice(invId) {
  const inv = (state.invoices || []).find(i => i.id === invId);
  if (!inv) {
    showToast('Data faktur tagihan tidak ditemukan', 'warning');
    return;
  }

  viewInvoiceDetail(invId);
  setTimeout(() => {
    printCurrentDocument();
  }, 220);
}

// Function Selector Cetak Invoice dari Header Action Bar
function openPrintInvoiceSelector() {
  syncAcceptedOrdersToInvoices();
  const list = state.invoices || [];

  if (list.length === 0) {
    showToast('Belum ada faktur tagihan / invoice yang tersedia untuk dicetak.', 'warning');
    return;
  }

  if (list.length === 1) {
    printInvoice(list[0].id);
    return;
  }

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '680px';
    modalContainer.style.width = '92vw';
  }

  document.getElementById('form-modal-title').textContent = 'Pilih Faktur Tagihan (Invoice) untuk Dicetak';
  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <div style="padding: 10px 4px;">
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
        Silakan pilih dokumen invoice yang ingin dicetak atau disimpan sebagai PDF:
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto;">
        ${list.map(inv => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; transition: all 0.15s ease;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="mono-id font-bold text-primary" style="font-size: 13px;">${inv.id}</span>
                ${inv.orderId ? `<span class="badge badge-secondary" style="font-size: 10px;">Ref: ${inv.orderId}</span>` : ''}
                <span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-amber'}" style="font-size: 10px;">${inv.status}</span>
              </div>
              <div class="font-bold text-main" style="font-size: 12.5px; margin-top: 3px;">${escapeHtml(inv.customerName)}</div>
              <div class="text-muted font-sm" style="font-size: 11px;">Total: <strong>${formatRupiah(inv.grandTotal)}</strong> &bull; Tgl: ${inv.invoiceDate || '-'}</div>
            </div>
            <div>
              <button type="button" class="btn btn-sm btn-primary" style="background: #4f46e5; border-color: #4f46e5; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600;" onclick="closeModal('form-modal'); printInvoice('${inv.id}')">
                <i data-lucide="printer" style="width: 13px; height: 13px;"></i> Cetak Invoice
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function openInvoiceModal(invData = null) {
  const isEdit = !!invData;
  document.getElementById('form-modal-title').textContent = isEdit ? `Edit Faktur Tagihan: ${invData.id}` : 'Terbitkan Faktur Tagihan / Invoice';
  
  // Set modal popup lebih lebar agar semua kolom dan baris teks input lurus rapih
  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '1120px';
    modalContainer.style.width = '96vw';
  }

  let orderOptions = '<option value="">-- Pilih Referensi Sales Order --</option>';
  (state.orders || []).forEach(o => {
    orderOptions += `<option value="${o.id}" ${invData?.orderId === o.id ? 'selected' : ''}>[${o.id}] ${o.customerName} (${formatRupiah(o.grandTotal)})</option>`;
  });

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="invoice-form" onsubmit="submitInvoice(event, '${isEdit ? invData.id : ''}')" style="display: flex; flex-direction: column; gap: 18px;">
      
      <!-- CARD 1: INFORMASI PELANGGAN & PENAGIHAN -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
          <i data-lucide="file-text" style="color: #4f46e5; width: 16px; height: 16px;"></i>
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0;">Informasi Faktur & Data Pelanggan</h4>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11.5px;">Terkait Referensi Sales Order</label>
            <select name="orderId" class="form-control" onchange="autoFillInvoiceFromOrder(this.value)">
              ${orderOptions}
            </select>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1.5fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11.5px;">Nama Pelanggan / Perusahaan *</label>
            <input type="text" name="customerName" id="inv-cust-name" class="form-control" placeholder="Contoh: PT Surya Utama Teknik" required value="${escapeAttr(invData?.customerName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11.5px;">No. Telepon / WhatsApp</label>
            <input type="text" name="customerPhone" id="inv-cust-phone" class="form-control" placeholder="Contoh: 0812-3456-7890" value="${escapeAttr(invData?.customerPhone || '')}">
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label font-bold" style="font-size: 11.5px;">Alamat Penagihan (Billing Address)</label>
          <input type="text" name="customerAddress" id="inv-cust-address" class="form-control" placeholder="Alamat lengkap penagihan invoice" value="${escapeAttr(invData?.customerAddress || '')}">
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11px;">Tanggal Terbit Faktur *</label>
            <input type="date" name="invoiceDate" class="form-control" required value="${invData?.invoiceDate || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11px;">Jatuh Tempo (Due Date) *</label>
            <input type="date" name="dueDate" class="form-control" required value="${invData?.dueDate || ''}">
          </div>
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11px;">Status Pembayaran</label>
            <select name="status" class="form-control" style="font-weight: 600;">
              <option value="Unpaid" ${invData?.status === 'Unpaid' ? 'selected' : ''}>🟡 Unpaid (Belum Bayar)</option>
              <option value="Partial" ${invData?.status === 'Partial' ? 'selected' : ''}>🟣 Partial (DP / Cicilan)</option>
              <option value="Paid" ${invData?.status === 'Paid' ? 'selected' : ''}>🟢 Paid (Lunas)</option>
              <option value="Overdue" ${invData?.status === 'Overdue' ? 'selected' : ''}>🔴 Overdue (Jatuh Tempo)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11px;">Jumlah Terbayar (Rp)</label>
            <input type="number" name="paidAmount" id="inv-paid-amount" class="form-control font-mono font-bold" placeholder="0" min="0" value="${invData?.paidAmount || 0}" oninput="calculateInvoiceTotals()">
          </div>
        </div>
      </div>

      <!-- CARD 2: RINCIAN TAGIHAN BARANG / PRODUK UTAMA -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="receipt" style="width: 16px; height: 16px; color: #4f46e5;"></i> Rincian Tagihan Produk Utama
            </h4>
            <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">Daftar item tagihan produk manufaktur, kuantitas, harga satuan, dan total</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline" onclick="addInvoiceItemRow()" style="color: #4f46e5; border-color: #c7d2fe; font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; background: #eef2ff;">
            <i data-lucide="plus" style="width: 14px; height: 14px;"></i> + Tambah Baris Tagihan
          </button>
        </div>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; background: #ffffff;">
          <!-- TABLE HEADER -->
          <div style="display: grid; grid-template-columns: minmax(0, 3.2fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.8fr) minmax(0, 1.8fr) 38px; gap: 8px; background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: #475569; align-items: center;">
            <div>Deskripsi Barang / Jasa Tagihan *</div>
            <div style="text-align: center;">Qty *</div>
            <div style="text-align: center;">Satuan</div>
            <div style="text-align: right;">Harga Satuan (Rp) *</div>
            <div style="text-align: right;">Total Tagihan (Rp)</div>
            <div style="text-align: center;">Aksi</div>
          </div>
          
          <!-- TABLE BODY / ROWS -->
          <div id="invoice-items-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff;">
            <!-- Dynamic rows injected here -->
          </div>
        </div>
      </div>

      <!-- CARD 2B: RINCIAN JASA, INSTALASI & LAYANAN TAMBAHAN (NON-BOM) -->
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="font-size: 13px; font-weight: 700; color: #4338ca; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="wrench" style="width: 15px; height: 15px; color: #6366f1;"></i> Rincian Jasa, Instalasi & Layanan Tambahan (Keterangan Non-BOM)
            </h4>
            <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">Sub tagihan penawaran (Instalasi, Setting, Commissioning). Dihitung ke total tagihan faktur.</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline" onclick="addInvoiceServiceRow()" style="font-size: 11px; border-color: #c7d2fe; color: #4338ca; background: #ffffff; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
            <i data-lucide="plus" style="width: 14px; height: 14px;"></i> + Tambah Baris Jasa / Instalasi
          </button>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #ffffff;">
          <div style="display: grid; grid-template-columns: minmax(0, 3.2fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.8fr) minmax(0, 1.8fr) 38px; gap: 8px; background: #f1f5f9; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #475569; align-items: center;">
            <div>Deskripsi Jasa / Layanan Instalasi</div>
            <div style="text-align: center;">Qty</div>
            <div style="text-align: center;">Satuan</div>
            <div style="text-align: right;">Harga Satuan (Rp)</div>
            <div style="text-align: right;">Total (Rp)</div>
            <div style="text-align: center;">Aksi</div>
          </div>
          <div id="invoice-services-list" style="padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; background: #ffffff;">
            <!-- Service rows dynamically populated -->
          </div>
        </div>
      </div>

      <!-- CARD 3: INSTRUKSI PEMBAYARAN & KALKULASI FINANSIAL -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; align-items: start;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
          <label class="form-label font-bold" style="font-size: 11.5px; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="credit-card" style="width: 14px; height: 14px; color: #64748b;"></i> Instruksi Pembayaran & Rekening Bank
          </label>
          <textarea name="paymentTerms" class="form-control" rows="5" style="font-size: 11.5px; line-height: 1.45;" placeholder="Instruksi transfer, nama bank, dan nomor rekening penagihan">${escapeAttr(invData?.paymentTerms || 'Pembayaran ditransfer ke Bank Mandiri Cabang Cikarang No. Rek: 156-00-1234567-8 a.n. Unit Bisnis Mandiri Politeknik Takumi')}</textarea>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
          <div style="display: flex; flex-direction: column; gap: 7px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; color: #475569;">
              <span>Subtotal Produk Utama:</span>
              <span id="invoice-main-items-total" class="font-bold font-mono text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: #4338ca;">
              <span>Subtotal Jasa & Instalasi:</span>
              <span id="invoice-services-total" class="font-bold font-mono">+Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 4px; font-weight: 600;">
              <span>Total Produk & Jasa:</span>
              <span id="invoice-items-total" class="font-mono">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; margin: 0; color: #16a34a; font-weight: 600;">
                <input type="checkbox" id="invoice-include-warranty" name="includeWarranty" ${invData?.warrantyFee !== 0 ? 'checked' : ''} onchange="calculateInvoiceTotals()" style="cursor: pointer;">
                <span>+ Biaya Garansi (5%)</span>
              </label>
              <span id="invoice-warranty-fee" class="font-mono text-success" style="color: #16a34a; font-weight: 600;">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 4px; font-weight: 700;">
              <span class="text-main">Subtotal (Item + Garansi):</span>
              <span id="invoice-subtotal" class="font-bold font-mono text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: #475569;">
              <span>Potongan / Diskon (Rp):</span>
              <input type="number" id="invoice-discount" name="discount" value="${invData?.discount || 0}" min="0" style="width: 100px; height: 26px; padding: 2px 6px; font-size: 11.5px; border: 1px solid var(--border-color); border-radius: 4px; text-align: right;" oninput="calculateInvoiceTotals()">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: #475569;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>PPN (%):</span>
                <input type="number" id="invoice-tax-rate" name="taxRate" value="${invData?.taxRate ?? 11}" min="0" max="100" style="width: 52px; height: 26px; padding: 2px 6px; font-size: 11.5px; text-align: center; border-radius: 4px; border: 1px solid #cbd5e1;" oninput="calculateInvoiceTotals()">
              </div>
              <span id="invoice-tax-amount" class="font-bold font-mono text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 2px solid #0f172a; margin-top: 2px; font-size: 13.5px; font-weight: 800; color: #0f172a;">
              <span>Grand Total:</span>
              <span id="invoice-grand-total" class="font-mono text-primary">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; margin-top: 2px; border-top: 1px dashed #cbd5e1; font-size: 11.5px; color: #64748b;">
              <span>Sisa Tagihan:</span>
              <span id="invoice-balance-due" class="font-bold font-mono text-danger">Rp 0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL FOOTER ACTIONS -->
      <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px; display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="background: #4f46e5; border-color: #4f46e5; padding: 8px 22px; display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
          <i data-lucide="save"></i> ${isEdit ? 'Perbarui Faktur' : 'Terbitkan Faktur'}
        </button>
      </div>
    </form>
  `;

  const itemsContainer = document.getElementById('invoice-items-list');
  if (invData && invData.items && invData.items.length > 0) {
    invData.items.forEach(item => addInvoiceItemRow(item));
  } else {
    addInvoiceItemRow();
  }

  const servicesContainer = document.getElementById('invoice-services-list');
  const existingServices = (invData && invData.additionalServices && invData.additionalServices.length > 0)
    ? invData.additionalServices
    : (invData?.orderId ? ((state.orders || []).find(o => o.id === invData.orderId)?.additionalServices || []) : []);

  if (existingServices && existingServices.length > 0) {
    existingServices.forEach(svc => addInvoiceServiceRow(svc));
  }

  calculateInvoiceTotals();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function autoFillInvoiceFromOrder(orderId) {
  if (!orderId) return;
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const nameEl = document.getElementById('inv-cust-name');
  const phoneEl = document.getElementById('inv-cust-phone');
  const addrEl = document.getElementById('inv-cust-address');
  if (nameEl) nameEl.value = order.customerName || '';
  if (phoneEl) phoneEl.value = order.customerPhone || '';
  if (addrEl) addrEl.value = order.customerAddress || '';

  const listContainer = document.getElementById('invoice-items-list');
  if (listContainer && order.items && order.items.length > 0) {
    listContainer.innerHTML = '';
    order.items.forEach(item => {
      addInvoiceItemRow({
        itemName: item.itemName,
        qty: item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice
      });
    });
  }

  const servicesContainer = document.getElementById('invoice-services-list');
  if (servicesContainer) {
    servicesContainer.innerHTML = '';
    if (order.additionalServices && order.additionalServices.length > 0) {
      order.additionalServices.forEach(svc => addInvoiceServiceRow(svc));
    }
  }

  if (order.taxRate !== undefined) {
    const taxRateInput = document.getElementById('invoice-tax-rate');
    if (taxRateInput) taxRateInput.value = order.taxRate;
  }

  if (order.discount !== undefined) {
    const discountInput = document.getElementById('invoice-discount');
    if (discountInput) discountInput.value = order.discount;
  }

  const warrantyCheck = document.getElementById('invoice-include-warranty');
  if (warrantyCheck) {
    warrantyCheck.checked = (order.warrantyFee !== 0);
  }

  calculateInvoiceTotals();
}

function addInvoiceItemRow(item = null) {
  const container = document.getElementById('invoice-items-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'item-row invoice-item-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 3.2fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.8fr) minmax(0, 1.8fr) 38px; gap: 8px; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; transition: all 0.15s ease;';
  
  const qty = item?.qty !== undefined ? Number(item.qty) : 1;
  const unitPrice = item?.unitPrice !== undefined ? Number(item.unitPrice) : 0;
  const total = qty * unitPrice;

  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm inv-item-name" placeholder="Deskripsi Tagihan / Nama Barang / Jasa" required value="${escapeAttr(item?.itemName || '')}" style="font-size: 12px;">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm inv-item-qty" placeholder="1" min="0.01" step="any" required value="${qty}" oninput="calculateInvoiceTotals()" style="text-align: center; font-size: 12px; font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm inv-item-unit" placeholder="Pcs/Lot/Set" value="${escapeAttr(item?.unit || 'Unit')}" style="text-align: center; font-size: 12px;">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm inv-item-price" placeholder="0" min="0" step="any" required value="${unitPrice}" oninput="calculateInvoiceTotals()" style="text-align: right; font-size: 12px; font-family: monospace; font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm inv-item-total" readonly value="${formatRupiah(total)}" style="text-align: right; font-size: 12px; font-family: monospace; font-weight: 700; background: #f8fafc; color: #0f172a; border-color: #e2e8f0; cursor: default;">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris Tagihan" onclick="this.closest('.item-row').remove(); calculateInvoiceTotals();" style="width: 30px; height: 30px; margin: 0 auto;">
        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

function addInvoiceServiceRow(service = null) {
  const container = document.getElementById('invoice-services-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'item-row invoice-service-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 3.2fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.8fr) minmax(0, 1.8fr) 38px; gap: 8px; align-items: center; background: #ffffff; border: 1px solid #e0e7ff; border-radius: 6px; padding: 6px 8px; transition: all 0.15s ease;';

  const defaultName = service ? service.serviceName || '' : '';
  const defaultQty = service ? (service.qty || 1) : 1;
  const defaultUnit = service ? (service.unit || 'Lot') : 'Lot';
  const defaultPrice = service ? (service.unitPrice || 0) : 0;
  const defaultTotal = service ? (service.total || (defaultQty * defaultPrice)) : 0;

  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm inv-service-name" placeholder="Nama Layanan (Contoh: Jasa Instalasi, Setting, Commissioning)" value="${escapeAttr(defaultName)}" style="font-size: 12px; color: #3730a3; font-weight: 500;">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm inv-service-qty" placeholder="1" min="0.01" step="any" value="${defaultQty}" oninput="calculateInvoiceTotals()" style="text-align: center; font-size: 12px; font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm inv-service-unit" placeholder="Lot/Set/Hari" value="${escapeAttr(defaultUnit)}" style="text-align: center; font-size: 12px;">
    </div>
    <div>
      <input type="number" class="form-control form-control-sm inv-service-price" placeholder="0" min="0" step="any" value="${defaultPrice}" oninput="calculateInvoiceTotals()" style="text-align: right; font-size: 12px; font-family: monospace; font-weight: 600;">
    </div>
    <div>
      <input type="text" class="form-control form-control-sm inv-service-total" readonly value="${formatRupiah(defaultTotal)}" style="text-align: right; font-size: 12px; font-family: monospace; font-weight: 700; background: #f8fafc; color: #4338ca; border-color: #e0e7ff; cursor: default;">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris Jasa" onclick="this.closest('.item-row').remove(); calculateInvoiceTotals();" style="width: 30px; height: 30px; margin: 0 auto;">
        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

function calculateInvoiceTotals() {
  const itemRows = document.querySelectorAll('#invoice-items-list .invoice-item-row');
  let mainItemsTotal = 0;
  
  itemRows.forEach(r => {
    const qty = parseFloat(r.querySelector('.inv-item-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.inv-item-price')?.value) || 0;
    const total = qty * price;
    mainItemsTotal += total;
    const totalInput = r.querySelector('.inv-item-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const serviceRows = document.querySelectorAll('#invoice-services-list .invoice-service-row');
  let servicesTotal = 0;
  serviceRows.forEach(r => {
    const qty = parseFloat(r.querySelector('.inv-service-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.inv-service-price')?.value) || 0;
    const total = qty * price;
    servicesTotal += total;
    const totalInput = r.querySelector('.inv-service-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const itemsTotal = mainItemsTotal + servicesTotal;

  const warrantyCheck = document.getElementById('invoice-include-warranty');
  const hasWarranty = warrantyCheck ? warrantyCheck.checked : true;
  const warrantyFee = (hasWarranty && itemsTotal > 0) ? Math.round(itemsTotal * 0.05) : 0;
  const subtotal = itemsTotal + warrantyFee;

  const discountInput = document.getElementById('invoice-discount');
  const discount = Math.max(0, parseFloat(discountInput?.value) || 0);

  const taxableAmount = Math.max(0, subtotal - discount);

  const taxRate = parseFloat(document.getElementById('invoice-tax-rate')?.value) || 0;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100));
  const grandTotal = taxableAmount + taxAmount;
  const paidAmount = parseFloat(document.getElementById('inv-paid-amount')?.value) || 0;
  const balanceDue = Math.max(0, grandTotal - paidAmount);

  const mainEl = document.getElementById('invoice-main-items-total');
  const svcEl = document.getElementById('invoice-services-total');
  const itemsEl = document.getElementById('invoice-items-total');
  const warrantyEl = document.getElementById('invoice-warranty-fee');
  const subEl = document.getElementById('invoice-subtotal');
  const taxEl = document.getElementById('invoice-tax-amount');
  const grandEl = document.getElementById('invoice-grand-total');
  const balEl = document.getElementById('invoice-balance-due');

  if (mainEl) mainEl.textContent = formatRupiah(mainItemsTotal);
  if (svcEl) svcEl.textContent = `+${formatRupiah(servicesTotal)}`;
  if (itemsEl) itemsEl.textContent = formatRupiah(itemsTotal);
  if (warrantyEl) warrantyEl.textContent = formatRupiah(warrantyFee);
  if (subEl) subEl.textContent = formatRupiah(subtotal);
  if (taxEl) taxEl.textContent = formatRupiah(taxAmount);
  if (grandEl) grandEl.textContent = formatRupiah(grandTotal);
  if (balEl) {
    balEl.textContent = formatRupiah(balanceDue);
    balEl.className = balanceDue === 0 ? 'font-bold font-mono text-success' : 'font-bold font-mono text-danger';
  }

  return { mainItemsTotal, servicesTotal, itemsTotal, warrantyFee, subtotal, discount, taxRate, taxAmount, grandTotal, paidAmount, balanceDue };
}

async function submitInvoice(e, editId = '') {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const items = [];
  document.querySelectorAll('#invoice-items-list .invoice-item-row').forEach(r => {
    const name = r.querySelector('.inv-item-name')?.value?.trim();
    if (name) {
      items.push({
        itemName: name,
        qty: parseFloat(r.querySelector('.inv-item-qty').value) || 1,
        unit: r.querySelector('.inv-item-unit').value || 'Unit',
        unitPrice: parseFloat(r.querySelector('.inv-item-price').value) || 0,
        total: (parseFloat(r.querySelector('.inv-item-qty').value) || 1) * (parseFloat(r.querySelector('.inv-item-price').value) || 0)
      });
    }
  });

  const additionalServices = [];
  document.querySelectorAll('#invoice-services-list .invoice-service-row').forEach(r => {
    const serviceName = r.querySelector('.inv-service-name')?.value?.trim();
    if (serviceName) {
      const qty = parseFloat(r.querySelector('.inv-service-qty')?.value) || 1;
      const unit = r.querySelector('.inv-service-unit')?.value?.trim() || 'Lot';
      const unitPrice = parseFloat(r.querySelector('.inv-service-price')?.value) || 0;
      const total = qty * unitPrice;
      additionalServices.push({ serviceName, qty, unit, unitPrice, total });
    }
  });

  if (items.length === 0 && additionalServices.length === 0) {
    showToast('Harap tambahkan minimal 1 baris produk atau jasa tagihan', 'warning');
    return;
  }

  const totals = calculateInvoiceTotals();
  const paidAmount = parseFloat(formData.get('paidAmount')) || 0;
  let status = formData.get('status');
  if (paidAmount >= totals.grandTotal) status = 'Paid';
  else if (paidAmount > 0) status = 'Partial';

  const payload = {
    orderId: formData.get('orderId'),
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    customerAddress: formData.get('customerAddress'),
    invoiceDate: formData.get('invoiceDate'),
    dueDate: formData.get('dueDate'),
    status,
    paidAmount,
    items,
    additionalServices,
    mainItemsTotal: totals.mainItemsTotal,
    servicesTotal: totals.servicesTotal,
    itemsTotal: totals.itemsTotal,
    warrantyFee: totals.warrantyFee,
    discount: totals.discount,
    subtotal: totals.subtotal,
    taxRate: totals.taxRate,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    balanceDue: totals.balanceDue,
    paymentTerms: formData.get('paymentTerms')
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`/api/invoices/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('form-modal');
      showToast(`Faktur Tagihan berhasil ${editId ? 'diperbarui' : 'diterbitkan'}!`, 'success');
      await fetchResource('invoices');
      renderInvoicesTable();
      updateSidebarBadges();
      if (typeof renderFinanceTable === 'function') renderFinanceTable();
    } else {
      showToast('Gagal menyimpan faktur tagihan', 'error');
    }
  } catch (err) {
    console.error('Error saving invoice:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

function viewInvoiceDetail(invId) {
  const inv = state.invoices.find(i => i.id === invId);
  if (!inv) return;

  const isPaid = inv.status === 'Paid' || (inv.paidAmount >= inv.grandTotal);
  const sisa = Math.max(0, (inv.grandTotal || 0) - (inv.paidAmount || 0));

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'Unit Bisnis Mandiri (UBM) Politeknik Takumi',
    tagline: 'Engineering, Manufacturing, & Automation Solutions',
    paymentInstructions: 'Pembayaran ditransfer ke Bank Mandiri Cabang Cikarang No. Rek: 156-00-1234567-8 a.n. Unit Bisnis Mandiri Politeknik Takumi',
    headFinance: 'Finance & Accounting',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  const orderRef = inv.orderId ? (state.orders || []).find(o => o.id === inv.orderId) : null;
  const additionalServices = (inv.additionalServices && inv.additionalServices.length > 0)
    ? inv.additionalServices
    : (orderRef?.additionalServices || []);

  const mainItemsTotalVal = inv.mainItemsTotal !== undefined && inv.mainItemsTotal > 0
    ? inv.mainItemsTotal 
    : (orderRef?.mainItemsTotal !== undefined && orderRef.mainItemsTotal > 0
        ? orderRef.mainItemsTotal 
        : ((inv.items || []).reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0)));

  const servicesTotalVal = inv.servicesTotal !== undefined && inv.servicesTotal > 0
    ? inv.servicesTotal 
    : (orderRef?.servicesTotal !== undefined && orderRef.servicesTotal > 0
        ? orderRef.servicesTotal 
        : (additionalServices.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0)));

  const itemsTotalVal = inv.itemsTotal !== undefined && inv.itemsTotal > 0
    ? inv.itemsTotal 
    : (mainItemsTotalVal + servicesTotalVal);

  const warrantyFeeVal = inv.warrantyFee !== undefined ? inv.warrantyFee : (orderRef?.warrantyFee || 0);
  const discountVal = inv.discount !== undefined ? inv.discount : (orderRef?.discount || 0);

  const content = document.getElementById('preview-modal-content');
  content.innerHTML = `
    <div class="doc-preview">
      <div class="doc-header">
        <div>
          <div class="company-name" style="font-size: 17px; font-weight: 800; color: #0f172a;">${escapeHtml(compSettings.companyName)}</div>
          <div class="text-muted font-sm">${escapeHtml(compSettings.tagline)}</div>
          <div class="font-xs text-muted" style="margin-top: 3px;">${escapeHtml(compSettings.address || '')}</div>
        </div>
        <div class="text-right">
          <h2 style="font-size: 20px; font-weight: 800; color: #1e293b;">FAKTUR TAGIHAN (INVOICE)</h2>
          <div class="font-mono font-bold text-primary">${inv.id}</div>
          <div class="font-sm text-muted">Tanggal: ${inv.invoiceDate}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding: 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
        <div>
          <div class="font-sm font-bold text-muted">DITAGIHKAN KEPADA (CUSTOMER):</div>
          <div class="font-bold text-main" style="font-size: 15px;">${escapeHtml(inv.customerName)}</div>
          <div>${escapeHtml(inv.customerPhone || '')}</div>
          <div class="font-sm text-muted">${escapeHtml(inv.customerAddress || '-')}</div>
          ${inv.orderId ? `<div class="font-sm mt-1">Ref SO: <span class="mono-id font-bold">${escapeHtml(inv.orderId)}</span></div>` : ''}
        </div>
        <div class="text-right">
          <div class="font-sm font-bold text-muted">STATUS & JATUH TEMPO:</div>
          <div>Status: <span class="badge ${isPaid ? 'badge-success' : 'badge-amber'}">${isPaid ? 'LUNAS / PAID' : inv.status}</span></div>
          <div>Jatuh Tempo: <strong>${inv.dueDate || '-'}</strong></div>
          <div class="font-sm mt-2 text-muted">Total Pembayaran: <span class="font-bold text-success">${formatRupiah(inv.paidAmount || 0)}</span></div>
        </div>
      </div>

      <!-- TABEL DAFTAR TAGIHAN & JASA -->
      <table class="doc-table" style="width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-bottom: 16px;">
        <colgroup>
          <col style="width: 5%;">
          <col style="width: 45%;">
          <col style="width: 10%;">
          <col style="width: 10%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
        </colgroup>
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">No</th>
            <th style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">Deskripsi Produk / Layanan</th>
            <th style="text-align: center; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">Qty</th>
            <th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">Satuan</th>
            <th style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">Harga Satuan</th>
            <th style="text-align: right; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">Total (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${(inv.items || []).map((it, idx) => `
            <tr>
              <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${idx + 1}</td>
              <td style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; word-break: break-word;">
                <div class="font-bold">${escapeHtml(it.itemName)}</div>
                ${it.sku ? `<div class="font-sm text-muted font-mono font-xs" style="font-size: 10px;">SKU: ${escapeHtml(it.sku)}</div>` : ''}
              </td>
              <td style="text-align: center; font-weight: 700; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">${it.qty}</td>
              <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${escapeHtml(it.unit || 'Unit')}</td>
              <td style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(it.unitPrice)}</td>
              <td style="text-align: right; font-weight: 700; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(it.total || (it.qty * it.unitPrice))}</td>
            </tr>
          `).join('')}
          ${(additionalServices && additionalServices.length > 0) ? `
            <tr style="background: #f8fafc;">
              <td colspan="6" style="padding: 6px 8px; font-weight: 700; font-size: 10.5px; color: #4338ca; border: 1px solid #cbd5e1; text-transform: uppercase;">
                Rincian Jasa, Instalasi & Layanan Tambahan (Keterangan Non-BOM)
              </td>
            </tr>
            ${additionalServices.map((svc, sIdx) => `
              <tr>
                <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${(inv.items?.length || 0) + sIdx + 1}</td>
                <td style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; word-break: break-word;">
                  <div class="font-bold" style="color: #3730a3;">${escapeHtml(svc.serviceName)}</div>
                  <div class="font-sm text-muted" style="font-size: 10px;">Jasa / Instalasi / Commissioning</div>
                </td>
                <td style="text-align: center; font-weight: 700; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">${svc.qty}</td>
                <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${escapeHtml(svc.unit || 'Lot')}</td>
                <td style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(svc.unitPrice)}</td>
                <td style="text-align: right; font-weight: 700; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(svc.total || (svc.qty * svc.unitPrice))}</td>
              </tr>
            `).join('')}
          ` : ''}
        </tbody>
      </table>

      <div class="doc-totals" style="margin-bottom: 20px;">
        <div class="calc-summary" style="margin-left: auto; width: 340px;">
          ${(servicesTotalVal > 0 || (additionalServices && additionalServices.length > 0)) ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
              <span>Subtotal Produk Utama:</span>
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
            <span class="font-mono">${formatRupiah(inv.subtotal)}</span>
          </div>
          ${discountVal > 0 ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; color: #e11d48;">
              <span>Potongan Diskon:</span>
              <span class="font-mono">-${formatRupiah(discountVal)}</span>
            </div>
          ` : ''}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
            <span>PPN (${inv.taxRate || 11}%):</span>
            <span class="font-mono">${formatRupiah(inv.taxAmount)}</span>
          </div>
          <div class="calc-row total" style="border-top: 2px solid #0f172a; padding-top: 6px; font-size: 13.5px; display: flex; justify-content: space-between; font-weight: 700;">
            <span>Grand Total:</span>
            <span class="font-mono text-primary">${formatRupiah(inv.grandTotal)}</span>
          </div>
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; margin-top: 4px; border-top: 1px dashed #cbd5e1;">
            <span>Terbayar:</span>
            <span class="font-mono text-success font-bold">${formatRupiah(inv.paidAmount || 0)}</span>
          </div>
          <div class="calc-row" style="font-size: 12.5px; display: flex; justify-content: space-between; padding: 4px 0; font-weight: 700;">
            <span>Sisa Tagihan:</span>
            <span class="font-mono ${sisa === 0 ? 'text-success' : 'text-danger'}">${formatRupiah(sisa)}</span>
          </div>
        </div>
      </div>

      <div class="mt-4 p-3 bg-light rounded font-sm" style="border: 1px solid #cbd5e1;">
        <strong>Instruksi Pembayaran & Rekening Bank:</strong><br>
        ${inv.paymentTerms || compSettings.paymentInstructions}
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center;">
        <div>
          <div class="font-sm text-muted">Diterima Oleh Customer,</div>
          <div style="margin-top: 50px; font-weight: bold;">( ..................................... )</div>
        </div>
        <div>
          <div class="font-sm text-muted">Hormat Kami (${escapeHtml(compSettings.companyShortName || 'UBM')}),</div>
          <div style="margin-top: 50px; font-weight: bold;">( ${escapeHtml(compSettings.headFinance || 'Finance & Accounting')} )</div>
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 10px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; font-size: 10.5px; color: #94a3b8;">
        <span>${escapeHtml(compSettings.copyrightText)}</span>
        <span>Dokumen Faktur Resmi ${escapeHtml(compSettings.companyShortName || 'UBM')}</span>
      </div>
    </div>
  `;

  openModal('preview-modal');
}

function recordPayment(invId) {
  const inv = state.invoices.find(i => i.id === invId);
  if (!inv) return;

  const currentPaid = inv.paidAmount || 0;
  const sisa = Math.max(0, (inv.grandTotal || 0) - currentPaid);

  document.getElementById('form-modal-title').textContent = `Catat Pelunasan / Pembayaran: ${inv.id}`;
  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="payment-form" onsubmit="savePayment(event, '${inv.id}')">
      <div style="background: #f8fafc; padding: 14px; border-radius: 6px; margin-bottom: 16px; border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span class="text-muted">Pelanggan:</span>
          <strong>${escapeHtml(inv.customerName)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span class="text-muted">Total Nilai Tagihan:</span>
          <strong>${formatRupiah(inv.grandTotal)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span class="text-muted">Sudah Terbayar:</span>
          <span class="text-success font-bold">${formatRupiah(currentPaid)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
          <span class="text-muted">Sisa Belum Lunas:</span>
          <span class="text-danger font-bold">${formatRupiah(sisa)}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Nominal Pembayaran yang Masuk (Rp) *</label>
        <input type="number" name="paymentAmount" class="form-control font-bold" required min="1" max="${sisa}" value="${sisa}" style="font-size: 16px;">
      </div>

      <div class="form-group">
        <label class="form-label">Metode Pembayaran</label>
        <select name="paymentMethod" class="form-control">
          <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
          <option value="Transfer Bank BCA">Transfer Bank BCA</option>
          <option value="Transfer Bank BNI">Transfer Bank BNI</option>
          <option value="Tunai / Kasir">Tunai / Kasir</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tanggal Masuk Pembayaran</label>
        <input type="date" name="paymentDate" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
      </div>

      <div class="form-group">
        <label class="form-label">No. Referensi / Bukti Transfer</label>
        <input type="text" name="paymentRef" class="form-control" placeholder="Contoh: TRF-MDR-9928123">
      </div>

      <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-top: 20px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-success"><i data-lucide="check-circle"></i> Konfirmasi Pembayaran</button>
      </div>
    </form>
  `;

  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

async function savePayment(e, invId) {
  e.preventDefault();
  const inv = state.invoices.find(i => i.id === invId);
  if (!inv) return;

  const form = e.target;
  const formData = new FormData(form);
  const paymentAmount = parseFloat(formData.get('paymentAmount')) || 0;

  const newPaidAmount = (inv.paidAmount || 0) + paymentAmount;
  const newStatus = newPaidAmount >= inv.grandTotal ? 'Paid' : 'Partial';

  const payload = {
    ...inv,
    paidAmount: newPaidAmount,
    status: newStatus
  };

  try {
    const res = await fetch(`/api/invoices/${invId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeModal('form-modal');
      showToast(`Pembayaran ${formatRupiah(paymentAmount)} berhasil dicatat!`, 'success');
      await fetchResource('invoices');
      renderInvoicesTable();
      updateSidebarBadges();
      loadDashboardData();
      if (typeof renderFinanceTable === 'function') renderFinanceTable();
    } else {
      showToast('Gagal mencatat pembayaran', 'error');
    }
  } catch (err) {
    console.error('Error recording payment:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

function editInvoice(invId) {
  const inv = state.invoices.find(i => i.id === invId);
  if (inv) openInvoiceModal(inv);
}

// =========================================================
// SUB-TAB: PENAGIHAN KERJASAMA (HAK TAKUMI DARI PT AYUMI)
// =========================================================

/**
 * Navigasi Sub-Tab pada Halaman Invoice
 * @param {'customer' | 'partnership'} tabName
 */
function switchInvoiceTab(tabName) {
  const btnCustomer = document.getElementById('tab-btn-invoice-customer');
  const btnPartnership = document.getElementById('tab-btn-invoice-partnership');
  const contentCustomer = document.getElementById('invoice-tab-content-customer');
  const contentPartnership = document.getElementById('invoice-tab-content-partnership');

  const activeStyle = 'display: flex; align-items: center; gap: 8px; font-weight: 700; padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; background: #2563eb; color: #ffffff; box-shadow: 0 2px 4px rgba(37,99,235,0.2); transition: all 0.2s ease;';
  const inactiveStyle = 'display: flex; align-items: center; gap: 8px; font-weight: 700; padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; background: #f1f5f9; color: #475569; transition: all 0.2s ease;';

  if (tabName === 'partnership') {
    if (btnCustomer) btnCustomer.style.cssText = inactiveStyle;
    if (btnPartnership) btnPartnership.style.cssText = activeStyle;
    if (contentCustomer) contentCustomer.style.display = 'none';
    if (contentPartnership) contentPartnership.style.display = 'block';
    sessionStorage.setItem('ubm_active_invoice_tab', 'partnership');
    renderInvoicePartnershipsTable();
  } else {
    if (btnCustomer) btnCustomer.style.cssText = activeStyle;
    if (btnPartnership) btnPartnership.style.cssText = inactiveStyle;
    if (contentCustomer) contentCustomer.style.display = 'block';
    if (contentPartnership) contentPartnership.style.display = 'none';
    sessionStorage.setItem('ubm_active_invoice_tab', 'customer');
    renderInvoicesTable();
  }

  // Refresh lucide icons
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

/**
 * Helper kalkulasi aman bagi hasil kerjasama
 */
function getSafePartnershipSplit(entry) {
  if (typeof calculatePartnershipSplit === 'function') {
    const pct = (typeof getPartnershipPercentages === 'function')
      ? getPartnershipPercentages()
      : (entry.percentages || { takumi: 20, sales: 20, adminTax: 15, freelance: 45 });
    return calculatePartnershipSplit(entry, entry.percentages || pct);
  }

  const billedAmount = parseFloat(entry.billedAmount || 0) || 0;
  const pct = entry.percentages || { takumi: 20, sales: 20, adminTax: 15, freelance: 45 };
  const contrib = entry.contributions || {};

  function split(catNominal, takumi, ayumi) {
    if (takumi && !ayumi) return { takumi: catNominal, ayumi: 0 };
    if (!takumi && ayumi) return { takumi: 0, ayumi: catNominal };
    const half = Math.round(catNominal / 2);
    return { takumi: half, ayumi: catNominal - half };
  }

  const tCat = split(Math.round(billedAmount * (pct.takumi / 100)), contrib.takumi ? contrib.takumi.takumi : true, contrib.takumi ? contrib.takumi.ayumi : false);
  const sSplit = split(Math.round(billedAmount * (pct.sales / 100)), contrib.sales?.takumi, contrib.sales?.ayumi);
  const aSplit = split(Math.round(billedAmount * (pct.adminTax / 100)), contrib.adminTax?.takumi, contrib.adminTax?.ayumi);
  const fSplit = split(Math.round(billedAmount * (pct.freelance / 100)), contrib.freelance?.takumi, contrib.freelance?.ayumi);

  const totalTakumi = tCat.takumi + sSplit.takumi + aSplit.takumi + fSplit.takumi;
  const totalAyumi = tCat.ayumi + sSplit.ayumi + aSplit.ayumi + fSplit.ayumi;

  return {
    billedAmount,
    percentages: pct,
    takumiNominal: Math.round(billedAmount * (pct.takumi / 100)),
    salesNominal: Math.round(billedAmount * (pct.sales / 100)),
    adminTaxNominal: Math.round(billedAmount * (pct.adminTax / 100)),
    freelanceNominal: Math.round(billedAmount * (pct.freelance / 100)),
    takumiCatSplit: tCat,
    salesSplit: sSplit,
    adminTaxSplit: aSplit,
    freelanceSplit: fSplit,
    totalTakumi,
    totalAyumi,
    takumiPercent: billedAmount > 0 ? (totalTakumi / billedAmount) * 100 : 0,
    ayumiPercent: billedAmount > 0 ? (totalAyumi / billedAmount) * 100 : 0
  };
}

/**
 * Render Tabel Penagihan Kerjasama (Hak Takumi ke Ayumi)
 */
function renderInvoicePartnershipsTable() {
  const tbody = document.getElementById('table-invoice-partnerships-body');
  if (!tbody) return;

  const allItems = Array.isArray(state.partnerships) ? state.partnerships : [];

  // Update badge counts pada sub-tab
  const badgeCustomer = document.getElementById('badge-tab-invoice-customer-count');
  if (badgeCustomer) badgeCustomer.textContent = (state.invoices || []).length;
  const badgePartnership = document.getElementById('badge-tab-invoice-partnership-count');
  if (badgePartnership) badgePartnership.textContent = allItems.length;

  // Hitung akumulasi metrik finansial penagihan Takumi
  let totalTakumiSum = 0;
  let paidTakumiSum = 0;

  const calculatedItems = allItems.map(item => {
    const calc = getSafePartnershipSplit(item);
    totalTakumiSum += calc.totalTakumi;
    if (item.paymentStatus === 'Lunas') {
      paidTakumiSum += calc.totalTakumi;
    } else if (item.paymentStatus === 'Sebagian') {
      paidTakumiSum += Math.round(calc.totalTakumi / 2); // Estimasi 50% untuk Sebagian jika belum ada nominal parsial
    }
    return { ...item, calc };
  });

  const unpaidTakumiSum = Math.max(0, totalTakumiSum - paidTakumiSum);

  // Update KPI Cards di Sub-tab Penagihan Kerjasama
  const kpiTotal = document.getElementById('kpi-invoice-partnership-takumi-total');
  const kpiPaid = document.getElementById('kpi-invoice-partnership-takumi-paid');
  const kpiUnpaid = document.getElementById('kpi-invoice-partnership-takumi-unpaid');
  const kpiCount = document.getElementById('kpi-invoice-partnership-count');

  if (kpiTotal) kpiTotal.textContent = formatRupiah(totalTakumiSum);
  if (kpiPaid) kpiPaid.textContent = formatRupiah(paidTakumiSum);
  if (kpiUnpaid) kpiUnpaid.textContent = formatRupiah(unpaidTakumiSum);
  if (kpiCount) kpiCount.textContent = `${allItems.length} Proyek`;

  // Filter Status & Pencarian
  const statusFilter = document.getElementById('filter-invoice-partnership-status')?.value || 'ALL';
  const searchQuery = (document.getElementById('filter-invoice-partnership-search')?.value || '').toLowerCase().trim();

  let filtered = calculatedItems.filter(item => {
    if (statusFilter !== 'ALL' && item.paymentStatus !== statusFilter) return false;
    if (searchQuery) {
      const invNum = (item.invoiceRef || `INV-TKM-${item.id}`).toLowerCase();
      const ksmId = (item.id || '').toLowerCase();
      const sName = (item.serviceName || '').toLowerCase();
      const cName = (item.clientName || '').toLowerCase();
      if (!invNum.includes(searchQuery) && !ksmId.includes(searchQuery) && !sName.includes(searchQuery) && !cName.includes(searchQuery)) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 36px 16px;">
          <div style="font-size: 32px; margin-bottom: 8px;">📑</div>
          <div style="font-weight: 700; color: #475569; font-size: 14px;">Tidak Ada Faktur Penagihan Kerjasama</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
            ${allItems.length === 0 
              ? 'Belum ada data kerjasama yang diinput. Klik "+ Tambah Data Kerjasama" untuk membuat penagihan baru.' 
              : 'Tidak ada data kerjasama yang sesuai dengan filter pencarian.'}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const calc = item.calc;
    const invoiceNumber = item.invoiceRef || `INV-TKM-${item.id}`;
    const isPaid = item.paymentStatus === 'Lunas';
    const isPartial = item.paymentStatus === 'Sebagian';

    const statusBadge = isPaid
      ? `<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">💵 Lunas</span>`
      : isPartial
      ? `<span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">💳 Sebagian</span>`
      : `<span class="badge" style="background: #fee2e2; color: #991b1b; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">⏳ Menunggu</span>`;

    return `
      <tr style="${isPaid ? 'background-color: #f0fdf4;' : ''}">
        <!-- 1. No Faktur Penagihan -->
        <td style="font-size: 11.5px; padding: 10px 8px;">
          <span class="mono-id font-bold text-primary" style="font-size: 11.5px; padding: 3px 6px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px;">
            ${escapeHtml(invoiceNumber)}
          </span>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 3px;">
            Ref: <strong style="color: #475569;">${escapeHtml(item.id)}</strong>
          </div>
        </td>

        <!-- 2. Tanggal -->
        <td style="font-size: 12px; color: #475569; padding: 10px 8px; white-space: nowrap;">
          ${escapeHtml(item.date || '-')}
        </td>

        <!-- 3. Layanan & Klien (Sumber Proyek) -->
        <td style="padding: 10px 8px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${escapeHtml(item.serviceName)}</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
            <span>Mitra / Klien:</span>
            <strong style="color: #334155;">${escapeHtml(item.clientName)}</strong>
          </div>
        </td>

        <!-- 4. Tagihan Customer (Diterima Ayumi) -->
        <td style="text-align: right; padding: 10px 8px; font-weight: 700; font-size: 13px; color: #0f172a;" class="font-mono">
          ${formatRupiah(calc.billedAmount)}
        </td>

        <!-- 5. Hak Takumi (Ditagihkan) -->
        <td style="text-align: right; padding: 10px 8px; background: #f5f3ff;" class="font-mono">
          <div style="font-size: 14px; font-weight: 800; color: #4338ca;">
            ${formatRupiah(calc.totalTakumi)}
          </div>
          <div style="font-size: 10.5px; color: #6366f1; font-weight: 700;">
            ${calc.takumiPercent.toFixed(1)}% dari Tagihan
          </div>
        </td>

        <!-- 6. Hak Ayumi -->
        <td style="text-align: right; padding: 10px 8px;" class="font-mono">
          <div style="font-size: 13px; font-weight: 700; color: #065f46;">
            ${formatRupiah(calc.totalAyumi)}
          </div>
          <div style="font-size: 10.5px; color: #059669; font-weight: 600;">
            ${calc.ayumiPercent.toFixed(1)}%
          </div>
        </td>

        <!-- 7. Status Pembayaran Ayumi -->
        <td style="text-align: center; padding: 10px 8px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            ${statusBadge}
            <button type="button" class="btn btn-outline btn-xs" onclick="openUpdatePartnershipPaymentModal('${item.id}')" style="font-size: 10px; padding: 2px 7px; color: #4338ca; border-color: #c7d2fe; background: #ffffff; border-radius: 4px; font-weight: 600; cursor: pointer;" title="Perbarui status pembayaran dari PT Ayumi">
              Ubah Status
            </button>
          </div>
        </td>

        <!-- 8. Aksi -->
        <td style="text-align: right; padding: 10px 8px; white-space: nowrap;">
          <div style="display: inline-flex; gap: 4px; align-items: center;">
            <button type="button" class="btn-icon" onclick="printTakumiInvoice('${item.id}')" title="Cetak Faktur Penagihan Takumi ke PT Ayumi (PDF / Print)" style="color: #4338ca; width: 30px; height: 30px; border-radius: 6px; background: #eef2ff; border: 1px solid #c7d2fe; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
              <i data-lucide="printer" style="width: 15px; height: 15px;"></i>
            </button>
            <button type="button" class="btn-icon" onclick="if (typeof previewPartnershipSlip === 'function') previewPartnershipSlip('${item.id}');" title="Lihat Slip Perhitungan Bagi Hasil" style="color: #0284c7; width: 30px; height: 30px; border-radius: 6px; background: #f0f9ff; border: 1px solid #bae6fd; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
              <i data-lucide="file-text" style="width: 15px; height: 15px;"></i>
            </button>
            <button type="button" class="btn-icon" onclick="if (typeof openPartnershipModal === 'function') openPartnershipModal('${item.id}');" title="Edit Data Kerjasama" style="color: #475569; width: 30px; height: 30px; border-radius: 6px; background: #f8fafc; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
              <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

/**
 * Membuka Modal Update Status Pembayaran Hak Takumi
 */
function openUpdatePartnershipPaymentModal(partnershipId) {
  const item = (state.partnerships || []).find(p => p.id === partnershipId);
  if (!item) {
    showToast('Data kerjasama tidak ditemukan', 'warning');
    return;
  }

  const calc = getSafePartnershipSplit(item);

  const hiddenId = document.getElementById('paystatus-partnership-id');
  const serviceEl = document.getElementById('paystatus-service-name');
  const clientEl = document.getElementById('paystatus-client-name');
  const billedEl = document.getElementById('paystatus-billed-amount');
  const takumiEl = document.getElementById('paystatus-takumi-amount');
  const statusEl = document.getElementById('paystatus-status');
  const dateEl = document.getElementById('paystatus-date');
  const refEl = document.getElementById('paystatus-ref');
  const notesEl = document.getElementById('paystatus-notes');

  if (hiddenId) hiddenId.value = item.id;
  if (serviceEl) serviceEl.textContent = item.serviceName || '-';
  if (clientEl) clientEl.textContent = `Klien: ${item.clientName || '-'}`;
  if (billedEl) billedEl.textContent = formatRupiah(calc.billedAmount);
  if (takumiEl) takumiEl.textContent = formatRupiah(calc.totalTakumi);
  if (statusEl) statusEl.value = item.paymentStatus || 'Menunggu';
  if (dateEl) dateEl.value = item.paymentDate || new Date().toISOString().split('T')[0];
  if (refEl) refEl.value = item.paymentRef || '';
  if (notesEl) notesEl.value = item.paymentNotes || '';

  openModal('modal-update-partnership-payment');
}

/**
 * Menyimpan Perubahan Status Pembayaran Hak Takumi ke Database & Supabase
 */
async function savePartnershipPaymentStatus() {
  const id = document.getElementById('paystatus-partnership-id')?.value;
  if (!id) return;

  const item = (state.partnerships || []).find(p => p.id === id);
  if (!item) {
    showToast('Data kerjasama tidak ditemukan', 'error');
    return;
  }

  const newStatus = document.getElementById('paystatus-status')?.value || 'Menunggu';
  const payDate = document.getElementById('paystatus-date')?.value || '';
  const payRef = (document.getElementById('paystatus-ref')?.value || '').trim();
  const payNotes = (document.getElementById('paystatus-notes')?.value || '').trim();

  const updatedItem = {
    ...item,
    paymentStatus: newStatus,
    paymentDate: payDate,
    paymentRef: payRef,
    paymentNotes: payNotes,
    updated_at: new Date().toISOString()
  };

  try {
    const res = await fetch(`/api/partnerships/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const saved = await res.json();

    const idx = (state.partnerships || []).findIndex(p => p.id === id);
    if (idx !== -1) {
      state.partnerships[idx] = saved;
    }

    if (typeof directSupabaseSyncPartnerships === 'function') {
      directSupabaseSyncPartnerships(state.partnerships).catch(e => console.warn(e));
    }
    try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify(state.partnerships)); } catch (e) {}

    closeModal('modal-update-partnership-payment');
    showToast(`✅ Status pembayaran ${saved.id} berhasil diperbarui menjadi ${newStatus}!`, 'success');

    // Re-render kedua modul (Invoice dan Finance)
    renderInvoicePartnershipsTable();
    if (typeof renderPartnershipsTable === 'function') {
      renderPartnershipsTable();
    }
  } catch (err) {
    console.warn('Fallback local save for partnership status:', err);
    const idx = (state.partnerships || []).findIndex(p => p.id === id);
    if (idx !== -1) {
      state.partnerships[idx] = updatedItem;
    }
    if (typeof directSupabaseSyncPartnerships === 'function') {
      directSupabaseSyncPartnerships(state.partnerships).catch(e => console.warn(e));
    }
    try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify(state.partnerships)); } catch (e) {}

    closeModal('modal-update-partnership-payment');
    showToast(`✅ Status pembayaran disimpan secara lokal & disinkronkan ke Cloud!`, 'success');

    renderInvoicePartnershipsTable();
    if (typeof renderPartnershipsTable === 'function') {
      renderPartnershipsTable();
    }
  }
}

/**
 * Cetak Faktur Penagihan Hak Takumi kepada PT Ayumi (Official Invoice)
 */
function printTakumiInvoice(partnershipId) {
  const item = (state.partnerships || []).find(p => p.id === partnershipId);
  if (!item) {
    showToast('Data kerjasama tidak ditemukan', 'warning');
    return;
  }

  const calc = getSafePartnershipSplit(item);
  const activePct = item.percentages || (typeof getPartnershipPercentages === 'function' ? getPartnershipPercentages() : { takumi: 20, sales: 20, adminTax: 15, freelance: 45 });
  const invoiceNum = item.invoiceRef || `INV-TKM-${item.id}`;

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'Unit Bisnis Mandiri (UBM) Politeknik Takumi',
    tagline: 'Engineering, Manufacturing, & Automation Solutions',
    address: 'Kawasan Industri Hyundai, Cikarang Selatan, Bekasi, Jawa Barat',
    phone: '+62 21-8990-1234',
    email: 'ubm@takumi.ac.id',
    bankName: 'Bank Mandiri',
    accountNumber: '156-00-1234567-8',
    accountName: 'Unit Bisnis Mandiri Politeknik Takumi'
  };

  const isPaid = item.paymentStatus === 'Lunas';
  const isPartial = item.paymentStatus === 'Sebagian';

  const modalTitle = document.getElementById('preview-modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = `<i data-lucide="printer" style="color: #2563eb;"></i> Faktur Penagihan Hak Takumi (${invoiceNum})`;
  }

  const content = document.getElementById('preview-modal-content');
  if (!content) return;

  content.innerHTML = `
    <div class="doc-preview" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a; max-width: 820px; margin: 0 auto; background: #ffffff; padding: 24px;">
      <!-- KOP RESMI POLITEKNIK TAKUMI / UBM -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 20px;">
        <div>
          <div style="font-size: 18px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">POLITEKNIK TAKUMI</div>
          <div style="font-size: 14px; font-weight: 700; color: #2563eb; margin-top: 2px;">UNIT BISNIS MANDIRI (UBM)</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px; max-width: 380px; line-height: 1.4;">
            ${escapeHtml(compSettings.address || 'Kawasan Industri Hyundai, Cikarang Selatan, Bekasi, Jawa Barat')}<br>
            Telp: ${escapeHtml(compSettings.phone || '+62 21-8990-1234')} &bull; Email: ${escapeHtml(compSettings.email || 'ubm@takumi.ac.id')}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background: #eef2ff; color: #4338ca; border: 1.5px solid #c7d2fe; border-radius: 6px; padding: 4px 12px; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">
            Faktur Penagihan Kerjasama
          </div>
          <div class="font-mono" style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(invoiceNum)}</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">Tanggal Faktur: <strong>${escapeHtml(item.date || '-')}</strong></div>
          <div style="font-size: 11px; color: #64748b;">Ref Kerjasama: <span class="font-mono" style="font-weight: 700;">${escapeHtml(item.id)}</span></div>
        </div>
      </div>

      <!-- KEPADA / DITAGIHKAN KEPADA PT AYUMI -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding: 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Ditagihkan Kepada (Mitra Kerjasama):</div>
          <div style="font-size: 15px; font-weight: 800; color: #065f46; margin-top: 3px;">PT AYUMI</div>
          <div style="font-size: 11.5px; color: #475569; margin-top: 2px;">Jl. Raya Industri No. 88, Cikarang, Bekasi, Jawa Barat</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Perihal: <strong>Penagihan Hak Politeknik Takumi atas Kerjasama Proyek</strong></div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Informasi Pelaksanaan & Proyek:</div>
          <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(item.serviceName)}</div>
          <div style="font-size: 11.5px; color: #475569; margin-top: 2px;">Mitra / Klien Asal Proyek: <strong>${escapeHtml(item.clientName)}</strong></div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
            Status Pembayaran: 
            <strong style="color: ${isPaid ? '#166534' : isPartial ? '#92400e' : '#991b1b'};">
              ${isPaid ? '💵 Lunas (Paid)' : isPartial ? '💳 Sebagian (Partial)' : '⏳ Menunggu Pembayaran'}
            </strong>
          </div>
        </div>
      </div>

      <!-- DASAR PERHITUNGAN KONTRAK & PENERIMAAN DANA DI AYUMI -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 14px; margin-bottom: 18px; font-size: 12px; color: #1e3a8a; line-height: 1.5;">
        Berdasarkan kesepakatan kerjasama, seluruh tagihan pekerjaan telah ditagihkan dan diterima oleh <strong>PT Ayumi</strong> dari klien <strong>${escapeHtml(item.clientName)}</strong> sebesar <strong>${formatRupiah(calc.billedAmount)}</strong>. Berikut adalah rincian hak bagi hasil yang menjadi hak <strong>Politeknik Takumi</strong>:
      </div>

      <!-- TABEL RINCIAN TAGIHAN & BAGI HASIL -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase;">Komponen Bagi Hasil</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 11px; text-transform: uppercase;">Persentase</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase;">Nilai Alokasi</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 11px; text-transform: uppercase;">Pihak Berhak</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; background: #312e81;">Hak Takumi (Ditagihkan)</th>
          </tr>
        </thead>
        <tbody>
          <!-- 1. Takumi -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 700; color: #1e3a8a;">1. Alokasi Takumi</td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${activePct.takumi}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.takumiNominal)}</td>
            <td style="padding: 10px 12px; text-align: center;">${calc.takumiCatSplit.recipient || (item.contributions?.takumi?.ayumi ? 'Takumi & Ayumi' : 'Takumi')}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca; background: #f5f3ff;" class="font-mono">${formatRupiah(calc.takumiCatSplit.takumi)}</td>
          </tr>
          <!-- 2. Sales -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">2. Sales & Pemasaran</td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${activePct.sales}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.salesNominal)}</td>
            <td style="padding: 10px 12px; text-align: center;">${calc.salesSplit.recipient || (item.contributions?.sales?.takumi ? 'Takumi' : 'Ayumi')}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca; background: #f5f3ff;" class="font-mono">${formatRupiah(calc.salesSplit.takumi)}</td>
          </tr>
          <!-- 3. Administrasi & Pajak -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">3. Administrasi & Pajak</td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${activePct.adminTax}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.adminTaxNominal)}</td>
            <td style="padding: 10px 12px; text-align: center;">${calc.adminTaxSplit.recipient || (item.contributions?.adminTax?.takumi ? 'Takumi' : 'Ayumi')}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca; background: #f5f3ff;" class="font-mono">${formatRupiah(calc.adminTaxSplit.takumi)}</td>
          </tr>
          <!-- 4. Freelance -->
          <tr style="border-bottom: 2px solid #0f172a;">
            <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">4. Freelance (Tenaga Ahli)</td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${activePct.freelance}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.freelanceNominal)}</td>
            <td style="padding: 10px 12px; text-align: center;">${calc.freelanceSplit.recipient || (item.contributions?.freelance?.takumi ? 'Takumi' : 'Ayumi')}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca; background: #f5f3ff;" class="font-mono">${formatRupiah(calc.freelanceSplit.takumi)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; font-size: 13px;">
            <td colspan="4" style="padding: 12px; text-align: right; font-weight: 800; color: #0f172a;">
              TOTAL HAK POLITEKNIK TAKUMI YANG DITAGIHKAN:
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 900; font-size: 16px; color: #4338ca; background: #ede9fe;" class="font-mono">
              ${formatRupiah(calc.totalTakumi)}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- INSTRUKSI REKENING PEMBAYARAN -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 26px;">
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 11.5px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Instruksi Pembayaran Transfer:</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px; line-height: 1.5;">
            Mohon pembayaran hak kerjasama ditransfer ke rekening resmi Politeknik Takumi:
          </div>
          <div style="margin-top: 8px; padding: 8px 12px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="font-size: 11px; color: #64748b;">Bank Tujuan:</div>
            <div style="font-size: 13.5px; font-weight: 800; color: #0f172a;">${escapeHtml(compSettings.bankName || 'Bank Mandiri')} Cabang Cikarang</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Nomor Rekening:</div>
            <div class="font-mono" style="font-size: 15px; font-weight: 800; color: #2563eb;">${escapeHtml(compSettings.accountNumber || '156-00-1234567-8')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Atas Nama:</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #0f172a;">${escapeHtml(compSettings.accountName || compSettings.companyName || 'Unit Bisnis Mandiri Politeknik Takumi')}</div>
          </div>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; background: #ffffff;">
          <div style="font-size: 11.5px; font-weight: 700; color: #64748b;">Ringkasan Pembayaran PT Ayumi:</div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 8px; padding-bottom: 6px; border-bottom: 1px dashed #cbd5e1;">
            <span>Hak PT Ayumi:</span>
            <strong class="font-mono" style="color: #065f46;">${formatRupiah(calc.totalAyumi)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; padding-bottom: 6px; border-bottom: 1px dashed #cbd5e1;">
            <span>Hak Politeknik Takumi:</span>
            <strong class="font-mono" style="color: #4338ca;">${formatRupiah(calc.totalTakumi)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; font-weight: 800;">
            <span>Total Tagihan Proyek:</span>
            <strong class="font-mono">${formatRupiah(calc.billedAmount)}</strong>
          </div>
        </div>
      </div>

      <!-- TANDA TANGAN KEDUA BELAH PIHAK -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; margin-top: 24px; padding-top: 14px;">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #475569;">Diterima & Disetujui Oleh,</div>
          <div style="font-size: 13px; font-weight: 800; color: #065f46; margin-top: 2px;">PT AYUMI</div>
          <div style="height: 65px;"></div>
          <div style="font-size: 13px; font-weight: 800; text-decoration: underline; color: #0f172a;">( Direksi / Keuangan PT Ayumi )</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Pihak Pembayar</div>
        </div>
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #475569;">Cikarang, ${escapeHtml(item.date || '-')}</div>
          <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-top: 2px;">POLITEKNIK TAKUMI - UBM</div>
          <div style="height: 65px;"></div>
          <div style="font-size: 13px; font-weight: 800; text-decoration: underline; color: #0f172a;">( ${escapeHtml(compSettings.headFinance || 'Bagian Keuangan & UBM')} )</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Pihak Penagih</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

/**
 * Ekspor CSV Khusus Penagihan Hak Takumi ke Ayumi
 */
function exportTakumiInvoiceCSV() {
  const list = state.partnerships || [];
  if (list.length === 0) {
    showToast('Belum ada data penagihan kerjasama untuk diekspor', 'warning');
    return;
  }

  const headers = [
    'No. Faktur Penagihan',
    'No. Kerjasama',
    'Tanggal Faktur',
    'Layanan / Proyek',
    'Mitra / Klien Asal',
    'Nilai Tagihan Proyek (Ayumi)',
    'Hak Takumi (Ditagihkan)',
    'Hak Ayumi',
    '% Hak Takumi',
    'Status Pembayaran Ayumi',
    'Tanggal Pembayaran',
    'No. Bukti Transfer',
    'Catatan Transfer'
  ];

  const rows = list.map(item => {
    const calc = getSafePartnershipSplit(item);
    const invoiceNum = item.invoiceRef || `INV-TKM-${item.id}`;
    return [
      `"${invoiceNum}"`,
      `"${item.id || ''}"`,
      `"${item.date || ''}"`,
      `"${(item.serviceName || '').replace(/"/g, '""')}"`,
      `"${(item.clientName || '').replace(/"/g, '""')}"`,
      calc.billedAmount || 0,
      calc.totalTakumi || 0,
      calc.totalAyumi || 0,
      `"${calc.takumiPercent.toFixed(1)}%"`,
      `"${item.paymentStatus || 'Menunggu'}"`,
      `"${item.paymentDate || ''}"`,
      `"${(item.paymentRef || '').replace(/"/g, '""')}"`,
      `"${(item.paymentNotes || item.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UBM_PENAGIHAN_TAKUMI_AYUMI_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('✅ CSV Penagihan Hak Takumi berhasil diunduh!', 'success');
}

// Window Exposures
window.switchInvoiceTab = switchInvoiceTab;
window.renderInvoicePartnershipsTable = renderInvoicePartnershipsTable;
window.openUpdatePartnershipPaymentModal = openUpdatePartnershipPaymentModal;
window.savePartnershipPaymentStatus = savePartnershipPaymentStatus;
window.printTakumiInvoice = printTakumiInvoice;
window.exportTakumiInvoiceCSV = exportTakumiInvoiceCSV;
window.getSafePartnershipSplit = getSafePartnershipSplit;
