import fs from 'fs';
import { educationalHints } from './data/educationalModelsInfo.js';
import { slugify } from './utils/slugify.js';

const contentDB = {};

// Pedagogical
for (const [key, val] of Object.entries(educationalHints.pedagogicalModels)) {
  const id = slugify('model ' + key);
  contentDB[id] = {
    id,
    type: 'model',
    generatorKey: key,
    title: val.title,
    theory: [
      val.text,
      "Овој пристап овозможува посистематски развој на лекцијата и зголемен ангажман."
    ],
    cognitiveBenefit: "Помага во подобро апсорбирање на материјата и критичко размислување.",
    mathExample: val.example
  };
}

// Tones
for (const [key, val] of Object.entries(educationalHints.tones)) {
  const id = slugify('tone ' + key);
  contentDB[id] = {
    id,
    type: 'tone',
    generatorKey: key,
    title: 'Тон: ' + key,
    theory: [
      val.text,
      "Креирањето на правилен тон ја менува атмосферата на целиот час."
    ],
    cognitiveBenefit: "Ја зголемува мотивацијата и емоционалната поврзаност со математиката.",
    mathExample: val.example
  };
}

// Focuses
for (const [key, val] of Object.entries(educationalHints.focuses)) {
  const id = slugify('focus ' + key);
  contentDB[id] = {
    id,
    type: 'focus',
    generatorKey: key,
    title: 'Фокус: ' + key,
    theory: [
      val.text,
      "Фокусот одредува кој дел од когнитивниот процес е најважен во оваа лекција."
    ],
    cognitiveBenefit: "Овозможува таргетирано развивање на специфични вештини кај учениците.",
    mathExample: val.example
  };
}

const fileOutput = `import { GeneratorState } from '../../types';

export type AcademyItemType = 'model' | 'udl' | 'bloom' | 'tech' | 'tone' | 'focus';

export interface AcademyLesson {
  id: string;
  type: AcademyItemType;
  title: string;
  theory: string[];
  cognitiveBenefit: string;
  mathExample: string;
  generatorKey: string;
}

export const ACADEMY_CONTENT: Record<string, AcademyLesson> = ${JSON.stringify(contentDB, null, 2)};
`;

fs.writeFileSync('data/academy/content.ts', fileOutput);
console.log('Built content.ts');
