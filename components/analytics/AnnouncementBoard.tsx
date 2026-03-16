/**
 * AnnouncementBoard — bulletin board for teacher announcements.
 * Extracted from TeacherAnalyticsView for single-responsibility.
 */
import React from 'react';
import { Megaphone, Trash2, Send } from 'lucide-react';
import { Card } from '../common/Card';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Announcement } from '../../services/firestoreService';

interface AnnouncementBoardProps {
  announcements: Announcement[];
  newMsg: string;
  isPosting: boolean;
  onMsgChange: (v: string) => void;
  onPost: () => void;
  onDelete: (id: string) => void;
}

export const AnnouncementBoard: React.FC<AnnouncementBoardProps> = ({
  announcements,
  newMsg,
  isPosting,
  onMsgChange,
  onPost,
  onDelete,
}) => {
  const { t } = useLanguage();

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-800">{t('analytics.bulletin')}</h3>
        <span className="text-xs text-gray-400 ml-1">(Учениците ги гледаат во „Мој Прогрес")</span>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newMsg}
          onChange={e => onMsgChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onPost(); }}
          placeholder={t('analytics.bulletinPlaceholder')}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          maxLength={200}
        />
        <button
          type="button"
          onClick={onPost}
          disabled={!newMsg.trim() || isPosting}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 transition"
        >
          <Send className="w-4 h-4" />
          Постави
        </button>
      </div>
      {announcements.length > 0 ? (
        <ul className="space-y-1.5">
          {announcements.map(a => (
            <li key={a.id} className="flex items-start justify-between gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-700 flex-1">{a.message}</p>
              <button
                type="button"
                onClick={() => onDelete(a.id)}
                title={t('analytics.deleteAd')}
                aria-label={t('analytics.deleteAd')}
                className="text-gray-300 hover:text-red-500 transition flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 text-center py-1">{t('analytics.noActiveAds')}</p>
      )}
    </Card>
  );
};
