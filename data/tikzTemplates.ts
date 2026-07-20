/**
 * 2026-07-20 (Wave 10, drifting-snuggling-wave.md). Starter TikZ source per curriculum topic,
 * shown in TikzLab's template sidebar. A `.ts` module (not JSON) specifically so multi-line
 * LaTeX/TikZ code can be written as template literals without hand-escaping every backslash —
 * JSON would force `\\draw` -> `\\\\draw` throughout, which is unreadable and error-prone to edit.
 */

export interface TikzTemplate {
  id: string;
  titleKey: string;
  descKey: string;
  category: string;
  gradeLevel: ('primary' | 'secondary')[];
  code: string;
}

export const tikzTemplates: TikzTemplate[] = [
  {
    id: 'parallel-transversal',
    titleKey: 'tikz.template.parallelTransversal.title',
    descKey: 'tikz.template.parallelTransversal.desc',
    category: 'geometry',
    gradeLevel: ['primary', 'secondary'],
    code: `\\begin{tikzpicture}[scale=1.1]
  % Two parallel lines cut by a transversal
  \\draw[very thick] (-2.5,1.5) -- (2.5,1.5) node[right] {$a$};
  \\draw[very thick] (-2.5,-0.5) -- (2.5,-0.5) node[right] {$b$};
  \\draw[very thick,blue] (-1.5,-1.3) -- (1.5,2.3) node[above] {$t$};

  % Parallel tick marks
  \\draw (-0.15,1.65) -- (0.15,1.35);
  \\draw (-0.15,-0.35) -- (0.15,-0.65);

  % Intersection points
  \\fill (-0.375,1.5) circle (1.5pt);
  \\fill (0.375,-0.5) circle (1.5pt);

  % Corresponding angles marked at the top intersection
  \\draw[red] (-0.375,1.5) ++(20:0.5) arc (20:160:0.5);
  \\node[red] at (-0.375,2.05) {$\\alpha$};
\\end{tikzpicture}`,
  },
  {
    id: 'pythagorean-theorem',
    titleKey: 'tikz.template.pythagoreanTheorem.title',
    descKey: 'tikz.template.pythagoreanTheorem.desc',
    category: 'geometry',
    gradeLevel: ['primary', 'secondary'],
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
];
