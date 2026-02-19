import { useState, useRef, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe } from '../../../api/user'
import { useAuth } from '../../../context/useAuth'
import { getCurrentPlan } from '../../../api/plans'
import { getTrainingMaxes, updateTrainingMax } from '../../../api/trainingMaxes'
import { getSchedule, saveSchedule, type ScheduleEntry } from '../../../api/schedule'
import { roundWeight } from '../../../utils/weight'
import { getRestTimerSettings, saveRestTimerSettings, type RestTimerSettings } from '../../../utils/restTimerSettings'
import { SkeletonLine, SkeletonHeading } from '../../../components/Skeleton'
import { SettingsContent } from '../../../components/SettingsContent'
import styles from '../../../styles/SettingsPage.module.css'

export const Route = createFileRoute('/_authenticated/_layout/settings')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({ queryKey: ['user', 'me'], queryFn: getMe }),
      queryClient.ensureQueryData({
        queryKey: ['plan', 'current'],
        queryFn: getCurrentPlan,
      }),
      queryClient.ensureQueryData({
        queryKey: ['training-maxes'],
        queryFn: getTrainingMaxes,
      }),
      queryClient.ensureQueryData({
        queryKey: ['schedule'],
        queryFn: getSchedule,
      }),
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

      <div className={styles.card}>
        <SkeletonLine width="40%" height="0.875rem" />
        <SkeletonLine width="70%" height="0.75rem" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.tmItem}>
            <SkeletonLine width="8rem" height="1rem" />
            <SkeletonLine width="7rem" height="2.75rem" />
          </div>
        ))}
      </div>
    </div>
  ),
  component: SettingsPage,
})

function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', 'me'],
    queryFn: getMe,
  })
  const { data: currentPlan } = useSuspenseQuery({
    queryKey: ['plan', 'current'],
    queryFn: getCurrentPlan,
  })
  const { data: trainingMaxes } = useSuspenseQuery({
    queryKey: ['training-maxes'],
    queryFn: getTrainingMaxes,
  })
  const { data: schedule } = useQuery({
    queryKey: ['schedule'],
    queryFn: getSchedule,
  })

  const scheduleMutation = useMutation({
    mutationFn: saveSchedule,
    onSuccess: (data) => {
      queryClient.setQueryData(['schedule'], data)
    },
  })

  const [restTimerSettings, setRestTimerSettings] = useState<RestTimerSettings>(getRestTimerSettings)
  const [editingExercise, setEditingExercise] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
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

  const handleRestTimerChange = (updates: Partial<RestTimerSettings>) => {
    setRestTimerSettings(prev => {
      const next = { ...prev, ...updates }
      saveRestTimerSettings(next)
      return next
    })
  }

  function openEditModal(exercise: string, currentWeight: number) {
    setEditingExercise(exercise)
    const weightInUserUnit = roundWeight(currentWeight).toString()
    setEditValue(weightInUserUnit)
    setEditReason('')
    setTmError('')
  }

  function closeEditModal() {
    setEditingExercise(null)
    setEditValue('')
    setEditReason('')
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
      await updateTrainingMax(editingExercise, weightInKg, editReason.trim() || undefined)
      await queryClient.invalidateQueries({ queryKey: ['training-maxes'] })
      await queryClient.invalidateQueries({ queryKey: ['progress'] })
      closeEditModal()
    } catch (err) {
      setTmError(
        err instanceof Error ? err.message : 'Failed to update training max',
      )
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
    <SettingsContent
      user={user}
      currentPlan={currentPlan}
      trainingMaxes={trainingMaxes}
      editingExercise={editingExercise}
      editValue={editValue}
      editReason={editReason}
      tmSaving={tmSaving}
      tmError={tmError}
      dialogRef={dialogRef}
      onOpenEditModal={openEditModal}
      onCloseEditModal={closeEditModal}
      onEditValueChange={setEditValue}
      onEditReasonChange={setEditReason}
      onTmSave={handleTmSave}
      onLogout={handleLogout}
      restTimerSettings={restTimerSettings}
      onRestTimerChange={handleRestTimerChange}
      planDays={currentPlan?.days.map((d) => ({ dayNumber: d.dayNumber, name: d.name })) ?? undefined}
      schedule={schedule}
      onScheduleSave={async (s: ScheduleEntry[]) => { await scheduleMutation.mutateAsync(s) }}
      isScheduleSaving={scheduleMutation.isPending}
    />
  )
}
