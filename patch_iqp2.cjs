const fs = require('fs');
let code = fs.readFileSync('components/ai/InteractiveQuizPlayer.tsx', 'utf8');
code = code.replace(/<div className="flex flex-col flex-1 min-w-\[120px\]">[\s\S]*?<\/h2>\s*<\/div>/, `<div className="flex flex-col flex-1 min-w-[120px] gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Прашање {currentIndex + 1}/{normalizedQuestions.length}</span>
                {currentQ?.cognitiveLevel && (
                  <span className={\`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-sm \${currentQ.cognitiveLevel === 'Remembering' ? 'bg-slate-100 text-slate-600' : currentQ.cognitiveLevel === 'Understanding' ? 'bg-green-100 text-green-700' : currentQ.cognitiveLevel === 'Applying' ? 'bg-blue-100 text-blue-700' : currentQ.cognitiveLevel === 'Analyzing' ? 'bg-purple-100 text-purple-700' : currentQ.cognitiveLevel === 'Evaluating' ? 'bg-pink-100 text-pink-700' : currentQ.cognitiveLevel === 'Creating' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}\`}>
                    {currentQ.cognitiveLevel}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-bold text-gray-700 line-clamp-1">{quizTitle}</h2>
            </div>`);
fs.writeFileSync('components/ai/InteractiveQuizPlayer.tsx', code);
