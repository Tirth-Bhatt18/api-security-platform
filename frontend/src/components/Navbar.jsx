import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-kicker">Defensive Ops</div>
        <h1>API Security Platform</h1>
      </div>

      <nav className="topnav">
        <Link className={pathname === '/dashboard' ? 'active' : ''} to="/dashboard">
          Scans
        </Link>
        <Link className={pathname === '/scan/new' ? 'active' : ''} to="/scan/new">
          Start Scan
        </Link>
      </nav>

      <button className="ghost-btn" onClick={handleLogout} type="button">
        Logout
      </button>
    </header>
  );
}

export default Navbar;
