import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminPlans, archivePlan, type AdminPlanListItem } from '../../../api/adminPlans'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import styles from '../../../styles/PlanListPage.module.css'

export const Route = createFileRoute('/_authenticated/admin/plans/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: ['admin-plans'],
      queryFn: getAdminPlans,
    }),
  component: PlanListPage,
})

function PlanListPage() {
  const queryClient = useQueryClient()
  const { data: plans } = useSuspenseQuery({
    queryKey: ['admin-plans'],
    queryFn: getAdminPlans,
  })

  const [archiving, setArchiving] = useState<{ id: number; name: string } | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const archiveMutation = useMutation({
    mutationFn: archivePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
    },
    onError: (error: any) => {
      setAlertMessage(error.message || 'Failed to archive plan')
    },
  })

  async function doArchive() {
    if (!archiving) return
    const { id } = archiving
    setArchiving(null)
    archiveMutation.mutate(id)
  }

  function getStatusBadge(plan: AdminPlanListItem) {
    if (plan.archivedAt) {
      return <span className={`${styles.badge} ${styles.badgeArchived}`}>Archived</span>
    }
    if (!plan.isPublic) {
      return <span className={`${styles.badge} ${styles.badgeDraft}`}>Draft</span>
    }
    return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
  }

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
                  {getStatusBadge(plan)}
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
                    setArchiving({ id: plan.id, name: plan.name })
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
        onConfirm={doArchive}
        onCancel={() => setArchiving(null)}
      />

      <ConfirmDialog
        open={alertMessage !== null}
        title="Error"
        message={alertMessage || ''}
        confirmLabel="OK"
        showCancel={false}
        onConfirm={() => setAlertMessage(null)}
        onCancel={() => setAlertMessage(null)}
      />
    </div>
  )
}
