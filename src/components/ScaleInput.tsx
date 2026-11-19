import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScaleQuestion } from '../questions';
import { scoreColor } from '../questions';
import { colors } from '../theme';

interface Props {
  question: ScaleQuestion;
  value: number | null;
  onChange: (value: number | null) => void;
}

/** A 1-10 tap scale. Tapping the selected number again clears the answer. */
export function ScaleInput({ question, value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{question.label}</Text>
      <View style={styles.row}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(selected ? null : n)}
              style={[styles.chip, selected && { backgroundColor: scoreColor(n), borderColor: scoreColor(n) }]}
              accessibilityLabel={`${question.label} ${n}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{question.low}</Text>
        <Text style={styles.end}>{question.high}</Text>
      </View>
    </View>
  );
}

export const surveyStyles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 10 },
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: surveyStyles.label,
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: {
    width: 30,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  end: { fontSize: 12, color: colors.muted },
});
