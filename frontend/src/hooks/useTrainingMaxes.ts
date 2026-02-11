import { useState, useEffect } from 'react';
import { getTrainingMaxes, TrainingMax } from '../api/trainingMaxes';

interface UseTrainingMaxesResult {
  trainingMaxes: TrainingMax[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTrainingMaxes(): UseTrainingMaxesResult {
  const [trainingMaxes, setTrainingMaxes] = useState<TrainingMax[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainingMaxes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTrainingMaxes();
      setTrainingMaxes(data);
    } catch (err) {
      const errorMessage = (err as { error?: { message?: string } })?.error?.message || 'Failed to fetch training maxes';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainingMaxes();
  }, []);

  return {
    trainingMaxes,
    isLoading,
    error,
    refetch: fetchTrainingMaxes,
  };
}
