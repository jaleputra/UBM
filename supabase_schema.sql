-- =========================================================
-- UBM (Universal Business Management) ERP - Supabase SQL Schema
-- Compatibility: Supabase / PostgreSQL 14+
-- Modules: Quotations, Orders, Purchase Orders (PO), Invoices, Purchasing (PR), BOM, Delivery
-- =========================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------
-- 0. TABLE: quotations (Surat Penawaran Harga)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotations (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(100),
    customer_email VARCHAR(255),
    customer_address TEXT,
    pic_name VARCHAR(150),
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Sent',
    warranty TEXT,
    lead_time VARCHAR(150),
    payment_terms VARCHAR(255),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON public.quotations(quotation_date);

-- ---------------------------------------------------------
-- 1. TABLE: orders (Sales Orders)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(100),
    customer_address TEXT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Confirmed',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    po_document JSONB,
    po_file_url TEXT,
    po_file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration helpers if table already exists:
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_document JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_file_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_file_name TEXT;

-- ---------------------------------------------------------
-- 2. TABLE: po (Purchase Orders to Vendors)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po (
    id VARCHAR(50) PRIMARY KEY,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_contact VARCHAR(255),
    vendor_email VARCHAR(255),
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
    payment_terms VARCHAR(100) DEFAULT 'NET 30',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 3. TABLE: invoices (Customer Billing & Invoices)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
    payment_method VARCHAR(100) DEFAULT 'Bank Transfer',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 4. TABLE: purchasing (Purchase Requisitions / PR)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchasing (
    id VARCHAR(50) PRIMARY KEY,
    requestor VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    urgency VARCHAR(50) NOT NULL DEFAULT 'Medium',
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    purpose TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_estimated NUMERIC(15, 2) NOT NULL DEFAULT 0,
    approved_by VARCHAR(255) DEFAULT '-',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 5. TABLE: bom (Bill of Materials & Product Formulas)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bom (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100) NOT NULL,
    revision VARCHAR(50) DEFAULT 'v1.0',
    category VARCHAR(100) DEFAULT 'General Assembly',
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    labor_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    overhead_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    material_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_estimated_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure column exists if table was already created
ALTER TABLE public.bom ADD COLUMN IF NOT EXISTS order_id VARCHAR(50);

-- ---------------------------------------------------------
-- 6. TABLE: delivery (Delivery Orders / Surat Jalan)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_address TEXT,
    courier_name VARCHAR(255),
    driver_name VARCHAR(255),
    tracking_number VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Packing / Ready',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    received_by VARCHAR(255) DEFAULT '-',
    received_at VARCHAR(100) DEFAULT '-',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 7. TABLE: activity_logs (Log Kegiatan & Agenda Kalender UBM)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    project_name VARCHAR(255),
    task VARCHAR(255) NOT NULL,
    pic VARCHAR(150) NOT NULL,
    category VARCHAR(100) DEFAULT 'Produksi',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Sedang Berjalan',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration support for existing Supabase databases
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);

-- =========================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON public.activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_name ON public.activity_logs(project_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_start_date ON public.activity_logs(start_date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_end_date ON public.activity_logs(end_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.po(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_status ON public.purchasing(status);
CREATE INDEX IF NOT EXISTS idx_bom_code ON public.bom(product_code);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON public.delivery(status);
CREATE INDEX IF NOT EXISTS idx_delivery_order ON public.delivery(order_id);

-- =========================================================
-- AUTO-UPDATE 'updated_at' TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
DROP TRIGGER IF EXISTS trigger_quotations_updated_at ON public.quotations;
CREATE TRIGGER trigger_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_po_updated_at ON public.po;
CREATE TRIGGER trigger_po_updated_at BEFORE UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON public.invoices;
CREATE TRIGGER trigger_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_purchasing_updated_at ON public.purchasing;
CREATE TRIGGER trigger_purchasing_updated_at BEFORE UPDATE ON public.purchasing FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_bom_updated_at ON public.bom;
CREATE TRIGGER trigger_bom_updated_at BEFORE UPDATE ON public.bom FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_delivery_updated_at ON public.delivery;
CREATE TRIGGER trigger_delivery_updated_at BEFORE UPDATE ON public.delivery FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_activity_logs_updated_at ON public.activity_logs;
CREATE TRIGGER trigger_activity_logs_updated_at BEFORE UPDATE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchasing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow Public / Authenticated Access for Enterprise App Operations
CREATE POLICY "Allow all access to quotations" ON public.quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to po" ON public.po FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to purchasing" ON public.purchasing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bom" ON public.bom FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to delivery" ON public.delivery FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- INITIAL SAMPLE DATA SEEDING (UBM ERP Records)
-- =========================================================

-- 0. Seed Quotations
INSERT INTO public.quotations (id, customer_name, customer_phone, customer_email, customer_address, pic_name, quotation_date, valid_until, status, warranty, lead_time, payment_terms, items, subtotal, discount, tax_rate, tax_amount, grand_total, notes)
VALUES
('QUO-2026-001', 'PT Astra Otoparts Tbk', '081388997766', 'procurement@component.astra.co.id', 'Kawasan Industri KIIC Lot C-4, Karawang Barat, Jawa Barat', 'Bpk. Hendra Gunawan', '2026-09-01', '2026-09-25', 'Sent', 'Garansi servis & sparepart 12 bulan (1 tahun) sejak serah terima', '14 hari kerja setelah PO resmi diterbitkan', 'DP 40%, Pelunasan 60% setelah pengujian fungsi (FAT) & BAST', '[{"sku": "MCV-HS-01", "qty": 2, "unit": "Unit", "total": 70000000, "itemName": "Modul Conveyor Otomatis High Speed (Sensor Infrared)", "warranty": "12 Bulan", "unitPrice": 35000000}, {"sku": "PLC-S7-HMI", "qty": 1, "unit": "Set", "total": 28500000, "itemName": "Control Box PLC Siemens S7-1200 + HMI Touchscreen 7 Inch", "warranty": "12 Bulan", "unitPrice": 28500000}]'::jsonb, 98500000, 0, 11, 10835000, 109335000, 'Harga sudah termasuk biaya pengiriman area Jabodetabek & instalasi onsite.')
ON CONFLICT (id) DO NOTHING;

-- 1. Seed Orders
INSERT INTO public.orders (id, customer_name, customer_phone, customer_address, order_date, due_date, status, items, subtotal, tax_rate, tax_amount, grand_total, notes)
VALUES 
('ORD-2026-001', 'PT Surya Mandiri Teknik', '+62 812-3456-7890', 'Jl. Industri Raya No. 45, Cikarang, Bekasi', '2026-08-25', '2026-09-10', 'In Production', '[{"sku": "PL-3P-01", "qty": 2, "unit": "Unit", "total": 25000000, "itemName": "Panel Listrik Distribusi 3 Phase", "unitPrice": 12500000}, {"sku": "KBL-NYY-16", "qty": 4, "unit": "Roll", "total": 7200000, "itemName": "Kabel NYY 4x16mm (50m)", "unitPrice": 1800000}]'::jsonb, 32200000, 11, 3542000, 35742000, 'Pengiriman tahap 1 dijadwalkan awal September'),
('ORD-2026-002', 'CV Karya Abadi Sejahtera', '+62 821-9876-5432', 'Kawasan Industri MM2100 Blok C2, Cibitung', '2026-08-28', '2026-09-05', 'Confirmed', '[{"sku": "MOT-75KW", "qty": 3, "unit": "Unit", "total": 18600000, "itemName": "Motor Induksi 7.5 kW", "unitPrice": 6200000}, {"sku": "INV-10HP", "qty": 3, "unit": "Unit", "total": 13500000, "itemName": "Inverter VFD 10HP", "unitPrice": 4500000}]'::jsonb, 32100000, 11, 3531000, 35631000, 'Mohon sertakan test report sertifikasi pabrik'),
('ORD-2026-003', 'PT Mitra Bangun Nusantara', '+62 857-1122-3344', 'Jl. Gatot Subroto Kav. 18, Jakarta Selatan', '2026-09-01', '2026-09-15', 'Completed', '[{"sku": "RAK-42U", "qty": 5, "unit": "Unit", "total": 21000000, "itemName": "Rak Server 42U Heavy Duty", "unitPrice": 4200000}]'::jsonb, 21000000, 11, 2310000, 23310000, 'Pesanan selesai dan telah diterima gudang pusat')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed PO
INSERT INTO public.po (id, vendor_name, vendor_contact, vendor_email, po_date, expected_date, status, payment_terms, items, subtotal, tax_rate, tax_amount, grand_total, notes)
VALUES 
('PO-2026-001', 'PT Schneider Electric Supply', 'Budi Santoso (0813-8899-7766)', 'sales@schneider-partner.id', '2026-08-20', '2026-08-30', 'Received', 'NET 30', '[{"sku": "MCCB-250A", "qty": 10, "unit": "Pcs", "total": 14500000, "itemName": "MCCB 3P 250A 36kA", "unitPrice": 1450000}, {"sku": "CT-40A", "qty": 25, "unit": "Pcs", "total": 8000000, "itemName": "Contactor 3P 40A 220V", "unitPrice": 320000}]'::jsonb, 22500000, 11, 2475000, 24975000, 'Barang telah diterima di Gudang Utama UBM'),
('PO-2026-002', 'CV Metal Presisi Perkasa', 'Hendro Wicaksono (0818-4455-6677)', 'hendro@metalpresisi.com', '2026-08-29', '2026-09-08', 'Approved', 'NET 14', '[{"sku": "PLT-SPCC-2", "qty": 50, "unit": "Lembar", "total": 14000000, "itemName": "Plat Besi Enclosure SPCC 2.0mm", "unitPrice": 280000}, {"sku": "PCO-7035", "qty": 100, "unit": "Kg", "total": 6500000, "itemName": "Powder Coating Grey RAL 7035", "unitPrice": 65000}]'::jsonb, 20500000, 11, 2255000, 22755000, 'Material utama untuk pembuatan Box Panel batch Q3'),
('PO-2026-003', 'PT Tembaga Nusantara Jaya', 'Dewi Sartika (0812-7788-9900)', 'order@tembaganusantara.co.id', '2026-09-01', '2026-09-12', 'Pending Approval', 'Cash on Delivery', '[{"sku": "BSB-CU-305", "qty": 20, "unit": "Batang", "total": 9600000, "itemName": "Busbar Tembaga Cu 30x5mm (4m)", "unitPrice": 480000}]'::jsonb, 9600000, 11, 1056000, 10656000, 'Menunggu persetujuan Finance Manager')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Invoices
INSERT INTO public.invoices (id, order_id, customer_name, invoice_date, due_date, status, payment_method, items, subtotal, tax_rate, tax_amount, grand_total, paid_amount, balance_due, notes)
VALUES 
('INV-2026-001', 'ORD-2026-003', 'PT Mitra Bangun Nusantara', '2026-09-01', '2026-09-30', 'Paid', 'Bank Transfer BCA', '[{"qty": 5, "unit": "Unit", "total": 21000000, "itemName": "Rak Server 42U Heavy Duty", "unitPrice": 4200000}]'::jsonb, 21000000, 11, 2310000, 23310000, 23310000, 0, 'Lunas ditransfer ke rekening BCA PT UBM Mandiri'),
('INV-2026-002', 'ORD-2026-001', 'PT Surya Mandiri Teknik', '2026-08-27', '2026-09-26', 'Partial', 'Bank Transfer Mandiri', '[{"qty": 1, "unit": "Lot", "total": 17871000, "itemName": "Panel Listrik Distribusi 3 Phase (DP 50%)", "unitPrice": 17871000}]'::jsonb, 16100000, 11, 1771000, 17871000, 10000000, 7871000, 'Termin 1 (DP) telah diterima, pelunasan saat BAST'),
('INV-2026-003', 'ORD-2026-002', 'CV Karya Abadi Sejahtera', '2026-08-29', '2026-09-12', 'Unpaid', 'Bank Transfer BCA', '[{"qty": 3, "unit": "Unit", "total": 18600000, "itemName": "Motor Induksi 7.5 kW", "unitPrice": 6200000}, {"qty": 3, "unit": "Unit", "total": 13500000, "itemName": "Inverter VFD 10HP", "unitPrice": 4500000}]'::jsonb, 32100000, 11, 3531000, 35631000, 0, 35631000, 'Faktur telah dikirim via email Finance')
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Purchasing (PR)
INSERT INTO public.purchasing (id, requestor, department, request_date, urgency, status, purpose, items, total_estimated, approved_by)
VALUES 
('PR-2026-001', 'Agus Setiawan (Divisi Fabrikasi)', 'Produksi & Workshop', '2026-08-28', 'High', 'Approved', 'Pengadaan mata gerinda potong dan kawat las CO2', '[{"qty": 10, "unit": "Roll", "total": 3800000, "itemName": "Kawat Las MIG/MAG Solid Wire ER70S-6 (15kg)", "estimatedPrice": 380000}, {"qty": 200, "unit": "Pcs", "total": 1700000, "itemName": "Batu Gerinda Potong 4 inch WD", "estimatedPrice": 8500}]'::jsonb, 5500000, 'Ir. Bambang Hidayat (Factory Mgr)'),
('PR-2026-002', 'Rina Marlina (Divisi QA/QC)', 'Quality Assurance', '2026-08-31', 'Medium', 'Pending', 'Kalibrasi alat ukur Digital Vernier Caliper & Insulation Tester', '[{"qty": 4, "unit": "Alat", "total": 3000000, "itemName": "Jasa Kalibrasi ISO 17025 Caliper & Multimeter", "estimatedPrice": 750000}]'::jsonb, 3000000, '-'),
('PR-2026-003', 'Dedi Prasetyo (Maintenance)', 'Facility & Maintenance', '2026-09-02', 'Low', 'In Review', 'Oli hidrolik mesin bending plat CNC', '[{"qty": 1, "unit": "Drum", "total": 6800000, "itemName": "Hydraulic Oil Tellus S2 M 46 (209L)", "estimatedPrice": 6800000}]'::jsonb, 6800000, '-')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed BOM
INSERT INTO public.bom (id, product_name, product_code, revision, category, created_date, status, labor_cost, overhead_cost, components, material_cost, total_estimated_cost, notes)
VALUES 
('BOM-2026-001', 'Panel Distribusi Listrik 3 Phase 100kVA', 'PNL-DIST-100K', 'v2.1', 'Electrical Assembly', '2026-08-15', 'Active', 1500000, 500000, '[{"qty": 1, "sku": "ENC-1886", "unit": "Unit", "unitCost": 3200000, "totalCost": 3200000, "componentName": "Box Enclosure Free Standing 1800x800x600"}, {"qty": 1, "sku": "MCCB-250A", "unit": "Pcs", "unitCost": 1450000, "totalCost": 1450000, "componentName": "Main MCCB 3P 250A"}, {"qty": 6, "sku": "MCB-3P-32", "unit": "Pcs", "unitCost": 180000, "totalCost": 1080000, "componentName": "Branch MCB 3P 32A"}, {"qty": 3, "sku": "BSB-CU-305", "unit": "Batang", "unitCost": 480000, "totalCost": 1440000, "componentName": "Busbar Tembaga Cu 30x5mm"}, {"qty": 1, "sku": "MTR-PM5350", "unit": "Unit", "unitCost": 2200000, "totalCost": 2200000, "componentName": "Digital Power Meter Schneider PM5350"}, {"qty": 1, "sku": "ACC-PLCT", "unit": "Set", "unitCost": 450000, "totalCost": 450000, "componentName": "Pilot Lamp & CT 250/5A Set"}]'::jsonb, 9820000, 11820000, 'Standar IEC 61439-1 / IP54 untuk outdoor protection'),
('BOM-2026-002', 'Star Delta Motor Starter 30kW', 'STR-DEL-30K', 'v1.0', 'Control System', '2026-08-22', 'Active', 600000, 200000, '[{"qty": 1, "sku": "ENC-6040", "unit": "Unit", "unitCost": 750000, "totalCost": 750000, "componentName": "Box Wall Mount 600x400x200"}, {"qty": 3, "sku": "CT-65A", "unit": "Pcs", "unitCost": 420000, "totalCost": 1260000, "componentName": "Magnetic Contactor 3P 65A"}, {"qty": 1, "sku": "TOR-65A", "unit": "Pcs", "unitCost": 380000, "totalCost": 380000, "componentName": "Thermal Overload Relay 48-65A"}, {"qty": 1, "sku": "TMR-SD22", "unit": "Pcs", "unitCost": 190000, "totalCost": 190000, "componentName": "Star Delta Electronic Timer 220V"}]'::jsonb, 2580000, 3380000, 'Digunakan untuk starting motor pompa cooling tower')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Delivery
INSERT INTO public.delivery (id, order_id, customer_name, delivery_date, delivery_address, courier_name, driver_name, tracking_number, status, items, received_by, received_at, notes)
VALUES 
('DO-2026-001', 'ORD-2026-003', 'PT Mitra Bangun Nusantara', '2026-09-01', 'Gedung Cyber 2 Lantai 12, Jl. HR Rasuna Said Blok X-5, Jakarta', 'Armada UBM Box (B 9128 UBM)', 'Sutrisno (+62 878-5544-3322)', 'UBM-EXP-082601', 'Delivered', '[{"qty": 5, "unit": "Unit", "itemName": "Rak Server 42U Heavy Duty", "serialNumbers": "RS42U-001 s/d RS42U-005"}]'::jsonb, 'Farhan (Security Cyber 2)', '2026-09-01 14:30 WIB', 'Telah ditandatangani BAST fisik'),
('DO-2026-002', 'ORD-2026-001', 'PT Surya Mandiri Teknik', '2026-09-03', 'Jl. Industri Raya No. 45, Kawasan Industri Jababeka 1, Cikarang', 'Ekspedisi Wahana Logistik', 'Kurniawan (0856-1122-8877)', 'UBM-WHN-260903', 'In Transit', '[{"qty": 4, "unit": "Roll", "itemName": "Kabel NYY 4x16mm (50m)", "serialNumbers": "NYY-16-BATCH-44"}]'::jsonb, '-', '-', 'Pengiriman tahap 1 kabel power'),
('DO-2026-003', 'ORD-2026-002', 'CV Karya Abadi Sejahtera', '2026-09-04', 'Kawasan Industri MM2100 Blok C2, Cibitung, Bekasi', 'Armada UBM Pick-up (B 9482 BCD)', 'Ahmad Dani (0819-2233-4455)', 'UBM-PKP-090401', 'Packing / Ready', '[{"qty": 3, "unit": "Unit", "itemName": "Motor Induksi 7.5 kW", "serialNumbers": "MI-75-01, MI-75-02, MI-75-03"}, {"qty": 3, "unit": "Unit", "itemName": "Inverter VFD 10HP", "serialNumbers": "VFD10-101, VFD10-102, VFD10-103"}]'::jsonb, '-', '-', 'Barang sudah siap di staging area packing')
ON CONFLICT (id) DO NOTHING;
