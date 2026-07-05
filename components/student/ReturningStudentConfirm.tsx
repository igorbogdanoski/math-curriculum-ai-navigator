import React from 'react';
import { User, Users } from 'lucide-react';

interface ReturningStudentConfirmProps {
  name: string;
  onConfirm: () => void;
  onSwitch: () => void;
}

/**
 * Shown once per browser session when this device already has a cached student
 * name. Devices are often shared between students (a classroom tablet, a family
 * computer), so silently continuing as whoever last used it would let one student
 * see another's homework/class — this makes the identity explicit every session
 * instead of trusting the cache indefinitely.
 */
export const ReturningStudentConfirm: React.FC<ReturningStudentConfirmProps> = ({ name, onConfirm, onSwitch }) => (
  <div className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center">
    <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
      <User className="w-7 h-7 text-indigo-600" />
    </div>
    <div>
      <h2 className="text-xl font-black text-gray-900">Здраво, {name}!</h2>
      <p className="text-sm text-gray-500 mt-1">Дали продолжуваш ти на овој уред?</p>
    </div>
    <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
      <button
        type="button"
        onClick={onConfirm}
        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all active:scale-95"
      >
        Да, тоа сум јас
      </button>
      <button
        type="button"
        onClick={onSwitch}
        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all active:scale-95"
      >
        <Users className="w-4 h-4" /> Не, друг ученик
      </button>
    </div>
  </div>
);
