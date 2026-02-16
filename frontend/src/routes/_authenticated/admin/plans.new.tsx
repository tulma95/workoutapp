import { createFileRoute } from '@tanstack/react-router'
import PlanEditorPage from '../../../pages/admin/PlanEditorPage'

export const Route = createFileRoute('/_authenticated/admin/plans/new')({
  component: () => <PlanEditorPage />,
})
