const fs = require('fs');

// Add "Offline" feature and "Planner" to dashboard tour
let dashboardPath = 'tours/dashboard-tour-steps.ts';
let dContent = fs.readFileSync(dashboardPath, 'utf8');

// The dashboard tour steps is an array exported. I'll just append something before the `];`
// We need to find `];` safely.
dContent = dContent.replace(/];$/, `,
    {
        element: '[data-tour="dashboard-schedule"]',
        title: 'Управување и Планирање',
        intro: 'Овој дел стана уште помоќен! Пробајте го новиот "Планер" кој ви овозможува интелигентно да генерирате и организирате дневни планови.',
        position: 'top',
    },
    {
        title: 'Работа без интернет (Офлајн)',
        intro: 'Дури и кога ќе останете без интернет конекција, апликацијата продолжува да работи. Сите квизови и локални податоци ќе се зачуваат и подоцна ќе се синхронизираат!',
    }
];`);
fs.writeFileSync(dashboardPath, dContent);

// Add "Approvals" to Library Tour
let libraryPath = 'tours/library-tour-steps.ts';
let lContent = fs.readFileSync(libraryPath, 'utf8');
lContent = lContent.replace(/];$/, `,
    {
        element: '.bg-green-100', // Best effort generic selector for the new Approval button if it exists
        title: 'Одобрување (За сите)',
        intro: 'Ново! Наставниците можат да ги "Одобруваат" своите ресурси. Откако материјалот ќе биде одобрен, тој станува јавно видлив за сите.',
        position: 'top',
    }
];`);
fs.writeFileSync(libraryPath, lContent);

// Generator additions
let genPath = 'tours/generator-tour-steps.ts';
let contentGen = fs.readFileSync(genPath, 'utf8');
// Replace "AI генерира материјали..." intro to mention context
contentGen = contentGen.replace(
    'intro: \'Тука можете да го прегледате,',
    'intro: \'Ново: AI сега ги користи специфичните македонски контексти (имиња, градови, валути). Тука можете да го прегледате,'
);
fs.writeFileSync(genPath, contentGen);

