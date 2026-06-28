import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonResourceHub } from './LessonResourceHub';

// ── Mock useLessonResources ───────────────────────────────────────────────────

const mockResources = vi.hoisted(() => ({
  scenarios: [] as unknown[],
  tests: [] as unknown[],
  extractedTasks: [] as unknown[],
  presentations: [] as unknown[],
  isLoading: false,
  error: null as string | null,
}));

vi.mock('../../hooks/useLessonResources', () => ({
  useLessonResources: () => mockResources,
  keywordMatch: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = {
  grade: 8,
  topicId: 'topic-1',
  theme: 'Линеарни равенки',
  uid: 'uid-teacher',
  onNavigate: vi.fn(),
  onImportScenario: vi.fn(),
};

describe('LessonResourceHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResources.scenarios = [];
    mockResources.tests = [];
    mockResources.extractedTasks = [];
    mockResources.presentations = [];
    mockResources.isLoading = false;
    mockResources.error = null;
  });

  it('shows loading skeleton while fetching', () => {
    mockResources.isLoading = true;
    render(<LessonResourceHub {...defaultProps} />);
    // Skeleton has animate-pulse divs
    const { container } = render(<LessonResourceHub {...defaultProps} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows empty-grade message when grade is missing', () => {
    render(<LessonResourceHub {...defaultProps} grade={null} />);
    expect(screen.getByText(/Внеси одделение/)).toBeTruthy();
  });

  it('shows empty state with CTA when no resources found', () => {
    render(<LessonResourceHub {...defaultProps} />);
    expect(screen.getByText(/Нема ресурси за оваа тема/)).toBeTruthy();
  });

  it('renders scenario cards when scenarios are present', () => {
    mockResources.scenarios = [
      {
        id: 's1',
        title: 'Сценарио за равенки',
        grade: 8,
        topicTitle: 'Линеарни равенки',
        authorName: 'д-р Кондинска',
        verifiedByBRO: true,
        ratingsByUid: { uid1: 5 },
        deleted: false,
        objectives: [],
        scenarioIntro: '',
        scenarioMain: [],
        scenarioConcluding: '',
        materials: [],
        assessmentStandards: [],
        bloomLevels: [],
        dokLevel: null,
        teachingModel: null,
        duration: 40,
        authorUid: 'a1',
        schoolName: 'ОУ',
        originalId: null,
        forkDepth: 0,
        publishedAt: null,
        forkCount: 0,
        usageCount: 0,
        savedByUids: [],
        isFeatured: false,
        isPublic: true,
        authorNotes: '',
        subject: 'Математика',
      },
    ];
    render(<LessonResourceHub {...defaultProps} />);
    expect(screen.getByText('Сценарио за равенки')).toBeTruthy();
    expect(screen.getByText('✓ БРО')).toBeTruthy();
  });

  it('calls onImportScenario when Увези button clicked', async () => {
    const onImport = vi.fn();
    const scenario = {
      id: 's1',
      title: 'Сценарио за равенки',
      grade: 8,
      topicTitle: 'Линеарни равенки',
      authorName: 'Наставник',
      verifiedByBRO: false,
      ratingsByUid: {},
      deleted: false,
      objectives: [],
      scenarioIntro: '',
      scenarioMain: [],
      scenarioConcluding: '',
      materials: [],
      assessmentStandards: [],
      bloomLevels: [],
      dokLevel: null,
      teachingModel: null,
      duration: 40,
      authorUid: 'a1',
      schoolName: '',
      originalId: null,
      forkDepth: 0,
      publishedAt: null,
      forkCount: 0,
      usageCount: 0,
      savedByUids: [],
      isFeatured: false,
      isPublic: true,
      authorNotes: '',
      subject: 'Математика',
    };
    mockResources.scenarios = [scenario];

    render(<LessonResourceHub {...defaultProps} onImportScenario={onImport} />);
    await userEvent.click(screen.getByText('Увези'));
    expect(onImport).toHaveBeenCalledWith(scenario);
  });

  it('shows error message when fetch fails', () => {
    mockResources.error = 'Permission denied';
    render(<LessonResourceHub {...defaultProps} />);
    expect(screen.getByText(/Не можам да ги вчитам/)).toBeTruthy();
  });
});
