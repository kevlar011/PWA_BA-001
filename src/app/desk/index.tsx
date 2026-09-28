import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Vane } from '@/components/ui/agency';
import { Rise, useTypewriter } from '@/components/ui/motion';
import { notify, Tap } from '@/components/ui/press';
import { Card, Empty, Row, Rule, Screen, SectionTitle, Txt } from '@/components/ui/primitives';
import { DAY, dueLabel } from '@/lib/date';
import { useSession } from '@/lib/session';
import { isDone, openTasks, sortTasks, taskProgress, useDocket, useStore } from '@/lib/store';
import { vaneBriefing, vaneOnAdd, vaneOnDone, vaneOnUndo, weeklyRate } from '@/lib/vane';
import { color, glyph, radius, space, subsystem } from '@/theme/tokens';
import type { BriefTone } from '@/lib/brief';
import type { Task } from '@/lib/types';

const TONE: Record<BriefTone, string> = {
  urgent: color.expense,
  warn: color.warn,
  info: color.transfer,
  good: color.income,
};

const PRIORITY_TONE = [color.border, color.mustard, color.expense];

type Filter = 'all' | 'dated' | 'active' | 'done';

const FILTERS: [Filter, string][] = [
  ['all', 'ALL'],
  ['dated', 'DATED'],
  ['active', 'ACTIVE'],
  ['done', 'DONE'],
];

/** Deadline badge. Colour carries the urgency so the text can stay plain. */
function DueBadge({ due }: { due: number }) {
  const left = due - Date.now();
  const tone = left < 0 ? color.expense : left < 3 * DAY ? color.warn : color.textFaint;
  return (
    <Txt variant="micro" weight="bold" tone={tone}>
      {dueLabel(due).toUpperCase()}
    </Txt>
  );
}

function NoteRow({
  task,
  onOpen,
  onToggle,
  first,
}: {
  task: Task;
  onOpen: () => void;
  onToggle: () => void;
  first: boolean;
}) {
  const done = isDone(task);
  const total = task.steps.length;
  const progress = taskProgress(task);

  // The body is the point of the entry, so a couple of lines of it belong on
  // the list itself — otherwise this reads as a checklist rather than notes.
  const preview = task.notes?.trim().replace(/\s+/g, ' ');

  return (
    <Row style={[s.row, first ? null : { borderTopWidth: 1, borderTopColor: color.border }]}>
      <View style={[s.priority, { backgroundColor: PRIORITY_TONE[task.priority] }]} />

      <Pressable hitSlop={10} onPress={onToggle} style={{ padding: 2 }}>
        <View style={[s.box, done && { backgroundColor: subsystem.desk, borderColor: subsystem.desk }]}>
          {done && (
            <Txt variant="micro" weight="bold" tone={color.accentText}>
              ✓
            </Txt>
          )}
        </View>
      </Pressable>

      <Tap scale={0.995} weight="light" style={{ flex: 1, marginLeft: space.md }} onPress={onOpen}>
        <Txt
          variant="caption"
          weight={done ? 'regular' : 'bold'}
          dim={done}
          numberOfLines={2}
          style={done ? { textDecorationLine: 'line-through' } : undefined}>
          {task.title}
        </Txt>

        {preview ? (
          <Txt variant="micro" faint numberOfLines={2} style={{ marginTop: 3, lineHeight: 16 }}>
            {preview}
          </Txt>
        ) : null}

        <Row style={{ gap: space.sm, marginTop: 4, flexWrap: 'wrap' }}>
          {task.status === 'blocked' && (
            <Txt variant="micro" weight="bold" tone={color.warn}>
              BLOCKED
            </Txt>
          )}
          {task.status === 'active' && !done && (
            <Txt variant="micro" weight="bold" tone={subsystem.desk}>
              ACTIVE
            </Txt>
          )}
          {total > 0 && (
            <Txt variant="micro" faint>
              {`${Math.round(progress * total)}/${total} STEPS`}
            </Txt>
          )}
          {task.due !== undefined && !done && <DueBadge due={task.due} />}
        </Row>
      </Tap>

      <Txt variant="caption" tone={color.textFaint}>
        {glyph.arrow}
      </Txt>
    </Row>
  );
}

export default function Docket() {
  const router = useRouter();
  const docket = useDocket();
  const toggleTask = useStore((s) => s.toggleTask);
  const addTask = useStore((s) => s.addTask);
  const removeTask = useStore((s) => s.removeTask);
  const say = useSession((s) => s.say);

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');

  const brief = vaneBriefing(docket);
  const greeting = useTypewriter(brief.greeting, 74);

  const visible = useMemo(() => {
    const open = openTasks(docket);
    const base =
      filter === 'dated'
        ? sortTasks(open.filter((t) => t.due !== undefined))
        : filter === 'active'
          ? sortTasks(open.filter((t) => t.status === 'active'))
          : filter === 'done'
            ? docket.tasks
                .filter(isDone)
                .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
                .slice(0, 25)
            : sortTasks(open);

    const q = query.trim().toLowerCase();
    if (!q) return base;
    // Search the body too — the whole point of writing it down is finding it.
    return base.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q) ||
        t.steps.some((st) => st.text.toLowerCase().includes(q))
    );
  }, [docket, filter, query]);

  /** Jot a title straight from the list, then open it if it needs a body. */
  function quickAdd() {
    const title = draft.trim();
    if (!title) return;
    const id = addTask({ title });
    setDraft('');
    notify('success');
    say(vaneOnAdd(title, false), { mood: 'idle', unit: 'vane', undo: () => removeTask(id) });
  }

  function flip(task: Task) {
    toggleTask(task.id);
    notify(isDone(task) ? 'warning' : 'success');
    say(isDone(task) ? vaneOnUndo(task.title) : vaneOnDone(task.title, weeklyRate(docket) + 1), {
      mood: isDone(task) ? 'idle' : 'happy',
      unit: 'vane',
      undo: () => toggleTask(task.id),
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Rise>
          <Card label="vane" tint={TONE[brief.items[0]?.tone ?? 'good']}>
            <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
              <Vane mood={brief.mood} size={46} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" style={{ lineHeight: 19, minHeight: 38 }}>
                  {greeting}
                </Txt>
              </View>
            </Row>

            <Rule />

            {brief.items.map((item, i) => (
              <Tap
                key={item.id}
                scale={0.99}
                weight="light"
                style={[
                  s.briefRow,
                  i > 0 ? { borderTopWidth: 1, borderTopColor: color.border } : null,
                ]}
                onPress={() => item.href && router.push(item.href as never)}>
                <View style={[s.dot, { backgroundColor: TONE[item.tone] }]} />
                <Txt variant="caption" style={{ flex: 1, marginLeft: space.sm, lineHeight: 17 }}>
                  {item.text}
                </Txt>
                <Txt variant="caption" tone={color.textFaint}>
                  {glyph.arrow}
                </Txt>
              </Tap>
            ))}
          </Card>
        </Rise>

        {/* Jotting something down should never cost more than one tap. */}
        <Rise delay={50}>
          <Row style={{ gap: space.sm, marginTop: space.lg }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write something down"
              placeholderTextColor={color.textFaint}
              style={s.quick}
              returnKeyType="done"
              onSubmitEditing={quickAdd}
            />
            <Pressable onPress={quickAdd} style={s.quickAdd} hitSlop={6}>
              <Txt variant="lead" weight="bold" tone={subsystem.desk}>
                +
              </Txt>
            </Pressable>
          </Row>
        </Rise>

        <Rise delay={90}>
          <SectionTitle>Docket</SectionTitle>
          <Row style={{ gap: space.sm, marginBottom: space.sm, flexWrap: 'wrap' }}>
            {FILTERS.map(([value, label]) => {
              const active = value === filter;
              return (
                <Pressable
                  key={value}
                  onPress={() => setFilter(value)}
                  style={[
                    s.filter,
                    active && {
                      borderColor: subsystem.desk,
                      backgroundColor: `${subsystem.desk}1A`,
                    },
                  ]}>
                  <Txt
                    variant="micro"
                    weight="bold"
                    spaced
                    tone={active ? subsystem.desk : color.textDim}>
                    {label}
                  </Txt>
                </Pressable>
              );
            })}
          </Row>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search titles, notes and steps"
            placeholderTextColor={color.textFaint}
            style={s.search}
            returnKeyType="search"
          />
        </Rise>

        <Rise delay={130}>
          {visible.length === 0 ? (
            <Empty
              icon="▤"
              title={
                query.trim()
                  ? 'Nothing matches'
                  : filter === 'done'
                    ? 'Nothing closed yet'
                    : 'Docket is empty'
              }
              body={
                query.trim()
                  ? 'Searching titles, bodies and checklist steps. Try a shorter word.'
                  : filter === 'done'
                    ? 'Finished entries collect here so you can see the rate you are actually moving at.'
                    : 'Write anything in the box above. A deadline and a checklist are optional — most things are just notes.'
              }
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {visible.map((task, i) => (
                <NoteRow
                  key={task.id}
                  task={task}
                  first={i === 0}
                  onOpen={() => router.push({ pathname: '/task', params: { id: task.id } })}
                  onToggle={() => flip(task)}
                />
              ))}
            </Card>
          )}
        </Rise>
      </Screen>

      <Tap weight="heavy" scale={0.9} style={s.fab} onPress={() => router.push('/task')}>
        <Txt variant="title" weight="bold" tone={color.accentText}>
          +
        </Txt>
      </Tap>
    </View>
  );
}

const s = StyleSheet.create({
  briefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4 },
  quick: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.borderHi,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 16,
  },
  quickAdd: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.borderHi,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  search: {
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 15,
    marginBottom: space.sm,
  },
  filter: {
    paddingHorizontal: space.md,
    height: 30,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  row: { alignItems: 'flex-start', paddingVertical: space.md, paddingRight: space.md, paddingLeft: 0 },
  priority: { width: 3, alignSelf: 'stretch', marginRight: space.md },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: color.borderHi,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.transfer,
    backgroundColor: subsystem.desk,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
