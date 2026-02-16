import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: number;
}

export function LoadingSpinner({ size = 32 }: LoadingSpinnerProps) {
  return (
    <div className={styles.container}>
      <div
        className={styles.spinner}
        style={{ width: size, height: size }}
        aria-label="Loading"
      />
    </div>
  );
}
