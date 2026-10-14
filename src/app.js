require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const createApiRouter = require('./routes/api');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Client-side error and debug log receiver
app.post('/api/client-log', (req, res) => {
  try {
    const fs = require('fs');
    const logLine = `[${new Date().toISOString()}] ${JSON.stringify(req.body)}\n`;
    fs.appendFileSync(path.join(__dirname, '..', 'scratch', 'client_errors.log'), logLine);
  } catch (e) {}
  console.log('🛑 [CLIENT LOG/ERROR]:', JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// No-op broadcast for serverless / stateless environments
const noopBroadcast = () => {};

// Mount API router
const apiRouter = createApiRouter(noopBroadcast);

// Handle both standard /api and Netlify Functions path
app.use('/.netlify/functions/api', apiRouter);
app.use('/api', apiRouter);

module.exports = app;
