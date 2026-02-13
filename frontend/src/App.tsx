import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/select-plan" element={<PlanSelectionPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/workout/:dayNumber" element={<WorkoutPage />} />
            </Route>

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Navigate to="/admin/plans" replace />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <AdminLayout>
                    <Routes>
                      <Route path="plans" element={<PlanListPage />} />
                      <Route path="plans/new" element={<PlanEditorPage />} />
                      <Route path="plans/:id" element={<PlanEditorPage />} />
                      <Route path="exercises" element={<ExerciseListPage />} />
                    </Routes>
                  </AdminLayout>
                </AdminRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
