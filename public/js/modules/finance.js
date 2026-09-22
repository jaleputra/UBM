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

// Global window exposure
window.getProjectFinancialData = getProjectFinancialData;
window.renderFinanceTable = renderFinanceTable;
window.filterFinanceTable = filterFinanceTable;
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
