import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { getAdminPlans, archivePlan, AdminPlanListItem } from '../../api/adminPlans';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './PlanListPage.css';

export default function PlanListPage() {
  const [plans, setPlans] = useState<AdminPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState<{ id: number; name: string } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const data = await getAdminPlans();
      setPlans(data);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(planId: number, planName: string) {
    setArchiving({ id: planId, name: planName });
  }

  async function doArchive() {
    if (!archiving) return;
    const { id } = archiving;
    setArchiving(null);

    try {
      await archivePlan(id);
      await loadPlans();
    } catch (error: any) {
      setAlertMessage(error.message || 'Failed to archive plan');
    }
  }

  function getStatusBadge(plan: AdminPlanListItem) {
    if (plan.archivedAt) {
      return <span className="plan-status-badge plan-status-badge--archived">Archived</span>;
    }
    if (!plan.isPublic) {
      return <span className="plan-status-badge plan-status-badge--draft">Draft</span>;
    }
    return <span className="plan-status-badge plan-status-badge--active">Active</span>;
  }

  if (loading) {
    return <div className="plan-list-loading">Loading plans...</div>;
  }

  return (
    <div className="plan-list-page">
      <div className="plan-list-header">
        <h2>Workout Plans</h2>
        <Link to="/admin/plans/new" className="btn-create-plan">
          Create Plan
        </Link>
      </div>

      {plans.length === 0 && (
        <div className="plan-list-empty">
          <p>No plans found. Create your first workout plan to get started.</p>
        </div>
      )}

      <div className="plan-list">
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card">
            <Link to={`/admin/plans/${plan.id}`} className="plan-card-link">
              <div className="plan-card-header">
                <h3 className="plan-card-title">{plan.name}</h3>
                <div className="plan-card-badges">
                  {plan.isSystem && (
                    <span className="plan-status-badge plan-status-badge--system">System</span>
                  )}
                  {getStatusBadge(plan)}
                </div>
              </div>

              <div className="plan-card-meta">
                <span className="plan-card-days">{plan.daysPerWeek} days/week</span>
                <span className="plan-card-subscribers">
                  {plan.subscriberCount} {plan.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                </span>
              </div>

              {plan.description && (
                <p className="plan-card-description">{plan.description}</p>
              )}
            </Link>

            {!plan.isSystem && (
              <div className="plan-card-actions">
                <button
                  className="btn-archive"
                  onClick={(e) => {
                    e.preventDefault();
                    handleArchive(plan.id, plan.name);
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
  );
}
