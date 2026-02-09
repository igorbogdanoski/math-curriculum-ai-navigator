import { type Curriculum, type VerticalProgressionAnalysis, type NationalStandard } from '../types';
import { grade6Data } from './grade6';
import { grade7Data } from './grade7';
import { grade8Data } from './grade8';
import { grade9Data } from './grade9';
import { vProgressionData } from './verticalProgression';
import { nationalStandards } from './national-standards';

export interface CurriculumModule {
    curriculumData: Curriculum;
    verticalProgressionData: VerticalProgressionAnalysis;
    nationalStandardsData: NationalStandard[];
}

const curriculumData: Curriculum = {
    grades: [
        grade6Data,
        grade7Data,
        grade8Data,
        grade9Data,
    ],
};

export const fullCurriculumData: CurriculumModule = {
    curriculumData,
    verticalProgressionData: vProgressionData,
    nationalStandardsData: nationalStandards,
};