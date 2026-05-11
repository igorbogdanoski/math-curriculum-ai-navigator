const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  if (loaded.has(src)) return Promise.resolve();
  if (pending.has(src)) return pending.get(src)!;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => { loaded.add(src); pending.delete(src); resolve(); };
    s.onerror = () => { pending.delete(src); reject(new Error(`Failed to load ${src}`)); };
    document.head.appendChild(s);
  });
  pending.set(src, p);
  return p;
}
