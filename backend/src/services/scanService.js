const axios = require('axios');
const db = require('../db/connection');

const PYTHON_SCANNER_URL = process.env.PYTHON_SCANNER_URL || 'http://localhost:8000';

/**
 * Send scan job to Python scanning engine
 */
async function sendScanToPython(scanId, requests, userId) {
  try {
    // Update scan status to running
    await db.query(
      'UPDATE scans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['running', scanId]
    );

    const payload = {
      scan_id: scanId,
      user_id: userId,
      requests,
      request_count: requests.length,
    };

    console.log(`Sending scan ${scanId} to Python scanner at ${PYTHON_SCANNER_URL}`);

    // Send to Python scanner
    const response = await axios.post(
      `${PYTHON_SCANNER_URL}/scan`,
      payload,
      {
        timeout: 300000, // 5 minutes timeout
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Scan ${scanId} submitted to Python scanner`);

    return response.data;
  } catch (err) {
    console.error(`Error sending scan ${scanId} to Python scanner:`, err.message);

    // Update scan status to failed
    await db.query(
      'UPDATE scans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['failed', scanId]
    );

    throw err;
  }
}

/**
 * Process scan results from Python scanner
 * Called by Python via webhook or polling
 */
async function storeScanResults(scanId, results = []) {
  try {
    // Verify scan exists
    const scan = await db.queryOne('SELECT id FROM scans WHERE id = $1', [scanId]);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    // Store results
    for (const result of results) {
      await db.query(
        `INSERT INTO results (scan_id, endpoint, method, vulnerability, severity, details, evidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          scanId,
          result.endpoint,
          result.method || 'UNKNOWN',
          result.vulnerability,
          result.severity,
          JSON.stringify(result.details || {}),
          result.evidence || null,
        ]
      );
    }

    // Update scan status to completed
    await db.query(
      'UPDATE scans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', scanId]
    );

    console.log(`Stored ${results.length} results for scan ${scanId}`);
  } catch (err) {
    console.error(`Error storing results for scan ${scanId}:`, err);

    // Update scan status to failed
    await db.query(
      'UPDATE scans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['failed', scanId]
    );

    throw err;
  }
}

module.exports = {
  sendScanToPython,
  storeScanResults,
};
