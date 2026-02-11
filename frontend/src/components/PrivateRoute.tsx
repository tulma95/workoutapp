import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '48px 0' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
}
