import React, { useState } from 'react';
import { StudentProgressView } from './StudentProgressView';
import { BookOpen } from 'lucide-react';

/**
 * П23 — Родителски Портал
 * Ако URL содржи ?name=... → директно покажи ги резултатите (read-only).
 * Ако нема → покажи форма за внесување на името на ученикот.
 * Public route — нема потреба од автентикација.
 */
export const ParentPortalView: React.FC = () => {
  const hashSearch = window.location.hash.includes('?')
    ? window.location.hash.split('?')[1]
    : '';
  const params = new URLSearchParams(hashSearch);
  const nameFromUrl = params.get('name');

  const [nameInput, setNameInput] = useState('');

  if (nameFromUrl) {
    return <StudentProgressView name={decodeURIComponent(nameFromUrl)} />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    window.location.hash = `/parent?name=${encodeURIComponent(trimmed)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 text-center">Родителски портал</h1>
          <p className="text-gray-500 text-center mt-2 text-sm">
            Следете го напредокот на вашето дете во математика
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Внесете го името на ученикот
            </label>
            <input
              id="student-name"
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="На пр. Марија Петрова"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            Прикажи напредок →
          </button>
        </form>

        {/* Hint */}
        <p className="text-center text-xs text-gray-400 mt-6">
          или скенирајте QR код добиен од наставникот
        </p>
      </div>
    </div>
  );
};
