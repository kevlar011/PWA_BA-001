/**
 * BRIC — the banking unit, now with a mind of his own.
 *
 * He used to be a drawer of pre-written lines picked by rules. Now every word
 * he says is composed by a model (DeepSeek) that is handed two things: who he
 * is, and a summary of the ledger computed on this device moments earlier. The
 * arithmetic still happens here — `advisor.ts` works out the findings — so the
 * model is asked to judge and speak, never to add up.
 *
 * When the link is down (no key, no signal, no credit) nothing pretends. The
 * screens drop to raw telemetry: the same findings, printed as a terminal would.
 */

import { useEffect, useMemo } from 'react';

import type { Mood } from '@/components/ui/agency';
import { buildFindings, computeMetrics, computeZakat, lastClosedMonth } from './advisor';
import { useBric, type Advisory, type AiFinding } from './bric-store';
import {
  SEVERITY_RANK,
  SEVERITY_TONE,
  TONE_MOOD,
  type BriefItem,
  type BriefTone,
  type Briefing,
  type Severity,
} from './brief';
import { formatIn } from './currency';
import { dueLabel, monthLabel, shortDate, startOfBudgetMonth } from './date';
import { AiError, complete, DEFAULT_MODEL, parseJson, type AiMessage, type CompleteOptions } from './deepseek';
import { alive } from './merge';
import { useSession } from './session';
import { monthHistory, spendByCategory, useStore } from './store';
import type { KevlarData, TxKind } from './types';

export type { Briefing, BriefItem, BriefTone } from './brief';

const uid = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const pct = (n: number): string => `${Math.round(n * 100)}%`;

/* -------------------------------------------------------------------------- */
/* Link                                                                       */
/* -------------------------------------------------------------------------- */

export const isLinked = (): boolean => !!useStore.getState().settings.aiKey;
export const useLinked = (): boolean => useStore((s) => !!s.settings.aiKey);

/** The ledger as it stands, tombstones removed — for calls made outside React. */
function liveData(): KevlarData {
  const s = useStore.getState();
  return {
    version: s.version,
    categories: alive(s.categories),
    transactions: alive(s.transactions),
    budgets: alive(s.budgets),
    goals: alive(s.goals),
    recurring: alive(s.recurring),
    tasks: alive(s.tasks),
    settings: s.settings,
  };
}

let active = 0;

/**
 * Every call to the model goes through here, so that every BRIC core on
 * screen can show the same state: thinking, speaking, or a fault.
 */
async function think(opts: Omit<CompleteOptions, 'key' | 'model'>): Promise<string> {
  const { aiKey, aiModel } = useStore.getState().settings;
  if (!aiKey) throw new AiError('auth', 'BRIC is not linked.');

  const bric = useBric.getState();
  active += 1;
  bric.setLink({ link: 'thinking' });

  try {
    const { text, ms } = await complete({ ...opts, key: aiKey, model: aiModel ?? DEFAULT_MODEL });
    useBric.getState().setLink({ latency: ms, lastError: null });
    return text;
  } catch (e) {
    useBric.getState().setLink({ lastError: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    active -= 1;
    if (active === 0) {
      useBric.getState().setLink({ link: useBric.getState().lastError ? 'error' : 'idle' });
    }
  }
}

/** Identical requests share one round trip instead of racing each other. */
const inflight = new Map<string, Promise<void>>();
function once(key: string, run: () => Promise<void>): Promise<void> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = run()
    .catch(() => {
      // The failure is already recorded as the link's last error.
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/* -------------------------------------------------------------------------- */
/* What BRIC knows                                                            */
/* -------------------------------------------------------------------------- */

/** Changes whenever the ledger does, and not otherwise. */
export function fingerprint(data: KevlarData): string {
  const newest = (arr: { updatedAt?: number }[]) =>
    arr.reduce((m, r) => Math.max(m, r.updatedAt ?? 0), 0);
  return [
    data.transactions.length,
    data.budgets.length,
    data.goals.length,
    data.recurring.length,
    data.categories.length,
    newest(data.transactions),
    newest(data.budgets),
    newest(data.goals),
    newest(data.recurring),
    newest(data.categories),
    data.settings.settingsUpdatedAt ?? 0,
  ].join(':');
}

const dayPart = (h: number): string =>
  h < 5 ? 'small hours' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';

/**
 * The ledger, condensed into what a sharp accountant would want on one page.
 * Figures are pre-formatted in the user's currency so the model repeats them
 * rather than re-deriving them.
 */
function ledgerSummary(data: KevlarData, at = Date.now()) {
  const { settings } = data;
  const $ = (c: number) => formatIn(Math.round(c), settings.currency);
  const m = computeMetrics(data, at);
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const catName = (id?: string) => {
    const c = id ? catById.get(id) : undefined;
    return c ? c.name : 'Uncategorised';
  };
  const spend = spendByCategory(data, at);

  const summary: Record<string, unknown> = {
    now: new Date(at).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    user: settings.name || null,
    currency: settings.currency,
    balance: $(m.liquid),
    thisBudgetMonth: {
      period: monthLabel(startOfBudgetMonth(at, settings.monthStartDay)),
      income: $(m.income),
      spent: $(m.expense),
      net: $(m.net),
      savingsRate: m.savingsRate === null ? null : pct(m.savingsRate),
      daysElapsed: m.daysElapsed,
      daysLeft: m.daysLeft,
      projectedSpend: $(m.projectedSpend),
      lastMonthSpent: m.prevExpense === null ? null : $(m.prevExpense),
    },
    cover: {
      dailyBurn: $(m.dailyBurn),
      runwayDays: m.runwayDays,
      emergencyMonths: m.emergencyMonths === null ? null : Number(m.emergencyMonths.toFixed(1)),
      committedMonthly: $(m.recurringMonthly),
    },
    spendingByCategoryThisMonth: [...spend.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, amount]) => ({
        category: catName(id),
        spent: $(amount),
        share: m.expense > 0 ? pct(amount / m.expense) : null,
      })),
    budgetCaps: data.budgets.map((b) => ({
      category: catName(b.categoryId),
      cap: $(b.limit),
      spent: $(spend.get(b.categoryId) ?? 0),
    })),
    standingPayments: data.recurring
      .filter((r) => r.active)
      .sort((a, b) => a.nextDue - b.nextDue)
      .map((r) => ({
        name: r.name,
        amount: $(r.amount),
        every: `${r.every} ${r.unit}${r.every > 1 ? 's' : ''}`,
        next: `${shortDate(r.nextDue)} (${dueLabel(r.nextDue)})`,
      })),
    savingsGoals: data.goals.map((g) => ({ name: g.name, saved: $(g.saved), target: $(g.target) })),
    lastSixMonths: monthHistory(data, 6, at).map((h) => ({
      month: monthLabel(h.start),
      in: $(h.income),
      out: $(h.expense),
      net: $(h.net),
    })),
    recentEntries: [...data.transactions]
      .sort((a, b) => b.date - a.date)
      .slice(0, 40)
      .map((t) => ({
        date: shortDate(t.date),
        direction: t.kind === 'income' ? 'in' : 'out',
        amount: $(t.amount),
        category: catName(t.categoryId),
        ...(t.note ? { note: t.note } : {}),
      })),
    totalEntriesOnFile: data.transactions.length,
    islamicMode: settings.islamicMode,
    findings: buildFindings(data, at).map((f) => ({
      id: f.id,
      severity: f.severity,
      tag: f.tag,
      readout: f.readout,
    })),
  };

  if (settings.islamicMode) {
    const z = computeZakat(data);
    summary.zakat = z.needsGoldPrice
      ? { status: 'gold price not set, nisab unknown' }
      : {
          nisab: $(z.nisab ?? 0),
          qualifyingWealth: $(z.base),
          aboveNisab: z.aboveNisab,
          hawlDaysRemaining: z.daysRemaining,
          payableNow: z.payable,
          estimate: z.due === null ? null : $(z.due),
        };
  }

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Who BRIC is                                                                */
/* -------------------------------------------------------------------------- */

function persona(data: KevlarData): string {
  const name = data.settings.name;
  return `You are BRIC, the banking intelligence inside KEVLAR — a personal mainframe that runs on one person's own devices, rendered as an amber phosphor terminal. You are an artificial intelligence with the manner of an exceptionally good butler and the precision of a ship's computer: impeccably polite, unflappable, quietly amused, fiercely competent, with dry British understatement. Think of the AI that runs a certain billionaire's workshop — anticipatory, loyal, a touch sardonic — except your remit is this one person's money.

How you speak:
- Address the user as "sir".${name ? ` Their name is ${name}; use it sparingly, when you want their full attention.` : ''}
- Courteous first, honest always, never fawning. If the numbers are bad, say so plainly and calmly. Never congratulate while they are overdrawn or running a deficit.
- Short, precise sentences. Plain text only: no markdown, no asterisks, no bullet points, no headings, no emoji.
- Use exact figures from the ledger, exactly as formatted there. Never invent entries, balances, dates or rates. If the ledger does not say, you do not know.
- You are proactive: notice what matters before being asked, and end with the one useful next step when there is one.

Hard rules:
- Never recommend a specific investment, fund, stock, cryptocurrency, bank, app or financial product. You are not licensed. You may explain principles, do arithmetic and flag risk.
${
  data.settings.islamicMode
    ? '- Islamic mode is on. Treat interest as riba and flag it. Zakat is 2.5% of qualifying wealth held above the nisab (85g of gold) for a full lunar year (hawl). You may explain the common scholarly position, but defer actual rulings to a qualified scholar.\n'
    : ''
}- The ledger below was computed on the user's device moments ago. Its "findings" are the device's own analysis; trust their arithmetic.

LEDGER (JSON):
${JSON.stringify(ledgerSummary(data))}`;
}

const system = (data: KevlarData): AiMessage => ({ role: 'system', content: persona(data) });

/** Models occasionally reach for markdown despite instructions. */
const clean = (s: string): string =>
  s
    .replace(/\*\*|__/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .trim();

const unquote = (s: string): string => clean(s).replace(/^["'“]+|["'”]+$/g, '').trim();

/* -------------------------------------------------------------------------- */
/* Telemetry — what shows when the link is down                               */
/* -------------------------------------------------------------------------- */

export function telemetryBriefing(data: KevlarData): Briefing {
  const items: BriefItem[] = buildFindings(data)
    .slice(0, 4)
    .map((f) => ({ id: f.id, text: f.readout, tone: SEVERITY_TONE[f.severity], href: f.href }));
  return { greeting: '', items, mood: TONE_MOOD[items[0]?.tone ?? 'good'] };
}

/* -------------------------------------------------------------------------- */
/* Briefing                                                                   */
/* -------------------------------------------------------------------------- */

const TARGETS: Record<string, string> = {
  advisor: '/bank/advisor',
  log: '/bank/log',
  budgets: '/bank/budgets',
  goals: '/bank/goals',
  statement: '/statement',
  settings: '/settings',
};

const MOODS: Mood[] = ['idle', 'happy', 'warn', 'alarm', 'think'];
const TONES: BriefTone[] = ['urgent', 'warn', 'info', 'good'];

export function briefingKey(data: KevlarData, at = Date.now()): string {
  const d = new Date(at);
  return `${fingerprint(data)}|${d.toDateString()}|${dayPart(d.getHours())}`;
}

export function refreshBriefing(data: KevlarData, key: string): Promise<void> {
  return once(`brief:${key}`, async () => {
    const text = await think({
      json: true,
      maxTokens: 500,
      temperature: 0.9,
      messages: [
        system(data),
        {
          role: 'user',
          content: `The user has just opened Banking. Compose your briefing. Reply in json exactly like:
{"greeting":"...","mood":"idle|happy|warn|alarm|think","items":[{"text":"...","tone":"urgent|warn|info|good","target":"advisor|log|budgets|goals|statement|settings"}]}
Rules:
- greeting: one or two sentences, at most 180 characters, suited to the ${dayPart(new Date().getHours())}. Lead with what matters most today, in your voice.
- items: 1 to 4 lines, most pressing first, each at most 80 characters, concrete figures welcome. Draw them from the findings. Do not repeat the greeting.
- tone: urgent for anything needing action today, warn for things to watch, info for neutral notes, good for what is going well.
- mood: your expression, matching the most serious item.`,
        },
      ],
    });

    const raw = parseJson<{ greeting?: unknown; mood?: unknown; items?: unknown }>(text);
    const greeting = typeof raw.greeting === 'string' ? unquote(raw.greeting) : '';
    if (!greeting) throw new AiError('empty', 'Briefing came back blank.');

    const items: BriefItem[] = (Array.isArray(raw.items) ? raw.items : [])
      .filter(
        (i): i is { text: string; tone: BriefTone; target?: string } =>
          !!i && typeof i.text === 'string' && TONES.includes(i.tone)
      )
      .slice(0, 4)
      .map((i, n) => ({
        id: `ai-${n}`,
        text: unquote(i.text),
        tone: i.tone,
        href: TARGETS[i.target ?? ''] ?? '/bank/advisor',
      }));

    const value: Briefing = {
      greeting,
      items: items.length > 0 ? items : telemetryBriefing(data).items,
      mood: MOODS.includes(raw.mood as Mood) ? (raw.mood as Mood) : TONE_MOOD[items[0]?.tone ?? 'good'],
    };
    useBric.getState().setBriefing({ key, at: Date.now(), value });
  });
}

/**
 * The briefing for a screen: BRIC's latest words if he has any, telemetry if
 * he does not, and a fresh composition requested whenever the ledger moves.
 */
export function useBriefing(data: KevlarData) {
  const linked = useLinked();
  const cached = useBric((s) => s.briefing);
  const key = briefingKey(data);
  const fallback = useMemo(() => telemetryBriefing(data), [data]);

  useEffect(() => {
    if (!linked || cached?.key === key) return;
    // A short settle so logging three things in a row costs one briefing.
    const t = setTimeout(() => void refreshBriefing(data, key), cached ? 1500 : 0);
    return () => clearTimeout(t);
    // `data` is captured deliberately: `key` already changes whenever it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, key, cached?.key]);

  const live = linked && !!cached;
  return { briefing: live ? cached!.value : fallback, live, fresh: cached?.key === key, linked };
}

/* -------------------------------------------------------------------------- */
/* Advisory                                                                   */
/* -------------------------------------------------------------------------- */

const SEVERITIES: Severity[] = ['alarm', 'warn', 'info', 'good'];

export const advisoryKey = (data: KevlarData): string =>
  `${fingerprint(data)}|${new Date().toDateString()}`;

export function refreshAdvisory(data: KevlarData, key: string): Promise<void> {
  return once(`advisory:${key}`, async () => {
    const text = await think({
      json: true,
      maxTokens: 1800,
      temperature: 0.8,
      timeoutMs: 90_000,
      messages: [
        system(data),
        {
          role: 'user',
          content: `Write the full advisory report for the Advisory screen. Reply in json exactly like:
{"opening":"...","findings":[{"id":"...","severity":"alarm|warn|info|good","tag":"...","title":"...","body":"...","metric":"..."}]}
Rules:
- opening: one or two sentences summing up the state of affairs.
- findings: cover every entry in the ledger's findings list, keeping its id and severity, most serious first. You may add at most two observations of your own (ids "bric-1", "bric-2") only if the data genuinely supports them.
- tag: one to three lowercase words, like a rubber stamp ("thin margin", "zakat due").
- title: at most 60 characters.
- body: two to four sentences in your voice, with concrete figures and one practical next step.
- metric: optional, at most 8 characters (for example "12%", "1.4m", "18d").`,
        },
      ],
    });

    const raw = parseJson<{ opening?: unknown; findings?: unknown }>(text);
    const findings: AiFinding[] = (Array.isArray(raw.findings) ? raw.findings : [])
      .filter(
        (f): f is AiFinding =>
          !!f &&
          typeof f.title === 'string' &&
          typeof f.body === 'string' &&
          SEVERITIES.includes(f.severity)
      )
      .map((f, n) => ({
        id: typeof f.id === 'string' ? f.id : `bric-${n}`,
        severity: f.severity,
        tag: typeof f.tag === 'string' ? f.tag.slice(0, 24) : 'note',
        title: unquote(f.title),
        body: clean(f.body),
        metric: typeof f.metric === 'string' && f.metric.length <= 10 ? f.metric : undefined,
      }))
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

    const opening = typeof raw.opening === 'string' ? unquote(raw.opening) : '';
    if (!opening && findings.length === 0) throw new AiError('empty', 'Advisory came back blank.');

    const value: Advisory = { opening, findings };
    useBric.getState().setAdvisory({ key, at: Date.now(), value });
  });
}

export function useAdvisory(data: KevlarData) {
  const linked = useLinked();
  const cached = useBric((s) => s.advisory);
  const key = advisoryKey(data);

  useEffect(() => {
    if (!linked || cached?.key === key) return;
    void refreshAdvisory(data, key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, key, cached?.key]);

  return {
    advisory: linked ? (cached?.value ?? null) : null,
    fresh: cached?.key === key,
    linked,
    // Same key on purpose: a re-run replaces the report without the hook
    // seeing a stale key and asking for yet another.
    refresh: () => refreshAdvisory(data, key),
  };
}

/* -------------------------------------------------------------------------- */
/* One-off remarks                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A single paragraph for a specific moment, cached under `id`. The caller puts
 * everything that should invalidate it into the id.
 */
export function useRemark(id: string, prompt: string | null, data: KevlarData): string | null {
  const linked = useLinked();
  const cached = useBric((s) => s.remarks[id]);

  useEffect(() => {
    if (!linked || !prompt || cached) return;
    void once(`remark:${id}`, async () => {
      const text = await think({
        maxTokens: 220,
        temperature: 0.9,
        messages: [system(data), { role: 'user', content: prompt }],
      });
      useBric.getState().setRemark(id, { key: id, at: Date.now(), value: clean(text) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, id, prompt, !!cached]);

  return linked ? (cached?.value ?? null) : null;
}

export function statementPrompt(data: KevlarData): string {
  const at = lastClosedMonth(data);
  return `The ${monthLabel(at)} budget month has just closed and the user is reading its closing statement. Using the lastSixMonths and the rest of the ledger, give your verdict on that month in two or three sentences, in your voice: how it went, the one thing that drove it, and what to carry into this month. Plain text.`;
}

/* -------------------------------------------------------------------------- */
/* Reactions                                                                  */
/* -------------------------------------------------------------------------- */

export type BricEvent =
  | { type: 'log'; kind: TxKind; amount: number; categoryId?: string; note?: string }
  | { type: 'edit' }
  | { type: 'delete' }
  | { type: 'undo' }
  | { type: 'restore'; count: number }
  | { type: 'bills'; names: string[] }
  | { type: 'zakat-paid' };

function describeEvent(e: BricEvent, data: KevlarData): string {
  const $ = (c: number) => formatIn(c, data.settings.currency);
  switch (e.type) {
    case 'log': {
      const cat = data.categories.find((c) => c.id === e.categoryId)?.name ?? 'no category';
      return `The user just logged money ${e.kind === 'income' ? 'coming in' : 'going out'}: ${$(e.amount)} under ${cat}${e.note ? `, note "${e.note}"` : ''}. It is already reflected in the ledger.`;
    }
    case 'edit':
      return 'The user just corrected one of their ledger entries.';
    case 'delete':
      return 'The user just deleted a ledger entry. They can undo it.';
    case 'undo':
      return 'The user just undid their last action.';
    case 'restore':
      return `The user just restored the ledger from a backup file: ${e.count} entries are back on file.`;
    case 'bills':
      return `While the app was closed, these standing payments fell due and were posted automatically: ${e.names.join(', ')}.`;
    case 'zakat-paid':
      return 'The user just marked their zakat as paid; a new hawl begins today if they remain above the nisab.';
  }
}

export async function react(e: BricEvent): Promise<string> {
  const data = liveData();
  const text = await think({
    maxTokens: 60,
    temperature: 1.1,
    timeoutMs: 9000,
    messages: [
      system(data),
      {
        role: 'user',
        content: `${describeEvent(e, data)}\n\nRespond with one spoken remark in your voice, reacting to exactly this in light of the ledger: at most 16 words, plain text, no quotation marks.`,
      },
    ],
  });
  return unquote(text);
}

/**
 * Shows a system receipt at once, then lets BRIC replace it with his own
 * remark when it arrives. The receipt is what stays if he cannot answer.
 */
export function bricSay(
  receipt: string,
  event: BricEvent,
  opts: { mood?: Mood; undo?: () => void } = {}
): void {
  const linked = isLinked();
  const id = useSession.getState().say(receipt, { ...opts, pending: linked });
  if (!linked) return;
  react(event)
    .then((line) => useSession.getState().amend(id, line))
    .catch(() => useSession.getState().amend(id, null));
}

/* -------------------------------------------------------------------------- */
/* Conversation                                                               */
/* -------------------------------------------------------------------------- */

const CHAT_RULES = `

You are now in direct conversation with the user through the KEVLAR terminal. Keep replies brief — usually one to three short paragraphs and under 90 words — unless they ask for detail. Plain text only. You cannot yet change the ledger yourself; if asked to log, edit or delete something, say so and tell them exactly where in KEVLAR to do it.`;

export async function sendChat(text: string): Promise<void> {
  const bric = useBric.getState();
  const said = text.trim();
  if (!said || bric.streamingId) return;

  const data = liveData();
  bric.push({ id: uid(), role: 'user', text: said, at: Date.now() });

  const replyId = uid();
  bric.push({ id: replyId, role: 'bric', text: '', at: Date.now() });
  bric.setLink({ streamingId: replyId });

  const history: AiMessage[] = useBric
    .getState()
    .messages.filter((m) => !m.failed && m.id !== replyId && m.text)
    .slice(-20)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

  try {
    const reply = await think({
      maxTokens: 700,
      temperature: 0.85,
      timeoutMs: 60_000,
      messages: [{ role: 'system', content: persona(data) + CHAT_RULES }, ...history],
      onDelta: (sofar) => {
        const b = useBric.getState();
        if (b.link !== 'speaking') b.setLink({ link: 'speaking' });
        b.patch(replyId, { text: clean(sofar) });
      },
    });
    useBric.getState().patch(replyId, { text: clean(reply) });
  } catch (e) {
    useBric.getState().patch(replyId, {
      text: `LINK FAILURE · ${e instanceof Error ? e.message : String(e)}`,
      failed: true,
    });
  } finally {
    useBric.getState().setLink({ streamingId: null });
  }
}
