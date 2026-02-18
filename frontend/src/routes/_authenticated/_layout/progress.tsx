import { createFileRoute } from '@tanstack/react-router'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { ProgressContent } from '../../../components/ProgressContent'

export const Route = createFileRoute('/_authenticated/_layout/progress')({
  pendingComponent: LoadingSpinner,
  component: ProgressPage,
})

function ProgressPage() {
  return <ProgressContent />
}
