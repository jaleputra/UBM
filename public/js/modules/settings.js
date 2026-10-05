// =========================================================
// UBM - Company Profile & System Settings Module
// =========================================================

const DEFAULT_COMPANY_SETTINGS = {
  companyName: "Unit Bisnis Mandiri (UBM) Politeknik Takumi",
  companyShortName: "UBM Takumi",
  institutionName: "Yayasan Takumi Bina Karya",
  parentInstitution: "Politeknik Takumi",
  tagline: "Unit Bisnis Mahasiswa - Teaching Factory & Engineering Solutions",
  phone: "(021) 8990-1234",
  whatsapp: "0812-3456-7890",
  email: "ubm@takumi.ac.id",
  website: "ubm.takumi.ac.id",
  address: "Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Kab. Bekasi, Jawa Barat 17530",
  city: "Bekasi",
  leaderName: "Ir. Hendra Wijaya, M.T.",
  leaderNip: "19850412 201012 1 002",
  leaderRole: "Ketua Unit Bisnis Mandiri (UBM)",
  wadir1Name: "Dr. Eng. Tri Wahyudi, M.Eng.",
  wadir1Nip: "19820315 200804 1 003",
  wadir1Role: "Wakil Direktur I Politeknik Takumi",
  headAfterSales: "Bambang S., S.T.",
  headFinance: "Siti Rahma, S.E.",
  bankName: "Bank Mandiri",
  bankBranch: "Cabang Cikarang",
  bankAccount: "156-00-1234567-8",
  bankAccountName: "Unit Bisnis Mandiri Politeknik Takumi",
  paymentInstructions: "Pembayaran ditransfer ke Bank Mandiri Cabang Cikarang No. Rek: 156-00-1234567-8 a.n. Unit Bisnis Mandiri Politeknik Takumi",
  copyrightText: "Copyright © Bisnis Digital Takumi"
};

function getCompanySettings() {
  const s = state.settings || {};
  return {
    companyName: s.companyName || DEFAULT_COMPANY_SETTINGS.companyName,
    companyShortName: s.companyShortName || DEFAULT_COMPANY_SETTINGS.companyShortName,
    institutionName: s.institutionName || DEFAULT_COMPANY_SETTINGS.institutionName,
    parentInstitution: s.parentInstitution || DEFAULT_COMPANY_SETTINGS.parentInstitution,
    tagline: s.tagline || DEFAULT_COMPANY_SETTINGS.tagline,
    phone: s.phone || DEFAULT_COMPANY_SETTINGS.phone,
    whatsapp: s.whatsapp || DEFAULT_COMPANY_SETTINGS.whatsapp,
    email: s.email || DEFAULT_COMPANY_SETTINGS.email,
    website: s.website || DEFAULT_COMPANY_SETTINGS.website,
    address: s.address || DEFAULT_COMPANY_SETTINGS.address,
    city: s.city || DEFAULT_COMPANY_SETTINGS.city,
    leaderName: s.leaderName || DEFAULT_COMPANY_SETTINGS.leaderName,
    leaderNip: s.leaderNip || DEFAULT_COMPANY_SETTINGS.leaderNip,
    leaderRole: s.leaderRole || DEFAULT_COMPANY_SETTINGS.leaderRole,
    wadir1Name: s.wadir1Name || DEFAULT_COMPANY_SETTINGS.wadir1Name,
    wadir1Nip: s.wadir1Nip || DEFAULT_COMPANY_SETTINGS.wadir1Nip,
    wadir1Role: s.wadir1Role || DEFAULT_COMPANY_SETTINGS.wadir1Role,
    headAfterSales: s.headAfterSales || DEFAULT_COMPANY_SETTINGS.headAfterSales,
    headFinance: s.headFinance || DEFAULT_COMPANY_SETTINGS.headFinance,
    bankName: s.bankName || DEFAULT_COMPANY_SETTINGS.bankName,
    bankBranch: s.bankBranch || DEFAULT_COMPANY_SETTINGS.bankBranch,
    bankAccount: s.bankAccount || DEFAULT_COMPANY_SETTINGS.bankAccount,
    bankAccountName: s.bankAccountName || DEFAULT_COMPANY_SETTINGS.bankAccountName,
    paymentInstructions: s.paymentInstructions || DEFAULT_COMPANY_SETTINGS.paymentInstructions,
    copyrightText: s.copyrightText || DEFAULT_COMPANY_SETTINGS.copyrightText
  };
}

let activeSettingsTab = 'general';

function switchSettingsTab(tabKey) {
  activeSettingsTab = tabKey;
  
  const tabs = ['general', 'officers', 'banking', 'preview', 'accounts'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-settings-${t}`);
    const content = document.getElementById(`settings-tab-content-${t}`);
    if (btn) btn.classList.toggle('active', t === tabKey);
    if (content) content.style.display = t === tabKey ? 'block' : 'none';
  });

  const mainForm = document.getElementById('settings-main-form');
  const topActions = document.getElementById('settings-top-actions');

  if (tabKey === 'accounts') {
    if (mainForm) mainForm.style.display = 'none';
    if (topActions) topActions.style.display = 'none';
    renderAccountsTabTable();
  } else {
    if (mainForm) mainForm.style.display = 'block';
    if (topActions) topActions.style.display = 'flex';
  }

  if (tabKey === 'preview') {
    updateSettingsLivePreview();
  }

  if (window.lucide) lucide.createIcons();
}

function renderSettingsView() {
  const container = document.getElementById('view-settings-container');
  if (!container) return;

  const s = getCompanySettings();

  container.innerHTML = `
    <!-- HEADER INTRO -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0;">Pengaturan Profil Perusahaan & Sistem</h2>
        <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">
          Kelola data identitas Unit Bisnis Mandiri (UBM), Yayasan, alamat, nomor kontak, nama pejabat resmi, serta manajemen akun pengguna dan hak akses login sistem.
        </p>
      </div>
      <div id="settings-top-actions" style="display: flex; gap: 10px; align-items: center;">
        <button type="button" class="btn btn-outline" onclick="resetSettingsToDefault()" style="font-size: 12.5px;">
          <i data-lucide="rotate-ccw"></i> Reset Default
        </button>
        <button type="button" class="btn btn-primary" onclick="document.getElementById('settings-main-form').requestSubmit()" style="background: #2563eb; border-color: #2563eb; font-weight: 700; font-size: 12.5px; padding: 8px 18px;">
          <i data-lucide="save"></i> Simpan Pengaturan
        </button>
      </div>
    </div>

    <!-- SUBMODULE TABS -->
    <div class="submodule-tabs-header" style="margin-bottom: 20px;">
      <div class="submodule-nav-tabs">
        <button type="button" class="submodule-tab-btn active" id="tab-btn-settings-general" onclick="switchSettingsTab('general')">
          <i data-lucide="building"></i>
          <span>1. Profil Perusahaan & Yayasan</span>
        </button>
        <button type="button" class="submodule-tab-btn" id="tab-btn-settings-officers" onclick="switchSettingsTab('officers')">
          <i data-lucide="user-check"></i>
          <span>2. Pejabat Resmi (Ketua UBM & Wadir I)</span>
        </button>
        <button type="button" class="submodule-tab-btn" id="tab-btn-settings-banking" onclick="switchSettingsTab('banking')">
          <i data-lucide="credit-card"></i>
          <span>3. Rekening Bank & Pembayaran</span>
        </button>
        <button type="button" class="submodule-tab-btn" id="tab-btn-settings-preview" onclick="switchSettingsTab('preview')">
          <i data-lucide="eye"></i>
          <span>4. Pratinjau Kop Surat Resmi</span>
        </button>
        <button type="button" class="submodule-tab-btn" id="tab-btn-settings-accounts" onclick="switchSettingsTab('accounts')">
          <i data-lucide="users"></i>
          <span>5. Akun Pengguna</span>
        </button>
      </div>
    </div>

    <!-- SETTINGS FORM WRAPPER -->
    <form id="settings-main-form" onsubmit="saveCompanySettings(event)">
      
      <!-- TAB 1: PROFIL PERUSAHAAN & YAYASAN -->
      <div id="settings-tab-content-general">
        <div class="table-card" style="padding: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: #ffffff;">
          <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="building-2" style="color: #2563eb; width: 18px; height: 18px;"></i>
            Identitas Institusi, Perusahaan & Kontak Resmi
          </h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Nama Perusahaan / Unit Usaha (UBM) *</label>
              <input type="text" name="companyName" class="form-control" required value="${escapeAttr(s.companyName)}" placeholder="Contoh: Unit Bisnis Mandiri (UBM) Politeknik Takumi">
              <span class="font-xs text-muted">Ditampilkan pada judul kop dokumen resmi dan faktur tagihan</span>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Nama Yayasan / Badan Penyelenggara *</label>
              <input type="text" name="institutionName" class="form-control" required value="${escapeAttr(s.institutionName)}" placeholder="Contoh: Yayasan Takumi Bina Karya">
              <span class="font-xs text-muted">Ditampilkan pada baris teratas Kop Surat Tugas & Dokumen Legal</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Institusi Kampus / Induk</label>
              <input type="text" name="parentInstitution" class="form-control" value="${escapeAttr(s.parentInstitution)}" placeholder="Contoh: Politeknik Takumi">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Nama Singkat / Brand</label>
              <input type="text" name="companyShortName" class="form-control" value="${escapeAttr(s.companyShortName)}" placeholder="Contoh: UBM Takumi">
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" style="font-weight: 600; font-size: 12px;">Tagline / Slogan Unit Bisnis</label>
            <input type="text" name="tagline" class="form-control" value="${escapeAttr(s.tagline)}" placeholder="Contoh: Unit Bisnis Mahasiswa - Teaching Factory & Engineering Solutions">
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Alamat Lengkap Kantor & Workshop *</label>
            <textarea name="address" class="form-control" rows="2" required placeholder="Alamat lengkap kawasan industri, jalan, kecamatan, kota dan kode pos">${escapeAttr(s.address)}</textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Kota Penandatanganan Dokumen</label>
              <input type="text" name="city" class="form-control" value="${escapeAttr(s.city)}" placeholder="Contoh: Bekasi / Cikarang">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">No. Telepon Kantor</label>
              <input type="text" name="phone" class="form-control" value="${escapeAttr(s.phone)}" placeholder="(021) 8990-1234">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">No. WhatsApp Hotline</label>
              <input type="text" name="whatsapp" class="form-control" value="${escapeAttr(s.whatsapp)}" placeholder="0812-3456-7890">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Alamat Email Resmi</label>
              <input type="email" name="email" class="form-control" value="${escapeAttr(s.email)}" placeholder="ubm@takumi.ac.id">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Website Resmi</label>
              <input type="text" name="website" class="form-control" value="${escapeAttr(s.website)}" placeholder="ubm.takumi.ac.id">
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #1e3a8a;">Teks Copyright Aplikasi & Dokumen</label>
            <input type="text" name="copyrightText" class="form-control" value="${escapeAttr(s.copyrightText)}" placeholder="Copyright © Bisnis Digital Takumi">
            <span class="font-xs text-muted">Ditampilkan pada footer aplikasi dan bagian bawah dokumen PDF</span>
          </div>
        </div>
      </div>

      <!-- TAB 2: PEJABAT RESMI (KETUA UBM & WADIR I) -->
      <div id="settings-tab-content-officers" style="display: none;">
        <div class="table-card" style="padding: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: #ffffff;">
          <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="user-check" style="color: #2563eb; width: 18px; height: 18px;"></i>
            Struktur Pejabat Penandatangan Dokumen Resmi
          </h3>
          <p style="font-size: 12.5px; color: #64748b; margin-top: -8px; margin-bottom: 20px;">
            Pejabat di bawah ini akan otomatis tercantum pada Surat Tugas Pelaksanaan Proyek, Surat Penawaran (Quotation), BAST, dan Lembar Pengesahan.
          </p>

          <!-- 1. KETUA UBM -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 18px; border-left: 4px solid #2563eb;">
            <h4 style="font-size: 13.5px; font-weight: 800; color: #1e3a8a; margin: 0 0 12px 0;">
              1. Pimpinan / Ketua Unit Bisnis Mandiri (UBM)
            </h4>
            <div style="display: grid; grid-template-columns: 1.2fr 1fr 1.2fr; gap: 14px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">Nama Lengkap & Gelar Ketua UBM *</label>
                <input type="text" name="leaderName" class="form-control" required value="${escapeAttr(s.leaderName)}" placeholder="Ir. Hendra Wijaya, M.T.">
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">NIP / NIK Ketua UBM</label>
                <input type="text" name="leaderNip" class="form-control" value="${escapeAttr(s.leaderNip)}" placeholder="19850412 201012 1 002">
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">Jabatan Resmi</label>
                <input type="text" name="leaderRole" class="form-control" value="${escapeAttr(s.leaderRole)}" placeholder="Ketua Unit Bisnis Mandiri (UBM)">
              </div>
            </div>
          </div>

          <!-- 2. WAKIL DIREKTUR I -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 18px; border-left: 4px solid #7c3aed;">
            <h4 style="font-size: 13.5px; font-weight: 800; color: #5b21b6; margin: 0 0 12px 0;">
              2. Wakil Direktur I (Bidang Akademik, Riset & Kerjasama)
            </h4>
            <div style="display: grid; grid-template-columns: 1.2fr 1fr 1.2fr; gap: 14px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">Nama Lengkap & Gelar Wadir I *</label>
                <input type="text" name="wadir1Name" class="form-control" required value="${escapeAttr(s.wadir1Name)}" placeholder="Dr. Eng. Tri Wahyudi, M.Eng.">
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">NIP / NIK Wadir I</label>
                <input type="text" name="wadir1Nip" class="form-control" value="${escapeAttr(s.wadir1Nip)}" placeholder="19820315 200804 1 003">
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">Jabatan Resmi</label>
                <input type="text" name="wadir1Role" class="form-control" value="${escapeAttr(s.wadir1Role)}" placeholder="Wakil Direktur I Politeknik Takumi">
              </div>
            </div>
          </div>

          <!-- 3. PEJABAT LAINNYA -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; border-left: 4px solid #10b981;">
            <h4 style="font-size: 13.5px; font-weight: 800; color: #065f46; margin: 0 0 12px 0;">
              3. Pejabat Layanan Purna Jual & Keuangan
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">Kepala After Sales & Service</label>
                <input type="text" name="headAfterSales" class="form-control" value="${escapeAttr(s.headAfterSales)}" placeholder="Bambang S., S.T.">
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 600; font-size: 12px;">PIC Keuangan & Penagihan (Finance)</label>
                <input type="text" name="headFinance" class="form-control" value="${escapeAttr(s.headFinance)}" placeholder="Siti Rahma, S.E.">
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- TAB 3: REKENING BANK & INFORMASI PENAGIHAN -->
      <div id="settings-tab-content-banking" style="display: none;">
        <div class="table-card" style="padding: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: #ffffff;">
          <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="credit-card" style="color: #2563eb; width: 18px; height: 18px;"></i>
            Rekening Bank Penagihan & Instruksi Pembayaran
          </h3>
          <p style="font-size: 12.5px; color: #64748b; margin-top: -8px; margin-bottom: 20px;">
            Informasi rekening di bawah ini otomatis digunakan pada Faktur Tagihan (Invoice), Surat Penawaran (Quotation), dan Kwitansi UBM.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Nama Bank *</label>
              <input type="text" name="bankName" class="form-control" required value="${escapeAttr(s.bankName)}" placeholder="Contoh: Bank Mandiri / BCA / BNI">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Cabang Bank</label>
              <input type="text" name="bankBranch" class="form-control" value="${escapeAttr(s.bankBranch)}" placeholder="Contoh: Cabang Cikarang">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Nomor Rekening Bank *</label>
              <input type="text" name="bankAccount" class="form-control" required value="${escapeAttr(s.bankAccount)}" placeholder="156-00-1234567-8" style="font-family: monospace; font-weight: 700;">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 600; font-size: 12px;">Rekening Atas Nama (Beneficiary) *</label>
              <input type="text" name="bankAccountName" class="form-control" required value="${escapeAttr(s.bankAccountName)}" placeholder="Unit Bisnis Mandiri Politeknik Takumi">
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Instruksi Pembayaran & Catatan Invoice Default</label>
            <textarea name="paymentInstructions" class="form-control" rows="3" placeholder="Instruksi transfer yang akan tercetak otomatis pada invoice">${escapeAttr(s.paymentInstructions)}</textarea>
          </div>
        </div>
      </div>

      <!-- TAB 4: PRATINJAU KOP SURAT RESMI -->
      <div id="settings-tab-content-preview" style="display: none;">
        <div class="table-card" style="padding: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: #ffffff;">
          <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="eye" style="color: #2563eb; width: 18px; height: 18px;"></i>
            Pratinjau Kop Surat Resmi & Data Penandatangan
          </h3>
          <div id="settings-live-preview-box" style="border: 2px dashed #cbd5e1; padding: 24px; border-radius: 8px; background: #ffffff;">
            <!-- Populated live -->
          </div>
        </div>
      </div>

      <!-- BOTTOM ACTION BAR -->
      <div id="settings-bottom-actions" style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
        <button type="button" class="btn btn-outline" onclick="resetSettingsToDefault()">
          Reset Nilai Standar
        </button>
        <button type="submit" class="btn btn-primary" style="background: #2563eb; border-color: #2563eb; font-weight: 700; padding: 9px 24px;">
          <i data-lucide="save"></i> Simpan Semua Perubahan Pengaturan
        </button>
      </div>

    </form>

    <!-- TAB 5: MANAJEMEN AKUN PENGGUNA & LOGIN SISTEM -->
    <div id="settings-tab-content-accounts" style="display: none;">
      <!-- CARD 1: FORM INPUT AKUN -->
      <div class="table-card" id="user-form-card" style="padding: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: #ffffff; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 id="user-form-title" style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="user-plus" style="color: #2563eb; width: 18px; height: 18px;"></i>
              Tambah Akun Pengguna Baru
            </h3>
            <p style="font-size: 12.5px; color: #64748b; margin: 4px 0 0 0;">
              Daftarkan akun pengguna baru atau perbarui akun yang sudah ada. Akun dengan status aktif dapat langsung digunakan untuk login ke sistem UBM.
            </p>
          </div>
        </div>

        <form id="user-account-form" onsubmit="saveUserAccount(event)">
          <input type="hidden" id="user-form-id" value="">

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Nama Lengkap & Gelar *</label>
              <input type="text" id="user-form-name" class="form-control" required placeholder="Contoh: Ir. Budi Santoso, M.T.">
              <span class="font-xs text-muted">Nama yang ditampilkan pada profil & tanda tangan</span>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Email Login *</label>
              <input type="email" id="user-form-email" class="form-control" required placeholder="user@ubm.co.id">
              <span class="font-xs text-muted">Digunakan sebagai username saat login</span>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Password Login *</label>
              <div style="position: relative;">
                <input type="text" id="user-form-password" class="form-control" required placeholder="Minimal 6 karakter" style="font-family: monospace; padding-right: 32px;">
                <span style="position: absolute; right: 10px; top: 9px; color: #94a3b8; font-size: 11px;">🔑</span>
              </div>
              <span class="font-xs text-muted">Password login ke aplikasi</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Role / Hak Akses *</label>
              <select id="user-form-role" class="form-control" required>
                <option value="Administrator">1. Administrator (Akses Penuh Seluruh Sistem)</option>
                <option value="Ketua UBM">2. Ketua UBM (Akses Penuh & Persetujuan Project / Assign Lead)</option>
                <option value="Lead Project">3. Lead Project (Daftarkan Anggota, Timeline, BOM, Ajukan Pengadaan)</option>
                <option value="Keuangan">4. Keuangan (Persetujuan Pembelian, Invoice, Keuangan Project, BAST & After Sales)</option>
                <option value="Member">5. Member (Akses Timeline, Laporan Hasil Task & Project Ter-assign)</option>
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Departemen / Divisi</label>
              <input type="text" id="user-form-dept" class="form-control" placeholder="Contoh: Operasional & Management">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Status Akun *</label>
              <select id="user-form-status" class="form-control" required>
                <option value="Aktif">Aktif (Dapat Login)</option>
                <option value="Non-Aktif">Non-Aktif (Akses Ditangguhkan)</option>
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid #f1f5f9;">
            <button type="button" class="btn btn-outline" id="btn-cancel-user-form" onclick="resetUserForm()" style="display: none; font-size: 12.5px;">
              <i data-lucide="x"></i> Batal Edit
            </button>
            <button type="submit" class="btn btn-primary" id="btn-submit-user-form" style="background: #2563eb; border-color: #2563eb; font-weight: 700; font-size: 12.5px; padding: 8px 20px;">
              <i data-lucide="user-check"></i> <span id="btn-submit-user-text">Simpan Akun</span>
            </button>
          </div>
        </form>
      </div>

      <!-- CARD 2: TABEL AKUN TERDAFTAR -->
      <div class="table-card" style="padding: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="users" style="color: #2563eb; width: 18px; height: 18px;"></i>
              Daftar Akun Pengguna Terdaftar
            </h3>
            <p style="font-size: 12.5px; color: #64748b; margin: 4px 0 0 0;">
              Seluruh akun yang terdaftar dapat digunakan untuk login ke sistem UBM sesuai email dan password masing-masing.
            </p>
          </div>
          <span class="badge" id="users-count-badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 12px; font-weight: 700; padding: 5px 12px;">
            0 Akun Terdaftar
          </span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">NO</th>
                <th>PENGGUNA & EMAIL</th>
                <th style="width: 190px;">ROLE / HAK AKSES</th>
                <th style="width: 190px;">DEPARTEMEN</th>
                <th style="width: 120px;">STATUS</th>
                <th style="width: 130px;">TANGGAL TERDAFTAR</th>
                <th style="width: 90px; text-align: right;">AKSI</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <!-- Populated dynamically via renderAccountsTabTable() -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  switchSettingsTab(activeSettingsTab || 'general');
  if (window.lucide) lucide.createIcons();
}

function updateSettingsLivePreview() {
  const box = document.getElementById('settings-live-preview-box');
  if (!box) return;

  const form = document.getElementById('settings-main-form');
  const s = form ? {
    companyName: form.companyName?.value || DEFAULT_COMPANY_SETTINGS.companyName,
    institutionName: form.institutionName?.value || DEFAULT_COMPANY_SETTINGS.institutionName,
    parentInstitution: form.parentInstitution?.value || DEFAULT_COMPANY_SETTINGS.parentInstitution,
    tagline: form.tagline?.value || DEFAULT_COMPANY_SETTINGS.tagline,
    address: form.address?.value || DEFAULT_COMPANY_SETTINGS.address,
    city: form.city?.value || DEFAULT_COMPANY_SETTINGS.city,
    phone: form.phone?.value || DEFAULT_COMPANY_SETTINGS.phone,
    email: form.email?.value || DEFAULT_COMPANY_SETTINGS.email,
    website: form.website?.value || DEFAULT_COMPANY_SETTINGS.website,
    leaderName: form.leaderName?.value || DEFAULT_COMPANY_SETTINGS.leaderName,
    leaderNip: form.leaderNip?.value || DEFAULT_COMPANY_SETTINGS.leaderNip,
    leaderRole: form.leaderRole?.value || DEFAULT_COMPANY_SETTINGS.leaderRole,
    wadir1Name: form.wadir1Name?.value || DEFAULT_COMPANY_SETTINGS.wadir1Name,
    wadir1Nip: form.wadir1Nip?.value || DEFAULT_COMPANY_SETTINGS.wadir1Nip,
    wadir1Role: form.wadir1Role?.value || DEFAULT_COMPANY_SETTINGS.wadir1Role,
    bankName: form.bankName?.value || DEFAULT_COMPANY_SETTINGS.bankName,
    bankAccount: form.bankAccount?.value || DEFAULT_COMPANY_SETTINGS.bankAccount,
    bankAccountName: form.bankAccountName?.value || DEFAULT_COMPANY_SETTINGS.bankAccountName,
    copyrightText: form.copyrightText?.value || DEFAULT_COMPANY_SETTINGS.copyrightText
  } : getCompanySettings();

  box.innerHTML = `
    <!-- HEADER KOP RESMI -->
    <div style="text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
      <div style="font-size: 15px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #334155;">${escapeHtml(s.institutionName)}</div>
      <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #0f172a; margin: 2px 0;">${escapeHtml(s.parentInstitution)}</div>
      <div style="font-size: 14px; font-weight: 800; color: #1e40af; text-transform: uppercase;">${escapeHtml(s.companyName)}</div>
      <div style="font-size: 11px; color: #475569; margin-top: 4px;">${escapeHtml(s.address)}</div>
      <div style="font-size: 11px; color: #64748b;">Website: ${escapeHtml(s.website)} | Email: ${escapeHtml(s.email)} | Telp: ${escapeHtml(s.phone)}</div>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <div style="font-size: 14px; font-weight: bold; text-decoration: underline; color: #0f172a;">CONTOH FORMAT DOKUMEN RESMI</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">(Quotation / Surat Tugas / Invoice / BAST / Kartu Garansi)</div>
    </div>

    <!-- TANDA TANGAN -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 36px; text-align: center; font-size: 12px;">
      <div>
        <div style="font-weight: bold; color: #334155;">Pimpinan Unit Usaha:</div>
        <div style="font-weight: 700; color: #0f172a;">${escapeHtml(s.leaderRole)}</div>
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-style: italic; font-size: 11px;">(Tanda Tangan & Cap UBM)</div>
        <div style="font-weight: bold; text-decoration: underline; color: #0f172a; font-size: 13px;">${escapeHtml(s.leaderName)}</div>
        <div style="font-size: 11px; color: #64748b;">NIP. ${escapeHtml(s.leaderNip || '-')}</div>
      </div>
      <div>
        <div style="font-weight: bold; color: #334155;">Mengesahkan:</div>
        <div style="font-weight: 700; color: #0f172a;">${escapeHtml(s.wadir1Role)}</div>
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-style: italic; font-size: 11px;">(Tanda Tangan & Cap Institusi)</div>
        <div style="font-weight: bold; text-decoration: underline; color: #0f172a; font-size: 13px;">${escapeHtml(s.wadir1Name)}</div>
        <div style="font-size: 11px; color: #64748b;">NIP. ${escapeHtml(s.wadir1Nip || '-')}</div>
      </div>
    </div>

    <!-- FOOTER COPYRIGHT -->
    <div style="margin-top: 30px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
      <span>${escapeHtml(s.copyrightText)}</span>
      <span>${escapeHtml(s.companyShortName)} Enterprise System</span>
    </div>
  `;
}

async function saveCompanySettings(event) {
  if (event) event.preventDefault();
  const form = document.getElementById('settings-main-form');
  if (!form) return;

  const payload = {
    companyName: form.companyName.value.trim(),
    companyShortName: form.companyShortName.value.trim(),
    institutionName: form.institutionName.value.trim(),
    parentInstitution: form.parentInstitution.value.trim(),
    tagline: form.tagline.value.trim(),
    address: form.address.value.trim(),
    city: form.city.value.trim(),
    phone: form.phone.value.trim(),
    whatsapp: form.whatsapp.value.trim(),
    email: form.email.value.trim(),
    website: form.website.value.trim(),
    leaderName: form.leaderName.value.trim(),
    leaderNip: form.leaderNip.value.trim(),
    leaderRole: form.leaderRole.value.trim(),
    wadir1Name: form.wadir1Name.value.trim(),
    wadir1Nip: form.wadir1Nip.value.trim(),
    wadir1Role: form.wadir1Role.value.trim(),
    headAfterSales: form.headAfterSales.value.trim(),
    headFinance: form.headFinance.value.trim(),
    bankName: form.bankName.value.trim(),
    bankBranch: form.bankBranch.value.trim(),
    bankAccount: form.bankAccount.value.trim(),
    bankAccountName: form.bankAccountName.value.trim(),
    paymentInstructions: form.paymentInstructions.value.trim(),
    copyrightText: form.copyrightText.value.trim()
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      state.settings = data;
      showToast('✅ Pengaturan profil perusahaan & pejabat resmi berhasil disimpan!', 'success');
      
      // Update application footer live
      updateAppFooterCopyright();
      
      // Re-render preview
      updateSettingsLivePreview();
    } else {
      showToast('Gagal menyimpan pengaturan perusahaan', 'error');
    }
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast('Terjadi kesalahan saat menyimpan pengaturan', 'error');
  }
}

async function resetSettingsToDefault() {
  if (!confirm('Kembalikan semua data pengaturan profil perusahaan ke nilai standar (default)?')) return;

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEFAULT_COMPANY_SETTINGS)
    });

    if (res.ok) {
      state.settings = await res.json();
      showToast('Pengaturan telah direset ke default', 'info');
      renderSettingsView();
      updateAppFooterCopyright();
    }
  } catch (err) {
    console.error('Error resetting settings:', err);
  }
}

function updateAppFooterCopyright() {
  const s = getCompanySettings();
  const footerTextEl = document.getElementById('app-footer-copyright-text');
  if (footerTextEl) {
    footerTextEl.innerHTML = `&copy; 2026 <strong>Bisnis Digital Takumi</strong> &bull; ${escapeHtml(s.companyShortName)} Enterprise Management System`;
  }
}

// =========================================================
// USER ACCOUNT MANAGEMENT (TAB 5)
// =========================================================

function generateUserAvatar(name) {
  if (!name) return 'US';
  const clean = name.replace(/^(Ir\.|Dr\.|Drs\.|Prof\.|H\.|Hj\.)\s*/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'US';
}

function renderAccountsTabTable() {
  const tbody = document.getElementById('users-table-body');
  const countBadge = document.getElementById('users-count-badge');
  if (!tbody) return;

  const users = Array.isArray(state.users) ? state.users : [];
  if (countBadge) {
    countBadge.textContent = `${users.length} Akun Terdaftar`;
  }

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px 16px; color: #64748b;">
          <i data-lucide="users-round" style="width: 36px; height: 36px; stroke-width: 1.5; color: #cbd5e1; margin-bottom: 8px;"></i>
          <p style="font-size: 13.5px; font-weight: 600; margin: 0;">Belum ada akun pengguna terdaftar</p>
          <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0 0;">Gunakan formulir di atas untuk mendaftarkan akun baru.</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = users.map((u, idx) => {
    const isMaster = (u.email || '').toLowerCase() === 'admin@ubm.co.id';
    const avatar = u.avatar || generateUserAvatar(u.name);

    // Role badge
    let roleBadge = `<span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 600; font-size: 11px;">${escapeHtml(u.role || '-')}</span>`;
    const rLower = (u.role || '').toLowerCase();
    if (rLower.includes('admin')) {
      roleBadge = `<span class="badge" style="background: #fdf2f8; color: #9d174d; border: 1px solid #fbcfe8; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Administrator</span>`;
    } else if (rLower.includes('ketua') || rLower.includes('wadir')) {
      roleBadge = `<span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="award" style="width: 12px; height: 12px;"></i> Ketua UBM</span>`;
    } else if (rLower.includes('lead')) {
      roleBadge = `<span class="badge" style="background: #fffbeb; color: #92400e; border: 1px solid #fde68a; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="folder-kanban" style="width: 12px; height: 12px;"></i> Lead Project</span>`;
    } else if (rLower.includes('finance') || rLower.includes('keuangan')) {
      roleBadge = `<span class="badge" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="banknote" style="width: 12px; height: 12px;"></i> Keuangan</span>`;
    } else {
      roleBadge = `<span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="user" style="width: 12px; height: 12px;"></i> Member</span>`;
    }

    // Status badge
    const isActive = (u.status || 'Aktif') === 'Aktif';
    const statusBadge = isActive
      ? `<span class="badge badge-success" style="font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span> Aktif</span>`
      : `<span class="badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444;"></span> Non-Aktif</span>`;

    // Date
    let dateStr = '-';
    if (u.createdAt) {
      try {
        const d = new Date(u.createdAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      } catch (e) {}
    }

    return `
      <tr>
        <td style="text-align: center; font-weight: 600; color: #64748b; font-size: 11.5px; width: 40px;">${idx + 1}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 34px; height: 34px; border-radius: 50%; background: #2563eb; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
              ${escapeHtml(avatar)}
            </div>
            <div>
              <div style="font-weight: 700; color: #0f172a; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span>${escapeHtml(u.name || '-')}</span>
                ${isMaster ? '<span class="badge" style="background: #e0e7ff; color: #3730a3; font-size: 9.5px; padding: 1px 5px; font-weight: 700;">Utama</span>' : ''}
              </div>
              <div style="font-size: 11.5px; color: #64748b; font-family: monospace;">${escapeHtml(u.email || '-')}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td style="font-size: 12.5px; color: #334155;">${escapeHtml(u.department || '-')}</td>
        <td>${statusBadge}</td>
        <td style="font-size: 11.5px; color: #64748b;">${dateStr}</td>
        <td style="text-align: right; width: 90px;">
          <div class="table-actions" style="justify-content: flex-end;">
            <button class="btn-icon" title="Edit Akun" onclick="editUserAccount('${u.id}')" style="color: #2563eb;">
              <i data-lucide="edit-3"></i>
            </button>
            ${isMaster ? `
              <button class="btn-icon" disabled title="Akun Utama tidak dapat dihapus" style="opacity: 0.35; cursor: not-allowed; color: #94a3b8;">
                <i data-lucide="lock"></i>
              </button>
            ` : `
              <button class="btn-icon text-danger" title="Hapus Akun" onclick="deleteUserAccount('${u.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function saveUserAccount(event) {
  if (event) event.preventDefault();

  const idInput = document.getElementById('user-form-id');
  const nameInput = document.getElementById('user-form-name');
  const emailInput = document.getElementById('user-form-email');
  const passwordInput = document.getElementById('user-form-password');
  const roleInput = document.getElementById('user-form-role');
  const deptInput = document.getElementById('user-form-dept');
  const statusInput = document.getElementById('user-form-status');
  const submitBtn = document.getElementById('btn-submit-user-form');

  const userId = idInput ? idInput.value.trim() : '';
  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const role = roleInput ? roleInput.value.trim() : 'Operasional & Staff';
  const department = deptInput ? deptInput.value.trim() : '';
  const status = statusInput ? statusInput.value.trim() : 'Aktif';

  if (!name || !email || !password) {
    showToast('Nama Lengkap, Email, dan Password wajib diisi!', 'warning');
    return;
  }

  // Check duplicate email
  const existingUser = (state.users || []).find(u => (u.email || '').toLowerCase() === email && u.id !== userId);
  if (existingUser) {
    showToast(`Email ${email} sudah terdaftar untuk pengguna lain!`, 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width: 14px; height: 14px;"></i> Menyimpan...`;
  }

  const avatar = generateUserAvatar(name);

  try {
    if (userId) {
      // UPDATE USER
      const userPayload = {
        name,
        email,
        password,
        role,
        department,
        status,
        avatar,
        updatedAt: new Date().toISOString()
      };

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();

      const idx = (state.users || []).findIndex(u => u.id === userId);
      if (idx !== -1) {
        state.users[idx] = { ...state.users[idx], ...updated };
      }
      showToast('Akun pengguna berhasil diperbarui!', 'success');
    } else {
      // CREATE USER
      const newId = `USR-2026-${String(Math.floor(Math.random() * 900 + 100))}`;
      const userPayload = {
        id: newId,
        name,
        email,
        password,
        role,
        department: department || 'Operations & Management',
        status,
        avatar,
        createdAt: new Date().toISOString()
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();

      if (!state.users) state.users = [];
      const existingIdx = state.users.findIndex(u => u.id === created.id || u.email === created.email);
      if (existingIdx === -1) {
        state.users.unshift(created);
      } else {
        state.users[existingIdx] = created;
      }
      showToast(`Akun ${email} berhasil didaftarkan dan dapat langsung digunakan untuk login!`, 'success');
    }

    resetUserForm();
    renderAccountsTabTable();
  } catch (err) {
    console.error('Error saving user account:', err);
    showToast('Gagal menyimpan akun: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      const isEdit = document.getElementById('user-form-id')?.value;
      submitBtn.innerHTML = `<i data-lucide="user-check"></i> <span id="btn-submit-user-text">${isEdit ? 'Perbarui Akun' : 'Simpan Akun'}</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

function editUserAccount(id) {
  const user = (state.users || []).find(u => u.id === id);
  if (!user) return;

  const idInput = document.getElementById('user-form-id');
  const nameInput = document.getElementById('user-form-name');
  const emailInput = document.getElementById('user-form-email');
  const passwordInput = document.getElementById('user-form-password');
  const roleInput = document.getElementById('user-form-role');
  const deptInput = document.getElementById('user-form-dept');
  const statusInput = document.getElementById('user-form-status');
  const titleEl = document.getElementById('user-form-title');
  const submitTextEl = document.getElementById('btn-submit-user-text');
  const cancelBtn = document.getElementById('btn-cancel-user-form');

  if (idInput) idInput.value = user.id;
  if (nameInput) nameInput.value = user.name || '';
  if (emailInput) emailInput.value = user.email || '';
  if (passwordInput) passwordInput.value = user.password || '';
  if (roleInput) roleInput.value = user.role || 'Super Administrator';
  if (deptInput) deptInput.value = user.department || '';
  if (statusInput) statusInput.value = user.status || 'Aktif';

  if (titleEl) {
    titleEl.innerHTML = `<i data-lucide="edit-3" style="color: #f59e0b; width: 18px; height: 18px;"></i> Edit Akun Pengguna: ${escapeHtml(user.name)}`;
  }
  if (submitTextEl) submitTextEl.textContent = 'Perbarui Akun';
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  if (window.lucide) lucide.createIcons();

  const formCard = document.getElementById('user-form-card');
  if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetUserForm() {
  const idInput = document.getElementById('user-form-id');
  const nameInput = document.getElementById('user-form-name');
  const emailInput = document.getElementById('user-form-email');
  const passwordInput = document.getElementById('user-form-password');
  const roleInput = document.getElementById('user-form-role');
  const deptInput = document.getElementById('user-form-dept');
  const statusInput = document.getElementById('user-form-status');
  const titleEl = document.getElementById('user-form-title');
  const submitTextEl = document.getElementById('btn-submit-user-text');
  const cancelBtn = document.getElementById('btn-cancel-user-form');

  if (idInput) idInput.value = '';
  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (roleInput) roleInput.value = 'Operasional & Staff';
  if (deptInput) deptInput.value = '';
  if (statusInput) statusInput.value = 'Aktif';

  if (titleEl) {
    titleEl.innerHTML = `<i data-lucide="user-plus" style="color: #2563eb; width: 18px; height: 18px;"></i> Tambah Akun Pengguna Baru`;
  }
  if (submitTextEl) submitTextEl.textContent = 'Simpan Akun';
  if (cancelBtn) cancelBtn.style.display = 'none';

  if (window.lucide) lucide.createIcons();
}

async function deleteUserAccount(id) {
  const user = (state.users || []).find(u => u.id === id);
  if (!user) return;

  if (user.email === 'admin@ubm.co.id') {
    showToast('Akun Super Administrator Utama tidak dapat dihapus demi keamanan sistem.', 'warning');
    return;
  }

  if (!confirm(`Hapus akun pengguna "${user.name}" (${user.email})?\n\nPengguna ini tidak akan dapat login ke sistem lagi.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    state.users = (state.users || []).filter(u => u.id !== id);
    showToast(`Akun ${user.name} berhasil dihapus.`, 'info');
    renderAccountsTabTable();
  } catch (err) {
    console.error('Error deleting user account:', err);
    showToast('Gagal menghapus akun: ' + err.message, 'error');
  }
}

// Global window bindings
window.switchSettingsTab = switchSettingsTab;
window.renderSettingsView = renderSettingsView;
window.saveCompanySettings = saveCompanySettings;
window.resetSettingsToDefault = resetSettingsToDefault;
window.renderAccountsTabTable = renderAccountsTabTable;
window.saveUserAccount = saveUserAccount;
window.editUserAccount = editUserAccount;
window.resetUserForm = resetUserForm;
window.deleteUserAccount = deleteUserAccount;

