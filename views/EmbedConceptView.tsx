/**
 * EmbedConceptView — LTI 1.3 basic: iframe-embeddable concept widget.
 * Route: /#/embed/concept/:id
 * Used by: Google Classroom, Microsoft Teams, Moodle via iframe.
 */
import React, { useMemo } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { MathRenderer } from '../components/common/MathRenderer';
import { useCurriculum } from '../hooks/useCurriculum';

interface Props {
  id: string;
}

export const EmbedConceptView: React.FC<Props> = ({ id }) => {
  const { getConceptDetails } = useCurriculum();
  const { grade, topic, concept } = useMemo(() => getConceptDetails(id), [getConceptDetails, id]);

  if (!concept) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-white">
        <p className="text-gray-400 text-sm">Концептот не е пронајден.</p>
      </div>
    );
  }

  const fullUrl = `${window.location.origin}${window.location.pathname}#/concept/${id}`;

  return (
    <div className="bg-white min-h-full flex flex-col font-sans">
      {/* Header strip */}
      <div className="bg-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-white/80 shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-black text-sm leading-tight truncate">{concept.title}</p>
            {grade && topic && (
              <p className="text-indigo-200 text-[10px] truncate">
                {grade.level}. одделение · {topic.title}
              </p>
            )}
          </div>
        </div>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Отвори во полн екран"
          className="shrink-0 ml-2 flex items-center gap-1 text-indigo-200 hover:text-white text-[10px] font-semibold transition"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="hidden sm:inline">Цела страница</span>
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Description */}
        <p className="text-gray-700 text-sm leading-relaxed">
          <MathRenderer text={concept.description} />
        </p>

        {/* Key content points */}
        {concept.content && concept.content.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-wide">Клучни точки</p>
            <ul className="space-y-1.5">
              {concept.content.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                  <MathRenderer text={line} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Assessment standards */}
        {concept.assessmentStandards.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wide">Стандарди за оценување</p>
            <ul className="space-y-1">
              {concept.assessmentStandards.map((std, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <MathRenderer text={std} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Local context examples */}
        {concept.localContextExamples && concept.localContextExamples.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-black text-amber-700 uppercase tracking-wide">Примери</p>
            {concept.localContextExamples.map((ex, i) => (
              <p key={i} className="text-xs text-amber-800">
                <MathRenderer text={ex} />
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
        <p className="text-[10px] text-gray-400">ai.mismath.net</p>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold"
        >
          Вежбај →
        </a>
      </div>
    </div>
  );
};
