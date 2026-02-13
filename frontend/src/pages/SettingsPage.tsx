import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../api/client';
import { getCurrentPlan, type WorkoutPlan } from '../api/plans';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { UnitPreference } from '../types';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [unit, setUnit] = useState<UnitPreference>(user?.unitPreference || 'kg');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentPlan, setCurrentPlan] = useState<WorkoutPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    loadCurrentPlan();
  }, []);

  async function loadCurrentPlan() {
    setPlanLoading(true);
    try {
      const plan = await getCurrentPlan();
      setCurrentPlan(plan);
    } catch (err) {
      console.error('Failed to load current plan:', err);
      // Not showing error here as having no plan is a valid state
    } finally {
      setPlanLoading(false);
    }
  }

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
        <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Current Plan</p>
        {planLoading ? (
          <LoadingSpinner size={24} />
        ) : currentPlan ? (
          <>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{currentPlan.name}</p>
            {currentPlan.description && (
              <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '14px' }}>
                {currentPlan.description}
              </p>
            )}
            <button
              className="btn-secondary"
              onClick={() => navigate('/select-plan')}
              style={{ marginTop: '8px' }}
            >
              Change Plan
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No plan selected
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/select-plan')}
            >
              Browse Plans
            </button>
          </>
        )}
      </div>

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
