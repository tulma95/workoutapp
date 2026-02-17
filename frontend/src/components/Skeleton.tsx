import styles from './Skeleton.module.css'

export function SkeletonLine({ width = '100%', height = '1rem' }: { width?: string; height?: string }) {
  return <div className={styles.line} style={{ width, height }} />
}

export function SkeletonHeading({ width = '50%' }: { width?: string }) {
  return <div className={styles.heading} style={{ width }} />
}

export function SkeletonCard({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={`${styles.card} ${className || ''}`}>{children}</div>
}
