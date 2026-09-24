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

// No-op broadcast for serverless / stateless environments
const noopBroadcast = () => {};

// Mount API router
const apiRouter = createApiRouter(noopBroadcast);

// Handle both standard /api and Netlify Functions path
app.use('/.netlify/functions/api', apiRouter);
app.use('/api', apiRouter);

module.exports = app;
