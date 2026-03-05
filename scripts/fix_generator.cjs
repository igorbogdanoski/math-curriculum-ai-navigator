const fs = require('fs');

const run = () => {
    let content = fs.readFileSync('views/MaterialsGeneratorView.tsx', 'utf8');

    // First remove the botched materialOptions and `t` from outside if they exist
    const regexRemove = /  const { t } = useLanguage\(\);\s+const materialOptions[\s\S]*?\];/g;
    content = content.replace(regexRemove, '');

    // Now inject it correctly into MaterialsGeneratorView
    const replacement = `export const MaterialsGeneratorView: React.FC<Partial<GeneratorState>> = (props: Partial<GeneratorState>) => {
  const { t } = useLanguage();
  const materialOptions: { id: MaterialType; label: string; icon: keyof typeof ICONS }[] = [ { id: 'SCENARIO', label: t('generator.types.scenario'), icon: 'lightbulb' }, { id: 'LEARNING_PATH', label: t('generator.types.path'), icon: 'mindmap' }, { id: 'ASSESSMENT', label: t('generator.types.assessment'), icon: 'generator' }, { id: 'RUBRIC', label: t('generator.types.rubric'), icon: 'edit' }, { id: 'FLASHCARDS', label: t('generator.types.flashcards'), icon: 'flashcards' }, { id: 'QUIZ', label: t('generator.types.quiz'), icon: 'quiz' }, { id: 'EXIT_TICKET', label: t('generator.types.exitTicket'), icon: 'quiz' }, { id: 'ILLUSTRATION', label: t('generator.types.illustration'), icon: 'gallery' } ];
`;

    if (!content.includes("const materialOptions: { id: MaterialType; label: string; icon: keyof typeof ICONS }[] = [ { id: 'SCENARIO'")) {
        content = content.replace("export const MaterialsGeneratorView: React.FC<Partial<GeneratorState>> = (props: Partial<GeneratorState>) => {", replacement);
    }
    
    fs.writeFileSync('views/MaterialsGeneratorView.tsx', content, 'utf8');
};

run();
