import type { Achievement } from '../api/schemas'
import styles from '../styles/AchievementsPage.module.css'

interface Props {
  achievements: Achievement[]
}

export function AchievementsContent({ achievements }: Props) {
  return (
    <div>
      <h2>Achievements</h2>
      {achievements.length === 0 ? (
        <p>No achievements available yet.</p>
      ) : (
        <ul className={styles.grid} role="list">
          {achievements.map((achievement) => {
            const isUnlocked = achievement.unlockedAt !== null
            return (
              <li
                key={achievement.slug}
                className={`${styles.card} ${isUnlocked ? '' : styles.cardLocked}`}
              >
                <div className={styles.badge} aria-hidden="true">
                  {isUnlocked ? '\uD83C\uDFC6' : '\uD83D\uDD12'}
                </div>
                <h3 className={styles.cardTitle}>{achievement.name}</h3>
                <p className={styles.cardDescription}>{achievement.description}</p>
                {isUnlocked ? (
                  <p className={styles.unlockDate}>
                    Unlocked {new Date(achievement.unlockedAt!).toLocaleDateString()}
                  </p>
                ) : (
                  <p className={styles.lockedLabel}>Locked</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
