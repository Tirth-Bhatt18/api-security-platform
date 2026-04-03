const SQL = {
  users: {
    create: 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
    byEmail: 'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
  },
  scans: {
    create: 'INSERT INTO scans (user_id, status, collection_name, endpoints_count) VALUES ($1, $2, $3, $4) RETURNING id, status, created_at',
    updateStatus: 'UPDATE scans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    byUser: 'SELECT id, status, collection_name, endpoints_count, created_at, updated_at FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    byId: 'SELECT id, user_id, status, collection_name, endpoints_count, created_at, updated_at FROM scans WHERE id = $1',
    activeByUserCount: "SELECT COUNT(*)::int AS count FROM scans WHERE user_id = $1 AND status IN ('pending', 'running')",
  },
  results: {
    create: 'INSERT INTO results (scan_id, endpoint, method, vulnerability, severity, details, evidence) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    byScan: `SELECT id, endpoint, method, vulnerability, severity, details, evidence, created_at FROM results WHERE scan_id = $1 ORDER BY severity DESC, created_at DESC`,
    countByScan: 'SELECT COUNT(*)::int AS count FROM results WHERE scan_id = $1',
    statsByScan: `SELECT COUNT(*)::int as total, SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END)::int as critical, SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END)::int as high, SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END)::int as medium, SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END)::int as low FROM results WHERE scan_id = $1`,
    byIdForUser: `SELECT r.id, r.scan_id, r.endpoint, r.method, r.vulnerability, r.severity, r.details, r.evidence, r.created_at FROM results r JOIN scans s ON r.scan_id = s.id WHERE r.id = $1 AND s.user_id = $2`,
  },
};

module.exports = SQL;
