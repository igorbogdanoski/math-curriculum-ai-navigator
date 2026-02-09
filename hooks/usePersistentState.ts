
import { useState, useEffect, useCallback } from 'react';

export function usePersistentState<T,>(key: string, initialState: T): [T, (value: T | ((val: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const storageValue = window.localStorage.getItem(key);
      return storageValue ? JSON.parse(storageValue) : initialState;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialState;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  const setPersistentState = useCallback((value: T | ((val: T) => T)) => {
    setState(value);
  }, []);

  return [state, setPersistentState];
}
