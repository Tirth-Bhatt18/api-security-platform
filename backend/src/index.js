require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./db/connection');
const authRoutes = require('./routes/auth');
const scanRoutes = require('./routes/scans');
const resultsRoutes = require('./routes/results');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Initialize database tables
db.initTables().catch(err => {
  console.error('Failed to initialize database tables:', err);
  process.exit(1);
});

// Routes
app.use('/auth', authRoutes);
app.use('/scans', scanRoutes);
app.use('/scan', scanRoutes); // Compatibility alias for POST /scan
app.use('/results', resultsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Security Platform Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
