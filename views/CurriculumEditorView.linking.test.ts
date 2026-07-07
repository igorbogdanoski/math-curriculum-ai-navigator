import { describe, it, expect } from 'vitest';
import { matchAnnualTopicToRealTopic } from './CurriculumEditorView';
import type { Topic, AIGeneratedAnnualPlanTopic } from '../types';

describe('matchAnnualTopicToRealTopic', () => {
  const topics: Topic[] = [
    { id: 't1', title: 'Дропки', concepts: [] } as unknown as Topic,
    { id: 't2', title: 'Триаголници и агли', concepts: [] } as unknown as Topic,
  ];

  it('matches by topicId when present, even if the title looks unrelated', () => {
    const annualTopic: AIGeneratedAnnualPlanTopic = {
      title: 'Нешто сосема поинакво насловено',
      durationWeeks: 2,
      objectives: [],
      suggestedActivities: [],
      topicId: 't2',
    };
    expect(matchAnnualTopicToRealTopic(topics, annualTopic)?.id).toBe('t2');
  });

  it('falls back to a strict title match when topicId is absent', () => {
    const annualTopic: AIGeneratedAnnualPlanTopic = {
      title: 'Дропки — собирање и одземање',
      durationWeeks: 2,
      objectives: [],
      suggestedActivities: [],
    };
    expect(matchAnnualTopicToRealTopic(topics, annualTopic)?.id).toBe('t1');
  });

  it('falls back to a strict title match when topicId does not resolve to a real topic', () => {
    const annualTopic: AIGeneratedAnnualPlanTopic = {
      title: 'Триаголници',
      durationWeeks: 2,
      objectives: [],
      suggestedActivities: [],
      topicId: 'does-not-exist',
    };
    expect(matchAnnualTopicToRealTopic(topics, annualTopic)?.id).toBe('t2');
  });

  it('returns undefined rather than a false-positive match', () => {
    const annualTopic: AIGeneratedAnnualPlanTopic = {
      title: 'Нешто сосема неповрзано',
      durationWeeks: 2,
      objectives: [],
      suggestedActivities: [],
    };
    expect(matchAnnualTopicToRealTopic(topics, annualTopic)).toBeUndefined();
  });
});
