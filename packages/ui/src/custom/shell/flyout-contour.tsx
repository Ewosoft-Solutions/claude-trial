'use client';

/* ============================================================
   FlyoutContour — the Aurora navigation "curve" surface

   The opaque, concave-filleted shape that anchors a flyout to the
   sidebar rail. Extracted so every surface that opens off the rail
   speaks the same visual language:

     • the collapsed section flyouts (AppSidebar), and
     • the theme control (nav-shared) — beside the rail when the
       sidebar is collapsed, and rising upward out of the footer row
       when it is expanded.

   `orientation="right"` attaches along the shape's LEFT edge and opens
   to the right (the rail's default). `orientation="up"` reuses the very
   same geometry, rotated a quarter-turn so it attaches along its BOTTOM
   edge and opens upward — a pure affine transform, no bespoke path.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

/** Vertical extent of each concave fillet where the shape meets the rail. */
export const CURVE_SIZE = 28;
/** How far the fillet flares into the body from the attached edge. */
export const CURVE_REACH = 40;
/** Radius of the two free (non-attached) corners. */
export const CORNER_RADIUS = 16;

/**
 * Control-point ratios that give the fillet its long, shallow sweep — the
 * curve's character, independent of how big it is drawn. Exported so other
 * surfaces that must speak this same curve (the drawer's folder tabs) scale
 * it rather than re-guessing it.
 */
export const CURVE_EASE_ALONG = 0.4;
export const CURVE_EASE_ACROSS = 0.62;

/** Smallest height that still fits both fillets and both corners. */
export const CONTOUR_MIN_HEIGHT = CURVE_SIZE * 2 + CORNER_RADIUS * 2;

/**
 * Build the fill + hairline-stroke paths for a right-opening contour of the
 * given size. The left edge is left open (it sits flush against the rail); the
 * stroke traces only the top, right, and bottom.
 */
export function buildFlyoutContourPaths(width: number, height: number) {
  const cs = CURVE_SIZE;
  const rc = CURVE_REACH;
  const r = CORNER_RADIUS;
  const w = Math.max(1, width);
  const h = Math.max(CONTOUR_MIN_HEIGHT, height);

  const fill = [
    'M 0 0',
    `C 0 ${cs * CURVE_EASE_ACROSS} ${rc * CURVE_EASE_ALONG} ${cs} ${rc} ${cs}`,
    `H ${w - r}`,
    `Q ${w} ${cs} ${w} ${cs + r}`,
    `V ${h - cs - r}`,
    `Q ${w} ${h - cs} ${w - r} ${h - cs}`,
    `H ${rc}`,
    `C ${rc * CURVE_EASE_ALONG} ${h - cs} 0 ${h - cs * CURVE_EASE_ACROSS} 0 ${h}`,
    'Z',
  ].join(' ');

  const stroke = [
    'M 0 0.5',
    `C 0 ${cs * CURVE_EASE_ACROSS} ${rc * CURVE_EASE_ALONG} ${cs + 0.5} ${rc} ${cs + 0.5}`,
    `H ${w - r}`,
    `Q ${w - 0.5} ${cs + 0.5} ${w - 0.5} ${cs + r}`,
    `V ${h - cs - r}`,
    `Q ${w - 0.5} ${h - cs - 0.5} ${w - r} ${h - cs - 0.5}`,
    `H ${rc}`,
    `C ${rc * CURVE_EASE_ALONG} ${h - cs - 0.5} 0 ${h - cs * CURVE_EASE_ACROSS} 0 ${h - 0.5}`,
  ].join(' ');

  return { fill, stroke, width: w, height: h };
}

export interface FlyoutContourProps {
  /** On-screen width of the shape in px. */
  width: number;
  /** On-screen height of the shape in px. */
  height: number;
  /**
   * `right` (default) attaches on the left edge and opens rightward; `up`
   * attaches on the bottom edge and opens upward (the same shape rotated a
   * quarter-turn via an affine transform).
   */
  orientation?: 'right' | 'up';
  /** Fill token; defaults to the opaque rail colour. */
  fill?: string;
  className?: string;
}

export function FlyoutContour({
  width,
  height,
  orientation = 'right',
  fill = 'var(--sidebar-solid)',
  className,
}: FlyoutContourProps) {
  const vbW = Math.max(1, width);
  const vbH = Math.max(1, height);

  // For an upward flyout the geometry is generated in "right space" with the
  // axes swapped (depth = the panel's height, length = the panel's width) and
  // then rotated -90° so its open (left) edge becomes the bottom. matrix(0 -1
  // 1 0 0 h) maps (x, y) → (y, h − x): a pure rotation, so the 1px non-scaling
  // hairline stays 1px.
  const isUp = orientation === 'up';
  const paths = buildFlyoutContourPaths(isUp ? vbH : vbW, isUp ? vbW : vbH);
  const transform = isUp ? `matrix(0 -1 1 0 0 ${paths.width})` : undefined;

  return (
    <svg
      data-slot="flyout-contour"
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none absolute inset-0 z-0 size-full overflow-visible',
        className,
      )}
    >
      <g transform={transform}>
        <path d={paths.fill} fill={fill} />
        <path
          d={paths.stroke}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
