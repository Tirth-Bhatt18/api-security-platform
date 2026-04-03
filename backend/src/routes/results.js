const express = require('express');
const scansRepo = require('../db/repositories/scansRepo');
const resultsRepo = require('../db/repositories/resultsRepo');
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
    const scan = await scansRepo.getScanById(scanId);

    if (!scan || scan.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Get results
    const results = await resultsRepo.getResultsByScan(scanId);

    // Aggregate statistics
    const stats = await resultsRepo.getResultStatsByScan(scanId);

    res.json({
      scan_id: scanId,
      results,
      statistics: {
        total: Number(stats.total || 0),
        by_severity: {
          critical: Number(stats.critical || 0),
          high: Number(stats.high || 0),
          medium: Number(stats.medium || 0),
          low: Number(stats.low || 0),
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
    const result = await resultsRepo.getResultByIdForUser(resultId, req.user.id);

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
