import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';
import type { UnitPreference } from '../types';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [unitPreference, setUnitPreference] = useState<UnitPreference>('kg');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setPasswordError('');
    setLoading(true);
    try {
      await register(email, password, displayName, unitPreference);
      navigate('/');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'error' in err
        ? (err as { error: { message: string } }).error.message
        : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: '48px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '32px' }}>Create Account</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => {
              if (password.length > 0 && password.length < 8) {
                setPasswordError('Password must be at least 8 characters');
              } else {
                setPasswordError('');
              }
            }}
            required
          />
          {passwordError && (
            <p style={{ color: 'var(--danger)', margin: '4px 0 0', fontSize: '14px' }}>{passwordError}</p>
          )}
        </div>

        <div>
          <label htmlFor="displayName" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <span style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Unit Preference</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="unitPreference"
                value="kg"
                checked={unitPreference === 'kg'}
                onChange={() => setUnitPreference('kg')}
              />
              kg
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="unitPreference"
                value="lb"
                checked={unitPreference === 'lb'}
                onChange={() => setUnitPreference('lb')}
              />
              lb
            </label>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
