
import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import type { TeachingProfile, StudentProfile } from '../types';
import { ICONS } from '../constants';
import { InstallApp } from '../components/common/InstallApp';

const initialProfile: TeachingProfile = {
    name: '',
    style: 'Constructivist',
    experienceLevel: 'Beginner',
    studentProfiles: []
};

export const SettingsView: React.FC = () => {
    const { user, updateProfile } = useAuth();
    const [profile, setProfile] = useState<TeachingProfile>(user || initialProfile);
    const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>(user?.studentProfiles || []);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileDesc, setNewProfileDesc] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { addNotification } = useNotification();

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
            addNotification('Профилот е успешно зачуван!', 'success');
        } catch (error) {
            addNotification('Грешка при зачувување на профилот.', 'error');
            console.error("Failed to save profile:", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAddProfile = () => {
        if (!newProfileName.trim() || !newProfileDesc.trim()) {
            addNotification('Името и описот на профилот се задолжителни.', 'error');
            return;
        }
        const newProfile: StudentProfile = {
            id: crypto.randomUUID(),
            name: newProfileName,
            description: newProfileDesc,
        };
        setStudentProfiles(prev => [...prev, newProfile]);
        setNewProfileName('');
        setNewProfileDesc('');
    };

    const handleDeleteProfile = (id: string) => {
        setStudentProfiles(prev => prev.filter(p => p.id !== id));
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    if (!user) {
        return null; // Should not be rendered when not authenticated
    }

    return (
        <div className="p-8 animate-fade-in space-y-8">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Поставки</h1>
                <p className="text-lg text-gray-600 mt-2">Прилагодете го вашето искуство во апликацијата.</p>
            </header>

            {/* Install App Section */}
            <InstallApp />

            <Card className="max-w-2xl">
                <h2 className="text-2xl font-semibold text-brand-primary mb-4">Профил на наставник</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Име</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={profile.name}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="style" className="block text-sm font-medium text-gray-700">Стил на настава</label>
                        <select
                            id="style"
                            name="style"
                            value={profile.style}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value="Constructivist">Конструктивистички</option>
                            <option value="Direct Instruction">Директна инструкција</option>
                            <option value="Inquiry-Based">Истражувачки</option>
                            <option value="Project-Based">Проектно-базиран</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700">Ниво на искуство</label>
                        <select
                            id="experienceLevel"
                            name="experienceLevel"
                            value={profile.experienceLevel}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value="Beginner">Почетник</option>
                            <option value="Intermediate">Средно искуство</option>
                            <option value="Expert">Експерт</option>
                        </select>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors flex items-center gap-2 disabled:bg-gray-400"
                        >
                            {isSaving && <ICONS.spinner className="w-5 h-5 animate-spin" />}
                            {isSaving ? 'Зачувувам...' : 'Зачувај промени на профил'}
                        </button>
                    </div>
                </form>
            </Card>
            
            <Card className="max-w-2xl">
                <h2 className="text-2xl font-semibold text-brand-primary mb-4">Профили на Ученици за Диференцијација</h2>
                <p className="text-sm text-gray-600 mb-4">Креирајте анонимни профили за да генерирате материјали прилагодени на специфични потреби на учениците.</p>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
                        <h3 className="font-semibold text-gray-800">Додади нов профил</h3>
                        <div>
                            <label htmlFor="newProfileName" className="block text-xs font-medium text-gray-600">Име на профил (пр. Ученик А)</label>
                            <input
                                id="newProfileName"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                                placeholder="Ученик А"
                            />
                        </div>
                         <div>
                            <label htmlFor="newProfileDesc" className="block text-xs font-medium text-gray-600">Краток опис на потреби/стил на учење</label>
                            <textarea
                                id="newProfileDesc"
                                value={newProfileDesc}
                                onChange={(e) => setNewProfileDesc(e.target.value)}
                                rows={2}
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                                placeholder="пр. Визуелен тип, подобро учи со слики. Потребна му е поддршка со текстуални задачи."
                            />
                        </div>
                        <div className="text-right">
                             <button onClick={handleAddProfile} type="button" className="bg-brand-secondary text-white px-4 py-2 text-sm rounded-lg shadow hover:bg-brand-primary transition-colors">
                                Додади профил
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-800 mb-2">Постоечки профили</h3>
                        {studentProfiles.length > 0 ? (
                            <ul className="space-y-2">
                                {studentProfiles.map(p => (
                                    <li key={p.id} className="p-3 bg-white border rounded-md flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-brand-primary">{p.name}</p>
                                            <p className="text-sm text-gray-600">{p.description}</p>
                                        </div>
                                        <button onClick={() => handleDeleteProfile(p.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full flex-shrink-0 ml-2">
                                            <ICONS.trash className="w-5 h-5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4">Немате креирано профили.</p>
                        )}
                    </div>
                </div>
                 <div className="flex justify-end pt-4 border-t mt-4">
                        <button
                            onClick={handleSave}
                            type="button"
                            disabled={isSaving}
                            className="bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors flex items-center gap-2 disabled:bg-gray-400"
                        >
                            {isSaving && <ICONS.spinner className="w-5 h-5 animate-spin" />}
                             {isSaving ? 'Зачувувам...' : 'Зачувај ги сите промени'}
                        </button>
                    </div>
            </Card>
        </div>
    );
};
