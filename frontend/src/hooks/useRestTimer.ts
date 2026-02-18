import { useState, useRef, useEffect, useCallback } from 'react';

export interface RestTimerState {
  isRunning: boolean;
  secondsRemaining: number;
  totalSeconds: number;
}

export interface RestTimer {
  state: RestTimerState;
  start: (seconds: number) => void;
  skip: () => void;
  adjust: (delta: number) => void;
}

const INITIAL_STATE: RestTimerState = {
  isRunning: false,
  secondsRemaining: 0,
  totalSeconds: 0,
};

export function useRestTimer(): RestTimer {
  const [state, setState] = useState<RestTimerState>(INITIAL_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  function clearTimer() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function vibrate() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }

  function startInterval() {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (!prev.isRunning) {
          clearTimer();
          return prev;
        }

        const next = prev.secondsRemaining - 1;

        if (next <= 0) {
          clearTimer();
          vibrate();
          return INITIAL_STATE;
        }

        return { ...prev, secondsRemaining: next };
      });
    }, 1000);
  }

  const start = useCallback((seconds: number) => {
    const clamped = Math.max(1, seconds);
    setState({ isRunning: true, secondsRemaining: clamped, totalSeconds: clamped });
    startInterval();
  }, []);

  const skip = useCallback(() => {
    clearTimer();
    setState(INITIAL_STATE);
  }, []);

  const adjust = useCallback((delta: number) => {
    setState(prev => {
      if (!prev.isRunning) return prev;

      const newRemaining = Math.max(1, prev.secondsRemaining + delta);
      const newTotal = newRemaining > prev.totalSeconds ? newRemaining : prev.totalSeconds;

      return { ...prev, secondsRemaining: newRemaining, totalSeconds: newTotal };
    });
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else {
        if (hiddenAtRef.current === null) return;

        const elapsed = Math.round((Date.now() - hiddenAtRef.current) / 1000);
        hiddenAtRef.current = null;

        setState(prev => {
          if (!prev.isRunning) return prev;

          const newRemaining = prev.secondsRemaining - elapsed;

          if (newRemaining <= 0) {
            clearTimer();
            vibrate();
            return INITIAL_STATE;
          }

          return { ...prev, secondsRemaining: newRemaining };
        });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  return { state, start, skip, adjust };
}
