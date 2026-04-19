import React, { useState } from 'react';
import { subscribeGammaSession } from '../services/gammaLiveService';
import { useNavigation } from '../contexts/NavigationContext';

export const GammaJoinView: React.FC = () => {
  const { navigate } = useNavigation();
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const join = async () => {
    const p = pin.trim().replace(/\D/g, '');
    const n = name.trim();
    if (p.length !== 6) { setError('Внеси 6-цифрен PIN'); return; }
    if (!n) { setError('Внеси го твоето ime'); return; }
    setIsChecking(true);
    setError('');
    // Quick existence check via onSnapshot
    const unsub = subscribeGammaSession(p, session => {
      unsub();
      setIsChecking(false);
      if (!session || !session.isActive) {
        setError('Сесијата не постои или е завршена.');
        return;
      }
      navigate(`/gamma/student/${p}?name=${encodeURIComponent(n)}`);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 rounded-3xl border border-white/10 shadow-2xl p-10 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">📡</div>
        <h1 className="text-2xl font-black text-white mb-1">Gamma Live</h1>
        <p className="text-slate-400 text-sm mb-8">Приклучи се на часот на твојот наставник</p>

        <div className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-цифрен PIN"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && join()}
            className="w-full text-center text-3xl font-black tracking-[0.4em] bg-slate-800 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Твоето ime"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && join()}
            className="w-full bg-slate-800 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="button"
            onClick={join}
            disabled={isChecking}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg transition disabled:opacity-50"
          >
            {isChecking ? 'Проверувам…' : 'Приклучи се →'}
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-8">ai.mismath.net</p>
      </div>
    </div>
  );
};
