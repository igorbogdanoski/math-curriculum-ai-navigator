const fs = require('fs');
let code = fs.readFileSync('components/ai/InteractiveQuizPlayer.tsx', 'utf-8');

const oldGridStr = `<div className="grid gap-3">`;

const replaceGridStr = `{currentQ.isWorkedExample ? (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-bold text-blue-900">Решен пример</h3>
              </div>
              <div className="prose prose-sm max-w-none text-blue-800">
                <MathRenderer text={currentQ.explanation || currentQ.answer || ''} />
              </div>
              <button
                onClick={nextQuestion}
                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Разбрав (Оди Понатаму)</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="grid gap-3">`;

code = code.replace(oldGridStr, replaceGridStr);

const endTargetStr = `{/* FEEDBACK SECTION */}
          {selectedOption && (
            <div className="mt-10 pt-8 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">`;

const endReplaceStr = `)}

          {/* FEEDBACK SECTION */}
          {selectedOption && !currentQ.isWorkedExample && (
            <div className="mt-10 pt-8 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">`;

code = code.replace(endTargetStr, endReplaceStr);


const timerEffectTarget = `if (isTimerRunning && timeLeft > 0 && !showResult) {`;
const timerEffectReplacementStr = `if (isTimerRunning && timeLeft > 0 && !showResult && !currentQ?.isWorkedExample) {`;
code = code.replace(timerEffectTarget, timerEffectReplacementStr);

fs.writeFileSync('components/ai/InteractiveQuizPlayer.tsx', code);
console.log('patched');
