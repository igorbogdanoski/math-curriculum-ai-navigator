import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { TeacherOnboardingWizard } from './TeacherOnboardingWizard';

const ONBOARDING_KEY = 'onboarding_wizard';

export const OnboardingGate: React.FC = () => {
    const { isAuthenticated } = useAuth() as any;
    const { toursSeen, isPreferencesLoaded, markTourAsSeen } = useUserPreferences();

    if (!isAuthenticated || !isPreferencesLoaded) return null;
    if (toursSeen[ONBOARDING_KEY] || (window as any).__E2E_TEACHER_MODE__) return null;

    const handleClose = () => markTourAsSeen(ONBOARDING_KEY);

    return <TeacherOnboardingWizard onClose={handleClose} />;
};
