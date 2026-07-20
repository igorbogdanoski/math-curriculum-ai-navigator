/**
 * 2026-07-20 (Wave 10, drifting-snuggling-wave.md). Starter TikZ source per curriculum topic,
 * shown in TikzLab's template sidebar. A `.ts` module (not JSON) specifically so multi-line
 * LaTeX/TikZ code can be written as template literals without hand-escaping every backslash —
 * JSON would force `\\draw` -> `\\\\draw` throughout, which is unreadable and error-prone to edit.
 *
 * CONSTRAINT (Wave 16, found via `npm run tikz:test-templates` failing on 2 templates): bare
 * Cyrillic text inside a `\node{...}` label fails to compile — `! Package inputenc Error:
 * Unicode character ... not set up for use with LaTeX` — the CDN-hosted TeX engine has no
 * Cyrillic font/encoding configured. Every label in every template's `code` here MUST stay
 * Latin/Greek math-mode symbols only (e.g. `$\alpha$`, `$A$`) — put any Macedonian-language
 * explanation in the template's `descKey` (shown in the UI around the diagram), never baked
 * into the TikZ source itself.
 */

/**
 * 2026-07-20 (Wave 16, drifting-snuggling-wave.md). Per-template curriculum linking —
 * more precise than data/labCurriculumMap.ts's lab-level tagging (one entry for the whole
 * TikZ lab). Optional so it doesn't force every future template to be tagged before it can
 * ship, but every currently-shipped template IS tagged (see tikzTemplates.test.ts, which
 * checks every code referenced here actually exists in the corresponding registry).
 */
export interface TikzCurriculumTags {
  /** data/allNationalStandardsComplete.ts MATH_STANDARDS codes, e.g. 'III-А.14'. */
  primaryStandardCodes?: string[];
  /** Theme-level ids from data/official/grade8Official.ts / grade9Official.ts, e.g. 'g8-off-2'.
   *  Subtopics in those files have no id of their own — theme-level is the finest stable grain. */
  primaryTopicIds?: string[];
  /** Concept-level ids from data/secondary/*.ts, e.g. 'gym10-c1-1' — these ARE stable per-concept,
   *  unlike primary subtopics, since the secondary registry is more granularly structured. */
  secondaryConceptIds?: string[];
}

export interface TikzTemplate {
  id: string;
  titleKey: string;
  descKey: string;
  category: string;
  gradeLevel: ('primary' | 'secondary')[];
  code: string;
  curriculumTags?: TikzCurriculumTags;
}

export const tikzTemplates: TikzTemplate[] = [
  {
    id: 'parallel-transversal',
    titleKey: 'tikz.template.parallelTransversal.title',
    descKey: 'tikz.template.parallelTransversal.desc',
    category: 'geometry',
    gradeLevel: ['primary', 'secondary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.12'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\usetikzlibrary{angles,quotes,calc,intersections}
\\begin{tikzpicture}[>=stealth,scale=1.2]
  % Two parallel lines a, b cut by a transversal t — points A, B are computed by TikZ
  % itself (name intersections), not hardcoded, so changing the transversal's angle or
  % the lines' positions keeps everything (angle marks included) correctly aligned.
  \\draw[<->,thick,name path=lineA] (-3.5,1) -- (3.5,1) node[right] {$a$};
  \\draw[<->,thick,name path=lineB] (-3.5,-1) -- (3.5,-1) node[right] {$b$};
  \\draw[<->,thick,name path=lineT] (-2.5,2.5) -- (2.5,-2.5) node[below right] {$t$};

  \\path [name intersections={of=lineA and lineT, by=A}];
  \\path [name intersections={of=lineB and lineT, by=B}];

  \\coordinate (Aright) at ($(A) + (2,0)$);
  \\coordinate (Ttop)   at ($(A) + (-1.2,1.8)$);
  \\coordinate (Bright) at ($(B) + (2,0)$);
  \\coordinate (Tbot)   at ($(B) + (1.2,-1.8)$);

  % Corresponding angles at A and B are equal (parallel postulate) — same alpha label
  \\pic [draw, fill=blue!15, angle radius=7mm, "$\\alpha$" opacity=1] {angle = Aright--A--Ttop};
  \\pic [draw, fill=blue!15, angle radius=7mm, "$\\alpha$" opacity=1] {angle = Bright--B--Tbot};

  \\node[above left, font=\\bfseries] at (-3.3,2.2) {$a \\parallel b$};
\\end{tikzpicture}`,
  },
  {
    id: 'pythagorean-theorem',
    titleKey: 'tikz.template.pythagoreanTheorem.title',
    descKey: 'tikz.template.pythagoreanTheorem.desc',
    category: 'geometry',
    gradeLevel: ['primary', 'secondary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.14'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\begin{tikzpicture}[scale=1.1]
  % Right triangle
  \\draw[very thick] (0,0) -- (4,0) -- (0,3) -- cycle;

  % Right-angle corner mark (MK-standard small square at the right angle)
  \\draw (0,0.4) -- (0.4,0.4) -- (0.4,0);

  % Side labels
  \\node[below] at (2,0) {$b = 4$};
  \\node[left] at (0,1.5) {$a = 3$};
  \\node[above right] at (2,1.5) {$c = 5$};

  % Vertex labels
  \\node[below left] at (0,0) {$C$};
  \\node[below right] at (4,0) {$B$};
  \\node[above left] at (0,3) {$A$};
\\end{tikzpicture}`,
  },
  {
    id: 'central-inscribed-angle',
    titleKey: 'tikz.template.centralInscribedAngle.title',
    descKey: 'tikz.template.centralInscribedAngle.desc',
    category: 'geometry',
    gradeLevel: ['secondary'],
    curriculumTags: {
      // Central/inscribed angle over the same arc is actually introduced in grade 8
      // (g8-off-2 subtopic 1: "периферен агол... врска со централниот агол над ист лак"),
      // not gymnasium-only — gradeLevel above predates this tagging pass and is left as-is
      // (changing it affects TikzLab's grade filtering, out of scope for a tagging-only change).
      primaryStandardCodes: ['III-А.12'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\usetikzlibrary{calc}
\\begin{tikzpicture}[scale=1.3]
  % Circle with center O
  \\draw[very thick] (0,0) circle (2);
  \\fill (0,0) circle (1.5pt);
  \\node[below] at (0,-0.15) {$O$};

  % Two radii to A and B (defining the arc), plus a third point C on the major arc
  \\coordinate (A) at (140:2);
  \\coordinate (B) at (40:2);
  \\coordinate (C) at (250:2);

  \\draw[very thick,blue] (0,0) -- (A) node[above left] {$A$};
  \\draw[very thick,blue] (0,0) -- (B) node[above right] {$B$};
  \\draw[very thick,red] (C) -- (A);
  \\draw[very thick,red] (C) -- (B);
  \\node[below] at (C) {$C$};

  % Central angle mark at O
  \\draw[blue] (40:0.5) arc (40:140:0.5);
  \\node[blue] at (90:0.75) {$\\alpha$};

  % Inscribed angle mark at C (half the central angle, per the theorem)
  \\draw[red] ($(C)+(70:0.5)$) arc (70:140:0.5);
  \\node[red] at ($(C)+(105:0.85)$) {$\\beta$};
\\end{tikzpicture}`,
  },
  {
    id: 'circle-parts',
    titleKey: 'tikz.template.circleParts.title',
    descKey: 'tikz.template.circleParts.desc',
    category: 'geometry',
    gradeLevel: ['primary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.12'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\begin{tikzpicture}[scale=1.3]
  \\draw[very thick] (0,0) circle (2);
  \\fill (0,0) circle (1pt);
  \\node[below] at (0,-0.15) {$O$};

  % Кружен исечок (sector, blue) — wedge between two radii
  \\fill[blue!15] (0,0) -- (20:2) arc (20:80:2) -- cycle;
  \\draw[thick,blue] (0,0) -- (20:2);
  \\draw[thick,blue] (0,0) -- (80:2) node[midway,above,sloped,blue] {$S$};

  % Тетива + кружен отсечок (chord + segment, red) shaded on the other side
  \\coordinate (P) at (200:2);
  \\coordinate (Q) at (260:2);
  \\fill[red!15] (P) -- (Q) arc (260:200:2) -- cycle;
  \\draw[very thick,red] (P) -- (Q) node[midway,below,sloped,red] {$T$};
\\end{tikzpicture}`,
  },
  {
    id: 'triangle-congruence-sas',
    titleKey: 'tikz.template.triangleCongruenceSas.title',
    descKey: 'tikz.template.triangleCongruenceSas.desc',
    category: 'geometry',
    gradeLevel: ['primary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.12'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\usetikzlibrary{angles,quotes,calc}
\\begin{tikzpicture}[scale=0.9]
  % Triangle 1
  \\coordinate (A1) at (0,0);
  \\coordinate (B1) at (3,0);
  \\coordinate (C1) at (3,2);
  \\draw[very thick] (A1) -- (B1) -- (C1) -- cycle;
  \\node[below left] at (A1) {$A$};
  \\node[below right] at (B1) {$B$};
  \\node[above right] at (C1) {$C$};
  \\node[below] at ($(A1)!0.5!(B1)$) {$5\\,cm$};
  \\node[right] at ($(B1)!0.5!(C1)$) {$4\\,cm$};
  \\pic [draw, angle radius=8mm, "$\\beta$"] {angle=C1--B1--A1};

  % Triangle 2 — same two sides and included angle (САС) → conguent
  \\coordinate (A2) at (6,0);
  \\coordinate (B2) at (9,0);
  \\coordinate (C2) at (9,2);
  \\draw[very thick] (A2) -- (B2) -- (C2) -- cycle;
  \\node[below left] at (A2) {$A'$};
  \\node[below right] at (B2) {$B'$};
  \\node[above right] at (C2) {$C'$};
  \\node[below] at ($(A2)!0.5!(B2)$) {$5\\,cm$};
  \\node[right] at ($(B2)!0.5!(C2)$) {$4\\,cm$};
  \\pic [draw, angle radius=8mm, "$\\beta$"] {angle=C2--B2--A2};

  \\node[font=\\Large] at (4.5,-0.8) {$\\cong$};
\\end{tikzpicture}`,
  },
  {
    id: 'trapezoid-median-line',
    titleKey: 'tikz.template.trapezoidMedianLine.title',
    descKey: 'tikz.template.trapezoidMedianLine.desc',
    category: 'geometry',
    gradeLevel: ['primary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.12'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\usetikzlibrary{calc}
\\begin{tikzpicture}[scale=1.0]
  \\coordinate (A) at (0,0);
  \\coordinate (B) at (6,0);
  \\coordinate (C) at (4.5,3);
  \\coordinate (D) at (1.5,3);
  \\draw[very thick] (A) -- (B) -- (C) -- (D) -- cycle;
  \\node[below left] at (A) {$A$};
  \\node[below right] at (B) {$B$};
  \\node[above right] at (C) {$C$};
  \\node[above left] at (D) {$D$};
  \\node[below] at ($(A)!0.5!(B)$) {$b$};
  \\node[above] at ($(D)!0.5!(C)$) {$a$};

  % Средна линија — connects the midpoints of the two legs
  \\coordinate (M) at ($(A)!0.5!(D)$);
  \\coordinate (N) at ($(B)!0.5!(C)$);
  \\draw[very thick,red,dashed] (M) -- (N);
  \\node[above,black] at ($(M)!0.5!(N)$) {$m=\\frac{a+b}{2}$};
  \\fill (M) circle (1.3pt);
  \\fill (N) circle (1.3pt);
\\end{tikzpicture}`,
  },
  {
    id: 'square-inscribed-circumscribed-circle',
    titleKey: 'tikz.template.squareInscribedCircumscribedCircle.title',
    descKey: 'tikz.template.squareInscribedCircumscribedCircle.desc',
    category: 'geometry',
    gradeLevel: ['primary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.12'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\begin{tikzpicture}[scale=1.1]
  \\coordinate (A) at (-1.5,-1.5);
  \\coordinate (B) at (1.5,-1.5);
  \\coordinate (C) at (1.5,1.5);
  \\coordinate (D) at (-1.5,1.5);
  \\draw[very thick] (A) -- (B) -- (C) -- (D) -- cycle;
  \\fill (0,0) circle (1pt);
  \\node[below] at (0,-0.15) {$O$};

  % Опишана кружница (circumscribed, blue) — through the 4 vertices
  \\draw[thick,blue] (0,0) circle ({1.5*sqrt(2)});
  \\node[blue] at (135:{1.5*sqrt(2)+0.3}) {$R$};
  % Впишана кружница (inscribed, red) — tangent to the 4 sides
  \\draw[thick,red] (0,0) circle (1.5);
  \\node[red] at (45:1.2) {$r$};
\\end{tikzpicture}`,
  },
  {
    id: 'rhombus-diagonals',
    titleKey: 'tikz.template.rhombusDiagonals.title',
    descKey: 'tikz.template.rhombusDiagonals.desc',
    category: 'geometry',
    gradeLevel: ['primary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.12'],
      primaryTopicIds: ['g8-off-2'],
    },
    code: `\\begin{tikzpicture}[scale=1.1]
  \\coordinate (A) at (0,-2);
  \\coordinate (B) at (3,0);
  \\coordinate (C) at (0,2);
  \\coordinate (D) at (-3,0);
  \\draw[very thick] (A) -- (B) -- (C) -- (D) -- cycle;
  \\node[below] at (A) {$A$};
  \\node[right] at (B) {$B$};
  \\node[above] at (C) {$C$};
  \\node[left] at (D) {$D$};

  % Дијагоналите се сечат под прав агол и се симетрали една на друга
  \\draw[thick,dashed,red] (A) -- (C);
  \\draw[thick,dashed,blue] (B) -- (D);
  \\draw (0,-0.3) -- (0.3,-0.3) -- (0.3,0);
  \\fill (0,0) circle (1.3pt);
\\end{tikzpicture}`,
  },
  {
    id: 'similar-triangles',
    titleKey: 'tikz.template.similarTriangles.title',
    descKey: 'tikz.template.similarTriangles.desc',
    category: 'geometry',
    gradeLevel: ['primary'],
    curriculumTags: {
      primaryStandardCodes: ['III-А.16'],
      primaryTopicIds: ['g9-off-2'],
    },
    code: `\\usetikzlibrary{calc}
\\begin{tikzpicture}[scale=0.7]
  % Помал триаголник
  \\coordinate (A1) at (0,0);
  \\coordinate (B1) at (3,0);
  \\coordinate (C1) at (1,2);
  \\draw[very thick] (A1) -- (B1) -- (C1) -- cycle;
  \\node[below left] at (A1) {$A$};
  \\node[below right] at (B1) {$B$};
  \\node[above] at (C1) {$C$};
  \\node[below] at ($(A1)!0.5!(B1)$) {$a$};

  % Поголем сличен триаголник — скалиран со фактор k=1.6
  \\coordinate (A2) at (7,0);
  \\coordinate (B2) at (11.8,0);
  \\coordinate (C2) at (8.6,3.2);
  \\draw[very thick] (A2) -- (B2) -- (C2) -- cycle;
  \\node[below left] at (A2) {$A'$};
  \\node[below right] at (B2) {$B'$};
  \\node[above] at (C2) {$C'$};
  \\node[below] at ($(A2)!0.5!(B2)$) {$k\\cdot a$};

  \\node[font=\\Large] at (5,1) {$\\sim$};
\\end{tikzpicture}`,
  },
];
