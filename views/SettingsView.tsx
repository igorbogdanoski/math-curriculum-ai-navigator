import { logger } from '../utils/logger';

import React, { useState, useEffect } from 'react';

import { Card } from '../components/common/Card';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import type { TeachingProfile, StudentProfile, SecondaryTrack } from '../types';
import { SECONDARY_TRACK_LABELS } from '../types';
import { ICONS } from '../constants';
import { InstallApp } from '../components/common/InstallApp';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useLanguage } from '../i18n/LanguageContext';

import { AccessibilityCard } from './settings/AccessibilityCard';
import { SchoolCard } from './settings/SchoolCard';
import { BillingPrivacyPanel } from './settings/BillingPrivacyPanel';
import { SettingsDevPanel } from './settings/SettingsDevPanel';

const initialProfile: TeachingProfile = {
    name: '',
    style: 'Constructivist',
    experienceLevel: 'Beginner',
    studentProfiles: []
};

export const SettingsView: React.FC = () => {
    const { user, updateProfile, firebaseUser } = useAuth();
    const [profile, setProfile] = useState<TeachingProfile>(user || initialProfile);
    const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>(user?.studentProfiles || []);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileDesc, setNewProfileDesc] = useState('');
    const [profileFormErrors, setProfileFormErrors] = useState<{ name?: string; desc?: string }>({});
    const [isSaving, setIsSaving] = useState(false);

    const { addNotification } = useNotification();
    const { resetAllTours } = useUserPreferences();
    const { t } = useLanguage();

    useEffect(() => {
        if (user) {
            setProfile(user);
            setStudentProfiles(user.studentProfiles || []);
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateProfile({ ...profile, studentProfiles });
            addNotification(t('settingsView.saveProfileSuccess'), 'success');
        } catch (error) {
            addNotification(t('settingsView.saveProfileError'), 'error');
            logger.error('Failed to save profile:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddProfile = () => {
        const errs: { name?: string; desc?: string } = {};
        if (!newProfileName.trim()) errs.name = t('settingsView.errNameRequired');
        if (!newProfileDesc.trim()) errs.desc = t('settingsView.errDescRequired');
        if (Object.keys(errs).length > 0) { setProfileFormErrors(errs); return; }
        setProfileFormErrors({});
        const newProfile: StudentProfile = {
            id: crypto.randomUUID(),
            name: newProfileName,
            description: newProfileDesc,
        };
        setStudentProfiles((prev: StudentProfile[]) => [...prev, newProfile]);
        setNewProfileName('');
        setNewProfileDesc('');
    };

    const handleDeleteProfile = (id: string) => {
        setStudentProfiles((prev: StudentProfile[]) => prev.filter((p: StudentProfile) => p.id !== id));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setProfile((prev: TeachingProfile) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    if (!user) return null;

    return (
        <div className="p-8 animate-fade-in space-y-8">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">{t('settingsView.pageTitle')}</h1>
                <p className="text-lg text-gray-600 mt-2">{t('settingsView.pageSubtitle')}</p>
            </header>

            <Card className="max-w-2xl mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-brand-primary">{t('settingsView.toursTitle')}</h2>
                        <p className="text-gray-600 text-sm mt-1">{t('settingsView.toursDesc')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            resetAllTours();
                            addNotification(t('settingsView.toursResetSuccess'), 'success');
                        }}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-medium transition-colors"
                    >
                        {t('settingsView.reset')}
                    </button>
                </div>
            </Card>

            {firebaseUser?.uid && (
                <Card className="max-w-2xl">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                                {t('settingsView.firebaseUidTitle')}
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                {t('settingsView.firebaseUidDesc')}
                            </p>
                            <p className="mt-2 font-mono text-xs text-gray-800 bg-gray-100 px-3 py-2 rounded-lg break-all select-all">
                                {firebaseUser.uid}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            <InstallApp />

            {/* Teacher profile form */}
            <Card className="max-w-2xl">
                <h2 className="text-2xl font-semibold text-brand-primary mb-4">{t('settingsView.teacherProfileTitle')}</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">{t('settingsView.nameLabel')}</label>
                        <input type="text" id="name" name="name" value={profile.name} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700">{t('settingsView.schoolNameLabel')}</label>
                        <input type="text" id="schoolName" name="schoolName" value={profile.schoolName || ''} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder={t('settingsView.schoolNamePlaceholder')} />
                    </div>
                    <div>
                        <label htmlFor="municipality" className="block text-sm font-medium text-gray-700">{t('settingsView.municipalityLabel')}</label>
                        <input type="text" id="municipality" name="municipality" value={profile.municipality || ''} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder={t('settingsView.municipalityPlaceholder')} />
                    </div>
                    <div>
                        <label htmlFor="style" className="block text-sm font-medium text-gray-700">{t('settingsView.teachingStyleLabel')}</label>
                        <select id="style" name="style" value={profile.style} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            <option value="Constructivist">{t('settingsView.styleConstructivist')}</option>
                            <option value="Direct Instruction">{t('settingsView.styleDirectInstruction')}</option>
                            <option value="Inquiry-Based">{t('settingsView.styleInquiryBased')}</option>
                            <option value="Project-Based">{t('settingsView.styleProjectBased')}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700">{t('settingsView.experienceLevelLabel')}</label>
                        <select id="experienceLevel" name="experienceLevel" value={profile.experienceLevel} onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            <option value="Beginner">{t('settingsView.experienceBeginner')}</option>
                            <option value="Intermediate">{t('settingsView.experienceIntermediate')}</option>
                            <option value="Expert">{t('settingsView.experienceExpert')}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="secondaryTrack" className="block text-sm font-medium text-gray-700">
                            {t('settingsView.educationTypeLabel')}
                        </label>
                        <p className="text-xs text-gray-500 mb-1">
                            {t('settingsView.educationTypeDesc')}
                        </p>
                        <select
                            id="secondaryTrack"
                            value={profile.secondaryTrack ?? ''}
                            onChange={(e) => {
                                const val = e.target.value as SecondaryTrack | '';
                                setProfile((prev: TeachingProfile) => ({
                                    ...prev,
                                    secondaryTrack: val === '' ? undefined : val,
                                }));
                            }}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value="">{t('settingsView.educationPrimary')}</option>
                            {(Object.entries(SECONDARY_TRACK_LABELS) as [SecondaryTrack, string][]).map(
                                ([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}{(key === 'vocational4' || key === 'vocational3') ? t('settingsView.betaSuffix') : ''}
                                    </option>
                                )
                            )}
                        </select>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <button type="submit" disabled={isSaving}
                            className="bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors flex items-center gap-2 disabled:bg-gray-400">
                            {isSaving && <ICONS.spinner className="w-5 h-5 animate-spin" />}
                            {isSaving ? t('settingsView.saving') : t('settingsView.saveProfileChanges')}
                        </button>
                    </div>
                </form>
            </Card>

            {/* Student differentiation profiles */}
            <Card className="max-w-2xl">
                <h2 className="text-2xl font-semibold text-brand-primary mb-4">{t('settingsView.diffProfilesTitle')}</h2>
                <p className="text-sm text-gray-600 mb-4">{t('settingsView.diffProfilesDesc')}</p>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
                        <h3 className="font-semibold text-gray-800">{t('settingsView.addNewProfile')}</h3>
                        <div>
                            <label htmlFor="newProfileName" className="block text-xs font-medium text-gray-600">{t('settingsView.profileNameLabel')}</label>
                            <input
                                id="newProfileName"
                                value={newProfileName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setNewProfileName(e.target.value); setProfileFormErrors(p => ({ ...p, name: '' })); }}
                                className={`mt-1 block w-full p-2 border rounded-md ${profileFormErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                placeholder={t('settingsView.profileNamePlaceholder')}
                            />
                            {profileFormErrors.name && <p className="text-[11px] text-red-500 mt-1">{profileFormErrors.name}</p>}
                        </div>
                        <div>
                            <label htmlFor="newProfileDesc" className="block text-xs font-medium text-gray-600">{t('settingsView.profileDescLabel')}</label>
                            <textarea
                                id="newProfileDesc"
                                value={newProfileDesc}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setNewProfileDesc(e.target.value); setProfileFormErrors(p => ({ ...p, desc: '' })); }}
                                rows={2}
                                className={`mt-1 block w-full p-2 border rounded-md ${profileFormErrors.desc ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                placeholder={t('settingsView.profileDescPlaceholder')}
                            />
                            {profileFormErrors.desc && <p className="text-[11px] text-red-500 mt-1">{profileFormErrors.desc}</p>}
                        </div>
                        <div className="text-right">
                            <button onClick={handleAddProfile} type="button" className="bg-brand-secondary text-white px-4 py-2 text-sm rounded-lg shadow hover:bg-brand-primary transition-colors">
                                {t('settingsView.addProfile')}
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-800 mb-2">{t('settingsView.existingProfiles')}</h3>
                        {studentProfiles.length > 0 ? (
                            <ul className="space-y-2">
                                {studentProfiles.map((p: StudentProfile) => (
                                    <li key={p.id} className="p-3 bg-white border rounded-md flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-brand-primary">{p.name}</p>
                                            <p className="text-sm text-gray-600">{p.description}</p>
                                        </div>
                                        <button type="button" aria-label={t('settingsView.deleteProfileAria').replace('{name}', p.name)} onClick={() => handleDeleteProfile(p.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full flex-shrink-0 ml-2">
                                            <ICONS.trash className="w-5 h-5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4">{t('settingsView.noProfilesYet')}</p>
                        )}
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t mt-4">
                    <button onClick={handleSave} type="button" disabled={isSaving}
                        className="bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors flex items-center gap-2 disabled:bg-gray-400">
                        {isSaving && <ICONS.spinner className="w-5 h-5 animate-spin" />}
                        {isSaving ? t('settingsView.saving') : t('settingsView.saveAllChanges')}
                    </button>
                </div>
            </Card>

            <SettingsDevPanel />
            <AccessibilityCard />
            <BillingPrivacyPanel />
            <SchoolCard />
        </div>
    );
};
