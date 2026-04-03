import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ScanTable from '../components/ScanTable';
import { getScans } from '../services/api';

function DashboardPage() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    return scans.reduce(
      (acc, item) => {
        const status = item.status || 'pending';
        acc.total += 1;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { total: 0, pending: 0, running: 0, completed: 0, failed: 0 }
    );
  }, [scans]);

  useEffect(() => {
    async function loadScans() {
      try {
        const response = await getScans();
        setScans(response.scans || []);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load scans.');
      } finally {
        setLoading(false);
      }
    }

    loadScans();
  }, []);

  return (
    <section className="stack-lg">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Security Operations</p>
          <h2>Scan Dashboard</h2>
          <p className="muted">Track active scans and inspect findings by severity and endpoint.</p>
        </div>
        <Link className="solid-btn" to="/scan/new">
          Start New Scan
        </Link>
      </div>

      <div className="stats-grid">
        <article className="stat-card"><h4>Total</h4><strong>{summary.total}</strong></article>
        <article className="stat-card"><h4>Pending</h4><strong>{summary.pending}</strong></article>
        <article className="stat-card"><h4>Running</h4><strong>{summary.running}</strong></article>
        <article className="stat-card"><h4>Completed</h4><strong>{summary.completed}</strong></article>
        <article className="stat-card"><h4>Failed</h4><strong>{summary.failed}</strong></article>
      </div>

      {loading ? <p className="muted">Loading scans...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {!loading && !error ? <ScanTable scans={scans} /> : null}
    </section>
  );
}

export default DashboardPage;
