# Forum FCM Replay Checklist (S19-P2 final close)

## Goal
Provide reproducible evidence that forum reply push delivery works in production using the callable replay endpoint.

## Endpoint
- Function: `replayForumReplyNotification`
- Type: Firebase Callable HTTPS function
- Auth: required (caller must be authenticated)

## Preconditions
1. At least one forum thread exists with 2+ participants.
2. At least one participant (other than actor) has a valid `user_tokens/{uid}_web` token.
3. Functions deployment includes latest `functions/src/index.ts`.

## Step 1: Dry-run replay (safe recipient/token verification)
Use Firebase callable from browser console in app session (authenticated):

```js
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

const fn = httpsCallable(getFunctions(app), 'replayForumReplyNotification');
const dryRun = await fn({
  threadId: '<THREAD_ID>',
  replyId: '<OPTIONAL_REPLY_ID>',
  dryRun: true,
});
console.log('dryRun replay result', dryRun.data);
```

Expected signals in returned payload:
- `ok: true`
- `dryRun: true`
- `recipientCount >= 1` (if participants exist)
- `uniqueTokenCount >= 1` (if tokens exist)
- `failureCount: 0`

## Step 2: Live replay (actual push delivery)

```js
const liveRun = await fn({
  threadId: '<THREAD_ID>',
  replyId: '<OPTIONAL_REPLY_ID>',
  dryRun: false,
});
console.log('live replay result', liveRun.data);
```

Expected signals in returned payload:
- `ok: true`
- `dryRun: false`
- `successCount >= 1` when at least one token is valid
- `failureCount` should be `0` or explainable by stale tokens

## Step 3: Log evidence (Functions)
Collect logs for replay attempt and result:

```bash
firebase functions:log --only replayForumReplyNotification
firebase functions:log --only onForumReplyCreated
```

Windows PowerShell quick-tail examples:

```powershell
firebase functions:log --only replayForumReplyNotification | Select-Object -Last 80
firebase functions:log --only onForumReplyCreated | Select-Object -Last 120
```

Look for:
- `[onForumReplyCreated] delivery attempt`
- `[onForumReplyCreated] delivery result`
- recipient/token counts and missing-token diagnostics

## Evidence pack for roadmap close
Store in evidence note:
1. Callable request payload (threadId/replyId/dryRun)
2. Callable response payload (counts)
3. Relevant function logs (attempt + result)
4. Optional screenshot from recipient device/browser push toast

## Failure handling
- `recipientCount = 0`: thread has no eligible recipients (actor-only thread)
- `uniqueTokenCount = 0`: recipients missing web FCM tokens
- `failureCount > 0`: likely stale token(s); clean token docs and retry live replay

## Current known blocker (08.04.2026)
- Callable path is verified in production: `dryRun` returns `ok: true`, `recipientCount: 1`, `uniqueTokenCount: 1`.
- Live replay still returns `successCount: 0`, `failureCount: 1` for synthetic thread `KC7qZl06E4s493m7XOxt`, which indicates the stored recipient token is stale even though the token doc exists.
- Fastest remediation: sign in in a real browser session as the recipient user, grant notifications so `user_tokens/{uid}_web` is refreshed, then rerun the same callable with the same `threadId`/`replyId`.
