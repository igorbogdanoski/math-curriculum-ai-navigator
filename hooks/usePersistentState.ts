
import { useState, useEffect, useCallback } from 'react';

export function usePersistentState<T,>(key: string, initialState: T): [T, (value: T | ((val: T) => T)) => void, () => void, number | null] {
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const [state, setState] = useState<T>(() => {
    try {
      const storageValue = window.localStorage.getItem(key);
      if (storageValue) {
        const parsed = JSON.parse(storageValue);
        // If it's a wrapped persistent object with timestamp
        if (parsed && typeof parsed === 'object' && 'data' in parsed && 'timestamp' in parsed) {
          return parsed.data;
        }
        return parsed;
      }
      return initialState;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialState;
    }
  });

  useEffect(() => {
    try {
      const now = Date.now();
      window.localStorage.setItem(key, JSON.stringify({ data: state, timestamp: now }));
      setLastSaved(now);
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  const setPersistentState = useCallback((value: T | ((val: T) => T)) => {
    setState(value);
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(key);
    setState(initialState);
    setLastSaved(null);
  }, [key, initialState]);

  return [state, setPersistentState, clear, lastSaved];
}
