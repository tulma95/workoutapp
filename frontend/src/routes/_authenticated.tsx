import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getMe } from '../api/user'
import { queryKeys } from '../api/queryKeys'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: queryKeys.user.me(),
      queryFn: getMe,
    }),
  component: () => <Outlet />,
})
