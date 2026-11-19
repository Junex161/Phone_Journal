import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SOCIAL_LABEL, SOCIAL_WITH } from '../questions';
import { makeStyles, useColors } from '../theme';
import { QuestionLabel } from './ScaleInput';

interface Props {
  social: number | null;
  withWho: string | null;
  note: string | null;
  onSocial: (v: number | null) => void;
  onWith: (v: string | null) => void;
  onNote: (v: string | null) => void;
}

export function SocialInput({ social, withWho, note, onSocial, onWith, onNote }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const selected = withWho ? withWho.split(',').filter(Boolean) : [];
  const [text, setText] = useState(note ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);

  // Save the note shortly after typing stops, and when leaving the screen.
  const changeText = (t: string) => {
    setText(t);
    latest.current = t;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onNote(t.trim() ? t : null), 600);
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        onNote(latest.current.trim() ? latest.current : null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const toggleWho = (w: string) => {
    const next = selected.includes(w) ? selected.filter((x) => x !== w) : [...selected, w];
    onWith(next.length ? next.join(',') : null);
  };

  return (
    <View style={{ marginBottom: 22 }}>
      <QuestionLabel>{SOCIAL_LABEL}</QuestionLabel>
      <View style={styles.track}>
        {[
          { v: 0, label: 'No' },
          { v: 1, label: 'Yes' },
        ].map((o) => (
          <Pressable
            key={o.v}
            onPress={() => onSocial(social === o.v ? null : o.v)}
            style={[styles.yn, social === o.v && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.ynText, social === o.v && { color: colors.onPrimary }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {social === 1 ? (
        <View style={{ marginTop: 14 }}>
          <View style={styles.chips}>
            {SOCIAL_WITH.map((w) => {
              const on = selected.includes(w);
              return (
                <Pressable key={w} onPress={() => toggleWho(w)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: colors.primary }]}>{w}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={text}
            onChangeText={changeText}
            placeholder="What did you do? (optional)"
            placeholderTextColor={colors.faint}
            style={styles.input}
            multiline
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: c.cardAlt,
      borderRadius: 14,
      padding: 3,
      borderWidth: 1,
      borderColor: c.border,
    },
    yn: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    ynText: { fontWeight: '700', color: c.muted, fontSize: 15 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipOn: { backgroundColor: c.primarySoft, borderColor: c.primary },
    chipText: { color: c.muted, fontWeight: '600' },
    input: {
      marginTop: 12,
      minHeight: 46,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
      fontSize: 15,
    },
  }),
);
