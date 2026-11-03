const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const {
  readDB,
  writeDB,
  mapToCamelCase,
  getCloudSync,
  setCloudSync,
  upsertNativeSupabaseRow,
  deleteNativeSupabaseRow,
  fetchAuthoritativeList,
  saveAuthoritativeList,
  missingSupabaseTables,
  CLOUD_SYNC_PREFIX
} = require('../utils/dbHelper');

const UPLOADS_PO_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'po');
const UPLOADS_QUO_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'quotations');
const UPLOADS_BAST_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'bast');
const UPLOADS_PRJ_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'projects');

try {
  if (!fs.existsSync(UPLOADS_PO_DIR)) fs.mkdirSync(UPLOADS_PO_DIR, { recursive: true });
} catch (e) {}

try {
  if (!fs.existsSync(UPLOADS_QUO_DIR)) fs.mkdirSync(UPLOADS_QUO_DIR, { recursive: true });
} catch (e) {}

try {
  if (!fs.existsSync(UPLOADS_BAST_DIR)) fs.mkdirSync(UPLOADS_BAST_DIR, { recursive: true });
} catch (e) {}

try {
  if (!fs.existsSync(UPLOADS_PRJ_DIR)) fs.mkdirSync(UPLOADS_PRJ_DIR, { recursive: true });
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

const ALL_SYNC_RESOURCES = [
  'quotations',
  'orders',
  'projects',
  'bom',
  'purchasing',
  'purchasing_process',
  'master_items',
  'po',
  'delivery',
  'invoices',
  'bast',
  'project_reports',
  'maintenance',
  'service_tickets',
  'warranty_claims',
  'activity_logs',
  'partnerships',
  'service_expenses',
  'roles',
  'users'
];

const DEFAULT_ROLES = [
  {
    id: 'ROLE-ADMIN',
    roleName: 'Administrator',
    label: 'Administrator',
    badgeColor: '#9d174d',
    description: 'Akses penuh seluruh modul sistem, persetujuan, dan manajemen akun pengguna',
    allowedViews: [
      'dashboard', 'logs', 'quotations', 'orders', 'projects', 'bom', 'bom-form',
      'purchasing', 'project-reports', 'timeline', 'invoices', 'bast',
      'finance', 'service', 'maintenance', 'settings'
    ],
    canApproveOrder: true,
    canAssignLead: true,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: true
  },
  {
    id: 'ROLE-KETUA',
    roleName: 'Ketua UBM',
    label: 'Ketua UBM',
    badgeColor: '#1e40af',
    description: 'Pimpinan Unit Bisnis: Persetujuan order/project, penunjukan Lead Project, dan monitoring seluruh operasional',
    allowedViews: [
      'dashboard', 'logs', 'quotations', 'orders', 'bom', 'bom-form',
      'purchasing', 'project-reports', 'timeline', 'invoices', 'bast',
      'finance', 'service', 'maintenance', 'settings'
    ],
    canApproveOrder: true,
    canAssignLead: true,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: false
  },
  {
    id: 'ROLE-KEUANGAN',
    roleName: 'Keuangan',
    label: 'Keuangan',
    badgeColor: '#166534',
    description: 'Persetujuan pembelian barang (PR), penerbitan invoice, keuangan project, BAST & layanan after sales',
    allowedViews: [
      'dashboard', 'purchasing', 'invoices', 'bast', 'finance', 'service', 'maintenance', 'logs'
    ],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: false,
    canManageTimeline: false,
    canManageBOM: false,
    canSubmitPR: false,
    canApprovePurchasing: true,
    canManageInvoices: true,
    canManageFinance: true,
    canManageBAST: true,
    canManageAfterSales: true,
    canManageSettings: false
  },
  {
    id: 'ROLE-MEMBER',
    roleName: 'Member',
    label: 'Member',
    badgeColor: '#475569',
    description: 'Anggota Tim / Pelaksana Project: Akses timeline, progres task, dan apabila ditunjuk sebagai Lead Project berwenang menyusun BOM, mengajukan PR, serta mengisi laporan & anggota tim',
    allowedViews: [
      'dashboard', 'orders', 'bom', 'bom-form', 'purchasing', 'project-reports', 'timeline', 'service', 'maintenance', 'logs'
    ],
    canApproveOrder: false,
    canAssignLead: false,
    canRegisterMembers: true,
    canManageTimeline: true,
    canManageBOM: true,
    canSubmitPR: true,
    canApprovePurchasing: false,
    canManageInvoices: false,
    canManageFinance: false,
    canManageBAST: false,
    canManageAfterSales: false,
    canManageSettings: false
  }
];

function getRoleConfig(roleStr) {
  const rLower = (roleStr || '').toLowerCase();
  if (rLower.includes('admin') || rLower.includes('super')) return DEFAULT_ROLES[0];
  if (rLower.includes('ketua') || rLower.includes('wadir') || rLower.includes('direktur') || rLower.includes('pimpinan')) return DEFAULT_ROLES[1];
  if (rLower.includes('keuangan') || rLower.includes('finance') || rLower.includes('accounting') || rLower.includes('bendahara')) return DEFAULT_ROLES[2];
  return DEFAULT_ROLES[3];
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
          await upsertNativeSupabaseRow('settings', { id: 'current', ...db.settings });
          console.log('⚡ [Cloud Sync] Pengaturan profil berhasil diunggah ke Supabase');
        }
      } else {
        db.settings = { ...(db.settings || {}), ...cloudSettings };
        writeDB(db);
        await upsertNativeSupabaseRow('settings', { id: 'current', ...db.settings });
      }

      // 2. Sync Default Roles to Supabase
      for (const r of DEFAULT_ROLES) {
        await upsertNativeSupabaseRow('roles', r);
      }
      await saveAuthoritativeList('roles', DEFAULT_ROLES);

      // 3. Pull authoritative data from Supabase for all resources (never resurrect deleted local items)
      for (const resName of ALL_SYNC_RESOURCES) {
        await fetchAuthoritativeList(resName);
      }
      console.log('⚡ [Cloud Sync] Sinkronisasi otoritatif Supabase (Single Source of Truth) aktif.');
    } catch (err) {
      console.warn('⚠️ [Cloud Sync] Bootstrap notice:', err.message);
    }
  })();

  // ---------------- RELATIONAL INTEGRITY & CASCADE SYNC HELPERS ----------------
  async function syncOrderRelationsOnSave(orderItem) {
    if (!orderItem || !orderItem.id) return;

    // 1. Relasi Order <-> Quotation
    const quoId = orderItem.quotationId || (orderItem.notes && (orderItem.notes.match(/QUO-[\w-]+/i) || [])[0]);
    if (quoId) {
      try {
        const quotations = await fetchAuthoritativeList('quotations');
        const qIdx = quotations.findIndex(q => q.id === quoId);
        if (qIdx !== -1) {
          const isOrderAccepted = ['Accepted', 'Confirmed', 'In Production', 'Delivered', 'Completed'].includes(orderItem.status);
          const targetQuoStatus = isOrderAccepted ? 'Accepted' : 'Pengajuan';
          if (quotations[qIdx].status !== targetQuoStatus || quotations[qIdx].orderId !== orderItem.id) {
            quotations[qIdx] = {
              ...quotations[qIdx],
              status: targetQuoStatus,
              orderId: orderItem.id,
              updatedAt: new Date().toISOString()
            };
            const upQuo = await upsertNativeSupabaseRow('quotations', quotations[qIdx]);
            quotations[qIdx]._syncedNative = upQuo.synced;
            await saveAuthoritativeList('quotations', quotations);
            broadcastReload({ type: 'reload', resource: 'quotations' });
          }
        }
      } catch (e) {
        console.warn('[Relational Sync] Order -> Quotation error:', e.message);
      }
    }

    // 2. Relasi Order <-> Invoice (Otomatis buat/sinkronkan Invoice saat Order berstatus Accepted/aktif)
    const isOrderApproved = ['Accepted', 'Confirmed', 'In Production', 'Delivered', 'Completed'].includes(orderItem.status);
    if (isOrderApproved) {
      try {
        const invoices = await fetchAuthoritativeList('invoices');
        const invId = `INV-${orderItem.id.replace(/^ORD-/, '')}`;
        const existingIdx = invoices.findIndex(inv =>
          inv.orderId === orderItem.id ||
          inv.id === invId ||
          (inv.notes && inv.notes.includes(orderItem.id))
        );

        const subtotal = Number(orderItem.subtotal ?? orderItem.grandTotal ?? 0);
        const taxRate = orderItem.taxRate !== undefined ? Number(orderItem.taxRate) : 11;
        const taxAmount = orderItem.taxAmount !== undefined ? Number(orderItem.taxAmount) : Math.round(subtotal * (taxRate / 100));
        const grandTotal = Number(orderItem.grandTotal ?? (subtotal + taxAmount));
        const today = new Date().toISOString().split('T')[0];

        if (existingIdx === -1) {
          const newInvoice = {
            id: invId,
            orderId: orderItem.id,
            quotationId: quoId || '',
            customerName: orderItem.customerName || 'Customer',
            customerPhone: orderItem.customerPhone || '',
            customerAddress: orderItem.customerAddress || '-',
            invoiceDate: orderItem.orderDate || today,
            dueDate: orderItem.dueDate || orderItem.orderDate || today,
            status: 'Unpaid',
            paymentMethod: 'Bank Transfer (Mandiri)',
            items: (Array.isArray(orderItem.items) && orderItem.items.length > 0) ? orderItem.items : [{
              itemName: orderItem.projectName || 'Pesanan Produk / Jasa',
              qty: 1,
              unit: 'Lot',
              unitPrice: grandTotal,
              total: grandTotal
            }],
            additionalServices: orderItem.additionalServices || [],
            mainItemsTotal: Number(orderItem.mainItemsTotal ?? 0),
            servicesTotal: Number(orderItem.servicesTotal ?? 0),
            itemsTotal: Number(orderItem.itemsTotal ?? subtotal),
            warrantyFee: Number(orderItem.warrantyFee ?? 0),
            discount: Number(orderItem.discount ?? 0),
            subtotal,
            taxRate,
            taxAmount,
            grandTotal,
            paidAmount: 0,
            balanceDue: grandTotal,
            notes: `Faktur Tagihan Resmi untuk Sales Order / Project ${orderItem.id}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          const upInv = await upsertNativeSupabaseRow('invoices', newInvoice);
          newInvoice._syncedNative = upInv.synced;
          invoices.unshift(newInvoice);
          await saveAuthoritativeList('invoices', invoices);
          broadcastReload({ type: 'reload', resource: 'invoices' });
        } else {
          const currentInv = invoices[existingIdx];
          const paidAmt = Number(currentInv.paidAmount ?? 0);
          const updatedInv = {
            ...currentInv,
            orderId: orderItem.id,
            customerName: orderItem.customerName || currentInv.customerName,
            customerPhone: orderItem.customerPhone || currentInv.customerPhone,
            customerAddress: orderItem.customerAddress || currentInv.customerAddress,
            items: (Array.isArray(orderItem.items) && orderItem.items.length > 0) ? orderItem.items : currentInv.items,
            additionalServices: orderItem.additionalServices || currentInv.additionalServices || [],
            mainItemsTotal: Number(orderItem.mainItemsTotal ?? currentInv.mainItemsTotal ?? 0),
            servicesTotal: Number(orderItem.servicesTotal ?? currentInv.servicesTotal ?? 0),
            itemsTotal: Number(orderItem.itemsTotal ?? currentInv.itemsTotal ?? subtotal),
            warrantyFee: Number(orderItem.warrantyFee ?? currentInv.warrantyFee ?? 0),
            discount: Number(orderItem.discount ?? currentInv.discount ?? 0),
            subtotal,
            taxRate,
            taxAmount,
            grandTotal,
            balanceDue: Math.max(0, grandTotal - paidAmt),
            updatedAt: new Date().toISOString()
          };
          const upInv = await upsertNativeSupabaseRow('invoices', updatedInv);
          updatedInv._syncedNative = upInv.synced;
          invoices[existingIdx] = updatedInv;
          await saveAuthoritativeList('invoices', invoices);
          broadcastReload({ type: 'reload', resource: 'invoices' });
        }
      } catch (e) {
        console.warn('[Relational Sync] Order -> Invoice error:', e.message);
      }
    }

    // 3. Relasi Order <-> Project (Sinkronkan nama pelanggan & nama project jika Project sudah ada)
    try {
      const projects = await fetchAuthoritativeList('projects');
      const pIdx = projects.findIndex(p => p.orderId === orderItem.id);
      if (pIdx !== -1) {
        const currentProj = projects[pIdx];
        const updatedProj = {
          ...currentProj,
          customerName: orderItem.customerName || currentProj.customerName,
          projectName: orderItem.projectName || currentProj.projectName,
          dueDate: orderItem.dueDate || currentProj.dueDate,
          updatedAt: new Date().toISOString()
        };
        const upProj = await upsertNativeSupabaseRow('projects', updatedProj);
        updatedProj._syncedNative = upProj.synced;
        projects[pIdx] = updatedProj;
        await saveAuthoritativeList('projects', projects);
        broadcastReload({ type: 'reload', resource: 'projects' });
      }
    } catch (e) {
      console.warn('[Relational Sync] Order -> Project error:', e.message);
    }
  }

  async function syncOrderRelationsOnDelete(deletedOrderId, deletedOrder) {
    if (!deletedOrderId) return;

    // 1. Kembalikan status Quotation terkait menjadi 'Sent' agar tidak terkunci
    try {
      const quotations = await fetchAuthoritativeList('quotations');
      const quoRef = deletedOrder?.quotationId || (deletedOrder?.notes && (deletedOrder.notes.match(/QUO-[\w-]+/i) || [])[0]);
      let quoChanged = false;
      for (let i = 0; i < quotations.length; i++) {
        const q = quotations[i];
        if (q.id === quoRef || q.orderId === deletedOrderId) {
          quotations[i] = {
            ...q,
            status: 'Sent',
            orderId: null,
            updatedAt: new Date().toISOString()
          };
          const upQuo = await upsertNativeSupabaseRow('quotations', quotations[i]);
          quotations[i]._syncedNative = upQuo.synced;
          quoChanged = true;
        }
      }
      if (quoChanged) {
        await saveAuthoritativeList('quotations', quotations);
        broadcastReload({ type: 'reload', resource: 'quotations' });
      }
    } catch (e) {
      console.warn('[Relational Sync] Delete Order -> Quotation error:', e.message);
    }

    // 2. Cascade hapus data turunan yang berelasi langsung dengan orderId ini
    const dependentResources = ['projects', 'bom', 'invoices', 'delivery', 'bast', 'project_reports', 'service_expenses', 'partnerships'];
    for (const depRes of dependentResources) {
      try {
        const list = await fetchAuthoritativeList(depRes);
        const toDelete = list.filter(item =>
          item.orderId === deletedOrderId ||
          (depRes === 'invoices' && item.id === `INV-${deletedOrderId.replace(/^ORD-/, '')}`)
        );
        if (toDelete.length > 0) {
          for (const rem of toDelete) {
            await deleteNativeSupabaseRow(depRes, rem.id);
          }
          const remaining = list.filter(item => !toDelete.some(d => d.id === item.id));
          await saveAuthoritativeList(depRes, remaining);
          broadcastReload({ type: 'reload', resource: depRes });
        }
      } catch (e) {
        console.warn(`[Relational Sync] Cascade delete ${depRes} error:`, e.message);
      }
    }
  }

  async function syncBomRelationsOnSave(bomItem) {
    if (!bomItem || !bomItem.orderId) return;
    try {
      // Update linked Project modalCost if BOM is saved
      const projects = await fetchAuthoritativeList('projects');
      const pIdx = projects.findIndex(p => p.orderId === bomItem.orderId || p.id === bomItem.projectId);
      if (pIdx !== -1) {
        const comps = Array.isArray(bomItem.components) ? bomItem.components : [];
        const matCost = bomItem.materialCost !== undefined
          ? Number(bomItem.materialCost)
          : comps.reduce((sum, c) => sum + ((Number(c.qty) || 0) * (Number(c.unitCost) || 0)), 0);
        const labCost = Number(bomItem.laborCost ?? 0);
        const ovhCost = Number(bomItem.overheadCost ?? 0);
        const totCost = Number(bomItem.totalEstimatedCost ?? (matCost + labCost + ovhCost));

        projects[pIdx] = {
          ...projects[pIdx],
          bomId: bomItem.id,
          modalCost: {
            ...(projects[pIdx].modalCost || {}),
            material: matCost,
            labor: labCost,
            overhead: ovhCost,
            total: totCost,
            updatedAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        };
        const upProj = await upsertNativeSupabaseRow('projects', projects[pIdx]);
        projects[pIdx]._syncedNative = upProj.synced;
        await saveAuthoritativeList('projects', projects);
        broadcastReload({ type: 'reload', resource: 'projects' });
      }
    } catch (e) {
      console.warn('[Relational Sync] BOM -> Project error:', e.message);
    }
  }

  async function syncDeliveryRelationsOnSave(deliveryItem) {
    if (!deliveryItem || !deliveryItem.orderId) return;
    if (deliveryItem.status === 'Delivered' || deliveryItem.status === 'Delivered / Received') {
      try {
        const orders = await fetchAuthoritativeList('orders');
        const oIdx = orders.findIndex(o => o.id === deliveryItem.orderId);
        if (oIdx !== -1 && orders[oIdx].status !== 'Delivered') {
          orders[oIdx] = {
            ...orders[oIdx],
            status: 'Delivered',
            updatedAt: new Date().toISOString()
          };
          const upOrd = await upsertNativeSupabaseRow('orders', orders[oIdx]);
          orders[oIdx]._syncedNative = upOrd.synced;
          await saveAuthoritativeList('orders', orders);
          broadcastReload({ type: 'reload', resource: 'orders' });
        }
      } catch (e) {
        console.warn('[Relational Sync] Delivery -> Order error:', e.message);
      }
    }
  }

  // Sinkronisasi otomatis Tab 2 (purchasing_process) & Tab 3 (master_items) ke tabel Supabase setiap kali dokumen PR berubah
  async function syncPurchasingProcessAndMasterItems(customPurchasingList = null) {
    try {
      const prList = Array.isArray(customPurchasingList)
        ? customPurchasingList
        : await fetchAuthoritativeList('purchasing');

      const existingProcessList = await fetchAuthoritativeList('purchasing_process');
      const existingMasterList = await fetchAuthoritativeList('master_items');

      const approvedPRs = prList.filter(
        pr => pr && (pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved')
      );

      const newProcessList = [];
      const masterMap = new Map();

      for (const pr of approvedPRs) {
        const items = Array.isArray(pr.items) ? pr.items : [];
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          const item = items[itemIdx];
          if (!item) continue;

          const procId = `PRC-${pr.id}-${itemIdx}`;
          const qty = Number(item.qty ?? 1);
          const estimatedPrice = Number(item.estimatedPrice ?? item.unitPrice ?? 0);
          const purchasePrice = Number(
            item.purchasePrice !== undefined
              ? item.purchasePrice
              : (item.actualPrice !== undefined ? item.actualPrice : estimatedPrice)
          );
          const totalCost = Number(item.total ?? (qty * purchasePrice));
          const itemStatus = item.itemStatus || 'Belum Dipesan';

          const procRow = {
            id: procId,
            prId: pr.id,
            itemIndex: itemIdx,
            requestor: pr.requestor || 'Tim Produksi',
            department: pr.department || 'Umum',
            requestDate: pr.requestDate || new Date().toISOString().split('T')[0],
            itemName: (item.itemName || '').trim(),
            specs: (item.specs || '').trim(),
            qty,
            unit: item.unit || 'Pcs',
            estimatedPrice,
            purchasePrice,
            totalCost,
            orderDate: item.orderDate || null,
            orderLink: item.orderLink || '',
            arrivalDate: item.arrivalDate || item.receivedDate || null,
            recipientName: item.recipientName || item.recipient || item.receivedBy || '',
            itemPhoto: item.itemPhoto || item.photo || '',
            itemStatus,
            notes: item.notes || '',
            createdAt: pr.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const upProc = await upsertNativeSupabaseRow('purchasing_process', procRow);
          procRow._syncedNative = upProc.synced;
          newProcessList.push(procRow);

          // Jika status barang sudah 'Sesuai', masukkan/agregasikan ke tabel master_items (Database Master Barang)
          if (itemStatus === 'Sesuai' && procRow.itemName) {
            const key = `${procRow.itemName.toLowerCase()}:::${procRow.specs.toLowerCase()}`;
            const safeSlug = procRow.itemName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'ITEM';
            const hashSuffix = Buffer.from(key).toString('hex').slice(0, 8).toUpperCase();
            const masterId = `MST-${safeSlug}-${hashSuffix}`;

            if (!masterMap.has(key)) {
              masterMap.set(key, {
                id: masterId,
                itemKey: key,
                itemName: procRow.itemName,
                specs: procRow.specs,
                unit: procRow.unit,
                qty: procRow.qty,
                unitCost: procRow.purchasePrice,
                totalCost: procRow.qty * procRow.purchasePrice,
                departments: pr.department ? [pr.department] : [],
                sources: [{
                  prId: pr.id,
                  itemIndex: itemIdx,
                  requestor: pr.requestor || '-',
                  department: pr.department || 'Umum',
                  requestDate: pr.requestDate || '-',
                  orderDate: procRow.orderDate || '-',
                  arrivalDate: procRow.arrivalDate || '-',
                  qty: procRow.qty,
                  unitCost: procRow.purchasePrice,
                  total: procRow.totalCost
                }],
                status: procRow.qty > 0 ? 'Sesuai & Tersedia' : 'Habis (0)',
                createdAt: pr.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            } else {
              const existingMaster = masterMap.get(key);
              existingMaster.qty += procRow.qty;
              if (procRow.purchasePrice > 0) existingMaster.unitCost = procRow.purchasePrice;
              existingMaster.totalCost = existingMaster.qty * existingMaster.unitCost;
              if (pr.department && !existingMaster.departments.includes(pr.department)) {
                existingMaster.departments.push(pr.department);
              }
              existingMaster.sources.push({
                prId: pr.id,
                itemIndex: itemIdx,
                requestor: pr.requestor || '-',
                department: pr.department || 'Umum',
                requestDate: pr.requestDate || '-',
                orderDate: procRow.orderDate || '-',
                arrivalDate: procRow.arrivalDate || '-',
                qty: procRow.qty,
                unitCost: procRow.purchasePrice,
                total: procRow.totalCost
              });
              existingMaster.status = existingMaster.qty > 0 ? 'Sesuai & Tersedia' : 'Habis (0)';
              existingMaster.updatedAt = new Date().toISOString();
            }
          }
        }
      }

      // Hapus baris purchasing_process yang sudah tidak ada di PR disetujui
      const validProcIds = new Set(newProcessList.map(r => r.id));
      for (const oldProc of existingProcessList) {
        if (oldProc && oldProc.id && !validProcIds.has(oldProc.id)) {
          await deleteNativeSupabaseRow('purchasing_process', oldProc.id);
        }
      }
      await saveAuthoritativeList('purchasing_process', newProcessList);

      // Hitung alokasi pemakaian pada BOM dan pengembalian sisa material dari Laporan Pelaksanaan Project
      const bomList = await fetchAuthoritativeList('bom');
      const activeBoms = Array.isArray(bomList) 
        ? bomList.filter(b => b && b.status !== 'Rejected' && b.status !== 'Ditolak') 
        : [];

      const reportsList = await fetchAuthoritativeList('project_reports');
      const allReports = Array.isArray(reportsList) ? [...reportsList] : [];
      const projectsList = await fetchAuthoritativeList('projects');
      if (Array.isArray(projectsList)) {
        projectsList.forEach(p => {
          if (p && p.actualUsageReport && !allReports.some(r => r.id === p.actualUsageReport.id)) {
            allReports.push(p.actualUsageReport);
          }
        });
      }

      for (const mItem of masterMap.values()) {
        const itemLower = (mItem.itemName || '').toLowerCase().trim();
        mItem.inboundQty = mItem.qty; // Total masuk dari pengadaan PR

        // Hitung total terpakai di BOM
        let usedInBom = 0;
        activeBoms.forEach(b => {
          (b.components || []).forEach(c => {
            const cName = (c.componentName || '').toLowerCase().trim();
            if (cName === itemLower) {
              usedInBom += Number(c.qty || 0);
            }
          });
        });
        mItem.usedInBom = usedInBom;

        // Hitung total dikembalikan dari laporan pelaksanaan project
        let returnedQty = 0;
        allReports.forEach(r => {
          (r.items || []).forEach(it => {
            const rName = (it.itemName || '').toLowerCase().trim();
            if (rName === itemLower) {
              const rem = Number(it.remainingQty ?? it.returnedQty ?? 0);
              if (rem > 0) returnedQty += rem;
            }
          });
        });
        mItem.returnedQty = returnedQty;

        // Stok Tersedia di Inventory Master Barang:
        // Masuk Pengadaan - Digunakan di BOM + Dikembalikan dari Laporan Project
        mItem.qty = Math.max(0, mItem.inboundQty - mItem.usedInBom + mItem.returnedQty);
        mItem.totalCost = mItem.qty * mItem.unitCost;
        mItem.status = mItem.qty > 0 ? 'Sesuai & Tersedia' : (mItem.usedInBom > 0 ? 'Terpakai di BOM (0)' : 'Habis (0)');
      }

      // Upsert semua master_items dan hapus yang sudah tidak ada
      const newMasterList = Array.from(masterMap.values());
      const validMasterIds = new Set(newMasterList.map(m => m.id));
      for (const mItem of newMasterList) {
        const upMst = await upsertNativeSupabaseRow('master_items', mItem);
        mItem._syncedNative = upMst.synced;
      }
      for (const oldMst of existingMasterList) {
        if (oldMst && oldMst.id && !validMasterIds.has(oldMst.id)) {
          await deleteNativeSupabaseRow('master_items', oldMst.id);
        }
      }
      await saveAuthoritativeList('master_items', newMasterList);

      broadcastReload({ type: 'reload', resource: 'purchasing_process' });
      broadcastReload({ type: 'reload', resource: 'master_items' });
    } catch (e) {
      console.warn('[Relational Sync] Purchasing -> Process & Master Items error:', e.message);
    }
  }

  // Jika item pada tabel purchasing_process diupdate langsung, sinkronkan kembali ke dokumen PR induk & master_items
  async function syncProcessItemBackToPurchasing(procItem) {
    if (!procItem || !procItem.prId) return;
    try {
      const prList = await fetchAuthoritativeList('purchasing');
      const pIdx = prList.findIndex(p => p.id === procItem.prId);
      if (pIdx !== -1 && Array.isArray(prList[pIdx].items)) {
        const itemIdx = Number(procItem.itemIndex ?? 0);
        if (prList[pIdx].items[itemIdx]) {
          const oldIt = prList[pIdx].items[itemIdx];
          const qty = Number(procItem.qty ?? oldIt.qty ?? 1);
          const purchasePrice = Number(procItem.purchasePrice ?? oldIt.purchasePrice ?? oldIt.estimatedPrice ?? 0);
          prList[pIdx].items[itemIdx] = {
            ...oldIt,
            itemName: procItem.itemName || oldIt.itemName,
            specs: procItem.specs !== undefined ? procItem.specs : oldIt.specs,
            qty,
            unit: procItem.unit || oldIt.unit || 'Pcs',
            purchasePrice,
            actualPrice: purchasePrice,
            total: qty * purchasePrice,
            orderDate: procItem.orderDate !== undefined ? procItem.orderDate : oldIt.orderDate,
            orderLink: procItem.orderLink !== undefined ? procItem.orderLink : oldIt.orderLink,
            arrivalDate: procItem.arrivalDate !== undefined ? procItem.arrivalDate : oldIt.arrivalDate,
            recipientName: procItem.recipientName !== undefined ? procItem.recipientName : oldIt.recipientName,
            recipient: procItem.recipientName !== undefined ? procItem.recipientName : oldIt.recipient,
            receivedBy: procItem.recipientName !== undefined ? procItem.recipientName : oldIt.receivedBy,
            itemPhoto: procItem.itemPhoto !== undefined ? procItem.itemPhoto : oldIt.itemPhoto,
            itemStatus: procItem.itemStatus || oldIt.itemStatus || 'Belum Dipesan',
            notes: procItem.notes !== undefined ? procItem.notes : oldIt.notes
          };
          prList[pIdx].updatedAt = new Date().toISOString();
          const upPr = await upsertNativeSupabaseRow('purchasing', prList[pIdx]);
          prList[pIdx]._syncedNative = upPr.synced;
          await saveAuthoritativeList('purchasing', prList);
          await syncPurchasingProcessAndMasterItems(prList);
          broadcastReload({ type: 'reload', resource: 'purchasing' });
        }
      }
    } catch (e) {
      console.warn('[Relational Sync] Process -> Purchasing error:', e.message);
    }
  }

  // Endpoint sinkronisasi manual / on-demand antara lokal dan Supabase
  router.all('/sync-cloud', async (req, res) => {
    try {
      const results = {};
      for (const resName of ALL_SYNC_RESOURCES) {
        const syncedList = await fetchAuthoritativeList(resName);
        results[resName] = { action: 'synchronized', count: syncedList.length };
      }
      await syncPurchasingProcessAndMasterItems();
      res.json({ success: true, timestamp: new Date().toISOString(), results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- AUTHENTICATION ENDPOINTS ----------------
  const ADMIN_EMAIL = 'unitbisnis@takumi.ac.id';
  const ADMIN_PASSWORD = 'bisnisdigital365';

  router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    let users = [];
    try {
      users = await fetchAuthoritativeList('users');
    } catch (e) {
      const db = readDB();
      users = db.users || [];
    }

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
      const roleCfg = getRoleConfig(u.role);
      console.log(`🔐 [Auth] Login berhasil untuk akun: ${u.email} (Role: ${roleCfg.roleName})`);
      return res.json({
        success: true,
        message: 'Login berhasil',
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: roleCfg.roleName,
          roleId: roleCfg.id,
          department: u.department,
          avatar: u.avatar || u.name?.slice(0, 2).toUpperCase() || 'AD',
          permissions: u.permissions || roleCfg
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
  router.post('/quotations/:id/pdf', async (req, res) => {
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

      const quotations = await fetchAuthoritativeList('quotations');
      const idx = quotations.findIndex(q => q.id === id);
      if (idx !== -1) {
        quotations[idx].pdfUrl = fileUrl;
        quotations[idx].pdfFilename = safeFilename;
        quotations[idx].updatedAt = new Date().toISOString();
        const upRes = await upsertNativeSupabaseRow('quotations', quotations[idx]);
        quotations[idx]._syncedNative = upRes.synced;
        await saveAuthoritativeList('quotations', quotations);
      }

      console.log(`📄 [Quotation Storage] File PDF berhasil disimpan ke Supabase untuk: ${id}`);
      res.json({ success: true, fileUrl, filename: safeFilename });
    } catch (err) {
      console.error('Error saving quotation PDF:', err);
      res.status(500).json({ error: 'Gagal menyimpan file PDF' });
    }
  });

  // ---------------- SAVE GENERATED BAST PDF ENDPOINT ----------------
  router.post('/bast/:id/pdf', async (req, res) => {
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

      const bastList = await fetchAuthoritativeList('bast');
      const idx = bastList.findIndex(b => b.id === id);
      if (idx !== -1) {
        bastList[idx].pdfUrl = fileUrl;
        bastList[idx].pdfFilename = safeFilename;
        bastList[idx].updatedAt = new Date().toISOString();
        const upRes = await upsertNativeSupabaseRow('bast', bastList[idx]);
        bastList[idx]._syncedNative = upRes.synced;
        await saveAuthoritativeList('bast', bastList);
      }

      console.log(`📄 [BAST Storage] File PDF berhasil disimpan ke Supabase untuk: ${id}`);
      res.json({ success: true, fileUrl, filename: safeFilename });
    } catch (err) {
      console.error('Error saving BAST PDF:', err);
      res.status(500).json({ error: 'Gagal menyimpan file PDF BAST' });
    }
  });

  // Helper: Buka aplikasi email desktop (macOS Mail.app) dengan file PDF langsung ter-attach otomatis
  function openDesktopMailWithAttachment({ filePath, senderEmail, recipients, subject, bodyText }) {
    return new Promise((resolve) => {
      if (process.platform !== 'darwin' || !filePath || !fs.existsSync(filePath)) {
        return resolve(false);
      }
      const { execFile } = require('child_process');
      const appleScript = `
on run argv
  set theSubject to item 1 of argv
  set theBody to item 2 of argv
  set theSender to item 3 of argv
  set theFilePath to item 4 of argv
  set recipientCSV to item 5 of argv

  set AppleScript's text item delimiters to ","
  set recipientList to text items of recipientCSV
  set AppleScript's text item delimiters to ""

  tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:theSubject, content:theBody & return & return, visible:true}
    tell newMessage
      try
        set sender to theSender
      end try
      repeat with rAddr in recipientList
        if (length of rAddr) > 0 then
          make new to recipient at end of to recipients with properties {address:rAddr}
        end if
      end repeat
      make new attachment with properties {file name:(POSIX file theFilePath)} at after the last paragraph
    end tell
    activate
  end tell
end run
      `.trim();

      execFile(
        'osascript',
        [
          '-e',
          appleScript,
          String(subject || ''),
          String(bodyText || ''),
          String(senderEmail || ADMIN_EMAIL),
          String(filePath),
          (Array.isArray(recipients) ? recipients : []).join(',')
        ],
        { timeout: 8000 },
        (err) => {
          if (err) {
            console.warn('⚠️ [Desktop Mail Attachment] Gagal membuka Mail.app via osascript:', err.message);
            return resolve(false);
          }
          console.log(`📎 [Desktop Mail Attachment] Mail.app dibuka otomatis dengan lampiran PDF: ${filePath}`);
          return resolve(true);
        }
      );
    });
  }

  // ---------------- SEND TEAM ASSIGNMENT LETTER PDF VIA EMAIL (ADMIN ONLY) ----------------
  router.post('/projects/send-assignment-email', async (req, res) => {
    const {
      projectId,
      orderId,
      projectName,
      senderEmail,
      senderName,
      senderRole,
      leadName,
      leadEmail,
      team,
      recipients,
      subject,
      message,
      emailBodyText,
      pdfBase64,
      filename
    } = req.body || {};

    const normRole = String(senderRole || '').toLowerCase();
    if (!normRole.includes('admin')) {
      return res.status(403).json({
        error: 'Akses Ditolak: Hanya role Administrator yang dapat mengirim Surat Tugas Project via Email.'
      });
    }

    if (!pdfBase64) {
      return res.status(400).json({ error: 'Berkas PDF Surat Tugas wajib disertakan.' });
    }

    const cleanRecipients = Array.isArray(recipients)
      ? [...new Set(recipients.map(e => String(e || '').trim().toLowerCase()).filter(e => e.includes('@')))]
      : [];

    if (cleanRecipients.length === 0) {
      return res.status(400).json({ error: 'Tidak ada alamat email penerima (Project Lead / Member) yang valid.' });
    }

    try {
      // Ambil email Administrator terbaru dari database users jika tersedia
      let authoritativeAdminEmail = ADMIN_EMAIL;
      try {
        const usersList = await fetchAuthoritativeList('users');
        const dbAdmin = (usersList || []).find(u =>
          String(u?.role || '').toLowerCase().includes('admin') && u?.email && u.status !== 'Non-Aktif'
        );
        if (dbAdmin && dbAdmin.email) {
          authoritativeAdminEmail = String(dbAdmin.email).trim().toLowerCase();
        }
      } catch (e) {}

      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      const rawId = (projectId || orderId || 'PRJ').replace(/[^a-zA-Z0-9-_]/g, '_');
      const safeFilename = (filename || `Surat_Tugas_Project_${rawId}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
      let fileUrl = pdfBase64;
      let savedFilePath = null;
      try {
        savedFilePath = path.join(UPLOADS_PRJ_DIR, safeFilename);
        fs.writeFileSync(savedFilePath, Buffer.from(cleanBase64, 'base64'));
        fileUrl = `/uploads/projects/${safeFilename}`;
      } catch (writeErr) {
        savedFilePath = null;
      }

      const finalSubject = subject || `Surat Tugas Project "${projectName || 'Project'}"`;
      const finalMessage = message || `Surat Tugas Project "${projectName || 'Project'}"`;
      const finalSenderEmail = authoritativeAdminEmail || (senderEmail || ADMIN_EMAIL).trim().toLowerCase();
      const sentAt = new Date().toISOString();

      // Update project record in Supabase & local storage
      const projects = await fetchAuthoritativeList('projects');
      const pIdx = projects.findIndex(p => (projectId && p.id === projectId) || (orderId && (p.orderId === orderId || p.id === orderId)));
      if (pIdx !== -1) {
        projects[pIdx] = {
          ...projects[pIdx],
          assignmentLetterPdfUrl: fileUrl,
          assignmentLetterFilename: safeFilename,
          assignmentEmailSentAt: sentAt,
          assignmentEmailSender: finalSenderEmail,
          assignmentEmailRecipients: cleanRecipients,
          assignmentEmailMessage: finalMessage,
          updatedAt: sentAt
        };
        const upRes = await upsertNativeSupabaseRow('projects', projects[pIdx]);
        projects[pIdx]._syncedNative = upRes.synced;
        await saveAuthoritativeList('projects', projects);
      }

      // Attempt server-side automatic email dispatch if Email API / SMTP is configured
      let smtpSent = false;
      let smtpProvider = null;

      if (process.env.RESEND_API_KEY && typeof fetch === 'function') {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: `${senderName || 'Administrator UBM'} <${process.env.RESEND_FROM_EMAIL || finalSenderEmail}>`,
              reply_to: finalSenderEmail,
              to: cleanRecipients,
              subject: finalSubject,
              text: emailBodyText || finalMessage,
              html: `<p style="font-size:14px;font-weight:bold;">${finalMessage}</p><p>Terlampir dokumen resmi <strong>${safeFilename}</strong> untuk pelaksanaan proyek <strong>${projectName || '-'}</strong>.</p><p>Pengirim: ${senderName || 'Administrator'} (${finalSenderEmail})<br>Project Lead: ${leadName || '-'} (${leadEmail || '-'})</p>`,
              attachments: [
                {
                  filename: safeFilename,
                  content: cleanBase64
                }
              ]
            })
          });
          if (resendRes.ok) {
            smtpSent = true;
            smtpProvider = 'Resend API';
          }
        } catch (errResend) {
          console.warn('⚠️ [Email Dispatch] Resend API error:', errResend.message);
        }
      }

      if (!smtpSent) {
        try {
          const nodemailer = require('nodemailer');
          if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT || 587),
              secure: Number(process.env.SMTP_PORT) === 465,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
              }
            });
            await transporter.sendMail({
              from: `"${senderName || 'Administrator UBM'}" <${finalSenderEmail}>`,
              replyTo: finalSenderEmail,
              to: cleanRecipients.join(', '),
              subject: finalSubject,
              text: emailBodyText || finalMessage,
              html: `<p style="font-size:14px;font-weight:bold;">${finalMessage}</p><p>Terlampir dokumen resmi <strong>${safeFilename}</strong> untuk pelaksanaan proyek <strong>${projectName || '-'}</strong>.</p>`,
              attachments: [
                {
                  filename: safeFilename,
                  content: Buffer.from(cleanBase64, 'base64'),
                  contentType: 'application/pdf'
                }
              ]
            });
            smtpSent = true;
            smtpProvider = 'SMTP Server';
          }
        } catch (e) {}
      }

      // Jika belum terkirim via SMTP eksternal, otomatis buka aplikasi Mail dengan file PDF terlampir (attached)
      let desktopMailOpened = false;
      if (!smtpSent && savedFilePath) {
        desktopMailOpened = await openDesktopMailWithAttachment({
          filePath: savedFilePath,
          senderEmail: finalSenderEmail,
          recipients: cleanRecipients,
          subject: finalSubject,
          bodyText: emailBodyText || finalMessage
        });
      }

      console.log(`📧 [Surat Tugas Email] ${finalSubject} | Dari: ${finalSenderEmail} -> Ke: ${cleanRecipients.join(', ')} | File: ${safeFilename} | AttachedMail: ${desktopMailOpened}`);

      res.json({
        success: true,
        smtpSent,
        smtpProvider,
        desktopMailOpened,
        fileUrl,
        filename: safeFilename,
        senderEmail: finalSenderEmail,
        recipients: cleanRecipients,
        subject: finalSubject,
        message: finalMessage,
        sentAt
      });
    } catch (err) {
      console.error('Error sending project assignment email:', err);
      res.status(500).json({ error: 'Gagal memproses pengiriman email Surat Tugas Project' });
    }
  });

  // Endpoint untuk membuka ulang aplikasi email dengan file PDF langsung ter-attach
  router.post('/projects/open-mail-with-attachment', async (req, res) => {
    const { filename, senderEmail, recipients, subject, bodyText } = req.body || {};
    const safeFilename = String(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(UPLOADS_PRJ_DIR, safeFilename);
    const cleanRecipients = Array.isArray(recipients)
      ? recipients.map(e => String(e || '').trim().toLowerCase()).filter(e => e.includes('@'))
      : [];

    const opened = await openDesktopMailWithAttachment({
      filePath,
      senderEmail: senderEmail || ADMIN_EMAIL,
      recipients: cleanRecipients,
      subject: subject || 'Surat Tugas Project',
      bodyText: bodyText || subject || 'Surat Tugas Project'
    });

    res.json({ success: true, desktopMailOpened: opened });
  });

  // ---------------- SAVE UPLOADED BAST PROOF & DOCUMENTATION PHOTOS ----------------
  router.post('/bast/:id/proof', async (req, res) => {
    const { id } = req.params;
    const { documentBase64, documentFilename, photos, proofNotes, handedOverDate, receiverName } = req.body;

    try {
      const sanitizedId = (id || 'BAST').replace(/[^a-zA-Z0-9-_]/g, '_');
      const bastList = await fetchAuthoritativeList('bast');
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
            bastItem.documentationPhotos.push(photo);
          }
        });
      }

      if (proofNotes !== undefined) bastItem.proofNotes = proofNotes;
      if (handedOverDate !== undefined) bastItem.handedOverDate = handedOverDate;
      if (receiverName !== undefined) bastItem.receiverName = receiverName;
      bastItem.hasProof = true;
      bastItem.proofUpdatedAt = new Date().toISOString();
      bastItem.updatedAt = new Date().toISOString();

      const upRes = await upsertNativeSupabaseRow('bast', bastItem);
      bastItem._syncedNative = upRes.synced;
      bastList[idx] = bastItem;
      await saveAuthoritativeList('bast', bastList);

      console.log(`📸 [BAST Proof] Berhasil upload & simpan ke Supabase berkas serah terima BAST: ${id}`);
      broadcastReload({ type: 'reload', resource: 'bast' });
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
    leaderName: "Rizaldi Putra, M.Kom.",
    leaderNip: "19850412 201012 1 002",
    leaderRole: "Ketua Unit Bisnis Mandiri (UBM)",
    wadir1Name: "Agung Kaswadi, M.T.",
    wadir1Nip: "19820315 200804 1 003",
    wadir1Role: "Wakil Direktur I Politeknik Takumi",
    headAfterSales: "Chowal Jundy Kumoro, M.M.",
    headFinance: "Deddy Sibarani, S.E",
    bankName: "Bank Mandiri",
    bankBranch: "Cabang Cikarang",
    bankAccount: "156-00-1234567-8",
    bankAccountName: "Unit Bisnis Mandiri Politeknik Takumi",
    paymentInstructions: "Pembayaran ditransfer ke Bank Mandiri Cabang Cikarang No. Rek: 156-00-1234567-8 a.n. Unit Bisnis Mandiri Politeknik Takumi",
    copyrightText: "Copyright © Bisnis Digital Takumi"
  };

  router.get('/settings', async (req, res) => {
    try {
      let nativeSettings = null;
      if (supabase && !missingSupabaseTables.has('settings')) {
        try {
          const { data: row, error } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 'current')
            .single();
          if (!error && row) {
            nativeSettings = mapToCamelCase(row);
          } else if (error && (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table')))) {
            missingSupabaseTables.add('settings');
          }
        } catch (e) {}
      }

      let cloudSettings = await getCloudSync('settings');
      let settings = defaultCompanySettings;

      if (nativeSettings && Object.keys(nativeSettings).length > 0) {
        settings = { ...defaultCompanySettings, ...(cloudSettings || {}), ...nativeSettings, id: 'current' };
      } else if (cloudSettings && Object.keys(cloudSettings).length > 0) {
        settings = { ...defaultCompanySettings, ...cloudSettings, id: 'current' };
        upsertNativeSupabaseRow('settings', settings).catch(() => {});
      } else {
        const db = readDB();
        settings = (db.settings && Object.keys(db.settings).length > 0)
          ? { ...defaultCompanySettings, ...db.settings, id: 'current' }
          : { ...defaultCompanySettings, id: 'current' };
        setCloudSync('settings', settings).catch(() => {});
        upsertNativeSupabaseRow('settings', settings).catch(() => {});
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
        id: 'current',
        updatedAt: new Date().toISOString()
      };
      db.settings = updatedSettings;
      writeDB(db);

      await upsertNativeSupabaseRow('settings', updatedSettings);
      await setCloudSync('settings', updatedSettings);

      console.log('⚙️ [Settings] Pengaturan profil perusahaan berhasil diperbarui di tabel Supabase (settings)');
      broadcastReload({ type: 'reload', resource: 'settings' });
      res.json(updatedSettings);
    } catch (err) {
      console.error('Error updating settings:', err);
      res.status(500).json({ error: 'Gagal menyimpan pengaturan' });
    }
  });

  // ---------------- ROLES & PERMISSIONS ENDPOINT ----------------
  router.get('/roles', async (req, res) => {
    try {
      let roles = await fetchAuthoritativeList('roles');
      if (!Array.isArray(roles) || roles.length === 0) {
        roles = DEFAULT_ROLES;
        for (const r of DEFAULT_ROLES) {
          await upsertNativeSupabaseRow('roles', r);
        }
        await saveAuthoritativeList('roles', DEFAULT_ROLES);
      }
      res.json(roles);
    } catch (err) {
      res.json(DEFAULT_ROLES);
    }
  });

  router.put('/roles/:id', async (req, res) => {
    try {
      const roles = await fetchAuthoritativeList('roles');
      const idx = roles.findIndex(r => r.id === req.params.id || r.roleName === req.params.id);
      const existing = idx !== -1 ? roles[idx] : {};
      const updatedRole = {
        ...existing,
        ...req.body,
        id: existing.id || req.params.id,
        updatedAt: new Date().toISOString()
      };
      const upRes = await upsertNativeSupabaseRow('roles', updatedRole);
      updatedRole._syncedNative = upRes.synced;
      if (idx !== -1) {
        roles[idx] = updatedRole;
      } else {
        roles.push(updatedRole);
      }
      await saveAuthoritativeList('roles', roles);
      broadcastReload({ type: 'reload', resource: 'roles' });
      res.json(updatedRole);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Gagal memperbarui role' });
    }
  });

  // ---------------- DASHBOARD KPI & STATS ENDPOINT ----------------
  router.get('/stats', async (req, res) => {
    try {
      const [orders, po, invoices, purchasing, bom, delivery, projects, quotations] = await Promise.all([
        fetchAuthoritativeList('orders'),
        fetchAuthoritativeList('po'),
        fetchAuthoritativeList('invoices'),
        fetchAuthoritativeList('purchasing'),
        fetchAuthoritativeList('bom'),
        fetchAuthoritativeList('delivery'),
        fetchAuthoritativeList('projects'),
        fetchAuthoritativeList('quotations')
      ]);

      const totalQuotations = quotations.length;
      const totalQuotationValue = quotations.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);
      const activeQuotations = quotations.filter(q => q.status === 'Sent' || q.status === 'Draft' || q.status === 'Pengajuan').length;

      const totalOrders = orders.length;
      const totalOrderValue = orders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

      const totalPO = po.length;
      const totalPOValue = po.reduce((sum, p) => sum + (Number(p.totalAmount ?? p.grandTotal) || 0), 0);

      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter(i => i.status === 'Paid').length;
      const unpaidInvoicesValue = invoices
        .filter(i => i.status !== 'Paid')
        .reduce((sum, i) => sum + (Number(i.grandTotal) - (Number(i.paidAmount) || 0)), 0);

      const totalPurchasing = purchasing.length;
      const pendingPurchasing = purchasing.filter(p => p.status === 'Pending' || p.status === 'In Review').length;

      const totalBOM = bom.length;
      const totalDeliveries = delivery.length;
      const activeDeliveries = delivery.filter(d => d.status !== 'Delivered / Received' && d.status !== 'Delivered').length;

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
          amount: p.totalAmount ?? p.grandTotal,
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

  async function autoSyncProjectFinances(prjList, ordList, bomList, quoList, invList) {
    const list = [];
    const seenProjectIds = new Set();
    const seenOrderIds = new Set();

    (prjList || []).forEach(p => {
      if (!p) return;
      const pid = String(p.id || '').trim();
      const oid = String(p.orderId || '').trim();
      list.push(p);
      if (pid) seenProjectIds.add(pid);
      if (oid) seenOrderIds.add(oid);
    });

    (ordList || []).forEach(o => {
      if (!o || !o.id) return;
      const oid = String(o.id).trim();
      const pid = oid.startsWith('ORD-') ? oid.replace('ORD-', 'PRJ-') : `PRJ-${oid}`;
      const already = seenOrderIds.has(oid) || seenProjectIds.has(pid) ||
        list.some(p => p.orderId === oid || p.id === pid || (p.projectName && o.projectName && p.projectName.toLowerCase().trim() === o.projectName.toLowerCase().trim()));
      if (!already) {
        list.push({
          id: pid,
          orderId: o.id,
          projectName: o.projectName || o.customerName || 'Project Penjualan',
          customerName: o.customerName || '-',
          projectLead: o.pic || o.projectLead || 'Tim Engineering',
          status: o.status === 'Accepted' ? 'In Production' : (o.status || 'Planning'),
          totalBudget: o.grandTotal || o.subtotal || 0,
          createdAt: o.createdAt || new Date().toISOString()
        });
        seenProjectIds.add(pid);
        seenOrderIds.add(oid);
      }
    });

    const finRecords = [];
    for (const p of list) {
      const order = (ordList || []).find(o => o.id === p.orderId || o.id === p.id || (o.projectName && p.projectName && o.projectName.toLowerCase().trim() === p.projectName.toLowerCase().trim()));
      const quotation = (quoList || []).find(q => q.id === order?.quotationId || (q.projectName && p.projectName && q.projectName.toLowerCase().trim() === p.projectName.toLowerCase().trim()));
      const linkedBom = (bomList || []).find(b => b.projectId === p.id || b.orderId === (p.orderId || p.id) || (b.projectName && p.projectName && b.projectName.toLowerCase().trim() === p.projectName.toLowerCase().trim()));

      const contractPrice = Number(order?.grandTotal || quotation?.grandTotal || p.totalBudget || 0);
      let materialCost = 0;
      if (p.modalCost && typeof p.modalCost === 'object' && p.modalCost.isManualCustom) {
        materialCost = Number(p.modalCost.material || 0);
      } else if (linkedBom && Array.isArray(linkedBom.components) && linkedBom.components.length > 0) {
        materialCost = linkedBom.components.reduce((sum, c) => sum + ((Number(c.qty) || 0) * (Number(c.unitCost || c.actualPrice || c.purchasePrice || 0))), 0);
      } else if (linkedBom) {
        materialCost = Number(linkedBom.materialCost || linkedBom.totalEstimatedCost || 0);
      } else if (p.modalCost && typeof p.modalCost === 'object') {
        materialCost = Number(p.modalCost.material || 0);
      }

      const laborCost = Number(linkedBom?.laborCost || (p.modalCost && typeof p.modalCost === 'object' ? p.modalCost.labor : 0) || 0);
      const overheadCost = Number(linkedBom?.overheadCost || (p.modalCost && typeof p.modalCost === 'object' ? p.modalCost.overhead : 0) || 0);
      const modalTotal = materialCost + laborCost + overheadCost;

      const isNoWarranty = quotation?.warrantyMonths === 0 || quotation?.warrantyFee === 0 || order?.warrantyFee === 0 ||
        (typeof quotation?.warranty === 'string' && (quotation.warranty.toLowerCase().includes('tidak ada') || quotation.warranty === '0')) ||
        (typeof order?.warranty === 'string' && (order.warranty.toLowerCase().includes('tidak ada') || order.warranty === '0'));

      const allocatedWarranty = isNoWarranty ? 0 : Number(quotation?.warrantyFee || Math.round(contractPrice * 0.05));
      const claimedWarranty = 0;
      const netProfit = contractPrice - modalTotal - claimedWarranty;
      const profitMargin = contractPrice > 0 ? Number(((netProfit / contractPrice) * 100).toFixed(2)) : 0;
      const profitLevel = profitMargin >= 30 ? 'HIGH' : (profitMargin >= 10 ? 'GOOD' : (profitMargin >= 0 ? 'LOW' : 'LOSS'));

      const finId = p.id ? `FIN-${p.id.replace('PRJ-', '')}` : `FIN-${Date.now()}`;
      const finItem = {
        id: finId,
        projectId: p.id,
        orderId: p.orderId || order?.id || '',
        quotationId: quotation?.id || '',
        invoiceId: order?.id ? `INV-${order.id.replace('ORD-', '')}` : '',
        projectName: p.projectName || order?.projectName || 'Project UBM',
        customerName: p.customerName || order?.customerName || '-',
        projectLead: p.projectLead || 'Tim Engineering',
        status: p.status || 'Planning',
        contractSellingPrice: contractPrice,
        sellingPrice: contractPrice,
        materialCost,
        laborCost,
        overheadCost,
        modalTotal,
        allocatedWarranty,
        claimedWarranty,
        remainingWarranty: Math.max(0, allocatedWarranty - claimedWarranty),
        grossProfit: contractPrice - modalTotal,
        netProfit,
        profitMargin,
        profitLevel,
        invoiceStatus: 'Unpaid',
        invoiceGrandTotal: contractPrice,
        totalPaidAmount: 0,
        balanceDue: contractPrice,
        isCustomCost: Boolean(p.modalCost?.isManualCustom),
        notes: isNoWarranty ? 'Tanpa Garansi (0 Bulan).' : 'Alokasi Garansi 5%',
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      finRecords.push(finItem);
    }

    if (finRecords.length > 0) {
      await saveAuthoritativeList('project_finances', finRecords);
      for (const rec of finRecords) {
        await upsertNativeSupabaseRow('project_finances', rec);
      }
    }
  }

  // ---------------- GENERIC CRUD HELPER FUNCTION WITH AUTHORITATIVE SUPABASE SYNC ----------------
  function registerCrudRoutes(resourceName, idPrefix) {
    // GET ALL
    router.get(`/${resourceName}`, async (req, res) => {
      try {
        let items = await fetchAuthoritativeList(resourceName);
        if ((resourceName === 'purchasing_process' || resourceName === 'master_items') && items.length === 0) {
          const prList = await fetchAuthoritativeList('purchasing');
          const hasApprovedPR = prList.some(pr => pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved');
          if (hasApprovedPR) {
            await syncPurchasingProcessAndMasterItems(prList);
            items = await fetchAuthoritativeList(resourceName);
          }
        }
        if (resourceName === 'project_finances' && items.length === 0) {
          const prjList = await fetchAuthoritativeList('projects');
          const ordList = await fetchAuthoritativeList('orders');
          if (prjList.length > 0 || ordList.length > 0) {
            const bomList = await fetchAuthoritativeList('bom');
            const quoList = await fetchAuthoritativeList('quotations');
            const invList = await fetchAuthoritativeList('invoices');
            await autoSyncProjectFinances(prjList, ordList, bomList, quoList, invList);
            items = await fetchAuthoritativeList(resourceName);
          }
        }
        return res.json(items);
      } catch (err) {
        console.warn(`[Supabase Sync] GET /api/${resourceName} notice:`, err.message);
        const db = readDB();
        const fallback = Array.isArray(db[resourceName]) ? db[resourceName] : [];
        return res.json(fallback);
      }
    });

    // GET SINGLE
    router.get(`/${resourceName}/:id`, async (req, res) => {
      try {
        const items = await fetchAuthoritativeList(resourceName);
        const found = items.find(i => i.id === req.params.id);
        if (found) return res.json(found);
      } catch (err) {}

      const db = readDB();
      const localItem = (db[resourceName] || []).find(i => i.id === req.params.id);
      if (!localItem) return res.status(404).json({ error: `${resourceName} not found` });
      res.json(localItem);
    });

    // POST (CREATE)
    router.post(`/${resourceName}`, async (req, res) => {
      try {
        const items = await fetchAuthoritativeList(resourceName);
        const newId = req.body.id || `${idPrefix}-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

        let newItem = {
          id: newId,
          ...req.body,
          createdAt: req.body.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (resourceName === 'orders') {
          newItem = processPOFileStorage(newItem, newId);
        } else if (resourceName === 'bom') {
          const comps = Array.isArray(newItem.components) ? newItem.components : [];
          const matCost = newItem.materialCost !== undefined
            ? Number(newItem.materialCost)
            : comps.reduce((sum, c) => sum + ((Number(c.qty) || 0) * (Number(c.unitCost) || 0)), 0);
          const labCost = Number(newItem.laborCost ?? 0);
          const ovhCost = Number(newItem.overheadCost ?? 0);
          newItem.materialCost = matCost;
          newItem.totalEstimatedCost = newItem.totalEstimatedCost !== undefined
            ? Number(newItem.totalEstimatedCost)
            : (matCost + labCost + ovhCost);
        } else if (resourceName === 'po') {
          if (newItem.expectedDelivery && !newItem.expectedDate) newItem.expectedDate = newItem.expectedDelivery;
          if (newItem.expectedDate && !newItem.expectedDelivery) newItem.expectedDelivery = newItem.expectedDate;
          if (newItem.totalAmount !== undefined && newItem.grandTotal === undefined) newItem.grandTotal = Number(newItem.totalAmount);
          if (newItem.grandTotal !== undefined && newItem.totalAmount === undefined) newItem.totalAmount = Number(newItem.grandTotal);
        }

        // Upsert to native Supabase table if available
        const upRes = await upsertNativeSupabaseRow(resourceName, newItem);
        newItem._syncedNative = upRes.synced;

        const existingIdx = items.findIndex(i => i.id === newItem.id);
        if (existingIdx !== -1) {
          items[existingIdx] = newItem;
        } else {
          items.unshift(newItem);
        }

        await saveAuthoritativeList(resourceName, items);

        // Trigger relational updates in Supabase
        if (resourceName === 'orders') {
          await syncOrderRelationsOnSave(newItem);
        } else if (resourceName === 'bom') {
          await syncBomRelationsOnSave(newItem);
          await syncPurchasingProcessAndMasterItems();
        } else if (resourceName === 'project_reports') {
          await syncPurchasingProcessAndMasterItems();
        } else if (resourceName === 'projects') {
          if (newItem.actualUsageReport) await syncPurchasingProcessAndMasterItems();
        } else if (resourceName === 'delivery') {
          await syncDeliveryRelationsOnSave(newItem);
        } else if (resourceName === 'purchasing') {
          await syncPurchasingProcessAndMasterItems(items);
        } else if (resourceName === 'purchasing_process') {
          await syncProcessItemBackToPurchasing(newItem);
        }

        broadcastReload({ type: 'reload', resource: resourceName });
        res.status(201).json(newItem);
      } catch (err) {
        console.error(`[POST /api/${resourceName}] Error:`, err);
        res.status(500).json({ error: err.message || `Gagal menyimpan ${resourceName}` });
      }
    });

    // PUT (UPDATE)
    router.put(`/${resourceName}/:id`, async (req, res) => {
      if (!req.params.id || req.params.id === 'undefined' || req.params.id === 'null') {
        return res.status(400).json({ error: 'ID tidak valid' });
      }

      try {
        const items = await fetchAuthoritativeList(resourceName);
        const idx = items.findIndex(i => i.id === req.params.id);
        const existingItem = idx !== -1 ? items[idx] : {};

        // Reject direct content edits on quotations that are already converted to sales orders
        if (resourceName === 'quotations') {
          const orders = await fetchAuthoritativeList('orders');
          const linkedOrder = orders.find(o => o.quotationId === req.params.id || (o.notes && o.notes.includes(req.params.id)));
          if (linkedOrder) {
            const contentKeys = ['items', 'customerName', 'projectName', 'customerPhone', 'customerEmail', 'customerAddress', 'subtotal', 'grandTotal', 'discount', 'warranty', 'leadTime'];
            const isContentEdit = existingItem && contentKeys.some(k => {
              if (req.body[k] === undefined) return false;
              return JSON.stringify(req.body[k]) !== JSON.stringify(existingItem[k]);
            });
            if (isContentEdit) {
              return res.status(403).json({
                error: `Surat Penawaran #${req.params.id} sudah dikonversikan ke Order Penjualan #${linkedOrder.id} dan datanya tidak dapat diedit lagi.`
              });
            }
          }
        }

        let updatedItem = {
          ...existingItem,
          ...req.body,
          id: req.params.id,
          updatedAt: new Date().toISOString()
        };

        if (resourceName === 'orders') {
          // Preserve existing PO document if edit form did not upload a replacement
          if (!updatedItem.poFileUrl && existingItem.poFileUrl) {
            updatedItem.poFileUrl = existingItem.poFileUrl;
          }
          if (!updatedItem.poFileName && existingItem.poFileName) {
            updatedItem.poFileName = existingItem.poFileName;
          }
          if (!updatedItem.poDocument && existingItem.poDocument) {
            updatedItem.poDocument = existingItem.poDocument;
          }
          updatedItem = processPOFileStorage(updatedItem, req.params.id);
        } else if (resourceName === 'bom') {
          const comps = Array.isArray(updatedItem.components) ? updatedItem.components : [];
          const matCost = req.body.materialCost !== undefined
            ? Number(req.body.materialCost)
            : comps.reduce((sum, c) => sum + ((Number(c.qty) || 0) * (Number(c.unitCost) || 0)), 0);
          const labCost = Number(updatedItem.laborCost ?? 0);
          const ovhCost = Number(updatedItem.overheadCost ?? 0);
          updatedItem.materialCost = matCost;
          updatedItem.totalEstimatedCost = req.body.totalEstimatedCost !== undefined
            ? Number(req.body.totalEstimatedCost)
            : (matCost + labCost + ovhCost);
        } else if (resourceName === 'po') {
          if (updatedItem.expectedDelivery && !updatedItem.expectedDate) updatedItem.expectedDate = updatedItem.expectedDelivery;
          if (updatedItem.expectedDate && !updatedItem.expectedDelivery) updatedItem.expectedDelivery = updatedItem.expectedDate;
          if (updatedItem.totalAmount !== undefined && req.body.grandTotal === undefined) updatedItem.grandTotal = Number(updatedItem.totalAmount);
          if (updatedItem.grandTotal !== undefined && updatedItem.totalAmount === undefined) updatedItem.totalAmount = Number(updatedItem.grandTotal);
        }

        // Upsert to native Supabase table if available
        const upRes = await upsertNativeSupabaseRow(resourceName, updatedItem);
        updatedItem._syncedNative = upRes.synced;

        if (idx === -1) {
          items.unshift(updatedItem);
        } else {
          items[idx] = updatedItem;
        }

        await saveAuthoritativeList(resourceName, items);

        // Trigger relational updates in Supabase
        if (resourceName === 'orders') {
          await syncOrderRelationsOnSave(updatedItem);
        } else if (resourceName === 'bom') {
          await syncBomRelationsOnSave(updatedItem);
          await syncPurchasingProcessAndMasterItems();
        } else if (resourceName === 'project_reports') {
          await syncPurchasingProcessAndMasterItems();
        } else if (resourceName === 'projects') {
          if (updatedItem.actualUsageReport) await syncPurchasingProcessAndMasterItems();
        } else if (resourceName === 'delivery') {
          await syncDeliveryRelationsOnSave(updatedItem);
        } else if (resourceName === 'purchasing') {
          await syncPurchasingProcessAndMasterItems(items);
        } else if (resourceName === 'purchasing_process') {
          await syncProcessItemBackToPurchasing(updatedItem);
        }

        broadcastReload({ type: 'reload', resource: resourceName });
        res.json(updatedItem);
      } catch (err) {
        console.error(`[PUT /api/${resourceName}/${req.params.id}] Error:`, err);
        res.status(500).json({ error: err.message || `Gagal memperbarui ${resourceName}` });
      }
    });

    // DELETE
    router.delete(`/${resourceName}/:id`, async (req, res) => {
      try {
        const items = await fetchAuthoritativeList(resourceName);
        const deletedItem = items.find(i => i.id === req.params.id);

        await deleteNativeSupabaseRow(resourceName, req.params.id);

        const filtered = items.filter(i => i.id !== req.params.id);
        await saveAuthoritativeList(resourceName, filtered);

        if (resourceName === 'orders') {
          await syncOrderRelationsOnDelete(req.params.id, deletedItem);
        } else if (resourceName === 'purchasing' || resourceName === 'bom' || resourceName === 'project_reports') {
          await syncPurchasingProcessAndMasterItems();
        }

        broadcastReload({ type: 'reload', resource: resourceName });
        res.json({ message: 'Deleted successfully', id: req.params.id });
      } catch (err) {
        console.error(`[DELETE /api/${resourceName}/${req.params.id}] Error:`, err);
        res.status(500).json({ error: err.message || `Gagal menghapus ${resourceName}` });
      }
    });
  }

  // Register CRUD for all transactional & master resources
  registerCrudRoutes('quotations', 'QUO');
  registerCrudRoutes('orders', 'ORD');
  registerCrudRoutes('po', 'PO');
  registerCrudRoutes('invoices', 'INV');
  registerCrudRoutes('purchasing', 'PR');
  registerCrudRoutes('purchasing_process', 'PRC');
  registerCrudRoutes('master_items', 'MST');
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
  registerCrudRoutes('service_expenses', 'EXP-JSA');
  registerCrudRoutes('project_finances', 'FIN');

  // ---------------- DEDICATED DIRECT SUPABASE USERS & ROLES MANAGEMENT ----------------
  async function fetchSupabaseUsers() {
    try {
      const users = await fetchAuthoritativeList('users');
      if (Array.isArray(users)) {
        const enriched = users.map(u => {
          const roleCfg = getRoleConfig(u.role);
          return {
            ...u,
            role: roleCfg.roleName,
            roleId: u.roleId || roleCfg.id,
            permissions: u.permissions && Object.keys(u.permissions).length > 0 ? u.permissions : roleCfg
          };
        });
        const db = readDB();
        db.users = enriched;
        writeDB(db);
        return enriched;
      }
    } catch (err) {
      console.warn('⚠️ [Users Supabase] Read notice:', err.message);
    }
    const db = readDB();
    return Array.isArray(db.users) ? db.users : [];
  }

  async function saveSupabaseUsers(usersList) {
    try {
      for (const u of usersList) {
        if (u && u.id) {
          const upRes = await upsertNativeSupabaseRow('users', u);
          u._syncedNative = upRes.synced;
        }
      }
      await saveAuthoritativeList('users', usersList);
      console.log(`⚡ [Users Supabase] ${usersList.length} akun pengguna berhasil disimpan langsung ke tabel Supabase (users)`);
    } catch (err) {
      console.error('❌ [Users Supabase] Exception on upsert:', err.message);
    }
    const db = readDB();
    db.users = usersList;
    writeDB(db);
  }

  router.get('/users', async (req, res) => {
    try {
      const users = await fetchSupabaseUsers();
      res.json(users);
    } catch (err) {
      const db = readDB();
      res.json(db.users || []);
    }
  });

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

      const roleCfg = getRoleConfig(role || 'Member');
      const newId = req.body.id || `USR-2026-${String(Math.floor(Math.random() * 900 + 100))}`;
      const newUser = {
        id: newId,
        name: (name || '').trim(),
        email: cleanEmail,
        password: (password || '').trim(),
        role: roleCfg.roleName,
        roleId: roleCfg.id,
        department: department || 'Operations & Management',
        status: status || 'Aktif',
        avatar: avatar || (name ? name.slice(0, 2).toUpperCase() : 'US'),
        permissions: roleCfg,
        createdAt: req.body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const upRes = await upsertNativeSupabaseRow('users', newUser);
      newUser._syncedNative = upRes.synced;

      users.unshift(newUser);
      await saveAuthoritativeList('users', users);
      broadcastReload({ type: 'reload', resource: 'users' });
      console.log(`✅ [Users API] Akun baru ${newUser.email} (${newUser.role}) berhasil disimpan langsung ke tabel Supabase (users)`);
      res.status(201).json(newUser);
    } catch (err) {
      console.error('❌ [Users API] Gagal membuat akun:', err);
      res.status(500).json({ error: 'Gagal menyimpan akun ke database' });
    }
  });

  // Bulk Import / Save Multiple Users to Supabase
  router.post('/users/bulk', async (req, res) => {
    try {
      const rawAccounts = Array.isArray(req.body?.accounts)
        ? req.body.accounts
        : (Array.isArray(req.body) ? req.body : []);

      if (rawAccounts.length === 0) {
        return res.status(400).json({ error: 'Daftar akun pengguna kosong' });
      }

      const users = await fetchSupabaseUsers();
      const savedAccounts = [];
      let createdCount = 0;
      let updatedCount = 0;

      for (let i = 0; i < rawAccounts.length; i++) {
        const acc = rawAccounts[i] || {};
        const name = String(acc.name || '').trim();
        const cleanEmail = String(acc.email || '').trim().toLowerCase();
        const password = String(acc.password || '').trim();
        if (!name || !cleanEmail || !password) continue;

        const roleCfg = getRoleConfig(acc.role || 'Member');
        const status = (acc.status && String(acc.status).toLowerCase().includes('non')) ? 'Non-Aktif' : 'Aktif';
        const department = String(acc.department || 'Operations & Management').trim() || 'Operations & Management';
        const cleanNameParts = name.replace(/^(Ir\.|Dr\.|Drs\.|Prof\.|H\.|Hj\.)\s*/i, '').trim().split(/\s+/).filter(Boolean);
        const avatar = acc.avatar || (
          cleanNameParts.length >= 2
            ? (cleanNameParts[0][0] + cleanNameParts[1][0]).toUpperCase()
            : (cleanNameParts[0] ? cleanNameParts[0].slice(0, 2).toUpperCase() : 'US')
        );

        const existingIdx = users.findIndex(u => (u.email || '').trim().toLowerCase() === cleanEmail);
        if (existingIdx !== -1) {
          const existing = users[existingIdx];
          const updatedUser = {
            ...existing,
            name,
            email: cleanEmail,
            password,
            role: roleCfg.roleName,
            roleId: roleCfg.id,
            department,
            status,
            avatar,
            permissions: roleCfg,
            updatedAt: new Date().toISOString()
          };
          const upRes = await upsertNativeSupabaseRow('users', updatedUser);
          updatedUser._syncedNative = upRes.synced;
          users[existingIdx] = updatedUser;
          savedAccounts.push(updatedUser);
          updatedCount++;
        } else {
          const newId = acc.id || `USR-2026-${Date.now().toString().slice(-3)}${String(10 + (i % 89))}`;
          const newUser = {
            id: newId,
            name,
            email: cleanEmail,
            password,
            role: roleCfg.roleName,
            roleId: roleCfg.id,
            department,
            status,
            avatar,
            permissions: roleCfg,
            createdAt: acc.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          const upRes = await upsertNativeSupabaseRow('users', newUser);
          newUser._syncedNative = upRes.synced;
          users.unshift(newUser);
          savedAccounts.push(newUser);
          createdCount++;
        }
      }

      await saveAuthoritativeList('users', users);
      broadcastReload({ type: 'reload', resource: 'users' });
      console.log(`✅ [Users Bulk API] ${savedAccounts.length} akun pengguna (${createdCount} baru, ${updatedCount} diperbarui) berhasil disimpan ke tabel Supabase (users)`);
      res.status(201).json({
        success: true,
        savedCount: savedAccounts.length,
        createdCount,
        updatedCount,
        users: savedAccounts,
        allUsers: users
      });
    } catch (err) {
      console.error('❌ [Users Bulk API] Gagal menyimpan banyak akun:', err);
      res.status(500).json({ error: err.message || 'Gagal menyimpan daftar akun ke database' });
    }
  });

  router.put('/users/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const users = await fetchSupabaseUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      const existing = users[idx];
      const roleCfg = getRoleConfig(req.body.role || existing.role || 'Member');
      const updated = {
        ...existing,
        ...req.body,
        id: userId,
        role: roleCfg.roleName,
        roleId: roleCfg.id,
        permissions: roleCfg,
        updatedAt: new Date().toISOString()
      };

      const upRes = await upsertNativeSupabaseRow('users', updated);
      updated._syncedNative = upRes.synced;

      users[idx] = updated;
      await saveAuthoritativeList('users', users);
      broadcastReload({ type: 'reload', resource: 'users' });
      console.log(`✅ [Users API] Akun ${updated.email} (${userId}) berhasil diperbarui langsung di tabel Supabase (users)`);
      res.json(updated);
    } catch (err) {
      console.error('❌ [Users API] Gagal update akun:', err);
      res.status(500).json({ error: 'Gagal memperbarui akun di database' });
    }
  });

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

      await deleteNativeSupabaseRow('users', userId);
      const filtered = users.filter(u => u.id !== userId);
      await saveAuthoritativeList('users', filtered);
      broadcastReload({ type: 'reload', resource: 'users' });
      console.log(`🗑️ [Users API] Akun ${userToDelete.email} (${userId}) berhasil dihapus langsung dari tabel Supabase (users)`);
      res.json({ message: 'Deleted successfully', id: userId });
    } catch (err) {
      console.error('❌ [Users API] Gagal menghapus akun:', err);
      res.status(500).json({ error: 'Gagal menghapus akun dari database' });
    }
  });

  // Clear all projects and finance data
  router.delete('/finance/clear-all', async (req, res) => {
    try {
      if (supabase && !missingSupabaseTables.has('projects')) {
        await supabase.from('projects').delete().neq('id', '___non_existent___');
      }
      if (supabase && !missingSupabaseTables.has('project_reports')) {
        await supabase.from('project_reports').delete().neq('id', '___non_existent___');
      }
      await saveAuthoritativeList('projects', []);
      await saveAuthoritativeList('project_reports', []);
    } catch (e) {}
    broadcastReload({ type: 'reload', resource: 'projects' });
    broadcastReload({ type: 'reload', resource: 'project_reports' });
    res.json({ success: true, message: 'Semua data keuangan project dan project berhasil dihapus' });
  });

  return router;
};
