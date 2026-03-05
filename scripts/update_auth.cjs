const fs = require('fs');
let code = fs.readFileSync('contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  /register:\s*\(\s*email:\s*string,\s*password:\s*string,\s*name:\s*string,\s*photoFile:\s*File\s*\|\s*null\)\s*=>\s*Promise<void>;/,
  'register: (email: string, password: string, name: string, photoFile: File | null, schoolId?: string) => Promise<void>;'
);

code = code.replace(
  /const register = useCallback\(\s*async\s*\(\s*email:\s*string,\s*password:\s*string,\s*name:\s*string,\s*photoFile:\s*File\s*\|\s*null\s*\):\s*Promise<void>\s*=>\s*\{/,
  'const register = useCallback(async (email: string, password: string, name: string, photoFile: File | null, schoolId?: string): Promise<void> => {'
);


code = code.replace(
  /const newProfile:\s*TeachingProfile\s*=\s*\{([\s\S]*?)role:\s*'teacher',([\s\S]*?)style:\s*'Constructivist',/,
  "const newProfile: TeachingProfile = {$1role: 'teacher',\n            schoolId: schoolId || '',$2style: 'Constructivist',"
);

fs.writeFileSync('contexts/AuthContext.tsx', code);
console.log('Done');
