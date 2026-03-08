const fs = require('fs');
let content = fs.readFileSync('views/CurriculumGraphView.tsx', 'utf8');

// Add state
content = content.replace(
    'const [isClustered, setIsClustered] = useState(false);',
    "const [isClustered, setIsClustered] = useState(false);\n    const [isFullscreen, setIsFullscreen] = useState(false);"
);

// Add export function
content = content.replace(
    'const handleSearchSelect = (conceptId: string) => {',
    "const handleExportImage = () => {\n        if (!graphRef.current) return;\n        // network.canvas.getContext() is another way, but getting the DOM canvas element is easiest\n        const canvas = graphRef.current.querySelector('canvas');\n        if (canvas) {\n            // Save current background\n            const ctx = canvas.getContext('2d');\n            if(ctx) {\n                ctx.globalCompositeOperation = 'destination-over';\n                ctx.fillStyle = '#ffffff';\n                ctx.fillRect(0, 0, canvas.width, canvas.height);\n            }\n            const url = canvas.toDataURL('image/png');\n            const a = document.createElement('a');\n            a.href = url;\n            a.download = curriculum-graph.png;\n            a.click();\n        }\n    };\n\n    const handleSearchSelect = (conceptId: string) => {"
);

// Find Card and add fullscreen classes and buttons
let oldCard = '<Card className="p-0 relative border-2 border-gray-200 flex-1 min-h-[500px]">';
let newCard = 
      <Card className={isFullscreen ? 'fixed inset-0 z-[100] bg-white m-0 rounded-none h-screen w-screen' : 'p-0 relative border-2 border-gray-200 flex-1 min-h-[500px]'}>
        <div className="absolute top-4 right-4 z-50 flex gap-2">
            <button onClick={handleExportImage} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-brand-primary border border-gray-200" title="Зачувај како слика">
                <ICONS.download className="w-5 h-5" />
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-brand-primary border border-gray-200" title={isFullscreen ? "Излези од цел екран" : "Цел екран"}>
                {isFullscreen ? <ICONS.close className="w-5 h-5" /> : <ICONS.maximize className="w-5 h-5" />}
            </button>
        </div>
;

content = content.replace(oldCard, newCard);

fs.writeFileSync('views/CurriculumGraphView.tsx', content, 'utf8');
console.log('UI Updated');
