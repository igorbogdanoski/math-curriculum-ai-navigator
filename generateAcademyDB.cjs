const fs = require('fs');

const bgMap = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ѓ': 'gj', 'е': 'e', 'ж': 'zh', 'з': 'z',
  'ѕ': 'dz', 'и': 'i', 'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm', 'н': 'n', 'њ': 'nj',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'ќ': 'kj', 'у': 'u', 'ф': 'f', 'х': 'h',
  'ц': 'c', 'ч': 'ch', 'џ': 'dzh', 'ш': 'sh'
};

function slugify(text) {
  let slug = text.toLowerCase();
  let result = '';
  for (let i = 0; i < slug.length; i++) {
    result += bgMap[slug[i]] || slug[i];
  }
  return result.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const lines = fs.readFileSync('data/educationalModelsInfo.ts', 'utf8');
// Very naive parsing to grab the objects.
// Let's just require it using node's vm or just do regexes.
// Actually since we just need to generate the static files, let's write a file `data/academy/slugify.ts` first, and use it in AcademyView.tsx.
