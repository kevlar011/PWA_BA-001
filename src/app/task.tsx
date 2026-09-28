import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FieldLabel } from '@/components/ui/agency';
import { notify } from '@/components/ui/press';
import { Button, Row, Rule, Txt } from '@/components/ui/primitives';
import { DAY, shortDate, startOfDay } from '@/lib/date';
import { useSession } from '@/lib/session';
import { useDocket, useStore } from '@/lib/store';
import { vaneOnAdd, vaneOnDone, weeklyRate } from '@/lib/vane';
import { color, radius, space, subsystem } from '@/theme/tokens';
import type { Priority, Step, TaskStatus } from '@/lib/types';

const uid = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const STATUSES: { value: TaskStatus; label: string; tone: string }[] = [
  { value: 'open', label: 'OPEN', tone: color.textDim },
  { value: 'active', label: 'ACTIVE', tone: subsystem.desk },
  { value: 'blocked', label: 'BLOCKED', tone: color.warn },
  { value: 'done', label: 'DONE', tone: color.income },
];

const PRIORITIES: { value: Priority; label: string; tone: string }[] = [
  { value: 0, label: 'ROUTINE', tone: color.textDim },
  { value: 1, label: 'PRIORITY', tone: color.mustard },
  { value: 2, label: 'CRITICAL', tone: color.expense },
];

/** Relative offsets rather than a calendar — no dependency, and faster to hit. */
const DUE_PRESETS: [string, number | null][] = [
  ['NONE', null],
  ['TODAY', 0],
  ['TOMORROW', 1],
  ['+3D', 3],
  ['+1W', 7],
  ['+1M', 30],
];

export default function NoteEditor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();

  const docket = useDocket();
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const undeleteTask = useStore((s) => s.undeleteTask);
  const say = useSession((s) => s.say);

  const editing = docket.tasks.find((t) => t.id === params.id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [status, setStatus] = useState<TaskStatus>(editing?.status ?? 'open');
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 0);
  const [due, setDue] = useState<number | undefined>(editing?.due);
  const [steps, setSteps] = useState<Step[]>(editing?.steps ?? []);
  const [draftStep, setDraftStep] = useState('');

  const canSave = title.trim().length > 0;

  function addDraftStep() {
    const text = draftStep.trim();
    if (!text) return;
    setSteps((list) => [...list, { id: uid(), text, done: false }]);
    setDraftStep('');
  }

  function save() {
    if (!canSave) return;

    const patch = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      status,
      priority,
      due,
      steps,
      // Marking done here has to keep `completedAt` truthful, since the list's
      // checkbox is not the only route to the done state.
      completedAt: status === 'done' ? (editing?.completedAt ?? Date.now()) : undefined,
    };

    if (editing) {
      const before = { ...editing };
      const justFinished = status === 'done' && before.status !== 'done';
      updateTask(editing.id, patch);
      notify('success');
      if (justFinished) {
        say(vaneOnDone(patch.title, weeklyRate(docket) + 1), {
          mood: 'happy',
          undo: () => updateTask(before.id, before),
        });
      } else {
        say('Updated.', { mood: 'idle', undo: () => updateTask(before.id, before) });
      }
    } else {
      const id = addTask(patch);
      notify('success');
      say(vaneOnAdd(patch.title, due !== undefined), {
        mood: 'idle',
        undo: () => removeTask(id),
      });
    }

    router.back();
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + space.md }]}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
        <Txt variant="lead" weight="bold" spaced tone={subsystem.desk}>
          {editing ? 'EDIT ENTRY' : 'NEW ENTRY'}
        </Txt>
        <Row style={{ gap: space.lg }}>
          {editing && (
            <Pressable
              hitSlop={14}
              onPress={() => {
                const id = editing.id;
                removeTask(id);
                notify('warning');
                say('Removed from the docket.', { mood: 'warn', undo: () => undeleteTask(id) });
                router.back();
              }}>
              <Txt variant="caption" weight="bold" tone={color.danger}>
                DELETE
              </Txt>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} hitSlop={14}>
            <Txt variant="lead" dim>
              ✕
            </Txt>
          </Pressable>
        </Row>
      </Row>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space.xl }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={color.textFaint}
          style={[s.input, s.title]}
          autoFocus={!editing}
          returnKeyType="next"
        />

        {/* The body sits directly under the title. Everything below it is
            optional structure for the entries that actually need it. */}
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Write as much as you want here."
          placeholderTextColor={color.textFaint}
          style={[s.input, s.notes]}
          multiline
          textAlignVertical="top"
        />

        <Rule />

        <FieldLabel>Steps</FieldLabel>
        {steps.map((step) => (
          <Row key={step.id} style={{ gap: space.sm, marginBottom: space.sm }}>
            <Pressable
              hitSlop={8}
              onPress={() =>
                setSteps((list) => list.map((x) => (x.id === step.id ? { ...x, done: !x.done } : x)))
              }>
              <View
                style={[
                  s.box,
                  step.done && { backgroundColor: subsystem.desk, borderColor: subsystem.desk },
                ]}>
                {step.done && (
                  <Txt variant="micro" weight="bold" tone={color.accentText}>
                    ✓
                  </Txt>
                )}
              </View>
            </Pressable>
            <Txt
              variant="caption"
              dim={step.done}
              style={[{ flex: 1 }, step.done && { textDecorationLine: 'line-through' }]}>
              {step.text}
            </Txt>
            <Pressable
              hitSlop={10}
              onPress={() => setSteps((list) => list.filter((x) => x.id !== step.id))}>
              <Txt variant="caption" tone={color.textFaint}>
                ✕
              </Txt>
            </Pressable>
          </Row>
        ))}

        <Row style={{ gap: space.sm, marginBottom: space.lg }}>
          <TextInput
            value={draftStep}
            onChangeText={setDraftStep}
            placeholder="Add a step"
            placeholderTextColor={color.textFaint}
            style={[s.input, { flex: 1, marginBottom: 0, height: 44 }]}
            returnKeyType="done"
            onSubmitEditing={addDraftStep}
          />
          <Pressable onPress={addDraftStep} style={s.addStep} hitSlop={6}>
            <Txt variant="lead" weight="bold" tone={subsystem.desk}>
              +
            </Txt>
          </Pressable>
        </Row>

        <FieldLabel>Deadline</FieldLabel>
        <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
          {DUE_PRESETS.map(([label, offset]) => {
            const ts = offset === null ? undefined : startOfDay(Date.now()) + offset * DAY;
            const active = due === ts;
            return (
              <Pressable
                key={label}
                onPress={() => setDue(ts)}
                style={[
                  s.day,
                  active && { borderColor: subsystem.desk, backgroundColor: `${subsystem.desk}1A` },
                ]}>
                <Txt variant="micro" weight="bold" tone={active ? subsystem.desk : color.textDim}>
                  {label}
                </Txt>
              </Pressable>
            );
          })}
        </Row>

        {due !== undefined && (
          <Row style={{ gap: space.sm, marginTop: space.sm, alignItems: 'center' }}>
            <Pressable onPress={() => setDue((d) => (d ?? 0) - DAY)} style={s.day}>
              <Txt variant="micro" weight="bold" tone={color.textDim}>
                ◂ DAY
              </Txt>
            </Pressable>
            <Txt variant="caption" weight="bold" tone={subsystem.desk}>
              {shortDate(due).toUpperCase()}
            </Txt>
            <Pressable onPress={() => setDue((d) => (d ?? 0) + DAY)} style={s.day}>
              <Txt variant="micro" weight="bold" tone={color.textDim}>
                DAY ▸
              </Txt>
            </Pressable>
          </Row>
        )}

        <FieldLabel>Status</FieldLabel>
        <Row style={s.segment}>
          {STATUSES.map((st) => {
            const active = st.value === status;
            return (
              <Pressable
                key={st.value}
                onPress={() => setStatus(st.value)}
                style={[s.segItem, active && { backgroundColor: `${st.tone}22`, borderColor: st.tone }]}>
                <Txt variant="micro" weight="bold" tone={active ? st.tone : color.textFaint}>
                  {st.label}
                </Txt>
              </Pressable>
            );
          })}
        </Row>

        <FieldLabel>Priority</FieldLabel>
        <Row style={s.segment}>
          {PRIORITIES.map((p) => {
            const active = p.value === priority;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPriority(p.value)}
                style={[s.segItem, active && { backgroundColor: `${p.tone}22`, borderColor: p.tone }]}>
                <Txt variant="micro" weight="bold" tone={active ? p.tone : color.textFaint}>
                  {p.label}
                </Txt>
              </Pressable>
            );
          })}
        </Row>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + space.md, paddingTop: space.sm }}>
        <Button
          label={canSave ? (editing ? 'Save changes' : 'Save') : 'Give it a title'}
          full
          disabled={!canSave}
          onPress={save}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.lg },
  input: {
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    color: color.text,
    fontSize: 16,
    marginBottom: space.md,
  },
  title: { height: 52, fontSize: 18, fontWeight: '700' },
  notes: { minHeight: 200, paddingTop: space.md, lineHeight: 22 },
  segment: { backgroundColor: color.surface, padding: 4, gap: 4, borderRadius: radius.md },
  segItem: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
  },
  day: {
    paddingHorizontal: space.md,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: color.borderHi,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStep: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
});
