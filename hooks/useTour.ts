import { useEffect, useRef } from 'react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTourStore } from './useTourStore';

const startedSessionTours = new Set<string>();

export function useTour(
  tourName: string,
  steps: any[],
  readyToStart: boolean = true,
  onStepChange?: (element: HTMLElement) => void
) {
  const { toursSeen, isPreferencesLoaded } = useUserPreferences();
  const startTour = useTourStore((state) => state.startTour);
  const currentTourName = useTourStore((state) => state.tourName);
  
  useEffect(() => {
    if (!isPreferencesLoaded) return;
    if (!readyToStart) return;
    if (startedSessionTours.has(tourName)) return;
    if (toursSeen[tourName] === true) return;
    if (window.innerWidth < 768) return; // Skip tours on mobile

    const timer = setTimeout(() => {
        // Double check
        if (startedSessionTours.has(tourName) || toursSeen[tourName]) return;
        
        startedSessionTours.add(tourName);

        // Convert intro.js format to react-joyride format
        const joyrideSteps = steps.map(s => ({
            target: s.element,
            content: s.intro,
            title: s.title,
            placement: (s.position === 'bottom' || s.position === 'top' || s.position === 'left' || s.position === 'right') ? s.position : 'auto',
            disableBeacon: true
        }));

        startTour(tourName, joyrideSteps);
    }, 800);

    return () => clearTimeout(timer);
  }, [toursSeen, tourName, steps, readyToStart, isPreferencesLoaded, startTour]);
}
