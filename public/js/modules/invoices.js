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

