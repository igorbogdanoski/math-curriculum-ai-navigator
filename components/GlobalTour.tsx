import React from 'react';
import Joyride, { CallBackProps, STATUS } from 'react-joyride';
import { useTourStore } from '../hooks/useTourStore';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

export const GlobalTour: React.FC = () => {
    const { run, steps, tourName, stopTour } = useTourStore();
    const { markTourAsSeen } = useUserPreferences();

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, type } = data;
        
        // When tour is finished or skipped
        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            if (tourName) {
                markTourAsSeen(tourName);
            }
            stopTour();
        }
    };

    if (!run || steps.length === 0) return null;

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous={true}
            showProgress={true}
            showSkipButton={true}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#0D47A1',
                    zIndex: 10000,
                }
            }}
            locale={{
                back: 'Претходно',
                close: 'Затвори',
                last: 'Готово',
                next: 'Следно',
                skip: 'Прескокни'
            }}
            disableOverlayClose={true} // prevent close on overlay click to avoid accidental skips
        />
    );
};
