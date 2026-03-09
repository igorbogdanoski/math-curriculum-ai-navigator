const fs = require('fs');
let code = fs.readFileSync('views/AnnualPlanGeneratorView.tsx', 'utf8');

// remove duplicate DndContext imports
code = code.replace(/import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit\/core';\r?\nimport { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit\/sortable';\r?\nimport { CSS } from '@dnd-kit\/utilities';\r?\n/, '');

// Now let's remove the block from the FIRST interface SortableTopicProps up to the second one.
const index1 = code.indexOf('interface SortableTopicProps {');
const index2 = code.indexOf('interface SortableTopicProps {', index1 + 10);

if (index1 !== -1 && index2 !== -1) {
  code = code.substring(0, index1) + code.substring(index2);
}

fs.writeFileSync('views/AnnualPlanGeneratorView.tsx', code);
console.log('Fixed syntax dupes');
