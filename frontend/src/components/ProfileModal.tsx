import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDialog } from '../hooks/useDialog'
import { queryKeys } from '../api/queryKeys'
import { getUserProfile } from '../api/social'
import { formatWeight } from '../utils/weight'
import styles from './ProfileModal.module.css'

export function ProfileModal({
  username,
  onClose,
}: {
  username: string | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useDialog(dialogRef, username !== null, onClose)

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.social.profile(username ?? ''),
    queryFn: () => getUserProfile(username as string),
    enabled: username !== null,
  })

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="User profile"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className={styles.content} data-testid="profile-modal">
        {isLoading && <p className={styles.muted}>Loading…</p>}
        {isError && <p className={styles.muted}>Could not load this profile.</p>}
        {data && (
          <>
            <h2 className={styles.name}>
              {data.username}
              {data.isSelf && <span className={styles.self}> (you)</span>}
            </h2>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.value}>{data.totalWorkouts}</span>
                <span className={styles.label}>workouts</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.value}>
                  <span aria-hidden="true">🔥 </span>
                  {data.currentStreak}
                </span>
                <span className={styles.label}>day streak</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.value}>{data.achievementCount}</span>
                <span className={styles.label}>badges</span>
              </div>
            </div>
            {data.topPRs.length > 0 && (
              <div className={styles.prs}>
                <h3 className={styles.prTitle}>Top lifts</h3>
                <ul className={styles.prList}>
                  {data.topPRs.map((pr) => (
                    <li key={pr.exercise} className={styles.prItem}>
                      <span>{pr.exercise}</span>
                      <span className={styles.prValue}>{formatWeight(pr.e1rm)} e1RM</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  )
}
