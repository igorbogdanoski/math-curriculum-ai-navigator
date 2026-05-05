import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, ChevronRight, Loader2, ClipboardList, AlertCircle } from 'lucide-react';
import { fetchMaturaAssignmentsByClass } from '../services/firestoreService.classroom';
import type { MaturaAssignment } from '../services/firestoreService.classroom';
import { getOrCreateDeviceId } from '../utils/studentIdentity';
import { firestoreService } from '../services/firestoreService';
import { useNavigation } from '../contexts/NavigationContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: unknown): string {
  if (!ts) return '';
  try {
    const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string);
    return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

// ─── AssignmentCard ───────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  onLaunch,
  launching,
}: {
  assignment: MaturaAssignment;
  onLaunch: (a: MaturaAssignment) => void;
  launching: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
        <ClipboardList className="w-6 h-6 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate">{assignment.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {assignment.questionIds.length} прашања · {formatDate(assignment.createdAt)}
        </p>
      </div>
      <button
        type="button"
        disabled={launching}
        onClick={() => onLaunch(assignment)}
        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
      >
        {launching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>Започни <ChevronRight className="w-4 h-4" /></>
        )}
      </button>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function MaturaAssignmentView() {
  const { navigate } = useNavigation();
  const deviceId = getOrCreateDeviceId();

  const [classId, setClassId] = useState<string | null>(() => {
    try { return localStorage.getItem('student_class_id'); } catch { return null; }
  });
  const [assignments, setAssignments] = useState<MaturaAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // Restore class membership if not cached
  useEffect(() => {
    if (classId) return;
    firestoreService.fetchClassMembership(deviceId).then(m => {
      if (!m?.classId) return;
      setClassId(m.classId);
      try { localStorage.setItem('student_class_id', m.classId); } catch { /* incognito */ }
    }).catch(() => {});
  }, [deviceId, classId]);

  // Fetch assignments when classId is known
  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    fetchMaturaAssignmentsByClass(classId)
      .then(setAssignments)
      .catch(() => setError('Не можев да ги вчитам задачите. Обиди се повторно.'))
      .finally(() => setLoading(false));
  }, [classId]);

  const handleLaunch = useCallback(async (assignment: MaturaAssignment) => {
    if (!assignment.id || !assignment.questionIds.length) return;
    setLaunchingId(assignment.id);
    try {
      sessionStorage.setItem('matura_assignment_launch', JSON.stringify({
        assignmentId: assignment.id,
        title: assignment.title,
        questionDocIds: assignment.questionIds,
      }));
      navigate('/matura-practice');
    } catch {
      setLaunchingId(null);
    }
  }, [navigate]);

  // ── No class membership ───────────────────────────────────────────────────
  if (!loading && !classId) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Не си во класот</h2>
        <p className="text-gray-500 text-sm mb-6">
          За да ги видиш задачите од твојот наставник, прво треба да се придружиш во класот со кодот кој ти го дал наставникот.
        </p>
        <button
          type="button"
          onClick={() => navigate('/student')}
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Придружи се во класот
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Задачи за матура</h1>
          <p className="text-sm text-gray-500">Задачи доделени од твојот наставник</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && assignments.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Нема задачи сè уште</p>
          <p className="text-xs text-gray-400 mt-1">Твојот наставник ќе додели задачи наскоро</p>
        </div>
      )}

      {/* Assignment list */}
      {!loading && assignments.length > 0 && (
        <div className="space-y-3">
          {assignments.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              onLaunch={handleLaunch}
              launching={launchingId === a.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
