const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const { readDB, writeDB, mapToSnakeCase, mapToCamelCase, getCloudSync, setCloudSync, CLOUD_SYNC_PREFIX } = require('../utils/dbHelper');

const UPLOADS_PO_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'po');
const UPLOADS_QUO_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'quotations');
const UPLOADS_BAST_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'bast');

try {
  if (!fs.existsSync(UPLOADS_PO_DIR)) fs.mkdirSync(UPLOADS_PO_DIR, { recursive: true });
} catch (e) {}

try {
  if (!fs.existsSync(UPLOADS_QUO_DIR)) fs.mkdirSync(UPLOADS_QUO_DIR, { recursive: true });
} catch (e) {}

try {
  if (!fs.existsSync(UPLOADS_BAST_DIR)) fs.mkdirSync(UPLOADS_BAST_DIR, { recursive: true });
} catch (e) {}

function processPOFileStorage(item, id) {
  if (!item) return item;
  const processed = { ...item };
  const rawUrl = processed.poDocument?.url || processed.poFileUrl;
  
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.startsWith('data:application/pdf;base64,')) {
    try {
      const base64Data = rawUrl.replace(/^data:application\/pdf;base64,/, '');
      const sanitizedId = (id || 'PO').replace(/[^a-zA-Z0-9-_]/g, '_');
      const filename = `PO_${sanitizedId}_${Date.now()}.pdf`;
      const filePath = path.join(UPLOADS_PO_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      
      const fileUrl = `/uploads/po/${filename}`;
      processed.poFileUrl = fileUrl;
      if (processed.poDocument) {
        processed.poDocument.url = fileUrl;
      } else {
        processed.poDocument = {
          name: processed.poFileName || filename,
          url: fileUrl,
          uploadedAt: new Date().toISOString()
        };
      }
      console.log(`📄 [PO Storage] File PDF tersimpan di disk: ${fileUrl}`);
    } catch (e) {
      // In read-only serverless environment, retain inline data URL
      processed.poFileUrl = rawUrl;
      if (processed.poDocument) {
        processed.poDocument.url = rawUrl;
      }
    }
  }
  return processed;
}

module.exports = function(broadcastReload) {
  // ---------------- AUTOMATIC CLOUD SYNC BOOTSTRAP ----------------
  (async function bootstrapCloudSync() {
    try {
      const db = readDB();

      // 1. Sync Settings
      const cloudSettings = await getCloudSync('settings');
      if (cloudSettings === null || Object.keys(cloudSettings).length === 0) {
        if (db.settings && Object.keys(db.settings).length > 0) {
          await setCloudSync('settings', db.settings);
          console.log('⚡ [Cloud Sync] Pengaturan profil berhasil diunggah ke Supabase Cloud Store');
        }
      } else {
        db.settings = { ...(db.settings || {}), ...cloudSettings };
        writeDB(db);
      }

      // 2. Sync Users
      const cloudUsers = await getCloudSync('users');
      if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        db.users = cloudUsers;
        writeDB(db);
      }

      // 3. Sync Other Resources
      const resourcesToSync = ['quotations', 'projects', 'activity_logs', 'orders', 'po', 'invoices', 'purchasing', 'bom', 'bast', 'project_reports', 'maintenance', 'service_tickets', 'warranty_claims', 'partnerships'];
      for (const resName of resourcesToSync) {
        const cloudData = await getCloudSync(resName);
        if (cloudData === null) {
          const seedData = Array.isArray(db[resName]) ? db[resName] : [];
          await setCloudSync(resName, seedData);
        } else if (Array.isArray(cloudData)) {
          db[resName] = cloudData;
          writeDB(db);
        }
      }
    } catch (err) {
      console.warn('⚠️ [Cloud Sync] Bootstrap notice:', err.message);
    }
  })();

  // ---------------- AUTHENTICATION ENDPOINTS ----------------
  const ADMIN_EMAIL = 'admin@ubm.co.id';
  const ADMIN_PASSWORD = 'bisnisdigital365';

  router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    // Pull latest users from Supabase Cloud Store so newly created users on any device can login immediately
    try {
      const cloudUsers = await getCloudSync('users');
      if (Array.isArray(cloudUsers)) {
        const db = readDB();
        db.users = cloudUsers;
        writeDB(db);
      }
    } catch (e) {}

    const db = readDB();
    const users = db.users || [];
    const matchedUser = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail && u.password === cleanPassword && u.status !== 'Non-Aktif');

    if (matchedUser || (cleanEmail === ADMIN_EMAIL && cleanPassword === ADMIN_PASSWORD)) {
      const u = matchedUser || {
        id: 'usr-admin-ubm',
        email: ADMIN_EMAIL,
        name: 'Administrator UBM',
        role: 'Administrator',
        department: 'Operations & Management',
        avatar: 'AD'
      };
      console.log(`🔐 [Auth] Login berhasil untuk akun: ${u.email} (Role: ${u.role})`);
      return res.json({
        success: true,
        message: 'Login berhasil',
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          department: u.department,
          avatar: u.avatar || u.name?.slice(0, 2).toUpperCase() || 'AD'
        },
        token: `ubm_token_${Date.now()}`
      });
    }

    console.warn(`⚠️ [Auth] Upaya login gagal untuk email: ${cleanEmail || 'kosong'}`);
    return res.status(401).json({
      success: false,
      error: 'Email atau password salah. Silakan coba lagi.'
    });
  });

  router.get('/auth/session', (req, res) => {
    res.json({
      active: true,
      allowedEmail: ADMIN_EMAIL
    });
  });

  // ---------------- SAVE GENERATED QUOTATION PDF ENDPOINT ----------------
  router.post('/quotations/:id/pdf', (req, res) => {
    const { id } = req.params;
    const { pdfBase64, filename } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'pdfBase64 is required' });
    }

    try {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      const safeFilename = filename || `Quotation_${id.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
      let fileUrl = pdfBase64;
      try {
        const filePath = path.join(UPLOADS_QUO_DIR, safeFilename);
        fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
        fileUrl = `/uploads/quotations/${safeFilename}`;
      } catch (writeErr) {
        // Retain inline data URL in serverless / read-only filesystem
      }

      // Update quotation record with pdfUrl
      const db = readDB();
      const quotations = db.quotations || [];
      const idx = quotations.findIndex(q => q.id === id);
      if (idx !== -1) {
        quotations[idx].pdfUrl = fileUrl;
        quotations[idx].pdfFilename = safeFilename;
        writeDB(db);
      }

      console.log(`📄 [Quotation Storage] File PDF berhasil diproses untuk: ${id}`);
      res.json({ success: true, fileUrl, filename: safeFilename });
    } catch (err) {
      console.error('Error saving quotation PDF:', err);
      res.status(500).json({ error: 'Gagal menyimpan file PDF' });
    }
  });

  // ---------------- SAVE GENERATED BAST PDF ENDPOINT ----------------
  router.post('/bast/:id/pdf', (req, res) => {
    const { id } = req.params;
    const { pdfBase64, filename } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'pdfBase64 is required' });
    }

    try {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      const safeFilename = filename || `BAST_${id.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
      let fileUrl = pdfBase64;
      try {
        const filePath = path.join(UPLOADS_BAST_DIR, safeFilename);
        fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
        fileUrl = `/uploads/bast/${safeFilename}`;
      } catch (writeErr) {
        // Retain inline data URL in serverless / read-only filesystem
      }

      const db = readDB();
      const bastList = db.bast || [];
      const idx = bastList.findIndex(b => b.id === id);
      if (idx !== -1) {
        bastList[idx].pdfUrl = fileUrl;
        bastList[idx].pdfFilename = safeFilename;
        writeDB(db);
      }

      console.log(`📄 [BAST Storage] File PDF berhasil diproses untuk: ${id}`);
      res.json({ success: true, fileUrl, filename: safeFilename });
    } catch (err) {
      console.error('Error saving BAST PDF:', err);
      res.status(500).json({ error: 'Gagal menyimpan file PDF BAST' });
    }
  });

  // ---------------- SAVE UPLOADED BAST PROOF & DOCUMENTATION PHOTOS ----------------
  router.post('/bast/:id/proof', (req, res) => {
    const { id } = req.params;
    const { documentBase64, documentFilename, photos, proofNotes, handedOverDate, receiverName } = req.body;

    try {
      const sanitizedId = (id || 'BAST').replace(/[^a-zA-Z0-9-_]/g, '_');
      const db = readDB();
      const bastList = db.bast || [];
      const idx = bastList.findIndex(b => b.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Dokumen BAST tidak ditemukan' });
      }

      const bastItem = { ...bastList[idx] };

      // Save document file (PDF / Scan image)
      if (documentBase64) {
        let ext = '.pdf';
        if (documentBase64.startsWith('data:image/jpeg') || (documentFilename && documentFilename.endsWith('.jpg'))) ext = '.jpg';
        else if (documentBase64.startsWith('data:image/png') || (documentFilename && documentFilename.endsWith('.png'))) ext = '.png';
        else if (documentBase64.startsWith('data:image/webp')) ext = '.webp';
        
        const cleanBase64 = documentBase64.replace(/^data:[^;]+;base64,/, '');
        const filename = documentFilename ? `DOC_${sanitizedId}_${Date.now()}_${documentFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}` : `DOC_BAST_${sanitizedId}_${Date.now()}${ext}`;
        let docUrl = documentBase64;
        try {
          const filePath = path.join(UPLOADS_BAST_DIR, filename);
          fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
          docUrl = `/uploads/bast/${filename}`;
        } catch (writeErr) {
          // Retain inline data URL
        }
        
        bastItem.uploadedDocument = {
          url: docUrl,
          filename: documentFilename || filename,
          uploadedAt: new Date().toISOString()
        };
      }

      // Save documentation photos
      if (Array.isArray(photos)) {
        bastItem.documentationPhotos = [];
        photos.forEach((photo, pIdx) => {
          if (photo.base64) {
            let pExt = '.jpg';
            if (photo.base64.startsWith('data:image/png')) pExt = '.png';
            else if (photo.base64.startsWith('data:image/webp')) pExt = '.webp';

            const cleanPhoto = photo.base64.replace(/^data:[^;]+;base64,/, '');
            const pFilename = `PHOTO_${sanitizedId}_${Date.now()}_${pIdx + 1}${pExt}`;
            let photoUrl = photo.base64;
            try {
              const pPath = path.join(UPLOADS_BAST_DIR, pFilename);
              fs.writeFileSync(pPath, Buffer.from(cleanPhoto, 'base64'));
              photoUrl = `/uploads/bast/${pFilename}`;
            } catch (writeErr) {
              // Retain inline data URL
            }

            bastItem.documentationPhotos.push({
              url: photoUrl,
              name: photo.name || `Foto Dokumentasi ${pIdx + 1}`,
              uploadedAt: new Date().toISOString()
            });
          } else if (photo.url) {
            // Existing photo retained
            bastItem.documentationPhotos.push(photo);
          }
        });
      }

      if (proofNotes !== undefined) bastItem.proofNotes = proofNotes;
      if (handedOverDate !== undefined) bastItem.handedOverDate = handedOverDate;
      if (receiverName !== undefined) bastItem.receiverName = receiverName;
      bastItem.hasProof = true;
      bastItem.proofUpdatedAt = new Date().toISOString();

      bastList[idx] = bastItem;
      writeDB(db);

      console.log(`📸 [BAST Proof] Berhasil upload berkas & dokumentasi serah terima untuk BAST: ${id}`);
      res.json({ success: true, bast: bastItem });
    } catch (err) {
      console.error('Error saving BAST proof:', err);
      res.status(500).json({ error: 'Gagal mengupload berkas BAST' });
    }
  });

  // ---------------- COMPANY SETTINGS / PROFILE ENDPOINT ----------------
  const defaultCompanySettings = {
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

  router.get('/settings', async (req, res) => {
    try {
      let settings = await getCloudSync('settings');
      if (!settings || Object.keys(settings).length === 0) {
        const db = readDB();
        settings = (db.settings && Object.keys(db.settings).length > 0)
          ? { ...defaultCompanySettings, ...db.settings }
          : defaultCompanySettings;
        setCloudSync('settings', settings).catch(() => {});
      } else {
        settings = { ...defaultCompanySettings, ...settings };
      }

      const db = readDB();
      db.settings = settings;
      writeDB(db);

      res.json(settings);
    } catch (err) {
      console.error('Error fetching settings:', err);
      const db = readDB();
      res.json(db.settings || defaultCompanySettings);
    }
  });

  router.put('/settings', async (req, res) => {
    try {
      const db = readDB();
      let currentSettings = db.settings || defaultCompanySettings;
      try {
        const cloudSettings = await getCloudSync('settings');
        if (cloudSettings && Object.keys(cloudSettings).length > 0) {
          currentSettings = { ...currentSettings, ...cloudSettings };
        }
      } catch (e) {}

      const updatedSettings = {
        ...defaultCompanySettings,
        ...currentSettings,
        ...req.body,
        updatedAt: new Date().toISOString()
      };
      db.settings = updatedSettings;
      writeDB(db);

      await setCloudSync('settings', updatedSettings);

      console.log('⚙️ [Settings] Pengaturan profil perusahaan berhasil diperbarui di Supabase Cloud Store');
      broadcastReload({ type: 'reload', resource: 'settings' });
      res.json(updatedSettings);
    } catch (err) {
      console.error('Error updating settings:', err);
      res.status(500).json({ error: 'Gagal menyimpan pengaturan' });
    }
  });

  // ---------------- DASHBOARD KPI & STATS ENDPOINT ----------------
  router.get('/stats', async (req, res) => {
    try {
      const db = readDB();
      const fetchList = async (resName) => {
        try {
          const c = await getCloudSync(resName);
          if (Array.isArray(c)) return c;
        } catch (e) {}
        return Array.isArray(db[resName]) ? db[resName] : [];
      };

      const [orders, po, invoices, purchasing, bom, delivery, projects, quotations] = await Promise.all([
        fetchList('orders'),
        fetchList('po'),
        fetchList('invoices'),
        fetchList('purchasing'),
        fetchList('bom'),
        fetchList('delivery'),
        fetchList('projects'),
        fetchList('quotations')
      ]);

      const totalQuotations = quotations.length;
      const totalQuotationValue = quotations.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);
      const activeQuotations = quotations.filter(q => q.status === 'Sent' || q.status === 'Draft' || q.status === 'Pengajuan').length;

      const totalOrders = orders.length;
      const totalOrderValue = orders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
      
      const totalPO = po.length;
      const totalPOValue = po.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter(i => i.status === 'Paid').length;
      const unpaidInvoicesValue = invoices
        .filter(i => i.status !== 'Paid')
        .reduce((sum, i) => sum + (Number(i.grandTotal) - (Number(i.paidAmount) || 0)), 0);

      const totalPurchasing = purchasing.length;
      const pendingPurchasing = purchasing.filter(p => p.status === 'Pending' || p.status === 'In Review').length;

      const totalBOM = bom.length;
      const totalDeliveries = delivery.length;
      const activeDeliveries = delivery.filter(d => d.status !== 'Delivered / Received').length;

      // Recent activities feed
      const recentActivities = [
        ...quotations.slice(-2).map(q => ({
          type: 'Quotation',
          title: `Penawaran #${q.id} - ${q.customerName}`,
          date: q.quotationDate || q.createdAt?.split('T')[0],
          amount: q.grandTotal,
          status: q.status
        })),
        ...orders.slice(-3).map(o => ({
          type: 'Order',
          title: `Pesanan Baru #${o.id} - ${o.customerName}`,
          date: o.orderDate,
          amount: o.grandTotal,
          status: o.status
        })),
        ...po.slice(-2).map(p => ({
          type: 'PO',
          title: `PO Vendor #${p.id} - ${p.vendorName}`,
          date: p.poDate,
          amount: p.totalAmount,
          status: p.status
        })),
        ...purchasing.slice(-2).map(pr => ({
          type: 'Purchasing',
          title: `Request Pengadaan #${pr.id} - ${pr.department || 'Umum'}`,
          date: pr.requestDate,
          amount: pr.totalEstimated,
          status: pr.status
        })),
        ...invoices.slice(-2).map(i => ({
          type: 'Invoice',
          title: `Faktur #${i.id} - ${i.customerName}`,
          date: i.invoiceDate,
          amount: i.grandTotal,
          status: i.status
        })),
        ...delivery.slice(-2).map(d => ({
          type: 'Delivery',
          title: `Pengiriman #${d.id} ke ${d.customerName}`,
          date: d.deliveryDate,
          status: d.status
        }))
      ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);

      res.json({
        summary: {
          totalQuotations,
          totalQuotationValue,
          activeQuotations,
          totalOrders,
          totalOrderValue,
          totalPO,
          totalPOValue,
          totalInvoices,
          paidInvoices,
          unpaidInvoicesValue,
          totalPurchasing,
          pendingPurchasing,
          totalBOM,
          totalDeliveries,
          activeDeliveries,
          totalProjects: projects.length
        },
        recentActivities
      });
    } catch (err) {
      console.error('Error generating stats:', err);
      res.status(500).json({ error: 'Failed to compute stats' });
    }
  });

  const missingSupabaseTables = new Set();

  // ---------------- GENERIC CRUD HELPER FUNCTION WITH CLOUD SYNC ----------------
  function registerCrudRoutes(resourceName, idPrefix) {
    // GET ALL
    router.get(`/${resourceName}`, async (req, res) => {
      const db = readDB();
      const localItems = Array.isArray(db[resourceName]) ? db[resourceName] : [];

      try {
        // Special case: delivery table holds Cloud Store rows; filter out system rows
        if (resourceName === 'delivery' && supabase) {
          const { data, error } = await supabase
            .from('delivery')
            .select('*')
            .not('id', 'like', `${CLOUD_SYNC_PREFIX}%`)
            .order('created_at', { ascending: false });

          if (!error && data) {
            const cleanDeliveries = mapToCamelCase(data);
            const cleanLocal = localItems.filter(l => l.id && !l.id.startsWith(CLOUD_SYNC_PREFIX));
            const remoteIds = new Set(cleanDeliveries.map(r => r.id));
            const extraLocal = cleanLocal.filter(l => !remoteIds.has(l.id));
            const merged = [...cleanDeliveries, ...extraLocal];
            db.delivery = merged;
            writeDB(db);
            return res.json(merged);
          }
        }

        // Check native Supabase table if not known to be missing
        if (supabase && !missingSupabaseTables.has(resourceName) && resourceName !== 'users') {
          const { data, error } = await supabase
            .from(resourceName)
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            const remoteCamel = mapToCamelCase(data);

            // Fetch cloud store items to retain any JSON or extended fields not present in SQL columns
            let cloudItems = [];
            try {
              const cData = await getCloudSync(resourceName);
              if (Array.isArray(cData)) cloudItems = cData;
            } catch (e) {}

            const remoteIds = new Set(remoteCamel.map(r => r.id));
            const merged = remoteCamel.map(remoteItem => {
              const localMatch = localItems.find(l => l.id === remoteItem.id) || {};
              const cloudMatch = cloudItems.find(c => c.id === remoteItem.id) || {};
              return {
                ...localMatch,
                ...cloudMatch,
                ...remoteItem,
                // Ensure critical rich fields (e.g. poDocument, poFileUrl, poFileName) are NEVER wiped out by missing SQL columns
                poDocument: remoteItem.poDocument || cloudMatch.poDocument || localMatch.poDocument || undefined,
                poFileUrl: remoteItem.poFileUrl || cloudMatch.poFileUrl || localMatch.poFileUrl || undefined,
                poFileName: remoteItem.poFileName || cloudMatch.poFileName || localMatch.poFileName || undefined,
                items: (remoteItem.items && remoteItem.items.length > 0) ? remoteItem.items : (cloudMatch.items || localMatch.items || []),
                additionalServices: remoteItem.additionalServices || cloudMatch.additionalServices || localMatch.additionalServices || []
              };
            });

            const extraCloud = cloudItems.filter(c => c.id && !remoteIds.has(c.id));
            const extraLocal = localItems.filter(l => l.id && l.id !== 'undefined' && !remoteIds.has(l.id) && !cloudItems.some(c => c.id === l.id));
            const fullMerged = [...merged, ...extraCloud, ...extraLocal];
            db[resourceName] = fullMerged;
            writeDB(db);
            return res.json(fullMerged);
          } else if (error) {
            if (error.code === 'PGRST205' || error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
              missingSupabaseTables.add(resourceName);
            }
          }
        }
      } catch (err) {
        console.warn(`[Supabase] GET /api/${resourceName} native check notice:`, err.message);
      }

      // Fallback: Fetch from Supabase Cloud Store for all devices synchronization
      try {
        const cloudData = await getCloudSync(resourceName);
        if (Array.isArray(cloudData)) {
          db[resourceName] = cloudData;
          writeDB(db);
          return res.json(cloudData);
        }
      } catch (syncErr) {
        console.warn(`[Cloud Sync] Fallback GET /api/${resourceName}:`, syncErr.message);
      }

      const cleanResult = resourceName === 'delivery'
        ? localItems.filter(l => l.id && !l.id.startsWith(CLOUD_SYNC_PREFIX))
        : localItems;

      res.json(cleanResult);
    });

    // GET SINGLE
    router.get(`/${resourceName}/:id`, async (req, res) => {
      const db = readDB();
      const localItem = (db[resourceName] || []).find(i => i.id === req.params.id);

      try {
        if (supabase && !missingSupabaseTables.has(resourceName)) {
          const { data, error } = await supabase
            .from(resourceName)
            .select('*')
            .eq('id', req.params.id)
            .single();

          if (!error && data) {
            const remoteCamel = mapToCamelCase(data);
            let cloudMatch = null;
            try {
              const cloudItems = await getCloudSync(resourceName);
              if (Array.isArray(cloudItems)) cloudMatch = cloudItems.find(c => c.id === req.params.id);
            } catch (e) {}
            return res.json({
              ...localItem,
              ...cloudMatch,
              ...remoteCamel,
              poDocument: remoteCamel.poDocument || cloudMatch?.poDocument || localItem?.poDocument || undefined,
              poFileUrl: remoteCamel.poFileUrl || cloudMatch?.poFileUrl || localItem?.poFileUrl || undefined,
              poFileName: remoteCamel.poFileName || cloudMatch?.poFileName || localItem?.poFileName || undefined
            });
          }
        }
      } catch (err) {}

      if (!localItem) return res.status(404).json({ error: `${resourceName} not found` });
      res.json(localItem);
    });

    // POST (CREATE)
    router.post(`/${resourceName}`, async (req, res) => {
      const db = readDB();
      let items = Array.isArray(db[resourceName]) ? db[resourceName] : [];

      // Always retrieve latest list from Supabase Cloud Store to prevent race conditions & multi-device overwrites
      try {
        const cloudData = await getCloudSync(resourceName);
        if (Array.isArray(cloudData)) {
          items = cloudData;
        }
      } catch (e) {}

      const newId = req.body.id || `${idPrefix}-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
      
      let newItem = {
        id: newId,
        ...req.body,
        createdAt: req.body.createdAt || new Date().toISOString()
      };

      // Process and save any Base64 PDF to disk
      if (resourceName === 'orders') {
        newItem = processPOFileStorage(newItem, newId);

        // Auto-update linked Quotation to 'Accepted' if this order is created from a Quotation
        const quoId = newItem.quotationId || (newItem.notes && (newItem.notes.match(/QUO-[\w-]+/i) || [])[0]);
        if (quoId) {
          try {
            const quotations = db.quotations || [];
            const qIdx = quotations.findIndex(q => q.id === quoId);
            if (qIdx !== -1) {
              const quoStatus = newItem.status === 'Accepted' ? 'Accepted' : 'Pengajuan';
              quotations[qIdx].status = quoStatus;
              quotations[qIdx].updatedAt = new Date().toISOString();
              db.quotations = quotations;
              writeDB(db);
              setCloudSync('quotations', quotations).catch(() => {});
              broadcastReload({ type: 'reload', resource: 'quotations' });
            }
          } catch (e) {
            console.error('Error auto-updating quotation status in backend:', e);
          }
        }
      }

      // Try inserting into native Supabase table if available
      try {
        if (supabase && !missingSupabaseTables.has(resourceName) && resourceName !== 'users') {
          let snakeItem = mapToSnakeCase(newItem);
          let cleanSnake = { ...snakeItem };

          for (let attempt = 0; attempt < 8; attempt++) {
            const res = await supabase.from(resourceName).insert([cleanSnake]).select();
            if (!res.error) break;

            if (res.error.code === 'PGRST205' || res.error.message.includes('Could not find the table')) {
              missingSupabaseTables.add(resourceName);
              break;
            }

            if (res.error && (res.error.code === 'PGRST204' || res.error.message.includes('column') || res.error.message.includes('schema'))) {
              const missingCol = (res.error.message.match(/'([^']+)' column/) || res.error.message.match(/column "([^"]+)"/) || res.error.message.match(/column '([^']+)'/))?.[1];
              if (missingCol && cleanSnake.hasOwnProperty(missingCol)) {
                delete cleanSnake[missingCol];
                continue;
              }
            }
            break;
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Insert notice in ${resourceName}:`, err.message);
      }

      // Add to local DB cache
      const existingIdx = items.findIndex(i => i.id === newItem.id);
      if (existingIdx !== -1) {
        items[existingIdx] = newItem;
      } else {
        items.unshift(newItem);
      }
      db[resourceName] = items;
      writeDB(db);

      // Persist to Supabase Cloud Store so all devices see the new item immediately
      await setCloudSync(resourceName, items);

      broadcastReload({ type: 'reload', resource: resourceName });
      res.status(201).json(newItem);
    });

    // PUT (UPDATE)
    router.put(`/${resourceName}/:id`, async (req, res) => {
      if (!req.params.id || req.params.id === 'undefined' || req.params.id === 'null') {
        return res.status(400).json({ error: 'ID tidak valid' });
      }

      // Reject direct edits on quotations that are already converted to sales orders
      if (resourceName === 'quotations') {
        const db = readDB();
        const orders = db.orders || [];
        const linkedOrder = orders.find(o => o.quotationId === req.params.id || (o.notes && o.notes.includes(req.params.id)));
        if (linkedOrder) {
          const currentQuo = (db.quotations || []).find(q => q.id === req.params.id);
          const contentKeys = ['items', 'customerName', 'projectName', 'customerPhone', 'customerEmail', 'customerAddress', 'subtotal', 'grandTotal', 'discount', 'warranty', 'leadTime'];
          const isContentEdit = currentQuo && contentKeys.some(k => {
            if (req.body[k] === undefined) return false;
            return JSON.stringify(req.body[k]) !== JSON.stringify(currentQuo[k]);
          });
          if (isContentEdit) {
            return res.status(403).json({
              error: `Surat Penawaran #${req.params.id} sudah dikonversikan ke Order Penjualan #${linkedOrder.id} dan datanya tidak dapat diedit lagi.`
            });
          }
        }
      }

      let updateData = {
        ...req.body,
        updatedAt: new Date().toISOString()
      };

      if (resourceName === 'orders') {
        updateData = processPOFileStorage(updateData, req.params.id);
      }

      // Update native Supabase table if available
      try {
        if (supabase && !missingSupabaseTables.has(resourceName) && resourceName !== 'users') {
          let snakeItem = mapToSnakeCase(updateData);
          let cleanSnake = { ...snakeItem };

          for (let attempt = 0; attempt < 8; attempt++) {
            const res = await supabase
              .from(resourceName)
              .update(cleanSnake)
              .eq('id', req.params.id)
              .select();

            if (!res.error) break;

            if (res.error.code === 'PGRST205' || res.error.message.includes('Could not find the table')) {
              missingSupabaseTables.add(resourceName);
              break;
            }

            if (res.error && (res.error.code === 'PGRST204' || res.error.message.includes('column') || res.error.message.includes('schema'))) {
              const missingCol = (res.error.message.match(/'([^']+)' column/) || res.error.message.match(/column "([^"]+)"/) || res.error.message.match(/column '([^']+)'/))?.[1];
              if (missingCol && cleanSnake.hasOwnProperty(missingCol)) {
                delete cleanSnake[missingCol];
                continue;
              }
            }
            break;
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Update notice in ${resourceName}:`, err.message);
      }

      const db = readDB();
      let items = Array.isArray(db[resourceName]) ? db[resourceName] : [];
      try {
        const cloudData = await getCloudSync(resourceName);
        if (Array.isArray(cloudData)) {
          items = cloudData;
        }
      } catch (e) {}

      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) {
        items.push({ id: req.params.id, ...updateData });
      } else {
        items[idx] = { ...items[idx], ...updateData, id: req.params.id };
      }
      db[resourceName] = items;
      writeDB(db);

      // Persist to Supabase Cloud Store for multi-device sync
      await setCloudSync(resourceName, items);

      broadcastReload({ type: 'reload', resource: resourceName });
      res.json(items[idx === -1 ? items.length - 1 : idx]);
    });

    // DELETE
    router.delete(`/${resourceName}/:id`, async (req, res) => {
      try {
        if (supabase && !missingSupabaseTables.has(resourceName) && resourceName !== 'users') {
          await supabase
            .from(resourceName)
            .delete()
            .eq('id', req.params.id);
        }
      } catch (err) {
        console.warn(`[Supabase] Delete notice in ${resourceName}:`, err.message);
      }

      const db = readDB();
      let items = (Array.isArray(db[resourceName]) ? db[resourceName] : []);
      try {
        const cloudData = await getCloudSync(resourceName);
        if (Array.isArray(cloudData)) {
          items = cloudData;
        }
      } catch (e) {}

      items = items.filter(i => i.id !== req.params.id);
      db[resourceName] = items;
      writeDB(db);

      // Persist deletion to Supabase Cloud Store for multi-device sync
      await setCloudSync(resourceName, items);

      broadcastReload({ type: 'reload', resource: resourceName });
      res.json({ message: 'Deleted successfully', id: req.params.id });
    });
  }

  // Register CRUD for all 8 resources
  registerCrudRoutes('quotations', 'QUO');
  registerCrudRoutes('orders', 'ORD');
  registerCrudRoutes('po', 'PO');
  registerCrudRoutes('invoices', 'INV');
  registerCrudRoutes('purchasing', 'PR');
  registerCrudRoutes('bom', 'BOM');
  registerCrudRoutes('delivery', 'DO');
  registerCrudRoutes('projects', 'PRJ');
  registerCrudRoutes('bast', 'BAST');
  registerCrudRoutes('project_reports', 'REP');
  registerCrudRoutes('maintenance', 'MNT');
  registerCrudRoutes('service_tickets', 'SRV');
  registerCrudRoutes('warranty_claims', 'CLM');
  registerCrudRoutes('activity_logs', 'LOG');
  registerCrudRoutes('partnerships', 'KSM');
  // ---------------- DEDICATED DIRECT SUPABASE USERS MANAGEMENT ----------------
  const USERS_SYNC_KEY = '__SYS_SYNC_users__';

  async function fetchSupabaseUsers() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('delivery')
          .select('items')
          .eq('id', USERS_SYNC_KEY)
          .single();
        if (!error && data && Array.isArray(data.items)) {
          const db = readDB();
          db.users = data.items;
          writeDB(db);
          return data.items;
        }
      } catch (err) {
        console.warn('⚠️ [Users Supabase] Read notice:', err.message);
      }
    }
    const db = readDB();
    return Array.isArray(db.users) ? db.users : [];
  }

  async function saveSupabaseUsers(usersList) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('delivery')
          .upsert({
            id: USERS_SYNC_KEY,
            customer_name: '__UBM_SYS_STORE__',
            items: usersList,
            notes: 'Direct cloud synchronization for users',
            updated_at: new Date().toISOString()
          });
        if (error) {
          console.error('❌ [Users Supabase] Upsert error:', error.message);
        } else {
          console.log(`⚡ [Users Supabase] ${usersList.length} akun pengguna berhasil disimpan langsung ke Supabase`);
        }
      } catch (err) {
        console.error('❌ [Users Supabase] Exception on upsert:', err.message);
      }
    }
    const db = readDB();
    db.users = usersList;
    writeDB(db);
  }

  // 1. GET ALL USERS (Direct Supabase)
  router.get('/users', async (req, res) => {
    try {
      const users = await fetchSupabaseUsers();
      res.json(users);
    } catch (err) {
      const db = readDB();
      res.json(db.users || []);
    }
  });

  // 2. GET SINGLE USER
  router.get('/users/:id', async (req, res) => {
    try {
      const users = await fetchSupabaseUsers();
      const user = users.find(u => u.id === req.params.id);
      if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Gagal mengambil data pengguna' });
    }
  });

  // 3. CREATE USER DIRECTLY TO SUPABASE
  router.post('/users', async (req, res) => {
    try {
      const { name, email, password, role, department, status, avatar } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!name || !cleanEmail || !password) {
        return res.status(400).json({ error: 'Nama, Email, dan Password wajib diisi' });
      }

      const users = await fetchSupabaseUsers();
      const duplicate = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
      if (duplicate) {
        return res.status(400).json({ error: `Email ${cleanEmail} sudah terdaftar untuk pengguna lain` });
      }

      const newId = req.body.id || `USR-2026-${String(Math.floor(Math.random() * 900 + 100))}`;
      const newUser = {
        id: newId,
        name: (name || '').trim(),
        email: cleanEmail,
        password: (password || '').trim(),
        role: role || 'Member',
        department: department || 'Operations & Management',
        status: status || 'Aktif',
        avatar: avatar || (name ? name.slice(0, 2).toUpperCase() : 'US'),
        createdAt: req.body.createdAt || new Date().toISOString()
      };

      users.unshift(newUser);
      await saveSupabaseUsers(users);
      broadcastReload({ type: 'reload', resource: 'users' });
      console.log(`✅ [Users API] Akun baru ${newUser.email} (${newUser.role}) berhasil disimpan langsung ke Supabase`);
      res.status(201).json(newUser);
    } catch (err) {
      console.error('❌ [Users API] Gagal membuat akun:', err);
      res.status(500).json({ error: 'Gagal menyimpan akun ke database' });
    }
  });

  // 4. UPDATE USER DIRECTLY IN SUPABASE
  router.put('/users/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const users = await fetchSupabaseUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      const existing = users[idx];
      const updated = {
        ...existing,
        ...req.body,
        id: userId,
        updatedAt: new Date().toISOString()
      };

      users[idx] = updated;
      await saveSupabaseUsers(users);
      broadcastReload({ type: 'reload', resource: 'users' });
      console.log(`✅ [Users API] Akun ${updated.email} (${userId}) berhasil diperbarui langsung di Supabase`);
      res.json(updated);
    } catch (err) {
      console.error('❌ [Users API] Gagal update akun:', err);
      res.status(500).json({ error: 'Gagal memperbarui akun di database' });
    }
  });

  // 5. DELETE USER DIRECTLY IN SUPABASE
  router.delete('/users/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const users = await fetchSupabaseUsers();
      const userToDelete = users.find(u => u.id === userId);
      if (!userToDelete) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      if ((userToDelete.email || '').toLowerCase() === 'admin@ubm.co.id') {
        return res.status(403).json({ error: 'Akun Super Administrator Utama tidak dapat dihapus demi keamanan sistem' });
      }

      const filtered = users.filter(u => u.id !== userId);
      await saveSupabaseUsers(filtered);
      broadcastReload({ type: 'reload', resource: 'users' });
      console.log(`🗑️ [Users API] Akun ${userToDelete.email} (${userId}) berhasil dihapus langsung dari Supabase`);
      res.json({ message: 'Deleted successfully', id: userId });
    } catch (err) {
      console.error('❌ [Users API] Gagal menghapus akun:', err);
      res.status(500).json({ error: 'Gagal menghapus akun dari database' });
    }
  });

  // Clear all projects and finance data
  router.delete('/finance/clear-all', async (req, res) => {
    const db = readDB();
    db.projects = [];
    db.project_reports = [];
    writeDB(db);
    try {
      if (supabase && !missingSupabaseTables.has('projects')) {
        await supabase.from('projects').delete().neq('id', '___non_existent___');
      }
      if (supabase && !missingSupabaseTables.has('project_reports')) {
        await supabase.from('project_reports').delete().neq('id', '___non_existent___');
      }
    } catch (e) {}
    broadcastReload({ type: 'reload', resource: 'projects' });
    broadcastReload({ type: 'reload', resource: 'project_reports' });
    res.json({ success: true, message: 'Semua data keuangan project dan project berhasil dihapus' });
  });

  return router;
};
