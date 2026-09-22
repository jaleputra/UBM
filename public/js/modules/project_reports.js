// =========================================================
// UBM - Project Reports Module (Laporan Pelaksanaan Project)
// =========================================================

function isProjectFullyCompleted(project) {
  if (!project) return false;
  const validOrderExists = (state.orders || []).some(o => o.id === project.orderId || o.id === project.id);
  if (!validOrderExists) return false;

  if (project.status === 'Completed') return true;
  if (project.progressPercent === 100) return true;
  if (Array.isArray(project.milestones) && project.milestones.length > 0) {
    return project.milestones.every(m => m.status === 'Completed');
  }
  return false;
}

function getLinkedProjectBOM(project) {
  if (!project) return null;
  const orderId = project.orderId || project.id;
  return (state.bom || []).find(b => b.orderId === orderId || (b.notes && b.notes.includes(orderId)));
}

function getLinkedProjectReport(project) {
  if (!project) return null;
  const orderId = project.orderId || project.id;
  return (state.project_reports || []).find(r => r.projectId === project.id || r.orderId === orderId) 
    || project.actualUsageReport || null;
}

// -------------------------------------------------------------
// 1. RENDER TABEL DAFTAR PROJECT COMPLETED & STATUS LAPORAN
// -------------------------------------------------------------
function renderProjectReportsTable() {
  const tbody = document.getElementById('table-project-reports-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-report-status')?.value || 'ALL';
  const allProjects = state.projects || [];
  
  // Ambil hanya project yang valid dan sudah COMPLETED
  let completedProjects = allProjects.filter(p => isProjectFullyCompleted(p));

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

  // Filter status pelaporan
  if (statusFilter === 'Reported') {
    completedProjects = completedProjects.filter(p => Boolean(getLinkedProjectReport(p)));
  } else if (statusFilter === 'Unreported') {
    completedProjects = completedProjects.filter(p => !getLinkedProjectReport(p));
  }

  if (completedProjects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 36px 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <i data-lucide="clipboard-x" style="width: 36px; height: 36px; color: #94a3b8;"></i>
            <div style="font-weight: 700; color: #475569; font-size: 14px;">Tidak ada project yang memenuhi kriteria</div>
            <div style="font-size: 12px; color: #94a3b8;">Hanya project berstatus <strong>Completed</strong> dari Order Penjualan yang ditampilkan di sini.</div>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = completedProjects.map(p => {
    const bom = getLinkedProjectBOM(p);
    const report = getLinkedProjectReport(p);
    const isReported = Boolean(report);
    const bomComponentsCount = bom?.components?.length || 0;

    let returnedItemsCount = 0;
    let totalReturnedUnits = 0;
    if (report && Array.isArray(report.items)) {
      report.items.forEach(it => {
        const rem = parseFloat(it.remainingQty) || 0;
        if (rem > 0) {
          returnedItemsCount++;
          totalReturnedUnits += rem;
        }
      });
    }

    const dueDate = p.dueDate || (p.milestones && p.milestones.slice(-1)[0]?.dueDate) || '-';

    return `
      <tr style="cursor: pointer; transition: background-color 0.15s ease;" onclick="viewProjectReportDetail('${p.id}')" title="Klik untuk melihat Laporan Pelaksanaan Project">
        <td>
          <span class="mono-id font-bold text-primary" style="font-size: 11.5px;">${p.id}</span>
          ${p.orderId ? `<div class="font-xs text-muted font-mono" style="font-size: 10px; margin-top: 2px;">Ref: ${p.orderId}</div>` : ''}
        </td>
        <td>
          <div class="font-bold text-main" style="word-break: break-word; font-size: 13px; color: #0f172a;">${escapeHtml(p.projectName || 'Project')}</div>
          <div class="text-muted font-sm" style="font-size: 11.5px; margin-top: 2px;"><i data-lucide="building" style="width: 11px; height: 11px; display: inline;"></i> ${escapeHtml(p.customerName || '-')}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 7px;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0;">
              ${(p.projectLead || 'P').charAt(0)}
            </div>
            <div>
              <div class="font-bold text-main" style="font-size: 12px;">${escapeHtml(p.projectLead || 'Belum diassign')}</div>
              <div class="text-muted font-xs" style="font-size: 10px;">${escapeHtml(p.department || 'Engineering')}</div>
            </div>
          </div>
        </td>
        <td style="font-size: 11.5px; font-weight: 600; color: #334155;">
          ${dueDate}
        </td>
        <td style="text-align: center;">
          ${bom ? `
            <span class="badge badge-secondary font-mono" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
              <i data-lucide="boxes" style="width: 12px; height: 12px; display: inline; vertical-align: middle; color: #4f46e5;"></i> ${bomComponentsCount} Komponen
            </span>
          ` : `
            <span class="badge badge-outline" style="color: #94a3b8; font-size: 10.5px; border-color: #cbd5e1;">BOM Belum Ada</span>
          `}
        </td>
        <td style="text-align: center;">
          ${isReported ? (
            returnedItemsCount > 0 
              ? `<span class="badge badge-success font-bold" style="font-size: 11px; padding: 3px 8px;"><i data-lucide="arrow-down-left" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> +${totalReturnedUnits} Unit (${returnedItemsCount} Jenis)</span>`
              : '<span class="text-muted font-xs font-italic">Habis Terpakai (0 Sisa)</span>'
          ) : '<span class="text-muted font-xs">-</span>'}
        </td>
        <td style="text-align: center;">
          ${isReported ? `
            <span class="badge badge-success" style="font-size: 11px; padding: 3px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Sudah Dilaporkan
            </span>
          ` : `
            <span class="badge badge-amber" style="font-size: 11px; padding: 3px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">
              <i data-lucide="clock" style="width: 12px; height: 12px;"></i> Belum Dilaporkan
            </span>
          `}
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: flex-end;">
            ${isReported ? `
              <button class="btn btn-sm btn-outline" style="color: #0f766e; border-color: #99f6e4; background: #f0fdfa; font-size: 11px; padding: 4px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="viewProjectReportDetail('${p.id}')" title="Lihat Dokumen Laporan">
                <i data-lucide="file-text" style="width: 13px; height: 13px;"></i> Lihat Laporan
              </button>
              <button class="btn-icon" style="width: 28px; height: 28px; border-radius: 4px;" title="Edit Penggunaan Barang" onclick="openProjectReportModal('${p.id}')">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
              </button>
            ` : `
              <button class="btn btn-sm btn-primary" style="background: #16a34a; border-color: #16a34a; font-size: 11px; padding: 4px 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="openProjectReportModal('${p.id}')" title="Input Penggunaan Barang & Pengembalian Sisa">
                <i data-lucide="clipboard-check" style="width: 13px; height: 13px;"></i> Input Barang
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterProjectReportsTable() {
  renderProjectReportsTable();
}

// -------------------------------------------------------------
// 2. MODAL FORMULIR PENGGUNAAN BARANG AKTUAL & RESTOCK SISA
// -------------------------------------------------------------
function openProjectReportModal(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan!', 'error');
    return;
  }

  const bom = getLinkedProjectBOM(p);
  const existingReport = getLinkedProjectReport(p);
  const isEdit = Boolean(existingReport);

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '1050px';
    modalContainer.style.width = '94vw';
  }

  document.getElementById('form-modal-title').innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px; font-size: 16px;">
      <i data-lucide="clipboard-check" style="color: #16a34a;"></i>
      ${isEdit ? `Edit Laporan Penggunaan Barang: <span class="mono-id">${p.id}</span>` : `Input Penggunaan Barang Aktual: <span class="mono-id">${p.id}</span>`}
    </span>
  `;

  // Ambil data bahan/komponen dari BOM sebelumnya, atau dari data laporan yang sudah pernah disimpan
  let componentsList = [];
  if (bom && Array.isArray(bom.components) && bom.components.length > 0) {
    componentsList = bom.components.map(c => {
      const savedItem = existingReport?.items?.find(i => (i.componentName || i.itemName)?.toLowerCase() === (c.componentName || c.itemName)?.toLowerCase());
      return {
        itemName: c.componentName || c.itemName || 'Komponen',
        unit: c.unit || 'Pcs',
        unitCost: parseFloat(c.unitCost) || 0,
        planQty: parseFloat(c.qty) || 1,
        actualQty: savedItem ? parseFloat(savedItem.actualQty) : (parseFloat(c.qty) || 1),
        remainingQty: savedItem ? parseFloat(savedItem.remainingQty) : 0,
        notes: savedItem?.notes || ''
      };
    });
  } else if (existingReport && Array.isArray(existingReport.items) && existingReport.items.length > 0) {
    componentsList = existingReport.items.map(i => ({
      itemName: i.itemName || i.componentName || 'Komponen',
      unit: i.unit || 'Pcs',
      unitCost: parseFloat(i.unitCost) || 0,
      planQty: parseFloat(i.planQty || i.qty) || 1,
      actualQty: parseFloat(i.actualQty) || 0,
      remainingQty: parseFloat(i.remainingQty) || 0,
      notes: i.notes || ''
    }));
  }

  const defaultReporter = existingReport?.reporterName || p.projectLead || 'PIC Engineering';
  const defaultReportDate = existingReport?.reportDate || new Date().toISOString().split('T')[0];
  const defaultNotes = existingReport?.notes || `Laporan aktual penggunaan bahan & material project ${p.projectName || ''}.`;

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="project-report-form" onsubmit="submitProjectReport(event, '${p.id}')" style="display: flex; flex-direction: column; gap: 18px;">
      
      <!-- CARD 1: INFORMASI PROJECT & PIC PELAPOR -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="mono-id font-bold text-primary" style="font-size: 13px;">${p.id}</span>
              ${p.orderId ? `<span class="badge badge-outline font-mono">Ref Order: ${p.orderId}</span>` : ''}
              <span class="badge badge-success font-bold">Project Selesai (Completed)</span>
            </div>
            <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">${escapeHtml(p.projectName || 'Project')}</h3>
            <div style="font-size: 12px; color: var(--text-muted);">
              Pelanggan: <strong class="text-main">${escapeHtml(p.customerName || '-')}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--text-muted);">Referensi Master BOM:</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #4f46e5;">${bom ? `${bom.id || 'BOM Terkait'} (${componentsList.length} Bahan)` : 'BOM Tidak Terhubung'}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11.5px;">PIC Pengisi Laporan *</label>
            <input type="text" name="reporterName" class="form-control" required value="${escapeAttr(defaultReporter)}" placeholder="Nama PIC Penanggung Jawab">
          </div>
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11.5px;">Tanggal Pelaporan *</label>
            <input type="date" name="reportDate" class="form-control" required value="${defaultReportDate}">
          </div>
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11.5px;">Catatan Pelaksanaan Project</label>
            <input type="text" name="notes" class="form-control" value="${escapeAttr(defaultNotes)}" placeholder="Kondisi pengerjaan, hasil uji fungsi, atau catatan khusus">
          </div>
        </div>
      </div>

      <!-- CARD 2: TABEL PENGGUNAAN BARANG AKTUAL BERBASIS BOM -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="boxes" style="width: 16px; height: 16px; color: #4f46e5;"></i> Rincian Penggunaan Barang Aktual & Pengembalian Sisa
            </h4>
            <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">
              Sistem memuat daftar material dari formulasi BOM. Isi kuantiti aktual yang terpakai. <strong>Jika ada sisa material, stoknya akan otomatis dikembalikan ke Database Master Barang Purchasing.</strong>
            </p>
          </div>
          <button type="button" class="btn btn-sm btn-outline" onclick="addManualReportItemRow()" style="font-size: 11px;">
            <i data-lucide="plus"></i> + Tambah Material Tambahan
          </button>
        </div>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 14px;">
          <table class="data-table" style="width: 100%; margin: 0; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid var(--border-color); font-size: 11px; text-transform: uppercase;">
                <th style="width: 32%;">Nama Bahan / Komponen Material</th>
                <th style="width: 14%; text-align: center;">Qty Rencana (BOM)</th>
                <th style="width: 16%; text-align: center;">Qty Aktual Terpakai *</th>
                <th style="width: 16%; text-align: center;">Qty Sisa / Kembali</th>
                <th style="width: 22%;">Kondisi / Keterangan Sisa</th>
              </tr>
            </thead>
            <tbody id="project-report-items-body">
              ${componentsList.length === 0 ? `
                <tr id="empty-report-row">
                  <td colspan="5" class="text-center text-muted" style="padding: 24px;">
                    Belum ada data komponen BOM. Anda dapat menambahkan material secara manual menggunakan tombol di atas.
                  </td>
                </tr>
              ` : componentsList.map((item, idx) => `
                <tr class="report-item-row" data-index="${idx}">
                  <td>
                    <input type="text" class="form-control form-control-sm report-item-name font-bold" value="${escapeAttr(item.itemName)}" required placeholder="Nama Bahan Baku">
                    <input type="hidden" class="report-item-unit-cost" value="${item.unitCost || 0}">
                  </td>
                  <td style="text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                      <input type="number" step="any" class="form-control form-control-sm report-plan-qty text-center font-mono font-bold" style="width: 70px; background: #f8fafc;" value="${item.planQty}" readonly>
                      <input type="text" class="form-control form-control-sm report-item-unit text-muted" style="width: 50px; background: #f8fafc;" value="${escapeAttr(item.unit)}" readonly>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                      <input type="number" step="any" min="0" class="form-control form-control-sm report-actual-qty text-center font-mono font-bold" style="width: 80px; border-color: #2563eb;" value="${item.actualQty}" required oninput="calculateReportItemRemaining(this)">
                      <span class="font-xs text-muted" style="font-size: 11px;">${escapeHtml(item.unit)}</span>
                    </div>
                  </td>
                  <td style="text-align: center;">
                    <div class="remaining-badge-container">
                      ${calculateRemainingBadgeHtml(item.planQty, item.actualQty, item.unit)}
                    </div>
                    <input type="hidden" class="report-remaining-qty" value="${Math.max(0, item.planQty - item.actualQty)}">
                  </td>
                  <td>
                    <input type="text" class="form-control form-control-sm report-item-notes" value="${escapeAttr(item.notes)}" placeholder="Contoh: Sisa 2 Pcs, disimpan di Gudang A">
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- REALTIME SUMMARY BANNER -->
        <div id="report-summary-box" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #dcfce7; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="sparkles" style="width: 16px; height: 16px; color: #16a34a;"></i>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 12.5px; color: #166534;" id="report-summary-title">Ringkasan Pengembalian Sisa Material</div>
              <div style="font-size: 11px; color: #15803d;" id="report-summary-subtitle">Memuat kalkulasi...</div>
            </div>
          </div>
          <div id="report-summary-stats" style="display: flex; gap: 14px; font-size: 12px;">
            <!-- Dynamically computed -->
          </div>
        </div>
      </div>

      <!-- FOOTER ACTIONS -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">
          <i data-lucide="x"></i> Batal
        </button>
        <button type="submit" class="btn btn-primary" style="background: #16a34a; border-color: #16a34a; font-weight: 700; padding: 8px 20px; font-size: 13px;">
          <i data-lucide="save"></i> Simpan & Kembalikan Sisa ke Master Barang
        </button>
      </div>
    </form>
  `;

  openModal('form-modal');
  updateAllReportCalculations();
  if (window.lucide) lucide.createIcons();
}

function calculateRemainingBadgeHtml(planQty, actualQty, unit) {
  const plan = parseFloat(planQty) || 0;
  const actual = parseFloat(actualQty) || 0;
  const rem = plan - actual;

  if (rem > 0) {
    return `<span class="badge badge-success font-mono font-bold" style="font-size: 11px; padding: 3px 8px;"><i data-lucide="arrow-down-left" style="width: 11px; height: 11px; display: inline; vertical-align: middle;"></i> +${rem} ${unit} (Sisa)</span>`;
  } else if (rem === 0) {
    return `<span class="badge badge-secondary" style="font-size: 10.5px; padding: 2px 6px;">0 (Habis Pas)</span>`;
  } else {
    return `<span class="badge badge-danger font-mono font-bold" style="font-size: 11px; padding: 3px 8px;">Lebih ${Math.abs(rem)} ${unit}</span>`;
  }
}

function calculateReportItemRemaining(inputEl) {
  const row = inputEl.closest('.report-item-row');
  if (!row) return;

  const planQty = parseFloat(row.querySelector('.report-plan-qty')?.value) || 0;
  const actualQty = parseFloat(inputEl.value) || 0;
  const unit = row.querySelector('.report-item-unit')?.value || '';
  const rem = Math.max(0, planQty - actualQty);

  const container = row.querySelector('.remaining-badge-container');
  if (container) {
    container.innerHTML = calculateRemainingBadgeHtml(planQty, actualQty, unit);
  }

  const hiddenRem = row.querySelector('.report-remaining-qty');
  if (hiddenRem) {
    hiddenRem.value = rem;
  }

  updateAllReportCalculations();
  if (window.lucide) lucide.createIcons();
}

function updateAllReportCalculations() {
  const rows = document.querySelectorAll('#project-report-items-body .report-item-row');
  let totalItems = rows.length;
  let itemsWithRemaining = 0;
  let totalUnitsRemaining = 0;
  let totalPlanQty = 0;
  let totalActualQty = 0;

  rows.forEach(r => {
    const plan = parseFloat(r.querySelector('.report-plan-qty')?.value) || 0;
    const actual = parseFloat(r.querySelector('.report-actual-qty')?.value) || 0;
    const rem = Math.max(0, plan - actual);

    totalPlanQty += plan;
    totalActualQty += actual;
    if (rem > 0) {
      itemsWithRemaining++;
      totalUnitsRemaining += rem;
    }
  });

  const subtitleEl = document.getElementById('report-summary-subtitle');
  if (subtitleEl) {
    if (itemsWithRemaining > 0) {
      subtitleEl.innerHTML = `Terdapat <strong>${itemsWithRemaining} jenis bahan</strong> dengan total <strong>${totalUnitsRemaining} unit sisa</strong> yang akan dimasukkan kembali ke Database Master Barang.`;
    } else {
      subtitleEl.innerHTML = `Semua bahan (${totalItems} jenis) terpakai habis sesuai atau melebihi rencana BOM. Tidak ada sisa material yang dikembalikan.`;
    }
  }

  const statsEl = document.getElementById('report-summary-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div style="background: #ffffff; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 4px;">
        Total Bahan: <strong class="text-main">${totalItems} Item</strong>
      </div>
      <div style="background: #ffffff; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 4px;">
        Sisa Material: <strong class="text-success font-bold">+${totalUnitsRemaining} Unit (${itemsWithRemaining} Item)</strong>
      </div>
    `;
  }
}

function addManualReportItemRow() {
  const emptyRow = document.getElementById('empty-report-row');
  if (emptyRow) emptyRow.remove();

  const tbody = document.getElementById('project-report-items-body');
  if (!tbody) return;

  const idx = tbody.querySelectorAll('.report-item-row').length;
  const tr = document.createElement('tr');
  tr.className = 'report-item-row';
  tr.dataset.index = idx;
  tr.innerHTML = `
    <td>
      <input type="text" class="form-control form-control-sm report-item-name font-bold" required placeholder="Nama Material Tambahan">
      <input type="hidden" class="report-item-unit-cost" value="0">
    </td>
    <td style="text-align: center;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
        <input type="number" step="any" class="form-control form-control-sm report-plan-qty text-center font-mono font-bold" style="width: 70px;" value="1" oninput="calculateReportItemRemaining(this)">
        <input type="text" class="form-control form-control-sm report-item-unit text-muted" style="width: 50px;" value="Pcs">
      </div>
    </td>
    <td>
      <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
        <input type="number" step="any" min="0" class="form-control form-control-sm report-actual-qty text-center font-mono font-bold" style="width: 80px; border-color: #2563eb;" value="1" required oninput="calculateReportItemRemaining(this)">
        <span class="font-xs text-muted" style="font-size: 11px;">Pcs</span>
      </div>
    </td>
    <td style="text-align: center;">
      <div class="remaining-badge-container">
        <span class="badge badge-secondary" style="font-size: 10.5px; padding: 2px 6px;">0 (Habis Pas)</span>
      </div>
      <input type="hidden" class="report-remaining-qty" value="0">
    </td>
    <td>
      <input type="text" class="form-control form-control-sm report-item-notes" placeholder="Catatan kondisi material">
    </td>
  `;
  tbody.appendChild(tr);
  updateAllReportCalculations();
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// 3. SUBMIT LAPORAN & KEMBALIKAN STOK KE DATABASE MASTER BARANG
// -------------------------------------------------------------
async function submitProjectReport(event, projectId) {
  event.preventDefault();
  const form = event.target;

  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Project tidak ditemukan!', 'error');
    return;
  }

  const existingReport = getLinkedProjectReport(p);
  const rows = document.querySelectorAll('#project-report-items-body .report-item-row');
  const items = [];
  const itemsToReturn = [];

  rows.forEach(r => {
    const itemName = r.querySelector('.report-item-name')?.value?.trim();
    const unit = r.querySelector('.report-item-unit')?.value?.trim() || 'Pcs';
    const unitCost = parseFloat(r.querySelector('.report-item-unit-cost')?.value) || 0;
    const planQty = parseFloat(r.querySelector('.report-plan-qty')?.value) || 0;
    const actualQty = parseFloat(r.querySelector('.report-actual-qty')?.value) || 0;
    const remainingQty = Math.max(0, planQty - actualQty);
    const notes = r.querySelector('.report-item-notes')?.value?.trim() || '';

    if (itemName) {
      const itemData = {
        itemName,
        unit,
        unitCost,
        planQty,
        actualQty,
        remainingQty,
        notes
      };
      items.push(itemData);

      if (remainingQty > 0) {
        itemsToReturn.push(itemData);
      }
    }
  });

  const reporterName = form.reporterName.value.trim();
  const reportDate = form.reportDate.value;
  const notes = form.notes.value.trim();

  const reportPayload = {
    id: existingReport?.id || `REP-${p.orderId || p.id}-${Date.now().toString().slice(-4)}`,
    projectId: p.id,
    orderId: p.orderId || p.id,
    projectName: p.projectName || 'Project',
    customerName: p.customerName || '-',
    reporterName,
    reportDate,
    notes,
    items,
    totalItems: items.length,
    returnedItemsCount: itemsToReturn.length,
    totalReturnedUnits: itemsToReturn.reduce((sum, it) => sum + it.remainingQty, 0),
    status: 'Completed',
    createdAt: existingReport?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    // 1. Simpan data laporan pelaksanaan project ke resource project_reports
    const reportUrl = existingReport?.id ? `/api/project_reports/${existingReport.id}` : '/api/project_reports';
    const reportMethod = existingReport?.id ? 'PUT' : 'POST';

    await fetch(reportUrl, {
      method: reportMethod,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportPayload)
    });

    // 2. Simpan referensi laporan pada project record
    p.actualUsageReport = reportPayload;
    if (p.id) {
      await fetch(`/api/projects/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, actualUsageReport: reportPayload })
      }).catch(e => console.warn('Error updating project report ref:', e));
    }

    // 3. JIKA ADA SISA MATERIAL, KEMBALIKAN KE DATABASE MASTER BARANG (PURCHASING)
    if (itemsToReturn.length > 0) {
      // Cari PR yang telah disetujui atau buat dokumen penambahan stok restock pengembalian sisa project
      const prList = state.purchasing || [];
      const approvedPRs = prList.filter(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');

      for (const retItem of itemsToReturn) {
        let updatedExisting = false;

        // Coba cari kecocokan item di approved PR yang ada
        for (const pr of approvedPRs) {
          const matchingItem = (pr.items || []).find(it => it.itemName?.toLowerCase() === retItem.itemName.toLowerCase());
          if (matchingItem) {
            matchingItem.qty = (parseFloat(matchingItem.qty) || 0) + retItem.remainingQty;
            matchingItem.total = matchingItem.qty * (parseFloat(matchingItem.estimatedPrice || matchingItem.unitPrice || retItem.unitCost) || 0);
            pr.totalEstimated = pr.items.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
            pr.notes = `${pr.notes ? pr.notes + ' | ' : ''}Restock +${retItem.remainingQty} ${retItem.unit} dari sisa Project #${p.id}`;
            
            await fetch(`/api/purchasing/${pr.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pr)
            }).catch(e => console.error('Error updating PR stock:', e));

            updatedExisting = true;
            break;
          }
        }

        // Jika barang belum ada di PR yang terdaftar, buat dokumen stok pengembalian material project baru
        if (!updatedExisting) {
          const returnPRDoc = {
            id: `PR-RET-${p.orderId || p.id}-${Date.now().toString().slice(-4)}-${Math.floor(10 + Math.random() * 90)}`,
            orderId: p.orderId || p.id,
            department: 'Gudang & Material Project',
            requestor: reporterName,
            requestDate: reportDate,
            status: 'Disetujui',
            notes: `Pengembalian sisa material pelaksanaan project ${p.projectName} (#${p.id}). ${retItem.notes || ''}`,
            items: [{
              itemName: retItem.itemName,
              specs: `Sisa Material Project #${p.id}`,
              qty: retItem.remainingQty,
              unit: retItem.unit,
              estimatedPrice: retItem.unitCost || 0,
              unitPrice: retItem.unitCost || 0,
              purchasePrice: retItem.unitCost || 0,
              actualPrice: retItem.unitCost || 0,
              itemStatus: 'Sesuai',
              total: retItem.remainingQty * (retItem.unitCost || 0)
            }],
            totalEstimated: retItem.remainingQty * (retItem.unitCost || 0)
          };

          await fetch('/api/purchasing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(returnPRDoc)
          }).catch(e => console.error('Error creating return PR doc:', e));
        }
      }
    }

    closeModal('form-modal');
    
    // Tampilkan notifikasi toast lengkap
    if (itemsToReturn.length > 0) {
      showToast(`✅ Laporan Pelaksanaan Project #${p.id} tersimpan! Sebanyak ${itemsToReturn.length} jenis sisa barang (+${reportPayload.totalReturnedUnits} unit) berhasil dikembalikan ke Database Master Barang Purchasing.`, 'success');
    } else {
      showToast(`✅ Laporan Pelaksanaan Project #${p.id} berhasil disimpan! Seluruh material terpakai sesuai rencana.`, 'success');
    }

    // Refresh state & render ulang tabel-tabel terkait
    await Promise.allSettled([
      fetchResource('project_reports'),
      fetchResource('projects'),
      fetchResource('purchasing')
    ]);

    renderProjectReportsTable();
    if (typeof renderPurchasingItemsTable === 'function') renderPurchasingItemsTable();
    if (typeof renderPurchasingTable === 'function') renderPurchasingTable();
    updateSidebarBadges();

  } catch (err) {
    console.error('Error submitting project report:', err);
    showToast('Terjadi kesalahan saat menyimpan laporan project', 'error');
  }
}

// -------------------------------------------------------------
// 4. DOKUMEN CETAK & DETAIL LAPORAN PELAKSANAAN PROJECT
// -------------------------------------------------------------
function viewProjectReportDetail(identifier) {
  if (!identifier) {
    showToast('ID project / laporan tidak valid!', 'error');
    return;
  }

  // 1. Cari project terkait di state.projects
  let project = (state.projects || []).find(p => 
    p.id === identifier || 
    p.orderId === identifier || 
    p.actualUsageReport?.id === identifier || 
    p.actualUsageReport?.projectId === identifier || 
    p.actualUsageReport?.orderId === identifier
  );

  // 2. Cari di state.project_reports
  let report = (state.project_reports || []).find(r => 
    r.id === identifier || 
    r.projectId === identifier || 
    r.orderId === identifier ||
    (project && (r.projectId === project.id || r.orderId === project.orderId))
  );

  // 3. Fallback: jika report belum ketemu di state.project_reports tapi ada di project.actualUsageReport
  if (!report && project && project.actualUsageReport) {
    report = project.actualUsageReport;
  }

  // 4. Fallback: jika report belum ketemu, cari di seluruh project yang memiliki actualUsageReport
  if (!report) {
    const pWithReport = (state.projects || []).find(p => 
      p.actualUsageReport && (
        p.actualUsageReport.id === identifier || 
        p.actualUsageReport.projectId === identifier || 
        p.actualUsageReport.orderId === identifier
      )
    );
    if (pWithReport) {
      report = pWithReport.actualUsageReport;
      if (!project) project = pWithReport;
    }
  }

  // 5. Jika project belum ketemu tapi ada di state.orders
  if (!project) {
    const ord = (state.orders || []).find(o => 
      o.id === identifier || (report && (o.id === report.orderId || o.id === report.projectId))
    );
    if (ord) {
      project = (state.projects || []).find(p => p.orderId === ord.id) || {
        id: `PRJ-${ord.id.replace('ORD-', '')}`,
        orderId: ord.id,
        projectName: ord.projectName || 'Project',
        customerName: ord.customerName || '-',
        projectLead: 'PIC Project',
        department: 'Engineering',
        status: 'Completed',
        progressPercent: 100
      };
    }
  }

  // 6. Jika report belum ada tapi project ada, otomatis generate dokumen laporan resmi dari Project & BOM
  if (!report && project) {
    const bom = getLinkedProjectBOM(project);
    const components = (bom && Array.isArray(bom.components)) ? bom.components : [];

    report = {
      id: `REP-${project.orderId || project.id}`,
      projectId: project.id,
      orderId: project.orderId || project.id,
      projectName: project.projectName || 'Project',
      customerName: project.customerName || '-',
      reporterName: project.projectLead || 'PIC Project',
      reportDate: new Date().toISOString().split('T')[0],
      notes: `Laporan pelaksanaan project ${project.projectName || ''}. Seluruh tahapan pengerjaan telah selesai 100% dan memenuhi standar spesifikasi.`,
      items: components.length > 0 ? components.map(c => ({
        itemName: c.componentName || c.itemName || 'Material',
        unit: c.unit || 'Pcs',
        unitCost: parseFloat(c.unitCost) || 0,
        planQty: parseFloat(c.qty) || 1,
        actualQty: parseFloat(c.qty) || 1,
        remainingQty: 0,
        notes: 'Terpakai sesuai BOM'
      })) : [
        {
          itemName: project.projectName || 'Item Pekerjaan Utama',
          unit: 'Unit',
          unitCost: 0,
          planQty: 1,
          actualQty: 1,
          remainingQty: 0,
          notes: 'Produksi Selesai 100%'
        }
      ],
      totalItems: components.length || 1,
      returnedItemsCount: 0,
      totalReturnedUnits: 0,
      status: 'Completed',
      createdAt: new Date().toISOString()
    };
  }

  // 7. Jika benar-benar tidak ditemukan baik report maupun project
  if (!report) {
    showToast('Data project / laporan tidak ditemukan!', 'error');
    return;
  }

  // Normalisasi data report jika beberapa field masih kosong
  report.projectName = report.projectName || project?.projectName || 'Project';
  report.customerName = report.customerName || project?.customerName || '-';
  report.reporterName = report.reporterName || project?.projectLead || 'PIC Project';
  report.projectId = report.projectId || project?.id || identifier;
  report.orderId = report.orderId || project?.orderId || '-';

  let content = document.getElementById('preview-modal-content');
  if (!content) {
    const body = document.getElementById('preview-modal-body');
    if (body) {
      body.innerHTML = '<div id="preview-modal-content"></div>';
      content = document.getElementById('preview-modal-content');
    }
  }
  if (!content) return;

  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) {
    titleEl.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 8px;"><i data-lucide="file-spreadsheet" style="color: #16a34a;"></i> Dokumen Laporan Pelaksanaan Project</span>';
  }

  const items = report.items || [];
  let returnedCount = 0;
  let returnedUnits = 0;
  items.forEach(it => {
    const rem = parseFloat(it.remainingQty) || 0;
    if (rem > 0) {
      returnedCount++;
      returnedUnits += rem;
    }
  });

  const rowsHtml = items.length === 0 ? `
    <tr>
      <td colspan="6" class="text-center text-muted" style="padding: 16px;">Tidak ada rincian bahan material dalam laporan ini.</td>
    </tr>
  ` : items.map((it, idx) => `
    <tr>
      <td style="text-align: center; font-size: 11.5px; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
      <td style="font-weight: 700; font-size: 12px; color: #1e293b; border: 1px solid #cbd5e1; padding: 6px;">${escapeHtml(it.itemName)}</td>
      <td style="text-align: center; font-family: monospace; font-size: 12px; border: 1px solid #cbd5e1; padding: 6px;">${it.planQty} ${escapeHtml(it.unit)}</td>
      <td style="text-align: center; font-family: monospace; font-weight: 700; color: #2563eb; font-size: 12px; border: 1px solid #cbd5e1; padding: 6px;">${it.actualQty} ${escapeHtml(it.unit)}</td>
      <td style="text-align: center; font-family: monospace; font-weight: 700; color: ${it.remainingQty > 0 ? '#16a34a' : '#64748b'}; font-size: 12px; border: 1px solid #cbd5e1; padding: 6px;">
        ${it.remainingQty > 0 ? `+${it.remainingQty} ${escapeHtml(it.unit)} (Restock)` : '0 (Habis)'}
      </td>
      <td style="font-size: 11.5px; color: #475569; border: 1px solid #cbd5e1; padding: 6px;">${escapeHtml(it.notes || '-')}</td>
    </tr>
  `).join('');

  content.innerHTML = `
    <!-- NO-PRINT HEADER ACTIONS -->
    <div class="no-print" style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="font-sm font-bold text-muted">Status Dokumen:</span>
        <span class="badge badge-success" style="font-weight: 700;"><i data-lucide="check-check" style="width: 13px; height: 13px; display: inline;"></i> Laporan Resmi Disetujui</span>
        ${returnedCount > 0 ? `
          <span class="badge badge-success font-bold">+${returnedUnits} Unit Dikembalikan ke Master Barang</span>
        ` : ''}
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('preview-modal'); openProjectReportModal('${report.projectId}')">
          <i data-lucide="edit-3"></i> Edit Data
        </button>
        <button type="button" class="btn btn-sm btn-primary" style="background: #0f766e; border-color: #0f766e; display: inline-flex; align-items: center; gap: 6px;" onclick="printCurrentDocument()">
          <i data-lucide="printer"></i> Cetak Dokumen PDF
        </button>
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="quotation-printable-area" class="print-container">
      <div class="print-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">PT. UNGGUL BERKAT MANUFACTURING</h1>
            <div style="font-size: 11px; color: #475569; margin-top: 3px;">Precision CNC, Fabrication, Automation & Engineering Solutions</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: #16a34a; letter-spacing: 0.5px;">LAPORAN PELAKSANAAN PROJECT</div>
            <div class="mono-id" style="font-size: 12px; color: #334155; margin-top: 2px;">No: ${report.id}</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; background: #f8fafc; padding: 12px 14px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 110px; color: #64748b; padding: 2px 0;">Nama Project:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(report.projectName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">Pelanggan / Client:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(report.customerName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">No. Ref Order:</td>
              <td style="font-family: monospace; font-weight: 600;">${report.orderId || '-'}</td>
            </tr>
          </table>
        </div>
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 110px; color: #64748b; padding: 2px 0;">Tanggal Laporan:</td>
              <td style="font-weight: 600;">${report.reportDate || '-'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">PIC Penanggung Jawab:</td>
              <td style="font-weight: 700; color: #2563eb;">${escapeHtml(report.reporterName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 2px 0;">Status Project:</td>
              <td><span style="background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 4px; font-size: 11px;">100% Completed</span></td>
            </tr>
          </table>
        </div>
      </div>

      <div style="margin-bottom: 18px;">
        <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">
          Tabel Rekonsiliasi Penggunaan Bahan & Material (BOM vs Aktual)
        </h4>
        <table class="data-table" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 11px;">
              <th style="width: 35px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">No</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">Nama Bahan / Material</th>
              <th style="width: 100px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">Rencana (BOM)</th>
              <th style="width: 100px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">Aktual Terpakai</th>
              <th style="width: 120px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">Sisa / Dikembalikan</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${report.notes ? `
        <div style="margin-bottom: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 12px;">
          <div style="font-weight: 700; color: #334155; margin-bottom: 4px;">Catatan Pelaksanaan & Hasil Uji:</div>
          <div style="color: #475569; line-height: 1.5;">${escapeHtml(report.notes)}</div>
        </div>
      ` : ''}

      <!-- SIGNATURE SECTION -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 32px; page-break-inside: avoid;">
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Dibuat Oleh (PIC Project),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(report.reporterName || 'PIC')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Engineering / Produksi</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Diterima Kembali (Gudang/PR),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            Bagian Logistik & Material
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Database Master Barang</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Mengetahui (Management),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            Project Manager / Direksi
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">UBM Management</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}
