import { Outlet, Link, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();

  return (
    <div>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>nSuns 4-Day LP</h1>
      </header>

      <main className="container" style={{ paddingTop: '16px', paddingBottom: '72px' }}>
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          Dashboard
        </Link>
        <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
          History
        </Link>
        <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>
          Settings
        </Link>
      </nav>
    </div>
  );
}
