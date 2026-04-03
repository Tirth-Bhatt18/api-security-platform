const axios = require('axios');
const scansRepo = require('../db/repositories/scansRepo');
const resultsRepo = require('../db/repositories/resultsRepo');
const { enrichFindings } = require('./aiRiskService');

const PYTHON_SCANNER_URL = process.env.PYTHON_SCANNER_URL || 'http://localhost:8000';

/**
 * Send scan job to Python scanning engine
 */
async function sendScanToPython(scanId, requests, userId) {
  try {
    // Update scan status to running
    await scansRepo.updateScanStatus(scanId, 'running');

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

    // Persist findings returned by scanner service.
    const rawFindings = response?.data?.results || [];
    const findings = await enrichFindings(rawFindings);
    await storeScanResults(scanId, findings);

    return response.data;
  } catch (err) {
    console.error(`Error sending scan ${scanId} to Python scanner:`, err.message);

    // Update scan status to failed
    await scansRepo.updateScanStatus(scanId, 'failed');

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
    const scan = await scansRepo.getScanById(scanId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    // Store results
    for (const result of results) {
      await resultsRepo.createResult(
        scanId,
        result.endpoint,
        result.method || 'UNKNOWN',
        result.vulnerability,
        result.severity,
        result.details || {},
        result.evidence || null
      );
    }

    // Update scan status to completed
    await scansRepo.updateScanStatus(scanId, 'completed');

    console.log(`Stored ${results.length} results for scan ${scanId}`);
  } catch (err) {
    console.error(`Error storing results for scan ${scanId}:`, err);

    // Update scan status to failed
    await scansRepo.updateScanStatus(scanId, 'failed');

    throw err;
  }
}

module.exports = {
  sendScanToPython,
  storeScanResults,
};
