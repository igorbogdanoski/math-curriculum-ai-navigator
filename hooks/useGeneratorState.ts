
import { useReducer, useEffect, useRef } from 'react';
import { QuestionType, type MaterialType, type GenerationContextType, type StudentProfile, type DifferentiationLevel, type BloomDistribution, type DokLevel } from '../types';
import { useCurriculum } from './useCurriculum';
import type { VideoPreviewData } from '../utils/videoPreview';


// State
export interface GeneratorState {
    materialType: MaterialType | null;
    contextType: GenerationContextType | 'ACTIVITY' | null;
    selectedGrade: string;
    selectedTopic: string;
    selectedConcepts: string[];
    selectedStandard: string;
    scenarioText: string;
    selectedActivity: string;
    activityFocus: string;
    scenarioTone: string;
    learningDesignModel: string;
    numQuestions: number;
    questionTypes: QuestionType[];
    includeSelfAssessment: boolean;
    includeIllustration: boolean;
    includeWorkedExamples?: boolean;
    bloomDistribution: BloomDistribution;
    useStudentProfiles: boolean;
    selectedStudentProfileIds: string[];
    differentiationLevel: DifferentiationLevel;
    generateAllLevels: boolean; // П-Ѓ: generate Поддршка + Стандард + Предизвик simultaneously
    exitTicketQuestions: number;
    exitTicketFocus: string;
    activityTitle: string;
    activityType: string;
    criteriaHints: string;
    illustrationPrompt: string;
    videoUrl: string;
    videoPreview: VideoPreviewData | null;
    videoTranscript: string | null;
    videoTranscriptSegments: Array<{ startMs: number; endMs: number; text: string }>;
    imageFile: { file: File, base64: string, previewUrl: string } | null;
    webpageUrl: string;
    webpageBatchUrls: string;
    webpageText: string | null;
    webpageExtractMeta: {
        sourceUrls: string[];
        sourceTypes: Array<'webpage' | 'pdf'>;
        extractionModes: Array<'html-static' | 'html-reader-fallback' | 'pdf-native' | 'pdf-ocr-fallback'>;
        charCount: number;
        truncated: boolean;
        failedUrls?: string[];
    } | null;
    customInstruction: string;
    useMacedonianContext: boolean;
    aiTone: 'creative' | 'formal' | 'friendly' | 'expert' | 'playful';
    aiVocabLevel: 'simplified' | 'standard' | 'advanced';
    aiStyle: 'standard' | 'socratic' | 'direct' | 'inquiry' | 'problem';
    /** Webb's DoK target: specific level 1-4, 'mixed' for balanced distribution, undefined = auto */
    dokTarget?: DokLevel | 'mixed';
    /** Raw text extracted by IMAGE_EXTRACTOR (vision analysis result) — used for pre-fill pipeline */
    extractedText: string | null;
}

// Actions
export type GeneratorAction =
    | { type: 'INITIALIZE'; payload: Partial<GeneratorState> }
    | { type: 'SET_FIELD'; payload: { field: keyof GeneratorState; value: any } }
    | { type: 'SET_GRADE'; payload: string }
    | { type: 'SET_TOPIC'; payload: string }
    | { type: 'SET_CONTEXT_TYPE'; payload: GenerationContextType | 'ACTIVITY' | null }
    | { type: 'TOGGLE_QUESTION_TYPE'; payload: QuestionType };


export const getInitialState = (curriculum: any, allNationalStandards: any): GeneratorState => {
    const defaultGradeId = curriculum?.grades?.[0]?.id || '';
    const defaultTopicId = curriculum?.grades?.[0]?.topics?.[0]?.id || '';
    const defaultStandardId = allNationalStandards?.[0]?.id || '';

    return {
        materialType: 'SCENARIO',
        contextType: 'CONCEPT',
        selectedGrade: defaultGradeId,
        selectedTopic: defaultTopicId,
        selectedConcepts: [],
        selectedStandard: defaultStandardId,
        scenarioText: '',
        selectedActivity: '',
        activityFocus: 'Conceptual understanding',
        scenarioTone: 'Creative and engaging',
        learningDesignModel: 'Standard',
        numQuestions: 5,
        questionTypes: [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER, QuestionType.TRUE_FALSE],
        includeSelfAssessment: false,
        includeIllustration: false,
        includeWorkedExamples: false,
        bloomDistribution: {},
        useStudentProfiles: false,
        selectedStudentProfileIds: [],
        differentiationLevel: 'standard',
        generateAllLevels: false,
        exitTicketQuestions: 2,
        exitTicketFocus: 'Проверка на разбирање',
        activityTitle: '',
        activityType: 'Проект',
        criteriaHints: '',
        illustrationPrompt: '',
        videoUrl: '',
        videoPreview: null,
        videoTranscript: null,
        videoTranscriptSegments: [],
        imageFile: null,
        webpageUrl: '',
        webpageBatchUrls: '',
        webpageText: null,
        webpageExtractMeta: null,
        customInstruction: '',
        useMacedonianContext: true,
        aiTone: 'creative',
        aiVocabLevel: 'standard',
        aiStyle: 'standard',
        dokTarget: undefined,
        extractedText: null,
    };
};

// Reducer
function generatorReducer(state: GeneratorState, action: GeneratorAction): GeneratorState {
    switch (action.type) {
        case 'INITIALIZE':
            return { ...state, ...action.payload };
        case 'SET_FIELD':
            return { ...state, [action.payload.field]: action.payload.value };
        case 'SET_GRADE': {
            const gradeId = action.payload;
            return {
                ...state,
                selectedGrade: gradeId,
                selectedTopic: '', // Reset topic and concepts
                selectedConcepts: [],
                selectedActivity: '',
            };
        }
        case 'SET_TOPIC': {
            const topicId = action.payload;
            return {
                ...state,
                selectedTopic: topicId,
                selectedConcepts: [],
                selectedActivity: '',
            };
        }
        case 'SET_CONTEXT_TYPE': {
             const contextType = action.payload;
             // Reset specific fields when context type changes to avoid stale data
            const newState = { ...state, contextType };
            if (contextType !== 'CONCEPT' && contextType !== 'ACTIVITY') {
                newState.selectedConcepts = [];
                newState.selectedActivity = '';
            }
            if(contextType !== 'SCENARIO') {
                newState.scenarioText = '';
            }
            return newState;
        }
        case 'TOGGLE_QUESTION_TYPE': {
            const type = action.payload;
            const newQuestionTypes = state.questionTypes.includes(type)
                ? state.questionTypes.filter(t => t !== type)
                : [...state.questionTypes, type];
            return { ...state, questionTypes: newQuestionTypes };
        }
        default:
            return state;
    }
}

// Hook
export function useGeneratorState(props: Partial<GeneratorState> = {}) {
    const { curriculum, allNationalStandards, isLoading } = useCurriculum();
    const initialState = getInitialState(curriculum, allNationalStandards);

    const [state, dispatch] = useReducer(generatorReducer, initialState);

    const serializedProps = JSON.stringify(props);

    const lastInitializedProps = useRef<string>('');

    useEffect(() => {
        if (!isLoading && serializedProps !== lastInitializedProps.current) {
            const initialPropsWithDefaults = { ...initialState, ...props };
            dispatch({ type: 'INITIALIZE', payload: initialPropsWithDefaults });
            lastInitializedProps.current = serializedProps;
        }
    }, [isLoading, serializedProps, curriculum, allNationalStandards, initialState]);

    return [state, dispatch] as const;
}
