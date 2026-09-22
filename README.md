# UBM - Universal Business Management System

Aplikasi web manajemen bisnis dan operasional terintegrasi berbasis **Node.js** dan **JavaScript**.

---

## 🚀 Fitur & Modul Utama

1. **Dashboard Overview**
   - KPI Metrik: Total Sales Order, Nilai Order, Total PO Vendor, Faktur Belum Lunas, Status Delivery & Master BOM.
   - Akses Cepat (*Quick Shortcuts*) ke seluruh modul.
   - Timeline aktivitas transaksi terkini.

2. **Order (Sales Order)**
   - Manajemen pesanan pelanggan dengan status (*Confirmed, In Production, Completed, Cancelled*).
   - Multi-item line builder dengan kalkulasi otomatis Subtotal, PPN 11%, dan Grand Total.
   - Export data ke CSV.

3. **PO (Purchase Order)**
   - Manajemen pesanan pengadaan bahan baku/komponen ke vendor.
   - Pencatatan termin pembayaran (*COD, NET 14, NET 30, DP*).
   - Pratinjau dokumen PO resmi siap cetak.

4. **Invoice (Faktur Tagihan)**
   - Penerbitan faktur tagihan pelanggan (dapat ditautkan ke Sales Order).
   - Pelacakan status bayar (*Paid, Partial, Unpaid, Overdue*), pencatatan nominal pembayaran & sisa tagihan.
   - **Cetak Faktur Komersial**: Template invoice profesional siap cetak/PDF.

5. **Purchasing (Purchase Requisition / PR)**
   - Pengajuan kebutuhan barang/jasa internal antar divisi (*Produksi, QA, Maintenance, Logistik, IT*).
   - Tingkat urgensi (*Low, Medium, High*) dan workflow persetujuan (*Pending, In Review, Approved, Rejected*).

6. **BOM (Bill of Materials)**
   - Master formula struktur bahan baku produk manufaktur/assembly.
   - Kalkulasi otomatis total biaya material, biaya tenaga kerja (*labor*), overhead, dan estimasi total HPP unit.

7. **Delivery (Surat Jalan / Delivery Order)**
   - Manajemen pengiriman barang ke alamat pelanggan.
   - Pelacakan armada, nomor resi/tracking, nama driver, serta status (*Packing/Ready, In Transit, Delivered*).
   - **Cetak Surat Jalan**: Template resmi Delivery Order dengan kolom tanda tangan serah terima barang.

---

## 📁 Struktur Direktori

```text
UBM/
├── data/
│   └── db.json          # Database JSON lokal persisten & data awal (seed data)
├── public/
│   ├── css/
│   │   └── style.css    # Desain antarmuka ERP modern (Dark Mode, Glassmorphism, Print CSS)
│   ├── js/
│   │   └── app.js       # SPA client controller, REST API caller, modal handler, kalkulasi otomatis
│   └── index.html       # Antarmuka dashboard & layout aplikasi UBM
├── package.json         # Konfigurasi dependensi Node.js (Express, Cors, Morgan)
├── server.js            # Server backend Express & REST API endpoints
└── README.md
```

---

## 💻 Cara Menjalankan Aplikasi

1. Buka terminal di folder workspace:
   ```bash
   cd /Users/roughtell/.gemini/antigravity-ide/scratch/UBM
   ```

2. Jalankan server:
   ```bash
   npm start
   # atau untuk mode auto-reload dev:
   npm run dev
   ```

3. Buka browser di:
   ```
   http://localhost:3000
   ```
# UBM
