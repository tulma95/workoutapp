import { Outlet, Link, useLocation } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getMe } from '../api/user'
import shared from '../styles/shared.module.css'

export default function Layout() {
  const location = useLocation()
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', 'me'],
    queryFn: getMe,
  })

  return (
    <div>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>nSuns 4-Day LP</h1>
        {user.isAdmin && (
          <Link
            to="/admin"
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: '#7c3aed',
              color: 'white',
              textDecoration: 'none',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Admin
          </Link>
        )}
      </header>

      <main className={shared.container} style={{ paddingTop: '16px', paddingBottom: '72px' }}>
        <Outlet />
      </main>

      <nav className={shared.bottomNav}>
        <Link to="/" className={`${shared.bottomNavLink} ${location.pathname === '/' ? shared.bottomNavLinkActive : ''}`}>
          Dashboard
        </Link>
        <Link to="/history" className={`${shared.bottomNavLink} ${location.pathname === '/history' ? shared.bottomNavLinkActive : ''}`}>
          History
        </Link>
        <Link to="/settings" className={`${shared.bottomNavLink} ${location.pathname === '/settings' ? shared.bottomNavLinkActive : ''}`}>
          Settings
        </Link>
      </nav>
    </div>
  )
}
