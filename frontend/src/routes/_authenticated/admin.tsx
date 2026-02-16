import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '../../api/user'
import { AdminLayout } from '../../components/AdminLayout'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.ensureQueryData({
      queryKey: ['user', 'me'],
      queryFn: getMe,
    })
    if (!user.isAdmin) {
      throw redirect({ to: '/' })
    }
  },
  component: AdminLayout,
})
