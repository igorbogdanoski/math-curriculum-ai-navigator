import json, re, collections, sys

# Write output to UTF-8 file to avoid Windows console encoding issues
out = open(r'c:\Users\pc4all\Downloads\math-curriculum-ai-navigator\analysis_report.txt', 'w', encoding='utf-8')

def p(s=''):
    print(s)
    out.write(s + '\n')

with open(r'c:\Users\pc4all\Downloads\math-curriculum-ai-navigator\data\matura\raw\internal-matura-bank-gymnasium-mk.json', encoding='utf-8') as f:
    data = json.load(f)

questions = data['questions']
p(f'Total questions loaded: {len(questions)}')

# ─────────────────────────────────────────────
# Normalization helper
# ─────────────────────────────────────────────
def normalize(text):
    t = text.lower()
    t = re.sub(r'\$', '', t)
    t = re.sub(r'\\\\', ' ', t)
    t = re.sub(r'\\[a-zA-Z]+', ' ', t)
    t = re.sub(r'[{}_^]', '', t)
    t = re.sub(r'\s+', ' ', t)
    return t.strip()

# ─────────────────────────────────────────────
# Levenshtein – capped at first 150 chars for speed
# ─────────────────────────────────────────────
def levenshtein_capped(s1, s2, cap=150, threshold=20):
    s1, s2 = s1[:cap], s2[:cap]
    if abs(len(s1) - len(s2)) >= threshold:
        return 999
    m, n = len(s1), len(s2)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        min_row = i
        for j in range(1, n + 1):
            temp = dp[j]
            if s1[i-1] == s2[j-1]:
                dp[j] = prev
            else:
                dp[j] = 1 + min(prev, dp[j], dp[j-1])
            prev = temp
            min_row = min(min_row, dp[j])
        if min_row >= threshold:
            return 999  # prune row early
    return dp[n]

# ─────────────────────────────────────────────
# TASK 1 – Near-Duplicate Detection
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 1: Near-Duplicate Detection')
p('='*70)

norms = []
for q in questions:
    n = normalize(q['questionText'])
    norms.append((q['questionNumber'], n, q['questionText']))

# Group by first 60 chars for fast prefix matching
prefix_groups = collections.defaultdict(list)
for i, (qn, n, raw) in enumerate(norms):
    if len(n) >= 60:
        prefix_groups[n[:60]].append(i)

prefix_dup_pairs = set()
for key, idxs in prefix_groups.items():
    if len(idxs) > 1:
        for a in range(len(idxs)):
            for b in range(a+1, len(idxs)):
                pair = (idxs[a], idxs[b])
                prefix_dup_pairs.add(pair)

# Levenshtein check for all remaining pairs
lev_dup_pairs = []
total_q = len(norms)
for i in range(total_q):
    for j in range(i+1, total_q):
        if (i, j) in prefix_dup_pairs:
            continue  # already caught
        qn1, n1, raw1 = norms[i]
        qn2, n2, raw2 = norms[j]
        dist = levenshtein_capped(n1, n2, cap=150, threshold=20)
        if dist < 20:
            lev_dup_pairs.append((i, j, dist))

dup_pairs = []
for (i, j) in prefix_dup_pairs:
    qn1, n1, raw1 = norms[i]
    qn2, n2, raw2 = norms[j]
    dup_pairs.append((qn1, qn2, raw1[:80], raw2[:80], 'First 60 chars match'))
for (i, j, dist) in lev_dup_pairs:
    qn1, n1, raw1 = norms[i]
    qn2, n2, raw2 = norms[j]
    dup_pairs.append((qn1, qn2, raw1[:80], raw2[:80], f'Levenshtein distance = {dist}'))

dup_pairs.sort()

if dup_pairs:
    p(f'  Found {len(dup_pairs)} near-duplicate pair(s):')
    for qn1, qn2, r1, r2, reason in dup_pairs:
        p(f'  Q{qn1} vs Q{qn2} [{reason}]')
        p(f'    Q{qn1}: {r1}')
        p(f'    Q{qn2}: {r2}')
else:
    p('  No near-duplicate pairs found.')

# ─────────────────────────────────────────────
# TASK 2 – MC Without correctAnswer
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 2: MC Questions Without correctAnswer')
p('='*70)

mc_no_answer = [q for q in questions if q.get('questionType') == 'mc' and not q.get('correctAnswer')]
if mc_no_answer:
    p(f'  Found {len(mc_no_answer)}:')
    for q in mc_no_answer:
        p(f'  Q{q["questionNumber"]}: {q["questionText"][:80]}')
else:
    p('  All MC questions have a correctAnswer.')

# ─────────────────────────────────────────────
# TASK 3 – Topic Distribution
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 3: Topic Distribution')
p('='*70)

topic_counter = collections.Counter(q.get('topicArea', 'MISSING') for q in questions)
total = len(questions)
p(f'  {"topicArea":<30} {"count":>6}  {"percentage":>10}')
p(f'  {"-"*50}')
for topic, cnt in sorted(topic_counter.items(), key=lambda x: -x[1]):
    p(f'  {topic:<30} {cnt:>6}  {cnt/total*100:>9.2f}%')

# ─────────────────────────────────────────────
# TASK 4 – DoK Distribution
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 4: DoK Distribution')
p('='*70)

dok_counter = collections.Counter(q.get('dokLevel') for q in questions)
p(f'  {"dokLevel":<12} {"count":>6}  {"percentage":>10}')
p(f'  {"-"*32}')
for dok, cnt in sorted(dok_counter.items(), key=lambda x: (x[0] is None, x[0])):
    label = str(dok) if dok is not None else 'NULL'
    p(f'  {label:<12} {cnt:>6}  {cnt/total*100:>9.2f}%')

# ─────────────────────────────────────────────
# TASK 5 – aiSolution = null Count
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 5: aiSolution = null Count')
p('='*70)

ai_null = sum(1 for q in questions if q.get('aiSolution') is None)
p(f'  Questions with aiSolution = null: {ai_null} / {total}  ({ai_null/total*100:.2f}%)')

# ─────────────────────────────────────────────
# TASK 6 – Concept ID Audit
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 6: Concept ID Audit')
p('='*70)

cid_counter = collections.Counter()
for q in questions:
    for cid in q.get('conceptIds', []):
        cid_counter[cid] += 1

singletons = sorted([cid for cid, cnt in cid_counter.items() if cnt == 1])
p(f'\n  Singleton conceptIds ({len(singletons)} total):')
for cid in singletons:
    p(f'    {cid}')

valid_pattern = re.compile(r'^gym\d{2}-c\d+-\d+$')
malformed = [cid for cid in cid_counter if not valid_pattern.match(cid)]
p(f'\n  Malformed/unexpected conceptIds ({len(malformed)}):')
if malformed:
    for cid in sorted(malformed):
        p(f'    {cid}  (count={cid_counter[cid]})')
else:
    p('    None found.')

p(f'\n  Top 10 most frequent conceptIds:')
for cid, cnt in cid_counter.most_common(10):
    p(f'    {cid:<30} {cnt:>4}')

# ─────────────────────────────────────────────
# TASK 7 – Points Distribution
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 7: Points Distribution')
p('='*70)

points_counter = collections.Counter(q.get('points') for q in questions)
p(f'  {"points":<10} {"count":>6}  {"percentage":>10}')
p(f'  {"-"*30}')
for pts, cnt in sorted(points_counter.items(), key=lambda x: (x[0] is None, x[0])):
    label = str(pts) if pts is not None else 'NULL'
    p(f'  {label:<10} {cnt:>6}  {cnt/total*100:>9.2f}%')

# ─────────────────────────────────────────────
# TASK 8 – Short Part-2/4pt Questions
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 8: Short Part-2 / 4-point Questions for Reclassification')
p('='*70)

def strip_latex(text):
    t = re.sub(r'\$[^$]*\$', '', text)
    t = re.sub(r'[\$\\{}]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

short_part2 = []
for q in questions:
    if q.get('part') == 2 and q.get('points') == 4:
        stripped = strip_latex(q['questionText'])
        if len(stripped) < 50:
            short_part2.append((q['questionNumber'], q['questionText'], stripped, len(stripped)))

if short_part2:
    p(f'  Found {len(short_part2)} question(s):')
    for qn, raw, stripped, slen in short_part2:
        p(f'  Q{qn} (stripped len={slen}): {raw[:100]}')
        p(f'    Stripped: "{stripped}"')
else:
    p('  No such questions found.')

# ─────────────────────────────────────────────
# TASK 9 – Duplicate questionNumbers
# ─────────────────────────────────────────────
p('\n' + '='*70)
p('TASK 9: Duplicate questionNumbers')
p('='*70)

qnum_positions = collections.defaultdict(list)
for idx, q in enumerate(questions):
    qnum_positions[q['questionNumber']].append(idx)

dups = {qn: positions for qn, positions in qnum_positions.items() if len(positions) > 1}
if dups:
    p(f'  Found {len(dups)} duplicate questionNumber(s):')
    for qn, positions in sorted(dups.items()):
        p(f'  questionNumber {qn} appears at array positions: {positions}')
else:
    p('  No duplicate questionNumbers found.')

p('\n' + '='*70)
p('ANALYSIS COMPLETE')
p('='*70)

out.close()
print('Done. Report written to analysis_report.txt')
