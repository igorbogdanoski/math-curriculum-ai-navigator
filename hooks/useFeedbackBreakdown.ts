import { useEffect, useState } from 'react';
import type { FeedbackReasonBreakdown } from '../types';
import { computeFeedbackBreakdown } from '../services/firestoreService';

interface UseFeedbackBreakdownOptions {
  uid?: string;
  periodDays?: number;
  enabled?: boolean;
  refreshKey?: number | string;
}

export const useFeedbackBreakdown = (options: UseFeedbackBreakdownOptions = {}) => {
  const { uid, periodDays = 30, enabled = true, refreshKey } = options;
  
  const [data, setData] = useState<FeedbackReasonBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !uid) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchBreakdown = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const breakdown = await computeFeedbackBreakdown(uid, periodDays);
        if (isMounted) {
          setData(breakdown);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load feedback breakdown');
          setData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBreakdown();

    return () => {
      isMounted = false;
    };
  }, [uid, periodDays, enabled, refreshKey]);

  return { data, isLoading, error };
};
