import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Building2, Search, Mail, CheckCircle2 } from 'lucide-react';
import { SCHOOL_REGISTRY, type SchoolRegistryEntry } from '../../data/schoolRegistry';
import { firestoreService } from '../../services/firestoreService';
import { logger } from '../../utils/logger';

interface AdminSchoolRegistryTabProps {
    users: Array<{ schoolRegistryId?: string }>;
    isLoadingUsers: boolean;
    adminUid: string;
}

const TYPE_LABELS: Record<SchoolRegistryEntry['type'], string> = {
    primary: 'Основно',
    secondary: 'Средно',
    vet: 'РЦСОО',
};

function buildOutreachMailto(entry: SchoolRegistryEntry): string {
    const subject = encodeURIComponent(`Покана за соработка — Math Navigator AI`);
    const body = encodeURIComponent(
        `Почитувани,\n\n` +
        `Ве контактираме во име на Math Navigator AI — платформа за наставници по математика.\n\n` +
        `Училиште: ${entry.name}\n` +
        `Општина: ${entry.municipality}\n` +
        (entry.address ? `Адреса: ${entry.address}\n` : '') +
        (entry.website ? `Веб-страница: ${entry.website}\n` : '') +
        `\nБи сакале да ги поканиме наставниците по математика од вашето училиште да се регистрираат на платформата.\n\n` +
        `Со почит,\nMath Navigator AI тим`
    );
    return `mailto:?subject=${subject}&body=${body}`;
}

export function AdminSchoolRegistryTab({ users, isLoadingUsers, adminUid }: AdminSchoolRegistryTabProps) {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | SchoolRegistryEntry['type']>('all');
    const [showOnlyMissing, setShowOnlyMissing] = useState(false);
    const [outreachLog, setOutreachLog] = useState<Record<string, { contactedAt?: unknown }>>({});
    const [isLoadingOutreach, setIsLoadingOutreach] = useState(true);
    const [markingId, setMarkingId] = useState<string | null>(null);

    useEffect(() => {
        firestoreService.fetchSchoolOutreachLog()
            .then(setOutreachLog)
            .catch(err => logger.warn('[AdminSchoolRegistryTab] fetchSchoolOutreachLog failed:', err))
            .finally(() => setIsLoadingOutreach(false));
    }, []);

    const teacherCountByRegistryId = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const u of users) {
            if (!u.schoolRegistryId) continue;
            counts[u.schoolRegistryId] = (counts[u.schoolRegistryId] ?? 0) + 1;
        }
        return counts;
    }, [users]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return SCHOOL_REGISTRY.filter(entry => {
            if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
            if (showOnlyMissing && (teacherCountByRegistryId[entry.id] ?? 0) > 0) return false;
            if (q && !entry.name.toLowerCase().includes(q) && !entry.municipality.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [search, typeFilter, showOnlyMissing, teacherCountByRegistryId]);

    const notYetOnPlatformCount = useMemo(
        () => SCHOOL_REGISTRY.filter(e => !(teacherCountByRegistryId[e.id] > 0)).length,
        [teacherCountByRegistryId],
    );

    const handleMarkContacted = async (registryId: string) => {
        setMarkingId(registryId);
        try {
            await firestoreService.markSchoolContacted(registryId, adminUid);
            setOutreachLog(prev => ({ ...prev, [registryId]: { contactedAt: new Date().toISOString() } }));
        } finally {
            setMarkingId(null);
        }
    };

    const isLoading = isLoadingUsers || isLoadingOutreach;

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-500" />
                    Регистар на училишта ({SCHOOL_REGISTRY.length})
                </h2>
                <span className="text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                    {notYetOnPlatformCount} сè уште немаат наставник на платформата
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Пребарај по име или општина..."
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
                    className="px-3 py-2 border rounded-lg text-sm"
                    aria-label="Филтрирај по тип"
                >
                    <option value="all">Сите типови</option>
                    <option value="primary">Основно</option>
                    <option value="secondary">Средно</option>
                    <option value="vet">РЦСОО</option>
                </select>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={showOnlyMissing} onChange={e => setShowOnlyMissing(e.target.checked)} />
                    Само без наставник
                </label>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">Нема резултати.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-400 border-b">
                                <th className="pb-2 pr-3">Училиште</th>
                                <th className="pb-2 pr-3">Општина</th>
                                <th className="pb-2 pr-3">Тип</th>
                                <th className="pb-2 pr-3">Наставници</th>
                                <th className="pb-2 pr-3">Контакт</th>
                                <th className="pb-2">Акција</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 200).map(entry => {
                                const count = teacherCountByRegistryId[entry.id] ?? 0;
                                const contacted = Boolean(outreachLog[entry.id]?.contactedAt);
                                return (
                                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                                        <td className="py-2 pr-3 font-semibold text-gray-800 max-w-[220px] truncate">{entry.name}</td>
                                        <td className="py-2 pr-3 text-gray-500">{entry.municipality}</td>
                                        <td className="py-2 pr-3 text-gray-500">{TYPE_LABELS[entry.type]}</td>
                                        <td className="py-2 pr-3">
                                            <span className={`font-bold ${count > 0 ? 'text-green-600' : 'text-amber-500'}`}>{count}</span>
                                        </td>
                                        <td className="py-2 pr-3">
                                            {contacted ? (
                                                <span className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Контактирано
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 flex items-center gap-2">
                                            <a
                                                href={buildOutreachMailto(entry)}
                                                title="Испрати покана за соработка"
                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"
                                            >
                                                <Mail className="w-4 h-4" />
                                            </a>
                                            {!contacted && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleMarkContacted(entry.id)}
                                                    disabled={markingId === entry.id}
                                                    className="text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                                >
                                                    Означи контактирано
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtered.length > 200 && (
                        <p className="text-xs text-gray-400 mt-3 text-center">Прикажани се првите 200 од {filtered.length} резултати — стеснете ја пребарувањето.</p>
                    )}
                </div>
            )}
        </Card>
    );
}
