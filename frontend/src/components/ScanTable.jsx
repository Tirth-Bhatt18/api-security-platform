import { Link } from 'react-router-dom';
import { formatDate } from '../utils/format';

function ScanTable({ scans }) {
  if (!scans?.length) {
    return <p className="muted">No scans yet. Start your first scan from the Start Scan page.</p>;
  }

  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Scan ID</th>
            <th>Status</th>
            <th>Collection</th>
            <th>Endpoints</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => (
            <tr key={scan.id}>
              <td>#{scan.id}</td>
              <td>
                <span className={`status-pill status-${scan.status}`}>{scan.status}</span>
              </td>
              <td>{scan.collection_name || '-'}</td>
              <td>{scan.endpoints_count ?? '-'}</td>
              <td>{formatDate(scan.created_at)}</td>
              <td>
                <Link className="inline-btn" to={`/scans/${scan.id}`}>
                  View Details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScanTable;
