import { createFileRoute } from '@tanstack/react-router'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { SocialContent } from '../../../components/SocialContent'

export const Route = createFileRoute('/_authenticated/_layout/social')({
  preload: false,
  pendingComponent: LoadingSpinner,
  component: SocialPage,
})

function SocialPage() {
  return <SocialContent />
}
