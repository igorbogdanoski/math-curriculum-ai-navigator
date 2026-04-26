import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTeacherAnalytics } from './useTeacherAnalytics';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { useNavigation } from '../contexts/NavigationContext';
import type { WeakConcept } from './useDailyBrief';

export type ActionPriority = 'critical' | 'high' | 'medium';
export type ActionType = 'weak_concept' | 'inactive_students';

export interface DashboardAction {
  id: string;
  priority: ActionPriority;
  type: ActionType;
  title: string;
  metric: string;
  description: string;
  ctaPrimary: { label: string; handler: () => void };
  ctaSecondary?: { label: string; handler: () => void };
}

const PRIORITY_ORDER: Record<ActionPriority, number> = { critical: 0, high: 1, medium: 2 };
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aggregates class-wide signals (weak concepts + inactive students) into
 * a prioritised list of DashboardActions. Shares the React Query cache with
 * WeakConceptsWidget so there is only one Firestore read per session.
 */
export function useSmartDashboard(weakConcepts: WeakConcept[]) {
  const { firebaseUser } = useAuth();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { navigate } = useNavigation();

  const { data, isLoading } = useTeacherAnalytics(firebaseUser?.uid);
  const results = data?.results ?? [];

  const actions = useMemo((): DashboardAction[] => {
    const all: DashboardAction[] = [];
    const now = Date.now();

    // ── 1. Weak concepts (48h window from useDailyBrief) ──────────────
    weakConcepts.slice(0, 3).forEach(c => {
      all.push({
        id: `weak-${c.conceptId ?? c.title}`,
        priority: c.avg < 50 ? 'critical' : c.avg < 65 ? 'high' : 'medium',
        type: 'weak_concept',
        title: c.title,
        metric: `${c.avg}% просек · ${c.count} ${c.count === 1 ? 'обид' : 'обиди'}`,
        description:
          'Учениците покажуваат слаби резултати за овој концепт. Ремедијален квиз ќе ги идентификува погрешните разбирања.',
        ctaPrimary: {
          label: 'Ремедијален квиз',
          handler: () =>
            openGeneratorPanel({
              selectedConcepts: c.conceptId ? [c.conceptId] : [],
              materialType: 'QUIZ',
              differentiationLevel: 'support',
              customInstruction: `РЕМЕДИЈАЛЕН КВИЗ: Учениците постигнаа само ${c.avg}% за "${c.title}". Генерирај поедноставени прашања со чекор-по-чекор упатства и детални повратни информации.`,
            }),
        },
        ctaSecondary: {
          label: 'Работен лист',
          handler: () =>
            openGeneratorPanel({
              selectedConcepts: c.conceptId ? [c.conceptId] : [],
              materialType: 'ASSESSMENT',
              differentiationLevel: 'support',
            }),
        },
      });
    });

    // ── 2. Inactive students (no quiz in 7+ days) ────────────────────
    if (results.length > 0) {
      const lastActivity: Record<string, number> = {};
      results.forEach(r => {
        if (!r.studentName) return;
        const ms = r.playedAt?.toMillis() ?? 0;
        if (!lastActivity[r.studentName] || ms > lastActivity[r.studentName]) {
          lastActivity[r.studentName] = ms;
        }
      });

      const inactiveCount = Object.values(lastActivity).filter(
        ms => ms > 0 && now - ms > SEVEN_DAYS_MS,
      ).length;

      if (inactiveCount >= 3) {
        all.push({
          id: 'inactive-students',
          priority: inactiveCount >= 8 ? 'high' : 'medium',
          type: 'inactive_students',
          title: `${inactiveCount} неактивни ученици`,
          metric: 'Без квиз повеќе од 7 дена',
          description:
            'Дел од учениците не учествувале во ниту еден квиз оваа недела. Провери кој заостанува и прати активност.',
          ctaPrimary: {
            label: 'Аналитика',
            handler: () => navigate('/analytics'),
          },
          ctaSecondary: {
            label: 'Live квиз',
            handler: () => navigate('/live/host'),
          },
        });
      }
    }

    return all
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
      .slice(0, 5);
  }, [weakConcepts, results, openGeneratorPanel, navigate]);

  const criticalCount = actions.filter(a => a.priority === 'critical').length;
  const highCount = actions.filter(a => a.priority === 'high').length;

  return { actions, criticalCount, highCount, isLoading };
}
