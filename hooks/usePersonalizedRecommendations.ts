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

            // Simple caching mechanism to avoid re-fetching on every navigation
            const cacheKey = 'personalized-recommendations';
            const cachedData = sessionStorage.getItem(cacheKey);
            if (cachedData) {
                try {
                    const parsedData = JSON.parse(cachedData);
                    setRecommendations(parsedData);
                    setIsLoading(false);
                    return;
                } catch(e) {
                    sessionStorage.removeItem(cacheKey);
                }
            }

            setIsLoading(true);
            setError(null);
            try {
                const fetchedRecommendations = await geminiService.getPersonalizedRecommendations(user, lessonPlans);
                setRecommendations(fetchedRecommendations);
                sessionStorage.setItem(cacheKey, JSON.stringify(fetchedRecommendations));
            } catch (err) {
                console.error("Failed to fetch personalized recommendations:", err);
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };

        // Use a timeout to ensure other contexts are loaded
        const timerId = setTimeout(fetchRecommendations, 200);

        return () => clearTimeout(timerId);

    }, [user, lessonPlans]);

    return { recommendations, isLoading, error };
}