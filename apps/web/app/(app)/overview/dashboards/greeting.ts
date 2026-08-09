'use client';

import { useEffect, useState } from 'react';

/**
 * Shared greeting bits for the overview dashboards. Every persona's dashboard
 * renders `${greeting()}, ${userName}` as its PageHeader title and a rotating
 * generic line beneath it — kept here so the wording and behaviour live in ONE
 * place instead of being copied across the eight dashboard components.
 */

/** Time-of-day prefix, e.g. "Good evening". */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Persona-agnostic follow-up lines shown under the greeting. One is chosen at
 * random per visit for a lightly refreshing feel — deliberately untracked and
 * generic so it reads right for any role (owner, teacher, parent, student, …).
 * Add or reword freely; order does not matter.
 */
export const GREETING_SUBTITLES = [
  'Here’s your snapshot for today.',
  'Good to have you back — here’s where things stand.',
  'Let’s make today a good one.',
  'Everything you need, all in one place.',
  'Ready when you are.',
  'Let’s pick up where you left off.',
  'Here’s what’s happening today.',
  'A fresh look at your day.',
] as const;

/**
 * Returns one generic subtitle, rotating each visit. The first paint (server +
 * hydration) is deterministic — index 0 — so the markup matches; a random line
 * is then swapped in on mount, keeping it hydration-safe with no console noise.
 */
export function useGreetingSubtitle(): string {
  const [line, setLine] = useState<string>(GREETING_SUBTITLES[0]);
  useEffect(() => {
    const next =
      GREETING_SUBTITLES[Math.floor(Math.random() * GREETING_SUBTITLES.length)];
    setLine(next ?? GREETING_SUBTITLES[0]);
  }, []);
  return line;
}
