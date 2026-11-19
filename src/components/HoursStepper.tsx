import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SLEEP_HOURS_LABEL, SLEEP_MAX, SLEEP_MIN } from '../questions';
import { colors } from '../theme';
import { surveyStyles } from './ScaleInput';

interface Props {
  value: number | null;
  /** Starting point for the first tap when there is no value yet (e.g. last night's value). */
  suggestion: number | null;
  onChange: (v: number | null) => void;
}

const clamp = (v: number) => Math.min(SLEEP_MAX, Math.max(SLEEP_MIN, Math.round(v * 2) / 2));

export function formatHours(v: number): string {
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

export function HoursStepper({ value, suggestion, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const base = value ?? suggestion ?? 8;

  const step = (d: number) => onChange(clamp(value == null ? base : value + d));

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(text.replace(',', '.'));
    if (text.trim() === '') onChange(null);
    else if (!Number.isNaN(parsed)) onChange(Math.min(SLEEP_MAX, Math.max(SLEEP_MIN, parsed)));
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={surveyStyles.label}>{SLEEP_HOURS_LABEL}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => step(-0.5)} accessibilityLabel="Less sleep">
          <Text style={styles.btnText}>−</Text>
        </Pressable>
        {editing ? (
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            style={[styles.value, styles.input]}
          />
        ) : (
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              setText(value != null ? formatHours(value) : '');
              setEditing(true);
            }}
          >
            <Text style={[styles.value, value == null && { color: colors.muted }]}>
              {value != null ? `${formatHours(value)} h` : `${formatHours(base)} h?`}
            </Text>
          </Pressable>
        )}
        <Pressable style={styles.btn} onPress={() => step(0.5)} accessibilityLabel="More sleep">
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {value == null ? 'Tap − or + to start (or tap the number to type it)' : 'Tap the number to type it'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 32 },
  value: { flex: 1, textAlign: 'center', fontSize: 28, fontWeight: '800', color: colors.text },
  input: { borderBottomWidth: 2, borderBottomColor: colors.dream, paddingVertical: 2 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
