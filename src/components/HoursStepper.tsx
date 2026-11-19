import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SLEEP_HOURS_LABEL, SLEEP_MAX, SLEEP_MIN } from '../questions';
import { makeStyles, useColors } from '../theme';
import { QuestionLabel } from './ScaleInput';

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
  const styles = useStyles();
  const colors = useColors();
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
    <View style={{ marginBottom: 22 }}>
      <QuestionLabel>{SLEEP_HOURS_LABEL}</QuestionLabel>
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
            <Text style={[styles.value, value == null && { color: colors.faint }]}>
              {formatHours(value ?? base)}
              <Text style={styles.unit}> h</Text>
            </Text>
          </Pressable>
        )}
        <Pressable style={styles.btn} onPress={() => step(0.5)} accessibilityLabel="More sleep">
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
      {value == null ? <Text style={styles.hint}>Tap − or + to set, or tap the number to type</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.cardAlt,
      borderRadius: 18,
      padding: 6,
      borderWidth: 1,
      borderColor: c.border,
    },
    btn: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: c.dreamSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: c.dream, fontSize: 26, fontWeight: '700', lineHeight: 30 },
    value: { flex: 1, textAlign: 'center', fontSize: 28, fontWeight: '800', color: c.text },
    unit: { fontSize: 16, fontWeight: '600', color: c.muted },
    input: { borderBottomWidth: 2, borderBottomColor: c.dream, paddingVertical: 2 },
    hint: { color: c.faint, fontSize: 12, textAlign: 'center', marginTop: 6 },
  }),
);
