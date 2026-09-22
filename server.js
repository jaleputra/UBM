require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- LIVE RELOAD & HOT MODULE RELOAD (SSE) ----------------
let sseClients = [];

app.get('/api/live-reload', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (res.flushHeaders) res.flushHeaders();

  sseClients.push(res);
  res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

function broadcastReload(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {
      // client disconnected
    }
  });
}

// Watch public and src folders for live reload
const publicDir = path.join(__dirname, 'public');
let debounceTimer = null;

if (fs.existsSync(publicDir)) {
  fs.watch(publicDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const ext = path.extname(filename).toLowerCase();
      console.log(`⚡ [Live Reload] Perubahan file: ${filename}`);
      if (ext === '.css') {
        broadcastReload({ type: 'css-update', file: filename, timestamp: Date.now() });
      } else {
        broadcastReload({ type: 'reload', file: filename, timestamp: Date.now() });
      }
    }, 80);
  });
}

// ---------------- MOUNT MODULAR API ROUTES ----------------
const createApiRouter = require('./src/routes/api');
app.use('/api', createApiRouter(broadcastReload));

// Fallback to index.html for client SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server with automatic fallback if port is in use
function startServer(portToUse) {
  const server = app.listen(portToUse, () => {
    console.log(`=============================================`);
    console.log(`🚀 UBM Web Application is running!`);
    console.log(`📍 URL: http://localhost:${portToUse}`);
    console.log(`⚡ Architecture: Modular MVC Structured`);
    console.log(`📋 Modules: Orders, Projects, BOM, Purchasing, PO, Delivery, Invoices`);
    console.log(`=============================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToUse} sedang digunakan. Mencoba port ${portToUse + 1}...`);
      startServer(portToUse + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(Number(PORT));
