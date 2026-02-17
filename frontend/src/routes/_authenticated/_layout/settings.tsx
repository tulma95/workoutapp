import { useState, useRef, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { getMe } from '../../../api/user'
import { useAuth } from '../../../context/useAuth'
import { getCurrentPlan } from '../../../api/plans'
import { getTrainingMaxes, updateTrainingMax, type TrainingMax } from '../../../api/trainingMaxes'
import { formatExerciseName, formatWeight, roundWeight } from '../../../utils/weight'
import { SkeletonLine, SkeletonHeading } from '../../../components/Skeleton'
import { Button } from '../../../components/Button'
import { ButtonLink } from '../../../components/ButtonLink'
import styles from '../../../styles/SettingsPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/settings')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({ queryKey: ['user', 'me'], queryFn: getMe }),
      queryClient.ensureQueryData({ queryKey: ['plan', 'current'], queryFn: getCurrentPlan }),
      queryClient.ensureQueryData({ queryKey: ['training-maxes'], queryFn: getTrainingMaxes }),
    ]),
  pendingComponent: () => (
    <div>
      <h2>Settings</h2>

      {[1, 2, 3].map((i) => (
        <div key={i} className={styles.card}>
          <SkeletonLine width="30%" height="0.875rem" />
          <SkeletonLine width="60%" height="1rem" />
        </div>
      ))}

      <section className={styles.tmSection}>
        <SkeletonHeading width="40%" />
        <div className={styles.tmList}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.tmItem}>
              <div className={styles.tmInfo}>
                <SkeletonLine width="8rem" height="1rem" />
                <SkeletonLine width="4rem" height="1rem" />
              </div>
              <SkeletonLine width="4rem" height="2.5rem" />
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
  component: SettingsPage,
})

function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()
  const { data: user } = useSuspenseQuery({ queryKey: ['user', 'me'], queryFn: getMe })
  const { data: currentPlan } = useSuspenseQuery({ queryKey: ['plan', 'current'], queryFn: getCurrentPlan })
  const { data: trainingMaxes } = useSuspenseQuery({ queryKey: ['training-maxes'], queryFn: getTrainingMaxes })

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

  function openEditModal(exercise: string, currentWeight: number) {
    setEditingExercise(exercise)
    const weightInUserUnit = roundWeight(currentWeight).toString()
    setEditValue(weightInUserUnit)
    setTmError('')
  }

  function closeEditModal() {
    setEditingExercise(null)
    setEditValue('')
    setTmError('')
  }

  async function handleTmSave() {
    if (!editingExercise) return

    const weightInKg = parseFloat(editValue)
    if (isNaN(weightInKg) || weightInKg <= 0) {
      setTmError('Please enter a valid positive number')
      return
    }

    setTmSaving(true)
    setTmError('')

    try {
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
            <ButtonLink
              variant="secondary"
              to="/select-plan"
              style={{ marginTop: '8px' }}
            >
              Change Plan
            </ButtonLink>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No plan selected
            </p>
            <ButtonLink
              to="/select-plan"
            >
              Browse Plans
            </ButtonLink>
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

      {trainingMaxes.length > 0 && (
        <section className={styles.tmSection}>
          <h3>Training Maxes</h3>
          <div className={styles.tmList}>
            {trainingMaxes.map((tm: TrainingMax) => (
              <div key={tm.exercise} className={styles.tmItem} data-testid="tm-item">
                <div className={styles.tmInfo}>
                  <span className={styles.tmExercise}>{formatExerciseName(tm.exercise)}</span>
                  <span className={styles.tmWeight}>{formatWeight(tm.weight)}</span>
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

      <Button variant="secondary" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
        Log Out
      </Button>

      <dialog ref={dialogRef} className={styles.editDialog} onClick={(e) => { if (e.target === dialogRef.current) closeEditModal() }}>
        <div className={styles.editDialogContent}>
          <h3>Edit {editingExercise ? formatExerciseName(editingExercise) : ''}</h3>

          <div className={styles.editDialogBody}>
            <label htmlFor="tm-input">Training Max (kg)</label>
            <input
              id="tm-input"
              type="number"
              inputMode="decimal"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              step="0.1"
              min="0"
              autoFocus
            />
            {tmError && <p className={styles.editDialogError} role="alert">{tmError}</p>}
          </div>

          <div className={styles.editDialogActions}>
            <Button
              variant="secondary"
              onClick={closeEditModal}
              disabled={tmSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTmSave}
              disabled={tmSaving}
            >
              {tmSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
