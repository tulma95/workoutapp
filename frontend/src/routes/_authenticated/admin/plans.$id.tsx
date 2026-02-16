import { createFileRoute } from '@tanstack/react-router'
import PlanEditorPage from '../../../pages/admin/PlanEditorPage'

export const Route = createFileRoute('/_authenticated/admin/plans/$id')({
  component: PlanEditorRoute,
})

function PlanEditorRoute() {
  const { id } = Route.useParams()
  return <PlanEditorPage planId={id} />
}
