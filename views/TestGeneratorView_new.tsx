import React, { useState } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { geminiService } from '../services/geminiService';
import { GeneratedTest, Topic } from '../types';
import { ICONS } from '../constants';
import { useReactToPrint } from 'react-to-print';
import { PrintableTest } from '../components/ai/PrintableTest';
import { useRef } from 'react';

export const TestGeneratorView: React.FC = () => {
    const { curriculum } = useCurriculum();
    const [selectedGradeId, setSelectedGradeId] = useState<string>('grade-6');
    const [topic, setTopic] = useState('');
    const [qCount, setQCount] = useState(5);
    const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Test_${topic.replace(/\s/g,'_')}`,
  });


    const selectedGradeObj = curriculum?.grades.find(g => g.id === selectedGradeId);
    const topicsForGrade = selectedGradeObj?.topics || [];
    const selectedGradeNum = selectedGradeObj?.level || 6;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const result = await geminiService.generateParallelTest(topic, selectedGradeNum, qCount, difficulty);
            setGeneratedTest(result);
        } catch (e) {
            console.error(e);
            alert("Настана грешка при генерирањето.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 pb-32">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <ICONS.assessment className="w-8 h-8 text-brand-primary" />
                Генератор на Тестови
            </h1>
            <p className="text-gray-600">
                Автоматски генерирајте тестови со две групи (А и Б) кои се со иста тежина, но различни задачи.
                Вклучува и лист со решенија за наставникот.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 space-y-4 h-fit">
                    <h2 className="font-semibold text-lg border-b pb-2">Параметри</h2>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Одделение</label>
                        <select 
                            className="w-full p-2 border rounded-md"
                            value={selectedGradeId}
                            onChange={(e) => {
                                setSelectedGradeId(e.target.value);
                                setTopic(''); // Reset topic when grade changes
                            }}
                        >
                            {curriculum?.grades.map(g => (
                                <option key={g.id} value={g.id}>{g.title}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Тема / Наставна Единица</label>
                        {topicsForGrade.length > 0 ? (
                            <select
                                className="w-full p-2 border rounded-md"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            >
                                <option value="">-- Изберете тема --</option>
                                {topicsForGrade.map(t => (
                                    <option key={t.id} value={t.title}>{t.title}</option>
                                ))}
                            </select>
                        ) : (
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded-md"
                                placeholder="Пр. Дропки, Равенки, Плоштина..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                        )}
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Број на прашања</label>
                         <input 
                            type="number" 
                            min={3} max={20}
                            className="w-full p-2 border rounded-md"
                            value={qCount}
                            onChange={(e) => setQCount(Number(e.target.value))}
                         />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Тежина</label>
                        <select 
                            className="w-full p-2 border rounded-md"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as any)}
                        >
                            <option value="easy">Лесно (Ниво на паметење)</option>
                            <option value="medium">Средно (Ниво на примена)</option>
                            <option value="hard">Тешко (Ниво на анализа)</option>
                        </select>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !topic}
                        className={`w-full py-3 rounded-lg text-white font-semibold shadow-md transition-all ${
                            isGenerating || !topic
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-brand-primary to-brand-secondary hover:shadow-lg'
                        }`}
                    >
                        {isGenerating ? 'Се генерира...' : 'Генерирај Тест'}
                    </button>
                </Card>

                <div className="md:col-span-2">
                    {generatedTest ? (
                        <div className="space-y-6">
                            <Card className="bg-green-50 border-green-200">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 p-2 rounded-full">
                                            <ICONS.check className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-green-800">Тестот е подготвен!</h3>
                                            <p className="text-sm text-green-700">Успешно генерирани Група А и Група Б.</p>
                                        </div>
                                    </div>
                                    <button
  onClick={() => handlePrint()}
  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow"
>
  <ICONS.download className="w-5 h-5" />
  Зачувај PDF
</button>
<div style={{ display: 'none' }}>
  <PrintableTest ref={printRef} test={generatedTest} />
</div>
                                </div>
                            </Card>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {generatedTest.groups.map((group, idx) => (
                                    <Card key={idx} className="relative">
                                        <div className="absolute top-0 right-0 bg-gray-100 px-3 py-1 rounded-bl-lg text-xs font-bold text-gray-500 uppercase">
                                            {group.groupName}
                                        </div>
                                        <h3 className="font-bold text-lg mb-4 text-brand-primary">{group.groupName}</h3>
                                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            {group.questions.map((q, i) => (
                                                <div key={i} className="bg-gray-50 p-3 rounded-md border border-gray-100">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="font-bold text-sm text-gray-700">{i + 1}.</span>
                                                        <span className="text-xs font-mono bg-white border px-1 rounded">{q.points}п</span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 mb-2">{q.text}</p>
                                                    {q.type === 'multiple-choice' && (
                                                        <ul className="pl-4 space-y-1">
                                                            {q.options?.map((opt, oi) => (
                                                                <li key={oi} className="text-xs text-gray-600 list-disc">{opt}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                     <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-xs text-green-700 font-medium">
                                                        Одговор: {q.correctAnswer}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border-2 border-dashed border-gray-200 min-h-[400px]">
                            <ICONS.document className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">Внесете параметри и кликнете "Генерирај"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
