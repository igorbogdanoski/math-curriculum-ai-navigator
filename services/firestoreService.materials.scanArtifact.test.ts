import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addDocMock, collectionMock, serverTimestampMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  collectionMock: vi.fn(),
  serverTimestampMock: vi.fn(() => 'mock-ts'),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    addDoc: addDocMock,
    collection: collectionMock,
    serverTimestamp: serverTimestampMock,
  };
});

vi.mock('../firebaseConfig', () => ({
  db: { __test: true },
}));

import { saveScanArtifactRecord } from './firestoreService.materials';

describe('saveScanArtifactRecord', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    collectionMock.mockReset();
    serverTimestampMock.mockClear();
  });

  it('writes scan artifact to scan_artifacts with createdAt and updatedAt timestamps', async () => {
    collectionMock.mockReturnValue('scan_artifacts_ref');
    addDocMock.mockResolvedValue({ id: 'artifact-001' });

    const id = await saveScanArtifactRecord({
      teacherUid: 'teacher-1',
      schoolId: 'school-1',
      mode: 'homework_feedback',
      sourceType: 'image',
      conceptIds: ['c1-1'],
      extractedText: 'x + 2 = 5',
      pedagogicalFeedback: [
        {
          itemRef: 'q1',
          feedback: 'Recheck subtraction step.',
        },
      ],
      artifactQuality: {
        score: 0.82,
        label: 'good',
      },
    });

    expect(id).toBe('artifact-001');
    expect(collectionMock).toHaveBeenCalledWith(expect.anything(), 'scan_artifacts');
    expect(addDocMock).toHaveBeenCalledTimes(1);
    expect(serverTimestampMock).toHaveBeenCalledTimes(2);

    const payload = addDocMock.mock.calls[0][1];
    expect(payload).toMatchObject({
      teacherUid: 'teacher-1',
      schoolId: 'school-1',
      mode: 'homework_feedback',
      sourceType: 'image',
      extractedText: 'x + 2 = 5',
      artifactQuality: {
        score: 0.82,
        label: 'good',
      },
    });
    expect(payload.createdAt).toBe('mock-ts');
    expect(payload.updatedAt).toBe('mock-ts');
  });
});
