const fs = require('fs');

const viewFile = 'views/AnnualPlanGeneratorView.tsx';
let code = fs.readFileSync(viewFile, 'utf8');

// 1. Add imports at the top
const reactImportReplacement = `import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';`;

code = code.replace(/import React, { useState } from 'react';/, reactImportReplacement);

// 2. Add properties inside the component
const componentStart = 'export const AnnualPlanGeneratorView: React.FC = () => {';
const hooksToAdd = `
    const { user } = useAuth();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: \`Годишна_Програма_\${plan?.subject}_\${plan?.grade}\`,
    });

    const handleSave = async () => {
        if (!user || !plan) return;
        setIsSaving(true);
        try {
            const docRef = await addDoc(collection(db, 'academic_annual_plans'), {
                userId: user.uid,
                createdAt: serverTimestamp(),
                planData: plan,
                grade: plan.grade,
                subject: plan.subject
            });
            setSavedId(docRef.id);
            alert("Програмата е успешно зачувана во облак!");
        } catch (error) {
            console.error("Грешка при зачувување:", error);
            alert("Грешка при зачувување на програмата.");
        } finally {
            setIsSaving(false);
        }
    };
`;

code = code.replace(/(const \[plan, setPlan\] = useState<AIGeneratedAnnualPlan \| null>\(null\);)/, `$1\n${hooksToAdd}`);

// 3. Add print/save buttons and wrap the plan in the ref mapping
const printButtons = `
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    icon={ICONS.printer} 
                                    onClick={() => handlePrint()}
                                >
                                    Печати / PDF
                                </Button>
                                {user && (
                                    <Button 
                                        variant={savedId ? "outline" : "primary"} 
                                        size="sm" 
                                        icon={savedId ? ICONS.check : ICONS.database} 
                                        onClick={handleSave}
                                        isLoading={isSaving}
                                        disabled={!!savedId}
                                    >
                                        {savedId ? "Зачувано" : "Зачувај во Cloud"}
                                    </Button>
                                )}
                            </div>
`;

// Looking for the spot to put the buttons
code = code.replace(/(<span className="bg-blue-100 .*?Вкупно: \{plan.totalWeeks\} недели\n.*?<\/span>)/, `$1\n${printButtons}`);

// Wrap the area to print
code = code.replace(/(<div className="space-y-6">)/, `<div className="space-y-6 print:p-8 print:bg-white" ref={printRef}>`);

fs.writeFileSync(viewFile, code, 'utf8');
console.log('Successfully added Print and Save logic.');

