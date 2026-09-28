/**
 * KEVLAR domain model.
 *
 * KEVLAR is a shell hosting several subsystems. Their records live side by side
 * in one document because they share one owner, one encryption key and one
 * merge pass — splitting them would mean two of everything for no benefit.
 *
 *   · BANKING — one person, one balance
 *   · DOCKET  — notes, with structure where structure helps
 */

export type TxKind = 'expense' | 'income';

/**
 * Fields every syncable record carries.
 *
 * `deletedAt` is a tombstone rather than an actual removal: without it, a
 * delete on one device would be undone the next time the other device merged
 * its copy back in. Tombstoned records are filtered out by `useData`, so no
 * screen ever has to think about them.
 */
export type Tracked = {
  /** Last local change, used to resolve conflicts on merge. */
  updatedAt: number;
  /** Set instead of deleting, so the deletion itself can propagate. */
  deletedAt?: number;
};

export type Category = Tracked & {
  id: string;
  name: string;
  /** Emoji, so it renders identically on web and iOS with zero assets. */
  icon: string;
  color: string;
  kind: TxKind;
  archived: boolean;
};

export type Transaction = Tracked & {
  id: string;
  kind: TxKind;
  /** Always positive. `kind` carries the direction. */
  amount: number;
  categoryId?: string;
  note?: string;
  /** Epoch ms of when the money moved, not when it was logged. */
  date: number;
  createdAt: number;
};

export type Budget = Tracked & {
  id: string;
  categoryId: string;
  /** Cap per budget month. */
  limit: number;
};

export type Goal = Tracked & {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  color: string;
  createdAt: number;
};

export type RecurrenceUnit = 'week' | 'month' | 'year';

export type Recurring = Tracked & {
  id: string;
  name: string;
  amount: number;
  categoryId?: string;
  every: number;
  unit: RecurrenceUnit;
  nextDue: number;
  color: string;
  active: boolean;
};

/* -------------------------------------------------------------------------- */
/* DOCKET                                                                     */
/* -------------------------------------------------------------------------- */

/** Where a note sits. `blocked` is deliberately distinct from `open`: it means
 *  waiting on someone else, which VANE should nag about differently. */
export type TaskStatus = 'open' | 'active' | 'blocked' | 'done';

/** 0 routine · 1 priority · 2 critical. Numeric so sorting is trivial. */
export type Priority = 0 | 1 | 2;

/** One line of a checklist. Too small to be worth syncing individually. */
export type Step = {
  id: string;
  text: string;
  done: boolean;
};

/**
 * One entry in the docket.
 *
 * Deliberately a note first and a task second: the body is the point, and
 * everything else — a deadline, a checklist, a status — is optional structure
 * for the entries that earn it.
 */
export type Task = Tracked & {
  id: string;
  title: string;
  /** The note itself. Most entries are mostly this. */
  notes?: string;
  status: TaskStatus;
  priority: Priority;
  /** Epoch ms. Only the entries with a real deadline carry one. */
  due?: number;
  /**
   * Ordered checklist. Merged as one value with the note rather than as
   * records of their own — two devices editing the same checklist offline is
   * not a case worth carrying tombstones for.
   */
  steps: Step[];
  createdAt: number;
  completedAt?: number;
};

export type Settings = {
  /** What BRIC calls you. The only personal detail KEVLAR ever asks for. */
  name: string;
  currency: string;
  /** What was in your pocket the day you started. Balance builds from here. */
  openingBalance: number;
  /** Day the budget month rolls over. 1 = calendar month. */
  monthStartDay: number;

  onboarded: boolean;
  /** False until the in-app guided tour has been seen. */
  tourDone: boolean;
  /** Requires the passphrase or a passkey on every launch. */
  lockEnabled: boolean;

  /** User-corrected FX rates, expressed as units per USD. */
  rateOverrides: Record<string, number>;
  ratesSetAt?: number;
  /** Codes shown in the balance conversion strip, in order. */
  travelCurrencies: string[];

  /** Riba warnings, zakat tracking and halal framing in the advisory. */
  islamicMode: boolean;
  /** Gold price per gram, in minor units, for the zakat nisab. */
  goldPricePerGram?: number;

  /**
   * When your wealth last crossed the nisab threshold. Zakat falls due a full
   * lunar year (hawl) after this, so it only resets if you drop back below.
   */
  hawlStartedAt?: number;
  /** Records a hawl you have already settled, so BRIC stops asking. */
  lastZakatPaidAt?: number;

  /** Start of the most recent month BRIC has already issued a statement for. */
  lastStatementFor?: number;

  lastBackupAt?: number;

  /* --- Sync ------------------------------------------------------------- */

  /** Last local change to settings, kept as a coarse fallback. */
  settingsUpdatedAt?: number;
  /**
   * Per-field change times. Settings are merged key by key rather than as a
   * whole object, so changing the currency here cannot silently discard a name
   * changed on the other device.
   */
  fieldTimes?: Record<string, number>;
  /** Where the encrypted blob lives. Stored locally, never committed. */
  syncUrl?: string;
  syncKey?: string;
  /** Proves a passphrase is the right one without a round trip. */
  passphraseCheck?: string;
  /**
   * Held on the device so sync can run unattended. No worse than the ledger
   * it protects, which sits in the same storage — but it is the reason the
   * app lock exists.
   */
  passphrase?: string;
  syncedAt?: number;

  /* --- BRIC's neural link ------------------------------------------------ */

  /**
   * DeepSeek API key. Device-only, like the sync credentials: never synced,
   * never exported, and never built into the site — the site is public.
   */
  aiKey?: string;
  /** Which model BRIC thinks with. Harmless to sync. */
  aiModel?: 'deepseek-flash' | 'deepseek-v4-pro';
};

export type KevlarData = {
  version: number;

  /* Banking */
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];

  /* Docket */
  tasks: Task[];

  settings: Settings;
};

/** The docket's slice of the document, for screens that have no use for money. */
export type DocketData = {
  tasks: Task[];
  settings: Settings;
};
