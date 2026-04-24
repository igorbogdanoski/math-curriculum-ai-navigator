import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { TeacherOnboardingWizard } from './TeacherOnboardingWizard';
import { trackExperimentAssignment } from '../../services/telemetryService';

const ONBOARDING_KEY = 'onboarding_wizard';
const EXPERIMENT_NAME = 'onboarding_wizard_v1';
// 50/50 split between A=wizard (control) and B=no-wizard (treatment)
const WIZARD_SPLIT = 0.5;

export const OnboardingGate: React.FC = () => {
    const { isAuthenticated, firebaseUser } = useAuth();
    const { toursSeen, isPreferencesLoaded, markTourAsSeen } = useUserPreferences();

    // S39-F6: assign A/B bucket once per uid, persisted in localStorage.
    // Bucket is fixed per uid, so the same user keeps the same experience.
    const bucket = useMemo(
        () => trackExperimentAssignment(firebaseUser?.uid, EXPERIMENT_NAME, WIZARD_SPLIT),
        [firebaseUser?.uid],
    );

    if (!isAuthenticated || !isPreferencesLoaded) return null;
    if (toursSeen[ONBOARDING_KEY] || window.__E2E_TEACHER_MODE__) return null;
    // B bucket = kill-switch ON → skip the wizard so we can A/B test
    // time-to-first-quiz between users who saw it vs. users who didn't.
    if (bucket === 'B') return null;

    const handleClose = () => markTourAsSeen(ONBOARDING_KEY);

    return <TeacherOnboardingWizard onClose={handleClose} />;
};
