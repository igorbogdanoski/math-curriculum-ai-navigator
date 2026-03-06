import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { Card } from '../components/common/Card';
import { Building, Plus, ShieldAlert } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';

export const SystemAdminView: React.FC = () => {
    const { user, firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const [schools, setSchools] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Form state
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolCity, setNewSchoolCity] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate('/');
            return;
        }
        loadSchools();
    }, [user, navigate]);

    const loadSchools = async () => {
        setIsLoading(true);
        try {
            const data = await firestoreService.fetchSchools();
            setSchools(data || []);
        } catch (err) {
            console.error('Failed to load schools', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        
        if (!newSchoolName.trim() || !newSchoolCity.trim()) {
            setError('Please provide both name and city.');
            return;
        }

        setIsSubmitting(true);
        try {
            await firestoreService.createSchool(newSchoolName, newSchoolCity, firebaseUser?.uid);
            setSuccessMsg(`School "${newSchoolName}" in ${newSchoolCity} created successfully!`);
            setNewSchoolName('');
            setNewSchoolCity('');
            await loadSchools(); // Refresh list
        } catch (err: any) {
            setError('Failed to create school. Check permissions and try again.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-brand-primary" />
                        АДМИН: Училишта
                    </h1>
                    <p className="text-gray-500 mt-2">Административен панел за внес на нови или недостасувачки училишта во системот.</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
                    {error}
                </div>
            )}
            {successMsg && (
                <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
                    {successMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form to add new school */}
                <div className="lg:col-span-1">
                    <Card className="p-6 sticky top-6">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-gray-500" />
                            Додади Училиште
                        </h2>
                        
                        <form onSubmit={handleCreateSchool} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Име на училиште</label>
                                <input
                                    type="text"
                                    value={newSchoolName}
                                    onChange={(e) => setNewSchoolName(e.target.value)}
                                    placeholder="пр. ООУ Гоце Делчев"
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Град / Општина</label>
                                <input
                                    type="text"
                                    value={newSchoolCity}
                                    onChange={(e) => setNewSchoolCity(e.target.value)}
                                    placeholder="пр. Скопје"
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                                />
                            </div>
                            
                            <button
                                type="submit"
                                disabled={isSubmitting || !newSchoolName || !newSchoolCity}
                                className="w-full py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? 'Се креира...' : 'Регистрирај Училиште'}
                            </button>
                        </form>
                    </Card>
                </div>

                {/* List of existing schools */}
                <div className="lg:col-span-2">
                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Building className="w-5 h-5 text-gray-500" />
                            Регистрирани училишта ({schools.length})
                        </h2>

                        {isLoading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-16 bg-gray-100 rounded-xl" />
                                ))}
                            </div>
                        ) : schools.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                Нема регистрирани училишта во базата.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {schools.map(school => (
                                    <div key={school.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <div>
                                            <h3 className="font-bold text-gray-900">{school.name}</h3>
                                            <p className="text-sm text-gray-500">{school.city}</p>
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono bg-white px-2 py-1 rounded border">
                                            ID: {school.id}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};
