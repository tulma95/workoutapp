import { createFileRoute } from '@tanstack/react-router'
import { FriendsTab } from '../../../../components/FriendsTab'

export const Route = createFileRoute('/_authenticated/_layout/social/friends')({
  component: FriendsPage,
})

function FriendsPage() {
  return <FriendsTab />
}
