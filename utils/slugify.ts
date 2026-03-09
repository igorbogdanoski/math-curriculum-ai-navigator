export const cyrillicMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ѓ': 'gj', 'е': 'e', 'ж': 'zh', 'з': 'z',
    'ѕ': 'dz', 'и': 'i', 'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm', 'н': 'n', 'њ': 'nj',
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'ќ': 'kj', 'у': 'u', 'ф': 'f', 'х': 'h',
    'ц': 'c', 'ч': 'ch', 'џ': 'dzh', 'ш': 'sh'
  };
  
  export function slugify(text: string): string {
    let slug = text.toLowerCase();
    let result = '';
    for (let i = 0; i < slug.length; i++) {
      result += cyrillicMap[slug[i]] || slug[i];
    }
    return result.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }