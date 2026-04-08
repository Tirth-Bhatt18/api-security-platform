import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import UploadScanPage from './pages/UploadScanPage';
import ScanDetailsPage from './pages/ScanDetailsPage';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import { useAuth } from './hooks/useAuth';

function App() {
  const { token } = useAuth();

  return (
    <div className="app-shell">
      <Navbar />
      <main className={token ? 'page with-nav' : 'page'}>
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
          <Route path="/register" element={token ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/scan/new"
            element={
              <ProtectedRoute>
                <UploadScanPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/scans/:scanId"
            element={
              <ProtectedRoute>
                <ScanDetailsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
