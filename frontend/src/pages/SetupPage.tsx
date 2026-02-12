import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { setupTrainingMaxes } from '../api/trainingMaxes';
import { convertToKg } from '../utils/weight';
import { ErrorMessage } from '../components/ErrorMessage';
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

    // Client-side validation - parse values in user's unit
    const benchInUserUnit = parseFloat(formData.bench);
    const squatInUserUnit = parseFloat(formData.squat);
    const ohpInUserUnit = parseFloat(formData.ohp);
    const deadliftInUserUnit = parseFloat(formData.deadlift);

    if (
      !formData.bench ||
      !formData.squat ||
      !formData.ohp ||
      !formData.deadlift ||
      benchInUserUnit <= 0 ||
      squatInUserUnit <= 0 ||
      ohpInUserUnit <= 0 ||
      deadliftInUserUnit <= 0 ||
      isNaN(benchInUserUnit) ||
      isNaN(squatInUserUnit) ||
      isNaN(ohpInUserUnit) ||
      isNaN(deadliftInUserUnit)
    ) {
      setError('All fields must be positive numbers');
      return;
    }

    setIsLoading(true);

    try {
      // Convert all values from user's unit to kg before sending to backend
      await setupTrainingMaxes({
        bench: convertToKg(benchInUserUnit, unit),
        squat: convertToKg(squatInUserUnit, unit),
        ohp: convertToKg(ohpInUserUnit, unit),
        deadlift: convertToKg(deadliftInUserUnit, unit),
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

          {error && <ErrorMessage message={error} />}

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Calculate Training Maxes'}
          </button>
        </form>
      </div>
    </div>
  );
}
