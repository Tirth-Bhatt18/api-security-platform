const db = require('../connection');
const SQL = require('../sqlQueries');

async function createResult(scanId, endpoint, method, vulnerability, severity, details, evidence) {
  return db.query(SQL.results.create, [scanId, endpoint, method, vulnerability, severity, details || {}, evidence || null]);
}

async function getResultsByScan(scanId) {
  return db.queryAll(SQL.results.byScan, [scanId]);
}

async function getResultStatsByScan(scanId) {
  return db.queryOne(SQL.results.statsByScan, [scanId]);
}

async function getResultByIdForUser(resultId, userId) {
  return db.queryOne(SQL.results.byIdForUser, [resultId, userId]);
}

async function getResultCountByScan(scanId) {
  const row = await db.queryOne(SQL.results.countByScan, [scanId]);
  return row?.count || 0;
}

module.exports = {
  createResult,
  getResultsByScan,
  getResultStatsByScan,
  getResultByIdForUser,
  getResultCountByScan,
};
