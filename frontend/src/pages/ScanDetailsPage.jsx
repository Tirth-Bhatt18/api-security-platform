import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import SeverityBadge from '../components/SeverityBadge';
import SeverityChart from '../components/SeverityChart';
import BackButton from '../components/BackButton';
import { getScanDetails } from '../services/api';

function ScanDetailsPage() {
  const { scanId } = useParams();
  const [scan, setScan] = useState(null);
  const [results, setResults] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [severityFilter, setSeverityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getScanDetails(scanId);
        setScan(data.scan);
        setResults(data.results || []);
        setStatistics(data.statistics || null);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load scan details.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [scanId]);

  const filteredResults = useMemo(() => {
    if (severityFilter === 'all') return results;
    return results.filter((result) => (result.severity || '').toLowerCase() === severityFilter);
  }, [results, severityFilter]);

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <p className="muted">Loading scan details...</p>;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  return (
    <section className="stack-lg">
      <div className="row-left">
        <BackButton fallbackTo="/dashboard" label="Back" />
      </div>

      <div className="hero-panel">
        <div>
          <p className="eyebrow">Scan Details</p>
          <h2>Scan #{scan?.id}</h2>
          <p className="muted">Status: {scan?.status || 'unknown'} | Endpoints: {scan?.endpoints_count ?? '-'}</p>
        </div>
      </div>

      <SeverityChart statistics={statistics} />

      <section className="card stack-md">
        <div className="row-split">
          <h3>Findings</h3>
          <label className="inline-filter">
            Severity
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </label>
        </div>

        {!filteredResults.length ? <p className="muted">No findings for selected filter.</p> : null}

        {filteredResults.map((result) => {
          const isExpanded = Boolean(expandedRows[result.id]);
          const risky = ['critical', 'high'].includes((result.severity || '').toLowerCase());

          return (
            <article key={result.id} className={`finding ${risky ? 'risky' : ''}`}>
              <button type="button" className="finding-head" onClick={() => toggleRow(result.id)}>
                <div>
                  <strong>{result.vulnerability}</strong>
                  <p className="muted mono">{result.endpoint}</p>
                </div>
                <div className="finding-meta">
                  <SeverityBadge severity={result.severity} />
                  <span className="inline-btn">{isExpanded ? 'Collapse' : 'Expand'}</span>
                </div>
              </button>

              {isExpanded ? (
                <div className="finding-body">
                  <h4>Explanation</h4>
                  <p>{result.explanation || 'No explanation provided.'}</p>

                  <h4>Recommended Fix</h4>
                  <p>{result.recommended_fix || 'No recommended fix provided.'}</p>

                  <h4>Evidence</h4>
                  <p>{result.evidence || 'No evidence provided.'}</p>

                  <div className="detail-metrics">
                    <span>Category: {(result.category || 'general').replace(/_/g, ' ')}</span>
                    <span>Confidence: {Math.round(Number(result.confidence || 0) * 100)}%</span>
                  </div>

                  <details className="raw-details">
                    <summary>View raw details</summary>
                    <pre>{JSON.stringify(result.details || {}, null, 2)}</pre>
                  </details>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </section>
  );
}

export default ScanDetailsPage;
