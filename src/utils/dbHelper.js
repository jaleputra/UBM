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

function readDB() {
  if (inMemoryDB && (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
    return inMemoryDB;
  }
  try {
    const fileToRead = getDbFilePath();
    if (!fs.existsSync(fileToRead)) {
      if (fs.existsSync(LOCAL_DB_FILE)) {
        const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf8');
        inMemoryDB = JSON.parse(raw);
        return inMemoryDB;
      }
      const initial = { orders: [], po: [], invoices: [], purchasing: [], bom: [], delivery: [], projects: [], quotations: [], bast: [] };
      return initial;
    }
    const data = fs.readFileSync(fileToRead, 'utf8');
    inMemoryDB = JSON.parse(data);
    return inMemoryDB;
  } catch (err) {
    console.error('Error reading DB:', err.message);
    if (inMemoryDB) return inMemoryDB;
    return { orders: [], po: [], invoices: [], purchasing: [], bom: [], delivery: [], projects: [], quotations: [], bast: [] };
  }
}

function writeDB(data) {
  inMemoryDB = data;
  try {
    const targetFile = getDbFilePath();
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2));
  } catch (err) {
    try {
      fs.writeFileSync(TMP_DB_FILE, JSON.stringify(data, null, 2));
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

module.exports = {
  readDB,
  writeDB,
  mapToSnakeCase,
  mapToCamelCase,
  camelToSnake,
  snakeToCamel,
  DB_FILE: LOCAL_DB_FILE
};
