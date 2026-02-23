import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_layout/social/')({
  beforeLoad: () => {
    throw redirect({ to: '/social/feed' })
  },
  component: () => null,
})
