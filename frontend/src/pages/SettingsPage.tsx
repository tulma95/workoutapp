import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [unit, setUnit] = useState(user?.unitPreference || 'kg');
  const [saved, setSaved] = useState(false);

  async function handleUnitChange(newUnit: string) {
    setUnit(newUnit);
    setSaved(false);
    await apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ unitPreference: newUnit }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          >
            kg
          </button>
          <button
            className={unit === 'lb' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => handleUnitChange('lb')}
          >
            lb
          </button>
        </div>
        {saved && (
          <p style={{ color: 'var(--success)', margin: '8px 0 0', fontSize: '14px' }}>Saved!</p>
        )}
      </div>

      <button className="btn-secondary" style={{ color: 'var(--danger)' }} onClick={logout}>
        Log Out
      </button>
    </div>
  );
}
