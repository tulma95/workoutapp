import './ErrorMessage.css';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="error-message" role="alert">
      <p className="error-message-text">{message}</p>
      {onRetry && (
        <button className="error-message-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
