const fs = require('fs');

const viewFile = 'views/AnnualPlanGeneratorView.tsx';
let code = fs.readFileSync(viewFile, 'utf8');

// Add imports
const imports = `import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';`;

code = code.replace(/import { useAuth } from '\.\.\/contexts\/AuthContext';/, `import { useAuth } from '../contexts/AuthContext';\n${imports}`);

// Create a SortableTopic component at the top of the file
const sortableComponent = `
interface SortableTopicProps {
    topic: AIGeneratedAnnualPlanTopic;
    id: string; // Use index or unique string as id
    idx: number;
}

const SortableTopic: React.FC<SortableTopicProps> = ({ topic, id, idx }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: isDragging ? 'relative' as const : 'static' as const,
        opacity: isDragging ? 0.9 : 1,
        boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
    };

    return (
        <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-xl bg-gray-50 mb-6 bg-white overflow-hidden transition-all duration-200">
            <div className="flex justify-between items-center p-4 bg-gray-100/50 border-b border-gray-200" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-3">
                    <div className="text-gray-400 hover:text-gray-600">
                        {/* Drag Handle Icon Inline */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </div>
                    <span className="bg-white border text-gray-600 w-8 h-8 flex items-center justify-center rounded-full shadow-sm text-sm">
                        {idx + 1}
                    </span>
                    {topic.title}
                </h3>
                <span className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full shadow-sm border border-blue-100 flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {topic.durationWeeks} недели
                </span>
            </div>
            
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-brand-primary text-sm mb-3 flex items-center gap-2">
                        {/* Assessment Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        Очекувани резултати / Цели
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
                        {topic.objectives.map((obj, i) => (
                            <li key={i} className="leading-snug">{obj}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-brand-accent text-sm mb-3 flex items-center gap-2">
                        {/* Sparkles Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 21v-8a2 2 0 0 1 2-2h8"></path><polygon points="16 7 20 11 16 15"></polygon><line x1="4" y1="11" x2="10" y2="11"></line></svg>
                        Предложени активности
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
                        {topic.suggestedActivities.map((act, i) => (
                            <li key={i} className="leading-snug">{act}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};
`;

code = code.replace(/export const AnnualPlanGeneratorView: React\.FC = \(\) => {/, `${sortableComponent}\nexport const AnnualPlanGeneratorView: React.FC = () => {`);

// Set up DND hooks inside component
const dndHooks = `
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id && plan) {
            const oldIndex = parseInt(active.id.split('-')[1]);
            const newIndex = parseInt(over.id.split('-')[1]);
            
            const newPlan = { ...plan };
            newPlan.topics = arrayMove(newPlan.topics, oldIndex, newIndex);
            
            setPlan(newPlan);
        }
    };
`;

code = code.replace(/(const handlePrint = useReactToPrint\(\{)/, `${dndHooks}\n    $1`);

// Replace the rendering mapping with DND Context
const oldMappingRegex = /<div className="space-y-6 print:p-8 print:bg-white" ref=\{printRef\}>\s*\{plan\.topics\.map\(\(topic, idx\) => \([\s\S]*?\}\)\)\s*<\/div>/m;


const newMapping = `<div className="space-y-6 print:p-8 print:bg-white" ref={printRef}>
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={plan.topics.map((_, i) => \`topic-\${i}\`)} strategy={verticalListSortingStrategy}>
                                        {plan.topics.map((topic, idx) => (
                                            <SortableTopic key={\`topic-\${idx}\`} id={\`topic-\${idx}\`} topic={topic} idx={idx} />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            </div>`;

code = code.replace(oldMappingRegex, newMapping);

fs.writeFileSync(viewFile, code, 'utf8');
console.log('Successfully implemented DND Reordering UI.');

