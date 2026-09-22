// =========================================================
// UBM - Maintenance Module (After Sales)
// =========================================================

function isProjectCompletedForMaintenance(project) {
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

function getProjectMaintenanceLogs(projectId, orderId) {
  return (state.maintenance || []).filter(m => 
    m.projectId === projectId || (orderId && m.orderId === orderId)
  ).sort((a, b) => new Date(b.maintenanceDate || b.createdAt) - new Date(a.maintenanceDate || a.createdAt));
}

// -------------------------------------------------------------
// 1. RENDER TABEL DAFTAR PROJECT MAINTENANCE
// -------------------------------------------------------------
function renderMaintenanceTable() {
  const tbody = document.getElementById('table-maintenance-body');
  if (!tbody) return;

  const filterStatus = document.getElementById('filter-maintenance-status')?.value || 'ALL';
  const allProjects = state.projects || [];
  let completedProjects = allProjects.filter(p => isProjectCompletedForMaintenance(p));

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

  // Filter Maintenance Status
  if (filterStatus === 'Maintained') {
    completedProjects = completedProjects.filter(p => getProjectMaintenanceLogs(p.id, p.orderId).length > 0);
  } else if (filterStatus === 'Pending') {
    completedProjects = completedProjects.filter(p => getProjectMaintenanceLogs(p.id, p.orderId).length === 0);
  }

  if (completedProjects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted" style="padding: 36px 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <i data-lucide="wrench" style="width: 36px; height: 36px; color: #94a3b8;"></i>
            <div style="font-weight: 700; color: #475569; font-size: 14px;">Tidak ada project maintenance yang sesuai</div>
            <div style="font-size: 12px; color: #94a3b8;">Hanya project berstatus <strong>Completed</strong> yang dapat dilakukan pencatatan jadwal dan formulir maintenance.</div>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = completedProjects.map(p => {
    const logs = getProjectMaintenanceLogs(p.id, p.orderId);
    const lastLog = logs[0] || null;
    const totalLogs = logs.length;

    let conditionBadge = `
      <span class="badge badge-amber" style="font-size: 11px; padding: 3px 8px; font-weight: 700; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">
        <i data-lucide="clock" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> Belum Ada Maintenance
      </span>
    `;

    if (lastLog) {
      if (lastLog.resultStatus === 'Optimal (Normal)') {
        conditionBadge = `
          <span class="badge badge-success font-bold" style="font-size: 11px; padding: 3px 8px;">
            <i data-lucide="check-circle-2" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> Kondisi Prima (Optimal)
          </span>
        `;
      } else if (lastLog.resultStatus === 'Perlu Monitoring') {
        conditionBadge = `
          <span class="badge badge-amber font-bold" style="font-size: 11px; padding: 3px 8px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">
            <i data-lucide="alert-circle" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> Perlu Monitoring
          </span>
        `;
      } else {
        conditionBadge = `
          <span class="badge badge-primary font-bold" style="font-size: 11px; padding: 3px 8px;">
            <i data-lucide="shield-check" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> Selesai Perawatan
          </span>
        `;
      }
    }

    return `
      <tr style="cursor: pointer; transition: background-color 0.15s ease;" onclick="openMaintenanceModal('${p.id}')" title="Klik untuk membuka Formulir Maintenance Project ini">
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
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0;">
              ${(lastLog?.technicianName || p.projectLead || 'T').charAt(0)}
            </div>
            <div>
              <div class="font-bold text-main" style="font-size: 12px;">${escapeHtml(lastLog?.technicianName || p.projectLead || 'Teknisi UBM')}</div>
              <div class="text-muted font-xs" style="font-size: 10px;">Divisi Maintenance & Engineering</div>
            </div>
          </div>
        </td>
        <td style="font-size: 11.5px;">
          <div><span class="text-muted font-xs">Terakhir:</span> <strong>${lastLog?.maintenanceDate || '-'}</strong></div>
          <div style="margin-top: 2px;"><span class="text-muted font-xs">Berikutnya:</span> <strong class="text-primary">${lastLog?.nextScheduleDate || 'Setiap 3 Bulan'}</strong></div>
        </td>
        <td style="text-align: center;">
          <span class="badge badge-secondary font-mono" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
            <i data-lucide="history" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> ${totalLogs} Sesi
          </span>
        </td>
        <td style="text-align: center;">
          ${conditionBadge}
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end;">
            ${lastLog ? `
              <button class="btn btn-sm btn-outline" style="color: #0f766e; border-color: #99f6e4; background: #f0fdfa; font-size: 11px; padding: 4px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="viewMaintenanceReport('${lastLog.id}')" title="Lihat Dokumen Laporan Maintenance Terakhir">
                <i data-lucide="file-text" style="width: 13px; height: 13px;"></i> Laporan
              </button>
            ` : ''}
            <button class="btn btn-sm btn-primary" style="background: #0284c7; border-color: #0284c7; font-size: 11px; padding: 4px 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="openMaintenanceModal('${p.id}')" title="Buka Formulir Maintenance Baru">
              <i data-lucide="plus-circle" style="width: 13px; height: 13px;"></i> Form Maintenance
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterMaintenanceTable() {
  renderMaintenanceTable();
}

// -------------------------------------------------------------
// 2. MODAL FORMULIR MAINTENANCE PROJECT LENGKAP
// -------------------------------------------------------------
function openMaintenanceModal(projectId) {
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) {
    showToast('Data project tidak ditemukan!', 'error');
    return;
  }

  const logs = getProjectMaintenanceLogs(p.id, p.orderId);
  const defaultDate = new Date().toISOString().split('T')[0];

  // Hitung jadwal berikutnya otomatis +3 bulan
  const nextDateObj = new Date();
  nextDateObj.setMonth(nextDateObj.getMonth() + 3);
  const defaultNextDate = nextDateObj.toISOString().split('T')[0];

  const logId = `MNT-${p.orderId || p.id}-${Date.now().toString().slice(-4)}`;

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '920px';
    modalContainer.style.width = '94vw';
  }

  document.getElementById('form-modal-title').innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px; font-size: 16px;">
      <i data-lucide="wrench" style="color: #0284c7;"></i>
      Formulir Maintenance & Pemeliharaan: <span class="mono-id">${p.id}</span>
    </span>
  `;

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="maintenance-form" onsubmit="submitMaintenanceForm(event, '${p.id}')" style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- HEADER SUMMARY PROJECT -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 18px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
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
            <div style="font-size: 11px; color: #64748b;">Riwayat Maintenance:</div>
            <div style="font-weight: 700; font-size: 13px; color: #0284c7;">${logs.length} Sesi Terdata</div>
          </div>
        </div>
      </div>

      <!-- ROW 1: IDENTITAS PEMELIHARAAN -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">No. Log Maintenance</label>
          <input type="text" name="maintenanceId" class="form-control" value="${logId}" readonly style="background: #f1f5f9; font-family: monospace; font-weight: 700;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Tanggal Pemeliharaan *</label>
          <input type="date" name="maintenanceDate" class="form-control" required value="${defaultDate}">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Jenis Pemeliharaan *</label>
          <select name="maintenanceType" class="form-control" required>
            <option value="Preventive Maintenance (Perawatan Rutin)">Preventive Maintenance (Perawatan Rutin)</option>
            <option value="Routine Inspection & Lubrication">Routine Inspection & Lubrication</option>
            <option value="Calibration & Fine Tuning">Calibration & Fine Tuning</option>
            <option value="Corrective Maintenance (Perbaikan)">Corrective Maintenance (Perbaikan)</option>
            <option value="Major Overhaul">Major Overhaul</option>
          </select>
        </div>
      </div>

      <!-- ROW 2: TEKNISI & JADWAL BERIKUTNYA -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Teknisi / PIC Maintenance *</label>
          <input type="text" name="technicianName" class="form-control" required value="${escapeHtml(p.projectLead || 'Teknisi UBM')}" placeholder="Nama Teknisi Pelaksana">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Jadwal Perawatan Berikutnya *</label>
          <input type="date" name="nextScheduleDate" class="form-control" required value="${defaultNextDate}">
        </div>
      </div>

      <!-- CHECKLIST INSPEKSI KOMPONEN -->
      <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: #ffffff;">
        <div style="background: #f1f5f9; padding: 10px 16px; border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 12.5px; color: #334155; display: flex; justify-content: space-between; align-items: center;">
          <span><i data-lucide="check-square" style="width: 14px; height: 14px; display: inline; vertical-align: middle;"></i> Checklist Pemeriksaan & Uji Fungsi Komponen</span>
          <span style="font-size: 11px; color: #64748b; font-weight: normal;">Pilih kondisi tiap bagian</span>
        </div>
        <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
          
          <div style="display: grid; grid-template-columns: 1fr 140px 1.5fr; gap: 10px; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0;">
            <div style="font-weight: 600; font-size: 12px; color: #1e293b;">1. Sistem Kelistrikan & Power Supply</div>
            <select name="check_electrical" class="form-control form-control-sm">
              <option value="Normal (Baik)">🟢 Normal (Baik)</option>
              <option value="Perlu Perawatan">🟡 Perlu Perawatan</option>
              <option value="Diganti">🔴 Diganti</option>
            </select>
            <input type="text" name="notes_electrical" class="form-control form-control-sm" placeholder="Catatan: Tegangan stabil, kabel rapi...">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 140px 1.5fr; gap: 10px; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0;">
            <div style="font-weight: 600; font-size: 12px; color: #1e293b;">2. Sensor, Limit Switch & Instrumentasi</div>
            <select name="check_sensor" class="form-control form-control-sm">
              <option value="Normal (Baik)">🟢 Normal (Baik)</option>
              <option value="Perlu Kalibrasi">🟡 Perlu Kalibrasi</option>
              <option value="Diganti">🔴 Diganti</option>
            </select>
            <input type="text" name="notes_sensor" class="form-control form-control-sm" placeholder="Catatan: Respon sensor presisi...">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 140px 1.5fr; gap: 10px; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0;">
            <div style="font-weight: 600; font-size: 12px; color: #1e293b;">3. Komponen Bergerak, Motor & Bearing</div>
            <select name="check_mechanical" class="form-control form-control-sm">
              <option value="Normal (Baik)">🟢 Normal (Baik)</option>
              <option value="Dilumasi / Disesuaikan">🟡 Dilumasi / Disesuaikan</option>
              <option value="Diganti">🔴 Diganti</option>
            </select>
            <input type="text" name="notes_mechanical" class="form-control form-control-sm" placeholder="Catatan: Pelumasan bearing optimal...">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 140px 1.5fr; gap: 10px; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0;">
            <div style="font-weight: 600; font-size: 12px; color: #1e293b;">4. Controller, PLC / Firmware</div>
            <select name="check_controller" class="form-control form-control-sm">
              <option value="Normal (Baik)">🟢 Normal (Baik)</option>
              <option value="Update Firmware">🟡 Update Firmware</option>
              <option value="Perlu Tindakan">🔴 Perlu Tindakan</option>
            </select>
            <input type="text" name="notes_controller" class="form-control form-control-sm" placeholder="Catatan: Program berjalan stabil...">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 140px 1.5fr; gap: 10px; align-items: center;">
            <div style="font-weight: 600; font-size: 12px; color: #1e293b;">5. Kebersihan, Bodi & Struktur Fisik</div>
            <select name="check_structure" class="form-control form-control-sm">
              <option value="Normal (Baik)">🟢 Normal (Baik)</option>
              <option value="Dibersihkan">🟡 Dibersihkan</option>
              <option value="Perlu Pengecatan/Repair">🔴 Perlu Repair</option>
            </select>
            <input type="text" name="notes_structure" class="form-control form-control-sm" placeholder="Catatan: Bebas korosi & debu...">
          </div>

        </div>
      </div>

      <!-- CATATAN & STATUS AKHIR -->
      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Catatan Hasil Pemeriksaan & Rekomendasi *</label>
          <textarea name="remarks" class="form-control" rows="3" required placeholder="Tuliskan catatan teknis, tindakan preventif yang telah dilakukan, atau instruksi penggunaan bagi operator...">Unit telah diperiksa secara menyeluruh, dilakukan uji fungsi mekanik & kelistrikan. Seluruh sistem bekerja normal sesuai spesifikasi teknis.</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; font-size: 12px;">Status Hasil Akhir Maintenance *</label>
          <select name="resultStatus" class="form-control" required style="font-weight: 700; height: 42px;">
            <option value="Optimal (Normal)">🟢 Optimal (Siap Beroperasi Normal)</option>
            <option value="Perlu Monitoring">🟡 Perlu Monitoring Berkala</option>
            <option value="Perbaikan Lanjutan">🔴 Rekomendasi Perbaikan Lanjutan</option>
          </select>
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
            Status ini akan langsung memperbarui dashboard dan laporan kondisi project.
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; padding-top: 14px; border-top: 1px solid var(--border-color);">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 8px 20px; background: #0284c7; border-color: #0284c7;">
          <i data-lucide="check"></i> Simpan Hasil Maintenance
        </button>
      </div>
    </form>
  `;

  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

async function submitMaintenanceForm(event, projectId) {
  event.preventDefault();
  const form = event.target;
  const p = (state.projects || []).find(item => item.id === projectId || item.orderId === projectId);
  if (!p) return;

  const maintenancePayload = {
    id: form.maintenanceId.value.trim(),
    projectId: p.id,
    orderId: p.orderId || p.id,
    projectName: p.projectName || 'Project',
    customerName: p.customerName || '-',
    maintenanceDate: form.maintenanceDate.value,
    maintenanceType: form.maintenanceType.value,
    technicianName: form.technicianName.value.trim(),
    nextScheduleDate: form.nextScheduleDate.value,
    checklist: {
      electrical: { status: form.check_electrical.value, notes: form.notes_electrical.value.trim() },
      sensor: { status: form.check_sensor.value, notes: form.notes_sensor.value.trim() },
      mechanical: { status: form.check_mechanical.value, notes: form.notes_mechanical.value.trim() },
      controller: { status: form.check_controller.value, notes: form.notes_controller.value.trim() },
      structure: { status: form.check_structure.value, notes: form.notes_structure.value.trim() }
    },
    remarks: form.remarks.value.trim(),
    resultStatus: form.resultStatus.value,
    createdAt: new Date().toISOString()
  };

  try {
    await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maintenancePayload)
    });

    closeModal('form-modal');
    showToast(`✅ Data Maintenance #${maintenancePayload.id} untuk Project ${p.projectName} berhasil disimpan!`, 'success');

    await fetchResource('maintenance');
    renderMaintenanceTable();
    updateSidebarBadges();
  } catch (err) {
    console.error('Error saving maintenance form:', err);
    showToast('Terjadi kesalahan saat menyimpan formulir maintenance', 'error');
  }
}

// -------------------------------------------------------------
// 3. PRATINJAU & CETAK DOKUMEN LAPORAN MAINTENANCE
// -------------------------------------------------------------
function viewMaintenanceReport(logId) {
  const log = (state.maintenance || []).find(m => m.id === logId);
  if (!log) {
    showToast('Data maintenance tidak ditemukan!', 'error');
    return;
  }

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
    titleEl.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 8px;"><i data-lucide="file-check" style="color: #0284c7;"></i> Laporan Berita Acara Pemeliharaan (Maintenance Work Order)</span>';
  }

  const cl = log.checklist || {};

  content.innerHTML = `
    <!-- NO-PRINT HEADER ACTIONS -->
    <div class="no-print" style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="font-sm font-bold text-muted">Hasil Akhir:</span>
        <span class="badge badge-success" style="font-weight: 700;"><i data-lucide="check-check" style="width: 13px; height: 13px; display: inline;"></i> ${escapeHtml(log.resultStatus || 'Optimal')}</span>
        <span class="badge badge-primary font-bold">Jadwal Berikutnya: ${log.nextScheduleDate || '-'}</span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn btn-sm btn-primary" style="background: #0284c7; border-color: #0284c7; display: inline-flex; align-items: center; gap: 6px;" onclick="printCurrentDocument()">
          <i data-lucide="printer"></i> Cetak Laporan PDF
        </button>
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="quotation-printable-area" class="print-container">
      <div class="print-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">PT. UNGGUL BERKAT MANUFACTURING</h1>
            <div style="font-size: 11px; color: #475569; margin-top: 3px;">Precision CNC, Fabrication, Automation & Maintenance Services</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: #0284c7; letter-spacing: 0.5px;">LEMBAR KERJA & LAPORAN MAINTENANCE</div>
            <div class="mono-id" style="font-size: 12px; color: #334155; margin-top: 2px;">No: ${log.id}</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 120px; color: #64748b; padding: 3px 0;">Nama Project / Mesin:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(log.projectName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Pelanggan / Lokasi:</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(log.customerName)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">No. Ref Project / Order:</td>
              <td style="font-family: monospace; font-weight: 600;">${log.projectId} ${log.orderId ? `(${log.orderId})` : ''}</td>
            </tr>
          </table>
        </div>
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 120px; color: #64748b; padding: 3px 0;">Tanggal Maintenance:</td>
              <td style="font-weight: 600;">${log.maintenanceDate || '-'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Jenis Pemeliharaan:</td>
              <td style="font-weight: 700; color: #0284c7;">${escapeHtml(log.maintenanceType || 'Preventive')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Teknisi Pelaksana:</td>
              <td style="font-weight: 700; color: #16a34a;">${escapeHtml(log.technicianName || '-')}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Jadwal Berikutnya:</td>
              <td style="font-weight: 700; color: #2563eb;">${log.nextScheduleDate || '-'}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">
          Hasil Checklist & Inspeksi Fisik / Fungsi Komponen
        </h4>
        <table class="data-table" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 11px;">
              <th style="width: 35px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">No</th>
              <th style="width: 220px; border: 1px solid #cbd5e1; padding: 6px;">Bagian / Sistem yang Diperiksa</th>
              <th style="width: 160px; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">Kondisi & Status</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">Hasil Temuan & Tindakan Teknisi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px;">1</td>
              <td style="font-weight: 700; border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">Sistem Kelistrikan & Power</td>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; font-size: 11.5px; color: #16a34a;">${escapeHtml(cl.electrical?.status || 'Normal (Baik)')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px; color: #334155;">${escapeHtml(cl.electrical?.notes || 'Tegangan dan pengkabelan normal')}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px;">2</td>
              <td style="font-weight: 700; border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">Sensor, Limit Switch & Instrument</td>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; font-size: 11.5px; color: #16a34a;">${escapeHtml(cl.sensor?.status || 'Normal (Baik)')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px; color: #334155;">${escapeHtml(cl.sensor?.notes || 'Respon dan pembacaan presisi')}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px;">3</td>
              <td style="font-weight: 700; border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">Komponen Mekanikal & Motor</td>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; font-size: 11.5px; color: #16a34a;">${escapeHtml(cl.mechanical?.status || 'Normal (Baik)')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px; color: #334155;">${escapeHtml(cl.mechanical?.notes || 'Pelumasan optimal, tidak ada vibrasi abnormal')}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px;">4</td>
              <td style="font-weight: 700; border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">Controller / Program / Firmware</td>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; font-size: 11.5px; color: #16a34a;">${escapeHtml(cl.controller?.status || 'Normal (Baik)')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px; color: #334155;">${escapeHtml(cl.controller?.notes || 'Log controller bersih, fungsi logika berjalan')}</td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px;">5</td>
              <td style="font-weight: 700; border: 1px solid #cbd5e1; padding: 6px; font-size: 12px;">Kebersihan & Struktur Mesin</td>
              <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; font-size: 11.5px; color: #16a34a;">${escapeHtml(cl.structure?.status || 'Normal (Baik)')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11.5px; color: #334155;">${escapeHtml(cl.structure?.notes || 'Mesin bersih & tidak ada deformasi fisik')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-size: 12px;">
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px;">Catatan & Rekomendasi Teknisi:</div>
        <div style="color: #475569; line-height: 1.5;">${escapeHtml(log.remarks || 'Pemeriksaan rutin berjalan lancar dan seluruh komponen memenuhi parameter kerja normal.')}</div>
      </div>

      <!-- SIGNATURE SECTION -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; page-break-inside: avoid;">
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Teknisi Pelaksana,</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(log.technicianName || 'Teknisi')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Maintenance Engineer</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Mengetahui (Pelanggan),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            ${escapeHtml(log.customerName || 'Client')}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Representative / Operator</div>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <div style="color: #64748b; margin-bottom: 50px;">Disetujui Oleh (Management),</div>
          <div style="font-weight: 700; color: #0f172a; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
            UBM After Sales Dept.
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Head of Maintenance</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}
