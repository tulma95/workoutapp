import { Link } from '@tanstack/react-router'
import { type AdminPlanListItem } from '../../api/adminPlans'
import { ConfirmDialog } from '../ConfirmDialog'
import styles from '../../styles/PlanListPage.module.css'

interface Props {
  plans: AdminPlanListItem[]
  archiving: { id: number; name: string } | null
  alertMessage: string | null
  onArchive: (plan: { id: number; name: string }) => void
  onDoArchive: () => void
  onCancelArchive: () => void
  onDismissAlert: () => void
}

function getStatusBadge(plan: AdminPlanListItem, styles: Record<string, string>) {
  if (plan.archivedAt) {
    return <span className={`${styles.badge} ${styles.badgeArchived}`}>Archived</span>
  }
  if (!plan.isPublic) {
    return <span className={`${styles.badge} ${styles.badgeDraft}`}>Draft</span>
  }
  return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
}

export function PlanListContent({
  plans,
  archiving,
  alertMessage,
  onArchive,
  onDoArchive,
  onCancelArchive,
  onDismissAlert,
}: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Workout Plans</h2>
        <Link to="/admin/plans/new" className={styles.createBtn}>
          Create Plan
        </Link>
      </div>

      {plans.length === 0 && (
        <div className={styles.empty}>
          <p>No plans found. Create your first workout plan to get started.</p>
        </div>
      )}

      <div className={styles.list}>
        {plans.map((plan) => (
          <div key={plan.id} className={styles.card}>
            <Link to="/admin/plans/$id" params={{ id: String(plan.id) }} className={styles.cardLink}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{plan.name}</h3>
                <div className={styles.cardBadges}>
                  {plan.isSystem && (
                    <span className={`${styles.badge} ${styles.badgeSystem}`}>System</span>
                  )}
                  {getStatusBadge(plan, styles)}
                </div>
              </div>

              <div className={styles.cardMeta}>
                <span className={styles.cardDays}>{plan.daysPerWeek} days/week</span>
                <span className={styles.cardSubscribers}>
                  {plan.subscriberCount} {plan.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                </span>
              </div>

              {plan.description && (
                <p className={styles.cardDescription}>{plan.description}</p>
              )}
            </Link>

            {!plan.isSystem && (
              <div className={styles.cardActions}>
                <button
                  className={styles.archiveBtn}
                  onClick={(e) => {
                    e.preventDefault()
                    onArchive({ id: plan.id, name: plan.name })
                  }}
                >
                  Archive
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={archiving !== null}
        title="Archive Plan"
        message={`Are you sure you want to archive "${archiving?.name}"? Users subscribed to this plan will lose access.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={onDoArchive}
        onCancel={onCancelArchive}
      />

      <ConfirmDialog
        open={alertMessage !== null}
        title="Error"
        message={alertMessage || ''}
        confirmLabel="OK"
        showCancel={false}
        onConfirm={onDismissAlert}
        onCancel={onDismissAlert}
      />
    </div>
  )
}
