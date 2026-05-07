/**
 * ProbabilitySimulator (T4.2)
 *
 * Coins / dice / urn experiments with live observed-vs-theoretical histograms.
 * Used in MaturaTutorChat ("Експеримент") and AcademyLessonView for kombinatorika.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Dices, Coins, ShoppingBag, Play, RefreshCw } from 'lucide-react';
import {
  defaultRng,
  drawFromUrn, flipCoin, rollDie,
  type ExperimentKind,
} from './probabilitySimulatorHelpers';

export interface ProbabilitySimulatorProps {
  initialKind?: ExperimentKind;
  initialN?: number;
}

interface HistogramBar {
  label: string;
  observed: number;     // 0..1
  expected: number;     // 0..1
  count: number;
}

const KIND_TABS: { key: ExperimentKind; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'coin', label: 'Паричка',  Icon: Coins },
  { key: 'die',  label: 'Коцка',    Icon: Dices },
  { key: 'urn',  label: 'Урна',     Icon: ShoppingBag },
];

export const ProbabilitySimulator: React.FC<ProbabilitySimulatorProps> = ({
  initialKind = 'coin',
  initialN = 50,
}) => {
  const [kind, setKind] = useState<ExperimentKind>(initialKind);
  const [n, setN] = useState<number>(initialN);

  // Coin
  const [pHeads, setPHeads] = useState(0.5);

  // Die
  const [faces, setFaces] = useState(6);

  // Urn
  const [urnRed, setUrnRed] = useState(3);
  const [urnBlue, setUrnBlue] = useState(2);
  const [withReplacement, setWithReplacement] = useState(true);

  // Cumulative results
  const [bars, setBars] = useState<HistogramBar[]>([]);
  const [totalDraws, setTotalDraws] = useState(0);

  const reset = useCallback(() => {
    setBars([]);
    setTotalDraws(0);
  }, []);

  const run = useCallback(() => {
    if (kind === 'coin') {
      const r = flipCoin({ pHeads }, n, defaultRng);
      const newTotal = totalDraws + n;
      const oldH = bars.find((b) => b.label === 'Г')?.count ?? 0;
      const oldT = bars.find((b) => b.label === 'П')?.count ?? 0;
      const cH = oldH + r.counts.H;
      const cT = oldT + r.counts.T;
      setBars([
        { label: 'Г', count: cH, observed: cH / newTotal, expected: pHeads },
        { label: 'П', count: cT, observed: cT / newTotal, expected: 1 - pHeads },
      ]);
      setTotalDraws(newTotal);
      return;
    }

    if (kind === 'die') {
      const r = rollDie({ faces }, n, defaultRng);
      const newTotal = totalDraws + n;
      const next: HistogramBar[] = [];
      for (let f = 1; f <= faces; f += 1) {
        const old = bars.find((b) => b.label === String(f))?.count ?? 0;
        const c = old + r.counts[f];
        next.push({ label: String(f), count: c, observed: c / newTotal, expected: 1 / faces });
      }
      setBars(next);
      setTotalDraws(newTotal);
      return;
    }

    // urn
    const composition: Record<string, number> = { Црвена: urnRed, Сина: urnBlue };
    const r = drawFromUrn({ composition, withReplacement }, n, defaultRng);
    const drawn = r.draws.length;
    const newTotal = totalDraws + drawn;
    const next: HistogramBar[] = [];
    for (const color of Object.keys(composition)) {
      const old = bars.find((b) => b.label === color)?.count ?? 0;
      const c = old + (r.counts[color] ?? 0);
      next.push({
        label: color,
        count: c,
        observed: newTotal > 0 ? c / newTotal : 0,
        expected: r.expected[color] ?? 0,
      });
    }
    setBars(next);
    setTotalDraws(newTotal);
  }, [kind, n, pHeads, faces, urnRed, urnBlue, withReplacement, bars, totalDraws]);

  const maxScale = useMemo(() => {
    let m = 0;
    for (const b of bars) {
      if (b.observed > m) m = b.observed;
      if (b.expected > m) m = b.expected;
    }
    return Math.max(0.01, Math.min(1, m * 1.1));
  }, [bars]);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
      data-testid="probability-simulator"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-black text-gray-800">Симулатор на веројатност</h3>
        <div className="flex gap-1">
          {KIND_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setKind(key); reset(); }}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 border transition ${
                kind === key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
              data-testid={`prob-sim-kind-${key}`}
              aria-pressed={kind === key}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Per-kind controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <label className="font-semibold text-gray-700 space-y-1">
          <span>Број на обиди: <span className="font-mono font-bold text-indigo-700">{n}</span></span>
          <input
            type="range"
            min={1}
            max={500}
            step={1}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="w-full accent-indigo-600"
            data-testid="prob-sim-n"
            aria-label="Број на обиди"
          />
        </label>

        {kind === 'coin' && (
          <label className="font-semibold text-gray-700 space-y-1">
            <span>P(глава): <span className="font-mono font-bold text-indigo-700">{pHeads.toFixed(2)}</span></span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={pHeads}
              onChange={(e) => { setPHeads(Number(e.target.value)); reset(); }}
              className="w-full accent-indigo-600"
              data-testid="prob-sim-pheads"
              aria-label="Веројатност за глава"
            />
          </label>
        )}

        {kind === 'die' && (
          <label className="font-semibold text-gray-700 space-y-1">
            <span>Страни: <span className="font-mono font-bold text-indigo-700">{faces}</span></span>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={faces}
              onChange={(e) => { setFaces(Number(e.target.value)); reset(); }}
              className="w-full accent-indigo-600"
              data-testid="prob-sim-faces"
              aria-label="Страни на коцката"
            />
          </label>
        )}

        {kind === 'urn' && (
          <>
            <label className="font-semibold text-gray-700 space-y-1">
              <span>Црвени: <span className="font-mono font-bold text-rose-700">{urnRed}</span></span>
              <input
                type="range" min={0} max={20} step={1}
                value={urnRed}
                onChange={(e) => { setUrnRed(Number(e.target.value)); reset(); }}
                className="w-full accent-rose-600"
                data-testid="prob-sim-urn-red"
                aria-label="Број на црвени"
              />
            </label>
            <label className="font-semibold text-gray-700 space-y-1">
              <span>Сини: <span className="font-mono font-bold text-blue-700">{urnBlue}</span></span>
              <input
                type="range" min={0} max={20} step={1}
                value={urnBlue}
                onChange={(e) => { setUrnBlue(Number(e.target.value)); reset(); }}
                className="w-full accent-blue-600"
                data-testid="prob-sim-urn-blue"
                aria-label="Број на сини"
              />
            </label>
            <label className="font-semibold text-gray-700 inline-flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={withReplacement}
                onChange={(e) => { setWithReplacement(e.target.checked); reset(); }}
                data-testid="prob-sim-urn-replace"
              />
              <span>Со враќање</span>
            </label>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 inline-flex items-center gap-1"
          data-testid="prob-sim-run"
        >
          <Play className="w-3 h-3" /> Изврши {n} обиди
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 inline-flex items-center gap-1"
          data-testid="prob-sim-reset"
        >
          <RefreshCw className="w-3 h-3" /> Ресет
        </button>
        <span className="text-[11px] font-semibold text-gray-500 self-center" data-testid="prob-sim-total">
          Вкупно: {totalDraws}
        </span>
      </div>

      {/* Histogram */}
      <div className="space-y-2 pt-2" data-testid="prob-sim-histogram">
        {bars.length === 0 && (
          <p className="text-[11px] text-gray-400 italic">Притисни „Изврши" за да видиш хистограм.</p>
        )}
        {bars.map((b) => (
          <div key={b.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-gray-700">{b.label}</span>
              <span className="font-mono text-gray-600">
                {(b.observed * 100).toFixed(1)}%
                <span className="text-gray-400 ml-2">(теор. {(b.expected * 100).toFixed(1)}%)</span>
                <span className="text-gray-400 ml-2">n={b.count}</span>
              </span>
            </div>
            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-indigo-500"
                style={{ width: `${(b.observed / maxScale) * 100}%` }}
                title="Набљудувано"
              />
              <div
                className="absolute top-0 left-0 h-full border-r-2 border-rose-500"
                style={{ width: `${(b.expected / maxScale) * 100}%` }}
                title="Теоретски"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-500">
        Сино = набљудувана фреквенција. Розова линија = теоретска веројатност.
        Како што расте бројот на обиди, набљудуваното се приближува до теоретското
        <span className="italic"> (Закон на големите броеви)</span>.
      </p>
    </div>
  );
};
