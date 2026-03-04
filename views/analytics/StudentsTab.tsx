import React, { useState } from 'react';
import { Trophy, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { GradeBadge } from '../../components/common/GradeBadge';
import { type PerStudentStat, confidenceEmoji, confidenceColor } from './shared';

interface StudentsTabProps {
    perStudentStats: PerStudentStat[];
}

export const StudentsTab: React.FC<StudentsTabProps> = ({ perStudentStats }) => {
    const [qrStudent, setQrStudent] = useState<string | null>(null);
    const qrUrl = qrStudent
        ? `${window.location.origin}/#/my-progress?name=${encodeURIComponent(qrStudent)}`
        : '';

    return (
        <SilentErrorBoundary name="StudentsTab">
            <Card>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Индивидуален преглед по ученик</h2>
                {perStudentStats.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                        Нема ученици со внесено ime. Учениците треба да го внесат своето ime при играње квиз.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-gray-100">
                                    <th className="py-2 px-3 font-semibold">Ученик</th>
                                    <th className="py-2 px-3 text-center font-semibold">Обиди</th>
                                    <th className="py-2 px-3 text-center font-semibold">Просек</th>
                                    <th className="py-2 px-3 text-center font-semibold">Положиле</th>
                                    <th className="py-2 px-3 text-center font-semibold">Совладани</th>
                                    <th className="py-2 px-3 text-center font-semibold">Доверба</th>
                                    <th className="py-2 px-3 text-center font-semibold">Статус</th>
                                    <th className="py-2 px-3 font-semibold">Акција</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perStudentStats.map(s => {
                                    return (
                                        <tr key={s.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                            <td className="py-2.5 px-3 font-semibold text-slate-700">{s.name}</td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{s.attempts}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="flex items-center justify-center gap-1.5">
                                                    <span className={`font-bold ${s.avg >= 70 ? 'text-green-600' : s.avg >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                        {s.avg}%
                                                    </span>
                                                    <GradeBadge pct={s.avg} />
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{s.passRate}%</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="flex items-center justify-center gap-1">
                                                    {s.masteredCount > 0 && <Trophy className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />}
                                                    {s.masteredCount}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={`text-sm ${confidenceColor(s.avgConfidence)}`}>
                                                    {confidenceEmoji(s.avgConfidence)}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <GradeBadge pct={s.avg} showLabel={true} className="px-2 py-0.5 rounded-full" />
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { window.location.hash = `/my-progress?name=${encodeURIComponent(s.name)}`; }}
                                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                                    >
                                                        Прогрес →
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQrStudent(s.name)}
                                                        title="QR код за родители"
                                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <QrCode className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* QR Code overlay */}
            {qrStudent && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setQrStudent(null)}
                >
                    <div
                        className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center w-full">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-indigo-600" />
                                QR за родители
                            </h3>
                            <button
                                type="button"
                                onClick={() => setQrStudent(null)}
                                className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
                                aria-label="Затвори"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 text-center">{qrStudent}</p>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <QRCodeSVG value={qrUrl} size={200} />
                        </div>
                        <p className="text-xs text-gray-400 text-center break-all">{qrUrl}</p>
                        <div className="flex gap-2 w-full">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                            >
                                Печати QR
                            </button>
                            <button
                                type="button"
                                onClick={() => setQrStudent(null)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                            >
                                Затвори
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SilentErrorBoundary>
    );
};
