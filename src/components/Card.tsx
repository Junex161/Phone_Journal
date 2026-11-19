import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { makeStyles, radius, shadow } from '../theme';

interface Props {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: ViewStyle | (ViewStyle | false | undefined)[];
}

export function Card({ title, right, children, style }: Props) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]}>
      {title || right ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Small uppercase heading used above groups of content. */
export function SectionLabel({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.section}>{children}</Text>;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius,
      padding: 18,
      marginBottom: 14,
      ...shadow(c),
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    title: { fontSize: 13, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 8,
      marginBottom: 10,
      marginLeft: 4,
    },
  }),
);
