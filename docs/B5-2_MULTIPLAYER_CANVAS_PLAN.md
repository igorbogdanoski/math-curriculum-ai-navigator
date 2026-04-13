# B5-2 — Multiplayer Canvas: Детален Имплементациски План
**Статус:** 🔒 S21 (откако B1-B4 се затворени)  
**Проценка:** 3-4 недели реална работа  
**Принцип:** Firestore PoC прв — само ако PoC минува → WebSocket инфраструктура

---

## 1. Визија и опсег

**Цел:** Наставникот и ученикот работат на иста AlgebraTilesCanvas во реално
време — наставникот поставува задача (preset), ученикот ги движи плочките,
наставникот гледа live. Без refresh.

**Вон опсег (S21):**
- Повеќе од 2 учесника истовремено (>2 cursor конфликти → CRDT потребно)
- Persistent session history / playback
- Voice/video комуникација
- Mobile keyboard/stylus input

---

## 2. Технолошка одлука: Firestore vs WebSocket

### Зошто Firestore прв (PoC)

| Критериум | Firestore onSnapshot | WebSocket (Edge Fn) |
|-----------|---------------------|---------------------|
| Инфраструктура | ✅ Веќе постои | ❌ Нова (Vercel Edge / CF Workers) |
| Deployment | ✅ Zero config | ❌ Посебен deployment pipeline |
| Latency | ~200-500ms | ~20-80ms |
| Cost at scale | Reads = $$$  при 100+ tiles | Subscription = fixed |
| Auth | ✅ Firebase Rules | ❌ Custom JWT needed |
| Offline | ✅ Firestore cache | ❌ Reconnect logic |
| Conflict | Eventual consistency + version | Server-authoritative needed |

**Одлука:** Firestore PoC за 1:1 сесија со <50 tile операции/мин.
Ако PoC успее и latency е <400ms perceived → ship it.
Ако не → мигрирај на WebSocket (архитектурата ќе биде иста, само транспортот се менува).

---

## 3. Firestore Колекција

```
canvas_sessions/{sessionId}
  ├── hostUid: string
  ├── guestUid: string | null
  ├── joinCode: string (4 chars uppercase)
  ├── status: 'waiting' | 'active' | 'ended'
  ├── preset: string | null         ← наставник поставува preset
  ├── createdAt: Timestamp
  ├── lastActivityAt: Timestamp
  └── tiles: TileSpec[]              ← САМО за checkpoint snapshot

canvas_sessions/{sessionId}/ops/{opId}
  ├── type: 'add' | 'remove' | 'move' | 'clear' | 'preset'
  ├── tileId: string
  ├── kind: TileKind
  ├── sign: TileSign
  ├── x: number
  ├── y: number
  ├── authorUid: string
  ├── timestamp: Timestamp
  └── seqNo: number                  ← за ordering
```

**Зошто ops subcollection наместо tiles array:**
- Array replace = 1 Firestore write/операција = expensive и конфликтна
- Ops = append-only log → секоја страна replay-ува → eventual consistency
- Max ops per session = 500 (cap) → auto-clear при snapshot checkpoint

---

## 4. Архитектура — Компоненти

```
views/
  MultiplayerCanvasView.tsx       ← главен view (host)
  MultiplayerCanvasJoinView.tsx   ← join view (guest, по joinCode)

hooks/
  useCanvasSession.ts             ← Firestore bind + ops dispatch
  useCanvasOps.ts                 ← replay ops → Tile[] (pure)

services/
  firestoreService.canvas.ts      ← createSession, joinSession,
                                     sendOp, watchOps, endSession

components/math/
  AlgebraTilesCanvas.tsx          ← ВЕЌЕ постои
  MultiplayerOverlay.tsx          ← cursor на другиот учесник (нов)
```

---

## 5. Имплементациски Фази

### Фаза 0 — PoC (2 дена) → ОДЛУЧА ДА ЛИ ПРОДОЛЖУВАШ

**Цел:** 2 browser прозорци, ист canvas, tile-add се синхронизира.

```ts
// firestoreService.canvas.ts — минимален PoC
async function createSession(hostUid: string): Promise<{sessionId, joinCode}> {
  const joinCode = Math.random().toString(36).slice(2,6).toUpperCase();
  const ref = await addDoc(collection(db, 'canvas_sessions'), {
    hostUid, guestUid: null, joinCode, status: 'waiting',
    preset: null, tiles: [], createdAt: serverTimestamp()
  });
  return { sessionId: ref.id, joinCode };
}

function watchOps(sessionId: string, onOp: (op: CanvasOp) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'canvas_sessions', sessionId, 'ops'),
          orderBy('seqNo'), limit(500)),
    snap => snap.docChanges()
      .filter(c => c.type === 'added')
      .forEach(c => onOp(c.doc.data() as CanvasOp))
  );
}
```

**Acceptance criteria за PoC:**
- [ ] Tile add на Host → появува се на Guest за <600ms
- [ ] 20 consecutive ops без дупликати
- [ ] Firestore Rules: само hostUid/guestUid можат да пишуваат во сесијата

---

### Фаза 1 — Core (3 дена)

1. **`useCanvasSession` hook**
   ```ts
   function useCanvasSession(sessionId: string) {
     const [tiles, setTiles] = useState<Tile[]>([]);
     const myUid = useFirebaseUid();
     
     // Replay incoming ops
     useEffect(() => {
       return watchOps(sessionId, op => {
         setTiles(prev => applyOp(prev, op));  // pure fn
       });
     }, [sessionId]);
     
     // Dispatch outgoing op
     const dispatch = useCallback((op: Omit<CanvasOp, 'authorUid' | 'timestamp'>) => {
       sendOp(sessionId, { ...op, authorUid: myUid, timestamp: serverTimestamp() });
     }, [sessionId, myUid]);
     
     return { tiles, dispatch };
   }
   ```

2. **`applyOp` pure function** (testable без Firestore)
   ```ts
   function applyOp(tiles: Tile[], op: CanvasOp): Tile[] {
     switch (op.type) {
       case 'add':    return [...tiles, { id: op.tileId, kind: op.kind, sign: op.sign, x: op.x, y: op.y }];
       case 'remove': return tiles.filter(t => t.id !== op.tileId);
       case 'move':   return tiles.map(t => t.id === op.tileId ? { ...t, x: op.x, y: op.y } : t);
       case 'clear':  return [];
       case 'preset': return layoutTiles(PRESET_SPECS[op.presetKey] ?? []);
     }
   }
   ```

3. **`AlgebraTilesCanvas` multiplayer prop**
   ```tsx
   // Нов optional prop:
   onTileAction?: (action: TileActionEvent) => void;
   // TileActionEvent = { type: 'add'|'remove'|'move'; tile: Tile }
   // Кога постои → canvas fires ops наместо само state
   ```

4. **Session lifecycle**
   - `createSession()` → QR code + 4-char joinCode
   - `joinSession(joinCode)` → guestUid се запишува
   - `endSession()` → status = 'ended' + snapshot на tiles

---

### Фаза 2 — UX (2 дена)

1. **`MultiplayerOverlay`** — ghost cursor на другиот учесник
   ```
   Position: absolute, pointer-events:none
   Shows: colored dot (blue=host, green=guest) + username initials
   Updates: via ops subcollection 'cursor' type (throttled 200ms)
   ```

2. **Host controls**
   - Preset picker (поставува задача на guest)
   - Lock/unlock guest editing
   - "Земи snapshot" → PDF export

3. **Guest view**
   - "Чекај — наставникот поставува задача" empty state
   - Read-only mode кога host го брава

4. **Connection indicator**
   ```
   🟢 Поврзан · Igor   🟡 Чека гост...   🔴 Прекинато
   ```

---

### Фаза 3 — Hardening (1 ден)

1. **Firestore Security Rules**
   ```javascript
   match /canvas_sessions/{sessionId} {
     allow read: if isParticipant(sessionId);
     allow create: if request.auth != null;
     allow update: if isHost(sessionId) || isGuest(sessionId);
     
     match /ops/{opId} {
       allow read: if isParticipant(sessionId);
       allow create: if isParticipant(sessionId)
                     && request.resource.data.authorUid == request.auth.uid;
       allow delete: if false;  // ops are immutable
     }
   }
   ```

2. **Op deduplication** — `seqNo` + client-side idempotency check
3. **Session expiry** — Cloud Function: `status='ended'` after 2h inactivity
4. **Op cleanup** — Cloud Function: delete ops >500 per session (archive to tiles snapshot)

---

### Фаза 4 — Integration (1 ден)

1. **TopicView integration** — "Предај онлајн" button → creates session, shares link
2. **StudentTutorView** — guest join со joinCode
3. **Forum** — share session replay as GIF (html2canvas sequence → heavy, S22)

---

## 6. Unit тестови

```ts
// hooks/useCanvasOps.test.ts
describe('applyOp', () => {
  it('add tile', () => {
    const result = applyOp([], { type:'add', tileId:'t1', kind:'x', sign:1, x:10, y:20 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id:'t1', kind:'x', sign:1 });
  });
  
  it('remove non-existent tile is idempotent', () => {
    const result = applyOp([], { type:'remove', tileId:'t999' });
    expect(result).toHaveLength(0);
  });
  
  it('move updates position', () => {
    const init = applyOp([], { type:'add', tileId:'t1', kind:'x2', sign:1, x:0, y:0 });
    const moved = applyOp(init, { type:'move', tileId:'t1', x:50, y:80 });
    expect(moved[0]).toMatchObject({ x:50, y:80 });
  });
  
  it('ops applied in order reproduce correct state', () => {
    const ops = [
      { type:'add', tileId:'t1', kind:'x', sign:1, x:0, y:0 },
      { type:'add', tileId:'t2', kind:'1', sign:1, x:50, y:0 },
      { type:'remove', tileId:'t1' },
    ];
    const result = ops.reduce(applyOp, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });
});
```

---

## 7. Firestore Cost Estimate

| Сценарио | Reads/min | Writes/min | Cost/ден |
|----------|-----------|------------|----------|
| 1 сесија (10 ops/min) | ~50 | ~10 | ~$0.001 |
| 10 паралелни сесии | ~500 | ~100 | ~$0.01 |
| 100 паралелни сесии | ~5000 | ~1000 | ~$0.10 |

**Заклучок:** Firestore е финансиски одржлив до ~50 паралелни сесии/ден.
WebSocket e потребен само ако >100 Daily Active Sessions и latency проблеми.

---

## 8. WebSocket Миграција (ако PoC не е доволно)

Ако Firestore latency >600ms perceived:
```
Vercel Edge Function: /api/canvas-ws
Protocol: ws:// → WSS
Messages: JSON { type, tileId, kind, sign, x, y, seqNo }
State: in-memory Map<sessionId, Tile[]> (ephemeral, Redis за persistence)
Auth: Firebase ID token в handshake header
```

**Migration path:** `useCanvasSession` hook менува само `transport` layer.
Компонентите и `applyOp` остануваат исти — zero UI changes.

---

## 9. Definition of Done — B5-2

```
✅ Firestore PoC: 2 browser tabs, tile sync <600ms
✅ useCanvasSession + applyOp: 10+ unit tests passing
✅ Firestore Security Rules: only participants write
✅ Session lifecycle: create/join/end/expire
✅ MultiplayerOverlay: guest cursor visible to host
✅ Host preset → guest видува auto-populated canvas
✅ tsc --noEmit → 0
✅ npm run build → PASS
✅ Mobile: touch на guest → sync на host desktop
✅ Reconnect: 10s offline → ops replay → correct state
```

---

## 10. Редослед (S21)

```
Ден 1-2:  Фаза 0 — PoC (одлука за технологија)
Ден 3-5:  Фаза 1 — Core hook + ops
Ден 6-7:  Фаза 2 — UX overlay + controls
Ден 8:    Фаза 3 — Security + hardening
Ден 9:    Фаза 4 — Integration + tests
Ден 10:   QA + edge cases + commit
```

---

*Документот е единствен извор на вистина за B5-2. Ажурирај го по секоја фаза.*
