/**
 * Briefing shapes.
 *
 * Lives on its own so plain screens can type a briefing without importing
 * BRIC, who is a network client.
 */

import type { Mood } from '@/components/ui/agency';

export type BriefTone = 'urgent' | 'warn' | 'info' | 'good';

export type BriefItem = {
  id: string;
  text: string;
  tone: BriefTone;
  /** Route to open when tapped. */
  href?: string;
};

export type Briefing = {
  greeting: string;
  items: BriefItem[];
  mood: Mood;
};

export const TONE_MOOD: Record<BriefTone, Mood> = {
  urgent: 'alarm',
  warn: 'warn',
  info: 'think',
  good: 'happy',
};

export type Severity = 'alarm' | 'warn' | 'info' | 'good';

export const SEVERITY_TONE: Record<Severity, BriefTone> = {
  alarm: 'urgent',
  warn: 'warn',
  info: 'info',
  good: 'good',
};

export const SEVERITY_RANK: Record<Severity, number> = { alarm: 0, warn: 1, info: 2, good: 3 };
