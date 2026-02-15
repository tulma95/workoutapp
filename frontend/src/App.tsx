import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import { AdminRoute } from './components/AdminRoute'
import Layout from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'
import WorkoutPage from './pages/WorkoutPage'
import PlanSelectionPage from './pages/PlanSelectionPage'
import PlanListPage from './pages/admin/PlanListPage'
import PlanEditorPage from './pages/admin/PlanEditorPage'
import ExerciseListPage from './pages/admin/ExerciseListPage'

function AuthWrapper() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

function AdminLayoutWrapper() {
  return (
    <AdminRoute>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </AdminRoute>
  )
}

const router = createBrowserRouter([
  {
    element: <AuthWrapper />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <Layout />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/select-plan', element: <PlanSelectionPage /> },
              { path: '/history', element: <HistoryPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/setup', element: <SetupPage /> },
              { path: '/workout/:dayNumber', element: <WorkoutPage /> },
            ],
          },
          {
            path: '/admin',
            element: <AdminLayoutWrapper />,
            children: [
              { index: true, element: <Navigate to="/admin/plans" replace /> },
              { path: 'plans', element: <PlanListPage /> },
              { path: 'plans/new', element: <PlanEditorPage /> },
              { path: 'plans/:id', element: <PlanEditorPage /> },
              { path: 'exercises', element: <ExerciseListPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
