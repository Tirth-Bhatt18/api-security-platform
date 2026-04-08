import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <Link className="brand-wrap" to={isAuthenticated ? '/dashboard' : '/login'} aria-label="Go to home">
        <span className="brand-logo" aria-hidden="true">ASP</span>
        <div>
          <div className="brand-kicker">Defensive Ops</div>
          <h1>API Security Platform</h1>
        </div>
      </Link>

      <nav className="topnav">
        {isAuthenticated ? (
          <>
            <Link className={pathname === '/dashboard' ? 'active' : ''} to="/dashboard">
              Scans
            </Link>
            <Link className={pathname === '/scan/new' ? 'active' : ''} to="/scan/new">
              Start Scan
            </Link>
          </>
        ) : (
          <>
            <Link className={pathname === '/login' ? 'active' : ''} to="/login">
              Login
            </Link>
            <Link className={pathname === '/register' ? 'active' : ''} to="/register">
              Register
            </Link>
          </>
        )}
      </nav>

      {isAuthenticated ? (
        <button className="ghost-btn" onClick={handleLogout} type="button">
          Logout
        </button>
      ) : <span />}
    </header>
  );
}

export default Navbar;
