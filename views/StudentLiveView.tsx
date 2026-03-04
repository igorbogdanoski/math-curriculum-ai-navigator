import React, { useState, useEffect } from 'react';
import { Loader2, Radio, User, Hash, ArrowRight, AlertCircle, Home } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { ICONS } from '../constants';

export const StudentLiveView: React.FC = () => {
    const [nameInput, setNameInput] = useState(
        () => localStorage.getItem('studentName') || ''
    );
    const [codeInput, setCodeInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Read code from URL if present (e.g., from QR code scan: /#/live?code=ABCD)
        const hashParts = window.location.hash.split('?');
        if (hashParts.length > 1) {
            const params = new URLSearchParams(hashParts[1]);
            const codeParam = params.get('code');
            if (codeParam) {
                setCodeInput(codeParam.toUpperCase());
            }
        }
    }, []);

    const handleJoin = async () => {
        const name = nameInput.trim();
        const code = codeInput.trim().toUpperCase();
        if (!name) { setError('Внеси го своето ime.'); return; }
        if (code.length !== 4) { setError('Кодот мора да има точно 4 карактери.'); return; }

        setLoading(true);
        setError('');
        try {
            if (!auth.currentUser) {
                try { await signInAnonymously(auth); } catch { /* non-fatal */ }
            }
            const session = await firestoreService.getLiveSessionByCode(code);
            if (!session) {
                setError('Не е пронајдена активна сесија со тој код. Провери го кодот.');
                setLoading(false);
                return;
            }
            // Save name + join session
            localStorage.setItem('studentName', name);
            await firestoreService.joinLiveSession(session.id, name);
            // Navigate to quiz with sessionId + teacher-tag params
            window.location.hash = `/play/${session.quizId}?sessionId=${encodeURIComponent(session.id)}&tid=${encodeURIComponent(session.hostUid)}`;
        } catch {
            setError('Грешка при поврзување. Обиди се повторно.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center justify-center">
            {/* Header */}
            <div className="w-full max-w-sm flex justify-between items-center mb-8 text-white">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                        <ICONS.logo className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="font-black text-xl tracking-tighter uppercase flex items-center gap-2">
                            <Radio className="w-5 h-5 text-red-300" /> Live Сесија
                        </h1>
                        <p className="text-white/60 text-xs font-semibold">Приклучи се на квиз</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => { window.location.hash = '/'; }}
                    className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition"
                >
                    <Home className="w-4 h-4" /> Почетна
                </button>
            </div>

            {/* Join card */}
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-4">
                <div className="text-center mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-700 bg-red-100 border border-red-200 px-3 py-1 rounded-full">
                        <Radio className="w-3.5 h-3.5" /> LIVE
                    </span>
                    <p className="text-slate-700 font-bold mt-2">Внеси ги своите податоци</p>
                </div>

                {/* Name */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        <User className="w-3.5 h-3.5" /> Ime и презиме
                    </label>
                    <input
                        type="text"
                        placeholder="Твоето полно ime..."
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                        className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-indigo-400 transition"
                    />
                </div>

                {/* Join code */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        <Hash className="w-3.5 h-3.5" /> Код за влез
                    </label>
                    <input
                        type="text"
                        placeholder="Напр. AB3K"
                        value={codeInput}
                        onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                        onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                        maxLength={4}
                        className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-black text-xl tracking-widest text-center focus:outline-none focus:border-indigo-400 transition uppercase"
                    />
                    <p className="text-xs text-slate-400 mt-1 text-center">Побарај го кодот од наставникот</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700 font-semibold">{error}</p>
                    </div>
                )}

                {/* Submit */}
                <button
                    type="button"
                    onClick={handleJoin}
                    disabled={loading || !nameInput.trim() || codeInput.length !== 4}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-black text-sm hover:bg-indigo-700 transition disabled:opacity-40"
                >
                    {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Поврзување...</>
                        : <><ArrowRight className="w-4 h-4" /> Влези во квизот</>
                    }
                </button>
            </div>
        </div>
    );
};
