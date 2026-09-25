const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const { readDB, writeDB, mapToSnakeCase, mapToCamelCase } = require('../utils/dbHelper');

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
  // ---------------- AUTHENTICATION ENDPOINTS ----------------
  const ADMIN_EMAIL = 'admin@ubm.co.id';
  const ADMIN_PASSWORD = 'bisnisdigital365';

  router.post('/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (cleanEmail === ADMIN_EMAIL && cleanPassword === ADMIN_PASSWORD) {
      const user = {
        id: 'usr-admin-ubm',
        email: ADMIN_EMAIL,
        name: 'Administrator UBM',
        role: 'Super Administrator',
        department: 'Operations & Management',
        avatar: 'AD'
      };
      console.log(`🔐 [Auth] Login berhasil untuk akun: ${ADMIN_EMAIL}`);
      return res.json({
        success: true,
        message: 'Login berhasil',
        user,
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
  router.get('/settings', (req, res) => {
    try {
      const db = readDB();
      const defaultSettings = {
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

      const settings = db.settings ? { ...defaultSettings, ...db.settings } : defaultSettings;
      res.json(settings);
    } catch (err) {
      console.error('Error fetching settings:', err);
      res.status(500).json({ error: 'Gagal memuat pengaturan sistem' });
    }
  });

  router.put('/settings', (req, res) => {
    try {
      const db = readDB();
      const updatedSettings = {
        ...(db.settings || {}),
        ...req.body,
        updatedAt: new Date().toISOString()
      };
      db.settings = updatedSettings;
      writeDB(db);

      console.log('⚙️ [Settings] Pengaturan profil perusahaan berhasil diperbarui');
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

      const orders = db.orders || [];
      const po = db.po || [];
      const invoices = db.invoices || [];
      const purchasing = db.purchasing || [];
      const bom = db.bom || [];
      const delivery = db.delivery || [];
      const projects = db.projects || [];
      const quotations = db.quotations || [];

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

  // ---------------- GENERIC CRUD HELPER FUNCTION ----------------
  function registerCrudRoutes(resourceName, idPrefix) {
    // GET ALL
    router.get(`/${resourceName}`, async (req, res) => {
      const db = readDB();
      const localItems = db[resourceName] || [];

      try {
        if (supabase) {
          const { data, error } = await supabase
            .from(resourceName)
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            const remoteCamel = mapToCamelCase(data);
            // Merge with local DB to ensure custom fields (like poDocument, poFileUrl, isLeadLocked, quotationId) are never lost
            const merged = remoteCamel.map(remoteItem => {
              const local = localItems.find(l => l.id === remoteItem.id);
              return {
                ...local,
                ...remoteItem,
                quotationId: remoteItem.quotationId || local?.quotationId || '',
                poDocument: remoteItem.poDocument || local?.poDocument || null,
                poFileUrl: remoteItem.poFileUrl || local?.poFileUrl || local?.poDocument?.url || '',
                poFileName: remoteItem.poFileName || local?.poFileName || local?.poDocument?.name || '',
                isLeadLocked: remoteItem.isLeadLocked !== undefined ? remoteItem.isLeadLocked : local?.isLeadLocked
              };
            });
            const remoteIds = new Set(remoteCamel.map(r => r.id));
            const extraLocal = localItems.filter(l => l.id && l.id !== 'undefined' && !remoteIds.has(l.id));
            return res.json([...merged, ...extraLocal]);
          } else if (error) {
            console.warn(`[Supabase] GET /api/${resourceName} notice:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Fallback GET /api/${resourceName}:`, err.message);
      }

      res.json(localItems);
    });

    // GET SINGLE
    router.get(`/${resourceName}/:id`, async (req, res) => {
      const db = readDB();
      const localItem = (db[resourceName] || []).find(i => i.id === req.params.id);

      try {
        if (supabase) {
          const { data, error } = await supabase
            .from(resourceName)
            .select('*')
            .eq('id', req.params.id)
            .single();

          if (!error && data) {
            const remoteCamel = mapToCamelCase(data);
            return res.json({
              ...localItem,
              ...remoteCamel,
              quotationId: remoteCamel.quotationId || localItem?.quotationId || '',
              poDocument: remoteCamel.poDocument || localItem?.poDocument || null,
              poFileUrl: remoteCamel.poFileUrl || localItem?.poFileUrl || '',
              poFileName: remoteCamel.poFileName || localItem?.poFileName || ''
            });
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Fallback GET single in ${resourceName}:`, err.message);
      }

      if (!localItem) return res.status(404).json({ error: `${resourceName} not found` });
      res.json(localItem);
    });

    // POST (CREATE)
    router.post(`/${resourceName}`, async (req, res) => {
      const db = readDB();
      const items = db[resourceName] || [];
      const newId = req.body.id || `${idPrefix}-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
      
      let newItem = {
        id: newId,
        ...req.body,
        createdAt: new Date().toISOString()
      };

      // Process and save any Base64 PDF to disk for fast, lightweight storage
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
              if (supabase) {
                supabase.from('quotations').update({ status: quoStatus }).eq('id', quoId).then(() => {}).catch(() => {});
              }
              broadcastReload({ type: 'reload', resource: 'quotations' });
            }
          } catch (e) {
            console.error('Error auto-updating quotation status in backend:', e);
          }
        }
      }

      try {
        if (supabase) {
          let snakeItem = mapToSnakeCase(newItem);
          if (resourceName === 'orders') {
            delete snakeItem.quotation_id;
            delete snakeItem.po_document;
            delete snakeItem.po_file_url;
            delete snakeItem.po_file_name;
          }

          let data = null;
          let error = null;
          let cleanSnake = { ...snakeItem };

          for (let attempt = 0; attempt < 10; attempt++) {
            const res = await supabase.from(resourceName).insert([cleanSnake]).select();
            data = res.data;
            error = res.error;

            if (!error) break;

            if (error && (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('schema'))) {
              const missingCol = (error.message.match(/'([^']+)' column/) || error.message.match(/column "([^"]+)"/) || error.message.match(/column '([^']+)'/))?.[1];
              if (missingCol && cleanSnake.hasOwnProperty(missingCol)) {
                delete cleanSnake[missingCol];
                continue;
              }
            }
            break;
          }

          if (!error && data && data.length > 0) {
            items.unshift(newItem);
            db[resourceName] = items;
            writeDB(db);
            broadcastReload({ type: 'reload', resource: resourceName });
            return res.status(201).json({ ...newItem, ...mapToCamelCase(data[0]) });
          } else if (error) {
            console.warn(`[Supabase] Insert notice in ${resourceName}:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Insert exception in ${resourceName}:`, err.message);
      }

      items.unshift(newItem);
      db[resourceName] = items;
      writeDB(db);

      broadcastReload({ type: 'reload', resource: resourceName });
      res.status(201).json(newItem);
    });

    // PUT (UPDATE)
    router.put(`/${resourceName}/:id`, async (req, res) => {
      if (!req.params.id || req.params.id === 'undefined' || req.params.id === 'null') {
        return res.status(400).json({ error: 'ID tidak valid' });
      }

      // Reject direct edits on quotations that are already converted to sales orders (unless it's just status update)
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

      // Process and save any Base64 PDF to disk for fast, lightweight storage
      if (resourceName === 'orders') {
        updateData = processPOFileStorage(updateData, req.params.id);

        // Auto-update linked Quotation to 'Accepted' if order has quotation reference
        const quoId = updateData.quotationId || (updateData.notes && (updateData.notes.match(/QUO-[\w-]+/i) || [])[0]);
        if (quoId) {
          try {
            const db = readDB();
            const quotations = db.quotations || [];
            const qIdx = quotations.findIndex(q => q.id === quoId);
            if (qIdx !== -1 && quotations[qIdx].status !== 'Accepted') {
              quotations[qIdx].status = 'Accepted';
              quotations[qIdx].updatedAt = new Date().toISOString();
              db.quotations = quotations;
              writeDB(db);
              if (supabase) {
                supabase.from('quotations').update({ status: 'Accepted' }).eq('id', quoId).then(() => {}).catch(() => {});
              }
              broadcastReload({ type: 'reload', resource: 'quotations' });
            }
          } catch (e) {
            console.error('Error auto-updating quotation in PUT order:', e);
          }
        }
      }

      try {
        if (supabase) {
          let snakeItem = mapToSnakeCase(updateData);
          if (resourceName === 'orders') {
            delete snakeItem.quotation_id;
            delete snakeItem.po_document;
            delete snakeItem.po_file_url;
            delete snakeItem.po_file_name;
          }

          let data = null;
          let error = null;
          let cleanSnake = { ...snakeItem };

          for (let attempt = 0; attempt < 10; attempt++) {
            const res = await supabase
              .from(resourceName)
              .update(cleanSnake)
              .eq('id', req.params.id)
              .select();
            data = res.data;
            error = res.error;

            if (!error) break;

            if (error && (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('schema'))) {
              const missingCol = (error.message.match(/'([^']+)' column/) || error.message.match(/column "([^"]+)"/) || error.message.match(/column '([^']+)'/))?.[1];
              if (missingCol && cleanSnake.hasOwnProperty(missingCol)) {
                delete cleanSnake[missingCol];
                continue;
              }
            }
            break;
          }

          if (!error && data && data.length > 0) {
            const db = readDB();
            const items = db[resourceName] || [];
            const idx = items.findIndex(i => i.id === req.params.id);
            if (idx !== -1) {
              items[idx] = { ...items[idx], ...updateData, id: req.params.id };
            } else {
              items.push({ id: req.params.id, ...updateData });
            }
            db[resourceName] = items;
            writeDB(db);

            broadcastReload({ type: 'reload', resource: resourceName });
            return res.json({ ...updateData, ...mapToCamelCase(data[0]) });
          } else if (error) {
            console.warn(`[Supabase] Update notice in ${resourceName}:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Update exception in ${resourceName}:`, err.message);
      }

      const db = readDB();
      const items = db[resourceName] || [];
      const idx = items.findIndex(i => i.id === req.params.id);
      if (idx === -1) {
        items.push({ id: req.params.id, ...updateData });
      } else {
        items[idx] = { ...items[idx], ...updateData, id: req.params.id };
      }
      db[resourceName] = items;
      writeDB(db);

      broadcastReload({ type: 'reload', resource: resourceName });
      res.json(items[idx === -1 ? items.length - 1 : idx]);
    });

    // DELETE
    router.delete(`/${resourceName}/:id`, async (req, res) => {
      try {
        if (supabase) {
          const { error } = await supabase
            .from(resourceName)
            .delete()
            .eq('id', req.params.id);

          if (!error) {
            const db = readDB();
            const items = db[resourceName] || [];
            db[resourceName] = items.filter(i => i.id !== req.params.id);
            writeDB(db);
            broadcastReload({ type: 'reload', resource: resourceName });
            return res.json({ message: 'Deleted successfully from Supabase', id: req.params.id });
          } else {
            console.error(`[Supabase] Delete error in ${resourceName}:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`[Supabase] Delete exception in ${resourceName}:`, err.message);
      }

      const db = readDB();
      const items = db[resourceName] || [];
      db[resourceName] = items.filter(i => i.id !== req.params.id);
      writeDB(db);

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

  return router;
};
