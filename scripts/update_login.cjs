const fs = require('fs');
let code = fs.readFileSync('views/LoginView.tsx', 'utf8');

if (!code.includes('firestoreService')) {
  code = code.replace(
    "import { useAuth } from '../contexts/AuthContext';",
    "import { useAuth } from '../contexts/AuthContext';\nimport { firestoreService } from '../services/firestoreService';"
  );
}

// Add state for schools
if (!code.includes('const [schools,')) {
  code = code.replace(
    'export const LoginView: React.FC = () => {',
    "export const LoginView: React.FC = () => {\n    const [schools, setSchools] = useState<any[]>([]);\n    const [schoolId, setSchoolId] = useState('');\n"
  );
  
  // Add useEffect to fetch schools
  code = code.replace(
    "    const [mode, setMode] = useState<AuthMode>('login');",
    "    const [mode, setMode] = useState<AuthMode>('login');\n\n    useEffect(() => {\n        const loadSchools = async () => {\n            const data = await firestoreService.fetchSchools();\n            setSchools(data);\n        };\n        loadSchools();\n    }, []);"
  );
  
  // update handleRegisterSubmit
  code = code.replace(
    'await register(email, password, name, photoFile);',
    'await register(email, password, name, photoFile, schoolId);'
  );
}

// Update RegisterForm signature
code = code.replace(
    /interface RegisterFormProps \{[\s\S]*?onSwitchToLogin: \(\) => void;\s*\}/,
    `interface RegisterFormProps {
    name: string;
    setName: (name: string) => void;
    email: string;
    setEmail: (email: string) => void;
    password: string;
    setPassword: (pass: string) => void;
    repeatPassword: string;
    setRepeatPassword: (pass: string) => void;
    schoolId: string;
    setSchoolId: (id: string) => void;
    schools: any[];
    photoPreview: string | null;
    handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean;
    error: string;
    successMessage: string;
    onSwitchToLogin: () => void;
}`
);

// Update RegisterForm props array
code = code.replace(
    /const RegisterForm: React\.FC<RegisterFormProps> = \(\{ name, setName, email, setEmail, password, setPassword, repeatPassword, setRepeatPassword, photoPreview, handlePhotoChange, handleSubmit, isLoading, error, successMessage, onSwitchToLogin \}\) => \(/,
    `const RegisterForm: React.FC<RegisterFormProps> = ({ name, setName, email, setEmail, password, setPassword, repeatPassword, setRepeatPassword, schoolId, setSchoolId, schools, photoPreview, handlePhotoChange, handleSubmit, isLoading, error, successMessage, onSwitchToLogin }) => (`
);

// Insert school dropdown in RegisterForm
const formContentHTML = `
        <div>
            <label htmlFor="school" className="block text-sm font-medium text-gray-700">Училиште (опционално)</label>
            <select
                id="school"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
            >
                <option value="">-- Изберете училиште --</option>
                {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                ))}
            </select>
        </div>
        <div>
            <label htmlFor="password"`;

code = code.replace(
    /<div>\s*<label htmlFor="password"/,
    formContentHTML
);

// update the invocation of RegisterForm
code = code.replace(
    /<RegisterForm name=\{name\}(.*?) photoPreview=\{photoPreview\}/,
    `<RegisterForm name={name}$1 schoolId={schoolId} setSchoolId={setSchoolId} schools={schools} photoPreview={photoPreview}`
);

fs.writeFileSync('views/LoginView.tsx', code);
console.log('Login view updated');
