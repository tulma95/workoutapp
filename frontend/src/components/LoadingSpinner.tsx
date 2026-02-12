import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: number;
}

export function LoadingSpinner({ size = 32 }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner-container">
      <div
        className="loading-spinner"
        style={{ width: size, height: size }}
        aria-label="Loading"
      />
    </div>
  );
}
