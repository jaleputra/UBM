const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCAL_DB_FILE = path.join(__dirname, '..', '..', 'data', 'db.json');
const TMP_DB_FILE = path.join(os.tmpdir(), 'ubm_db.json');

let inMemoryDB = null;

function getDbFilePath() {
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    if (fs.existsSync(TMP_DB_FILE)) return TMP_DB_FILE;
    if (fs.existsSync(LOCAL_DB_FILE)) {
      try {
        fs.copyFileSync(LOCAL_DB_FILE, TMP_DB_FILE);
        return TMP_DB_FILE;
      } catch (e) {
        return LOCAL_DB_FILE;
      }
    }
    return TMP_DB_FILE;
  }
  return LOCAL_DB_FILE;
}

const DEFAULT_SCHEMA = {
  orders: [],
  po: [],
  invoices: [],
  purchasing: [],
  purchasing_process: [],
  master_items: [],
  bom: [],
  delivery: [],
  projects: [],
  quotations: [],
  bast: [],
  project_reports: [],
  maintenance: [],
  service_tickets: [],
  warranty_claims: [],
  activity_logs: [],
  roles: [],
  users: [],
  partnerships: [],
  service_expenses: [],
  project_finances: [],
  settings: {}
};

function readDB() {
  if (inMemoryDB && (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
    return inMemoryDB;
  }
  try {
    const fileToRead = getDbFilePath();
    if (!fs.existsSync(fileToRead)) {
      if (fs.existsSync(LOCAL_DB_FILE)) {
        const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf8');
        inMemoryDB = { ...DEFAULT_SCHEMA, ...JSON.parse(raw) };
        return inMemoryDB;
      }
      return { ...DEFAULT_SCHEMA };
    }
    const data = fs.readFileSync(fileToRead, 'utf8');
    const parsed = JSON.parse(data);
    inMemoryDB = { ...DEFAULT_SCHEMA, ...parsed };
    return inMemoryDB;
  } catch (err) {
    console.error('Error reading DB:', err.message);
    if (inMemoryDB) return inMemoryDB;
    return { ...DEFAULT_SCHEMA };
  }
}

function writeDB(data) {
  inMemoryDB = { ...DEFAULT_SCHEMA, ...data };
  const jsonContent = JSON.stringify(inMemoryDB, null, 2);
  try {
    const targetFile = getDbFilePath();
    const tempFile = `${targetFile}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, jsonContent);
    try {
      fs.renameSync(tempFile, targetFile);
    } catch (renameErr) {
      fs.writeFileSync(targetFile, jsonContent);
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
  } catch (err) {
    try {
      fs.writeFileSync(TMP_DB_FILE, jsonContent);
    } catch (e2) {
      // Kept in memory
    }
  }
}

// ---------------- CAMELCASE <-> SNAKE_CASE UTILITIES ----------------
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

function mapToSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    result[camelToSnake(key)] = value;
  }
  return result;
}

function mapToCamelCase(data) {
  if (Array.isArray(data)) {
    return data.map(item => mapToCamelCase(item));
  }
  if (!data || typeof data !== 'object') return data;

  const result = {};
  for (const [key, value] of Object.entries(data)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

// ---------------- SUPABASE CLOUD STORE & NATIVE TABLE HELPERS ----------------
const supabase = require('../config/supabase');

const CLOUD_SYNC_PREFIX = '__SYS_SYNC_';
const CLOUD_SYNC_SUFFIX = '__';

const missingSupabaseTables = new Set();
const missingTableTimestamps = {};
const missingTableColumns = {};

function isTableTemporarilyMissing(resourceName) {
  if (!missingSupabaseTables.has(resourceName)) return false;
  const ts = missingTableTimestamps[resourceName] || 0;
  if (Date.now() - ts > 5000) {
    missingSupabaseTables.delete(resourceName);
    delete missingTableTimestamps[resourceName];
    return false;
  }
  return true;
}

function markTableTemporarilyMissing(resourceName) {
  missingSupabaseTables.add(resourceName);
  missingTableTimestamps[resourceName] = Date.now();
}

function getCloudSyncKey(resource) {
  return `${CLOUD_SYNC_PREFIX}${resource}${CLOUD_SYNC_SUFFIX}`;
}

async function getCloudSync(resource) {
  if (!supabase) return null;
  try {
    const syncKey = getCloudSyncKey(resource);
    const { data, error } = await supabase
      .from('delivery')
      .select('items, updated_at')
      .eq('id', syncKey)
      .single();

    if (!error && data && data.items !== undefined && data.items !== null) {
      if (resource === 'settings') {
        return Array.isArray(data.items) ? (data.items[0] || {}) : data.items;
      }
      return Array.isArray(data.items) ? data.items : [];
    }
  } catch (err) {
    console.warn(`[Cloud Sync] Error fetching sync for ${resource}:`, err.message);
  }
  return null;
}

async function setCloudSync(resource, data) {
  if (!supabase) return false;
  try {
    const syncKey = getCloudSyncKey(resource);
    const itemsPayload = Array.isArray(data) ? data : [data];
    const { error } = await supabase
      .from('delivery')
      .upsert({
        id: syncKey,
        customer_name: '__UBM_SYS_STORE__',
        items: itemsPayload,
        notes: `Cloud store synchronization for ${resource}`,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.warn(`[Cloud Sync] Error saving sync for ${resource}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[Cloud Sync] Exception saving sync for ${resource}:`, err.message);
    return false;
  }
}

function isValidDateString(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '-') return false;
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed);
}

function toSqlDateOrNull(val, fallbackToday = false) {
  if (isValidDateString(val)) {
    return val.trim().slice(0, 10);
  }
  return fallbackToday ? new Date().toISOString().split('T')[0] : null;
}

const NOT_NULL_DATE_COLS = new Set([
  'quotation_date',
  'order_date',
  'po_date',
  'invoice_date',
  'request_date',
  'created_date',
  'delivery_date',
  'start_date',
  'bast_date',
  'report_date',
  'schedule_date',
  'ticket_date',
  'claim_date'
]);

const NULLABLE_DATE_COLS = new Set([
  'due_date',
  'expected_date',
  'valid_until',
  'end_date',
  'handed_over_date',
  'disbursement_date',
  'date'
]);

function prepareNativeTablePayload(resourceName, rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return {};
  const item = { ...rawItem };
  delete item._syncedNative;

  const today = new Date().toISOString().split('T')[0];

  // Normalize resource-specific fields before converting to snake_case
  if (resourceName === 'orders') {
    item.customerName = item.customerName || 'Customer';
    item.orderDate = toSqlDateOrNull(item.orderDate, true);
    item.dueDate = toSqlDateOrNull(item.dueDate, false);
    item.status = item.status || 'Pengajuan';
    item.items = Array.isArray(item.items) ? item.items : [];
    item.subtotal = Number(item.subtotal ?? 0);
    item.taxRate = Number(item.taxRate ?? 11);
    item.taxAmount = Number(item.taxAmount ?? 0);
    item.grandTotal = Number(item.grandTotal ?? item.subtotal ?? 0);
  } else if (resourceName === 'po') {
    item.vendorName = item.vendorName || 'Vendor';
    item.poDate = toSqlDateOrNull(item.poDate, true);
    item.expectedDate = toSqlDateOrNull(item.expectedDate || item.expectedDelivery, false);
    item.status = item.status || 'Pending Approval';
    item.paymentTerms = item.paymentTerms || 'NET 30';
    item.items = Array.isArray(item.items) ? item.items : [];
    const totalAmt = Number(item.grandTotal ?? item.totalAmount ?? item.subtotal ?? 0);
    item.subtotal = Number(item.subtotal ?? totalAmt);
    item.taxRate = Number(item.taxRate ?? 0);
    item.taxAmount = Number(item.taxAmount ?? 0);
    item.grandTotal = totalAmt;
  } else if (resourceName === 'invoices') {
    item.customerName = item.customerName || 'Customer';
    const invDate = toSqlDateOrNull(item.invoiceDate, true);
    item.invoiceDate = invDate;
    // invoices.due_date is NOT NULL in Supabase schema
    item.dueDate = toSqlDateOrNull(item.dueDate, false) || invDate || today;
    item.status = item.status || 'Unpaid';
    item.paymentMethod = item.paymentMethod || 'Bank Transfer';
    item.items = Array.isArray(item.items) ? item.items : [];
    item.subtotal = Number(item.subtotal ?? item.grandTotal ?? 0);
    item.taxRate = Number(item.taxRate ?? 11);
    item.taxAmount = Number(item.taxAmount ?? 0);
    item.grandTotal = Number(item.grandTotal ?? item.subtotal ?? 0);
    item.paidAmount = Number(item.paidAmount ?? 0);
    item.balanceDue = Number(item.balanceDue ?? Math.max(0, item.grandTotal - item.paidAmount));
  } else if (resourceName === 'purchasing') {
    item.requestor = item.requestor || item.picName || 'Tim Produksi';
    item.department = item.department || 'Produksi & Project';
    item.requestDate = toSqlDateOrNull(item.requestDate || item.requiredDate, true);
    item.urgency = item.urgency || 'Medium';
    item.status = item.status || 'Pending';
    item.items = Array.isArray(item.items) ? item.items : [];
    item.totalEstimated = Number(item.totalEstimated ?? item.grandTotal ?? 0);
    item.approvedBy = item.approvedBy || '-';
  } else if (resourceName === 'bom') {
    item.productName = item.productName || 'Produk Manufaktur';
    item.productCode = item.productCode || item.id || 'BOM-ITEM';
    item.revision = item.revision || 'v1.0';
    item.category = item.category || 'General Assembly';
    item.createdDate = toSqlDateOrNull(item.createdDate, true);
    item.status = item.status || 'Pengajuan';
    const comps = Array.isArray(item.components) ? item.components : [];
    item.components = comps;
    const labor = Number(item.laborCost ?? 0);
    const overhead = Number(item.overheadCost ?? 0);
    const matCost = item.materialCost !== undefined
      ? Number(item.materialCost)
      : comps.reduce((sum, c) => sum + ((Number(c.qty) || 0) * (Number(c.unitCost) || 0)), 0);
    item.laborCost = labor;
    item.overheadCost = overhead;
    item.materialCost = matCost;
    item.totalEstimatedCost = item.totalEstimatedCost !== undefined
      ? Number(item.totalEstimatedCost)
      : (matCost + labor + overhead);
  } else if (resourceName === 'delivery') {
    item.customerName = item.customerName || 'Customer';
    item.deliveryDate = toSqlDateOrNull(item.deliveryDate, true);
    item.status = item.status || 'Packing / Ready';
    item.items = Array.isArray(item.items) ? item.items : [];
    item.receivedBy = item.receivedBy || '-';
    item.receivedAt = item.receivedAt || '-';
  } else if (resourceName === 'quotations') {
    item.customerName = item.customerName || 'Customer';
    item.quotationDate = toSqlDateOrNull(item.quotationDate, true);
    item.validUntil = toSqlDateOrNull(item.validUntil, false);
    item.status = item.status || 'Sent';
    item.items = Array.isArray(item.items) ? item.items : [];
    item.subtotal = Number(item.subtotal ?? 0);
    item.discount = Number(item.discount ?? 0);
    item.taxRate = Number(item.taxRate ?? 11);
    item.taxAmount = Number(item.taxAmount ?? 0);
    item.grandTotal = Number(item.grandTotal ?? 0);
  } else if (resourceName === 'projects') {
    item.projectName = item.projectName || item.customerName || 'Project UBM';
    item.startDate = toSqlDateOrNull(item.startDate, true);
    item.endDate = toSqlDateOrNull(item.endDate || item.dueDate, false);
    item.status = item.status || 'Planning';
    item.progressPercent = Number(item.progressPercent ?? 0);
    item.milestones = Array.isArray(item.milestones) ? item.milestones : [];
    item.team = Array.isArray(item.team) ? item.team : [];
  } else if (resourceName === 'activity_logs') {
    item.task = item.task || 'Kegiatan Operasional';
    item.pic = item.pic || 'Tim UBM';
    item.startDate = toSqlDateOrNull(item.startDate, true);
    item.endDate = toSqlDateOrNull(item.endDate || item.startDate, true);
    item.status = item.status || 'Sedang Berjalan';
  } else if (resourceName === 'purchasing_process') {
    item.prId = item.prId || '';
    item.itemIndex = Number(item.itemIndex ?? 0);
    item.requestor = item.requestor || 'Tim Produksi';
    item.department = item.department || 'Engineering & Produksi';
    item.requestDate = toSqlDateOrNull(item.requestDate, true);
    item.itemName = item.itemName || 'Barang Pengadaan';
    item.specs = item.specs || '';
    item.qty = Number(item.qty ?? 1);
    item.unit = item.unit || 'Pcs';
    item.estimatedPrice = Number(item.estimatedPrice ?? 0);
    item.purchasePrice = Number(item.purchasePrice ?? item.estimatedPrice ?? 0);
    item.totalCost = Number(item.totalCost ?? (item.qty * item.purchasePrice) ?? 0);
    item.orderDate = toSqlDateOrNull(item.orderDate, false);
    item.orderLink = item.orderLink || '';
    item.arrivalDate = toSqlDateOrNull(item.arrivalDate, false);
    item.recipientName = item.recipientName || item.recipient || item.receivedBy || '';
    item.itemPhoto = item.itemPhoto || item.photo || '';
    item.itemStatus = item.itemStatus || 'Belum Dipesan';
    item.notes = item.notes || '';
  } else if (resourceName === 'master_items') {
    item.itemKey = item.itemKey || item.key || `${(item.itemName || '').toLowerCase()}:::${(item.specs || '').toLowerCase()}`;
    item.itemName = item.itemName || 'Master Barang';
    item.specs = item.specs || '';
    item.unit = item.unit || 'Pcs';
    item.qty = Number(item.qty ?? 0);
    item.unitCost = Number(item.unitCost ?? 0);
    item.totalCost = Number(item.totalCost ?? (item.qty * item.unitCost) ?? 0);
    item.departments = Array.isArray(item.departments) ? item.departments : [];
    item.sources = Array.isArray(item.sources) ? item.sources : [];
    item.status = item.status || (item.qty > 0 ? 'Sesuai & Tersedia' : 'Habis (0)');
  } else if (resourceName === 'roles') {
    item.roleName = item.roleName || item.label || 'Member';
    item.label = item.label || item.roleName || 'Member';
    item.allowedViews = Array.isArray(item.allowedViews) ? item.allowedViews : [];
  } else if (resourceName === 'users') {
    item.name = item.name || 'Pengguna UBM';
    item.email = (item.email || '').trim().toLowerCase();
    item.password = item.password || '';
    item.role = item.role || 'Member';
    item.department = item.department || 'Operations & Management';
    item.status = item.status || 'Aktif';
    item.avatar = item.avatar || 'US';
    item.permissions = (item.permissions && typeof item.permissions === 'object') ? item.permissions : {};
  } else if (resourceName === 'project_finances') {
    item.projectName = item.projectName || 'Project UBM';
    item.customerName = item.customerName || '-';
    item.status = item.status || 'Planning';
    item.contractSellingPrice = Number(item.contractSellingPrice ?? 0);
    item.sellingPrice = Number(item.sellingPrice ?? item.contractSellingPrice ?? 0);
    item.materialCost = Number(item.materialCost ?? 0);
    item.laborCost = Number(item.laborCost ?? 0);
    item.overheadCost = Number(item.overheadCost ?? 0);
    item.modalTotal = Number(item.modalTotal ?? (item.materialCost + item.laborCost + item.overheadCost) ?? 0);
    item.allocatedWarranty = Number(item.allocatedWarranty ?? 0);
    item.claimedWarranty = Number(item.claimedWarranty ?? 0);
    item.remainingWarranty = Number(item.remainingWarranty ?? Math.max(0, item.allocatedWarranty - item.claimedWarranty) ?? 0);
    item.grossProfit = Number(item.grossProfit ?? (item.sellingPrice - item.modalTotal) ?? 0);
    item.netProfit = Number(item.netProfit ?? (item.grossProfit - item.claimedWarranty) ?? 0);
    item.profitMargin = Number(item.profitMargin ?? 0);
    item.profitLevel = item.profitLevel || 'GOOD';
    item.invoiceStatus = item.invoiceStatus || 'Unpaid';
    item.invoiceGrandTotal = Number(item.invoiceGrandTotal ?? item.contractSellingPrice ?? 0);
    item.totalPaidAmount = Number(item.totalPaidAmount ?? 0);
    item.balanceDue = Number(item.balanceDue ?? Math.max(0, item.invoiceGrandTotal - item.totalPaidAmount) ?? 0);
    item.isCustomCost = Boolean(item.isCustomCost);
  } else if (resourceName === 'settings') {
    item.id = item.id || 'current';
  }

  const snake = mapToSnakeCase(item);

  // Sanitize any date columns in snake_case
  for (const key of Object.keys(snake)) {
    if (NOT_NULL_DATE_COLS.has(key) || (resourceName === 'activity_logs' && key === 'end_date') || (resourceName === 'invoices' && key === 'due_date')) {
      snake[key] = toSqlDateOrNull(snake[key], true);
    } else if (NULLABLE_DATE_COLS.has(key) || key.endsWith('_date')) {
      snake[key] = toSqlDateOrNull(snake[key], false);
    }
  }

  // Strip known missing columns for this table
  const knownMissing = missingTableColumns[resourceName];
  if (knownMissing && knownMissing.size > 0) {
    for (const col of knownMissing) {
      delete snake[col];
    }
  }

  return snake;
}

async function upsertNativeSupabaseRow(resourceName, item) {
  if (!supabase || !item || !item.id) return { synced: false };

  try {
    let cleanSnake = prepareNativeTablePayload(resourceName, item);

    for (let attempt = 0; attempt < 35; attempt++) {
      const res = await supabase
        .from(resourceName)
        .upsert([cleanSnake], { onConflict: 'id' })
        .select();

      if (!res.error) {
        missingSupabaseTables.delete(resourceName);
        delete missingTableTimestamps[resourceName];
        return { synced: true, data: res.data?.[0] ? mapToCamelCase(res.data[0]) : null };
      }

      const msg = res.error.message || '';
      if (res.error.code === 'PGRST205' || msg.includes('Could not find the table') || msg.includes('relation') || msg.includes('does not exist')) {
        markTableTemporarilyMissing(resourceName);
        return { synced: false };
      }

      if (res.error.code === 'PGRST204' || msg.includes('column') || msg.includes('schema')) {
        const missingCol = (
          msg.match(/'([^']+)' column/) ||
          msg.match(/column "([^"]+)"/) ||
          msg.match(/column '([^']+)'/)
        )?.[1];

        if (missingCol && Object.prototype.hasOwnProperty.call(cleanSnake, missingCol)) {
          if (!missingTableColumns[resourceName]) {
            missingTableColumns[resourceName] = new Set();
          }
          missingTableColumns[resourceName].add(missingCol);
          delete cleanSnake[missingCol];
          continue;
        }
      }

      console.warn(`[Supabase Native] Upsert warning on ${resourceName} (${item.id}):`, res.error.code, msg);
      return { synced: false, error: res.error };
    }
  } catch (err) {
    console.warn(`[Supabase Native] Upsert exception on ${resourceName}:`, err.message);
  }
  return { synced: false };
}

async function deleteNativeSupabaseRow(resourceName, id) {
  if (!supabase || !id) return false;

  try {
    const { error } = await supabase
      .from(resourceName)
      .delete()
      .eq('id', id);

    if (error) {
      const msg = error.message || '';
      if (error.code === 'PGRST205' || msg.includes('Could not find the table')) {
        markTableTemporarilyMissing(resourceName);
      }
      return false;
    }
    missingSupabaseTables.delete(resourceName);
    delete missingTableTimestamps[resourceName];
    return true;
  } catch (err) {
    return false;
  }
}

function mergeNativeAndCloudRecord(nativeCamel, cloudRecord, resourceName) {
  if (!cloudRecord) {
    const item = { ...nativeCamel, _syncedNative: true };
    if (resourceName === 'po') {
      if (item.expectedDate && !item.expectedDelivery) item.expectedDelivery = item.expectedDate;
      if (item.grandTotal !== undefined && item.totalAmount === undefined) item.totalAmount = Number(item.grandTotal);
    }
    return item;
  }

  // Merge cloudRecord (which holds rich relational & UI metadata) with non-null native table columns
  const merged = { ...cloudRecord };
  for (const [k, v] of Object.entries(nativeCamel)) {
    if (v !== null && v !== undefined) {
      merged[k] = v;
    }
  }
  merged._syncedNative = true;

  if (resourceName === 'po') {
    if (merged.expectedDate && !merged.expectedDelivery) merged.expectedDelivery = merged.expectedDate;
    if (merged.grandTotal !== undefined && merged.totalAmount === undefined) merged.totalAmount = Number(merged.grandTotal);
  }
  return merged;
}

/**
 * Fetches the authoritative list for a resource directly from Supabase
 * (combining Native Table rows + Cloud Store metadata).
 * Never resurrects deleted items from local data/db.json!
 */
async function fetchAuthoritativeList(resourceName) {
  const db = readDB();

  if (!supabase) {
    return Array.isArray(db[resourceName]) ? db[resourceName] : [];
  }

  try {
    const cloudData = await getCloudSync(resourceName);
    const cloudList = Array.isArray(cloudData)
      ? cloudData.filter(item => item && item.id && !String(item.id).startsWith(CLOUD_SYNC_PREFIX))
      : null;

    // Check native Supabase table if available
    if (!isTableTemporarilyMissing(resourceName) && resourceName !== 'settings') {
      let query = supabase.from(resourceName).select('*');
      if (resourceName === 'delivery') {
        query = query.not('id', 'like', `${CLOUD_SYNC_PREFIX}%`);
      }
      const { data: nativeRows, error: nativeErr } = await query.order('created_at', { ascending: false });

      if (!nativeErr && Array.isArray(nativeRows)) {
        missingSupabaseTables.delete(resourceName);
        delete missingTableTimestamps[resourceName];
        const nativeCamelList = mapToCamelCase(nativeRows);
        const nativeMap = new Map(nativeCamelList.map(r => [r.id, r]));
        const cloudMap = new Map((cloudList || []).map(c => [c.id, c]));

        const finalItems = [];
        let cloudNeedsUpdate = cloudData === null;

        // 1. Include all rows present in the native Supabase table, enriched with Cloud Sync metadata
        for (const nativeItem of nativeCamelList) {
          const cItem = cloudMap.get(nativeItem.id);
          if (!cItem || !cItem._syncedNative) {
            cloudNeedsUpdate = true;
          }
          finalItems.push(mergeNativeAndCloudRecord(nativeItem, cItem, resourceName));
        }

        // 2. Check items in cloudList that are not in nativeMap:
        // Since native table exists and is authoritative, any items in cloudList not in nativeMap
        // were deleted in Supabase. Mark cloud for update to purge them, and NEVER resurrect them.
        if (cloudList && cloudList.length > 0) {
          for (const cItem of cloudList) {
            if (!nativeMap.has(cItem.id)) {
              cloudNeedsUpdate = true;
            }
          }
        }

        db[resourceName] = finalItems;
        writeDB(db);

        if (cloudNeedsUpdate) {
          setCloudSync(resourceName, finalItems).catch(() => {});
        }
        return finalItems;
      } else if (nativeErr) {
        const msg = nativeErr.message || '';
        if (nativeErr.code === 'PGRST205' || msg.includes('Could not find the table') || msg.includes('relation') || msg.includes('does not exist')) {
          markTableTemporarilyMissing(resourceName);
        }
      }
    }

    // Native table does not exist: Cloud Sync Store in Supabase is the single source of truth
    if (cloudList !== null) {
      db[resourceName] = cloudList;
      writeDB(db);
      return cloudList;
    } else {
      // Cloud Sync row does not exist in Supabase (e.g. cleared in Supabase) -> initialize as empty array []
      db[resourceName] = [];
      writeDB(db);
      await setCloudSync(resourceName, []);
      return [];
    }
  } catch (err) {
    console.warn(`[Supabase Authoritative] Fetch warning for ${resourceName}:`, err.message);
    return Array.isArray(db[resourceName]) ? db[resourceName] : [];
  }
}

async function saveAuthoritativeList(resourceName, items) {
  const cleanList = (Array.isArray(items) ? items : []).filter(
    item => item && item.id && !String(item.id).startsWith(CLOUD_SYNC_PREFIX)
  );
  const db = readDB();
  db[resourceName] = cleanList;
  writeDB(db);
  await setCloudSync(resourceName, cleanList);
  return cleanList;
}

function mergeResourceLists(localList, cloudList) {
  // Authoritative mode: always prefer cloudList if provided so deleted records never resurrect from local
  if (Array.isArray(cloudList)) return cloudList;
  return Array.isArray(localList) ? localList : [];
}

module.exports = {
  readDB,
  writeDB,
  mapToSnakeCase,
  mapToCamelCase,
  camelToSnake,
  snakeToCamel,
  getCloudSync,
  setCloudSync,
  getCloudSyncKey,
  prepareNativeTablePayload,
  upsertNativeSupabaseRow,
  deleteNativeSupabaseRow,
  fetchAuthoritativeList,
  saveAuthoritativeList,
  mergeResourceLists,
  missingSupabaseTables,
  CLOUD_SYNC_PREFIX,
  DB_FILE: LOCAL_DB_FILE
};
