import { WorkoutPlan } from './plans';

export interface AdminPlanListItem extends WorkoutPlan {
  subscriberCount: number;
}

export async function getAdminPlans(): Promise<AdminPlanListItem[]> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('/api/admin/plans', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch admin plans');
  }

  return response.json();
}

export async function archivePlan(planId: number): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/admin/plans/${planId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to archive plan');
  }
}
