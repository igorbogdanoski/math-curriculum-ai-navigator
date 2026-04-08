# Vision + RAG Contracts v1

> Date: 2026-04-08
> Status: DRAFT FOR IMPLEMENTATION (P0.1)

## 1. homework_feedback contract

Purpose:
Pedagogically rich feedback for a single student homework scan.

Input:
- scanRef: string
- mimeType: string
- imageBase64: string
- gradeLevel: number
- topicId?: string
- conceptIds?: string[]
- detailMode: 'standard' | 'detailed'

Output schema (required fields):
- summary: string
- strengths: string[]
- mistakes: Array<{
  itemRef: string;
  misconceptionType: string;
  whyItIsWrong: string;
  correctionSteps: string[];
}>
- nextSteps: string[]
- estimatedMastery: number
- ragMeta: {
  conceptIds: string[];
  topicId?: string;
  gradeLevel: number;
  evidenceSpans: Array<{ claim: string; source: string }>;
}

Validation rules:
- strengths.length >= 1
- mistakes[].correctionSteps.length >= 1
- estimatedMastery between 0 and 100
- ragMeta.conceptIds can be empty only if no reliable mapping is found

---

## 2. test_grading contract

Purpose:
Per-question structured grading for handwritten written tests.

Input:
- scanRef: string
- mimeType: string
- imageBase64: string
- questions: Array<{
  id: string;
  text: string;
  points: number;
  correctAnswer: string;
  conceptId?: string;
}>
- gradeLevel: number
- topicId?: string

Output schema (required fields):
- grades: Array<{
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
  feedback: string;
  misconception?: string;
  correctionHint?: string;
  confidence: number;
}>
- total: {
  earned: number;
  max: number;
  percentage: number;
}
- pedagogy: {
  classLevelGaps: string[];
  remediationActions: string[];
}
- ragMeta: {
  conceptIds: string[];
  topicId?: string;
  gradeLevel: number;
}

Validation rules:
- grades length must equal input questions length
- 0 <= earnedPoints <= maxPoints
- 0 <= confidence <= 1
- total values must be internally consistent

---

## 3. content_extraction contract

Purpose:
Extract educational content from scanned books/magazines/notes for generator and archive.

Input:
- sourceType: 'image' | 'pdf' | 'web' | 'video'
- sourceRef: string
- extractedRawText?: string
- mediaData?: string
- gradeLevel?: number
- topicId?: string
- conceptIds?: string[]

Output schema (required fields):
- formulas: string[]
- theories: string[]
- tasks: string[]
- normalizedText: string
- quality: {
  score: number;
  label: 'poor' | 'fair' | 'good' | 'excellent';
  truncated: boolean;
}
- ragMeta: {
  conceptIds: string[];
  topicId?: string;
  gradeLevel?: number;
  sourceEvidence: Array<{ itemType: 'formula' | 'theory' | 'task'; text: string }>;
}

Validation rules:
- normalizedText length >= 50 for available=true cases
- quality.score in [0,100]
- if quality.label is poor, UI must show caution badge

---

## 4. Shared runtime policies

- JSON schema validation required for all contracts.
- If schema validation fails:
  1. one automatic retry with stricter instruction,
  2. then controlled fallback response with explicit UI warning.
- No silent empty arrays as success.
- Every successful run writes archive metadata record.

---

## 5. Test expectations for P0/P1

- Unit tests for schema validation and fallback logic.
- Integration tests for end-to-end request->validated-output path.
- Snapshot examples for standard vs detailed homework mode.
