-- =========================================================
-- UBM (Universal Business Management) ERP - Supabase SQL Schema
-- Compatibility: Supabase / PostgreSQL 14+
-- Relational Modules: Quotations, Orders, Projects, BOM, Purchasing (PR),
-- PO, Delivery, Invoices, BAST, Project Reports, Maintenance,
-- Service Tickets, Warranty Claims, Partnerships, Service Expenses,
-- Activity Logs, Users, Settings
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------
-- 1. TABLE: quotations (Surat Penawaran Harga)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotations (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    quotation_type VARCHAR(50) DEFAULT 'produk',
    customer_name VARCHAR(255) NOT NULL,
    project_name VARCHAR(255),
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
    additional_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    rab_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_modal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    estimated_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    main_items_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    services_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    items_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    warranty_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    approval_ketua_ubm BOOLEAN DEFAULT FALSE,
    approval_ketua_ubm_by TEXT,
    approval_ketua_ubm_date TIMESTAMP WITH TIME ZONE,
    approval_direktur BOOLEAN DEFAULT FALSE,
    approval_direktur_by TEXT,
    approval_direktur_date TIMESTAMP WITH TIME ZONE,
    pdf_url TEXT,
    pdf_filename TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 2. TABLE: orders (Sales Orders / Pesanan Penjualan)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(50) PRIMARY KEY,
    quotation_id VARCHAR(50),
    order_type VARCHAR(50) DEFAULT 'produk',
    quotation_type VARCHAR(50) DEFAULT 'produk',
    customer_name VARCHAR(255) NOT NULL,
    project_name VARCHAR(255),
    customer_phone VARCHAR(100),
    customer_address TEXT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pengajuan',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    additional_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    main_items_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    services_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    items_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    warranty_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    po_document JSONB,
    po_file_url TEXT,
    po_file_name TEXT,
    approval_ketua_ubm BOOLEAN DEFAULT FALSE,
    approval_ketua_ubm_by VARCHAR(255),
    approval_ketua_ubm_date TIMESTAMP WITH TIME ZONE,
    approval_wadir1 BOOLEAN DEFAULT FALSE,
    approval_wadir1_by VARCHAR(255),
    approval_wadir1_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quotation_id VARCHAR(50);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'produk';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quotation_type VARCHAR(50) DEFAULT 'produk';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS additional_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS main_items_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS services_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS warranty_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_document JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_file_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_file_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval_ketua_ubm BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval_ketua_ubm_by VARCHAR(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval_ketua_ubm_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval_wadir1 BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval_wadir1_by VARCHAR(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval_wadir1_date TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------
-- 3. TABLE: projects (Project Management & Timeline)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    quotation_id VARCHAR(50),
    bom_id VARCHAR(50),
    project_name VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    project_lead VARCHAR(255),
    department VARCHAR(255),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Planning',
    progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    is_service BOOLEAN DEFAULT FALSE,
    service_expense_approved BOOLEAN DEFAULT FALSE,
    milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
    team JSONB NOT NULL DEFAULT '[]'::jsonb,
    modal_cost JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 4. TABLE: bom (Bill of Materials & Product Formulas)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bom (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    project_id VARCHAR(50),
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100) NOT NULL,
    revision VARCHAR(50) DEFAULT 'v1.0',
    category VARCHAR(100) DEFAULT 'General Assembly',
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pengajuan',
    labor_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    overhead_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    material_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_estimated_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bom ADD COLUMN IF NOT EXISTS order_id VARCHAR(50);
ALTER TABLE public.bom ADD COLUMN IF NOT EXISTS project_id VARCHAR(50);

-- ---------------------------------------------------------
-- 5. TABLE: purchasing (Purchase Requisitions / PR - Tab 1)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchasing (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    bom_id VARCHAR(50),
    requestor VARCHAR(255) NOT NULL,
    pic_name VARCHAR(255),
    department VARCHAR(255) NOT NULL,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date DATE,
    urgency VARCHAR(50) NOT NULL DEFAULT 'Medium',
    status VARCHAR(50) NOT NULL DEFAULT 'Pengajuan',
    purpose TEXT,
    notes TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_estimated NUMERIC(15, 2) NOT NULL DEFAULT 0,
    approved_by VARCHAR(255) DEFAULT '-',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.purchasing ADD COLUMN IF NOT EXISTS order_id VARCHAR(50);
ALTER TABLE public.purchasing ADD COLUMN IF NOT EXISTS bom_id VARCHAR(50);
ALTER TABLE public.purchasing ADD COLUMN IF NOT EXISTS pic_name VARCHAR(255);
ALTER TABLE public.purchasing ADD COLUMN IF NOT EXISTS required_date DATE;
ALTER TABLE public.purchasing ADD COLUMN IF NOT EXISTS notes TEXT;

-- ---------------------------------------------------------
-- 5B. TABLE: purchasing_process (Tab 2: Proses Pembelian Barang)
-- Berelasi ke public.purchasing(id) ON DELETE CASCADE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchasing_process (
    id VARCHAR(100) PRIMARY KEY,
    pr_id VARCHAR(50) NOT NULL REFERENCES public.purchasing(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL DEFAULT 0,
    requestor VARCHAR(255),
    department VARCHAR(255),
    request_date DATE DEFAULT CURRENT_DATE,
    item_name VARCHAR(255) NOT NULL,
    specs TEXT,
    qty NUMERIC(15, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'Pcs',
    estimated_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    order_date DATE,
    order_link TEXT,
    arrival_date DATE,
    recipient_name VARCHAR(255),
    item_photo TEXT,
    item_status VARCHAR(50) NOT NULL DEFAULT 'Proses Pembelian',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 5C. TABLE: master_items (Tab 3: Database Master Barang / Inventaris)
-- Menyimpan stok & harga barang yang telah diverifikasi 'Sesuai'
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.master_items (
    id VARCHAR(100) PRIMARY KEY,
    item_key VARCHAR(255) UNIQUE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    specs TEXT,
    unit VARCHAR(50) DEFAULT 'Pcs',
    qty NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    departments JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'Sesuai',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 6. TABLE: po (Purchase Orders to Vendors)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    purchasing_id VARCHAR(50),
    vendor_name VARCHAR(255) NOT NULL,
    vendor_contact VARCHAR(255),
    vendor_email VARCHAR(255),
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    expected_delivery DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
    payment_terms VARCHAR(100) DEFAULT 'NET 30',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.po ADD COLUMN IF NOT EXISTS order_id VARCHAR(50);
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS purchasing_id VARCHAR(50);
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS expected_delivery DATE;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2) DEFAULT 0;

-- ---------------------------------------------------------
-- 7. TABLE: delivery (Delivery Orders / Surat Jalan & Cloud Sync Store)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    project_id VARCHAR(50),
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

ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS project_id VARCHAR(50);

-- ---------------------------------------------------------
-- 8. TABLE: invoices (Customer Billing & Invoices)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    quotation_id VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(100),
    customer_address TEXT,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
    payment_method VARCHAR(100) DEFAULT 'Bank Transfer',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    additional_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    main_items_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    services_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    items_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    warranty_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0,
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

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS quotation_id VARCHAR(50);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(100);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS additional_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS main_items_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS services_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS items_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS warranty_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 2) DEFAULT 0;

-- ---------------------------------------------------------
-- 9. TABLE: bast (Berita Acara Serah Terima)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bast (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    project_id VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    project_name VARCHAR(255),
    bast_date DATE NOT NULL DEFAULT CURRENT_DATE,
    work_summary TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    pdf_url TEXT,
    pdf_filename TEXT,
    uploaded_document JSONB,
    documentation_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    proof_notes TEXT,
    handed_over_date DATE,
    receiver_name VARCHAR(255),
    has_proof BOOLEAN DEFAULT FALSE,
    proof_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 10. TABLE: project_reports (Laporan Pelaksanaan Project)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_reports (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50),
    order_id VARCHAR(50),
    project_name VARCHAR(255),
    customer_name VARCHAR(255),
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reporter_name VARCHAR(255),
    author VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Completed',
    is_service_report BOOLEAN DEFAULT FALSE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    actual_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
    returned_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_docs JSONB NOT NULL DEFAULT '[]'::jsonb,
    overall_description TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 11. TABLE: maintenance (Pemeliharaan Berkala Project)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50),
    order_id VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    project_name VARCHAR(255),
    schedule_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'Scheduled',
    inspection_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    technician_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 12. TABLE: service_tickets (Tiket Perbaikan & Servis Non-Garansi)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_tickets (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50),
    order_id VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    ticket_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issue_description TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'Open',
    repair_cost NUMERIC(15, 2) DEFAULT 0,
    technician_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 13. TABLE: warranty_claims (Klaim Garansi Resmi)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warranty_claims (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50),
    order_id VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    claim_reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Under Review',
    approved_by VARCHAR(255),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 14. TABLE: partnerships (Bagi Hasil Kerjasama Takumi & Ayumi)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partnerships (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    project_id VARCHAR(50),
    invoice_ref VARCHAR(50),
    client_name VARCHAR(255),
    service_name VARCHAR(255),
    date DATE DEFAULT CURRENT_DATE,
    billed_amount NUMERIC(15, 2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'Belum Lunas',
    percentages JSONB DEFAULT '{}'::jsonb,
    contributions JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 15. TABLE: service_expenses (Pengajuan Biaya Transport & Uang Makan Jasa)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_expenses (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    project_id VARCHAR(50),
    customer_name VARCHAR(255),
    service_name VARCHAR(255),
    pic_name VARCHAR(255),
    date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'Pengajuan',
    meal_fee NUMERIC(15, 2) DEFAULT 0,
    transport_fee NUMERIC(15, 2) DEFAULT 0,
    total_expense NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ---------------------------------------------------------
-- 16. TABLE: activity_logs (Log Kegiatan & Agenda Kalender UBM)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    project_name VARCHAR(255),
    task VARCHAR(255) NOT NULL,
    pic VARCHAR(150) NOT NULL,
    category VARCHAR(100) DEFAULT 'Produksi',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time VARCHAR(50),
    end_time VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'Sedang Berjalan',
    report JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Produksi';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS start_time VARCHAR(50);
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS end_time VARCHAR(50);
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Sedang Berjalan';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS report JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS notes TEXT;

-- ---------------------------------------------------------
-- 17. TABLE: project_finances (Keuangan & Profitabilitas Project)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_finances (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50),
    order_id VARCHAR(50),
    quotation_id VARCHAR(50),
    invoice_id VARCHAR(50),
    project_name VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    project_lead VARCHAR(150),
    status VARCHAR(50) DEFAULT 'Planning',
    contract_selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    material_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    labor_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    overhead_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    modal_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    allocated_warranty NUMERIC(15, 2) NOT NULL DEFAULT 0,
    claimed_warranty NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_warranty NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gross_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    profit_margin NUMERIC(6, 2) NOT NULL DEFAULT 0,
    profit_level VARCHAR(50) DEFAULT 'GOOD',
    invoice_status VARCHAR(50) DEFAULT 'Unpaid',
    invoice_grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_custom_cost BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS project_id VARCHAR(50);
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS order_id VARCHAR(50);
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS quotation_id VARCHAR(50);
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50);
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS project_lead VARCHAR(150);
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Planning';
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS contract_selling_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS selling_price NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS material_cost NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS modal_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS allocated_warranty NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS claimed_warranty NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS remaining_warranty NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS net_profit NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(6, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS profit_level VARCHAR(50) DEFAULT 'GOOD';
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50) DEFAULT 'Unpaid';
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS invoice_grand_total NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS total_paid_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS balance_due NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS is_custom_cost BOOLEAN DEFAULT FALSE;
ALTER TABLE public.project_finances ADD COLUMN IF NOT EXISTS notes TEXT;

-- ---------------------------------------------------------
-- 17. TABLE: roles (Master Role & Matriks Hak Akses Pengguna)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(150) NOT NULL,
    badge_color VARCHAR(50) DEFAULT '#475569',
    description TEXT,
    allowed_views JSONB NOT NULL DEFAULT '[]'::jsonb,
    can_approve_order BOOLEAN NOT NULL DEFAULT FALSE,
    can_assign_lead BOOLEAN NOT NULL DEFAULT FALSE,
    can_register_members BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_timeline BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_bom BOOLEAN NOT NULL DEFAULT FALSE,
    can_submit_pr BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve_purchasing BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_invoices BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_finance BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_bast BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_after_sales BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_settings BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.roles (
    id, role_name, label, badge_color, description, allowed_views,
    can_approve_order, can_assign_lead, can_register_members, can_manage_timeline,
    can_manage_bom, can_submit_pr, can_approve_purchasing, can_manage_invoices,
    can_manage_finance, can_manage_bast, can_manage_after_sales, can_manage_settings
) VALUES
(
    'ROLE-ADMIN', 'Administrator', 'Administrator', '#9d174d',
    'Akses penuh seluruh modul sistem, persetujuan, dan manajemen akun pengguna',
    '["dashboard","logs","quotations","orders","projects","bom","bom-form","purchasing","project-reports","timeline","invoices","bast","finance","service","maintenance","settings"]'::jsonb,
    TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
),
(
    'ROLE-KETUA', 'Ketua UBM', 'Ketua UBM', '#1e40af',
    'Pimpinan Unit Bisnis: Persetujuan order/project, penunjukan Lead Project, dan monitoring seluruh operasional',
    '["dashboard","logs","quotations","orders","bom","bom-form","purchasing","project-reports","timeline","invoices","bast","finance","service","maintenance","settings"]'::jsonb,
    TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE
),
(
    'ROLE-KEUANGAN', 'Keuangan', 'Keuangan', '#166534',
    'Persetujuan pembelian barang (PR), penerbitan invoice, keuangan project, BAST & layanan after sales',
    '["dashboard","purchasing","invoices","bast","finance","service","maintenance","logs"]'::jsonb,
    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE
),
(
    'ROLE-MEMBER', 'Member', 'Member', '#475569',
    'Anggota Tim / Pelaksana Project: Akses timeline, progres task, dan apabila ditunjuk sebagai Lead Project berwenang menyusun BOM, mengajukan PR, serta mengisi laporan & anggota tim',
    '["dashboard","orders","bom","bom-form","purchasing","project-reports","timeline","service","maintenance","logs"]'::jsonb,
    FALSE, FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE
)
ON CONFLICT (id) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    label = EXCLUDED.label,
    badge_color = EXCLUDED.badge_color,
    description = EXCLUDED.description,
    allowed_views = EXCLUDED.allowed_views,
    can_approve_order = EXCLUDED.can_approve_order,
    can_assign_lead = EXCLUDED.can_assign_lead,
    can_register_members = EXCLUDED.can_register_members,
    can_manage_timeline = EXCLUDED.can_manage_timeline,
    can_manage_bom = EXCLUDED.can_manage_bom,
    can_submit_pr = EXCLUDED.can_submit_pr,
    can_approve_purchasing = EXCLUDED.can_approve_purchasing,
    can_manage_invoices = EXCLUDED.can_manage_invoices,
    can_manage_finance = EXCLUDED.can_manage_finance,
    can_manage_bast = EXCLUDED.can_manage_bast,
    can_manage_after_sales = EXCLUDED.can_manage_after_sales,
    can_manage_settings = EXCLUDED.can_manage_settings,
    updated_at = timezone('utc'::text, now());

-- ---------------------------------------------------------
-- 18. TABLE: users (Manajemen Akun Pengguna & Hak Akses Role)
-- Berelasi ke public.roles(role_name)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'Member' REFERENCES public.roles(role_name) ON UPDATE CASCADE,
    role_id VARCHAR(50) DEFAULT 'ROLE-MEMBER',
    department VARCHAR(255) DEFAULT 'Operations & Management',
    status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
    avatar VARCHAR(10),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_id VARCHAR(50) DEFAULT 'ROLE-MEMBER';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.users (
    id, name, email, password, role, role_id, department, status, avatar, permissions
) VALUES (
    'USR-001',
    'Super Administrator',
    'admin@ubm.co.id',
    'admin123',
    'Administrator',
    'ROLE-ADMIN',
    'IT & Management',
    'Aktif',
    'A',
    '{"allowedViews":["dashboard","quotations","orders","projects","bom","purchasing","delivery","invoices","bast","project_reports","after_sales","activity_log","settings"],"canApproveOrders":true,"canApprovePurchasing":true,"canApproveBom":true,"canApproveServiceExpenses":true,"canManagePurchasingProcess":true,"canManageInvoices":true,"canManagePartnerships":true,"canManageUsers":true,"canEditCompanySettings":true,"canDeleteRecords":true,"canCreateEditOperational":true,"canPrintDocuments":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------
-- 19. TABLE: settings (Pengaturan Profil Perusahaan & Sistem)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
    company_name VARCHAR(255) NOT NULL,
    company_short_name VARCHAR(100),
    institution_name VARCHAR(255),
    parent_institution VARCHAR(255),
    tagline TEXT,
    phone VARCHAR(100),
    whatsapp VARCHAR(100),
    email VARCHAR(255),
    website VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    leader_name VARCHAR(255),
    leader_nip VARCHAR(100),
    leader_role VARCHAR(255),
    wadir1_name VARCHAR(255),
    wadir1_nip VARCHAR(100),
    wadir1_role VARCHAR(255),
    head_after_sales VARCHAR(255),
    head_finance VARCHAR(255),
    bank_name VARCHAR(100),
    bank_branch VARCHAR(100),
    bank_account VARCHAR(100),
    bank_account_name VARCHAR(255),
    payment_instructions TEXT,
    copyright_text VARCHAR(255),
    partnership_percentages JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.settings (
    id, company_name, company_short_name, institution_name, parent_institution, tagline,
    phone, whatsapp, email, website, address, city,
    leader_name, leader_nip, leader_role, wadir1_name, wadir1_nip, wadir1_role,
    head_after_sales, head_finance, bank_name, bank_branch, bank_account, bank_account_name,
    payment_instructions, copyright_text, partnership_percentages
) VALUES (
    'current',
    'Unit Bisnis & Manufaktur (UBM) Politeknik Takumi',
    'UBM Politeknik Takumi',
    'Politeknik Takumi',
    'Yayasan Pendidikan Takumi',
    'Precision Manufacturing, Automation & Engineering Solutions',
    '(021) 8990-1234',
    '0812-3456-7890',
    'ubm@takumi.ac.id',
    'www.takumi.ac.id',
    'Jl. Kampus Hijau No. 1, Kawasan Industri Jababeka, Cikarang, Bekasi, Jawa Barat 17530',
    'Cikarang',
    'Ir. Hendra Wijaya, M.T.',
    '19820415 201012 1 002',
    'Ketua Unit Bisnis & Manufaktur (UBM)',
    'Dr. Eng. Budi Santoso, S.T., M.Eng.',
    '19790821 200801 1 001',
    'Wakil Direktur I Bidang Akademik & Kemahasiswaan',
    'Rizky Pratama, S.T.',
    'Siti Nurhaliza, S.E., M.Ak.',
    'Bank Mandiri',
    'KCP Cikarang Jababeka',
    '156-00-9876543-2',
    'Yayasan Pendidikan Takumi - UBM',
    'Harap mencantumkan Nomor Invoice pada berita transfer dan mengirimkan bukti transfer ke bagian Keuangan UBM.',
    '© 2025 UBM Politeknik Takumi. All rights reserved.',
    '{"takumi":10,"yayasan":15,"ubm":20,"pelaksana":55}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- RELATIONAL INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_order_id ON public.quotations(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_quotation_id ON public.orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_projects_order_id ON public.projects(order_id);
CREATE INDEX IF NOT EXISTS idx_bom_order_id ON public.bom(order_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_order_id ON public.purchasing(order_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_process_pr_id ON public.purchasing_process(pr_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_process_status ON public.purchasing_process(item_status);
CREATE INDEX IF NOT EXISTS idx_master_items_item_key ON public.master_items(item_key);
CREATE INDEX IF NOT EXISTS idx_po_order_id ON public.po(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_order_id ON public.delivery(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_bast_order_id ON public.bast(order_id);
CREATE INDEX IF NOT EXISTS idx_bast_project_id ON public.bast(project_id);
CREATE INDEX IF NOT EXISTS idx_project_reports_order_id ON public.project_reports(order_id);
CREATE INDEX IF NOT EXISTS idx_project_reports_project_id ON public.project_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_order_id ON public.partnerships(order_id);
CREATE INDEX IF NOT EXISTS idx_service_expenses_order_id ON public.service_expenses(order_id);
CREATE INDEX IF NOT EXISTS idx_project_finances_project_id ON public.project_finances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_finances_order_id ON public.project_finances(order_id);
CREATE INDEX IF NOT EXISTS idx_project_finances_status ON public.project_finances(status);
CREATE INDEX IF NOT EXISTS idx_project_finances_profit_level ON public.project_finances(profit_level);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

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

-- =========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchasing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchasing_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to quotations" ON public.quotations;
CREATE POLICY "Allow all access to quotations" ON public.quotations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to orders" ON public.orders;
CREATE POLICY "Allow all access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to bom" ON public.bom;
CREATE POLICY "Allow all access to bom" ON public.bom FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to purchasing" ON public.purchasing;
CREATE POLICY "Allow all access to purchasing" ON public.purchasing FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to purchasing_process" ON public.purchasing_process;
CREATE POLICY "Allow all access to purchasing_process" ON public.purchasing_process FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to master_items" ON public.master_items;
CREATE POLICY "Allow all access to master_items" ON public.master_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to po" ON public.po;
CREATE POLICY "Allow all access to po" ON public.po FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to delivery" ON public.delivery;
CREATE POLICY "Allow all access to delivery" ON public.delivery FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to invoices" ON public.invoices;
CREATE POLICY "Allow all access to invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to bast" ON public.bast;
CREATE POLICY "Allow all access to bast" ON public.bast FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to project_reports" ON public.project_reports;
CREATE POLICY "Allow all access to project_reports" ON public.project_reports FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to maintenance" ON public.maintenance;
CREATE POLICY "Allow all access to maintenance" ON public.maintenance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to service_tickets" ON public.service_tickets;
CREATE POLICY "Allow all access to service_tickets" ON public.service_tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to warranty_claims" ON public.warranty_claims;
CREATE POLICY "Allow all access to warranty_claims" ON public.warranty_claims FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to partnerships" ON public.partnerships;
CREATE POLICY "Allow all access to partnerships" ON public.partnerships FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to service_expenses" ON public.service_expenses;
CREATE POLICY "Allow all access to service_expenses" ON public.service_expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to activity_logs" ON public.activity_logs;
CREATE POLICY "Allow all access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to project_finances" ON public.project_finances;
CREATE POLICY "Allow all access to project_finances" ON public.project_finances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to roles" ON public.roles;
CREATE POLICY "Allow all access to roles" ON public.roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to users" ON public.users;
CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to settings" ON public.settings;
CREATE POLICY "Allow all access to settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- MIGRATION: DUAL APPROVAL QUOTATIONS (KETUA UBM & DIREKTUR)
-- =========================================================
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS approval_ketua_ubm BOOLEAN DEFAULT FALSE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS approval_ketua_ubm_by TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS approval_ketua_ubm_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS approval_direktur BOOLEAN DEFAULT FALSE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS approval_direktur_by TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS approval_direktur_date TIMESTAMP WITH TIME ZONE;
