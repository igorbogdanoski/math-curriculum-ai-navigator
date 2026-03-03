import { type Curriculum, type VerticalProgressionAnalysis, type NationalStandard } from '../types';
import { grade1Data } from './grade1';
import { grade2Data } from './grade2';
import { grade3Data } from './grade3';
import { grade4Data } from './grade4';
import { grade5Data } from './grade5';
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
        grade1Data,
        grade2Data,
        grade3Data,
        grade4Data,
        grade5Data,
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