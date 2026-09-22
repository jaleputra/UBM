// =========================================================
// UBM - BAST Module (Berita Acara Serah Terima)
// =========================================================

// Helper: Periksa apakah project VALID di Order Penjualan DAN statusnya Completed (status project Completed / progress 100% / seluruh tahapan milestone Completed)
function isProjectMilestonesAllCompleted(project) {
  if (!project) return false;

  // Project WAJIB memiliki referensi order nyata yang terdaftar di Order Penjualan (state.orders)
  const validOrderExists = (state.orders || []).some(o => o.id === project.orderId || o.id === project.id);
  if (!validOrderExists) {
    return false;
  }

  // 1. Jika status project secara eksplisit 'Completed'
  if (project.status === 'Completed') return true;

  // 2. Jika progress project sudah 100%
  if (project.progressPercent === 100) return true;

  // 3. Jika memiliki tahapan milestone dan seluruhnya berstatus 'Completed'
  if (Array.isArray(project.milestones) && project.milestones.length > 0) {
    return project.milestones.every(m => m.status === 'Completed');
  }

  return false;
}

function renderBastTable() {
  const tbody = document.getElementById('table-bast-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-bast-status')?.value || 'ALL';

  // 1. Dapatkan project nyata dari Order Penjualan yang seluruh tahapan milestone-nya berstatus Completed
  const allProjects = state.projects || [];
  const completedProjects = allProjects.filter(p => isProjectMilestonesAllCompleted(p));

  // 2. Daftar seluruh BAST yang telah diterbitkan (hanya untuk project yang valid jika ada relasi projectId)
  const validBastList = (state.bast || []).filter(b => {
    if (b.projectId) {
      return allProjects.some(p => p.id === b.projectId);
    }
    return true;
  });

  // 3. Project selesai yang belum diterbitkan dokumen BAST
  const unissuedCompletedProjects = completedProjects.filter(p => {
    const hasBast = validBastList.some(b => b.projectId === p.id || (p.orderId && b.orderId === p.orderId));
    return !hasBast;
  });

  // Gabungkan BAST yang sudah terbit dan project yang siap diterbitkan BAST
  let combinedRows = [];

  validBastList.forEach(b => {
    combinedRows.push({
      type: 'issued',
      id: b.id,
      bastNumber: b.bastNumber || '',
      date: b.bastDate || '-',
      projectName: b.projectName || 'Project Selesai',
      refId: b.orderId || b.projectId || '-',
      customerName: b.customerName,
      customerPic: b.customerPic || '',
      ubmPic: b.ubmPic || 'Ir. Budi Santoso',
      itemCount: b.items ? b.items.length : 0,
      status: b.status || 'Completed',
      rawBast: b,
      projectId: b.projectId
    });
  });

  unissuedCompletedProjects.forEach(p => {
    combinedRows.push({
      type: 'unissued',
      id: p.id,
      bastNumber: 'Belum Diterbitkan',
      date: p.dueDate || p.startDate || '-',
      projectName: p.projectName,
      refId: p.orderId || p.id,
      customerName: p.customerName,
      customerPic: p.customerName,
      ubmPic: p.projectLead || 'Lead Engineer',
      itemCount: p.milestones ? p.milestones.length : 0,
      status: 'Ready',
      rawProject: p,
      projectId: p.id
    });
  });

  // Filter status
  if (statusFilter !== 'ALL') {
    if (statusFilter === 'Completed') {
      combinedRows = combinedRows.filter(r => r.status === 'Completed');
    } else if (statusFilter === 'Draft') {
      combinedRows = combinedRows.filter(r => r.status === 'Draft' || r.status === 'Ready');
    }
  }

  // Filter pencarian teks
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    combinedRows = combinedRows.filter(item => 
      item.id.toLowerCase().includes(q) ||
      (item.bastNumber && item.bastNumber.toLowerCase().includes(q)) ||
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      (item.projectName && item.projectName.toLowerCase().includes(q)) ||
      (item.customerPic && item.customerPic.toLowerCase().includes(q)) ||
      (item.ubmPic && item.ubmPic.toLowerCase().includes(q))
    );
  }

  // Jika tidak ada data BAST
  if (combinedRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="padding: 38px 20px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              ⚠️
            </div>
            <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Belum Ada Dokumen BAST</div>
            <p class="text-muted font-sm" style="max-width: 520px; margin: 0; line-height: 1.5; font-size: 12px;">
              Silakan terbitkan BAST dari project yang milestone-nya telah selesai atau klik tombol <strong>+ Buat BAST Baru</strong> di atas.
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = combinedRows.map(row => {
    if (row.type === 'issued') {
      const isCompleted = row.status === 'Completed';
      const badgeClass = isCompleted ? 'badge-success' : 'badge-amber';
      const doc = row.rawBast?.uploadedDocument;
      const photos = row.rawBast?.documentationPhotos || [];
      const photoCount = photos.length;
      const hasUploads = Boolean(doc || photoCount > 0);
      
      return `
        <tr style="background: #ffffff;">
          <!-- 1. No. BAST -->
          <td>
            <span class="mono-id font-bold text-primary" style="font-size: 11px;">${row.id}</span>
            ${row.bastNumber ? `<div class="font-xs text-muted font-mono" style="font-size: 10px; margin-top: 2px;">${escapeHtml(row.bastNumber)}</div>` : ''}
          </td>

          <!-- 2. Tanggal -->
          <td style="font-size: 11px; font-weight: 600; white-space: nowrap;">${row.date}</td>

          <!-- 3. Nama Project -->
          <td>
            <div class="font-bold text-main" style="font-size: 11.5px; line-height: 1.35; word-break: break-word;">${escapeHtml(row.projectName)}</div>
            <div class="font-xs font-mono" style="font-size: 10px; color: #059669; font-weight: 600; margin-top: 2px;">Ref: ${row.refId}</div>
          </td>

          <!-- 4. Pelanggan -->
          <td>
            <div class="font-bold text-main" style="font-size: 11.5px; line-height: 1.35; word-break: break-word;">${escapeHtml(row.customerName)}</div>
            ${row.customerPic ? `<div class="text-muted font-xs" style="font-size: 10px; margin-top: 2px;">UP: ${escapeHtml(row.customerPic)}</div>` : ''}
          </td>

          <!-- 5. Penanggung Jawab -->
          <td style="font-size: 11px; line-height: 1.35;">
            <div><strong style="color: #1e40af;">UBM:</strong> ${escapeHtml(row.ubmPic)}</div>
            ${row.customerPic ? `<div class="text-muted" style="font-size: 10px; margin-top: 2px;"><strong>Cust:</strong> ${escapeHtml(row.customerPic)}</div>` : ''}
          </td>

          <!-- 6. Item -->
          <td style="text-align: center;">
            <span class="badge badge-secondary font-bold" style="font-size: 10px; padding: 2px 6px;">${row.itemCount} Item</span>
          </td>
          
          <!-- 7. Upload Berkas & Foto (Single Column) -->
          <td style="text-align: center;">
            ${hasUploads ? `
              <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 3px;">
                <div style="display: flex; gap: 3px; align-items: center; justify-content: center; flex-wrap: wrap;">
                  ${doc ? `
                    <a href="${doc.url}" target="_blank" class="badge badge-success" style="font-size: 9.5px; padding: 2px 5px; text-decoration: none; display: inline-flex; align-items: center; gap: 2px;" title="Buka Dokumen BAST Fisik">
                      <i data-lucide="file-check" style="width: 10px; height: 10px;"></i> Dokumen
                    </a>
                  ` : ''}
                  ${photoCount > 0 ? `
                    <button type="button" class="badge badge-info" style="font-size: 9.5px; padding: 2px 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; background: #eff6ff; color: #1d4ed8;" onclick="viewUploadedBastProof('${row.id}')" title="Lihat ${photoCount} Foto Dokumentasi">
                      <i data-lucide="camera" style="width: 10px; height: 10px;"></i> ${photoCount} Foto
                    </button>
                  ` : ''}
                </div>
                <button type="button" class="btn btn-xs btn-outline" style="color: #0f766e; border-color: #ccfbf1; font-size: 9.5px; padding: 1px 6px; margin-top: 1px; display: inline-flex; align-items: center; gap: 3px;" onclick="openUploadBastModal('${row.id}')" title="Kelola / Ganti Berkas Dokumen & Foto">
                  <i data-lucide="upload-cloud" style="width: 10px; height: 10px;"></i> Kelola
                </button>
              </div>
            ` : `
              <button type="button" class="btn btn-xs btn-outline" style="color: #0f766e; border-color: #0f766e; font-size: 10.5px; font-weight: 600; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;" onclick="openUploadBastModal('${row.id}')" title="Upload Berkas Dokumen BAST Fisik & Foto Dokumentasi">
                <i data-lucide="upload-cloud" style="width: 12px; height: 12px;"></i> Upload
              </button>
            `}
          </td>

          <!-- 8. Status -->
          <td style="text-align: center;">
            <span class="badge ${badgeClass}" style="font-size: 10px; padding: 2px 6px; white-space: nowrap;">${isCompleted ? 'Diserahterimakan' : row.status}</span>
          </td>

          <!-- 9. Aksi -->
          <td style="text-align: right;">
            <div class="table-actions">
              <button class="btn-icon" style="color: #0284c7;" title="Pratinjau & Cetak Dokumen BAST (PDF)" onclick="viewBastDetail('${row.id}')">
                <i data-lucide="printer"></i>
              </button>
              <button class="btn-icon" style="color: #16a34a;" title="Share Dokumen BAST ke WhatsApp" onclick="shareBastWhatsApp('${row.id}')">
                <i data-lucide="share-2"></i>
              </button>
              <button class="btn-icon btn-danger-ghost" title="Hapus Dokumen BAST" onclick="deleteResource('bast', '${row.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      // Unissued project ready for BAST
      return `
        <tr style="background: #f0fdf4; border-left: 3px solid #10b981;">
          <!-- 1. No. BAST -->
          <td>
            <span class="badge badge-amber font-bold" style="font-size: 9.5px; padding: 2px 5px;">Belum Terbit</span>
            <div class="font-xs font-mono text-muted" style="font-size: 10px; margin-top: 2px;">${row.id}</div>
          </td>

          <!-- 2. Tanggal -->
          <td style="font-size: 11px; font-weight: 600; white-space: nowrap;">${row.date}</td>

          <!-- 3. Nama Project -->
          <td>
            <div class="font-bold text-main" style="font-size: 11.5px; line-height: 1.35; word-break: break-word;">${escapeHtml(row.projectName)}</div>
            <div class="font-xs font-mono" style="font-size: 10px; color: #059669; font-weight: 600; margin-top: 2px;">Ref: ${row.refId} &bull; Selesai</div>
          </td>

          <!-- 4. Pelanggan -->
          <td>
            <div class="font-bold text-main" style="font-size: 11.5px; line-height: 1.35; word-break: break-word;">${escapeHtml(row.customerName)}</div>
          </td>

          <!-- 5. Penanggung Jawab -->
          <td style="font-size: 11px; line-height: 1.35;">
            <div><strong style="color: #1e40af;">Lead:</strong> ${escapeHtml(row.ubmPic)}</div>
          </td>

          <!-- 6. Item -->
          <td style="text-align: center;">
            <span class="badge badge-secondary font-bold" style="font-size: 10px; padding: 2px 6px;">${row.itemCount} Tahap</span>
          </td>

          <!-- 7. Upload Berkas -->
          <td style="text-align: center;"><span class="text-muted font-xs">-</span></td>

          <!-- 8. Status -->
          <td style="text-align: center;">
            <span class="badge badge-purple" style="font-size: 10px; padding: 2px 6px; white-space: nowrap;">Siap Terbit BAST</span>
          </td>

          <!-- 9. Aksi -->
          <td style="text-align: right;">
            <div class="table-actions">
              <button class="btn btn-xs btn-primary" style="background: #0f766e; border-color: #0f766e; font-size: 10.5px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;" onclick="openCreateBastModal('${row.id}')" title="Terbitkan Dokumen BAST">
                <i data-lucide="file-plus" style="width: 12px; height: 12px;"></i> Terbitkan BAST
              </button>
            </div>
          </td>
        </tr>
      `;
    }
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterBastTable() {
  renderBastTable();
}

// -------------------------------------------------------------
// DOKUMEN CETAK RESMI BAST (BERITA ACARA SERAH TERIMA)
// -------------------------------------------------------------
function buildBastPrintableHtml(b) {
  const items = b.items || [];
  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'Unit Bisnis Mandiri (UBM) Politeknik Takumi',
    parentInstitution: 'Politeknik Takumi',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi - Jawa Barat',
    phone: '(021) 8990-1234',
    email: 'ubm@takumi.ac.id',
    website: 'ubm.takumi.ac.id',
    leaderName: 'Ir. Hendra Wijaya, M.T.',
    leaderRole: 'Ketua Unit Bisnis Mandiri (UBM)',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  return `
    <div class="doc-preview" style="background: #ffffff; color: #0f172a; width: 100%; max-width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- HEADER KOP SURAT UBM TAKUMI -->
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
          <h2 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">BERITA ACARA SERAH TERIMA</h2>
          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-top: 2px;">( BAST PRODUK & HASIL PEKERJAAN )</div>
          <div class="font-mono font-bold text-primary" style="font-size: 13px; margin-top: 4px;">No: ${b.bastNumber || b.id}</div>
          <div class="font-sm text-muted" style="margin-top: 2px; font-size: 11px;">Tanggal: <strong>${b.bastDate || '-'}</strong></div>
        </div>
      </div>

      <!-- KATA PENGANTAR PEMBUKA BAST -->
      <div style="font-size: 11.5px; line-height: 1.6; margin-bottom: 16px; text-align: justify; background: #f8fafc; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 6px;">
        Pada hari ini, tanggal <strong>${b.bastDate || '-'}</strong>, bertempat di lingkungan operasional, telah dilaksanakan proses serah terima hasil pengadaan / pekerjaan teknik sistem otomasi antara pihak-pihak yang bertanda tangan di bawah ini:
      </div>

      <!-- KOMPARASI PIHAK KESATU & PIHAK KEDUA -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px;">
          <div style="font-weight: 800; font-size: 11.5px; color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
            I. PIHAK KESATU (YANG MENYERAHKAN):
          </div>
          <div style="font-size: 11.5px; line-height: 1.5;">
            <div>Nama: <strong>${escapeHtml(b.ubmPic || compSettings.leaderName)}</strong></div>
            <div>Jabatan: ${escapeHtml(b.ubmPicTitle || compSettings.leaderRole)}</div>
            <div>Instansi: <strong>${escapeHtml(compSettings.companyName)}</strong></div>
            <div class="text-muted" style="font-size: 10.5px; margin-top: 2px;">Alamat: ${escapeHtml(compSettings.address)}</div>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px;">
          <div style="font-weight: 800; font-size: 11.5px; color: #047857; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
            II. PIHAK KEDUA (YANG MENERIMA):
          </div>
          <div style="font-size: 11.5px; line-height: 1.5;">
            <div>Nama: <strong>${escapeHtml(b.customerPic || 'Bpk. Hendra')}</strong></div>
            <div>Jabatan: ${escapeHtml(b.customerPicTitle || 'Perwakilan Rekanan / Customer')}</div>
            <div>Perusahaan: <strong>${escapeHtml(b.customerName)}</strong></div>
            <div class="text-muted" style="font-size: 10.5px; margin-top: 2px;">Alamat: ${escapeHtml(b.customerAddress || '-')}</div>
          </div>
        </div>
      </div>

      <!-- PASAL 1: RINCIAN PRODUK & BARANG SERAH TERIMA -->
      <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
        PASAL 1: RINCIAN BARANG / SISTEM YANG DISERAHKAN
      </div>
      <table class="doc-table" style="width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-bottom: 16px;">
        <colgroup>
          <col style="width: 6%;">
          <col style="width: 44%;">
          <col style="width: 10%;">
          <col style="width: 10%;">
          <col style="width: 30%;">
        </colgroup>
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">No</th>
            <th style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">Nama Produk / Komponen Sistem</th>
            <th style="text-align: center; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">Qty</th>
            <th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">Satuan</th>
            <th style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">Kondisi & No. Seri (SN)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
            <tr>
              <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${idx + 1}</td>
              <td style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; word-break: break-word;">
                <div class="font-bold">${escapeHtml(it.itemName)}</div>
                ${it.serialNumber ? `<div class="font-mono text-muted font-xs" style="font-size: 10px;">SN: ${escapeHtml(it.serialNumber)}</div>` : ''}
              </td>
              <td style="text-align: center; font-weight: 700; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">${it.qty || 1}</td>
              <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${escapeHtml(it.unit || 'Unit')}</td>
              <td style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">
                <span class="badge badge-success font-xs" style="font-size: 9.5px; padding: 2px 5px;">${escapeHtml(it.condition || 'Baik & Normal 100%')}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- PASAL 2 & 3: PERNYATAAN UJI FUNGSI & GARANSI -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; margin-bottom: 24px; font-size: 11px; line-height: 1.6;">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">PASAL 2: PEMERIKSAAN DAN UJI FUNGSI (COMMISSIONING TEST)</div>
        <div style="margin-bottom: 8px;">
          PIHAK KEDUA menyatakan telah melakukan pengecekan visual, pengujian fungsi teknis (Commissioning & FAT), dan pelatihan dasar pengoperasian bersama teknisi PIHAK KESATU. Seluruh hasil pekerjaan dinyatakan telah memenuhi spesifikasi gambar kerja, berfungsi dengan baik, dan diterima dalam kondisi lengkap tanpa kekurangan.
        </div>
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">PASAL 3: KLAUSUL GARANSI & PEMELIHARAAN</div>
        <div>
          PIHAK KESATU memberikan jaminan masa garansi resmi selama <strong>${escapeHtml(b.warrantyPeriod || '12 Bulan')}</strong> terhitung sejak tanggal ditandatanganinya Berita Acara ini, mencakup perbaikan dan penggantian suku cadang apabila terjadi kendala teknis bukan karena kelalaian pengguna.
        </div>
      </div>

      <!-- KOLOM TANDA TANGAN DUA BELAH PIHAK -->
      <div style="display: flex; justify-content: space-between; margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 11px;">
        <div style="width: 260px;">
          <div class="text-muted">PIHAK KEDUA (Yang Menerima),</div>
          <div class="font-bold" style="font-size: 11.5px; color: #047857;">${escapeHtml(b.customerName)}</div>
          <div style="margin-top: 55px; font-weight: bold; border-bottom: 1px solid #94a3b8; padding-bottom: 3px;">
            ${escapeHtml(b.customerPic || '.....................................')}
          </div>
          <div class="text-muted" style="font-size: 10px; margin-top: 3px;">Tanda Tangan & Cap Perusahaan</div>
        </div>

        <div style="width: 260px;">
          <div class="text-muted">PIHAK KESATU (Yang Menyerahkan),</div>
          <div class="font-bold" style="font-size: 11.5px; color: #1e40af;">Unit Bisnis Mandiri Takumi</div>
          <div style="margin-top: 55px; font-weight: bold; border-bottom: 1px solid #94a3b8; padding-bottom: 3px;">
            ${escapeHtml(b.ubmPic || 'Ir. Budi Santoso')}
          </div>
          <div class="text-muted" style="font-size: 10px; margin-top: 3px;">Lead Engineer & Project Manager</div>
        </div>
      </div>
    </div>
  `;
}

function viewBastDetail(id) {
  const b = (state.bast || []).find(item => item.id === id);
  if (!b) {
    showToast('Dokumen BAST tidak ditemukan!', 'error');
    return;
  }

  const content = document.getElementById('preview-modal-content');
  if (!content) return;

  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `
      <span style="display: inline-flex; align-items: center; gap: 8px;">
        <i data-lucide="file-signature" style="color: #0f766e;"></i>
        Berita Acara Serah Terima (BAST): <span class="mono-id">${b.id}</span>
      </span>
    `;
  }

  const docHtml = buildBastPrintableHtml(b);

  content.innerHTML = `
    <!-- STRIP AKSI DOKUMEN BAST (NO-PRINT) -->
    <div class="no-print" style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="font-sm font-bold text-muted">Status Dokumen:</span>
        <span class="badge badge-success">Selesai Diserahterimakan</span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn btn-sm btn-outline" style="color: #16a34a; border-color: #86efac; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="shareBastWhatsApp('${b.id}')">
          <i data-lucide="message-circle"></i> Share WhatsApp (PDF)
        </button>
        <button type="button" class="btn btn-sm btn-primary" onclick="printCurrentDocument()" style="background: #0f766e; border-color: #0f766e; display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="printer"></i> Cetak / Simpan PDF
        </button>
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="bast-printable-area">
      ${docHtml}
    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// SHARE DOKUMEN BAST KE WHATSAPP (PDF)
// -------------------------------------------------------------
async function shareBastWhatsApp(id) {
  const b = (state.bast || []).find(item => item.id === id);
  if (!b) return;

  let phone = b.customerPhone ? b.customerPhone.trim() : '';
  if (!phone) {
    const inputPhone = prompt(`Masukkan nomor WhatsApp customer "${b.customerName}" (contoh: 081234567890):`);
    if (!inputPhone) return;
    phone = inputPhone.trim();
  }

  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
  else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;

  showToast('⏳ Menyiapkan dokumen BAST resmi format PDF...', 'info');

  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '790px';
    container.style.padding = '20px 24px';
    container.style.background = '#ffffff';
    container.style.boxSizing = 'border-box';
    container.innerHTML = buildBastPrintableHtml(b);
    document.body.appendChild(container);

    let pdfFileUrl = b.pdfUrl || '';

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `BAST_${b.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = html2pdf().set(opt).from(container);
      const pdfBlob = await worker.output('blob');
      const pdfBase64 = await worker.output('datauristring');

      try {
        const uploadRes = await fetch(`/api/bast/${b.id}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64, filename: `BAST_${b.id}.pdf` })
        });
        if (uploadRes.ok) {
          const upData = await uploadRes.json();
          pdfFileUrl = upData.fileUrl;
        }
      } catch (errUpload) {
        console.warn('Gagal upload BAST PDF:', errUpload);
      }

      if (pdfBlob) {
        const dlUrl = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = `BAST_${b.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          window.URL.revokeObjectURL(dlUrl);
        }, 1200);
      }
    }

    container.remove();

    const fullPdfLink = pdfFileUrl ? `${window.location.origin}${pdfFileUrl}` : `${window.location.origin}/uploads/bast/BAST_${b.id}.pdf`;

    const message = 
`*BERITA ACARA SERAH TERIMA (BAST) RESMI*
*UNIT BISNIS MANDIRI (UBM) - POLITEKNIK TAKUMI*
--------------------------------------------------
Kepada Yth. *${b.customerName}*
${b.customerPic ? `UP: ${b.customerPic}\n` : ''}
Bersama ini kami sampaikan dokumen resmi *Berita Acara Serah Terima (BAST)* untuk pekerjaan:
📋 Nama Project  : *${b.projectName || 'Project Sistem Otomasi'}*
📄 No. BAST      : *${b.bastNumber || b.id}*
📅 Tanggal       : ${b.bastDate || '-'}
🛡️ Garansi       : ${b.warrantyPeriod || '12 Bulan'}
--------------------------------------------------
📄 *DOKUMEN RESMI BAST FORMAT PDF:*
Silakan unduh atau buka berkas PDF resmi melalui tautan di bawah ini:
👉 ${fullPdfLink}
--------------------------------------------------

*(Berkas file PDF asli BAST juga telah otomatis kami unduh ke komputer)*

Terima kasih atas kepercayaan dan kerja samanya.
*Sales & Engineering Team UBM Takumi*
Politeknik Takumi`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    showToast(`✅ File BAST_${b.id}.pdf diunduh & WhatsApp dibuka!`, 'success');

  } catch (err) {
    console.error('Error in shareBastWhatsApp:', err);
    showToast('Gagal memproses dokumen BAST ke WhatsApp', 'error');
  }
}

// -------------------------------------------------------------
// MODAL BUAT BAST BARU
// -------------------------------------------------------------
function openCreateBastModal(preselectedProjectId = null) {
  // Hanya project yang seluruh tahapan milestonenya Completed
  const eligibleProjects = (state.projects || []).filter(p => isProjectMilestonesAllCompleted(p));

  if (eligibleProjects.length === 0) {
    showToast('⚠️ Belum ada project dengan seluruh tahapan milestone Completed! Harap selesaikan seluruh tahapan milestone di Timeline sebelum menerbitkan BAST.', 'warning');
    return;
  }

  document.getElementById('form-modal-title').innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <i data-lucide="file-signature" style="color: #0f766e;"></i> Buat Berita Acara Serah Terima (BAST) Baru
    </span>
  `;

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '880px';
    modalContainer.style.width = '92vw';
  }

  const today = new Date().toISOString().split('T')[0];

  // Options HANYA untuk project yang statusnya Selesai / seluruh milestone-nya Completed
  const projectOptions = eligibleProjects.map(p => {
    const msCount = p.milestones ? p.milestones.length : 0;
    const msCompletedCount = p.milestones ? p.milestones.filter(m => m.status === 'Completed').length : 0;
    const desc = msCount > 0 ? `(${msCompletedCount}/${msCount} Milestone Selesai)` : `(Status: Completed)`;
    return `
    <option value="${p.id}" ${p.id === preselectedProjectId ? 'selected' : ''} data-cust="${escapeAttr(p.customerName)}" data-name="${escapeAttr(p.projectName)}" data-lead="${escapeAttr(p.projectLead)}" data-order="${p.orderId || ''}">
      [${p.id}] ${escapeHtml(p.projectName)} - ${escapeHtml(p.customerName)} ${desc}
    </option>
  `;
  }).join('');

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="bast-form" onsubmit="submitNewBast(event)" style="display: flex; flex-direction: column; gap: 16px;">
      
      <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 14px 16px;">
        <label class="form-label font-bold" style="font-size: 11.5px; color: #0f766e;">Pilih Referensi Project Selesai (Milestone 100% Completed)</label>
        <select id="bast-project-select" class="form-control" onchange="autofillBastFromProject(this.value)">
          <option value="">-- Pilih Project Yang Seluruh Milestone-nya Selesai --</option>
          ${projectOptions}
        </select>
        <small class="text-muted" style="font-size: 11px; margin-top: 4px; display: block;">
          ✓ Hanya menampilkan project dengan 100% tahapan milestone berstatus <strong>Completed</strong>.
        </small>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Nama Project / Hasil Pekerjaan *</label>
          <input type="text" id="bast-project-name" name="projectName" class="form-control" required placeholder="Contoh: Sistem Otomasi Mesin Conveyor Sorting">
        </div>
        <div class="form-group">
          <label class="form-label">Nomor Surat BAST</label>
          <input type="text" name="bastNumber" class="form-control" placeholder="016/BAST/UBM-TAKUMI/IX/2026">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Nama Perusahaan Customer *</label>
          <input type="text" id="bast-customer-name" name="customerName" class="form-control" required placeholder="PT / CV Rekanan">
        </div>
        <div class="form-group">
          <label class="form-label">Nama PIC Customer (Pihak Kedua)</label>
          <input type="text" id="bast-customer-pic" name="customerPic" class="form-control" placeholder="Bpk. Hendra Gunawan">
        </div>
        <div class="form-group">
          <label class="form-label">Tanggal Serah Terima *</label>
          <input type="date" name="bastDate" class="form-control" required value="${today}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr 1.2fr; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Alamat Lokasi Serah Terima</label>
          <input type="text" id="bast-customer-address" name="customerAddress" class="form-control" placeholder="Alamat pabrik / workshop customer">
        </div>
        <div class="form-group">
          <label class="form-label">Penanggung Jawab UBM (Pihak Pertama) *</label>
          <input type="text" id="bast-ubm-pic" name="ubmPic" class="form-control" required value="Ir. Budi Santoso">
        </div>
        <div class="form-group">
          <label class="form-label">Masa Garansi Resmi</label>
          <input type="text" name="warrantyPeriod" class="form-control" value="12 Bulan (1 Tahun) Garansi Servis & Sparepart">
        </div>
      </div>

      <!-- Item Serah Terima -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="font-size: 12.5px; font-weight: 700; margin: 0;">Daftar Produk / Barang Serah Terima</h4>
          <button type="button" class="btn btn-xs btn-outline" onclick="addBastItemRow()">+ Tambah Item</button>
        </div>
        <div id="bast-items-container" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Rows -->
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Catatan Serah Terima / Hasil Uji Fungsi</label>
        <textarea name="handoverNotes" class="form-control" rows="2">Telah dilakukan pengujian fungsi bersama (Commissioning Test) dan dinyatakan 100% berfungsi baik sesuai spesifikasi teknis.</textarea>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; border-top: 1px solid var(--border-color); padding-top: 14px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" class="btn btn-primary" style="background: #0f766e; border-color: #0f766e; padding: 8px 20px;">
          <i data-lucide="save"></i> Terbitkan BAST
        </button>
      </div>
    </form>
  `;

  const initialProjId = preselectedProjectId || (eligibleProjects.length === 1 ? eligibleProjects[0].id : null);
  if (initialProjId) {
    const sel = document.getElementById('bast-project-select');
    if (sel) sel.value = initialProjId;
    autofillBastFromProject(initialProjId);
  } else {
    addBastItemRow();
  }

  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function autofillBastFromProject(projectId) {
  if (!projectId) return;
  const p = (state.projects || []).find(item => item.id === projectId);
  if (!p) return;

  const nameInput = document.getElementById('bast-project-name');
  if (nameInput) nameInput.value = p.projectName || '';

  const custInput = document.getElementById('bast-customer-name');
  if (custInput) custInput.value = p.customerName || '';

  const leadInput = document.getElementById('bast-ubm-pic');
  if (leadInput && p.projectLead) leadInput.value = p.projectLead;

  // If order exists, try getting address and items
  if (p.orderId) {
    const ord = (state.orders || []).find(o => o.id === p.orderId);
    if (ord) {
      const addrInput = document.getElementById('bast-customer-address');
      if (addrInput && ord.customerAddress) addrInput.value = ord.customerAddress;
      const picInput = document.getElementById('bast-customer-pic');
      if (picInput && ord.customerPhone) picInput.value = ord.customerName;

      // Populate items from order if available
      const container = document.getElementById('bast-items-container');
      if (container && ord.items && ord.items.length > 0) {
        container.innerHTML = '';
        ord.items.forEach(it => {
          addBastItemRow({
            itemName: it.itemName,
            qty: it.qty,
            unit: it.unit || 'Unit',
            condition: 'Baik & Berfungsi Normal 100%',
            serialNumber: `SN-${it.sku || 'UBM'}`
          });
        });
      }
    }
  }
}

function addBastItemRow(item = null) {
  const container = document.getElementById('bast-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'bast-item-row';
  row.style = 'display: grid; grid-template-columns: 2fr 0.8fr 1fr 1.5fr 36px; gap: 8px; align-items: center;';

  row.innerHTML = `
    <input type="text" class="form-control item-name" placeholder="Nama produk / mesin" required value="${escapeAttr(item?.itemName || '')}">
    <input type="number" class="form-control item-qty" placeholder="1" min="1" value="${item?.qty || 1}">
    <input type="text" class="form-control item-unit" placeholder="Unit / Set" value="${escapeAttr(item?.unit || 'Unit')}">
    <input type="text" class="form-control item-condition" placeholder="Kondisi (Baik & Lolos Uji 100%)" value="${escapeAttr(item?.condition || 'Baik & Normal 100%')}">
    <button type="button" class="btn-icon btn-danger-ghost" onclick="this.closest('.bast-item-row').remove()">
      <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
    </button>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

async function submitNewBast(event) {
  event.preventDefault();
  const form = event.target;

  const items = [];
  document.querySelectorAll('.bast-item-row').forEach(r => {
    const itemName = r.querySelector('.item-name')?.value.trim();
    const qty = parseFloat(r.querySelector('.item-qty')?.value) || 1;
    const unit = r.querySelector('.item-unit')?.value.trim() || 'Unit';
    const condition = r.querySelector('.item-condition')?.value.trim() || 'Baik & Normal 100%';
    if (itemName) items.push({ itemName, qty, unit, condition });
  });

  const projSelect = document.getElementById('bast-project-select');
  const projectId = projSelect?.value || '';

  const payload = {
    bastNumber: form.bastNumber.value.trim() || `0${(state.bast?.length || 0) + 16}/BAST/UBM-TAKUMI/IX/2026`,
    bastDate: form.bastDate.value,
    projectId,
    projectName: form.projectName.value.trim(),
    customerName: form.customerName.value.trim(),
    customerPic: form.customerPic.value.trim(),
    customerAddress: form.customerAddress.value.trim(),
    ubmPic: form.ubmPic.value.trim(),
    warrantyPeriod: form.warrantyPeriod.value.trim(),
    handoverNotes: form.handoverNotes.value.trim(),
    status: 'Completed',
    items
  };

  try {
    const res = await fetch('/api/bast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const createdBast = await res.json();
      closeModal('form-modal');
      showToast('Berita Acara Serah Terima (BAST) baru berhasil diterbitkan!', 'success');
      await fetchResource('bast');
      renderBastTable();
      updateSidebarBadges();

      // Otomatis buka pratinjau dokumen BAST dan cetak ke PDF
      const newId = createdBast.id || payload.id || (state.bast && state.bast[state.bast.length - 1]?.id);
      if (newId) {
        setTimeout(() => {
          viewBastDetail(newId);
          setTimeout(() => {
            printCurrentDocument();
          }, 350);
        }, 150);
      }
    } else {
      const err = await res.json();
      showToast(err.error || 'Gagal menyimpan BAST', 'error');
    }
  } catch (err) {
    console.error('Error saving BAST:', err);
    showToast('Terjadi kesalahan saat menyimpan BAST', 'error');
  }
}

// -------------------------------------------------------------
// FITUR UPLOAD BAST & FOTO DOKUMENTASI PENYERAHAN PRODUK
// -------------------------------------------------------------
let currentBastUploadPhotos = [];

function openUploadBastModal(bastId) {
  const b = (state.bast || []).find(item => item.id === bastId);
  if (!b) {
    showToast('Dokumen BAST tidak ditemukan', 'error');
    return;
  }

  // Clone existing photos array
  currentBastUploadPhotos = (b.documentationPhotos || []).map(p => ({ ...p }));

  document.getElementById('form-modal-title').innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <i data-lucide="upload-cloud" style="color: #0f766e;"></i> Upload Berkas BAST & Foto Dokumentasi
    </span>
  `;

  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '780px';
    modalContainer.style.width = '92vw';
  }

  const existingDoc = b.uploadedDocument;

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="upload-bast-form" onsubmit="submitUploadBastProof(event, '${b.id}')" style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- INFO BAST -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11.5px;">
        <div>
          <div class="text-muted font-xs">No. Surat BAST:</div>
          <div class="font-bold text-primary font-mono">${escapeHtml(b.bastNumber || b.id)}</div>
          <div class="text-muted font-xs" style="margin-top: 4px;">Nama Project / Hasil Pekerjaan:</div>
          <div class="font-bold text-main">${escapeHtml(b.projectName || '-')}</div>
        </div>
        <div>
          <div class="text-muted font-xs">Customer / Rekanan:</div>
          <div class="font-bold text-main">${escapeHtml(b.customerName || '-')}</div>
          <div class="text-muted font-xs" style="margin-top: 4px;">Tanggal Serah Terima:</div>
          <div class="font-bold font-mono">${escapeHtml(b.bastDate || '-')}</div>
        </div>
      </div>

      <!-- SECTION 1: UPLOAD DOKUMEN FISIK BAST -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <label class="form-label font-bold" style="margin: 0; font-size: 12px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-check" style="width: 16px; height: 16px; color: #0f766e;"></i>
            1. File Dokumen BAST Fisik (Bertanda Tangan & Bercap)
          </label>
          <span class="badge badge-secondary" style="font-size: 10px;">PDF / JPG / PNG</span>
        </div>
        <p class="text-muted font-xs" style="margin: 0 0 10px 0;">
          Upload file scan atau PDF dokumen BAST resmi yang telah ditandatangani oleh pihak UBM dan Customer.
        </p>

        ${existingDoc ? `
          <div id="existing-doc-alert" style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px;">
              <i data-lucide="file-text" style="color: #059669; width: 16px; height: 16px;"></i>
              <div>
                <span class="font-bold text-main">${escapeHtml(existingDoc.filename || 'Dokumen BAST')}</span>
                <span class="text-muted font-xs" style="margin-left: 6px;">(Telah diupload)</span>
              </div>
            </div>
            <a href="${existingDoc.url}" target="_blank" class="btn btn-xs btn-outline" style="color: #059669; border-color: #059669; font-size: 10.5px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="external-link" style="width: 11px; height: 11px;"></i> Lihat File
            </a>
          </div>
        ` : ''}

        <input type="file" id="input-bast-document" class="form-control" accept=".pdf,image/png,image/jpeg,image/webp">
        <small class="text-muted font-xs" style="display: block; margin-top: 4px;">
          ${existingDoc ? 'Pilih file baru jika ingin mengganti dokumen fisik yang sudah ada.' : 'Format didukung: PDF, PNG, JPG (Maks. 10MB)'}
        </small>
      </div>

      <!-- SECTION 2: UPLOAD FOTO DOKUMENTASI PENYERAHAN PRODUK -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <label class="form-label font-bold" style="margin: 0; font-size: 12px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="camera" style="width: 16px; height: 16px; color: #0284c7;"></i>
            2. Foto Dokumentasi Penyerahan Produk / Mesin (Lapangan)
          </label>
          <span class="badge badge-secondary" style="font-size: 10px;">Multiple Foto</span>
        </div>
        <p class="text-muted font-xs" style="margin: 0 0 10px 0;">
          Upload foto-foto saat serah terima produk, pengujian mesin bersama, atau serah terima unit di lokasi customer.
        </p>

        <input type="file" id="input-bast-photos" class="form-control" accept="image/*" multiple onchange="handleBastPhotoSelection(this)">
        
        <!-- Galeri Foto Preview -->
        <div id="bast-photos-gallery" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-top: 12px;">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- SECTION 3: CATATAN & KETERANGAN PENYERAHAN -->
      <div class="form-group">
        <label class="form-label font-bold" style="font-size: 11.5px;">Catatan Tambahan Dokumentasi Penyerahan</label>
        <textarea id="input-bast-proof-notes" class="form-control" rows="2" placeholder="Contoh: Penyerahan 1 Unit Conveyor Sorting Machine dan aksesoris sparepart di pabrik Plant 2 Cikarang. Diterima dalam kondisi baik.">${escapeHtml(b.proofNotes || '')}</textarea>
      </div>

      <!-- SUBMIT BUTTONS -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; border-top: 1px solid var(--border-color); padding-top: 14px;">
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="submit" id="btn-submit-upload-bast" class="btn btn-primary" style="background: #0f766e; border-color: #0f766e; padding: 8px 20px; display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="save"></i> Simpan & Upload BAST
        </button>
      </div>
    </form>
  `;

  renderBastPhotosGallery();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function renderBastPhotosGallery() {
  const container = document.getElementById('bast-photos-gallery');
  if (!container) return;

  if (!currentBastUploadPhotos || currentBastUploadPhotos.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b; font-size: 11px;">
        Belum ada foto dokumentasi yang dipilih / diupload.
      </div>
    `;
    return;
  }

  container.innerHTML = currentBastUploadPhotos.map((p, idx) => {
    const src = p.base64 || p.url;
    return `
      <div style="position: relative; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #000; height: 110px; display: flex; align-items: center; justify-content: center;">
        <img src="${src}" alt="Dokumentasi ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;">
        <button type="button" onclick="removeBastPhoto(${idx})" style="position: absolute; top: 4px; right: 4px; background: rgba(220, 38, 38, 0.9); color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; font-weight: bold; line-height: 1;" title="Hapus Foto">
          &times;
        </button>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.65); color: #fff; font-size: 9.5px; padding: 2px 4px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; text-align: center;">
          ${escapeHtml(p.name || `Foto ${idx + 1}`)}
        </div>
      </div>
    `;
  }).join('');
}

function handleBastPhotoSelection(input) {
  if (!input.files || input.files.length === 0) return;

  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentBastUploadPhotos.push({
        name: file.name,
        base64: e.target.result,
        size: file.size
      });
      renderBastPhotosGallery();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removeBastPhoto(idx) {
  if (idx >= 0 && idx < currentBastUploadPhotos.length) {
    currentBastUploadPhotos.splice(idx, 1);
    renderBastPhotosGallery();
  }
}

async function submitUploadBastProof(event, bastId) {
  event.preventDefault();
  const submitBtn = document.getElementById('btn-submit-upload-bast');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Mengupload...';
    if (window.lucide) lucide.createIcons();
  }

  const docInput = document.getElementById('input-bast-document');
  const notes = document.getElementById('input-bast-proof-notes')?.value || '';

  let documentBase64 = null;
  let documentFilename = null;

  if (docInput && docInput.files && docInput.files[0]) {
    const file = docInput.files[0];
    documentFilename = file.name;
    documentBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const payload = {
    documentBase64,
    documentFilename,
    photos: currentBastUploadPhotos,
    proofNotes: notes
  };

  try {
    const res = await fetch(`/api/bast/${bastId}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeModal('form-modal');
      showToast('Berkas BAST & Foto Dokumentasi serah terima berhasil diupload!', 'success');
      await fetchResource('bast');
      renderBastTable();
    } else {
      const err = await res.json();
      showToast(err.error || 'Gagal mengupload berkas BAST', 'error');
    }
  } catch (err) {
    console.error('Error uploading BAST proof:', err);
    showToast('Terjadi kesalahan saat mengupload berkas BAST', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="save"></i> Simpan & Upload BAST';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function viewUploadedBastProof(bastId) {
  const b = (state.bast || []).find(item => item.id === bastId);
  if (!b) {
    showToast('Dokumen BAST tidak ditemukan', 'error');
    return;
  }

  const content = document.getElementById('preview-modal-content');
  if (!content) return;

  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `
      <span style="display: inline-flex; align-items: center; gap: 8px;">
        <i data-lucide="file-check" style="color: #0f766e;"></i>
        Berkas & Foto Dokumentasi BAST: <span class="mono-id">${b.bastNumber || b.id}</span>
      </span>
    `;
  }

  const doc = b.uploadedDocument;
  const photos = b.documentationPhotos || [];

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      
      <!-- ACTION BAR DI DALAM MODAL -->
      <div class="no-print" style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 10px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <div class="font-bold text-main" style="font-size: 13px;">${escapeHtml(b.projectName || 'Hasil Pekerjaan')}</div>
          <div class="text-muted font-xs">Customer: <strong>${escapeHtml(b.customerName || '-')}</strong> &bull; Tanggal: <strong>${escapeHtml(b.bastDate || '-')}</strong></div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-sm btn-outline" style="color: #0f766e; border-color: #0f766e;" onclick="closeModal('preview-modal'); openUploadBastModal('${b.id}')">
            <i data-lucide="upload-cloud"></i> Upload Ulang / Tambah Foto
          </button>
          <button type="button" class="btn btn-sm btn-primary" style="background: #0f766e; border-color: #0f766e;" onclick="viewBastDetail('${b.id}')">
            <i data-lucide="printer"></i> Dokumen BAST Resmi
          </button>
        </div>
      </div>

      <!-- DOKUMEN FISIK BAST -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
        <h4 style="font-size: 12.5px; font-weight: 700; margin: 0 0 10px 0; color: #0f172a; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="file-signature" style="color: #0f766e; width: 16px; height: 16px;"></i>
          Dokumen Fisik BAST Bertandatangan
        </h4>
        ${doc ? `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i data-lucide="file-text" style="color: #0f766e; width: 24px; height: 24px;"></i>
              <div>
                <div class="font-bold text-main" style="font-size: 12px;">${escapeHtml(doc.filename || 'Dokumen_BAST.pdf')}</div>
                <div class="text-muted font-xs">Diupload pada: ${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString('id-ID') : '-'}</div>
              </div>
            </div>
            <a href="${doc.url}" target="_blank" class="btn btn-sm btn-primary" style="background: #0f766e; border-color: #0f766e; font-size: 11px; padding: 4px 12px; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="download"></i> Buka / Download Dokumen
            </a>
          </div>
        ` : `
          <div style="text-align: center; padding: 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b; font-size: 11.5px;">
            Belum ada file dokumen fisik BAST yang diupload. 
            <a href="javascript:void(0)" onclick="closeModal('preview-modal'); openUploadBastModal('${b.id}')" style="color: #0f766e; font-weight: 600; margin-left: 4px;">Upload Sekarang</a>
          </div>
        `}
      </div>

      <!-- FOTO DOKUMENTASI PENYERAHAN PRODUK -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px;">
        <h4 style="font-size: 12.5px; font-weight: 700; margin: 0 0 10px 0; color: #0f172a; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="camera" style="color: #0284c7; width: 16px; height: 16px;"></i>
          Foto Dokumentasi Penyerahan Produk Lapangan (${photos.length} Foto)
        </h4>

        ${photos.length > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
            ${photos.map((p, idx) => `
              <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <a href="${p.url}" target="_blank" title="Klik untuk perbesar gambar" style="display: block; height: 140px; overflow: hidden;">
                  <img src="${p.url}" alt="${escapeAttr(p.name || `Foto ${idx + 1}`)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                </a>
                <div style="padding: 6px 8px; background: #ffffff; border-top: 1px solid #e2e8f0; font-size: 10.5px;">
                  <div class="font-bold text-main" style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${escapeHtml(p.name || `Foto Dokumentasi ${idx + 1}`)}</div>
                  <div class="text-muted font-xs">${p.uploadedAt ? new Date(p.uploadedAt).toLocaleDateString('id-ID') : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="text-align: center; padding: 18px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b; font-size: 11.5px;">
            Belum ada foto dokumentasi penyerahan produk yang diupload.
            <a href="javascript:void(0)" onclick="closeModal('preview-modal'); openUploadBastModal('${b.id}')" style="color: #0f766e; font-weight: 600; margin-left: 4px;">Upload Foto Dokumentasi</a>
          </div>
        `}
      </div>

      <!-- CATATAN DOKUMENTASI -->
      ${b.proofNotes ? `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">
          <div class="font-bold text-main" style="font-size: 11.5px; margin-bottom: 4px;">Catatan Serah Terima:</div>
          <div style="font-size: 11.5px; color: #334155; line-height: 1.5;">${escapeHtml(b.proofNotes)}</div>
        </div>
      ` : ''}

    </div>
  `;

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

