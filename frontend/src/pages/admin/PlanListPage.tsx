import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminPlans, archivePlan, AdminPlanListItem } from '../../api/adminPlans';
import './PlanListPage.css';

export default function PlanListPage() {
  const [plans, setPlans] = useState<AdminPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!window.confirm(`Are you sure you want to archive "${planName}"? Users subscribed to this plan will lose access.`)) {
      return;
    }

    try {
      await archivePlan(planId);
      await loadPlans();
    } catch (error: any) {
      alert(error.message || 'Failed to archive plan');
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
    </div>
  );
}
