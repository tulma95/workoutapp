import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import styles from '../../../components/SocialContent.module.css'

export const Route = createFileRoute('/_authenticated/_layout/social')({
  component: SocialLayout,
})

function SocialLayout() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Social</h1>
      <nav className={styles.tabList} aria-label="Social sections">
        <Link
          to="/social/feed"
          className={styles.tab}
          activeProps={{ className: `${styles.tab} ${styles.tabActive}` }}
        >
          Feed
        </Link>
        <Link
          to="/social/friends"
          className={styles.tab}
          activeProps={{ className: `${styles.tab} ${styles.tabActive}` }}
        >
          Friends
        </Link>
        <Link
          to="/social/leaderboard"
          className={styles.tab}
          activeProps={{ className: `${styles.tab} ${styles.tabActive}` }}
        >
          Leaderboard
        </Link>
      </nav>
      <div className={styles.tabPanel}>
        <Outlet />
      </div>
    </div>
  )
}
