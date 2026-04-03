const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const postmanParser = require('../services/postmanParser');
const scanService = require('../services/scanService');

const router = express.Router();

// Configure multer
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || 10485760),
    files: parseInt(process.env.MAX_FILES || 1),
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/json') {
      return cb(new Error('Only JSON files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Upload and start a new scan
 * POST /scans
 */
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse JSON
    let collection;
    try {
      collection = JSON.parse(fileContent);
    } catch (err) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Invalid JSON file' });
    }

    // Validate Postman collection structure
    if (!collection.info || !collection.item) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Invalid Postman collection format' });
    }

    // Parse requests from collection
    const requests = postmanParser.parseCollection(collection);

    if (requests.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'No requests found in collection' });
    }

    const maxEndpoints = parseInt(process.env.MAX_ENDPOINTS_PER_SCAN || 100);
    if (requests.length > maxEndpoints) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: `Collection exceeds maximum of ${maxEndpoints} endpoints`,
      });
    }

    // Create scan record
    const scanResult = await db.query(
      'INSERT INTO scans (user_id, status, collection_name, endpoints_count) VALUES ($1, $2, $3, $4) RETURNING id, status, created_at',
      [req.user.id, 'pending', collection.info.name, requests.length]
    );

    const scan = scanResult.rows[0];
    const scanId = scan.id;

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    // Send to Python scanner asynchronously (don't wait)
    scanService.sendScanToPython(scanId, requests, req.user.id).catch(err => {
      console.error(`Error sending scan ${scanId} to Python:`, err);
      // Update scan status to failed
      db.query('UPDATE scans SET status = $1 WHERE id = $2', ['failed', scanId]).catch(console.error);
    });

    res.status(202).json({
      message: 'Scan created and queued for processing',
      scan: {
        id: scanId,
        status: scan.status,
        endpoints_count: requests.length,
        created_at: scan.created_at,
      },
    });
  } catch (err) {
    if (req.file) {
      fs.unlinkSync(req.file.path).catch(console.error);
    }
    console.error('Scan creation error:', err);
    res.status(500).json({ error: 'Failed to create scan' });
  }
});

/**
 * Get all scans for authenticated user
 * GET /scans
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const scans = await db.queryAll(
      'SELECT id, status, collection_name, endpoints_count, created_at, updated_at FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );

    res.json({ scans });
  } catch (err) {
    console.error('Get scans error:', err);
    res.status(500).json({ error: 'Failed to retrieve scans' });
  }
});

/**
 * Get specific scan details
 * GET /scans/:scanId
 */
router.get('/:scanId', authMiddleware, async (req, res) => {
  try {
    const { scanId } = req.params;

    // Verify scan belongs to user
    const scan = await db.queryOne(
      'SELECT id, user_id, status, collection_name, endpoints_count, created_at, updated_at FROM scans WHERE id = $1',
      [scanId]
    );

    if (!scan || scan.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Get vulnerability count
    const vulnCount = await db.queryOne(
      'SELECT COUNT(*) as count FROM results WHERE scan_id = $1',
      [scanId]
    );

    res.json({
      scan: {
        ...scan,
        vulnerability_count: parseInt(vulnCount.count),
      },
    });
  } catch (err) {
    console.error('Get scan error:', err);
    res.status(500).json({ error: 'Failed to retrieve scan' });
  }
});

module.exports = router;
