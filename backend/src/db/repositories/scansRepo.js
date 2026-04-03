const db = require('../connection');
const SQL = require('../sqlQueries');

async function createScan(userId, collectionName, endpointsCount) {
  const result = await db.query(SQL.scans.create, [userId, 'pending', collectionName, endpointsCount]);
  return result.rows[0];
}

async function updateScanStatus(scanId, status) {
  await db.query(SQL.scans.updateStatus, [status, scanId]);
}

async function getScansByUser(userId) {
  return db.queryAll(SQL.scans.byUser, [userId]);
}

async function getScanById(scanId) {
  return db.queryOne(SQL.scans.byId, [scanId]);
}

async function getActiveScanCountByUser(userId) {
  const row = await db.queryOne(SQL.scans.activeByUserCount, [userId]);
  return row?.count || 0;
}

module.exports = {
  createScan,
  updateScanStatus,
  getScansByUser,
  getScanById,
  getActiveScanCountByUser,
};
