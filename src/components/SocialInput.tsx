import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SOCIAL_LABEL, SOCIAL_WITH } from '../questions';
import { colors } from '../theme';
import { surveyStyles } from './ScaleInput';

interface Props {
  social: number | null;
  withWho: string | null;
  note: string | null;
  onSocial: (v: number | null) => void;
  onWith: (v: string | null) => void;
  onNote: (v: string | null) => void;
}

export function SocialInput({ social, withWho, note, onSocial, onWith, onNote }: Props) {
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
    <View style={{ marginBottom: 18 }}>
      <Text style={surveyStyles.label}>{SOCIAL_LABEL}</Text>
      <View style={styles.row}>
        {[
          { v: 0, label: 'No' },
          { v: 1, label: 'Yes' },
        ].map((o) => (
          <Pressable
            key={o.v}
            onPress={() => onSocial(social === o.v ? null : o.v)}
            style={[styles.yn, social === o.v && styles.ynSelected]}
          >
            <Text style={[styles.ynText, social === o.v && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {social === 1 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sub}>With whom?</Text>
          <View style={styles.chips}>
            {SOCIAL_WITH.map((w) => (
              <Pressable
                key={w}
                onPress={() => toggleWho(w)}
                style={[styles.chip, selected.includes(w) && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected.includes(w) && { color: '#fff' }]}>{w}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={changeText}
            placeholder="What did you do? (optional)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  yn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  ynSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  ynText: { fontWeight: '700', color: colors.text, fontSize: 15 },
  sub: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  input: {
    marginTop: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: '#fff',
    fontSize: 15,
  },
});
