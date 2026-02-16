import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className={styles.root} role="alert">
      <p className={styles.text}>{message}</p>
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
