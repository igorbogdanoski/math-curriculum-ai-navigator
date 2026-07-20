import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminForumTab } from './AdminForumTab';
import { LanguageProvider } from '../../i18n/LanguageContext';

const baseThread = {
  id: 't1', title: 'Прашање за дропки', authorName: 'Ана', replyCount: 2,
  upvotedBy: [], deleted: false,
};

function renderTab(threads: any[], overrides: Partial<React.ComponentProps<typeof AdminForumTab>> = {}) {
  const handleForumDelete = vi.fn();
  const handleForumRestore = vi.fn();
  const handleForumApprove = vi.fn();
  const onRefresh = vi.fn();
  render(
    <LanguageProvider>
      <AdminForumTab
        forumThreads={threads}
        isLoadingForum={false}
        forumSearch=""
        setForumSearch={vi.fn()}
        forumActionUid={null}
        handleForumDelete={handleForumDelete}
        handleForumRestore={handleForumRestore}
        handleForumApprove={handleForumApprove}
        onRefresh={onRefresh}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { handleForumDelete, handleForumRestore, handleForumApprove, onRefresh };
}

describe('AdminForumTab — report surfacing (Wave 8.6, audit_2026_07_18_full_app_review)', () => {
  beforeEach(() => {
    localStorage.setItem('preferred_language', 'mk');
  });

  it('shows no report-count badge for a thread with no reports', () => {
    renderTab([baseThread]);
    expect(screen.queryByText(/\d+ пријавени/)).toBeNull();
  });

  it('shows a report-count badge in the header and per-thread when a thread has reportedBy entries', () => {
    const reported = { ...baseThread, id: 't2', reportedBy: ['teacher-a', 'teacher-b'], moderationStatus: 'pending' };
    renderTab([baseThread, reported]);
    expect(screen.getByText('1 пријавени')).toBeTruthy(); // header count
    expect(screen.getByText('2')).toBeTruthy(); // per-thread report count badge
  });

  it('shows the report reason when present', () => {
    const reported = { ...baseThread, id: 't2', reportedBy: ['teacher-a'], reportReason: 'Навредлива содржина' };
    renderTab([reported]);
    expect(screen.getByText(/Навредлива содржина/)).toBeTruthy();
  });

  it('"Само пријавени" checkbox filters out unreported threads', () => {
    const reported = { ...baseThread, id: 't2', title: 'Пријавена нишка', reportedBy: ['teacher-a'] };
    renderTab([baseThread, reported]);
    expect(screen.getByText('Прашање за дропки')).toBeTruthy();
    expect(screen.getByText('Пријавена нишка')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: /Само пријавени/ }));
    expect(screen.queryByText('Прашање за дропки')).toBeNull();
    expect(screen.getByText('Пријавена нишка')).toBeTruthy();
  });

  it('sorts reported threads before unreported ones', () => {
    const reported = { ...baseThread, id: 't2', title: 'Пријавена нишка', reportedBy: ['teacher-a'] };
    renderTab([baseThread, reported]);
    const titles = screen.getAllByText(/Прашање за дропки|Пријавена нишка/).map(el => el.textContent);
    expect(titles[0]).toContain('Пријавена нишка');
  });

  it('clicking "Одобри" on a reported thread calls handleForumApprove with its id', () => {
    const reported = { ...baseThread, id: 't2', reportedBy: ['teacher-a'] };
    const { handleForumApprove } = renderTab([reported]);
    fireEvent.click(screen.getByRole('button', { name: /Одобри/ }));
    expect(handleForumApprove).toHaveBeenCalledWith('t2');
  });

  it('does not show "Одобри" for a deleted reported thread (nothing to clear it into)', () => {
    const reported = { ...baseThread, id: 't2', reportedBy: ['teacher-a'], deleted: true };
    renderTab([reported]);
    expect(screen.queryByRole('button', { name: /Одобри/ })).toBeNull();
  });

  it('does not show "Одобри" for a thread with no reports', () => {
    renderTab([baseThread]);
    expect(screen.queryByRole('button', { name: /Одобри/ })).toBeNull();
  });
});
