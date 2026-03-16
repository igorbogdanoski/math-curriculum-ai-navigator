import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlanner } from '../contexts/PlannerContext';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
import { RateLimitError } from '../services/apiErrors';
import type { AIRecommendation } from '../types';

export function usePersonalizedRecommendations(enabled = true) {
    const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { user, firebaseUser } = useAuth();
    const { lessonPlans } = usePlanner();

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!firebaseUser || !user) {
                setIsLoading(false);
                return;
            }

            // FIX: Skip immediately if the daily quota is already known to be exhausted.
            // This prevents a wasted API probe call on every app open when quota is gone.
            if (isDailyQuotaKnownExhausted()) {
                setIsLoading(false);
                return;
            }

            // Respect the "Auto AI Suggestions" toggle in Settings
            if (localStorage.getItem('auto_ai_suggestions') === 'false') {
                setIsLoading(false);
                return;
            }

            // More robust caching with timestamp to avoid re-fetching constantly
            const cacheKey = `personalized-recs-${firebaseUser.uid}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached);
                    // 48 hour cache (was 12h) — reduces auto-calls to max 1 per 2 days
                    if (Date.now() - timestamp < 48 * 60 * 60 * 1000) {
                        setRecommendations(data);
                        setIsLoading(false);
                        return;
                    }
                } catch(e) {
                    localStorage.removeItem(cacheKey);
                }
            }

            setIsLoading(true);
            setError(null);
            try {
                const fetchedRecommendations = await geminiService.getPersonalizedRecommendations(user, lessonPlans);
                setRecommendations(fetchedRecommendations);
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: fetchedRecommendations,
                    timestamp: Date.now()
                }));
            } catch (err) {
                console.error("Failed to fetch personalized recommendations:", err);
                setError((err as Error).message);
                // FIX: If quota is exhausted, cache failure for a full 12h (same as success)
                // so we don't probe the API every hour. Previously it was only 1h,
                // causing up to 9 wasted calls per exhausted day.
                const isQuotaError = err instanceof RateLimitError;
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: [],
                    timestamp: isQuotaError ? Date.now() : Date.now() - (11 * 60 * 60 * 1000),
                    failed: true,
                }));
            } finally {
                setIsLoading(false);
            }
        };

        if (!enabled) { setIsLoading(false); return; }

        // Increase delay significantly to allow other startup tasks to finish
        const timerId = setTimeout(fetchRecommendations, 3000);

        return () => clearTimeout(timerId);

    }, [firebaseUser?.uid, enabled]); // Only depend on UID to prevent re-fetch loops

    return { recommendations, isLoading, error };
}