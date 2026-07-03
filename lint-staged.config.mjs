export default {
  '*.{ts,tsx}': () => 'npx tsc --noEmit',
  '*.{ts,tsx,js,jsx,mjs,cjs}': (filenames) => `eslint --max-warnings=99999 ${filenames.map(f => `"${f}"`).join(' ')}`,
};
