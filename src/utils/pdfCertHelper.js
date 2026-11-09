/**
 * UBM - PDF Certificate Generator Helper (Pure Node.js, Compliant PDF 1.4)
 * Menghasilkan berkas PDF sertifikat verifikasi tanda tangan digital resmi
 * "Approved by [Nama Pejabat]" tanpa ketergantungan library eksternal.
 */

function sanitizePdfText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function generateSignatureVerificationPdf({
  name = 'Pejabat Berwenang',
  role = 'Pimpinan UBM Politeknik Takumi',
  doc = 'DOK-UBM-2026',
  title = 'Dokumen Operasional UBM',
  date = ''
}) {
  const cleanName = sanitizePdfText(name) || 'Rizaldi Putra, M.Kom.';
  const cleanRole = sanitizePdfText(role) || 'Pimpinan Unit Bisnis Mandiri (UBM)';
  const cleanDoc = sanitizePdfText(doc) || '-';
  const cleanTitle = sanitizePdfText(title) || 'Dokumen Resmi UBM';
  const cleanDate = sanitizePdfText(date) || new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  // Standar Halaman A4: 595 x 842 points
  const streamLines = [
    'q',
    // 1. Header Banner (Deep Navy Blue)
    '0.1 0.22 0.45 rg',
    '30 730 535 75 re f',
    'BT',
    '/F1 15 Tf',
    '1 1 1 rg', // Putih
    '50 774 Td',
    '(POLITEKNIK TAKUMI - UNIT BISNIS MANDIRI \\(UBM\\)) Tj',
    '/F1 10.5 Tf',
    '0 -17 Td',
    '(SISTEM VERIFIKASI PENGESAHAN TANDA TANGAN ELEKTRONIK RESMI) Tj',
    'ET',

    // 2. Main Outer Card Border
    '0.82 0.86 0.9 RG',
    '1.2 w',
    '30 190 535 530 re S',

    // 3. Status Badge Box: APPROVED & DIGITALLY VERIFIED (Soft Green Fill + Border)
    '0.91 0.98 0.93 rg',
    '50 645 495 55 re f',
    '0.15 0.65 0.3 RG',
    '1.5 w',
    '50 645 495 55 re S',

    'BT',
    '/F1 14 Tf',
    '0.04 0.48 0.2 rg', // Dark Emerald Green
    '70 676 Td',
    '([V] APPROVED & DIGITALLY VERIFIED) Tj',
    '/F1 9 Tf',
    '0 -16 Td',
    '(Tanda tangan digital ini sah dan tersimpan resmi pada sistem database UBM Politeknik Takumi.) Tj',
    'ET',

    // 4. Section Title: RINCIAN PENGESAHAN DOKUMEN
    'BT',
    '/F1 11 Tf',
    '0.1 0.15 0.2 rg',
    '50 595 Td',
    '(RINCIAN PENGESAHAN PEJABAT BERWENANG:) Tj',
    'ET',

    // Garis Pemisah
    '0.85 0.88 0.92 RG',
    '0.75 w',
    '50 582 m 545 582 l S',

    // 5. Data Rows (Labels & Values)
    'BT',
    '/F1 10 Tf',
    '0.35 0.4 0.45 rg',
    '60 550 Td (Approved By              :) Tj',
    '60 520 Td (Jabatan Resmi            :) Tj',
    '60 490 Td (Nomor Dokumen            :) Tj',
    '60 460 Td (Perihal / Nama Proyek    :) Tj',
    '60 430 Td (Tanggal & Waktu Validasi :) Tj',
    '60 400 Td (Status Keabsahan         :) Tj',
    'ET',

    'BT',
    '/F1 10.5 Tf',
    '0.06 0.12 0.22 rg',
    '225 550 Td (' + cleanName + ') Tj',
    '225 520 Td (' + cleanRole + ') Tj',
    '225 490 Td (' + cleanDoc + ') Tj',
    '225 460 Td (' + cleanTitle.substring(0, 48) + ') Tj',
    '225 430 Td (' + cleanDate + ') Tj',
    '/F1 10.5 Tf',
    '0.05 0.55 0.22 rg',
    '225 400 Td (TERVERIFIKASI & MEMILIKI KEKUATAN HUKUM SAH) Tj',
    'ET',

    // 6. Footer Notes Section
    '0.85 0.88 0.92 RG',
    '0.75 w',
    '50 365 m 545 365 l S',

    'BT',
    '/F1 8.5 Tf',
    '0.4 0.45 0.5 rg',
    '50 340 Td (1. Berkas PDF ini diterbitkan secara otomatis oleh Sistem Informasi UBM melalui pemindaian QR Code resmi.) Tj',
    '50 324 Td (2. Keabsahan tanda tangan pejabat di atas terdaftar permanen pada database UBM Politeknik Takumi.) Tj',
    '50 308 Td (3. Segala bentuk pemalsuan atau modifikasi tidak sah tunduk pada ketentuan hukum yang berlaku.) Tj',
    '/F1 8 Tf',
    '0.45 0.5 0.55 rg',
    '50 282 Td (Unit Bisnis Mandiri \\(UBM\\) - Politeknik Takumi &bull; Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi 17530) Tj',
    '50 268 Td (Telp: \\(021\\) 8990-1234 &bull; Email: ubm@takumi.ac.id &bull; Web: ubm.takumi.ac.id) Tj',
    'ET',
    'Q'
  ];

  const streamContent = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'latin1');

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[5] = '<< /Length ' + streamLength + ' >>\nstream\n' + streamContent + '\nendstream';

  let pdf = '%PDF-1.4\n';
  const offsets = [];

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += i + ' 0 obj\n' + objects[i] + '\nendobj\n';
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n';
  pdf += '0 ' + objects.length + '\n';
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < objects.length; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    pdf += offStr + ' 00000 n \n';
  }

  pdf += 'trailer\n';
  pdf += '<< /Size ' + objects.length + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n';
  pdf += xrefOffset + '\n';
  pdf += '%%EOF\n';

  return Buffer.from(pdf, 'latin1');
}

module.exports = {
  generateSignatureVerificationPdf
};

