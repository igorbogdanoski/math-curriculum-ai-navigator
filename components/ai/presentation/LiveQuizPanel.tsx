import React, { useState, useRef, useEffect } from 'react';
import { Radio, X, Loader2, Users, ExternalLink, Zap } from 'lucide-react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import type { User } from 'firebase/auth';
import { firestoreService } from '../../../services/firestoreService';

interface LiveQuizPanelProps {
  isOpen: boolean;
  onClose: () => void;
  presentationTitle: string;
  conceptId?: string;
  firebaseUser: User | null;
  addNotification: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const LiveQuizPanel: React.FC<LiveQuizPanelProps> = ({
  isOpen, onClose, presentationTitle, conceptId, firebaseUser, addNotification,
}) => {
  const [quizList, setQuizList] = useState<{ id: string; title: string; conceptId?: string }[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<{ joinCode: string; sessionId: string } | null>(null);
  const liveUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { liveUnsubRef.current?.(); }, []);

  useEffect(() => {
    if (!isOpen || quizList.length > 0) return;
    setLoadingQuizzes(true);
    firestoreService.fetchCachedQuizList()
      .then(all => {
        const matched = conceptId ? all.filter(q => q.conceptId === conceptId) : [];
        const rest = conceptId ? all.filter(q => q.conceptId !== conceptId) : all;
        setQuizList([...matched, ...rest]);
      })
      .catch(() => addNotification('Не може да се вчитаат квизовите.', 'error'))
      .finally(() => setLoadingQuizzes(false));
  }, [isOpen, conceptId, quizList.length, addNotification]);

  const handleLaunchLive = async (quiz: { id: string; title: string; conceptId?: string }) => {
    if (!firebaseUser?.uid) { addNotification('Треба да бидете најавени.', 'error'); return; }
    setLaunchingId(quiz.id);
    try {
      const sessionId = await firestoreService.createLiveSession(
        firebaseUser.uid, quiz.id, quiz.title, quiz.conceptId,
      );
      liveUnsubRef.current?.();
      liveUnsubRef.current = firestoreService.subscribeLiveSession(sessionId, (s) => {
        if (s?.joinCode) {
          setLiveSession({ joinCode: s.joinCode, sessionId });
          liveUnsubRef.current?.();
          liveUnsubRef.current = null;
        }
      });
    } catch {
      addNotification('Грешка при креирање на сесијата.', 'error');
    } finally {
      setLaunchingId(null);
    }
  };

  const handleOpenDisplay = () => {
    if (!liveSession) return;
    window.open(`${window.location.origin}/#/live/display?sid=${liveSession.sessionId}`, '_blank');
  };

  const handleClose = () => {
    setLiveSession(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black">Пушти квиз во живо</h3>
                <p className="text-red-100 text-xs">Изберете квиз за презентацијата „{presentationTitle}"</p>
              </div>
            </div>
            <button type="button" onClick={handleClose} aria-label="Затвори"
              className="p-2 rounded-xl hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {liveSession ? (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2 font-medium">Кодот за приклучување е</p>
                <div className="text-7xl font-black tracking-[0.25em] text-red-600 font-mono">{liveSession.joinCode}</div>
                <p className="text-xs text-gray-400 mt-2">Учениците го внесуваат на <span className="font-bold text-gray-600">/live</span></p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <QRCode
                  value={`${window.location.origin}/#/live?code=${liveSession.joinCode}`}
                  size={160}
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                />
              </div>
              <div className="flex gap-3 w-full">
                <button type="button" onClick={handleOpenDisplay}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Отвори табла
                </button>
                <button type="button" onClick={() => setLiveSession(null)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                  Нова сесија
                </button>
              </div>
            </div>
          ) : loadingQuizzes ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              <p className="text-sm text-gray-500">Вчитувам квизови…</p>
            </div>
          ) : quizList.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-gray-400" />
              </div>
              <p className="font-bold text-gray-700 mb-1">Нема зачувани квизови</p>
              <p className="text-sm text-gray-400">Прво генерирајте и зачувајте квиз во библиотеката.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {conceptId && quizList.some(q => q.conceptId === conceptId) && (
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-1 mb-1">Квизови за овој концепт</p>
              )}
              {quizList.map((quiz, idx) => {
                const isMatch = conceptId && quiz.conceptId === conceptId;
                const isLaunching = launchingId === quiz.id;
                const prevWasMatch = idx > 0 && conceptId && quizList[idx - 1].conceptId === conceptId;
                const showDivider = !isMatch && prevWasMatch;
                return (
                  <React.Fragment key={quiz.id}>
                    {showDivider && <div className="border-t border-gray-100 my-1" />}
                    <button
                      type="button"
                      onClick={() => handleLaunchLive(quiz)}
                      disabled={!!launchingId}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left disabled:opacity-60 ${
                        isMatch ? 'border-red-200 bg-red-50 hover:bg-red-100' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isMatch && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                        <span className="text-sm font-semibold text-gray-800 truncate">{quiz.title}</span>
                      </div>
                      {isLaunching
                        ? <Loader2 className="w-4 h-4 animate-spin text-red-500 flex-shrink-0" />
                        : <Zap className={`w-4 h-4 flex-shrink-0 ${isMatch ? 'text-red-400' : 'text-gray-300'}`} />
                      }
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
