const fs = require('fs');
let code = fs.readFileSync('components/ai/InteractiveQuizPlayer.tsx', 'utf8');

const regex = /<div className="grid gap-3">[\s\S]*?(?=<\/div>\s*\{\/\* FEEDBACK SECTION \*\/})/m;
const replacement = `{currentQ?.isWorkedExample ? (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-bold text-blue-900">Решен пример</h3>
              </div>
              <div className="prose prose-sm max-w-none text-blue-800 break-words overflow-hidden max-w-full">
                <MathRenderer text={currentQ.explanation || currentQ.answer || ''} />
              </div>
              <button
                onClick={nextQuestion}
                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Разбрав, оди понатаму</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
<>
          $&
          </>
          )}

`;

// let's do more explicit replacement instead of capturing everything.
const oldGridStr = `<div className="grid gap-3">`;

const replaceGridStr = `{currentQ?.isWorkedExample ? (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-bold text-blue-900">Решен пример</h3>
              </div>
              <div className="prose prose-sm max-w-none text-blue-800 break-words overflow-hidden max-w-full">
                <MathRenderer text={currentQ.explanation || currentQ.answer || ''} />
              </div>
              <button
                onClick={nextQuestion}
                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Разбрав, оди понатаму</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
          <div className="grid gap-3">`;

code = code.replace(oldGridStr, replaceGridStr);

const endTargetStr = `          {/* FEEDBACK SECTION */}
          {selectedOption && (`;

const endReplaceStr = `          )}

          {/* FEEDBACK SECTION */}
          {selectedOption && !currentQ?.isWorkedExample && (`;

code = code.replace(endTargetStr, endReplaceStr);

const timerEffectTarget = `if (isTimerRunning && timeLeft > 0 && !showResult) {`;
const timerEffectReplacementStr = `const isWorkedExample = normalizedQuestions[currentIndex]?.isWorkedExample;
    if (isTimerRunning && timeLeft > 0 && !showResult && !isWorkedExample) {`;
code = code.replace(timerEffectTarget, timerEffectReplacementStr);

const timeUpTarget = `} else if (timeLeft === 0 && isTimerRunning && !showResult) {`;
const timeUpReplaceTarget = `} else if (timeLeft === 0 && isTimerRunning && !showResult && !isWorkedExample) {`;
code = code.replace(timeUpTarget, timeUpReplaceTarget);

const effectDepTarget = `}, [timeLeft, isTimerRunning, showResult]);`;
const effectDepReplace = `}, [timeLeft, isTimerRunning, showResult, currentIndex, normalizedQuestions]);`;
code = code.replace(effectDepTarget, effectDepReplace);


fs.writeFileSync('components/ai/InteractiveQuizPlayer.tsx', code);
console.log('patched p6 render');