// =========================================================
// UBM - Project Reports Module (Laporan Pelaksanaan Project)
// =========================================================

// Helper: Cek apakah project bertipe Jasa / Non-BOM
function isProjectService(p) {
  if (!p) return false;
  if (p.isService) return true;
  if (p.projectType === 'jasa' || p.quotationType === 'jasa') return true;
  if (p.orderId) {
    const order = (state.orders || []).find(o => o.id === p.orderId);
    if (order && (order.orderType === 'jasa' || order.quotationType === 'jasa' || (order.notes && order.notes.toLowerCase().includes('jasa')))) return true;
  }
  return false;
}

function isProjectFullyCompleted(project) {
  if (!project) return false;

  // 1. Project Jasa: Ketika pengeluaran jasa sudah disetujui di Keuangan Project, project otomatis masuk ke Laporan Project
  const isSvc = project.isService || isProjectService(project);
  if (isSvc) {
    const hasApprovedExpense = (state.service_expenses || []).some(exp => 
      (exp.orderId === project.orderId || exp.orderId === project.id || exp.id === project.id) &&
      (exp.status === 'Disetujui' || exp.status === 'Dicairkan')
    );
    if (hasApprovedExpense || project.serviceExpenseApproved) {
      return true;
    }
  }

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
  
  // Ambil project yang valid & completed, atau project jasa yang pengeluaran jasanya telah disetujui
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
            <div style="font-size: 12px; color: #94a3b8;">Project berstatus <strong>Completed</strong> atau Project Jasa yang biaya pengeluarannya telah <strong>Disetujui</strong> akan muncul di sini untuk dilaporkan oleh Lead.</div>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  tbody.innerHTML = completedProjects.map(p => {
    const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(p.id, activeUser) : true;
    const isSvc = p.isService || isProjectService(p);
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
          ${isSvc ? `<span class="badge" style="background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; font-size: 9.5px; padding: 1px 5px; margin-top: 3px; display: inline-block;">🛠️ Jasa</span>` : ''}
        </td>
        <td>
          <div class="font-bold text-main" style="word-break: break-word; font-size: 13px; color: #0f172a;">${escapeHtml(p.projectName || 'Project')}</div>
          <div class="text-muted font-sm" style="font-size: 11.5px; margin-top: 2px;"><i data-lucide="building" style="width: 11px; height: 11px; display: inline;"></i> ${escapeHtml(p.customerName || '-')}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 7px;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: ${isSvc ? '#ffedd5' : '#e0e7ff'}; color: ${isSvc ? '#c2410c' : '#4338ca'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0;">
              ${(p.projectLead || 'P').charAt(0)}
            </div>
            <div>
              <div class="font-bold text-main" style="font-size: 12px;">${escapeHtml(p.projectLead || 'Belum diassign')}</div>
              <div class="text-muted font-xs" style="font-size: 10px;">${escapeHtml(p.department || (isSvc ? 'Operasional Jasa' : 'Engineering'))}</div>
            </div>
          </div>
        </td>
        <td style="font-size: 11.5px; font-weight: 600; color: #334155;">
          ${dueDate}
        </td>
        <td style="text-align: center;">
          ${isSvc ? `
            <span class="badge" style="background: #fff7ed; color: #ea580c; border: 1px solid #fdba74; font-size: 10.5px; padding: 3px 8px; font-weight: 700;">
              <i data-lucide="wrench" style="width: 11px; height: 11px; display: inline; vertical-align: middle;"></i> Non-BOM (Tanpa BAST)
            </span>
          ` : (bom ? `
            <span class="badge badge-secondary font-mono" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
              <i data-lucide="boxes" style="width: 12px; height: 12px; display: inline; vertical-align: middle; color: #4f46e5;"></i> ${bomComponentsCount} Komponen
            </span>
          ` : `
            <span class="badge badge-outline" style="color: #94a3b8; font-size: 10.5px; border-color: #cbd5e1;">BOM Belum Ada</span>
          `)}
        </td>
        <td style="text-align: center;">
          ${isReported ? (
            returnedItemsCount > 0 
              ? `<span class="badge badge-success font-bold" style="font-size: 11px; padding: 3px 8px;"><i data-lucide="arrow-down-left" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> +${totalReturnedUnits} Unit (${returnedItemsCount} Jenis)</span>`
              : (isSvc 
                  ? `<span class="badge" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-size: 10.5px; padding: 3px 8px; font-weight: 700;">
                       <i data-lucide="paperclip" style="width: 11px; height: 11px; display: inline; vertical-align: middle;"></i> ${(report?.evidenceDocs?.length || 0)} Bukti / Foto
                     </span>` 
                  : '<span class="text-muted font-xs font-italic">Habis Terpakai (0 Sisa)</span>')
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
              ${isLead ? `
                <button class="btn-icon" style="width: 28px; height: 28px; border-radius: 4px;" title="Edit Laporan" onclick="openProjectReportModal('${p.id}')">
                  <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                </button>
              ` : ''}
            ` : (isLead ? `
              <button class="btn btn-sm btn-primary" style="background: ${isSvc ? '#ea580c' : '#16a34a'}; border-color: ${isSvc ? '#ea580c' : '#16a34a'}; font-size: 11px; padding: 4px 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="openProjectReportModal('${p.id}')" title="Input Hasil Pelaksanaan Project">
                <i data-lucide="${isSvc ? 'clipboard-check' : 'clipboard-check'}" style="width: 13px; height: 13px;"></i> ${isSvc ? 'Laporkan Hasil Jasa' : 'Input Barang'}
              </button>
            ` : `
              <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10.5px; border: 1px solid #cbd5e1;">Menunggu Lead</span>
            `)}
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
// 2. HELPER BUKTI TRANSPORT, MAKAN & DOKUMENTASI PROJECT JASA
// -------------------------------------------------------------
window._serviceEvidenceList = [];

window.compressEvidenceImage = function(file, maxWidth = 1280, maxHeight = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

window.handleServiceEvidenceUpload = async function(event, category) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const validFiles = Array.from(files);
  for (const file of validFiles) {
    try {
      const dataUrl = await window.compressEvidenceImage(file);
      const newEvidence = {
        id: 'evid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        category: category,
        fileName: file.name,
        fileType: file.type || 'image/jpeg',
        fileSize: file.size,
        dataUrl: dataUrl,
        description: '',
        amount: 0,
        uploadedAt: new Date().toISOString()
      };
      window._serviceEvidenceList.push(newEvidence);
    } catch (err) {
      console.warn('Gagal memproses bukti:', file.name, err);
    }
  }

  event.target.value = '';
  refreshServiceEvidenceContainers();
  if (window.lucide) lucide.createIcons();
};

window.updateServiceEvidenceItem = function(id, field, value) {
  const item = (window._serviceEvidenceList || []).find(e => e.id === id);
  if (item) {
    item[field] = value;
  }
  updateServiceEvidenceSummaryBanner();
};

window.removeServiceEvidenceItem = function(id) {
  window._serviceEvidenceList = (window._serviceEvidenceList || []).filter(e => e.id !== id);
  refreshServiceEvidenceContainers();
  if (window.lucide) lucide.createIcons();
};

window.viewServiceEvidenceFullImage = function(dataUrl, title) {
  let modalEl = document.getElementById('evidence-lightbox-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'evidence-lightbox-modal';
    modalEl.style.cssText = 'display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 20px;';
    modalEl.innerHTML = `
      <div style="background: #ffffff; border-radius: 8px; max-width: 900px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
          <div id="evidence-lightbox-title" style="font-weight: 700; font-size: 13.5px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Bukti Lampiran</div>
          <button type="button" class="btn-close" onclick="closeServiceEvidenceLightbox()" style="border: none; background: transparent; cursor: pointer; font-size: 18px; color: #64748b; font-weight: 700;">✕</button>
        </div>
        <div style="padding: 16px; overflow: auto; text-align: center; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 250px;">
          <img id="evidence-lightbox-img" src="" alt="Pratinjau Bukti" style="max-width: 100%; max-height: 75vh; border-radius: 4px; object-fit: contain;">
        </div>
      </div>
    `;
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) window.closeServiceEvidenceLightbox();
    });
    document.body.appendChild(modalEl);
  }

  const imgEl = document.getElementById('evidence-lightbox-img');
  const titleEl = document.getElementById('evidence-lightbox-title');
  if (imgEl) imgEl.src = dataUrl;
  if (titleEl) titleEl.innerText = title || 'Pratinjau Bukti Lampiran';
  modalEl.style.display = 'flex';
};

window.closeServiceEvidenceLightbox = function() {
  const modalEl = document.getElementById('evidence-lightbox-modal');
  if (modalEl) modalEl.style.display = 'none';
};

function renderServiceEvidenceCard(item) {
  const isImage = item.dataUrl && (item.dataUrl.startsWith('data:image/') || item.fileType?.startsWith('image/'));
  const isTransportOrMeal = item.category === 'transport' || item.category === 'meal';

  return `
    <div class="evidence-item-card" data-id="${item.id}" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
      <!-- THUMBNAIL / PREVIEW -->
      <div style="width: 58px; height: 58px; border-radius: 4px; overflow: hidden; background: #f1f5f9; border: 1px solid #cbd5e1; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="viewServiceEvidenceFullImage('${item.dataUrl}', '${escapeAttr(item.description || item.fileName)}')" title="Klik untuk memperbesar gambar">
        ${isImage ? `
          <img src="${item.dataUrl}" alt="Thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
        ` : `
          <div style="font-size: 10px; font-weight: 700; color: #dc2626; text-align: center;">
            <i data-lucide="file-text" style="width: 22px; height: 22px; margin: 0 auto; display: block;"></i>
            PDF
          </div>
        `}
      </div>

      <!-- DETAILS & INPUT DESKRIPSI -->
      <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <div style="font-weight: 600; font-size: 11.5px; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttr(item.fileName)}">
            ${escapeHtml(item.fileName)}
          </div>
          <button type="button" class="btn btn-sm btn-icon" style="color: #ef4444; padding: 2px 4px; height: 24px; width: 24px; border-radius: 4px;" onclick="removeServiceEvidenceItem('${item.id}')" title="Hapus Bukti Ini">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <div style="flex: 1; min-width: 200px;">
            <input type="text" 
                   class="form-control form-control-sm evid-desc-input font-sm" 
                   data-id="${item.id}"
                   placeholder="Deskripsi bukti ini (contoh: ${item.category === 'transport' ? 'Bensin tol PP Cikampek' : (item.category === 'meal' ? 'Makan siang tim 3 orang di lokasi' : 'Foto instalasi unit di site')})" 
                   value="${escapeAttr(item.description || '')}"
                   oninput="updateServiceEvidenceItem('${item.id}', 'description', this.value)">
          </div>

          ${isTransportOrMeal ? `
            <div style="display: flex; align-items: center; gap: 4px; width: 145px;">
              <span class="font-xs text-muted" style="font-size: 11px;">Rp</span>
              <input type="number" 
                     class="form-control form-control-sm evid-amt-input font-mono text-right" 
                     data-id="${item.id}"
                     placeholder="Nominal" 
                     value="${item.amount || ''}"
                     oninput="updateServiceEvidenceItem('${item.id}', 'amount', parseFloat(this.value)||0)">
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function refreshServiceEvidenceContainers() {
  const list = window._serviceEvidenceList || [];
  
  const transportItems = list.filter(e => e.category === 'transport');
  const mealItems = list.filter(e => e.category === 'meal');
  const docItems = list.filter(e => e.category === 'documentation');

  const transportContainer = document.getElementById('evidence-list-transport');
  if (transportContainer) {
    transportContainer.innerHTML = transportItems.length === 0 
      ? '<div style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 12px 14px; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; background: #fafafa;">Belum ada bukti transportasi yang diunggah. Klik tombol di atas untuk menambah struk bensin, tol, tiket, taksi, dll.</div>'
      : transportItems.map(renderServiceEvidenceCard).join('');
  }

  const mealContainer = document.getElementById('evidence-list-meal');
  if (mealContainer) {
    mealContainer.innerHTML = mealItems.length === 0
      ? '<div style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 12px 14px; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; background: #fafafa;">Belum ada bukti makan & konsumsi yang diunggah. Klik tombol di atas untuk menambah struk makan tim.</div>'
      : mealItems.map(renderServiceEvidenceCard).join('');
  }

  const docContainer = document.getElementById('evidence-list-documentation');
  if (docContainer) {
    docContainer.innerHTML = docItems.length === 0
      ? '<div style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 12px 14px; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; background: #fafafa;">Belum ada foto dokumentasi yang diunggah. Klik tombol di atas untuk mengunggah foto aktivitas pengerjaan dan serah terima site.</div>'
      : docItems.map(renderServiceEvidenceCard).join('');
  }

  updateServiceEvidenceSummaryBanner();
}

function updateServiceEvidenceSummaryBanner() {
  const list = window._serviceEvidenceList || [];
  const totalCount = list.length;
  const transportCount = list.filter(e => e.category === 'transport').length;
  const mealCount = list.filter(e => e.category === 'meal').length;
  const docCount = list.filter(e => e.category === 'documentation').length;

  const totalTransportAmt = list.filter(e => e.category === 'transport').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalMealAmt = list.filter(e => e.category === 'meal').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalExpenseAmt = totalTransportAmt + totalMealAmt;

  const summarySubtitle = document.getElementById('service-evidence-summary-subtitle');
  if (summarySubtitle) {
    summarySubtitle.innerHTML = totalCount > 0
      ? `Terlampir <strong>${totalCount} berkas bukti</strong> (${transportCount} Transport, ${mealCount} Makan, ${docCount} Dokumentasi Lapangan).`
      : 'Belum ada bukti yang dilampirkan. Anda dapat mengunggah struk pengeluaran dan foto hasil kerja.';
  }

  const summaryStats = document.getElementById('service-evidence-summary-stats');
  if (summaryStats) {
    summaryStats.innerHTML = `
      <div style="background: #ffffff; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 4px;">
        Total Berkas: <strong class="text-main">${totalCount} File</strong>
      </div>
      <div style="background: #ffffff; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 4px;">
        Total Biaya Transport & Makan: <strong style="color: #ea580c; font-weight: 700;">Rp ${totalExpenseAmt.toLocaleString('id-ID')}</strong>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// 2B. MODAL FORMULIR PENGGUNAAN BARANG / BUKTI PELAKSANAAN JASA
// -------------------------------------------------------------
function openProjectReportModal(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan!', 'error');
    return;
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(p.id, activeUser) : true;
  if (!isLead) {
    showToast(`⚠️ Hanya akun yang ditugaskan sebagai Lead Project (${escapeHtml(p.projectLead || 'Lead')}) atau Administrator yang berwenang mengisi Laporan Pelaksanaan Project.`, 'warning');
    return;
  }

  const isSvc = p.isService || isProjectService(p);
  const bom = getLinkedProjectBOM(p);
  const existingReport = getLinkedProjectReport(p);
  const isEdit = Boolean(existingReport);

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '1050px';
    modalContainer.style.width = '94vw';
  }

  document.getElementById('form-modal-title').innerHTML = isSvc
    ? `<span style="display: inline-flex; align-items: center; gap: 8px; font-size: 16px;">
        <i data-lucide="wrench" style="color: #ea580c;"></i>
        ${isEdit ? `Edit Laporan Hasil Pelaksanaan Jasa: <span class="mono-id">${p.id}</span>` : `Input Laporan Hasil Pelaksanaan Jasa: <span class="mono-id">${p.id}</span>`}
       </span>`
    : `<span style="display: inline-flex; align-items: center; gap: 8px; font-size: 16px;">
        <i data-lucide="clipboard-check" style="color: #16a34a;"></i>
        ${isEdit ? `Edit Laporan Penggunaan Barang: <span class="mono-id">${p.id}</span>` : `Input Penggunaan Barang Aktual: <span class="mono-id">${p.id}</span>`}
       </span>`;

  const defaultReporter = existingReport?.reporterName || p.projectLead || 'PIC Operasional';
  const defaultReportDate = existingReport?.reportDate || new Date().toISOString().split('T')[0];
  const defaultNotes = existingReport?.notes || (isSvc 
    ? `Pelaksanaan layanan jasa ${p.projectName || ''} telah terlaksana dengan baik sesuai lingkup penugasan. Tidak memerlukan dokumen BAST.`
    : `Laporan aktual penggunaan bahan & material project ${p.projectName || ''}.`);

  const formBody = document.getElementById('form-modal-body');

  // ===============================================================
  // CABANG 1: KHUSUS PROJECT JASA (UPLOAD BUKTI TRANSPORT, MAKAN, DOKUMENTASI & DESKRIPSI)
  // ===============================================================
  if (isSvc) {
    // Inisialisasi daftar bukti dari laporan sebelumnya jika ada
    window._serviceEvidenceList = (existingReport && Array.isArray(existingReport.evidenceDocs))
      ? JSON.parse(JSON.stringify(existingReport.evidenceDocs))
      : [];

    const defaultOverallDesc = existingReport?.overallDescription || existingReport?.notes || '';

    formBody.innerHTML = `
      <form id="project-report-form" onsubmit="submitProjectReport(event, '${p.id}')" style="display: flex; flex-direction: column; gap: 18px;">
        
        <!-- CARD 1: INFORMASI PROJECT & PIC PELAPOR -->
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="mono-id font-bold text-primary" style="font-size: 13px;">${p.id}</span>
                ${p.orderId ? `<span class="badge badge-outline font-mono">Ref Order: ${p.orderId}</span>` : ''}
                <span class="badge badge-warning font-bold" style="background: #ffedd5; color: #c2410c; border: 1px solid #fdba74;">
                  🛠️ Layanan Jasa (Biaya Disetujui)
                </span>
                <span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10.5px; font-weight: 700;">
                  Tanpa Dokumen BAST
                </span>
              </div>
              <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">${escapeHtml(p.projectName || 'Project')}</h3>
              <div style="font-size: 12px; color: var(--text-muted);">
                Pelanggan: <strong class="text-main">${escapeHtml(p.customerName || '-')}</strong>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; color: var(--text-muted);">Alur Project:</div>
              <div style="font-size: 12.5px; font-weight: 700; color: #ea580c;">
                Layanan Jasa (Non-BOM • Langsung ke Kerjasama)
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 14px; border-top: 1px solid #fed7aa; padding-top: 12px;">
            <div class="form-group">
              <label class="form-label font-bold" style="font-size: 11.5px;">PIC Pengisi Laporan Jasa *</label>
              <select name="reporterName" class="form-control" required>
                ${(typeof getUserDropdownOptions === 'function')
                    ? getUserDropdownOptions(defaultReporter, '-- Pilih PIC Pengisi Laporan --')
                    : `<option value="${escapeAttr(defaultReporter)}">${escapeHtml(defaultReporter)}</option>`}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label font-bold" style="font-size: 11.5px;">Tanggal Pelaporan *</label>
              <input type="date" name="reportDate" class="form-control" required value="${defaultReportDate}">
            </div>
            <div class="form-group">
              <label class="form-label font-bold" style="font-size: 11.5px;">Ringkasan Status Pelaksanaan</label>
              <input type="text" name="notes" class="form-control" value="${escapeAttr(defaultNotes)}" placeholder="Contoh: Pekerjaan pendampingan selesai 100% dan diterima baik">
            </div>
          </div>
        </div>

        <!-- CARD 2: INPUT DESKRIPSI LAPORAN MENYELURUH -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label font-bold" style="font-size: 13px; color: #0f172a; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <i data-lucide="file-text" style="width: 16px; height: 16px; color: #ea580c;"></i>
              Deskripsi Laporan Menyeluruh Hasil Pelaksanaan Jasa *
            </label>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
              Uraikan ringkasan menyeluruh mengenai pekerjaan jasa yang telah diselesaikan: ruang lingkup tugas, personil yang bertugas, kendala & solusi di site, konfirmasi kepuasan pelanggan, serta evaluasi hasil pelaksanaan.
            </div>
            <textarea name="overallDescription" class="form-control font-sm" rows="4" style="line-height: 1.6; border-color: #fdba74; font-size: 12.5px;" placeholder="Tuliskan uraian menyeluruh pelaksanaan jasa di sini..." required>${escapeHtml(defaultOverallDesc)}</textarea>
          </div>
        </div>

        <!-- CARD 3: UPLOAD BUKTI TRANSPORTASI -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h4 style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="car" style="width: 16px; height: 16px; color: #0284c7;"></i>
                Bukti Transportasi & Perjalanan Dinas
              </h4>
              <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">
                Unggah struk bensin, tiket tol, tiket transportasi umum, karcis parkir, atau nota kendaraan operasional.
              </p>
            </div>
            <div>
              <label class="btn btn-sm btn-outline" style="cursor: pointer; font-size: 11px; color: #0284c7; border-color: #bae6fd; background: #f0f9ff; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
                <i data-lucide="upload-cloud" style="width: 14px; height: 14px;"></i> + Upload Bukti Transport
                <input type="file" multiple accept="image/*,application/pdf" style="display: none;" onchange="handleServiceEvidenceUpload(event, 'transport')">
              </label>
            </div>
          </div>
          <div id="evidence-list-transport"></div>
        </div>

        <!-- CARD 4: UPLOAD BUKTI MAKAN & KONSUMSI TIM -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h4 style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="utensils" style="width: 16px; height: 16px; color: #d97706;"></i>
                Bukti Makan & Konsumsi Tim
              </h4>
              <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">
                Unggah struk makan siang/malam, konsumsi lembur, atau logistik konsumsi tim selama pelaksanaan jasa di site.
              </p>
            </div>
            <div>
              <label class="btn btn-sm btn-outline" style="cursor: pointer; font-size: 11px; color: #d97706; border-color: #fde68a; background: #fffbeb; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
                <i data-lucide="upload-cloud" style="width: 14px; height: 14px;"></i> + Upload Bukti Makan
                <input type="file" multiple accept="image/*,application/pdf" style="display: none;" onchange="handleServiceEvidenceUpload(event, 'meal')">
              </label>
            </div>
          </div>
          <div id="evidence-list-meal"></div>
        </div>

        <!-- CARD 5: UPLOAD FOTO DOKUMENTASI KEGIATAN LAPANGAN & LAINNYA -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h4 style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="camera" style="width: 16px; height: 16px; color: #16a34a;"></i>
                Foto Dokumentasi Kegiatan Lapangan & Lainnya
              </h4>
              <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">
                Unggah foto aktivitas teknisi di lokasi, foto bersama PIC Klien, kondisi instalasi/mesin, atau berita serah terima lapangan.
              </p>
            </div>
            <div>
              <label class="btn btn-sm btn-outline" style="cursor: pointer; font-size: 11px; color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
                <i data-lucide="upload-cloud" style="width: 14px; height: 14px;"></i> + Upload Foto Dokumentasi
                <input type="file" multiple accept="image/*,application/pdf" style="display: none;" onchange="handleServiceEvidenceUpload(event, 'documentation')">
              </label>
            </div>
          </div>
          <div id="evidence-list-documentation"></div>
        </div>

        <!-- CARD 6: REALTIME SUMMARY BUKTI TERLAMPIR -->
        <div id="service-evidence-summary-box" style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffedd5; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="paperclip" style="width: 16px; height: 16px; color: #ea580c;"></i>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 12.5px; color: #9a3412;" id="service-evidence-summary-title">Ringkasan Bukti & Biaya Operasional Jasa</div>
              <div style="font-size: 11px; color: #c2410c;" id="service-evidence-summary-subtitle">Memuat ringkasan bukti...</div>
            </div>
          </div>
          <div id="service-evidence-summary-stats" style="display: flex; gap: 14px; font-size: 12px;"></div>
        </div>

        <!-- FOOTER ACTIONS -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">
            <i data-lucide="x"></i> Batal
          </button>
          <button type="submit" class="btn btn-primary" style="background: #ea580c; border-color: #ea580c; font-weight: 700; padding: 8px 20px; font-size: 13px;">
            <i data-lucide="check-circle-2"></i> Simpan Laporan & Masukkan ke Pembagian Hasil Kerjasama
          </button>
        </div>
      </form>
    `;

    openModal('form-modal');
    refreshServiceEvidenceContainers();
    if (window.lucide) lucide.createIcons();
    return;
  }

  // ===============================================================
  // CABANG 2: PROJECT MANUFAKTUR / BOM (TABEL MATERIAL & RESTOCK SISA)
  // ===============================================================
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

  formBody.innerHTML = `
    <form id="project-report-form" onsubmit="submitProjectReport(event, '${p.id}')" style="display: flex; flex-direction: column; gap: 18px;">
      
      <!-- CARD 1: INFORMASI PROJECT & PIC PELAPOR -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="mono-id font-bold text-primary" style="font-size: 13px;">${p.id}</span>
              ${p.orderId ? `<span class="badge badge-outline font-mono">Ref Order: ${p.orderId}</span>` : ''}
              <span class="badge badge-success font-bold">
                Project Selesai (Completed)
              </span>
            </div>
            <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">${escapeHtml(p.projectName || 'Project')}</h3>
            <div style="font-size: 12px; color: var(--text-muted);">
              Pelanggan: <strong class="text-main">${escapeHtml(p.customerName || '-')}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--text-muted);">Referensi Master BOM:</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #4f46e5;">
              ${bom ? `${bom.id || 'BOM Terkait'} (${componentsList.length} Bahan)` : 'BOM Tidak Terhubung'}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          <div class="form-group">
            <label class="form-label font-bold" style="font-size: 11.5px;">PIC Pengisi Laporan *</label>
            <select name="reporterName" class="form-control" required>
              ${(typeof getUserDropdownOptions === 'function')
                  ? getUserDropdownOptions(defaultReporter, '-- Pilih PIC Pengisi Laporan --')
                  : `<option value="${escapeAttr(defaultReporter)}">${escapeHtml(defaultReporter)}</option>`}
            </select>
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
              <i data-lucide="boxes" style="width: 16px; height: 16px; color: #4f46e5;"></i>
              Rincian Penggunaan Barang Aktual & Pengembalian Sisa
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

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(projectId, activeUser) : true;
  if (!isLead) {
    showToast(`⚠️ Hanya Lead Project (${escapeHtml(p.projectLead || 'Lead Project')}) atau Administrator yang berwenang menyimpan Laporan Project.`, 'warning');
    return;
  }

  const isSvc = p.isService || isProjectService(p);
  const existingReport = getLinkedProjectReport(p);

  const reporterName = form.reporterName?.value?.trim() || p.projectLead || 'PIC Project';
  const reportDate = form.reportDate?.value || new Date().toISOString().split('T')[0];
  const notes = form.notes?.value?.trim() || '';

  let reportPayload;
  let itemsToReturn = [];

  // ===============================================================
  // JIKA PROJECT JASA: SIMPAN BUKTI TRANSPORT, MAKAN, DOKUMENTASI & DESKRIPSI
  // ===============================================================
  if (isSvc) {
    // Sinkronkan input deskripsi & amount terbaru dari kartu-kartu bukti di DOM
    if (Array.isArray(window._serviceEvidenceList)) {
      window._serviceEvidenceList.forEach(item => {
        const descEl = document.querySelector(`.evid-desc-input[data-id="${item.id}"]`);
        if (descEl) item.description = descEl.value.trim();
        const amtEl = document.querySelector(`.evid-amt-input[data-id="${item.id}"]`);
        if (amtEl) item.amount = parseFloat(amtEl.value) || 0;
      });
    }

    const overallDescription = form.overallDescription ? form.overallDescription.value.trim() : '';
    if (!overallDescription) {
      showToast('⚠️ Harap isi Deskripsi Laporan Menyeluruh Hasil Pelaksanaan Jasa!', 'warning');
      return;
    }

    const evidenceDocs = window._serviceEvidenceList || [];
    const totalTransportAmount = evidenceDocs
      .filter(e => e.category === 'transport')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalMealAmount = evidenceDocs
      .filter(e => e.category === 'meal')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    reportPayload = {
      id: existingReport?.id || `REP-${p.orderId || p.id}-${Date.now().toString().slice(-4)}`,
      projectId: p.id,
      orderId: p.orderId || p.id,
      projectName: p.projectName || 'Project',
      customerName: p.customerName || '-',
      reporterName,
      reportDate,
      notes: notes || overallDescription,
      overallDescription,
      evidenceDocs,
      isServiceReport: true,
      totalEvidenceCount: evidenceDocs.length,
      totalTransportAmount,
      totalMealAmount,
      items: [],
      totalItems: 0,
      returnedItemsCount: 0,
      totalReturnedUnits: 0,
      status: 'Completed',
      createdAt: existingReport?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    // ===============================================================
    // JIKA PROJECT MANUFAKTUR: HITUNG PENGGUNAAN MATERIAL BOM & RESTOCK
    // ===============================================================
    const rows = document.querySelectorAll('#project-report-items-body .report-item-row');
    const items = [];

    rows.forEach(r => {
      const itemName = r.querySelector('.report-item-name')?.value?.trim();
      const unit = r.querySelector('.report-item-unit')?.value?.trim() || 'Pcs';
      const unitCost = parseFloat(r.querySelector('.report-item-unit-cost')?.value) || 0;
      const planQty = parseFloat(r.querySelector('.report-plan-qty')?.value) || 0;
      const actualQty = parseFloat(r.querySelector('.report-actual-qty')?.value) || 0;
      const remainingQty = Math.max(0, planQty - actualQty);
      const rowNotes = r.querySelector('.report-item-notes')?.value?.trim() || '';

      if (itemName) {
        const itemData = {
          itemName,
          unit,
          unitCost,
          planQty,
          actualQty,
          remainingQty,
          notes: rowNotes
        };
        items.push(itemData);

        if (remainingQty > 0) {
          itemsToReturn.push(itemData);
        }
      }
    });

    reportPayload = {
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
  }

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
    const isSvc = p.isService || isProjectService(p);
    if (isSvc) {
      p.status = 'Completed';
      p.progressPercent = 100;
    }
    if (p.id) {
      await fetch(`/api/projects/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...p, 
          actualUsageReport: reportPayload,
          status: isSvc ? 'Completed' : p.status,
          progressPercent: isSvc ? 100 : p.progressPercent
        })
      }).catch(e => console.warn('Error updating project report ref:', e));
    }

    // 2B. JIKA PROJECT JASA: OTOMATIS MASUK KE PEMBAGIAN HASIL (TAB KERJASAMA DI KEUANGAN PROJECT)
    if (isSvc) {
      try {
        const order = (state.orders || []).find(o => o.id === p.orderId || o.id === p.id);
        const quo = order?.quotationId ? (state.quotations || []).find(q => q.id === order.quotationId) : null;
        let billedAmount = parseFloat(order?.totalAmount || order?.grandTotal || quo?.totalPrice || 0);
        if (!billedAmount && order && Array.isArray(order.items)) {
          billedAmount = order.items.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
        }

        state.partnerships = state.partnerships || [];
        const existingPartner = state.partnerships.find(pt => 
          pt.orderId === (p.orderId || p.id) || 
          pt.projectId === p.id || 
          pt.invoiceRef === (p.orderId || p.id) ||
          (pt.serviceName && pt.serviceName.toLowerCase() === (p.projectName || '').toLowerCase())
        );

        if (!existingPartner) {
          const activePct = (typeof getPartnershipPercentages === 'function') 
            ? getPartnershipPercentages() 
            : { takumi: 65, sales: 15, adminTax: 10, freelance: 10 };

          const partnerDoc = {
            id: `PTS-${p.orderId || p.id}-${Date.now().toString().slice(-4)}`,
            date: reportDate || new Date().toISOString().split('T')[0],
            paymentStatus: order?.paymentStatus === 'Lunas' ? 'Lunas' : 'Belum Lunas',
            serviceName: p.projectName || order?.notes || 'Pelaksanaan Layanan Jasa',
            clientName: p.customerName || '-',
            billedAmount: billedAmount > 0 ? billedAmount : 0,
            orderId: p.orderId || p.id,
            projectId: p.id,
            invoiceRef: p.orderId || p.id,
            percentages: activePct,
            contributions: {
              takumi: { takumi: true, ayumi: false },
              sales: { takumi: true, ayumi: false },
              adminTax: { takumi: false, ayumi: true },
              freelance: { takumi: true, ayumi: false }
            },
            notes: `Otomatis dari Laporan Pelaksanaan Jasa #${reportPayload.id} (PIC: ${reporterName})`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await fetch('/api/partnerships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partnerDoc)
          }).catch(e => console.warn('Sync partnership error:', e));

          state.partnerships.unshift(partnerDoc);
        }
      } catch (partErr) {
        console.warn('Error creating partnership entry:', partErr);
      }
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
    if (isSvc) {
      showToast(`✅ Laporan Pelaksanaan Jasa #${p.id} tersimpan! Project berhasil masuk ke Pembagian Hasil pada tab Kerjasama Keuangan Project.`, 'success');
    } else if (itemsToReturn.length > 0) {
      showToast(`✅ Laporan Pelaksanaan Project #${p.id} tersimpan! Sebanyak ${itemsToReturn.length} jenis sisa barang (+${reportPayload.totalReturnedUnits} unit) berhasil dikembalikan ke Database Master Barang Purchasing.`, 'success');
    } else {
      showToast(`✅ Laporan Pelaksanaan Project #${p.id} berhasil disimpan! Seluruh material terpakai sesuai rencana.`, 'success');
    }

    // Refresh state & render ulang tabel-tabel terkait
    await Promise.allSettled([
      fetchResource('project_reports'),
      fetchResource('projects'),
      fetchResource('purchasing'),
      fetchResource('partnerships')
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

  const isSvcReport = report.isServiceReport || (project && (project.isService || isProjectService(project)));

  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) {
    titleEl.innerHTML = isSvcReport
      ? '<span style="display: inline-flex; align-items: center; gap: 8px;"><i data-lucide="wrench" style="color: #ea580c;"></i> Dokumen Laporan Pelaksanaan Layanan Jasa</span>'
      : '<span style="display: inline-flex; align-items: center; gap: 8px;"><i data-lucide="file-spreadsheet" style="color: #16a34a;"></i> Dokumen Laporan Pelaksanaan Project</span>';
  }

  // ===============================================================
  // TAMPILAN 1: DOKUMEN LAPORAN HASIL PELAKSANAAN LAYANAN JASA
  // ===============================================================
  if (isSvcReport) {
    const evidenceList = Array.isArray(report.evidenceDocs) ? report.evidenceDocs : [];
    const transportItems = evidenceList.filter(e => e.category === 'transport');
    const mealItems = evidenceList.filter(e => e.category === 'meal');
    const docItems = evidenceList.filter(e => e.category === 'documentation');

    const totalTransport = transportItems.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalMeal = mealItems.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalOps = totalTransport + totalMeal;

    const overallDescription = report.overallDescription || report.notes || '-';

    content.innerHTML = `
      <!-- NO-PRINT HEADER ACTIONS -->
      <div class="no-print" style="background: #fff7ed; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border: 1px solid #fed7aa;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="font-sm font-bold text-muted">Status:</span>
          <span class="badge" style="background: #ea580c; color: #ffffff; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="check-check" style="width: 13px; height: 13px;"></i> Laporan Jasa Selesai (Non-BAST)
          </span>
          <span class="badge font-bold" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
            ${evidenceList.length} Lampiran Bukti
          </span>
          ${totalOps > 0 ? `
            <span class="badge font-bold" style="background: #ffedd5; color: #c2410c; border: 1px solid #fdba74;">
              Klaim Bukti: Rp ${totalOps.toLocaleString('id-ID')}
            </span>
          ` : ''}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('preview-modal'); openProjectReportModal('${report.projectId}')">
            <i data-lucide="edit-3"></i> Edit Data
          </button>
          <button type="button" class="btn btn-sm btn-primary" style="background: #ea580c; border-color: #ea580c; display: inline-flex; align-items: center; gap: 6px; font-weight: 700;" onclick="printCurrentDocument()">
            <i data-lucide="printer"></i> Cetak Dokumen PDF
          </button>
        </div>
      </div>

      <!-- MAIN PRINTABLE DOCUMENT -->
      <div id="quotation-printable-area" class="print-container">
        <!-- HEADER PERUSAHAAN -->
        <div class="print-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">PT. UNGGUL BERKAT MANUFACTURING</h1>
              <div style="font-size: 11px; color: #475569; margin-top: 3px;">Precision CNC, Fabrication, Automation & Technical Services</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 15px; font-weight: 800; color: #ea580c; letter-spacing: 0.5px;">LAPORAN HASIL PELAKSANAAN JASA</div>
              <div class="mono-id" style="font-size: 12px; color: #334155; margin-top: 2px;">No: ${report.id}</div>
            </div>
          </div>
        </div>

        <!-- INFO PROJECT JASA -->
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; background: #fff7ed; padding: 12px 14px; border-radius: 6px; border: 1px solid #fed7aa; font-size: 12px;">
          <div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 125px; color: #7c2d12; padding: 2px 0;">Layanan / Project:</td>
                <td style="font-weight: 700; color: #0f172a;">${escapeHtml(report.projectName)}</td>
              </tr>
              <tr>
                <td style="color: #7c2d12; padding: 2px 0;">Klien / Pelanggan:</td>
                <td style="font-weight: 700; color: #0f172a;">${escapeHtml(report.customerName)}</td>
              </tr>
              <tr>
                <td style="color: #7c2d12; padding: 2px 0;">No. Ref Order:</td>
                <td style="font-family: monospace; font-weight: 600;">${report.orderId || '-'}</td>
              </tr>
            </table>
          </div>
          <div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 120px; color: #7c2d12; padding: 2px 0;">Tanggal Laporan:</td>
                <td style="font-weight: 600;">${report.reportDate || '-'}</td>
              </tr>
              <tr>
                <td style="color: #7c2d12; padding: 2px 0;">PIC Pelaksana Jasa:</td>
                <td style="font-weight: 700; color: #ea580c;">${escapeHtml(report.reporterName || '-')}</td>
              </tr>
              <tr>
                <td style="color: #7c2d12; padding: 2px 0;">Status Pelaksanaan:</td>
                <td><span style="background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 4px; font-size: 11px;">100% Selesai (Non-BAST)</span></td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 1. DESKRIPSI LAPORAN MENYELURUH -->
        <div style="margin-bottom: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px;">
          <div style="font-weight: 800; font-size: 12.5px; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 15px; height: 15px; color: #ea580c;"></i>
            1. Uraian & Deskripsi Menyeluruh Hasil Pelaksanaan Jasa
          </div>
          <div style="font-size: 12px; color: #1e293b; line-height: 1.65; white-space: pre-wrap; background: #f8fafc; padding: 12px 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
            ${escapeHtml(overallDescription)}
          </div>
        </div>

        <!-- 2. LAMPIRAN BUKTI BIAYA TRANSPORTASI -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 800; font-size: 12.5px; color: #0f172a; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="car" style="width: 15px; height: 15px; color: #0284c7;"></i>
              2. Lampiran Bukti Biaya Transportasi & Perjalanan Dinas
            </div>
            ${totalTransport > 0 ? `
              <div style="font-size: 11.5px; font-weight: 700; color: #0369a1;">
                Total Transport: Rp ${totalTransport.toLocaleString('id-ID')}
              </div>
            ` : ''}
          </div>

          ${transportItems.length === 0 ? `
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; font-size: 11.5px; color: #94a3b8; font-style: italic; text-align: center;">
              Tidak ada bukti klaim transportasi terlampir pada laporan ini.
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
              ${transportItems.map((item, idx) => `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; display: flex; gap: 10px; align-items: flex-start;">
                  <div style="width: 65px; height: 65px; border-radius: 4px; overflow: hidden; background: #f1f5f9; border: 1px solid #cbd5e1; flex-shrink: 0; cursor: pointer;" onclick="viewServiceEvidenceFullImage('${item.dataUrl}', '${escapeAttr(item.description || item.fileName)}')" title="Klik untuk memperbesar">
                    ${(item.dataUrl && (item.dataUrl.startsWith('data:image/') || item.fileType?.startsWith('image/'))) ? `
                      <img src="${item.dataUrl}" alt="Struk" style="width: 100%; height: 100%; object-fit: cover;">
                    ` : `
                      <div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #dc2626;">PDF</div>
                    `}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 11.5px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                      #${idx + 1} ${escapeHtml(item.description || item.fileName)}
                    </div>
                    ${item.amount ? `
                      <div style="font-family: monospace; font-size: 12px; font-weight: 700; color: #0284c7;">
                        Rp ${Number(item.amount).toLocaleString('id-ID')}
                      </div>
                    ` : ''}
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${escapeHtml(item.fileName)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 3. LAMPIRAN BUKTI BIAYA MAKAN & KONSUMSI TIM -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 800; font-size: 12.5px; color: #0f172a; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="utensils" style="width: 15px; height: 15px; color: #d97706;"></i>
              3. Lampiran Bukti Biaya Makan & Konsumsi Tim
            </div>
            ${totalMeal > 0 ? `
              <div style="font-size: 11.5px; font-weight: 700; color: #b45309;">
                Total Konsumsi: Rp ${totalMeal.toLocaleString('id-ID')}
              </div>
            ` : ''}
          </div>

          ${mealItems.length === 0 ? `
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; font-size: 11.5px; color: #94a3b8; font-style: italic; text-align: center;">
              Tidak ada bukti klaim konsumsi/makan terlampir pada laporan ini.
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
              ${mealItems.map((item, idx) => `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; display: flex; gap: 10px; align-items: flex-start;">
                  <div style="width: 65px; height: 65px; border-radius: 4px; overflow: hidden; background: #f1f5f9; border: 1px solid #cbd5e1; flex-shrink: 0; cursor: pointer;" onclick="viewServiceEvidenceFullImage('${item.dataUrl}', '${escapeAttr(item.description || item.fileName)}')" title="Klik untuk memperbesar">
                    ${(item.dataUrl && (item.dataUrl.startsWith('data:image/') || item.fileType?.startsWith('image/'))) ? `
                      <img src="${item.dataUrl}" alt="Struk Makan" style="width: 100%; height: 100%; object-fit: cover;">
                    ` : `
                      <div style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #dc2626;">PDF</div>
                    `}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 11.5px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                      #${idx + 1} ${escapeHtml(item.description || item.fileName)}
                    </div>
                    ${item.amount ? `
                      <div style="font-family: monospace; font-size: 12px; font-weight: 700; color: #d97706;">
                        Rp ${Number(item.amount).toLocaleString('id-ID')}
                      </div>
                    ` : ''}
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${escapeHtml(item.fileName)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 4. FOTO DOKUMENTASI KEGIATAN LAPANGAN & LAINNYA -->
        <div style="margin-bottom: 24px;">
          <div style="font-weight: 800; font-size: 12.5px; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="camera" style="width: 15px; height: 15px; color: #16a34a;"></i>
            4. Foto Dokumentasi Kegiatan Lapangan & Serah Terima Site
          </div>

          ${docItems.length === 0 ? `
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; font-size: 11.5px; color: #94a3b8; font-style: italic; text-align: center;">
              Tidak ada foto dokumentasi lapangan terlampir.
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;">
              ${docItems.map((item, idx) => `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="height: 170px; background: #0f172a; cursor: pointer; display: flex; align-items: center; justify-content: center; overflow: hidden;" onclick="viewServiceEvidenceFullImage('${item.dataUrl}', '${escapeAttr(item.description || item.fileName)}')" title="Klik untuk memperbesar foto">
                    <img src="${item.dataUrl}" alt="Dokumentasi" style="max-height: 100%; max-width: 100%; object-fit: contain;">
                  </div>
                  <div style="padding: 10px 12px; background: #fafafa; border-top: 1px solid #e2e8f0;">
                    <div style="font-size: 11.5px; font-weight: 700; color: #0f172a; line-height: 1.4;">
                      ${escapeHtml(item.description || `Foto Dokumentasi Kegiatan #${idx + 1}`)}
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
                      File: ${escapeHtml(item.fileName)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 5. STATUS KEUANGAN & PEMBAGIAN HASIL KERJASAMA -->
        <div style="margin-bottom: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; font-size: 11.5px; color: #166534; line-height: 1.5;">
          <strong><i data-lucide="check-circle-2" style="width: 14px; height: 14px; display: inline; vertical-align: middle;"></i> Status Alur Jasa:</strong>
          Pelaksanaan layanan jasa ini telah selesai diverifikasi. Sesuai ketentuan operasional, project jasa <strong>tidak memerlukan dokumen BAST</strong> dan otomatis diteruskan ke <strong>Pembagian Hasil pada tab Kerjasama Keuangan Project</strong>.
        </div>

        <!-- 6. LEMBAR TANDA TANGAN RESMI -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; page-break-inside: avoid;">
          <div style="text-align: center; font-size: 12px;">
            <div style="color: #64748b; margin-bottom: 50px;">Dibuat Oleh (PIC Pelaksana Jasa),</div>
            <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
              ${escapeHtml(report.reporterName || 'PIC Jasa')}
            </div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Divisi Pelayanan & Teknis Jasa</div>
          </div>
          <div style="text-align: center; font-size: 12px;">
            <div style="color: #64748b; margin-bottom: 50px;">Diverifikasi (Keuangan Project),</div>
            <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
              Keuangan & Kerjasama
            </div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Tab Kerjasama Keuangan</div>
          </div>
          <div style="text-align: center; font-size: 12px;">
            <div style="color: #64748b; margin-bottom: 50px;">Mengetahui (Manajemen / Klien),</div>
            <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
              Project Manager / Direksi
            </div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">PT. Unggul Berkat Manufacturing</div>
          </div>
        </div>
      </div>
    `;

    openModal('preview-modal');
    if (window.lucide) lucide.createIcons();
    return;
  }

  // ===============================================================
  // TAMPILAN 2: DOKUMEN LAPORAN PELAKSANAAN PROJECT MANUFAKTUR (BOM)
  // ===============================================================
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
