const fs = require('fs');
let code = fs.readFileSync('views/StudentPlayView.tsx', 'utf-8');
code = code.replace(/(\{\/\* ── П26: Confidence Self-Assessment)/, `{/* ── П5: Peer Learning ────────────────────────────────────────── */}
        {quizResult && peerSuggestions.length > 0 && (
          <div className="w-full max-w-4xl mt-3 bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-emerald-300" />
              <p className="text-white font-bold text-sm">Побарај помош од другарче</p>
            </div>
            <p className="text-white/90 text-sm leading-relaxed">
              Ова веќе го совладаа: <strong className="text-emerald-300">{peerSuggestions.join(', ')}</strong>. Можеш да ги замолиш да ти помогнат и објаснат.
            </p>
          </div>
        )}

        $1`);
fs.writeFileSync('views/StudentPlayView.tsx', code);
console.log('done');