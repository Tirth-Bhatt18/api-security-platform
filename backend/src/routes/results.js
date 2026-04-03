const express = require('express');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * Get results for a specific scan
 * GET /results?scanId=1
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { scanId } = req.query;

    if (!scanId) {
      return res.status(400).json({ error: 'scanId parameter is required' });
    }

    // Verify scan belongs to user
    const scan = await db.queryOne(
      'SELECT user_id FROM scans WHERE id = $1',
      [scanId]
    );

    if (!scan || scan.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Get results
    const results = await db.queryAll(
      `SELECT id, endpoint, method, vulnerability, severity, details, evidence, created_at 
       FROM results 
       WHERE scan_id = $1 
       ORDER BY severity DESC, created_at DESC`,
      [scanId]
    );

    // Aggregate statistics
    const stats = await db.queryOne(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low
       FROM results 
       WHERE scan_id = $1`,
      [scanId]
    );

    res.json({
      scan_id: scanId,
      results,
      statistics: {
        total: parseInt(stats.total),
        by_severity: {
          critical: parseInt(stats.critical) || 0,
          high: parseInt(stats.high) || 0,
          medium: parseInt(stats.medium) || 0,
          low: parseInt(stats.low) || 0,
        },
      },
    });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'Failed to retrieve results' });
  }
});

/**
 * Get detailed result
 * GET /results/:resultId
 */
router.get('/:resultId', authMiddleware, async (req, res) => {
  try {
    const { resultId } = req.params;

    // Get result and verify scan belongs to user
    const result = await db.queryOne(
      `SELECT r.id, r.scan_id, r.endpoint, r.method, r.vulnerability, r.severity, r.details, r.evidence, r.created_at
       FROM results r
       JOIN scans s ON r.scan_id = s.id
       WHERE r.id = $1 AND s.user_id = $2`,
      [resultId, req.user.id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json({ result });
  } catch (err) {
    console.error('Get result error:', err);
    res.status(500).json({ error: 'Failed to retrieve result' });
  }
});

module.exports = router;
