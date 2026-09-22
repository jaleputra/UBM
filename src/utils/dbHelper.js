const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'db.json');

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { orders: [], po: [], invoices: [], purchasing: [], bom: [], delivery: [], projects: [], quotations: [], bast: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return { orders: [], po: [], invoices: [], purchasing: [], bom: [], delivery: [], projects: [], quotations: [], bast: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing DB:', err);
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
  DB_FILE
};
