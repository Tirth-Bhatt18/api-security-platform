import { normalizeSeverity } from '../utils/format';

function SeverityBadge({ severity }) {
  const level = normalizeSeverity(severity);
  return <span className={`sev-badge sev-${level}`}>{level}</span>;
}

export default SeverityBadge;
