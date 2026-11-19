import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScaleQuestion } from '../questions';
import { scoreColor } from '../questions';
import { makeStyles } from '../theme';

interface Props {
  question: ScaleQuestion;
  value: number | null;
  onChange: (value: number | null) => void;
}

/** A 1-10 tap scale shown as one rounded track. Tapping the selected number again clears it. */
export function ScaleInput({ question, value, onChange }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <QuestionLabel>{question.label}</QuestionLabel>
      <View style={styles.track}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(selected ? null : n)}
              style={[styles.cell, selected && { backgroundColor: scoreColor(n) }]}
              accessibilityLabel={`${question.label} ${n}`}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <Text style={[styles.cellText, selected && styles.cellTextSelected]}>{n}</Text>
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

export function QuestionLabel({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { marginBottom: 22 },
    label: { fontSize: 16, fontWeight: '600', color: c.text, marginBottom: 12 },
    track: {
      flexDirection: 'row',
      backgroundColor: c.cardAlt,
      borderRadius: 14,
      padding: 3,
      borderWidth: 1,
      borderColor: c.border,
    },
    cell: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    cellText: { color: c.muted, fontWeight: '600', fontSize: 15 },
    cellTextSelected: { color: '#fff', fontWeight: '800' },
    ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
    end: { fontSize: 12, color: c.faint },
  }),
);
