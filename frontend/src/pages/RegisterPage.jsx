import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/api';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register({ email, password });
      navigate('/login');
    } catch (err) {
      setError(err?.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">API Risk Console</p>
        <h2>Create account</h2>
        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} minLength={8} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirm} minLength={8} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button disabled={loading} className="solid-btn" type="submit">
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        <p className="muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}

export default RegisterPage;
