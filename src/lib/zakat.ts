/**
 * Zakat, with the hawl actually tracked.
 *
 * The obligation is not "you are rich today" — it is "you have held wealth
 * above the nisab for a full lunar year". So KEVLAR watches the threshold
 * crossing, starts a clock, and resets it if you drop back below.
 *
 * This computes an estimate from logged balances only. It knows nothing about
 * gold, property, business assets or debts owed to you, and it is not a
 * substitute for a scholar.
 */

import { DAY } from './date';
import { balance } from './store';
import type { KevlarData, Settings } from './types';

/** 85 grams of gold, the classical threshold. */
export const NISAB_GOLD_GRAMS = 85;
export const ZAKAT_RATE = 0.025;
/** A lunar year. Roughly 354 days, not 365. */
export const HAWL_DAYS = 354;

export type ZakatState = {
  /** Wealth zakat is assessed against. */
  base: number;
  nisab: number | null;
  /** 2.5% of base, once actually due. */
  due: number | null;
  aboveNisab: boolean | null;
  /** When the current qualifying period began. */
  hawlStartedAt?: number;
  /** Days remaining before the hawl completes. */
  daysRemaining: number | null;
  /** The hawl has completed and zakat is payable now. */
  payable: boolean;
  /** No gold price set, so nothing can be computed. */
  needsGoldPrice: boolean;
};

export function computeZakat(data: KevlarData): ZakatState {
  const base = balance(data);
  const gold = data.settings.goldPricePerGram;

  if (!gold || gold <= 0) {
    return {
      base,
      nisab: null,
      due: null,
      aboveNisab: null,
      daysRemaining: null,
      payable: false,
      needsGoldPrice: true,
    };
  }

  const nisab = Math.round(gold * NISAB_GOLD_GRAMS);
  const aboveNisab = base >= nisab;
  const started = data.settings.hawlStartedAt;

  if (!aboveNisab || !started) {
    return {
      base,
      nisab,
      due: 0,
      aboveNisab,
      hawlStartedAt: started,
      daysRemaining: null,
      payable: false,
      needsGoldPrice: false,
    };
  }

  const elapsed = Math.floor((Date.now() - started) / DAY);
  const daysRemaining = Math.max(0, HAWL_DAYS - elapsed);
  const payable = daysRemaining === 0;

  return {
    base,
    nisab,
    // Shown ahead of time as "would be due", so it is filled in either way.
    due: Math.round(base * ZAKAT_RATE),
    aboveNisab,
    hawlStartedAt: started,
    daysRemaining,
    payable,
    needsGoldPrice: false,
  };
}

/**
 * Starts, maintains or clears the hawl clock based on today's balance.
 * Returns only the settings that need changing, or null when nothing moved.
 */
export function reconcileHawl(data: KevlarData): Partial<Settings> | null {
  if (!data.settings.islamicMode) return null;

  const gold = data.settings.goldPricePerGram;
  if (!gold || gold <= 0) return null;

  const nisab = Math.round(gold * NISAB_GOLD_GRAMS);
  const above = balance(data) >= nisab;
  const started = data.settings.hawlStartedAt;

  // Crossed above the threshold with no clock running — start one.
  if (above && !started) return { hawlStartedAt: Date.now() };

  // Dropped below the threshold — the qualifying period is broken.
  if (!above && started) return { hawlStartedAt: undefined };

  return null;
}

/** Records payment and restarts the clock from today if still above nisab. */
export function settleZakat(data: KevlarData): Partial<Settings> {
  const gold = data.settings.goldPricePerGram ?? 0;
  const nisab = Math.round(gold * NISAB_GOLD_GRAMS);
  const stillAbove = gold > 0 && balance(data) >= nisab;
  return {
    lastZakatPaidAt: Date.now(),
    hawlStartedAt: stillAbove ? Date.now() : undefined,
  };
}

/** `12 Mar 2027` — when the current hawl completes. */
export function hawlCompletesOn(startedAt: number): number {
  return startedAt + HAWL_DAYS * DAY;
}
