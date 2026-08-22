/**
 * The app's shared curve character.
 *
 * Control-point ratios that give a fillet its long, shallow sweep — the
 * curve's character, independent of how big it is drawn. Every surface that
 * must speak this curve scales these rather than re-guessing them, so the
 * sidebar's flyout contour and a folder tab's joins cannot drift apart.
 *
 * They live in `lib` — with no `'use client'` anywhere above them — because
 * both a client component (the flyout contour) and a SERVER-rendered one (a
 * strip of folder-tab links) compute geometry from them. Exports of a
 * `'use client'` module reach a server component as client references rather
 * than as their values, so a shared constant cannot live in one.
 */

/** Along the run of the curve, before it starts to lift. */
export const CURVE_EASE_ALONG = 0.4;
/** Across the rise, as it settles into the vertical. */
export const CURVE_EASE_ACROSS = 0.62;
