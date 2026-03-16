/**
 * useGeneratorTeacherNote — teacher annotation state + adaptive difficulty recommendation.
 * Handles: teacherNote CRUD, diffRec auto-apply, handleSaveTeacherNote.
 */
import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { DifferentiationLevel } from '../../types';
import type { GeneratorState, GeneratorAction } from '../useGeneratorState';
import {
  useTeacherNoteQuery,
  useDifficultyRecommendation,
  useSaveTeacherNote,
} from '../useGeneratorQueries';

interface UseGeneratorTeacherNoteParams {
  state: GeneratorState;
  firebaseUser: User | null;
  dispatch: React.Dispatch<GeneratorAction>;
}

export function useGeneratorTeacherNote({
  state,
  firebaseUser,
  dispatch,
}: UseGeneratorTeacherNoteParams) {
  const [teacherNote, setTeacherNote] = useState('');
  const [teacherNoteSaved, setTeacherNoteSaved] = useState(false);
  const [diffRec, setDiffRec] = useState<DifferentiationLevel | null>(null);

  const firstConceptId = state.selectedConcepts[0];

  // Reload note when concept or context type changes
  const { data: fetchedTeacherNote = '' } = useTeacherNoteQuery(
    firebaseUser?.uid, firstConceptId, state.contextType,
  );
  useEffect(() => {
    setTeacherNote(fetchedTeacherNote);
    setTeacherNoteSaved(false);
  }, [fetchedTeacherNote]);

  // Adaptive difficulty recommendation
  const { data: recommendedDiff } = useDifficultyRecommendation(firebaseUser?.uid, firstConceptId);
  useEffect(() => {
    if (recommendedDiff) {
      setDiffRec(recommendedDiff);
      if (state.differentiationLevel === 'standard') {
        dispatch({ type: 'SET_FIELD', payload: { field: 'differentiationLevel', value: recommendedDiff } });
      }
    } else {
      setDiffRec(null);
    }
  }, [recommendedDiff, state.differentiationLevel, dispatch]);

  const saveTeacherNoteMutation = useSaveTeacherNote();

  const handleSaveTeacherNote = () => {
    const conceptId = state.selectedConcepts[0];
    if (!firebaseUser?.uid || !conceptId) return;
    saveTeacherNoteMutation.mutate({ teacherUid: firebaseUser.uid, conceptId, note: teacherNote }, {
      onSuccess: () => {
        setTeacherNoteSaved(true);
        setTimeout(() => setTeacherNoteSaved(false), 2000);
      },
    });
  };

  return { teacherNote, setTeacherNote, teacherNoteSaved, diffRec, handleSaveTeacherNote };
}
