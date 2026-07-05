import React from 'react';
import { MathToolsPanel, type MathToolTab } from '../components/common/MathToolsPanel';
import { useNavigation } from '../contexts/NavigationContext';

const VALID_TABS: MathToolTab[] = ['scratchpad', 'geogebra', 'desmos', 'algebra-tiles'];

/**
 * Full-page host for MathToolsPanel — the panel itself was previously only ever
 * embedded inline (InteractiveQuizPlayer's side panel, LessonPlanSidebar's
 * ContextualMathTools callback), so /math-tools had never been a registered
 * route despite several call sites (ClassroomView, LessonExecutionOverlay)
 * already navigating to it as if it were one.
 */
export const MathToolsView: React.FC = () => {
  const { navigate } = useNavigation();

  const hash = window.location.hash;
  const tabParam = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '').get('tab');
  const defaultTab = VALID_TABS.includes(tabParam as MathToolTab) ? (tabParam as MathToolTab) : undefined;

  return (
    <div className="h-[calc(100vh-8rem)] p-4 md:p-6">
      <MathToolsPanel
        key={defaultTab}
        defaultTab={defaultTab}
        onClose={() => navigate('/data-viz')}
        className="rounded-2xl shadow-xl border border-gray-200"
      />
    </div>
  );
};
