import { useState, useRef, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, updateMe } from '../../../api/user'
import { useAuth } from '../../../context/useAuth'
import { getCurrentPlan } from '../../../api/plans'
import { getTrainingMaxes, updateTrainingMax, type TrainingMax } from '../../../api/trainingMaxes'
import { formatExerciseName, formatWeight, convertWeight, roundWeight, convertToKg } from '../../../utils/weight'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ErrorMessage } from '../../../components/ErrorMessage'
import type { UnitPreference } from '../../../types'
import styles from '../../../styles/SettingsPage.module.css'
import shared from '../../../styles/shared.module.css'

export const Route = createFileRoute('/_authenticated/_layout/settings')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({ queryKey: ['user', 'me'], queryFn: getMe }),
      queryClient.ensureQueryData({ queryKey: ['plan', 'current'], queryFn: getCurrentPlan }),
      queryClient.ensureQueryData({ queryKey: ['training-maxes'], queryFn: getTrainingMaxes }),
    ]),
  pendingComponent: LoadingSpinner,
  component: SettingsPage,
})

function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()
  const { data: user } = useSuspenseQuery({ queryKey: ['user', 'me'], queryFn: getMe })
  const { data: currentPlan } = useSuspenseQuery({ queryKey: ['plan', 'current'], queryFn: getCurrentPlan })
  const { data: trainingMaxes } = useSuspenseQuery({ queryKey: ['training-maxes'], queryFn: getTrainingMaxes })

  const [unit, setUnit] = useState<UnitPreference>(user?.unitPreference || 'kg')
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingExercise, setEditingExercise] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [tmSaving, setTmSaving] = useState(false)
  const [tmError, setTmError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (editingExercise) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [editingExercise])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => closeEditModal()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [])

  async function handleUnitChange(newUnit: UnitPreference) {
    setUnit(newUnit)
    setSaved(false)
    setIsSaving(true)
    setError('')

    try {
      await updateMe({ unitPreference: newUnit })
      await queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
      setUnit(user?.unitPreference || 'kg')
    } finally {
      setIsSaving(false)
    }
  }

  function openEditModal(exercise: string, currentWeight: number) {
    setEditingExercise(exercise)
    const weightInUserUnit = roundWeight(convertWeight(currentWeight, unit), unit)
    setEditValue(weightInUserUnit.toString())
    setTmError('')
  }

  function closeEditModal() {
    setEditingExercise(null)
    setEditValue('')
    setTmError('')
  }

  async function handleTmSave() {
    if (!editingExercise) return

    const weightInUserUnit = parseFloat(editValue)
    if (isNaN(weightInUserUnit) || weightInUserUnit <= 0) {
      setTmError('Please enter a valid positive number')
      return
    }

    setTmSaving(true)
    setTmError('')

    try {
      const weightInKg = convertToKg(weightInUserUnit, unit)
      await updateTrainingMax(editingExercise, weightInKg)
      await queryClient.invalidateQueries({ queryKey: ['training-maxes'] })
      closeEditModal()
    } catch (err) {
      setTmError(err instanceof Error ? err.message : 'Failed to update training max')
    } finally {
      setTmSaving(false)
    }
  }

  function handleLogout() {
    logout()
    queryClient.clear()
    navigate({ to: '/login' })
  }

  return (
    <div>
      <h2>Settings</h2>

      <div className={styles.card}>
        <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Current Plan</p>
        {currentPlan ? (
          <>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{currentPlan.name}</p>
            {currentPlan.description && (
              <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '14px' }}>
                {currentPlan.description}
              </p>
            )}
            <button
              className={shared.btnSecondary}
              onClick={() => navigate({ to: '/select-plan' })}
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
              className={shared.btnPrimary}
              onClick={() => navigate({ to: '/select-plan' })}
            >
              Browse Plans
            </button>
          </>
        )}
      </div>

      <div className={styles.card}>
        <p style={{ margin: '0 0 4px', color: 'var(--text-muted)', fontSize: '14px' }}>Display Name</p>
        <p style={{ margin: '0', fontWeight: 600 }}>{user?.displayName}</p>
      </div>

      <div className={styles.card}>
        <p style={{ margin: '0 0 4px', color: 'var(--text-muted)', fontSize: '14px' }}>Email</p>
        <p style={{ margin: '0', fontWeight: 600 }}>{user?.email}</p>
      </div>

      <div className={styles.card}>
        <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Unit Preference</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={unit === 'kg' ? shared.btnPrimary : shared.btnSecondary}
            style={{ flex: 1 }}
            onClick={() => handleUnitChange('kg')}
            disabled={isSaving}
          >
            kg
          </button>
          <button
            className={unit === 'lb' ? shared.btnPrimary : shared.btnSecondary}
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

      {trainingMaxes.length > 0 && (
        <section className={styles.tmSection}>
          <h3>Training Maxes</h3>
          <div className={styles.tmList}>
            {trainingMaxes.map((tm: TrainingMax) => (
              <div key={tm.exercise} className={styles.tmItem}>
                <div className={styles.tmInfo}>
                  <span className={styles.tmExercise}>{formatExerciseName(tm.exercise)}</span>
                  <span className={styles.tmWeight}>{formatWeight(tm.weight, unit)}</span>
                </div>
                <button
                  className={styles.editBtn}
                  onClick={() => openEditModal(tm.exercise, tm.weight)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <button className={shared.btnSecondary} style={{ color: 'var(--danger)' }} onClick={handleLogout}>
        Log Out
      </button>

      <dialog ref={dialogRef} className={styles.editDialog} onClick={(e) => { if (e.target === dialogRef.current) closeEditModal() }}>
        <div className={styles.editDialogContent}>
          <h3>Edit {editingExercise ? formatExerciseName(editingExercise) : ''}</h3>

          <div className={styles.editDialogBody}>
            <label htmlFor="tm-input">Training Max ({unit})</label>
            <input
              id="tm-input"
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              step="0.1"
              min="0"
              autoFocus
            />
            {tmError && <p className={styles.editDialogError} role="alert">{tmError}</p>}
          </div>

          <div className={styles.editDialogActions}>
            <button
              className={shared.btnSecondary}
              onClick={closeEditModal}
              disabled={tmSaving}
            >
              Cancel
            </button>
            <button
              className={shared.btnPrimary}
              onClick={handleTmSave}
              disabled={tmSaving}
            >
              {tmSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
