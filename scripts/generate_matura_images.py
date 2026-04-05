#!/usr/bin/env python3
"""
generate_matura_images.py
=========================
Generates PNG illustrations for ДИМ matura exam questions.

Each question that has `hasImage: true` in the JSON needs a corresponding
PNG file.  This script holds a registry of *what to draw* for each image
and renders them with matplotlib so the output is pixel-perfect and
mathematically accurate.

Usage
-----
  python scripts/generate_matura_images.py           # generate missing only
  python scripts/generate_matura_images.py --force   # regenerate all
  python scripts/generate_matura_images.py --list    # show registry & status
  python scripts/generate_matura_images.py q05-june  # generate one by id

Requirements
------------
  pip install matplotlib numpy

Optional (for symbolic curve computation):
  pip install sympy
"""

import argparse
import os
import sys
from pathlib import Path

# Force UTF-8 output so Cyrillic/Albanian exam labels print correctly on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
IMAGE_BASE  = PROJECT_DIR / "data" / "matura" / "images"

# ── Matplotlib style ──────────────────────────────────────────────────────────
matplotlib.rcParams.update({
    "font.family":        "DejaVu Sans",
    "mathtext.fontset":   "dejavusans",
    "axes.spines.top":    False,
    "axes.spines.right":  False,
    "figure.facecolor":   "white",
    "axes.facecolor":     "white",
    "savefig.dpi":        150,
    "savefig.bbox":       "tight",
    "savefig.pad_inches": 0.15,
})

DPI = 150

# ═══════════════════════════════════════════════════════════════════════════════
#  Drawing helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _add_axes_arrows(ax, xlim, ylim, color="#333333"):
    """Draw x and y axes with arrow tips through the origin."""
    xmin, xmax = xlim
    ymin, ymax = ylim
    # x-axis
    ax.annotate("", xy=(xmax * 1.05, 0), xytext=(xmin * 1.05, 0),
                arrowprops=dict(arrowstyle="->", color=color, lw=1.2))
    # y-axis
    ax.annotate("", xy=(0, ymax * 1.05), xytext=(0, ymin * 1.05),
                arrowprops=dict(arrowstyle="->", color=color, lw=1.2))
    ax.text(xmax * 1.08, -0.15, "x", ha="center", va="top",
            fontsize=11, color=color)
    ax.text(0.12, ymax * 1.08, "y", ha="left", va="center",
            fontsize=11, color=color)


def _style_exam_axes(ax, xlim, ylim, xticks=None, yticks=None,
                     grid=True, origin_label=True):
    """Apply clean exam-style formatting to axes."""
    ax.set_xlim(xlim[0] - 0.3, xlim[1] + 0.5)
    ax.set_ylim(ylim[0] - 0.3, ylim[1] + 0.5)

    # Hide default spines/ticks
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_xticks([])
    ax.set_yticks([])

    if grid:
        # Light grid lines
        xs = xticks if xticks is not None else range(int(xlim[0]), int(xlim[1]) + 1)
        ys = yticks if yticks is not None else range(int(ylim[0]), int(ylim[1]) + 1)
        for x in xs:
            ax.axvline(x, color="#e5e7eb", lw=0.8, zorder=0)
        for y in ys:
            ax.axhline(y, color="#e5e7eb", lw=0.8, zorder=0)

        # Axis lines (on top of grid)
        ax.axhline(0, color="#9ca3af", lw=1.0, zorder=1)
        ax.axvline(0, color="#9ca3af", lw=1.0, zorder=1)

        # Tick labels
        for x in xs:
            if x == 0:
                continue
            ax.text(x, -0.28, str(x), ha="center", va="top",
                    fontsize=8, color="#6b7280")
        for y in ys:
            if y == 0:
                continue
            ax.text(-0.25, y, str(y), ha="right", va="center",
                    fontsize=8, color="#6b7280")

    _add_axes_arrows(ax, xlim, ylim)

    if origin_label:
        ax.text(-0.25, -0.28, "O", ha="right", va="top",
                fontsize=9, color="#6b7280")


def _mark_point(ax, x, y, label=None, color="#2563eb",
                offset=(0.12, 0.15), zorder=5):
    ax.plot(x, y, "o", color=color, markersize=5, zorder=zorder)
    if label:
        ax.text(x + offset[0], y + offset[1], label,
                fontsize=9, color=color, va="bottom")


# ═══════════════════════════════════════════════════════════════════════════════
#  Renderer functions — one per image type
# ═══════════════════════════════════════════════════════════════════════════════

def render_quadratic(p: dict, out_path: Path):
    """
    Render a parabola f(x) = a*(x-h)^2 + k.

    Required params:
      h, k      — vertex coordinates
      a         — leading coefficient (default 1, positive = opens up)

    Optional:
      xlim, ylim, figsize, mark_vertex, mark_points,
      label_vertex, curve_color, vertex_color
    """
    h = p["h"]
    k = p["k"]
    a = p.get("a", 1)

    xlim = p.get("xlim", (h - 4, h + 4))
    ylim = p.get("ylim", (k - 0.5, k + 8))

    fig, ax = plt.subplots(figsize=p.get("figsize", (4.5, 4.5)))

    xs = np.linspace(xlim[0] - 0.5, xlim[1] + 0.5, 500)
    ys = a * (xs - h) ** 2 + k

    # Clip to visible window (with small margin)
    mask = (ys >= ylim[0] - 1) & (ys <= ylim[1] + 1)

    ax.plot(xs[mask], ys[mask],
            color=p.get("curve_color", "#2563eb"), lw=2.2, zorder=3)

    _style_exam_axes(
        ax, xlim, ylim,
        xticks=p.get("xticks"),
        yticks=p.get("yticks"),
        grid=p.get("grid", True),
    )

    # Vertex
    if p.get("mark_vertex", True):
        vcolor = p.get("vertex_color", "#dc2626")
        _mark_point(ax, h, k, color=vcolor, zorder=6,
                    offset=(0.1, 0.15) if a > 0 else (0.1, -0.35))
        if p.get("label_vertex", True):
            label = f"({h}, {k})"
            dx, dy = (0.15, 0.15) if a > 0 else (0.15, -0.4)
            ax.text(h + dx, k + dy, label,
                    fontsize=9, color=vcolor, va="bottom")

    # Extra labelled points
    for pt in p.get("mark_points", []):
        _mark_point(ax, pt[0], pt[1],
                    label=pt[2] if len(pt) > 2 else None,
                    color=p.get("point_color", "#059669"))

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=DPI)
    plt.close(fig)
    print(f"  OK  {out_path.relative_to(PROJECT_DIR)}")


def render_linear(p: dict, out_path: Path):
    """
    Render a linear function y = m*x + b.

    Required params:
      m, b  — slope and y-intercept

    Optional:
      xlim, ylim, figsize, color, mark_points, lw
    """
    m = p["m"]
    b = p["b"]
    xlim  = p.get("xlim", (-3, 4))
    ylim  = p.get("ylim", (-3, 5))
    color = p.get("color", "#dc2626")

    fig, ax = plt.subplots(figsize=p.get("figsize", (4.5, 4.5)))

    xs = np.linspace(xlim[0] - 0.5, xlim[1] + 0.5, 300)
    ys = m * xs + b

    mask = (ys >= ylim[0] - 1) & (ys <= ylim[1] + 1)
    ax.plot(xs[mask], ys[mask], color=color, lw=p.get("lw", 2.0), zorder=3)

    _style_exam_axes(
        ax, xlim, ylim,
        xticks=p.get("xticks"),
        yticks=p.get("yticks"),
        grid=p.get("grid", True),
    )

    for pt in p.get("mark_points", []):
        _mark_point(ax, pt[0], pt[1],
                    label=pt[2] if len(pt) > 2 else None,
                    color=color, offset=(0.12, 0.12))

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=DPI)
    plt.close(fig)
    print(f"  OK  {out_path.relative_to(PROJECT_DIR)}")


def render_geometry(p: dict, out_path: Path):
    """
    Render a geometric figure from a list of shapes.

    Each shape is a dict with a "type" key:
      { "type": "polygon",  "pts": [[x,y],...], "color": "#2563eb", "fill": "#dbeafe" }
      { "type": "circle",   "cx": x, "cy": y, "r": r, ... }
      { "type": "line",     "pts": [[x1,y1],[x2,y2]], ... }
      { "type": "point",    "x": x, "y": y, "label": "A", ... }
      { "type": "angle",    "vertex": [x,y], "p1": [x,y], "p2": [x,y], "label": "α" }
      { "type": "text",     "x": x, "y": y, "text": "h", ... }
      { "type": "dim",      "p1": [x,y], "p2": [x,y], "label": "5cm", ... }

    Required params:
      shapes      — list of shape dicts
      xlim, ylim  — coordinate window
    """
    xlim   = p.get("xlim", (-1, 10))
    ylim   = p.get("ylim", (-1, 8))
    shapes = p.get("shapes", [])

    fig, ax = plt.subplots(figsize=p.get("figsize", (5, 5)))
    ax.set_aspect("equal")
    ax.set_xlim(xlim[0] - 0.5, xlim[1] + 0.5)
    ax.set_ylim(ylim[0] - 0.5, ylim[1] + 0.5)

    if p.get("axes", False):
        _style_exam_axes(ax, xlim, ylim,
                         xticks=p.get("xticks"),
                         yticks=p.get("yticks"))
    else:
        ax.axis("off")

    for sh in shapes:
        t = sh["type"]
        color = sh.get("color", "#1e40af")
        fill  = sh.get("fill",  "none")
        lw    = sh.get("lw",    1.8)
        alpha = sh.get("alpha", 1.0)

        if t == "polygon":
            pts = np.array(sh["pts"])
            closed = np.vstack([pts, pts[0]])
            ax.fill(pts[:, 0], pts[:, 1],
                    color=fill if fill != "none" else "none",
                    alpha=0.25 * alpha, zorder=2)
            ax.plot(closed[:, 0], closed[:, 1],
                    color=color, lw=lw, zorder=3)

        elif t == "circle":
            circ = plt.Circle((sh["cx"], sh["cy"]), sh["r"],
                              edgecolor=color,
                              facecolor=fill if fill != "none" else "none",
                              lw=lw, zorder=3)
            ax.add_patch(circ)

        elif t == "line":
            pts = np.array(sh["pts"])
            ax.plot(pts[:, 0], pts[:, 1],
                    color=color, lw=lw,
                    linestyle=sh.get("linestyle", "-"), zorder=3)

        elif t == "point":
            ax.plot(sh["x"], sh["y"], "o", color=color, markersize=5, zorder=5)
            if sh.get("label"):
                ox, oy = sh.get("offset", (0.15, 0.15))
                ax.text(sh["x"] + ox, sh["y"] + oy, sh["label"],
                        fontsize=10, color=color, fontweight="bold", zorder=6)

        elif t == "angle":
            import matplotlib.patches as mpatches
            v  = np.array(sh["vertex"])
            p1 = np.array(sh["p1"])
            p2 = np.array(sh["p2"])
            a1 = np.degrees(np.arctan2(p1[1] - v[1], p1[0] - v[0]))
            a2 = np.degrees(np.arctan2(p2[1] - v[1], p2[0] - v[0]))
            r  = sh.get("radius", 0.4)
            arc = mpatches.Arc(v, 2 * r, 2 * r,
                               angle=0, theta1=min(a1, a2), theta2=max(a1, a2),
                               color=color, lw=1.2)
            ax.add_patch(arc)
            if sh.get("label"):
                mid_a = (a1 + a2) / 2
                mid   = v + 1.4 * r * np.array([np.cos(np.radians(mid_a)),
                                                 np.sin(np.radians(mid_a))])
                ax.text(mid[0], mid[1], sh["label"],
                        fontsize=9, ha="center", va="center", color=color)

        elif t == "text":
            ax.text(sh["x"], sh["y"], sh["text"],
                    fontsize=sh.get("fontsize", 10),
                    ha=sh.get("ha", "center"), va=sh.get("va", "center"),
                    color=color)

        elif t == "dim":
            p1 = np.array(sh["p1"])
            p2 = np.array(sh["p2"])
            mid = (p1 + p2) / 2
            off = np.array(sh.get("offset", [0, 0.3]))
            ax.annotate("", xy=p2, xytext=p1,
                        arrowprops=dict(arrowstyle="<->",
                                        color=color, lw=1.0))
            ax.text(mid[0] + off[0], mid[1] + off[1], sh.get("label", ""),
                    fontsize=9, ha="center", va="bottom", color=color)

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=DPI)
    plt.close(fig)
    print(f"  OK  {out_path.relative_to(PROJECT_DIR)}")


def render_trig(p: dict, out_path: Path):
    """
    Render a trigonometric function f(x) = a*sin(b*x + c) + d
    or f(x) = a*cos(b*x + c) + d.

    Required params:
      func   — "sin" or "cos"
      a, b, c, d  — amplitude, period factor, phase, vertical shift

    Optional:
      xlim, ylim, figsize, color, mark_points, pi_labels
    """
    func  = p.get("func", "sin")
    a     = p.get("a", 1)
    b     = p.get("b", 1)
    c     = p.get("c", 0)
    d     = p.get("d", 0)
    xlim  = p.get("xlim", (-np.pi - 0.5, 2 * np.pi + 0.5))
    ylim  = p.get("ylim", (-abs(a) - 0.5, abs(a) + 0.5))
    color = p.get("color", "#7c3aed")

    fig, ax = plt.subplots(figsize=p.get("figsize", (6, 3.5)))
    xs = np.linspace(xlim[0], xlim[1], 1000)
    ys = a * (np.sin(b * xs + c) if func == "sin" else np.cos(b * xs + c)) + d

    ax.plot(xs, ys, color=color, lw=2.0, zorder=3)

    _style_exam_axes(ax, xlim, ylim, grid=p.get("grid", True))

    # π labels on x-axis
    if p.get("pi_labels", True):
        pi_ticks = [k * np.pi / 2 for k in range(
            int(xlim[0] / (np.pi / 2)) - 1,
            int(xlim[1] / (np.pi / 2)) + 2,
        )]
        _pi_names = {0: "0", 1: "π/2", 2: "π", 3: "3π/2",
                     4: "2π", -1: "-π/2", -2: "-π"}
        for x in pi_ticks:
            k = round(x / (np.pi / 2))
            label = _pi_names.get(k, f"{k}π/2")
            ax.text(x, -abs(a) * 0.18, label,
                    ha="center", va="top", fontsize=8, color="#6b7280")

    for pt in p.get("mark_points", []):
        _mark_point(ax, pt[0], pt[1],
                    label=pt[2] if len(pt) > 2 else None,
                    color=color)

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=DPI)
    plt.close(fig)
    print(f"  OK  {out_path.relative_to(PROJECT_DIR)}")


# ═══════════════════════════════════════════════════════════════════════════════
#  IMAGE REGISTRY
#  Add a new entry here whenever a question gets hasImage: true in the JSON.
# ═══════════════════════════════════════════════════════════════════════════════
#
# Each entry:
#   id      — short identifier (for --id filter)
#   file    — output path relative to project root
#   type    — "quadratic" | "linear" | "geometry" | "trig"
#   params  — dict passed to the matching render_* function
#
IMAGE_REGISTRY = [

    # ── Јуни 2025 ──────────────────────────────────────────────────────────────
    {
        "id":   "q05-june-2025",
        "exam": "Јуни 2025 Q5 — Квадратна функција",
        "file": "data/matura/images/2025/june/q05-fig1.png",
        "type": "quadratic",
        "params": {
            # f(x) = (x - 2)^2 + 1  →  vertex (2, 1), opens up
            "h": 2, "k": 1, "a": 1,
            "xlim": (-1, 5),
            "ylim": (-0.5, 7),
            "xticks": range(-1, 6),
            "yticks": range(0, 8),
            "mark_vertex": True,
            "label_vertex": True,
            "curve_color": "#2563eb",
            "vertex_color": "#dc2626",
            "figsize": (4.5, 4.5),
        },
    },

    # ── Август 2025 ────────────────────────────────────────────────────────────
    {
        "id":   "q07-august-2025",
        "exam": "Август 2025 Q7 — Линеарна функција",
        "file": "data/matura/images/2025/august/q07-fig1.png",
        "type": "linear",
        "params": {
            # y = -3x + 3,  passes through (0, 3) and (1, 0)
            "m": -3, "b": 3,
            "xlim": (-2, 4),
            "ylim": (-1, 4),
            "xticks": range(-2, 5),
            "yticks": range(-1, 5),
            "color": "#dc2626",
            "mark_points": [
                (0, 3),   # y-intercept
                (1, 0),   # x-intercept
            ],
            "figsize": (4.5, 4.5),
        },
    },

    # ── Add future entries below ────────────────────────────────────────────────
    # Example geometry entry (commented out):
    # {
    #     "id":   "q19-june-2025",
    #     "exam": "Јуни 2025 Q19 — Рамнокрак трапез",
    #     "file": "data/matura/images/2025/june/q19-fig1.png",
    #     "type": "geometry",
    #     "params": {
    #         # Isosceles trapezoid: longer base split into 16+6=22, shorter base=10
    #         # Height h = sqrt(leg² - ((22-10)/2)²) ... drawn from coordinates
    #         "xlim": (-1, 12),
    #         "ylim": (-1, 7),
    #         "shapes": [
    #             {"type": "polygon", "pts": [[0,0],[22,0],[19,6],[3,6]],
    #              "color": "#1e40af", "fill": "#dbeafe"},
    #             {"type": "line",    "pts": [[16,0],[16,6]],
    #              "color": "#dc2626", "linestyle": "--"},
    #             {"type": "dim",     "p1": [0,0], "p2": [16,0],
    #              "label": "16", "offset": [0, -0.5]},
    #             {"type": "dim",     "p1": [16,0], "p2": [22,0],
    #              "label": "6", "offset": [0, -0.5]},
    #         ],
    #         "axes": False,
    #         "figsize": (5.5, 4.0),
    #     },
    # },
]


# ═══════════════════════════════════════════════════════════════════════════════
#  Dispatch
# ═══════════════════════════════════════════════════════════════════════════════

RENDERERS = {
    "quadratic": render_quadratic,
    "linear":    render_linear,
    "geometry":  render_geometry,
    "trig":      render_trig,
}


def generate(entry: dict, force: bool = False) -> bool:
    out_path = PROJECT_DIR / entry["file"]
    if out_path.exists() and not force:
        print(f"  --  {entry['file']}  (already exists, use --force to regenerate)")
        return False
    renderer = RENDERERS.get(entry["type"])
    if renderer is None:
        print(f"  !  Unknown type '{entry['type']}' for {entry['id']}", file=sys.stderr)
        return False
    print(f"  >>  Generating [{entry['id']}]  {entry['exam']}")
    renderer(entry["params"], out_path)
    return True


def cmd_list():
    print(f"\n{'ID':<24}  {'TYPE':<12}  {'STATUS':<10}  FILE")
    print("-" * 90)
    for e in IMAGE_REGISTRY:
        out = PROJECT_DIR / e["file"]
        status = "OK exists" if out.exists() else "!! missing"
        print(f"  {e['id']:<22}  {e['type']:<12}  {status:<10}  {e['file']}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Generate PNG illustrations for ДИМ matura exam questions."
    )
    parser.add_argument("--force",  action="store_true",
                        help="Regenerate all images even if already present")
    parser.add_argument("--list",   action="store_true",
                        help="List registry and file status, then exit")
    parser.add_argument("id",       nargs="?", default=None,
                        help="Generate only the entry with this id")
    args = parser.parse_args()

    if args.list:
        cmd_list()
        return

    entries = IMAGE_REGISTRY
    if args.id:
        entries = [e for e in IMAGE_REGISTRY if e["id"] == args.id]
        if not entries:
            print(f"Error: no entry with id '{args.id}'. Use --list to see available ids.",
                  file=sys.stderr)
            sys.exit(1)

    print(f"\nDIM Matura -- image generator  ({len(entries)} entries)\n")
    generated = sum(generate(e, force=args.force) for e in entries)
    print(f"\nDone — {generated} image(s) written.\n")


if __name__ == "__main__":
    main()
