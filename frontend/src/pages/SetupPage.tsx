import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { setupTrainingMaxes } from '../api/trainingMaxes';
import './SetupPage.css';

export default function SetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    bench: '',
    squat: '',
    ohp: '',
    deadlift: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    const bench = parseFloat(formData.bench);
    const squat = parseFloat(formData.squat);
    const ohp = parseFloat(formData.ohp);
    const deadlift = parseFloat(formData.deadlift);

    if (
      !formData.bench ||
      !formData.squat ||
      !formData.ohp ||
      !formData.deadlift ||
      bench <= 0 ||
      squat <= 0 ||
      ohp <= 0 ||
      deadlift <= 0 ||
      isNaN(bench) ||
      isNaN(squat) ||
      isNaN(ohp) ||
      isNaN(deadlift)
    ) {
      setError('All fields must be positive numbers');
      return;
    }

    setIsLoading(true);

    try {
      await setupTrainingMaxes({
        bench,
        squat,
        ohp,
        deadlift,
      });

      // Redirect to dashboard on success
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup training maxes');
    } finally {
      setIsLoading(false);
    }
  };

  const unit = user?.unitPreference || 'kg';

  return (
    <div className="setup-page">
      <div className="setup-container">
        <h1>Enter Your 1 Rep Maxes</h1>
        <p className="setup-description">
          These will be used to calculate your training maxes (90% of 1RM).
        </p>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="form-group">
            <label htmlFor="bench">Bench Press ({unit})</label>
            <input
              type="number"
              id="bench"
              name="bench"
              value={formData.bench}
              onChange={handleInputChange}
              placeholder={`Enter bench press 1RM (${unit})`}
              step="0.1"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="squat">Squat ({unit})</label>
            <input
              type="number"
              id="squat"
              name="squat"
              value={formData.squat}
              onChange={handleInputChange}
              placeholder={`Enter squat 1RM (${unit})`}
              step="0.1"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="ohp">Overhead Press ({unit})</label>
            <input
              type="number"
              id="ohp"
              name="ohp"
              value={formData.ohp}
              onChange={handleInputChange}
              placeholder={`Enter OHP 1RM (${unit})`}
              step="0.1"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="deadlift">Deadlift ({unit})</label>
            <input
              type="number"
              id="deadlift"
              name="deadlift"
              value={formData.deadlift}
              onChange={handleInputChange}
              placeholder={`Enter deadlift 1RM (${unit})`}
              step="0.1"
              min="0"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Calculating...' : 'Calculate Training Maxes'}
          </button>
        </form>
      </div>
    </div>
  );
}
