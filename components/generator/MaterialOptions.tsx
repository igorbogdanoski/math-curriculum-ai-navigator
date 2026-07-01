import React from 'react';
import type { GeneratorState, GeneratorAction } from '../../hooks/useGeneratorState';
import type { TeachingProfile } from '../../types';
import { AssessmentOptions }    from './options/AssessmentOptions';
import { ScenarioOptions }      from './options/ScenarioOptions';
import { ExitTicketOptions }    from './options/ExitTicketOptions';
import { RubricOptions }        from './options/RubricOptions';
import { IllustrationOptions }  from './options/IllustrationOptions';
import { LearningPathOptions }  from './options/LearningPathOptions';
import { VideoExtractorOptions } from './options/VideoExtractorOptions';
import { ImageExtractorOptions } from './options/ImageExtractorOptions';
import { WebExtractorOptions }  from './options/WebExtractorOptions';

interface MaterialOptionsProps {
    state: GeneratorState;
    dispatch: React.Dispatch<GeneratorAction>;
    user: TeachingProfile | null;
}

export const MaterialOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => {
    const { materialType } = state;
    if (!materialType) return null;

    if (['ASSESSMENT', 'FLASHCARDS', 'QUIZ'].includes(materialType)) return <AssessmentOptions    state={state} dispatch={dispatch} user={user} />;
    if (materialType === 'SCENARIO')         return <ScenarioOptions       state={state} dispatch={dispatch} />;
    if (materialType === 'EXIT_TICKET')      return <ExitTicketOptions     state={state} dispatch={dispatch} />;
    if (materialType === 'RUBRIC')           return <RubricOptions         state={state} dispatch={dispatch} />;
    if (materialType === 'ILLUSTRATION')     return <IllustrationOptions   state={state} dispatch={dispatch} />;
    if (materialType === 'LEARNING_PATH')    return <LearningPathOptions   state={state} dispatch={dispatch} user={user} />;
    if (materialType === 'VIDEO_EXTRACTOR')  return <VideoExtractorOptions state={state} dispatch={dispatch} />;
    if (materialType === 'IMAGE_EXTRACTOR')  return <ImageExtractorOptions state={state} dispatch={dispatch} />;
    if (materialType === 'WEB_EXTRACTOR')    return <WebExtractorOptions   state={state} dispatch={dispatch} />;

    return null;
};
