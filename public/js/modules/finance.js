// =========================================================
// UBM - Modul Keuangan & Profitabilitas Project
// Halaman mandiri Keuangan di Side Menu
// Menghitung: Harga Modal (HPP), Harga Jual, Plafon Garansi, Klaim, Keuntungan Bersih & Margin (%)
// =========================================================

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
    // Jika Lunas, harga jual diakui penuh (contractSellingPrice)
    sellingPrice = contractSellingPrice > 0 ? contractSellingPrice : totalPaidAmount;
  } else if (invoiceStatus === 'Partial' || totalPaidAmount > 0) {
    // Jika Pembayaran Sebagian, harga jual dihitung proporsional terhadap porsi terbayar pada invoice
    if (invoiceGrandTotal > 0 && contractSellingPrice > 0) {
      sellingPrice = Math.round((totalPaidAmount / invoiceGrandTotal) * contractSellingPrice);
    } else {
      sellingPrice = totalPaidAmount;
    }
  } else {
    // Jika Unpaid (Belum Dibayar), harga jual yang masuk realisasi kas/pendapatan adalah Rp 0
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
    // A. Material Cost (dari actualUsageReport, BOM, atau Purchasing PR)
    if (project.actualUsageReport?.items && project.actualUsageReport.items.length > 0) {
      materialCost = project.actualUsageReport.items.reduce((sum, item) => {
        const qty = parseFloat(item.actualQty ?? item.planQty ?? 0) || 0;
        const cost = parseFloat(item.unitCost ?? item.unitPrice ?? 0) || 0;
        return sum + (qty * cost);
      }, 0);
    } else {
      // Cek BOM terkait
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
        // Cek PR Purchasing
        const linkedPRs = (state.purchasing || []).filter(pr => 
          pr.projectId === project.id || 
          pr.orderId === (project.orderId || project.id) ||
          (pr.purpose && pr.purpose.toLowerCase().includes(project.projectName?.toLowerCase()))
        );
        if (linkedPRs.length > 0) {
          materialCost = linkedPRs.reduce((sum, pr) => sum + (parseFloat(pr.totalEstimated || pr.totalAmount || 0) || (pr.items || []).reduce((isum, it) => isum + (it.qty * (it.actualPrice || it.unitPrice || 0)), 0)), 0);
        } else {
          // Estimasi standar: ~55% dari nilai kontrak
          materialCost = contractSellingPrice > 0 ? Math.round(contractSellingPrice * 0.55) : 0;
        }
      }
    }

    // B. Labor Cost (Biaya Jasa & Tenaga Kerja)
    const serviceItemsTotal = parseFloat(quotation?.servicesTotal || 0);
    if (serviceItemsTotal > 0) {
      laborCost = Math.round(serviceItemsTotal * 0.6);
    } else {
      laborCost = contractSellingPrice > 0 ? Math.round(contractSellingPrice * 0.12) : 0;
    }

    // C. Overhead Cost (~5%)
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
    sellingPrice, // Realisasi harga jual aktif dari pembayaran invoice
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
 * Merender Tabel Finansial & KPI Ringkasan pada Halaman Keuangan
 */
function renderFinanceTable() {
  const tbody = document.getElementById('table-finance-body') || document.getElementById('table-service-finance-body');
  if (!tbody) return;

  const allProjects = state.projects || [];
  let completedProjects = allProjects.filter(p => typeof isProjectCompletedForService === 'function' ? isProjectCompletedForService(p) : true);
  
  // Jika tidak ada project completed, ambil project yang memiliki order agar tabel tetap informatif
  if (completedProjects.length === 0 && allProjects.length > 0) {
    completedProjects = allProjects.filter(p => (state.orders || []).some(o => o.id === p.orderId));
  }
  if (completedProjects.length === 0 && allProjects.length > 0) {
    completedProjects = allProjects;
  }

  // Hitung KPI Keuangan Keseluruhan
  let totalRevenue = 0;
  let totalContractValue = 0;
  let totalCOGS = 0;
  let totalWarranty = 0;
  let totalClaims = 0;
  let totalNetProfit = 0;

  const financialDataList = completedProjects.map(p => {
    const fin = getProjectFinancialData(p);
    totalRevenue += fin.sellingPrice;
    totalContractValue += fin.contractSellingPrice;
    totalCOGS += fin.modalTotal;
    totalWarranty += fin.allocatedWarranty;
    totalClaims += fin.claimedWarranty;
    totalNetProfit += fin.netProfit;
    return fin;
  });

  const avgMargin = totalRevenue > 0 ? ((totalNetProfit / totalRevenue) * 100) : (totalNetProfit < 0 ? -100 : 0);

  // Update KPI Metric Cards
  const kpiRev = document.getElementById('kpi-finance-total-revenue');
  const kpiCogs = document.getElementById('kpi-finance-total-cogs');
  const kpiWar = document.getElementById('kpi-finance-total-warranty');
  const kpiClaims = document.getElementById('kpi-finance-total-claims');
  const kpiNet = document.getElementById('kpi-finance-total-net-profit');
  const kpiAvgMargin = document.getElementById('kpi-finance-avg-margin');

  if (kpiRev) {
    kpiRev.textContent = formatRupiah(totalRevenue);
    kpiRev.title = `Total Nilai Kontrak Tagihan: ${formatRupiah(totalContractValue)}`;
  }
  if (kpiCogs) kpiCogs.textContent = formatRupiah(totalCOGS);
  if (kpiWar) kpiWar.textContent = formatRupiah(totalWarranty);
  if (kpiClaims) kpiClaims.textContent = formatRupiah(totalClaims);
  if (kpiNet) {
    kpiNet.textContent = totalNetProfit >= 0 ? formatRupiah(totalNetProfit) : `-${formatRupiah(Math.abs(totalNetProfit))}`;
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
      (f.project.projectLead && f.project.projectLead.toLowerCase().includes(q)) ||
      (f.invoiceId && f.invoiceId.toLowerCase().includes(q))
    );
  }

  // Status Filter
  const filterProfitStatus = document.getElementById('filter-finance-profit-status')?.value || 'ALL';
  if (filterProfitStatus !== 'ALL') {
    if (filterProfitStatus === 'PAID') {
      filteredList = filteredList.filter(f => f.invoiceStatus === 'Paid');
    } else if (filterProfitStatus === 'PARTIAL') {
      filteredList = filteredList.filter(f => f.invoiceStatus === 'Partial');
    } else if (filterProfitStatus === 'UNPAID') {
      filteredList = filteredList.filter(f => f.invoiceStatus === 'Unpaid');
    } else if (filterProfitStatus === 'LOSS') {
      filteredList = filteredList.filter(f => f.netProfit < 0 || f.profitLevel === 'LOSS' || f.profitLevel === 'UNPAID' || f.profitLevel === 'PARTIAL_DEFICIT');
    } else {
      filteredList = filteredList.filter(f => f.profitLevel === filterProfitStatus);
    }
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 40px 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <i data-lucide="calculator" style="width: 40px; height: 40px; color: #94a3b8;"></i>
            <div style="font-weight: 700; color: #475569; font-size: 14px;">Tidak ada data keuangan project yang cocok</div>
            <div style="font-size: 12px; color: #94a3b8;">Silakan sesuaikan kata kunci pencarian atau filter profitabilitas & status invoice.</div>
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

    let invoiceStatusBadgeHtml = '';
    if (f.invoiceStatus === 'Paid') {
      invoiceStatusBadgeHtml = `<span class="badge badge-success" style="font-size: 9.5px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check-circle" style="width: 10px; height: 10px;"></i> Lunas (Paid)</span>`;
    } else if (f.invoiceStatus === 'Partial') {
      invoiceStatusBadgeHtml = `<span class="badge badge-amber" style="font-size: 9.5px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="clock" style="width: 10px; height: 10px;"></i> Terbayar ${f.paymentPercentage.toFixed(0)}%</span>`;
    } else {
      invoiceStatusBadgeHtml = `<span class="badge badge-danger" style="font-size: 9.5px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="alert-circle" style="width: 10px; height: 10px;"></i> Belum Dibayar</span>`;
    }

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
          <div class="font-mono font-bold" style="font-size: 13.5px; color: ${f.sellingPrice > 0 ? (f.invoiceStatus === 'Paid' ? '#15803d' : '#2563eb') : '#dc2626'};">
            ${formatRupiah(f.sellingPrice)}
          </div>
          <div style="margin-top: 3px;">
            ${invoiceStatusBadgeHtml}
          </div>
          <div class="text-muted" style="font-size: 10px; margin-top: 2px;">
            Kontrak: ${formatRupiah(f.contractSellingPrice)}
          </div>
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
            ${f.netProfit >= 0 ? formatRupiah(f.netProfit) : `-${formatRupiah(Math.abs(f.netProfit))}`}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            Laba Kotor: ${formatRupiah(f.grossProfit)}
          </div>
        </td>
        <td style="text-align: center;">
          <div class="badge ${f.profitBadgeClass}" style="font-size: 11.5px; font-weight: 800; padding: 4px 8px; font-family: monospace;">
            ${f.profitMargin >= 0 ? `${f.profitMargin.toFixed(1)}%` : `${f.profitMargin.toFixed(1)}%`}
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
            <button class="btn btn-sm btn-outline" style="color: #dc2626; border-color: #fecdd3; background: #fff1f2; font-size: 11px; padding: 5px 8px; font-weight: 700;" onclick="deleteProjectFinanceRow('${p.id}')" title="Hapus Data Keuangan Proyek">
              <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
}

function filterFinanceTable() {
  renderFinanceTable();
}

// -------------------------------------------------------------
// 1. DETAIL ANALISIS KEUANGAN & PROFITABILITAS PROYEK
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

      <!-- STATUS PEMBAYARAN INVOICE & REALISASI KAS -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="receipt" style="width: 14px; height: 14px; color: #2563eb;"></i> Integrasi Faktur Tagihan (Invoice)
          </div>
          <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 3px;">
            No. Invoice: <span class="mono-id text-primary">${fin.invoiceId}</span> &bull; Status: <span class="badge ${fin.invoiceBadgeClass}" style="font-size: 10.5px; padding: 2px 7px;">${fin.invoiceStatusLabel}</span>
          </div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
            Perhitungan laba bersih & margin laba keuangan bergerak dinamis mengikuti realisasi pembayaran invoice ini.
          </div>
        </div>
        <div style="text-align: right; display: flex; gap: 16px; align-items: center;">
          <div>
            <div style="font-size: 10.5px; color: #64748b;">Total Tagihan Invoice:</div>
            <div class="font-mono font-bold" style="font-size: 13px; color: #0f172a;">${formatRupiah(fin.invoiceGrandTotal)}</div>
          </div>
          <div>
            <div style="font-size: 10.5px; color: #166534;">Jumlah Terbayar:</div>
            <div class="font-mono font-bold" style="font-size: 13px; color: #15803d;">${formatRupiah(fin.totalPaidAmount)}</div>
          </div>
          <div>
            <div style="font-size: 10.5px; color: #991b1b;">Sisa Piutang:</div>
            <div class="font-mono font-bold" style="font-size: 13px; color: #dc2626;">${formatRupiah(fin.balanceDue)}</div>
          </div>
        </div>
      </div>

      <!-- KEY FINANCIAL METRICS CARDS -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Harga Jual Realisasi</div>
          <div class="font-mono" style="font-size: 16px; font-weight: 800; color: ${fin.sellingPrice > 0 ? (fin.invoiceStatus === 'Paid' ? '#15803d' : '#2563eb') : '#dc2626'}; margin-top: 4px;">${formatRupiah(fin.sellingPrice)}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Kontrak: ${formatRupiah(fin.contractSellingPrice)}</div>
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
          <div class="font-mono" style="font-size: 17px; font-weight: 800; color: ${isProfitable ? '#15803d' : '#dc2626'}; margin-top: 4px;">${fin.netProfit >= 0 ? formatRupiah(fin.netProfit) : `-${formatRupiah(Math.abs(fin.netProfit))}`}</div>
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
              <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">1. Nilai Kontrak Dasar (DPP)</td>
              <td style="padding: 9px 12px; color: #64748b;">Total nilai pesanan / quotation sebelum PPN 11%</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">${formatRupiah(fin.contractSellingPrice)}</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-weight: 700;">100.0%</td>
            </tr>

            <tr style="background: #f0fdf4; border-bottom: 1px solid #dcfce7;">
              <td style="padding: 9px 12px; font-weight: 700; color: #166534;">2. Harga Jual Realisasi (Terbayar)</td>
              <td style="padding: 9px 12px; color: #166534; font-size: 11.5px;">Realisasi kas masuk dari invoice (${fin.invoiceStatusLabel} - ${fin.paymentPercentage.toFixed(0)}%)</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-weight: 800; color: #15803d;">${formatRupiah(fin.sellingPrice)}</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-weight: 700; color: #15803d;">${fin.paymentPercentage.toFixed(1)}%</td>
            </tr>

            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 9px 12px; padding-left: 24px; color: #334155;">&bull; Biaya Bahan & Material (BOM)</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Material mekanik, elektrikal, sensor & komponen terpakai</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.materialCost)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #64748b;">${fin.contractSellingPrice > 0 ? ((fin.materialCost / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 9px 12px; padding-left: 24px; color: #334155;">&bull; Biaya Tenaga Kerja & Jasa Langsung</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Upah perakitan, programming, wiring & instalasi</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.laborCost)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #64748b;">${fin.contractSellingPrice > 0 ? ((fin.laborCost / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 9px 12px; padding-left: 24px; color: #334155;">&bull; Biaya Overhead & Operasional Pabrik</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Listrik, depresiasi tools, pengujian QC, transport logistik</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.overheadCost)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #64748b;">${fin.contractSellingPrice > 0 ? ((fin.overheadCost / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #fffbeb; border-bottom: 2px solid #fef3c7; font-weight: 700;">
              <td style="padding: 9px 12px; color: #92400e;">3. Total Harga Modal (HPP Proyek)</td>
              <td style="padding: 9px 12px; color: #92400e; font-size: 11.5px;">Akumulasi Biaya Bahan + Tenaga Kerja + Overhead</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-size: 13px; color: #b45309;">${formatRupiah(fin.modalTotal)}</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #92400e;">${fin.contractSellingPrice > 0 ? ((fin.modalTotal / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; font-weight: 700;">
              <td style="padding: 9px 12px; color: #1e293b;">4. Keuntungan Kotor (Gross Profit Realisasi)</td>
              <td style="padding: 9px 12px; color: #64748b; font-size: 11.5px;">Harga Jual Realisasi Terbayar dikurangi Total Harga Modal (HPP)</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-size: 13px; color: ${fin.grossProfit >= 0 ? '#15803d' : '#dc2626'};">${fin.grossProfit >= 0 ? formatRupiah(fin.grossProfit) : `-${formatRupiah(Math.abs(fin.grossProfit))}`}</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #0f172a;">${fin.sellingPrice > 0 ? ((fin.grossProfit / fin.sellingPrice) * 100).toFixed(1) : (fin.grossProfit < 0 ? '-100.0' : '0.0')}%</td>
            </tr>

            <tr style="background: #fdf2f8; border-bottom: 1px solid #fce7f3;">
              <td style="padding: 9px 12px; color: #9d174d;">5. Beban Klaim Garansi Terpakai</td>
              <td style="padding: 9px 12px; color: #9d174d; font-size: 11.5px;">Realisasi klaim after sales dari plafon garansi (${formatRupiah(fin.allocatedWarranty)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #be185d;">(${formatRupiah(fin.claimedWarranty)})</td>
              <td style="padding: 9px 12px; text-align: right; font-family: monospace; color: #9d174d;">${fin.contractSellingPrice > 0 ? ((fin.claimedWarranty / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: ${isProfitable ? '#f0fdf4' : '#fef2f2'}; border-top: 2px solid ${isProfitable ? '#22c55e' : '#ef4444'}; font-weight: 800; font-size: 13.5px;">
              <td style="padding: 12px; color: ${isProfitable ? '#15803d' : '#dc2626'};">6. Keuntungan Bersih Realisasi (Net Profit)</td>
              <td style="padding: 12px; color: ${isProfitable ? '#166534' : '#991b1b'}; font-size: 12px;">Laba Bersih Akhir Mengikuti Realisasi Pembayaran Invoice</td>
              <td style="padding: 12px; text-align: right; font-family: monospace; font-size: 15px; color: ${isProfitable ? '#15803d' : '#dc2626'};">${fin.netProfit >= 0 ? formatRupiah(fin.netProfit) : `-${formatRupiah(Math.abs(fin.netProfit))}`}</td>
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
// 2. FORM PENYESUAIAN HARGA MODAL (HPP) PROYEK
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
          <span class="text-muted">Harga Jual Realisasi (Terbayar):</span>
          <strong class="font-mono text-primary" style="font-size: 13px;">${formatRupiah(fin.sellingPrice)} <span class="text-muted" style="font-size: 11px;">(Kontrak: ${formatRupiah(fin.contractSellingPrice)})</span></strong>
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
            oninput="recalculateModalCostAdjustForm(${fin.sellingPrice > 0 ? fin.sellingPrice : fin.contractSellingPrice}, ${fin.claimedWarranty})"
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
            oninput="recalculateModalCostAdjustForm(${fin.sellingPrice > 0 ? fin.sellingPrice : fin.contractSellingPrice}, ${fin.claimedWarranty})"
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
            oninput="recalculateModalCostAdjustForm(${fin.sellingPrice > 0 ? fin.sellingPrice : fin.contractSellingPrice}, ${fin.claimedWarranty})"
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
              ${fin.netProfit >= 0 ? formatRupiah(fin.netProfit) : `-${formatRupiah(Math.abs(fin.netProfit))}`}
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
  const margin = sellingPrice > 0 ? ((netProfit / sellingPrice) * 100) : (totalCogs + claimedWarranty > 0 ? -100 : 0);

  const dispCogs = document.getElementById('preview-adjust-total-cogs');
  const dispNet = document.getElementById('preview-adjust-net-profit');
  const dispMargin = document.getElementById('preview-adjust-margin');

  if (dispCogs) dispCogs.textContent = formatRupiah(totalCogs);
  if (dispNet) {
    dispNet.textContent = netProfit >= 0 ? formatRupiah(netProfit) : `-${formatRupiah(Math.abs(netProfit))}`;
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
    const idx = (state.projects || []).findIndex(item => item.id === p.id);
    if (idx !== -1) {
      state.projects[idx] = updated || p;
    }
    closeModal('form-modal');
    showToast('Harga Modal (HPP) proyek berhasil disimpan & diperbarui!', 'success');
    renderFinanceTable();
  } catch (err) {
    console.error('Error saving project modal cost:', err);
    closeModal('form-modal');
    showToast('Harga Modal diperbarui pada state lokal', 'info');
    renderFinanceTable();
  }
}

// -------------------------------------------------------------
// 3. CETAK LAPORAN KEUANGAN & PROFITABILITAS PROYEK RESMI
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
          Evaluasi Biaya Modal (HPP), Alokasi Garansi After Sales, dan Realisasi Margin Laba Bersih Mengikuti Pembayaran Invoice
        </div>
      </div>

      <!-- INFORMASI PROYEK & INVOICE -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 130px; color: #64748b; padding: 3px 0;">No. Proyek / Ref:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 0;">
              ${p.id} ${p.orderId ? `&bull; Ref SO: ${p.orderId}` : ''} ${fin.quotation?.id ? `&bull; Penawaran: ${fin.quotation.id}` : ''}
            </td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 3px 0;">Faktur Tagihan:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 0;">
              No: ${fin.invoiceId} &bull; Status: <strong>${fin.invoiceStatusLabel}</strong> (Terbayar: ${formatRupiah(fin.totalPaidAmount)} dari ${formatRupiah(fin.invoiceGrandTotal)})
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
              <td style="padding: 8px 10px; color: #0f172a;">NILAI KONTRAK DASAR (DPP)</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 11px;">Nilai kontrak pesanan (sebelum PPN)</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12.5px;">${formatRupiah(fin.contractSellingPrice)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace;">100.0%</td>
            </tr>

            <tr style="border-bottom: 1px solid #e2e8f0; background: #f0fdf4; font-weight: 700;">
              <td style="padding: 8px 10px; text-align: center; color: #166534;">2</td>
              <td style="padding: 8px 10px; color: #166534;">HARGA JUAL REALISASI (TERBAYAR)</td>
              <td style="padding: 8px 10px; color: #166534; font-size: 11px;">Realisasi penerimaan pembayaran invoice (${fin.invoiceStatusLabel})</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12.5px; color: #15803d;">${formatRupiah(fin.sellingPrice)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #15803d;">${fin.paymentPercentage.toFixed(1)}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
              <td style="padding: 6px 10px; text-align: center; color: #94a3b8;">2.1</td>
              <td style="padding: 6px 10px; padding-left: 20px; color: #475569;">Biaya Material / Komponen BOM</td>
              <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">Bahan baku & suku cadang mekanik/elektrik</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.materialCost)})</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #64748b;">${fin.contractSellingPrice > 0 ? ((fin.materialCost / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
              <td style="padding: 6px 10px; text-align: center; color: #94a3b8;">2.2</td>
              <td style="padding: 6px 10px; padding-left: 20px; color: #475569;">Biaya Tenaga Kerja & Jasa</td>
              <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">Upah teknisi perakitan, wiring, instalasi</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.laborCost)})</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #64748b;">${fin.contractSellingPrice > 0 ? ((fin.laborCost / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
              <td style="padding: 6px 10px; text-align: center; color: #94a3b8;">2.3</td>
              <td style="padding: 6px 10px; padding-left: 20px; color: #475569;">Biaya Overhead & Operasional</td>
              <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">Listrik, QC inspection, transport pengiriman</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #b45309;">(${formatRupiah(fin.overheadCost)})</td>
              <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #64748b;">${fin.contractSellingPrice > 0 ? ((fin.overheadCost / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 2px solid #cbd5e1; background: #fffbeb; font-weight: 700;">
              <td style="padding: 8px 10px; text-align: center;">3</td>
              <td style="padding: 8px 10px; color: #92400e;">TOTAL HARGA MODAL (HPP)</td>
              <td style="padding: 8px 10px; color: #92400e; font-size: 11px;">Akumulasi biaya langsung proyek</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12.5px; color: #b45309;">${formatRupiah(fin.modalTotal)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #92400e;">${fin.contractSellingPrice > 0 ? ((fin.modalTotal / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #e2e8f0; font-weight: 700;">
              <td style="padding: 8px 10px; text-align: center;">4</td>
              <td style="padding: 8px 10px; color: #0f172a;">KEUNTUNGAN KOTOR REALISASI</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 11px;">Harga Jual Realisasi - Total HPP</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 12.5px; color: ${fin.grossProfit >= 0 ? '#15803d' : '#dc2626'};">${fin.grossProfit >= 0 ? formatRupiah(fin.grossProfit) : `-${formatRupiah(Math.abs(fin.grossProfit))}`}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace;">${fin.sellingPrice > 0 ? ((fin.grossProfit / fin.sellingPrice) * 100).toFixed(1) : (fin.grossProfit < 0 ? '-100.0' : '0.0')}%</td>
            </tr>

            <tr style="border-bottom: 1px solid #e2e8f0; color: #9d174d;">
              <td style="padding: 8px 10px; text-align: center;">5</td>
              <td style="padding: 8px 10px;">Beban Klaim Garansi Terpakai</td>
              <td style="padding: 8px 10px; font-size: 11px;">Alokasi: ${formatRupiah(fin.allocatedWarranty)} &bull; Sisa: ${formatRupiah(fin.remainingWarranty)}</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #be185d;">(${formatRupiah(fin.claimedWarranty)})</td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace;">${fin.contractSellingPrice > 0 ? ((fin.claimedWarranty / fin.contractSellingPrice) * 100).toFixed(1) : 0}%</td>
            </tr>

            <tr style="background: ${isProfitable ? '#f0fdf4' : '#fef2f2'}; border-top: 2px solid #0f172a; font-weight: 800; font-size: 13px;">
              <td style="padding: 10px; text-align: center; color: ${isProfitable ? '#15803d' : '#dc2626'};">6</td>
              <td style="padding: 10px; color: ${isProfitable ? '#15803d' : '#dc2626'};">KEUNTUNGAN BERSIH REALISASI (NET PROFIT)</td>
              <td style="padding: 10px; color: ${isProfitable ? '#166534' : '#991b1b'}; font-size: 11.5px;">Laba Bersih Akhir Mengikuti Realisasi Pembayaran Invoice</td>
              <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 14px; color: ${isProfitable ? '#15803d' : '#dc2626'};">${fin.netProfit >= 0 ? formatRupiah(fin.netProfit) : `-${formatRupiah(Math.abs(fin.netProfit))}`}</td>
              <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 13px; color: ${isProfitable ? '#15803d' : '#dc2626'};">${fin.profitMargin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- EVALUASI PROFITABILITAS -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 24px; font-size: 11.5px; color: #334155;">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px;">CATATAN EVALUASI FINANSIAL:</div>
        <div>Tingkat profitabilitas proyek ini dikategorikan <strong>${fin.profitLabel}</strong> dengan margin laba sebesar <strong>${fin.profitMargin.toFixed(1)}%</strong>. Realisasi pendapatan kas saat ini adalah <strong>${formatRupiah(fin.sellingPrice)}</strong> (${fin.invoiceStatusLabel}). Seluruh klaim garansi yang terjadi selama masa pemeliharaan telah diperhitungkan secara akurat ke dalam realisasi laba bersih akhir.</div>
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
// 4. EXPORT DATA KEUANGAN PROJECT KE CSV
// -------------------------------------------------------------
function exportFinanceToCSV() {
  const allProjects = state.projects || [];
  let completedProjects = allProjects.filter(p => typeof isProjectCompletedForService === 'function' ? isProjectCompletedForService(p) : true);
  if (completedProjects.length === 0 && allProjects.length > 0) {
    completedProjects = allProjects.filter(p => (state.orders || []).some(o => o.id === p.orderId));
  }
  if (completedProjects.length === 0 && allProjects.length > 0) {
    completedProjects = allProjects;
  }

  if (completedProjects.length === 0) {
    showToast('Tidak ada data keuangan project untuk diekspor', 'warning');
    return;
  }

  const headers = [
    'No Project',
    'Ref Sales Order',
    'Ref Quotation',
    'No Invoice',
    'Status Invoice',
    'Total Tagihan Invoice (Rp)',
    'Jumlah Terbayar (Rp)',
    'Sisa Piutang (Rp)',
    'Nama Project',
    'Customer',
    'Project Lead',
    'Nilai Kontrak DPP (Rp)',
    'Harga Jual Realisasi Terbayar (Rp)',
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
      `"${fin.invoiceId || ''}"`,
      `"${fin.invoiceStatusLabel || ''}"`,
      fin.invoiceGrandTotal,
      fin.totalPaidAmount,
      fin.balanceDue,
      `"${(p.projectName || '').replace(/"/g, '""')}"`,
      `"${(p.customerName || '').replace(/"/g, '""')}"`,
      `"${(p.projectLead || '').replace(/"/g, '""')}"`,
      fin.contractSellingPrice,
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

// 5. HAPUS DATA KEUANGAN PROYEK (SINGLE & ALL)
async function deleteProjectFinanceRow(projectId) {
  if (!confirm(`Apakah Anda yakin ingin menghapus data keuangan project #${projectId}?`)) {
    return;
  }
  try {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.projects = (state.projects || []).filter(p => p.id !== projectId);
    showToast(`Data keuangan project #${projectId} berhasil dihapus`, 'success');
    renderFinanceTable();
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
  } catch (err) {
    console.error('Error deleting project finance row:', err);
    showToast('Gagal menghapus data keuangan project: ' + err.message, 'error');
  }
}

async function clearAllProjectFinanceData() {
  if (!confirm('Apakah Anda yakin ingin menghapus SEMUA data keuangan project? Tindakan ini akan mengosongkan seluruh data finansial dan laporan project.')) {
    return;
  }
  try {
    const res = await fetch('/api/finance/clear-all', { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.projects = [];
    state.project_reports = [];
    showToast('Semua data keuangan project berhasil dihapus', 'success');
    renderFinanceTable();
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
  } catch (err) {
    console.error('Error clearing all project finance data:', err);
    showToast('Gagal menghapus semua data keuangan: ' + err.message, 'error');
  }
}

// =========================================================================
// BAGI HASIL KERJASAMA STRATEGIS (POLITEKNIK TAKUMI & PT AYUMI)
// =========================================================================

const DEFAULT_PARTNERSHIP_PERCENTAGES = {
  takumi: 20,      // 20%
  sales: 20,       // 20%
  adminTax: 15,    // 15%
  freelance: 45    // 45% (Total 100%)
};

/**
 * Mengambil setting persentase pembagian aktif (Total 100%)
 */
function getPartnershipPercentages() {
  if (state.settings && state.settings.partnershipPercentages) {
    const s = state.settings.partnershipPercentages;
    const takumi = typeof s.takumi === 'number' ? s.takumi : DEFAULT_PARTNERSHIP_PERCENTAGES.takumi;
    const sales = typeof s.sales === 'number' ? s.sales : DEFAULT_PARTNERSHIP_PERCENTAGES.sales;
    const adminTax = typeof s.adminTax === 'number' ? s.adminTax : DEFAULT_PARTNERSHIP_PERCENTAGES.adminTax;
    const freelance = typeof s.freelance === 'number' ? s.freelance : DEFAULT_PARTNERSHIP_PERCENTAGES.freelance;
    return { takumi, sales, adminTax, freelance };
  }
  try {
    const cached = localStorage.getItem('ubm_partnership_percentages');
    if (cached) {
      const parsed = JSON.parse(cached);
      const takumi = typeof parsed.takumi === 'number' ? parsed.takumi : DEFAULT_PARTNERSHIP_PERCENTAGES.takumi;
      const sales = typeof parsed.sales === 'number' ? parsed.sales : DEFAULT_PARTNERSHIP_PERCENTAGES.sales;
      const adminTax = typeof parsed.adminTax === 'number' ? parsed.adminTax : DEFAULT_PARTNERSHIP_PERCENTAGES.adminTax;
      const freelance = typeof parsed.freelance === 'number' ? parsed.freelance : DEFAULT_PARTNERSHIP_PERCENTAGES.freelance;
      return { takumi, sales, adminTax, freelance };
    }
  } catch (e) {}
  return { ...DEFAULT_PARTNERSHIP_PERCENTAGES };
}

/**
 * Switch Sub-Tabs pada Halaman Keuangan:
 * 1. Profitabilitas Proyek UBM ('profit')
 * 2. Kerjasama & Bagi Hasil ('partnership')
 * 3. Pengeluaran Jasa (Transport & Uang Makan) ('service-expenses')
 */
function switchFinanceTab(tabKey) {
  const profitContent = document.getElementById('finance-tab-content-profit');
  const partnershipContent = document.getElementById('finance-tab-content-partnership');
  const serviceExpenseContent = document.getElementById('finance-tab-content-service-expenses');

  const btnProfit = document.getElementById('tab-btn-finance-profit');
  const btnPartnership = document.getElementById('tab-btn-finance-partnership');
  const btnServiceExpense = document.getElementById('tab-btn-finance-service-expenses');

  // Reset semua tab styles
  const allBtns = [btnProfit, btnPartnership, btnServiceExpense];
  allBtns.forEach(btn => {
    if (btn) {
      btn.style.background = '#f1f5f9';
      btn.style.color = '#475569';
      btn.style.boxShadow = 'none';
    }
  });

  if (profitContent) profitContent.style.display = 'none';
  if (partnershipContent) partnershipContent.style.display = 'none';
  if (serviceExpenseContent) serviceExpenseContent.style.display = 'none';

  if (tabKey === 'service-expenses' || tabKey === 'service_expenses') {
    if (serviceExpenseContent) serviceExpenseContent.style.display = 'block';
    if (btnServiceExpense) {
      btnServiceExpense.style.background = '#ea580c';
      btnServiceExpense.style.color = '#ffffff';
      btnServiceExpense.style.boxShadow = '0 2px 4px rgba(234,88,12,0.25)';
    }
    try { sessionStorage.setItem('ubm_active_finance_tab', 'service-expenses'); } catch (e) {}
    renderServiceExpensesTable();
  } else if (tabKey === 'partnership') {
    if (partnershipContent) partnershipContent.style.display = 'block';
    if (btnPartnership) {
      btnPartnership.style.background = '#2563eb';
      btnPartnership.style.color = '#ffffff';
      btnPartnership.style.boxShadow = '0 2px 4px rgba(37,99,235,0.2)';
    }
    try { sessionStorage.setItem('ubm_active_finance_tab', 'partnership'); } catch (e) {}
    renderPartnershipsTable();
  } else {
    if (profitContent) profitContent.style.display = 'block';
    if (btnProfit) {
      btnProfit.style.background = '#2563eb';
      btnProfit.style.color = '#ffffff';
      btnProfit.style.boxShadow = '0 2px 4px rgba(37,99,235,0.2)';
    }
    try { sessionStorage.setItem('ubm_active_finance_tab', 'profit'); } catch (e) {}
    renderFinanceTable();
  }

  if (typeof lucide !== 'undefined') {
    try { lucide.createIcons(); } catch (e) {}
  }
}

/**
 * Mesin kalkulasi bagi hasil kontribusi kerjasama (Takumi + Sales + Admin/Tax + Freelance = 100%)
 */
function calculatePartnershipSplit(entry, customPercentages) {
  const billedAmount = parseFloat(entry.billedAmount || 0) || 0;
  const pct = customPercentages || entry.percentages || getPartnershipPercentages();

  const takumiNominal = Math.round(billedAmount * ((pct.takumi || 0) / 100));
  const salesNominal = Math.round(billedAmount * ((pct.sales || 0) / 100));
  const adminTaxNominal = Math.round(billedAmount * ((pct.adminTax || 0) / 100));
  const freelanceNominal = Math.round(billedAmount * ((pct.freelance || 0) / 100));

  const contrib = entry.contributions || {
    takumi: { takumi: true, ayumi: false },
    sales: { takumi: true, ayumi: false },
    adminTax: { takumi: false, ayumi: true },
    freelance: { takumi: true, ayumi: false }
  };

  function splitCategory(catNominal, takumiChecked, ayumiChecked) {
    const takumi = !!takumiChecked;
    const ayumi = !!ayumiChecked;
    if (takumi && !ayumi) {
      return { takumi: catNominal, ayumi: 0, recipient: 'Takumi' };
    }
    if (!takumi && ayumi) {
      return { takumi: 0, ayumi: catNominal, recipient: 'Ayumi' };
    }
    if (takumi && ayumi) {
      const half = Math.round(catNominal / 2);
      return { takumi: half, ayumi: catNominal - half, recipient: 'Keduanya (50:50)' };
    }
    // Jika tidak dicentang keduanya, default 50:50
    const half = Math.round(catNominal / 2);
    return { takumi: half, ayumi: catNominal - half, recipient: 'Bersama (50:50)' };
  }

  const takumiCatSplit = splitCategory(
    takumiNominal,
    contrib.takumi ? contrib.takumi.takumi : true,
    contrib.takumi ? contrib.takumi.ayumi : false
  );
  const salesSplit = splitCategory(salesNominal, contrib.sales?.takumi, contrib.sales?.ayumi);
  const adminTaxSplit = splitCategory(adminTaxNominal, contrib.adminTax?.takumi, contrib.adminTax?.ayumi);
  const freelanceSplit = splitCategory(freelanceNominal, contrib.freelance?.takumi, contrib.freelance?.ayumi);

  const totalTakumi = takumiCatSplit.takumi + salesSplit.takumi + adminTaxSplit.takumi + freelanceSplit.takumi;
  const totalAyumi = takumiCatSplit.ayumi + salesSplit.ayumi + adminTaxSplit.ayumi + freelanceSplit.ayumi;

  const takumiPercent = billedAmount > 0 ? ((totalTakumi / billedAmount) * 100) : 0;
  const ayumiPercent = billedAmount > 0 ? ((totalAyumi / billedAmount) * 100) : 0;

  return {
    billedAmount,
    percentages: pct,
    takumiNominal,
    salesNominal,
    adminTaxNominal,
    freelanceNominal,
    takumiCatSplit,
    salesSplit,
    adminTaxSplit,
    freelanceSplit,
    totalTakumi,
    totalAyumi,
    takumiPercent,
    ayumiPercent
  };
}

/**
 * Render Tabel Kerjasama & KPI Metrics
 */
function renderPartnershipsTable() {
  const tbody = document.getElementById('table-partnerships-body');
  if (!tbody) return;

  const allItems = Array.isArray(state.partnerships) ? state.partnerships : [];
  const activePct = getPartnershipPercentages();

  // Update KPI card badges for percentages
  const pctTakumiBadge = document.getElementById('kpi-pct-takumi-badge');
  const pctSalesBadge = document.getElementById('kpi-pct-sales-badge');
  const pctAdminBadge = document.getElementById('kpi-pct-admin-badge');
  const pctFreelanceBadge = document.getElementById('kpi-pct-freelance-badge');
  const badgeCount = document.getElementById('badge-partnership-count');

  if (pctTakumiBadge) pctTakumiBadge.textContent = `${activePct.takumi}%`;
  if (pctSalesBadge) pctSalesBadge.textContent = `${activePct.sales}%`;
  if (pctAdminBadge) pctAdminBadge.textContent = `${activePct.adminTax}%`;
  if (pctFreelanceBadge) pctFreelanceBadge.textContent = `${activePct.freelance}%`;
  if (badgeCount) badgeCount.textContent = allItems.length;

  // Calculate Overall Totals
  let totalBilledAll = 0;
  let totalTakumiAll = 0;
  let totalAyumiAll = 0;

  const calculatedItems = allItems.map(item => {
    const calc = calculatePartnershipSplit(item, item.percentages || activePct);
    totalBilledAll += calc.billedAmount;
    totalTakumiAll += calc.totalTakumi;
    totalAyumiAll += calc.totalAyumi;
    return { ...item, calc };
  });

  const overallTakumiPct = totalBilledAll > 0 ? ((totalTakumiAll / totalBilledAll) * 100) : 0;
  const overallAyumiPct = totalBilledAll > 0 ? ((totalAyumiAll / totalBilledAll) * 100) : 0;

  // Update KPI cards
  const kpiBilled = document.getElementById('kpi-partnership-total-billed');
  const kpiCount = document.getElementById('kpi-partnership-total-count');
  const kpiTakumiTotal = document.getElementById('kpi-partnership-takumi-total');
  const kpiTakumiPct = document.getElementById('kpi-partnership-takumi-pct');
  const kpiAyumiTotal = document.getElementById('kpi-partnership-ayumi-total');
  const kpiAyumiPct = document.getElementById('kpi-partnership-ayumi-pct');

  if (kpiBilled) kpiBilled.textContent = formatRupiah(totalBilledAll);
  if (kpiCount) kpiCount.textContent = `${allItems.length} Kontrak / Layanan`;
  if (kpiTakumiTotal) kpiTakumiTotal.textContent = formatRupiah(totalTakumiAll);
  if (kpiTakumiPct) kpiTakumiPct.textContent = `${overallTakumiPct.toFixed(1)}%`;
  if (kpiAyumiTotal) kpiAyumiTotal.textContent = formatRupiah(totalAyumiAll);
  if (kpiAyumiPct) kpiAyumiPct.textContent = `${overallAyumiPct.toFixed(1)}%`;

  // Filter items
  const statusFilter = (document.getElementById('filter-partnership-status')?.value || 'ALL').trim();
  const searchFilter = (document.getElementById('filter-partnership-search')?.value || '').trim().toLowerCase();

  let filtered = calculatedItems.filter(item => {
    if (statusFilter !== 'ALL' && item.paymentStatus !== statusFilter) {
      return false;
    }
    if (searchFilter) {
      const match = (
        (item.id || '').toLowerCase().includes(searchFilter) ||
        (item.serviceName || '').toLowerCase().includes(searchFilter) ||
        (item.clientName || '').toLowerCase().includes(searchFilter) ||
        (item.invoiceRef || '').toLowerCase().includes(searchFilter)
      );
      if (!match) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #ecfdf5; display: flex; align-items: center; justify-content: center; color: #059669;">
              <i data-lucide="handshake" style="width: 26px; height: 26px;"></i>
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">Belum Ada Data Kerjasama</div>
            <div style="font-size: 12px; max-width: 420px; line-height: 1.5; color: #64748b;">
              Mulai catat transaksi layanan kerjasama dan hitung bagi hasil proporsional antara Takumi dan Ayumi dengan mudah.
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="openPartnershipModal()" style="margin-top: 6px;">
              <i data-lucide="plus-circle"></i> Tambah Kerjasama Pertama
            </button>
          </div>
        </td>
      </tr>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const calc = item.calc;
    const c = item.contributions || {};

    // Helper badge for party
    function renderPartyBadge(takumi, ayumi) {
      if (takumi && !ayumi) {
        return `<span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 700; padding: 2px 6px;">Takumi</span>`;
      }
      if (!takumi && ayumi) {
        return `<span class="badge" style="background: #d1fae5; color: #065f46; font-size: 10px; font-weight: 700; padding: 2px 6px;">Ayumi</span>`;
      }
      if (takumi && ayumi) {
        return `<span class="badge" style="background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; padding: 2px 6px;">50:50</span>`;
      }
      return `<span class="badge badge-secondary" style="font-size: 10px;">-</span>`;
    }

    let statusBadge = '<span class="badge badge-secondary">Menunggu</span>';
    if (item.paymentStatus === 'Lunas') {
      statusBadge = '<span class="badge badge-success">Lunas</span>';
    } else if (item.paymentStatus === 'Sebagian') {
      statusBadge = '<span class="badge badge-amber">Sebagian</span>';
    }

    return `
      <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
        <td class="font-mono font-bold" style="font-size: 12px; color: #2563eb;">
          ${escapeHtml(item.id || '-')}
          ${item.invoiceRef ? `<div class="text-muted" style="font-size: 10.5px; font-weight: normal;">Ref: ${escapeHtml(item.invoiceRef)}</div>` : ''}
        </td>
        <td style="font-size: 12px; color: #475569;">
          ${escapeHtml(item.date || '-')}
        </td>
        <td>
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${escapeHtml(item.serviceName || '-')}</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 1px;">
            Klien: <strong>${escapeHtml(item.clientName || '-')}</strong>
          </div>
        </td>
        <td style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 13px; color: #0f172a;">${formatRupiah(calc.billedAmount)}</div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #4338ca; font-weight: 600;">Takumi (${calc.percentages.takumi}%):</span>
              ${renderPartyBadge(c.takumi ? c.takumi.takumi : true, c.takumi ? c.takumi.ayumi : false)}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">Sales (${calc.percentages.sales}%):</span>
              ${renderPartyBadge(c.sales?.takumi, c.sales?.ayumi)}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">Admin & Pajak (${calc.percentages.adminTax}%):</span>
              ${renderPartyBadge(c.adminTax?.takumi, c.adminTax?.ayumi)}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">Freelance (${calc.percentages.freelance}%):</span>
              ${renderPartyBadge(c.freelance?.takumi, c.freelance?.ayumi)}
            </div>
          </div>
        </td>
        <td style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 13px; color: #4338ca;">${formatRupiah(calc.totalTakumi)}</div>
          <div style="font-size: 10.5px; color: #6366f1; font-weight: 700;">${calc.takumiPercent.toFixed(1)}%</div>
        </td>
        <td style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 13px; color: #065f46;">${formatRupiah(calc.totalAyumi)}</div>
          <div style="font-size: 10.5px; color: #10b981; font-weight: 700;">${calc.ayumiPercent.toFixed(1)}%</div>
        </td>
        <td style="text-align: center;">
          ${statusBadge}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button type="button" class="btn btn-sm btn-outline" style="padding: 4px 7px; color: #0284c7; border-color: #bae6fd; background: #f0f9ff;" onclick="previewPartnershipSlip('${item.id}')" title="Cetak Slip Bagi Hasil Resmi">
              <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline" style="padding: 4px 7px; color: #2563eb; border-color: #bfdbfe; background: #eff6ff;" onclick="openPartnershipModal('${item.id}')" title="Edit Data Kerjasama">
              <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger" style="padding: 4px 7px;" onclick="deletePartnership('${item.id}')" title="Hapus Data">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Filter handler
 */
function filterPartnershipTable() {
  renderPartnershipsTable();
}

/**
 * Buka modal tambah / edit kerjasama
 */
function openPartnershipModal(id) {
  const modal = document.getElementById('modal-partnership-form');
  if (!modal) return;

  const activePct = getPartnershipPercentages();
  const titleEl = document.getElementById('partnership-modal-title');
  const idInput = document.getElementById('partnership-id');
  const dateInput = document.getElementById('partnership-date');
  const statusSelect = document.getElementById('partnership-payment-status');
  const serviceInput = document.getElementById('partnership-service-name');
  const clientInput = document.getElementById('partnership-client-name');
  const billedInput = document.getElementById('partnership-billed-amount');
  const invRefInput = document.getElementById('partnership-invoice-ref');
  const notesInput = document.getElementById('partnership-notes');

  // Checkboxes
  const cbTakumiTakumi = document.getElementById('cb-takumi-takumi');
  const cbTakumiAyumi = document.getElementById('cb-takumi-ayumi');
  const cbSalesTakumi = document.getElementById('cb-sales-takumi');
  const cbSalesAyumi = document.getElementById('cb-sales-ayumi');
  const cbAdminTakumi = document.getElementById('cb-admin-takumi');
  const cbAdminAyumi = document.getElementById('cb-admin-ayumi');
  const cbFreelanceTakumi = document.getElementById('cb-freelance-takumi');
  const cbFreelanceAyumi = document.getElementById('cb-freelance-ayumi');

  if (id) {
    const item = (state.partnerships || []).find(p => p.id === id);
    if (!item) {
      showToast('Data kerjasama tidak ditemukan', 'error');
      return;
    }
    if (titleEl) titleEl.textContent = `Edit Data Kerjasama (${item.id})`;
    idInput.value = item.id;
    dateInput.value = item.date || new Date().toISOString().split('T')[0];
    statusSelect.value = item.paymentStatus || 'Lunas';
    serviceInput.value = item.serviceName || '';
    clientInput.value = item.clientName || '';
    billedInput.value = item.billedAmount || '';
    invRefInput.value = item.invoiceRef || '';
    notesInput.value = item.notes || '';

    const c = item.contributions || {};
    if (cbTakumiTakumi) cbTakumiTakumi.checked = c.takumi ? !!c.takumi.takumi : true;
    if (cbTakumiAyumi) cbTakumiAyumi.checked = c.takumi ? !!c.takumi.ayumi : false;
    if (cbSalesTakumi) cbSalesTakumi.checked = c.sales ? !!c.sales.takumi : true;
    if (cbSalesAyumi) cbSalesAyumi.checked = c.sales ? !!c.sales.ayumi : false;
    if (cbAdminTakumi) cbAdminTakumi.checked = c.adminTax ? !!c.adminTax.takumi : false;
    if (cbAdminAyumi) cbAdminAyumi.checked = c.adminTax ? !!c.adminTax.ayumi : true;
    if (cbFreelanceTakumi) cbFreelanceTakumi.checked = c.freelance ? !!c.freelance.takumi : true;
    if (cbFreelanceAyumi) cbFreelanceAyumi.checked = c.freelance ? !!c.freelance.ayumi : false;
  } else {
    if (titleEl) titleEl.textContent = 'Tambah Data Kerjasama & Bagi Hasil';
    idInput.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    statusSelect.value = 'Lunas';
    serviceInput.value = '';
    clientInput.value = '';
    billedInput.value = '';
    invRefInput.value = '';
    notesInput.value = '';

    // Standard initial defaults: Takumi (Takumi), Sales (Takumi), Admin (Ayumi), Freelance (Takumi)
    if (cbTakumiTakumi) cbTakumiTakumi.checked = true;
    if (cbTakumiAyumi) cbTakumiAyumi.checked = false;
    if (cbSalesTakumi) cbSalesTakumi.checked = true;
    if (cbSalesAyumi) cbSalesAyumi.checked = false;
    if (cbAdminTakumi) cbAdminTakumi.checked = false;
    if (cbAdminAyumi) cbAdminAyumi.checked = true;
    if (cbFreelanceTakumi) cbFreelanceTakumi.checked = true;
    if (cbFreelanceAyumi) cbFreelanceAyumi.checked = false;
  }

  // Update % badges in modal
  const pctTakumiBadge = document.getElementById('modal-pct-takumi');
  const pctSalesBadge = document.getElementById('modal-pct-sales');
  const pctAdminBadge = document.getElementById('modal-pct-admin');
  const pctFreelanceBadge = document.getElementById('modal-pct-freelance');

  if (pctTakumiBadge) pctTakumiBadge.textContent = `${activePct.takumi}%`;
  if (pctSalesBadge) pctSalesBadge.textContent = `${activePct.sales}%`;
  if (pctAdminBadge) pctAdminBadge.textContent = `${activePct.adminTax}%`;
  if (pctFreelanceBadge) pctFreelanceBadge.textContent = `${activePct.freelance}%`;

  updatePartnershipModalPreview();
  openModal('modal-partnership-form');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Update perhitungan real-time di dalam formulir modal (Takumi + Sales + Admin + Freelance = 100%)
 */
function updatePartnershipModalPreview() {
  const billedInput = document.getElementById('partnership-billed-amount');
  const billedVal = parseFloat(billedInput?.value || 0) || 0;
  const activePct = getPartnershipPercentages();

  const formattedBilled = document.getElementById('partnership-billed-formatted');
  if (formattedBilled) formattedBilled.textContent = formatRupiah(billedVal);

  const amtTakumiEl = document.getElementById('modal-amt-takumi');
  const amtSalesEl = document.getElementById('modal-amt-sales');
  const amtAdminEl = document.getElementById('modal-amt-admin');
  const amtFreelanceEl = document.getElementById('modal-amt-freelance');

  const takumiNominal = Math.round(billedVal * (activePct.takumi / 100));
  const salesNominal = Math.round(billedVal * (activePct.sales / 100));
  const adminNominal = Math.round(billedVal * (activePct.adminTax / 100));
  const freelanceNominal = Math.round(billedVal * (activePct.freelance / 100));

  if (amtTakumiEl) amtTakumiEl.textContent = formatRupiah(takumiNominal);
  if (amtSalesEl) amtSalesEl.textContent = formatRupiah(salesNominal);
  if (amtAdminEl) amtAdminEl.textContent = formatRupiah(adminNominal);
  if (amtFreelanceEl) amtFreelanceEl.textContent = formatRupiah(freelanceNominal);

  const mockEntry = {
    billedAmount: billedVal,
    percentages: activePct,
    contributions: {
      takumi: {
        takumi: document.getElementById('cb-takumi-takumi')?.checked,
        ayumi: document.getElementById('cb-takumi-ayumi')?.checked
      },
      sales: {
        takumi: document.getElementById('cb-sales-takumi')?.checked,
        ayumi: document.getElementById('cb-sales-ayumi')?.checked
      },
      adminTax: {
        takumi: document.getElementById('cb-admin-takumi')?.checked,
        ayumi: document.getElementById('cb-admin-ayumi')?.checked
      },
      freelance: {
        takumi: document.getElementById('cb-freelance-takumi')?.checked,
        ayumi: document.getElementById('cb-freelance-ayumi')?.checked
      }
    }
  };

  const calc = calculatePartnershipSplit(mockEntry, activePct);

  const valTakumiEl = document.getElementById('preview-val-takumi');
  const pctTakumiEl = document.getElementById('preview-pct-takumi');
  const valAyumiEl = document.getElementById('preview-val-ayumi');
  const pctAyumiEl = document.getElementById('preview-pct-ayumi');

  if (valTakumiEl) valTakumiEl.textContent = formatRupiah(calc.totalTakumi);
  if (pctTakumiEl) pctTakumiEl.textContent = `${calc.takumiPercent.toFixed(1)}% dari Tagihan`;
  if (valAyumiEl) valAyumiEl.textContent = formatRupiah(calc.totalAyumi);
  if (pctAyumiEl) pctAyumiEl.textContent = `${calc.ayumiPercent.toFixed(1)}% dari Tagihan`;
}

/**
 * Menyimpan data kerjasama ke database lokal dan Supabase
 */
async function savePartnership(event) {
  if (event) event.preventDefault();

  const id = (document.getElementById('partnership-id')?.value || '').trim();
  const date = (document.getElementById('partnership-date')?.value || '').trim();
  const paymentStatus = document.getElementById('partnership-payment-status')?.value || 'Lunas';
  const serviceName = (document.getElementById('partnership-service-name')?.value || '').trim();
  const clientName = (document.getElementById('partnership-client-name')?.value || '').trim();
  const billedAmount = parseFloat(document.getElementById('partnership-billed-amount')?.value || 0) || 0;
  const invoiceRef = (document.getElementById('partnership-invoice-ref')?.value || '').trim();
  const notes = (document.getElementById('partnership-notes')?.value || '').trim();

  if (!serviceName || !clientName) {
    showToast('Nama layanan dan perusahaan mitra wajib diisi', 'error');
    return;
  }
  if (billedAmount <= 0) {
    showToast('Nilai tagihan perusahaan harus lebih dari 0', 'error');
    return;
  }

  const activePct = getPartnershipPercentages();
  const contributions = {
    takumi: {
      takumi: !!document.getElementById('cb-takumi-takumi')?.checked,
      ayumi: !!document.getElementById('cb-takumi-ayumi')?.checked
    },
    sales: {
      takumi: !!document.getElementById('cb-sales-takumi')?.checked,
      ayumi: !!document.getElementById('cb-sales-ayumi')?.checked
    },
    adminTax: {
      takumi: !!document.getElementById('cb-admin-takumi')?.checked,
      ayumi: !!document.getElementById('cb-admin-ayumi')?.checked
    },
    freelance: {
      takumi: !!document.getElementById('cb-freelance-takumi')?.checked,
      ayumi: !!document.getElementById('cb-freelance-ayumi')?.checked
    }
  };

  const payload = {
    date,
    paymentStatus,
    serviceName,
    clientName,
    billedAmount,
    invoiceRef,
    percentages: activePct,
    contributions,
    notes,
    updated_at: new Date().toISOString()
  };

  try {
    let savedItem = null;
    if (id) {
      payload.id = id;
      const res = await fetch(`/api/partnerships/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      savedItem = await res.json();
    } else {
      const res = await fetch('/api/partnerships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      savedItem = await res.json();
    }

    // Update state.partnerships locally
    state.partnerships = state.partnerships || [];
    const idx = state.partnerships.findIndex(p => p.id === savedItem.id);
    if (idx !== -1) {
      state.partnerships[idx] = savedItem;
    } else {
      state.partnerships.unshift(savedItem);
    }

    // Persist to direct Supabase Cloud Store for instant multi-device & Netlify sync
    if (typeof directSupabaseSyncPartnerships === 'function') {
      directSupabaseSyncPartnerships(state.partnerships).catch(e => console.warn(e));
    }
    try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify(state.partnerships)); } catch (e) {}

    closeModal('modal-partnership-form');
    showToast(`✅ Data kerjasama ${savedItem.id} berhasil disimpan!`, 'success');
    renderPartnershipsTable();
  } catch (err) {
    console.error('Error saving partnership:', err);
    // Fallback: save to state locally and sync directly to Supabase
    const fallbackId = id || `KSM-${Date.now().toString().slice(-6)}`;
    payload.id = fallbackId;
    state.partnerships = state.partnerships || [];
    const idx = state.partnerships.findIndex(p => p.id === fallbackId);
    if (idx !== -1) {
      state.partnerships[idx] = payload;
    } else {
      state.partnerships.unshift(payload);
    }
    if (typeof directSupabaseSyncPartnerships === 'function') {
      directSupabaseSyncPartnerships(state.partnerships).catch(() => {});
    }
    try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify(state.partnerships)); } catch (e) {}
    closeModal('modal-partnership-form');
    showToast(`✅ Data kerjasama disimpan (Direct Cloud Store)`, 'success');
    renderPartnershipsTable();
  }
}

/**
 * Menghapus data kerjasama
 */
async function deletePartnership(id) {
  if (!confirm(`Hapus data kerjasama dengan nomor: ${id}?`)) return;

  try {
    await fetch(`/api/partnerships/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('API delete notice:', err.message);
  }

  state.partnerships = (state.partnerships || []).filter(p => p.id !== id);
  if (typeof directSupabaseSyncPartnerships === 'function') {
    directSupabaseSyncPartnerships(state.partnerships).catch(() => {});
  }
  try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify(state.partnerships)); } catch (e) {}

  showToast('Data kerjasama berhasil dihapus', 'info');
  renderPartnershipsTable();
}

/**
 * Hapus semua data kerjasama
 */
async function clearAllPartnershipData() {
  if (!confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA data kerjasama dan bagi hasil?')) return;
  if (!confirm('Konfirmasi terakhir: Seluruh riwayat perhitungan bagi hasil akan dihapus permanen. Lanjutkan?')) return;

  const currentList = [...(state.partnerships || [])];
  for (const item of currentList) {
    try {
      await fetch(`/api/partnerships/${item.id}`, { method: 'DELETE' });
    } catch (e) {}
  }

  state.partnerships = [];
  if (typeof directSupabaseSyncPartnerships === 'function') {
    directSupabaseSyncPartnerships([]).catch(() => {});
  }
  try { localStorage.setItem('ubm_cached_partnerships', JSON.stringify([])); } catch (e) {}

  showToast('Semua data kerjasama berhasil dibersihkan', 'success');
  renderPartnershipsTable();
}

/**
 * Modal Pengaturan Persentase Pembagian (Takumi, Sales, Admin & Pajak, Freelance)
 */
function openPartnershipSettingsModal() {
  const currentPct = getPartnershipPercentages();
  const tInput = document.getElementById('setting-pct-takumi');
  const sInput = document.getElementById('setting-pct-sales');
  const aInput = document.getElementById('setting-pct-admin');
  const fInput = document.getElementById('setting-pct-freelance');

  if (tInput) tInput.value = currentPct.takumi;
  if (sInput) sInput.value = currentPct.sales;
  if (aInput) aInput.value = currentPct.adminTax;
  if (fInput) fInput.value = currentPct.freelance;

  recalculateSettingPercentages();
  openModal('modal-partnership-settings');
}

/**
 * Hitung live total persentase pada formulir pengaturan (Harus tepat 100%)
 */
function recalculateSettingPercentages() {
  const takumi = parseInt(document.getElementById('setting-pct-takumi')?.value || 0, 10) || 0;
  const sales = parseInt(document.getElementById('setting-pct-sales')?.value || 0, 10) || 0;
  const admin = parseInt(document.getElementById('setting-pct-admin')?.value || 0, 10) || 0;
  const freelance = parseInt(document.getElementById('setting-pct-freelance')?.value || 0, 10) || 0;

  const bTakumi = document.getElementById('badge-setting-pct-takumi');
  const bSales = document.getElementById('badge-setting-pct-sales');
  const bAdmin = document.getElementById('badge-setting-pct-admin');
  const bFreelance = document.getElementById('badge-setting-pct-freelance');

  if (bTakumi) bTakumi.textContent = `${takumi}%`;
  if (bSales) bSales.textContent = `${sales}%`;
  if (bAdmin) bAdmin.textContent = `${admin}%`;
  if (bFreelance) bFreelance.textContent = `${freelance}%`;

  const total = takumi + sales + admin + freelance;

  const totalEl = document.getElementById('setting-pct-total');
  const statusEl = document.getElementById('setting-pct-status-badge');
  const errEl = document.getElementById('setting-pct-error');
  const btnSave = document.getElementById('btn-save-partnership-settings');

  if (totalEl) totalEl.textContent = `${total}%`;

  if (total === 100) {
    if (totalEl) totalEl.style.color = '#059669';
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = '✅ Total pembagian tepat 100%';
      statusEl.style.color = '#059669';
    }
    if (errEl) errEl.style.display = 'none';
    if (btnSave) btnSave.disabled = false;
  } else {
    if (totalEl) totalEl.style.color = '#dc2626';
    if (statusEl) statusEl.style.display = 'none';
    if (errEl) {
      errEl.style.display = 'block';
      const diff = total > 100 ? `Kelebihan ${total - 100}%` : `Kekurangan ${100 - total}%`;
      errEl.textContent = `⚠️ Total persentase harus tepat 100%! (Saat ini: ${total}%, ${diff})`;
    }
    if (btnSave) btnSave.disabled = true;
  }
}

/**
 * Menyimpan pengaturan persentase ke database & local store
 */
async function savePartnershipSettings(event) {
  if (event) event.preventDefault();

  const takumi = parseInt(document.getElementById('setting-pct-takumi')?.value || 0, 10) || 0;
  const sales = parseInt(document.getElementById('setting-pct-sales')?.value || 0, 10) || 0;
  const adminTax = parseInt(document.getElementById('setting-pct-admin')?.value || 0, 10) || 0;
  const freelance = parseInt(document.getElementById('setting-pct-freelance')?.value || 0, 10) || 0;

  const total = takumi + sales + adminTax + freelance;
  if (total !== 100) {
    showToast(`Total persentase harus tepat 100% (saat ini: ${total}%)`, 'error');
    return;
  }

  const newPercentages = { takumi, sales, adminTax, freelance };

  state.settings = state.settings || {};
  state.settings.partnershipPercentages = newPercentages;

  try {
    localStorage.setItem('ubm_partnership_percentages', JSON.stringify(newPercentages));
  } catch (e) {}

  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.settings)
    });
  } catch (e) {
    console.warn('API settings save notice:', e.message);
  }

  closeModal('modal-partnership-settings');
  showToast('✅ Pengaturan persentase bagi hasil (100%) berhasil disimpan!', 'success');
  renderPartnershipsTable();
}

/**
 * Reset persentase ke nilai default (Takumi: 20%, Sales: 20%, Admin: 15%, Freelance: 45% = 100%)
 */
function resetPartnershipPercentagesToDefault() {
  if (!confirm('Kembalikan persentase bagi hasil ke pengaturan default (Takumi: 20%, Sales: 20%, Admin & Pajak: 15%, Freelance: 45% = Total 100%)?')) return;

  const tInput = document.getElementById('setting-pct-takumi');
  const sInput = document.getElementById('setting-pct-sales');
  const aInput = document.getElementById('setting-pct-admin');
  const fInput = document.getElementById('setting-pct-freelance');

  if (tInput) tInput.value = DEFAULT_PARTNERSHIP_PERCENTAGES.takumi;
  if (sInput) sInput.value = DEFAULT_PARTNERSHIP_PERCENTAGES.sales;
  if (aInput) aInput.value = DEFAULT_PARTNERSHIP_PERCENTAGES.adminTax;
  if (fInput) fInput.value = DEFAULT_PARTNERSHIP_PERCENTAGES.freelance;

  recalculateSettingPercentages();
}

/**
 * Pratinjau / Cetak Slip Resmi Bagi Hasil Kerjasama (Takumi & Ayumi)
 */
function previewPartnershipSlip(id) {
  const item = (state.partnerships || []).find(p => p.id === id);
  if (!item) {
    showToast('Data kerjasama tidak ditemukan', 'error');
    return;
  }

  const calc = calculatePartnershipSplit(item, item.percentages);
  const compSettings = state.settings || {};
  const c = item.contributions || {};

  const modal = document.getElementById('preview-modal');
  const modalContent = document.getElementById('preview-modal-content') || document.getElementById('preview-modal-body');

  function getPartyLabel(takumi, ayumi) {
    if (takumi && !ayumi) return 'Politeknik Takumi (100%)';
    if (!takumi && ayumi) return 'PT Ayumi (100%)';
    if (takumi && ayumi) return 'Takumi (50%) & Ayumi (50%)';
    return 'Bersama (50:50)';
  }

  modalContent.innerHTML = `
    <div style="max-width: 820px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; font-family: 'Inter', system-ui, sans-serif; color: #0f172a;">
      <!-- SLIP HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #2563eb; letter-spacing: 1px; text-transform: uppercase;">
            UNIVERSAL BUSINESS MANAGEMENT (UBM)
          </div>
          <h2 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">
            SLIP BUKTI BAGI HASIL KERJASAMA
          </h2>
          <div style="font-size: 12px; color: #475569; margin-top: 3px;">
            Kemitraan Strategis: <strong>Politeknik Takumi</strong> & <strong>PT Ayumi</strong>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="font-mono font-bold" style="font-size: 15px; color: #2563eb;">${escapeHtml(item.id)}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Tanggal: <strong>${escapeHtml(item.date || '-')}</strong></div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            Status: <span class="badge ${item.paymentStatus === 'Lunas' ? 'badge-success' : 'badge-amber'}" style="font-size: 10px; padding: 2px 7px;">${escapeHtml(item.paymentStatus)}</span>
          </div>
        </div>
      </div>

      <!-- PROYEK / LAYANAN INFO -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Layanan / Proyek Kerjasama:</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(item.serviceName)}</div>
          ${item.invoiceRef ? `<div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">No. Invoice: <span class="font-mono text-primary">${escapeHtml(item.invoiceRef)}</span></div>` : ''}
        </div>
        <div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Perusahaan Mitra / Klien:</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(item.clientName)}</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">Total Tagihan Kontrak: <strong class="font-mono text-primary font-bold">${formatRupiah(calc.billedAmount)}</strong></div>
        </div>
      </div>

      <!-- TABEL RINCIAN PEMBAGIAN KONTRIBUSI -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12.5px;">
        <thead>
          <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 10px 12px; text-align: left;">Kategori Kontribusi</th>
            <th style="padding: 10px 12px; text-align: center; width: 60px;">Porsi</th>
            <th style="padding: 10px 12px; text-align: right; width: 130px;">Nilai Alokasi</th>
            <th style="padding: 10px 12px; text-align: left; width: 170px;">Pihak Berhak</th>
            <th style="padding: 10px 12px; text-align: right; width: 125px; color: #4338ca;">Hak Takumi</th>
            <th style="padding: 10px 12px; text-align: right; width: 125px; color: #065f46;">Hak Ayumi</th>
          </tr>
        </thead>
        <tbody>
          <!-- 1. TAKUMI -->
          <tr style="border-bottom: 1px solid #e2e8f0; background: #faf5ff;">
            <td style="padding: 10px 12px; font-weight: 700; color: #4338ca;">
              1. Alokasi Takumi
            </td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${calc.percentages.takumi}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.takumiNominal)}</td>
            <td style="padding: 10px 12px;">${getPartyLabel(c.takumi ? c.takumi.takumi : true, c.takumi ? c.takumi.ayumi : false)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca;" class="font-mono">${formatRupiah(calc.takumiCatSplit.takumi)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #065f46;" class="font-mono">${formatRupiah(calc.takumiCatSplit.ayumi)}</td>
          </tr>
          <!-- 2. SALES -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 700;">
              2. Sales / Pemasaran & Penjualan
            </td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${calc.percentages.sales}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.salesNominal)}</td>
            <td style="padding: 10px 12px;">${getPartyLabel(c.sales?.takumi, c.sales?.ayumi)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca;" class="font-mono">${formatRupiah(calc.salesSplit.takumi)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #065f46;" class="font-mono">${formatRupiah(calc.salesSplit.ayumi)}</td>
          </tr>
          <!-- 3. ADMIN & PAJAK -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 700;">
              3. Administrasi & Perpajakan
            </td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${calc.percentages.adminTax}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.adminTaxNominal)}</td>
            <td style="padding: 10px 12px;">${getPartyLabel(c.adminTax?.takumi, c.adminTax?.ayumi)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca;" class="font-mono">${formatRupiah(calc.adminTaxSplit.takumi)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #065f46;" class="font-mono">${formatRupiah(calc.adminTaxSplit.ayumi)}</td>
          </tr>
          <!-- 4. FREELANCE -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 700;">
              4. Freelance (Tenaga Ahli & Pelaksana)
            </td>
            <td style="padding: 10px 12px; text-align: center;" class="font-mono">${calc.percentages.freelance}%</td>
            <td style="padding: 10px 12px; text-align: right;" class="font-mono">${formatRupiah(calc.freelanceNominal)}</td>
            <td style="padding: 10px 12px;">${getPartyLabel(c.freelance?.takumi, c.freelance?.ayumi)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #4338ca;" class="font-mono">${formatRupiah(calc.freelanceSplit.takumi)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #065f46;" class="font-mono">${formatRupiah(calc.freelanceSplit.ayumi)}</td>
          </tr>
          <!-- TOTAL ROW -->
          <tr style="background: #f8fafc; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 13px;">
            <td colspan="2" style="padding: 12px; font-weight: 800; text-transform: uppercase;">
              TOTAL NILAI TAGIHAN (100%)
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 800;" class="font-mono">
              ${formatRupiah(calc.billedAmount)}
            </td>
            <td style="padding: 12px; font-weight: 700;">
              Total Bagi Hasil
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 800; color: #4338ca; font-size: 14px;" class="font-mono">
              ${formatRupiah(calc.totalTakumi)}
              <div style="font-size: 10.5px; font-weight: 600; color: #6366f1;">(${calc.takumiPercent.toFixed(1)}%)</div>
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 800; color: #065f46; font-size: 14px;" class="font-mono">
              ${formatRupiah(calc.totalAyumi)}
              <div style="font-size: 10.5px; font-weight: 600; color: #10b981;">(${calc.ayumiPercent.toFixed(1)}%)</div>
            </td>
          </tr>
        </tbody>
      </table>

      ${item.notes ? `
        <div style="background: #f1f5f9; border-radius: 6px; padding: 10px 14px; font-size: 11.5px; color: #475569; margin-bottom: 24px;">
          <strong>Catatan:</strong> ${escapeHtml(item.notes)}
        </div>
      ` : ''}

      <!-- SIGNATURE SECTION -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding-top: 10px;">
        <div style="text-align: center;">
          <div style="font-size: 12px; font-weight: 700; color: #4338ca;">PIHAK I (POLITEKNIK TAKUMI)</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Hak Bagi Hasil: ${formatRupiah(calc.totalTakumi)}</div>
          <div style="height: 60px;"></div>
          <div style="font-weight: 800; font-size: 13px; text-decoration: underline;">( Perwakilan Politeknik Takumi )</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Tanggal: ___________________</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 12px; font-weight: 700; color: #065f46;">PIHAK II (PT AYUMI)</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Hak Bagi Hasil: ${formatRupiah(calc.totalAyumi)}</div>
          <div style="height: 60px;"></div>
          <div style="font-weight: 800; font-size: 13px; text-decoration: underline;">( Perwakilan PT Ayumi )</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Tanggal: ___________________</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Ekspor Data Kerjasama ke CSV
 */
function exportPartnershipCSV() {
  const items = Array.isArray(state.partnerships) ? state.partnerships : [];
  if (items.length === 0) {
    showToast('Tidak ada data kerjasama untuk diekspor', 'warning');
    return;
  }

  const activePct = getPartnershipPercentages();
  const headers = [
    'No. Kerjasama',
    'Tanggal',
    'Nama Layanan',
    'Perusahaan Mitra (Klien)',
    'No. Ref Invoice',
    'Tagihan Perusahaan (Rp)',
    'Kontribusi Takumi',
    'Kontribusi Sales',
    'Kontribusi Admin & Pajak',
    'Kontribusi Freelance',
    'Hak Takumi (Rp)',
    'Hak Takumi (%)',
    'Hak Ayumi (Rp)',
    'Hak Ayumi (%)',
    'Status Pembayaran',
    'Catatan'
  ];

  function getPartyText(takumi, ayumi) {
    if (takumi && !ayumi) return 'Takumi';
    if (!takumi && ayumi) return 'Ayumi';
    if (takumi && ayumi) return 'Takumi & Ayumi (50:50)';
    return 'Bersama (50:50)';
  }

  const rows = items.map(it => {
    const calc = calculatePartnershipSplit(it, it.percentages || activePct);
    const c = it.contributions || {};
    return [
      it.id || '',
      it.date || '',
      `"${(it.serviceName || '').replace(/"/g, '""')}"`,
      `"${(it.clientName || '').replace(/"/g, '""')}"`,
      `"${(it.invoiceRef || '').replace(/"/g, '""')}"`,
      calc.billedAmount,
      getPartyText(c.takumi ? c.takumi.takumi : true, c.takumi ? c.takumi.ayumi : false),
      getPartyText(c.sales?.takumi, c.sales?.ayumi),
      getPartyText(c.adminTax?.takumi, c.adminTax?.ayumi),
      getPartyText(c.freelance?.takumi, c.freelance?.ayumi),
      calc.totalTakumi,
      calc.takumiPercent.toFixed(1),
      calc.totalAyumi,
      calc.ayumiPercent.toFixed(1),
      it.paymentStatus || 'Lunas',
      `"${(it.notes || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UBM_KERJASAMA_TAKUMI_AYUMI_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Data Kerjasama berhasil diekspor ke CSV!', 'success');
}

// Global window exposure
window.getProjectFinancialData = getProjectFinancialData;
window.renderFinanceTable = renderFinanceTable;
window.filterFinanceTable = filterFinanceTable;
window.deleteProjectFinanceRow = deleteProjectFinanceRow;
window.clearAllProjectFinanceData = clearAllProjectFinanceData;
window.openProjectFinanceDetailModal = openProjectFinanceDetailModal;
window.openAdjustProjectModalCostModal = openAdjustProjectModalCostModal;
window.recalculateModalCostAdjustForm = recalculateModalCostAdjustForm;
window.saveAdjustProjectModalCost = saveAdjustProjectModalCost;
window.printProjectFinanceReport = printProjectFinanceReport;
window.exportFinanceToCSV = exportFinanceToCSV;
// Aliases for compatibility
window.renderServiceFinanceTable = renderFinanceTable;
window.filterServiceFinanceTable = filterFinanceTable;
window.exportServiceFinanceToCSV = exportFinanceToCSV;

// Kerjasama Module Exposures
window.switchFinanceTab = switchFinanceTab;
window.getPartnershipPercentages = getPartnershipPercentages;
window.calculatePartnershipSplit = calculatePartnershipSplit;
window.renderPartnershipsTable = renderPartnershipsTable;
window.filterPartnershipTable = filterPartnershipTable;
window.openPartnershipModal = openPartnershipModal;
window.updatePartnershipModalPreview = updatePartnershipModalPreview;
window.savePartnership = savePartnership;
window.deletePartnership = deletePartnership;
window.clearAllPartnershipData = clearAllPartnershipData;
window.openPartnershipSettingsModal = openPartnershipSettingsModal;
window.recalculateSettingPercentages = recalculateSettingPercentages;
window.savePartnershipSettings = savePartnershipSettings;
window.resetPartnershipPercentagesToDefault = resetPartnershipPercentagesToDefault;
window.previewPartnershipSlip = previewPartnershipSlip;
window.exportPartnershipCSV = exportPartnershipCSV;

// =========================================================================
// MODUL PENGELUARAN JASA (TRANSPORTASI & UANG MAKAN PELAKSANAAN JASA)
// =========================================================================

function renderServiceExpensesTable() {
  const tbody = document.getElementById('table-service-expenses-body');
  if (!tbody) return;

  const allItems = Array.isArray(state.service_expenses) ? state.service_expenses : [];

  // Update KPI Cards
  let totalExpense = 0;
  let totalTransport = 0;
  let totalMeal = 0;
  let totalPaid = 0;
  let pendingCount = 0;

  allItems.forEach(item => {
    const transport = parseFloat(item.transportFee) || 0;
    const meal = parseFloat(item.mealFee) || 0;
    const total = parseFloat(item.totalExpense) || (transport + meal);
    totalExpense += total;
    totalTransport += transport;
    totalMeal += meal;

    if (item.status === 'Dicairkan') {
      totalPaid += total;
    } else if (item.status === 'Diajukan' || item.status === 'Disetujui' || !item.status) {
      pendingCount++;
    }
  });

  const kpiTotal = document.getElementById('kpi-service-expenses-total');
  const kpiCount = document.getElementById('kpi-service-expenses-count');
  const kpiTransport = document.getElementById('kpi-service-expenses-transport');
  const kpiMeal = document.getElementById('kpi-service-expenses-meal');
  const kpiPaid = document.getElementById('kpi-service-expenses-paid');
  const kpiPending = document.getElementById('kpi-service-expenses-pending');
  const badgeCount = document.getElementById('badge-service-expenses-count');

  if (kpiTotal) kpiTotal.textContent = `Rp ${totalExpense.toLocaleString('id-ID')}`;
  if (kpiCount) kpiCount.textContent = `${allItems.length} Pengajuan Biaya`;
  if (kpiTransport) kpiTransport.textContent = `Rp ${totalTransport.toLocaleString('id-ID')}`;
  if (kpiMeal) kpiMeal.textContent = `Rp ${totalMeal.toLocaleString('id-ID')}`;
  if (kpiPaid) kpiPaid.textContent = `Rp ${totalPaid.toLocaleString('id-ID')}`;
  if (kpiPending) kpiPending.textContent = `${pendingCount} Menunggu Pencairan`;
  if (badgeCount) badgeCount.textContent = allItems.length;

  filterServiceExpensesTable();
}

function filterServiceExpensesTable() {
  const tbody = document.getElementById('table-service-expenses-body');
  if (!tbody) return;

  const allItems = Array.isArray(state.service_expenses) ? state.service_expenses : [];
  const statusFilter = (document.getElementById('filter-service-expense-status')?.value || 'ALL').trim();
  const searchInput = (document.getElementById('filter-service-expense-search')?.value || '').toLowerCase().trim();

  const filtered = allItems.filter(item => {
    if (statusFilter !== 'ALL' && (item.status || 'Diajukan') !== statusFilter) {
      return false;
    }
    if (searchInput) {
      const matchNo = (item.id || '').toLowerCase().includes(searchInput);
      const matchOrder = (item.orderId || '').toLowerCase().includes(searchInput);
      const matchCustomer = (item.customerName || '').toLowerCase().includes(searchInput);
      const matchService = (item.serviceName || '').toLowerCase().includes(searchInput);
      const matchPIC = (item.picName || '').toLowerCase().includes(searchInput);
      const matchTeam = (item.teamMembers || '').toLowerCase().includes(searchInput);
      if (!matchNo && !matchOrder && !matchCustomer && !matchService && !matchPIC && !matchTeam) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <i data-lucide="car" style="width: 32px; height: 32px; stroke-width: 1.5; color: #cbd5e1;"></i>
            <div style="font-weight: 600; font-size: 13px;">Belum Ada Pengajuan Pengeluaran Jasa</div>
            <div style="font-size: 11.5px; max-width: 420px; line-height: 1.4;">
              Klik tombol <strong>+ Buat Pengajuan Baru</strong> atau gunakan aksi pada order penjualan jasa untuk mengajukan biaya transportasi dan uang makan.
            </div>
            <button type="button" class="btn btn-sm btn-primary" onclick="openServiceExpenseModal()" style="margin-top: 10px; background: #ea580c; border-color: #ea580c;">
              + Ajukan Biaya Jasa Sekarang
            </button>
          </div>
        </td>
      </tr>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const transport = parseFloat(item.transportFee) || 0;
    const meal = parseFloat(item.mealFee) || 0;
    const total = parseFloat(item.totalExpense) || (transport + meal);

    const status = item.status || 'Diajukan';
    let statusBadge = '';
    if (status === 'Dicairkan') {
      statusBadge = `<span class="badge badge-success" style="font-size: 10.5px; font-weight: 700; padding: 3px 8px; background: #dcfce7; color: #15803d; border: 1px solid #86efac; cursor: pointer;" onclick="openServiceExpenseStatusModal('${item.id}')" title="Klik untuk ubah status pencairan">💵 Dicairkan</span>`;
    } else if (status === 'Disetujui') {
      statusBadge = `<span class="badge badge-info" style="font-size: 10.5px; font-weight: 700; padding: 3px 8px; background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; cursor: pointer;" onclick="openServiceExpenseStatusModal('${item.id}')" title="Klik untuk ubah status pencairan">👍 Disetujui</span>`;
    } else if (status === 'Ditolak') {
      statusBadge = `<span class="badge badge-danger" style="font-size: 10.5px; font-weight: 700; padding: 3px 8px; background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; cursor: pointer;" onclick="openServiceExpenseStatusModal('${item.id}')" title="Klik untuk ubah status pencairan">❌ Ditolak</span>`;
    } else {
      statusBadge = `<span class="badge badge-warning" style="font-size: 10.5px; font-weight: 700; padding: 3px 8px; background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; cursor: pointer;" onclick="openServiceExpenseStatusModal('${item.id}')" title="Klik untuk ubah status pencairan">⏳ Diajukan</span>`;
    }

    const mealPersons = parseInt(item.mealPersons) || 1;
    const mealDays = parseInt(item.mealDays) || 1;
    const mealRate = parseFloat(item.mealRate) || 0;

    return `
      <tr style="transition: background 0.15s ease;">
        <td style="font-weight: 700; font-family: monospace; font-size: 11.5px; color: #ea580c;">
          ${escapeHtml(item.id)}
        </td>
        <td style="font-size: 11px; color: #64748b; white-space: nowrap;">
          ${escapeHtml(item.date || '-')}
        </td>
        <td>
          <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${escapeHtml(item.customerName || '-')}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 1px;">${escapeHtml(item.serviceName || '-')}</div>
          <div style="margin-top: 3px;">
            <span class="badge badge-secondary" style="font-size: 9.5px; font-family: monospace; padding: 1px 5px;">
              ${escapeHtml(item.orderId || 'Direct Jasa')}
            </span>
          </div>
        </td>
        <td>
          <div style="font-weight: 700; font-size: 11.5px; color: #1e293b;">
            👤 ${escapeHtml(item.picName || '-')}
          </div>
          ${item.teamMembers ? `
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
              👥 ${escapeHtml(item.teamMembers)}
            </div>
          ` : ''}
        </td>
        <td style="text-align: right;">
          <div class="font-mono" style="font-weight: 700; font-size: 12px; color: #1e40af;">
            Rp ${transport.toLocaleString('id-ID')}
          </div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">
            ${escapeHtml(item.transportType || 'Transportasi')}
          </div>
          ${item.transportRoute ? `
            <div style="font-size: 9px; color: #94a3b8; font-style: italic; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: auto;" title="${escapeHtml(item.transportRoute)}">
              ${escapeHtml(item.transportRoute)}
            </div>
          ` : ''}
        </td>
        <td style="text-align: right;">
          <div class="font-mono" style="font-weight: 700; font-size: 12px; color: #166534;">
            Rp ${meal.toLocaleString('id-ID')}
          </div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">
            ${mealPersons} org x ${mealDays} hr
          </div>
          <div style="font-size: 9px; color: #94a3b8;">
            @Rp ${mealRate.toLocaleString('id-ID')}
          </div>
        </td>
        <td style="text-align: right;">
          <div class="font-mono" style="font-weight: 800; font-size: 13px; color: #ea580c;">
            Rp ${total.toLocaleString('id-ID')}
          </div>
          ${item.bankAccount ? `
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;" title="${escapeHtml(item.bankName || '')} ${escapeHtml(item.bankAccount || '')} a.n. ${escapeHtml(item.bankHolder || '')}">
              💳 ${escapeHtml(item.bankName || 'Bank')} (${escapeHtml(item.bankHolder || '')})
            </div>
          ` : ''}
        </td>
        <td style="text-align: center;">
          ${statusBadge}
          ${item.disbursementDate ? `
            <div style="font-size: 9px; color: #059669; margin-top: 3px;">
              Cair: ${escapeHtml(item.disbursementDate)}
            </div>
          ` : ''}
        </td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end; gap: 4px;">
            <button class="btn-icon" style="color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0;" title="Kelola Pencairan / Status Dana" onclick="openServiceExpenseStatusModal('${item.id}')">
              <i data-lucide="badge-dollar-sign"></i>
            </button>
            <button class="btn-icon" style="color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe;" title="Cetak Voucher Kasbon / Pengeluaran Jasa" onclick="printServiceExpenseVoucher('${item.id}')">
              <i data-lucide="printer"></i>
            </button>
            <button class="btn-icon" title="Edit Pengajuan" onclick="openServiceExpenseModal(null, '${item.id}')">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn-icon btn-danger-ghost" title="Hapus Pengajuan" onclick="deleteServiceExpense('${item.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Membuka Modal Pengajuan Transportasi & Uang Makan Jasa
 * @param {string|null} orderId - ID Order Penjualan (jika dipanggil dari kolom aksi order jasa)
 * @param {string|null} expenseId - ID Pengeluaran Jasa (jika mode edit)
 */
function openServiceExpenseModal(orderId = null, expenseId = null) {
  const modal = document.getElementById('modal-service-expense-form');
  if (!modal) return;

  const selectOrder = document.getElementById('service-expense-order-select');
  if (selectOrder) {
    // Kumpulkan semua order jasa
    const serviceOrders = (state.orders || []).filter(o => {
      if (typeof isServiceOrder === 'function') return isServiceOrder(o);
      if (o.orderType === 'jasa' || o.quotationType === 'jasa') return true;
      if (o.quotationId) {
        const q = (state.quotations || []).find(quo => quo.id === o.quotationId);
        if (q && q.quotationType === 'jasa') return true;
      }
      return false;
    });

    let opts = '<option value="">-- Pilih Order Penjualan Jasa --</option>';
    serviceOrders.forEach(o => {
      const q = (state.quotations || []).find(quo => quo.id === o.quotationId);
      const svcName = o.items?.[0]?.itemName || q?.projectName || o.notes?.slice(0, 30) || 'Layanan Jasa';
      opts += `<option value="${o.id}">${escapeHtml(o.id)} - ${escapeHtml(o.customerName || 'Klien')} (${escapeHtml(svcName)})</option>`;
    });

    // Tambahkan juga opsi "Input Jasa Langsung (Tanpa Order Terdaftar)"
    opts += '<option value="__MANUAL__">➕ Input Jasa Manual / Proyek Khusus</option>';
    selectOrder.innerHTML = opts;
  }

  const titleEl = document.getElementById('service-expense-modal-title');
  const idInput = document.getElementById('service-expense-id');
  const dateInput = document.getElementById('service-expense-date');
  const custInput = document.getElementById('service-expense-customer');
  const svcInput = document.getElementById('service-expense-service-name');
  const picInput = document.getElementById('service-expense-pic');
  const teamInput = document.getElementById('service-expense-team');

  const transportType = document.getElementById('service-expense-transport-type');
  const transportRoute = document.getElementById('service-expense-transport-route');
  const transportFee = document.getElementById('service-expense-transport-fee');
  const transportNotes = document.getElementById('service-expense-transport-notes');

  const mealPersons = document.getElementById('service-expense-meal-persons');
  const mealDays = document.getElementById('service-expense-meal-days');
  const mealRate = document.getElementById('service-expense-meal-rate');
  const mealNotes = document.getElementById('service-expense-meal-notes');

  const bankName = document.getElementById('service-expense-bank-name');
  const bankAccount = document.getElementById('service-expense-bank-account');
  const bankHolder = document.getElementById('service-expense-bank-holder');
  const statusSelect = document.getElementById('service-expense-status');
  const generalNotes = document.getElementById('service-expense-general-notes');

  if (expenseId) {
    // Mode EDIT
    const item = (state.service_expenses || []).find(x => x.id === expenseId);
    if (!item) return;

    if (titleEl) titleEl.textContent = `Edit Pengajuan: ${item.id}`;
    if (idInput) idInput.value = item.id;
    if (selectOrder) selectOrder.value = item.orderId || '__MANUAL__';
    if (dateInput) dateInput.value = item.date || new Date().toISOString().split('T')[0];
    if (custInput) custInput.value = item.customerName || '';
    if (svcInput) svcInput.value = item.serviceName || '';
    if (picInput) picInput.value = item.picName || '';
    if (teamInput) teamInput.value = item.teamMembers || '';

    if (transportType) transportType.value = item.transportType || 'Bensin & Tol';
    if (transportRoute) transportRoute.value = item.transportRoute || '';
    if (transportFee) transportFee.value = item.transportFee || 0;
    if (transportNotes) transportNotes.value = item.transportNotes || '';

    if (mealPersons) mealPersons.value = item.mealPersons || 1;
    if (mealDays) mealDays.value = item.mealDays || 1;
    if (mealRate) mealRate.value = item.mealRate || 50000;
    if (mealNotes) mealNotes.value = item.mealNotes || '';

    if (bankName) bankName.value = item.bankName || '';
    if (bankAccount) bankAccount.value = item.bankAccount || '';
    if (bankHolder) bankHolder.value = item.bankHolder || '';
    if (statusSelect) statusSelect.value = item.status || 'Diajukan';
    if (generalNotes) generalNotes.value = item.notes || '';
  } else {
    // Mode BARU
    if (titleEl) titleEl.textContent = 'Pengajuan Transportasi & Uang Makan Jasa';
    if (idInput) idInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Nilai default
    if (transportType) transportType.value = 'Bensin & Tol';
    if (transportRoute) transportRoute.value = '';
    if (transportFee) transportFee.value = 0;
    if (transportNotes) transportNotes.value = '';

    if (mealPersons) mealPersons.value = 1;
    if (mealDays) mealDays.value = 1;
    if (mealRate) mealRate.value = 50000;
    if (mealNotes) mealNotes.value = '';

    if (bankName) bankName.value = '';
    if (bankAccount) bankAccount.value = '';
    if (bankHolder) bankHolder.value = '';
    if (statusSelect) statusSelect.value = 'Diajukan';
    if (generalNotes) generalNotes.value = '';

    if (orderId && selectOrder) {
      selectOrder.value = orderId;
      onServiceExpenseOrderChange();
    } else {
      if (selectOrder) selectOrder.value = '';
      if (custInput) custInput.value = '';
      if (svcInput) svcInput.value = '';
      if (picInput) picInput.value = '';
      if (teamInput) teamInput.value = '';
    }
  }

  calcServiceExpenseTotals();
  openModal('modal-service-expense-form');
}

/**
 * Handle ketika dropdown order dipilih
 */
function onServiceExpenseOrderChange() {
  const selectOrder = document.getElementById('service-expense-order-select');
  if (!selectOrder) return;

  const orderId = selectOrder.value;
  const custInput = document.getElementById('service-expense-customer');
  const svcInput = document.getElementById('service-expense-service-name');
  const picInput = document.getElementById('service-expense-pic');
  const teamInput = document.getElementById('service-expense-team');

  if (!orderId || orderId === '__MANUAL__') {
    if (custInput) custInput.value = '';
    if (svcInput) svcInput.value = '';
    if (picInput) picInput.value = '';
    if (teamInput) teamInput.value = '';
    return;
  }

  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  const quo = (state.quotations || []).find(q => q.id === order.quotationId);
  const proj = (state.projects || []).find(p => p.orderId === order.id);

  if (custInput) custInput.value = order.customerName || quo?.customerName || '';
  if (svcInput) {
    const sName = order.items?.[0]?.itemName || quo?.projectName || order.notes?.slice(0, 50) || 'Pelaksanaan Layanan Jasa';
    svcInput.value = sName;
  }

  // Isi Leader & Team dari penugasan tim jika ada
  if (picInput) {
    picInput.value = proj?.projectLead && proj.projectLead !== 'Belum diassign' ? proj.projectLead : (order.salesPerson || '');
  }
  if (teamInput) {
    if (proj?.team && Array.isArray(proj.team) && proj.team.length > 0) {
      teamInput.value = proj.team.join(', ');
      const mealPersons = document.getElementById('service-expense-meal-persons');
      if (mealPersons) {
        mealPersons.value = Math.max(1, proj.team.length);
      }
    }
  }

  calcServiceExpenseTotals();
}

/**
 * Kalkulasi otomatis subtotal uang makan dan total biaya pengajuan
 */
function calcServiceExpenseTotals() {
  const transportFeeEl = document.getElementById('service-expense-transport-fee');
  const mealPersonsEl = document.getElementById('service-expense-meal-persons');
  const mealDaysEl = document.getElementById('service-expense-meal-days');
  const mealRateEl = document.getElementById('service-expense-meal-rate');

  const transportVal = parseFloat(transportFeeEl?.value) || 0;
  const personsVal = parseInt(mealPersonsEl?.value) || 1;
  const daysVal = parseInt(mealDaysEl?.value) || 1;
  const rateVal = parseFloat(mealRateEl?.value) || 0;

  const mealSubtotal = personsVal * daysVal * rateVal;
  const grandTotal = transportVal + mealSubtotal;

  const transportBadge = document.getElementById('service-expense-transport-badge');
  const mealBadge = document.getElementById('service-expense-meal-badge');
  const mealSubtotalText = document.getElementById('service-expense-meal-subtotal-text');
  const grandTotalText = document.getElementById('service-expense-grand-total-text');

  if (transportBadge) transportBadge.textContent = `Subtotal: Rp ${transportVal.toLocaleString('id-ID')}`;
  if (mealBadge) mealBadge.textContent = `Subtotal: Rp ${mealSubtotal.toLocaleString('id-ID')}`;
  if (mealSubtotalText) mealSubtotalText.textContent = `Rp ${mealSubtotal.toLocaleString('id-ID')}`;
  if (grandTotalText) grandTotalText.textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
}

/**
 * Simpan Data Pengajuan Transportasi & Uang Makan Jasa
 */
async function saveServiceExpense(event) {
  if (event) event.preventDefault();

  const idInput = document.getElementById('service-expense-id');
  const selectOrder = document.getElementById('service-expense-order-select');
  const dateInput = document.getElementById('service-expense-date');
  const custInput = document.getElementById('service-expense-customer');
  const svcInput = document.getElementById('service-expense-service-name');
  const picInput = document.getElementById('service-expense-pic');
  const teamInput = document.getElementById('service-expense-team');

  const transportType = document.getElementById('service-expense-transport-type');
  const transportRoute = document.getElementById('service-expense-transport-route');
  const transportFee = document.getElementById('service-expense-transport-fee');
  const transportNotes = document.getElementById('service-expense-transport-notes');

  const mealPersons = document.getElementById('service-expense-meal-persons');
  const mealDays = document.getElementById('service-expense-meal-days');
  const mealRate = document.getElementById('service-expense-meal-rate');
  const mealNotes = document.getElementById('service-expense-meal-notes');

  const bankName = document.getElementById('service-expense-bank-name');
  const bankAccount = document.getElementById('service-expense-bank-account');
  const bankHolder = document.getElementById('service-expense-bank-holder');
  const statusSelect = document.getElementById('service-expense-status');
  const generalNotes = document.getElementById('service-expense-general-notes');

  const transportVal = parseFloat(transportFee?.value) || 0;
  const personsVal = parseInt(mealPersons?.value) || 1;
  const daysVal = parseInt(mealDays?.value) || 1;
  const rateVal = parseFloat(mealRate?.value) || 0;
  const mealVal = personsVal * daysVal * rateVal;
  const totalVal = transportVal + mealVal;

  const isEdit = Boolean(idInput && idInput.value);
  const nowYear = new Date().getFullYear();
  const fallbackId = isEdit ? idInput.value : `EXP-JSA-${nowYear}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`;

  const existingItem = isEdit ? (state.service_expenses || []).find(x => x.id === idInput.value) : null;

  const payload = {
    id: fallbackId,
    orderId: selectOrder?.value || '',
    date: dateInput?.value || new Date().toISOString().split('T')[0],
    customerName: custInput?.value?.trim() || '',
    serviceName: svcInput?.value?.trim() || '',
    picName: picInput?.value?.trim() || '',
    teamMembers: teamInput?.value?.trim() || '',
    transportType: transportType?.value || 'Bensin & Tol',
    transportRoute: transportRoute?.value?.trim() || '',
    transportFee: transportVal,
    transportNotes: transportNotes?.value?.trim() || '',
    mealPersons: personsVal,
    mealDays: daysVal,
    mealRate: rateVal,
    mealFee: mealVal,
    mealNotes: mealNotes?.value?.trim() || '',
    totalExpense: totalVal,
    bankName: bankName?.value?.trim() || '',
    bankAccount: bankAccount?.value?.trim() || '',
    bankHolder: bankHolder?.value?.trim() || '',
    status: statusSelect?.value || 'Diajukan',
    notes: generalNotes?.value?.trim() || '',
    disbursementDate: existingItem?.disbursementDate || '',
    disbursementRef: existingItem?.disbursementRef || '',
    financeNotes: existingItem?.financeNotes || '',
    updatedAt: new Date().toISOString()
  };

  try {
    let savedItem = payload;
    if (isEdit) {
      const res = await fetch(`/api/service_expenses/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) savedItem = await res.json();
    } else {
      const res = await fetch('/api/service_expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) savedItem = await res.json();
    }

    // Update state secara lokal
    state.service_expenses = state.service_expenses || [];
    const idx = state.service_expenses.findIndex(x => x.id === savedItem.id);
    if (idx !== -1) {
      state.service_expenses[idx] = savedItem;
    } else {
      state.service_expenses.unshift(savedItem);
    }

    // Direct Supabase universal cloud store sync
    if (typeof directSupabaseSyncServiceExpenses === 'function') {
      directSupabaseSyncServiceExpenses(state.service_expenses).catch(e => console.warn(e));
    }
    try { localStorage.setItem('ubm_cached_service_expenses', JSON.stringify(state.service_expenses)); } catch (e) {}

    closeModal('modal-service-expense-form');
    showToast(`Pengajuan ${savedItem.id} berhasil disimpan dan masuk ke Tab Pengeluaran Jasa!`, 'success');

    // Jika sedang di view finance, refresh tabelnya
    if (state.currentView === 'finance') {
      switchFinanceTab('service-expenses');
    }
    renderServiceExpensesTable();

  } catch (err) {
    console.warn('API error, saving locally:', err);
    state.service_expenses = state.service_expenses || [];
    const idx = state.service_expenses.findIndex(x => x.id === payload.id);
    if (idx !== -1) {
      state.service_expenses[idx] = payload;
    } else {
      state.service_expenses.unshift(payload);
    }
    if (typeof directSupabaseSyncServiceExpenses === 'function') {
      directSupabaseSyncServiceExpenses(state.service_expenses).catch(() => {});
    }
    try { localStorage.setItem('ubm_cached_service_expenses', JSON.stringify(state.service_expenses)); } catch (e) {}

    closeModal('modal-service-expense-form');
    showToast(`Pengajuan ${payload.id} disimpan (Offline Mode)`, 'info');
    if (state.currentView === 'finance') {
      switchFinanceTab('service-expenses');
    }
    renderServiceExpensesTable();
  }
}

/**
 * Hapus data pengeluaran jasa
 */
async function deleteServiceExpense(id) {
  if (!confirm(`Apakah Anda yakin ingin menghapus pengajuan pengeluaran jasa ${id}?`)) {
    return;
  }

  try {
    await fetch(`/api/service_expenses/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('Delete API warning:', e);
  }

  state.service_expenses = (state.service_expenses || []).filter(x => x.id !== id);
  if (typeof directSupabaseSyncServiceExpenses === 'function') {
    directSupabaseSyncServiceExpenses(state.service_expenses).catch(() => {});
  }
  try { localStorage.setItem('ubm_cached_service_expenses', JSON.stringify(state.service_expenses)); } catch (e) {}

  renderServiceExpensesTable();
  showToast(`Pengajuan ${id} berhasil dihapus!`, 'success');
}

/**
 * Hapus semua data pengeluaran jasa
 */
async function clearAllServiceExpensesData() {
  if (!confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA data pengeluaran jasa?')) return;
  if (!confirm('Tindakan ini tidak dapat dibatalkan. Lanjutkan hapus semua?')) return;

  const currentList = [...(state.service_expenses || [])];
  for (const item of currentList) {
    try {
      await fetch(`/api/service_expenses/${item.id}`, { method: 'DELETE' });
    } catch (e) {}
  }

  state.service_expenses = [];
  if (typeof directSupabaseSyncServiceExpenses === 'function') {
    directSupabaseSyncServiceExpenses([]).catch(() => {});
  }
  try { localStorage.removeItem('ubm_cached_service_expenses'); } catch (e) {}

  renderServiceExpensesTable();
  showToast('Semua data pengeluaran jasa telah dibersihkan!', 'success');
}

/**
 * Buka modal update status pencairan
 */
function openServiceExpenseStatusModal(id) {
  const item = (state.service_expenses || []).find(x => x.id === id);
  if (!item) return;

  const noEl = document.getElementById('service-expense-status-no');
  const clientEl = document.getElementById('service-expense-status-client');
  const picEl = document.getElementById('service-expense-status-pic');
  const amountEl = document.getElementById('service-expense-status-amount');

  const idInput = document.getElementById('service-expense-status-id');
  const selectStatus = document.getElementById('service-expense-status-select');
  const dateInput = document.getElementById('service-expense-status-date');
  const refInput = document.getElementById('service-expense-status-ref');
  const notesInput = document.getElementById('service-expense-status-notes');

  if (noEl) noEl.textContent = item.id;
  if (clientEl) clientEl.textContent = `${item.customerName || '-'} (${item.serviceName || '-'})`;
  if (picEl) picEl.textContent = item.picName || '-';
  if (amountEl) {
    const total = parseFloat(item.totalExpense) || ((parseFloat(item.transportFee) || 0) + (parseFloat(item.mealFee) || 0));
    amountEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
  }

  if (idInput) idInput.value = item.id;
  if (selectStatus) selectStatus.value = item.status || 'Diajukan';
  if (dateInput) dateInput.value = item.disbursementDate || (item.status === 'Dicairkan' ? new Date().toISOString().split('T')[0] : '');
  if (refInput) refInput.value = item.disbursementRef || '';
  if (notesInput) notesInput.value = item.financeNotes || '';

  openModal('modal-service-expense-status');
}

/**
 * Simpan update status pencairan
 */
async function saveServiceExpenseStatus(event) {
  if (event) event.preventDefault();

  const idInput = document.getElementById('service-expense-status-id');
  const selectStatus = document.getElementById('service-expense-status-select');
  const dateInput = document.getElementById('service-expense-status-date');
  const refInput = document.getElementById('service-expense-status-ref');
  const notesInput = document.getElementById('service-expense-status-notes');

  const id = idInput?.value;
  if (!id) return;

  const item = (state.service_expenses || []).find(x => x.id === id);
  if (!item) return;

  item.status = selectStatus?.value || 'Diajukan';
  item.disbursementDate = dateInput?.value || (item.status === 'Dicairkan' ? new Date().toISOString().split('T')[0] : '');
  item.disbursementRef = refInput?.value?.trim() || '';
  item.financeNotes = notesInput?.value?.trim() || '';
  item.updatedAt = new Date().toISOString();

  try {
    await fetch(`/api/service_expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  } catch (e) {
    console.warn('Update status API notice:', e);
  }

  if (typeof directSupabaseSyncServiceExpenses === 'function') {
    directSupabaseSyncServiceExpenses(state.service_expenses).catch(() => {});
  }
  try { localStorage.setItem('ubm_cached_service_expenses', JSON.stringify(state.service_expenses)); } catch (e) {}

  closeModal('modal-service-expense-status');
  renderServiceExpensesTable();
  showToast(`Status pengeluaran ${id} berhasil diperbarui: ${item.status}`, 'success');
}

/**
 * Cetak Voucher Resmi Kasbon / Pengeluaran Jasa
 */
function printServiceExpenseVoucher(id) {
  const item = (state.service_expenses || []).find(x => x.id === id);
  if (!item) return;

  const transport = parseFloat(item.transportFee) || 0;
  const meal = parseFloat(item.mealFee) || 0;
  const total = parseFloat(item.totalExpense) || (transport + meal);

  const mealPersons = parseInt(item.mealPersons) || 1;
  const mealDays = parseInt(item.mealDays) || 1;
  const mealRate = parseFloat(item.mealRate) || 0;

  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Popup diblokir oleh browser. Izinkan popup untuk mencetak slip/voucher.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Voucher Kasbon Pengeluaran Jasa - ${escapeHtml(item.id)}</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 30px;
          background: #ffffff;
          font-size: 13px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2.5px solid #ea580c;
          padding-bottom: 14px;
          margin-bottom: 20px;
        }
        .company-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }
        .company-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 3px;
        }
        .voucher-title {
          text-align: right;
        }
        .voucher-badge {
          display: inline-block;
          background: #fff7ed;
          color: #ea580c;
          border: 1px solid #fed7aa;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .voucher-no {
          font-family: monospace;
          font-size: 16px;
          font-weight: 800;
          margin-top: 4px;
          color: #0f172a;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .info-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 14px;
        }
        .info-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
          margin-bottom: 8px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
        }
        .info-label {
          color: #64748b;
        }
        .info-val {
          font-weight: 600;
          text-align: right;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          font-size: 11.5px;
          text-align: left;
          text-transform: uppercase;
        }
        td {
          border: 1px solid #e2e8f0;
          padding: 9px 10px;
          font-size: 12px;
        }
        .total-box {
          background: #fff7ed;
          border: 1.5px solid #fed7aa;
          border-radius: 6px;
          padding: 14px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .signatures {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          text-align: center;
          margin-top: 40px;
        }
        .sig-box {
          border-top: 1px solid #94a3b8;
          padding-top: 6px;
          margin-top: 65px;
          font-size: 11.5px;
          font-weight: 700;
        }
        .sig-role {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 2px;
          font-weight: normal;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print()" style="padding: 8px 18px; background: #ea580c; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">
          🖨️ Cetak Voucher / PDF
        </button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">UNIT BISNIS MANDIRI POLITEKNIK TAKUMI</div>
          <div class="company-sub">Engineering, Automation & Industrial Digital Solution</div>
          <div class="company-sub">Jl. Raya Hankam, Cikarang - Jawa Barat &bull; Email: ubm@takumi.ac.id</div>
        </div>
        <div class="voucher-title">
          <div class="voucher-badge">VOUCHER PENGELUARAN JASA</div>
          <div class="voucher-no">${escapeHtml(item.id)}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Tanggal: ${escapeHtml(item.date || '-')}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="info-box">
          <div class="info-title">Informasi Order Jasa & Klien</div>
          <div class="info-row">
            <span class="info-label">No. Order Jasa:</span>
            <span class="info-val">${escapeHtml(item.orderId || '-')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer / Perusahaan:</span>
            <span class="info-val">${escapeHtml(item.customerName || '-')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Layanan / Pekerjaan:</span>
            <span class="info-val">${escapeHtml(item.serviceName || '-')}</span>
          </div>
        </div>

        <div class="info-box">
          <div class="info-title">Tim Pelaksana & Rekening Penerima</div>
          <div class="info-row">
            <span class="info-label">Project Leader / PIC:</span>
            <span class="info-val">${escapeHtml(item.picName || '-')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Anggota Tim:</span>
            <span class="info-val">${escapeHtml(item.teamMembers || '-')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Rekening Pencairan:</span>
            <span class="info-val">${escapeHtml(item.bankName || '')} ${escapeHtml(item.bankAccount || '')} (a.n. ${escapeHtml(item.bankHolder || '')})</span>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">No</th>
            <th>Uraian Pengajuan Biaya Pelaksanaan Jasa</th>
            <th style="width: 180px;">Rincian / Kuantitas</th>
            <th style="width: 140px; text-align: right;">Nominal (Rp)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center; font-weight: 700;">1</td>
            <td>
              <strong>Biaya Transportasi Pelaksanaan Jasa</strong>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                Kategori: ${escapeHtml(item.transportType || 'Transportasi')} &bull; Rute: ${escapeHtml(item.transportRoute || '-')}
              </div>
              ${item.transportNotes ? `<div style="font-size: 10.5px; color: #475569; font-style: italic;">Catatan: ${escapeHtml(item.transportNotes)}</div>` : ''}
            </td>
            <td>
              1 Paket Perjalanan Dinas
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 700;">
              Rp ${transport.toLocaleString('id-ID')}
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: 700;">2</td>
            <td>
              <strong>Biaya Uang Makan Tim / Teknisi Pelaksana Jasa</strong>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                Konsumsi teknisi di lokasi pengerjaan / site
              </div>
              ${item.mealNotes ? `<div style="font-size: 10.5px; color: #475569; font-style: italic;">Catatan: ${escapeHtml(item.mealNotes)}</div>` : ''}
            </td>
            <td>
              ${mealPersons} Orang &times; ${mealDays} Hari<br>
              <span style="font-size: 10.5px; color: #64748b;">@Rp ${mealRate.toLocaleString('id-ID')}</span>
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 700;">
              Rp ${mealFee.toLocaleString('id-ID')}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="total-box">
        <div>
          <div style="font-size: 11px; color: #9a3412; font-weight: 800; text-transform: uppercase;">TOTAL KASBON / REIMBURSE PENGAJUAN BIAYA JASA</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Status: <strong>${escapeHtml(item.status || 'Diajukan')}</strong> ${item.disbursementRef ? `&bull; Ref: ${escapeHtml(item.disbursementRef)}` : ''}</div>
        </div>
        <div style="font-family: monospace; font-size: 22px; font-weight: 800; color: #ea580c;">
          Rp ${total.toLocaleString('id-ID')}
        </div>
      </div>

      <div class="signatures">
        <div>
          <div style="font-size: 11px; color: #64748b;">Yang Mengajukan,</div>
          <div class="sig-box">${escapeHtml(item.picName || 'Teknisi')}</div>
          <div class="sig-role">Pelaksana Lapangan</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #64748b;">Project Leader / PIC,</div>
          <div class="sig-box">${escapeHtml(item.picName || 'Leader Jasa')}</div>
          <div class="sig-role">Koordinator Jasa</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #64748b;">Bagian Keuangan / Kasir,</div>
          <div class="sig-box">Keuangan UBM</div>
          <div class="sig-role">Verifikasi & Kasir</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #64748b;">Mengetahui,</div>
          <div class="sig-box">Direktur / Manajemen UBM</div>
          <div class="sig-role">Approval Otorisasi</div>
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Export data pengeluaran jasa ke file CSV
 */
function exportServiceExpensesCSV() {
  const allItems = Array.isArray(state.service_expenses) ? state.service_expenses : [];
  if (allItems.length === 0) {
    showToast('Tidak ada data pengeluaran jasa untuk diekspor!', 'warning');
    return;
  }

  const headers = [
    'No. Pengajuan',
    'Tanggal',
    'No. Order Jasa',
    'Customer / Klien',
    'Nama Layanan Jasa',
    'PIC Leader',
    'Tim Pelaksana',
    'Kategori Transportasi',
    'Rute Transportasi',
    'Biaya Transportasi (Rp)',
    'Catatan Transportasi',
    'Jumlah Personel (Orang)',
    'Durasi Hari',
    'Tarif Uang Makan (Rp)',
    'Total Uang Makan (Rp)',
    'Catatan Uang Makan',
    'Total Pengajuan Biaya (Rp)',
    'Bank Tujuan',
    'No. Rekening',
    'Atas Nama Penerima',
    'Status Pencairan',
    'Tanggal Pencairan',
    'No. Ref Transfer',
    'Catatan Keuangan'
  ];

  const rows = allItems.map(it => {
    const transport = parseFloat(it.transportFee) || 0;
    const meal = parseFloat(it.mealFee) || 0;
    const total = parseFloat(it.totalExpense) || (transport + meal);

    return [
      `"${it.id}"`,
      `"${it.date || ''}"`,
      `"${it.orderId || ''}"`,
      `"${(it.customerName || '').replace(/"/g, '""')}"`,
      `"${(it.serviceName || '').replace(/"/g, '""')}"`,
      `"${(it.picName || '').replace(/"/g, '""')}"`,
      `"${(it.teamMembers || '').replace(/"/g, '""')}"`,
      `"${(it.transportType || '').replace(/"/g, '""')}"`,
      `"${(it.transportRoute || '').replace(/"/g, '""')}"`,
      transport,
      `"${(it.transportNotes || '').replace(/"/g, '""')}"`,
      it.mealPersons || 1,
      it.mealDays || 1,
      it.mealRate || 0,
      meal,
      `"${(it.mealNotes || '').replace(/"/g, '""')}"`,
      total,
      `"${(it.bankName || '').replace(/"/g, '""')}"`,
      `"${(it.bankAccount || '').replace(/"/g, '""')}"`,
      `"${(it.bankHolder || '').replace(/"/g, '""')}"`,
      `"${it.status || 'Diajukan'}"`,
      `"${it.disbursementDate || ''}"`,
      `"${it.disbursementRef || ''}"`,
      `"${(it.financeNotes || it.notes || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UBM_PENGELUARAN_JASA_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Data Pengeluaran Jasa berhasil diekspor ke CSV!', 'success');
}

// Global window exposure Pengeluaran Jasa
window.renderServiceExpensesTable = renderServiceExpensesTable;
window.filterServiceExpensesTable = filterServiceExpensesTable;
window.openServiceExpenseModal = openServiceExpenseModal;
window.onServiceExpenseOrderChange = onServiceExpenseOrderChange;
window.calcServiceExpenseTotals = calcServiceExpenseTotals;
window.saveServiceExpense = saveServiceExpense;
window.deleteServiceExpense = deleteServiceExpense;
window.clearAllServiceExpensesData = clearAllServiceExpensesData;
window.openServiceExpenseStatusModal = openServiceExpenseStatusModal;
window.saveServiceExpenseStatus = saveServiceExpenseStatus;
window.printServiceExpenseVoucher = printServiceExpenseVoucher;
window.exportServiceExpensesCSV = exportServiceExpensesCSV;
