const fs = require('fs');
let code = fs.readFileSync('views/AcademyView.tsx', 'utf8');

code = code.replace(
  /export const AcademyView: React.FC = \(\) => \{/,
  "import { useNavigation } from '../contexts/NavigationContext';\n\nexport const AcademyView: React.FC = () => {\n  const { navigate } = useNavigation();"
);

code = code.replace(
  /const MODULES = \[\s*\{\s*id: 'models'[\s\S]*?topics: \['5Е Модел', 'Gagné-ови 9 настани', 'Учење базирано на проблеми \(УБП\)'\]\s*\},/g,
  `const MODULES = [
  {
    id: 'models',
    title: 'Модели за дизајн на часови',
    description: 'Истражете структурирани пристапи за планирање како 5E, Gagné и Flipped Classroom кои обезбедуваат длабоко разбирање.',
    icon: Shapes,
    color: 'bg-blue-50 text-blue-600',
    borderColor: 'border-blue-200',
    topics: [{title: '5Е Модел', id: '5e'}, {title: 'Gagné-ови 9 настани', id: 'gagne'}, {title: 'Креативно сценарио', id: 'creative-tone'}]
  },`
);

code = code.replace(
  /topics: \['Повеќекратно претставување', 'Повеќе начини на изразување', 'Системи на ангажирање'\]/,
  "topics: [{title: 'Повеќекратно претставување', id: 'udl'}, {title: 'Повеќе начини на изразување', id: 'udl'}, {title: 'Системи на ангажирање', id: 'udl'}]"
);

code = code.replace(
  /topics: \['Формулација на прашања', 'Дизајн на проекти', 'Критичко мислење'\]/,
  "topics: [{title: 'Формулација на прашања'}, {title: 'Дизајн на проекти'}, {title: 'Критичко мислење'}]"
);

code = code.replace(
  /topics: \['Substitution \(Замена\)', 'Augmentation \(Збогатување\)', 'Modification \(Модификација\)', 'Redefinition \(Редефинирање\)'\]/,
  "topics: [{title: 'Substitution (Замена)'}, {title: 'Augmentation (Збогатување)'}, {title: 'Modification (Модификација)'}, {title: 'Redefinition (Редефинирање)'}]"
);

code = code.replace(
  /\{module\.topics\.map\(\(topic, i\) => \([\s\S]*?<\/li>\s*\)\)\}/,
  `{module.topics.map((topic, i) => (
                    <li 
                      key={i} 
                      onClick={(e) => { 
                        if(topic.id) { 
                          e.stopPropagation(); 
                          navigate('/academy/lesson/' + topic.id); 
                        } 
                      }}
                      className={\`text-xs px-2.5 py-1.5 \${topic.id ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/20 cursor-pointer' : 'bg-gray-50 border-gray-100 text-gray-700'} border rounded-md transition-colors\`}
                    >
                      {topic.title}
                    </li>
                  ))}`
);

// Remove the overlay that says "Фаза 3" since we are in Phase 3
code = code.replace(/<div className="absolute inset-0 bg-white\/40 backdrop-blur-\[2px\][\s\S]*?<\/div>\s*<\/div>/, '');

fs.writeFileSync('views/AcademyView.tsx', code, 'utf8');
console.log('patched');