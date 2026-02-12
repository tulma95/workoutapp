import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { UnitPreference } from '../types';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [unit, setUnit] = useState<UnitPreference>(user?.unitPreference || 'kg');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleUnitChange(newUnit: UnitPreference) {
    setUnit(newUnit);
    setSaved(false);
    setIsSaving(true);
    setError('');

    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ unitPreference: newUnit }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      // Revert unit preference on error
      setUnit(user?.unitPreference || 'kg');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <h2>Settings</h2>

      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <p style={{ margin: '0 0 4px', color: 'var(--text-muted)', fontSize: '14px' }}>Display Name</p>
        <p style={{ margin: '0', fontWeight: 600 }}>{user?.displayName}</p>
      </div>

      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <p style={{ margin: '0 0 4px', color: 'var(--text-muted)', fontSize: '14px' }}>Email</p>
        <p style={{ margin: '0', fontWeight: 600 }}>{user?.email}</p>
      </div>

      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Unit Preference</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={unit === 'kg' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => handleUnitChange('kg')}
            disabled={isSaving}
          >
            kg
          </button>
          <button
            className={unit === 'lb' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => handleUnitChange('lb')}
            disabled={isSaving}
          >
            lb
          </button>
        </div>
        {isSaving && <LoadingSpinner size={24} />}
        {saved && (
          <p style={{ color: 'var(--success)', margin: '8px 0 0', fontSize: '14px' }}>Saved!</p>
        )}
        {error && <ErrorMessage message={error} />}
      </div>

      <button className="btn-secondary" style={{ color: 'var(--danger)' }} onClick={logout}>
        Log Out
      </button>
    </div>
  );
}
