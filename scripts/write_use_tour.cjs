const fs = require('fs');

const code = `import { useEffect, useRef } from 'react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const startedTours = new Set<string>();

export function useTour(
  tourName: string,
  steps: any[],
  readyToStart: boolean = true,
  onStepChange?: (element: HTMLElement) => void
) {
  const { toursSeen, markTourAsSeen, isPreferencesLoaded } = useUserPreferences();
  const hasRunLocally = useRef(false);

  useEffect(() => {
    if (typeof (window as any).introJs === 'undefined') return;
    if (!isPreferencesLoaded) return;
    if (!readyToStart) return;
    if (hasRunLocally.current || startedTours.has(tourName)) return;
    if (toursSeen[tourName] === true) return;
    if (window.innerWidth < 768) return;

    const timer = setTimeout(() => {
        if (startedTours.has(tourName) || toursSeen[tourName]) return;
        hasRunLocally.current = true;
        startedTours.add(tourName);

        const tour = (window as any).introJs();
        tour.setOptions({
            steps,
            showProgress: true,
            showBullets: true,
            showStepNumbers: false,
            prevLabel: 'Претходно',
            nextLabel: 'Следно',
            doneLabel: 'Готово',
            exitOnOverlayClick: false,
        });

        const finishTour = () => {
             markTourAsSeen(tourName);
        };

        tour.oncomplete(finishTour);
        tour.onexit(finishTour);
        
        if (onStepChange) {
            tour.onchange(onStepChange);
        }

        try { tour.start(); } catch (e) { console.warn("Tour start err:", e); }
    }, 800);

    return () => clearTimeout(timer);
  }, [toursSeen, tourName, steps, markTourAsSeen, readyToStart, isPreferencesLoaded, onStepChange]);
}
`;
fs.writeFileSync('hooks/useTour.ts', code);
