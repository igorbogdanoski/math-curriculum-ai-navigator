export interface PhaseConfig {
  key: 'intro' | 'main' | 'conclusion';
  label: string;
  emoji: string;
  minutes: number;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export function buildPhases(lessonMinutes: number): PhaseConfig[] {
  const intro = Math.round(lessonMinutes * 0.25);
  const conclusion = 5;
  const main = lessonMinutes - intro - conclusion;

  return [
    { key: 'intro',      label: 'Вовод',      emoji: '🎯', minutes: intro,       bgColor: 'bg-sky-50',             borderColor: 'border-sky-300',         textColor: 'text-sky-700' },
    { key: 'main',       label: 'Главен дел', emoji: '📚', minutes: main,        bgColor: 'bg-brand-primary/5',    borderColor: 'border-brand-primary/30', textColor: 'text-brand-primary' },
    { key: 'conclusion', label: 'Завршница',  emoji: '✅', minutes: conclusion,  bgColor: 'bg-emerald-50',         borderColor: 'border-emerald-300',     textColor: 'text-emerald-700' },
  ];
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
