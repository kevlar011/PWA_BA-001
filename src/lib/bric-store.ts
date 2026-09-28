import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Briefing, Severity } from './brief';

/**
 * BRIC's own memory: the conversation, and the last thing he wrote for each
 * screen so it can be shown instantly on open while a fresh one is composed.
 *
 * Kept apart from the ledger on purpose. It is device-local, never synced and
 * never in a backup — it is derived from the ledger and can always be rebuilt,
 * and a conversation is not something the other device needs.
 */

export type ChatMsg = {
  id: string;
  role: 'user' | 'bric';
  text: string;
  at: number;
  /** Set when the link failed mid-reply; the text is then the failure notice. */
  failed?: boolean;
};

export type AiFinding = {
  id: string;
  severity: Severity;
  tag: string;
  title: string;
  body: string;
  metric?: string;
};

export type Advisory = { opening: string; findings: AiFinding[] };

export type Cached<T> = { key: string; at: number; value: T };

/** What the link is doing right now. Drives every BRIC core on screen. */
export type LinkState = 'idle' | 'thinking' | 'speaking' | 'error';

type BricState = {
  messages: ChatMsg[];
  briefing?: Cached<Briefing>;
  advisory?: Cached<Advisory>;
  remarks: Record<string, Cached<string>>;

  /* Transient — not persisted. */
  link: LinkState;
  lastError: string | null;
  latency: number | null;
  /** The chat message currently being streamed in, if any. */
  streamingId: string | null;

  push: (m: ChatMsg) => void;
  patch: (id: string, p: Partial<ChatMsg>) => void;
  clearChat: () => void;
  setBriefing: (c: Cached<Briefing>) => void;
  setAdvisory: (c: Cached<Advisory>) => void;
  setRemark: (id: string, c: Cached<string>) => void;
  setLink: (p: Partial<Pick<BricState, 'link' | 'lastError' | 'latency' | 'streamingId'>>) => void;
  forget: () => void;
};

/** Enough context to hold a conversation without the file growing forever. */
const MAX_MESSAGES = 120;

export const useBric = create<BricState>()(
  persist(
    (set) => ({
      messages: [],
      remarks: {},
      link: 'idle',
      lastError: null,
      latency: null,
      streamingId: null,

      push: (m) => set((s) => ({ messages: [...s.messages, m].slice(-MAX_MESSAGES) })),
      patch: (id, p) =>
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...p } : m)) })),
      clearChat: () => set({ messages: [] }),
      setBriefing: (briefing) => set({ briefing }),
      setAdvisory: (advisory) => set({ advisory }),
      setRemark: (id, c) =>
        set((s) => {
          // Only the latest few remarks are worth keeping.
          const entries = Object.entries({ ...s.remarks, [id]: c })
            .sort((a, b) => b[1].at - a[1].at)
            .slice(0, 12);
          return { remarks: Object.fromEntries(entries) };
        }),
      setLink: (p) => set(p),
      forget: () =>
        set({ messages: [], briefing: undefined, advisory: undefined, remarks: {}, lastError: null }),
    }),
    {
      name: 'kevlar-bric',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        messages: s.messages,
        briefing: s.briefing,
        advisory: s.advisory,
        remarks: s.remarks,
      }),
    }
  )
);
