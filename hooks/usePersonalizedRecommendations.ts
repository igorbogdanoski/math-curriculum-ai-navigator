import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlanner } from '../contexts/PlannerContext';
import { geminiService } from '../services/geminiService';
import type { AIRecommendation } from '../types';

export function usePersonalizedRecommendations() {
    const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();
    const { lessonPlans } = usePlanner();

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            // More robust caching with timestamp to avoid re-fetching constantly
            const cacheKey = `personalized-recs-${user.uid}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached);
                    // 12 hour cache
                    if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
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
            } finally {
                setIsLoading(false);
            }
        };

        // Increase delay and only depend on user.uid to avoid loops
        const timerId = setTimeout(fetchRecommendations, 1000);

        return () => clearTimeout(timerId);

    }, [user?.uid]); // Only depend on UID to prevent re-fetch loops

    return { recommendations, isLoading, error };
}