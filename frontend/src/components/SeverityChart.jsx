const ORDER = ['critical', 'high', 'medium', 'low'];

function SeverityChart({ statistics }) {
  const bySeverity = statistics?.by_severity || {};
  const values = ORDER.map((key) => ({ key, value: Number(bySeverity[key] || 0) }));
  const maxValue = Math.max(1, ...values.map((entry) => entry.value));

  return (
    <section className="card">
      <h3>Severity Distribution</h3>
      <div className="chart-grid">
        {values.map((entry) => (
          <div key={entry.key} className="chart-row">
            <span className="chart-label">{entry.key}</span>
            <div className="chart-bar-wrap">
              <div
                className={`chart-bar chart-${entry.key}`}
                style={{ width: `${(entry.value / maxValue) * 100}%` }}
              />
            </div>
            <span className="chart-value">{entry.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SeverityChart;
