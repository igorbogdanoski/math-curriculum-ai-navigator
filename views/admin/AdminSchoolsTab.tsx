import React from 'react';
import { Card } from '../../components/common/Card';
import { Building, Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface AdminSchoolsTabProps {
    schools: any[];
    isLoadingSchools: boolean;
    schoolError: string;
    schoolSuccess: string;
    newSchoolName: string;
    newSchoolCity: string;
    isSubmitting: boolean;
    setNewSchoolName: (v: string) => void;
    setNewSchoolCity: (v: string) => void;
    handleCreateSchool: (e: React.FormEvent) => void;
}

export function AdminSchoolsTab({
    schools, isLoadingSchools, schoolError, schoolSuccess,
    newSchoolName, newSchoolCity, isSubmitting,
    setNewSchoolName, setNewSchoolCity, handleCreateSchool,
}: AdminSchoolsTabProps) {
    const { t } = useLanguage();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card className="p-6 sticky top-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-gray-500" />
                        {t('admin.schools.addSchool')}
                    </h2>
                    {schoolError && <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{schoolError}</div>}
                    {schoolSuccess && <div className="mb-3 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{schoolSuccess}</div>}
                    <form onSubmit={handleCreateSchool} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.schools.nameLabel')}</label>
                            <input
                                type="text"
                                value={newSchoolName}
                                onChange={e => setNewSchoolName(e.target.value)}
                                placeholder={t('admin.schools.namePlaceholder')}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-red-400 outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.schools.cityLabel')}</label>
                            <input
                                type="text"
                                value={newSchoolCity}
                                onChange={e => setNewSchoolCity(e.target.value)}
                                placeholder={t('admin.schools.cityPlaceholder')}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-red-400 outline-none text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting || !newSchoolName || !newSchoolCity}
                            className="w-full py-2.5 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors text-sm"
                        >
                            {isSubmitting ? t('admin.schools.creating') : t('admin.schools.registerSchool')}
                        </button>
                    </form>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card className="p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Building className="w-5 h-5 text-gray-500" />
                        {t('admin.schools.registeredSchools').replace('{n}', String(schools.length))}
                    </h2>
                    {isLoadingSchools ? (
                        <div className="space-y-3">
                            {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                        </div>
                    ) : schools.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">{t('admin.schools.noSchools')}</p>
                    ) : (
                        <div className="space-y-2">
                            {schools.map(school => (
                                <div key={school.id} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{school.name}</p>
                                        <p className="text-xs text-gray-500">{school.city}</p>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-mono bg-white px-2 py-1 rounded border truncate max-w-[120px]">{school.id}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
