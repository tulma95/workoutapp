import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getTrainingMaxes } from '../api/trainingMaxes';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkTrainingMaxes() {
      try {
        const tms = await getTrainingMaxes();

        // If no training maxes exist, redirect to setup
        if (!tms || tms.length === 0) {
          navigate('/setup');
          return;
        }

        // User has training maxes, show dashboard
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch training maxes:', error);
        setIsLoading(false);
      }
    }

    checkTrainingMaxes();
  }, [navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <h1>Dashboard</h1>;
}
