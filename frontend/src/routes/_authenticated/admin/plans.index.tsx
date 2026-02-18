import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminPlans, archivePlan } from '../../../api/adminPlans'
import { PlanListContent } from '../../../components/admin/PlanListContent'

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

  function doArchive() {
    if (!archiving) return
    const { id } = archiving
    setArchiving(null)
    archiveMutation.mutate(id)
  }

  return (
    <PlanListContent
      plans={plans}
      archiving={archiving}
      alertMessage={alertMessage}
      onArchive={setArchiving}
      onDoArchive={doArchive}
      onCancelArchive={() => setArchiving(null)}
      onDismissAlert={() => setAlertMessage(null)}
    />
  )
}
