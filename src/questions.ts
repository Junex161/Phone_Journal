// Survey definitions. Two daily surveys:
//  - Day survey (about the day you lived): rating, social, growth
//  - Sleep & dream survey (about the night before, stored on the day you woke up)

export type ScaleKey = 'rating' | 'growth' | 'dream_vibe' | 'rested';
export type MetricKey = ScaleKey | 'sleep_hours';

export interface ScaleQuestion {
  key: ScaleKey;
  label: string;
  low: string;
  high: string;
}

export const DAY_SCALES: Record<'rating' | 'growth', ScaleQuestion> = {
  rating: { key: 'rating', label: 'How was your day?', low: 'Awful', high: 'Amazing' },
  growth: { key: 'growth', label: 'How much did you learn or grow today?', low: 'Not at all', high: 'A lot' },
};

export const SLEEP_SCALES: Record<'dream_vibe' | 'rested', ScaleQuestion> = {
  dream_vibe: { key: 'dream_vibe', label: 'How was the vibe of your dream(s)?', low: 'Nightmare', high: 'Wonderful' },
  rested: { key: 'rested', label: 'How rested did you feel when you woke up?', low: 'Exhausted', high: 'Fully rested' },
};

export const SOCIAL_LABEL = 'Did you do something social today?';
export const SOCIAL_WITH = ['Friends', 'Family', 'Partner', 'Colleagues', 'Other'];
export const SLEEP_HOURS_LABEL = 'How much did you sleep?';
export const SLEEP_MIN = 0;
export const SLEEP_MAX = 16;

/** Numeric metrics available in statistics. */
export interface Metric {
  key: MetricKey;
  short: string;
  long: string;
  /** The question as asked in the survey. */
  question: string;
  min: number;
  max: number;
  color: string;
  unit?: string;
}

export const METRICS: Metric[] = [
  { key: 'rating', short: 'Day', long: 'Day rating', question: 'How was your day?', min: 1, max: 10, color: '#4F6DF5' },
  { key: 'growth', short: 'Growth', long: 'Learning & growth', question: 'How much did you learn or grow today?', min: 1, max: 10, color: '#F59E0B' },
  { key: 'dream_vibe', short: 'Dream', long: 'Dream vibe', question: 'How was the vibe of your dream(s)?', min: 1, max: 10, color: '#7C4DDB' },
  { key: 'rested', short: 'Rested', long: 'Feeling rested', question: 'How rested did you feel when you woke up?', min: 1, max: 10, color: '#10B981' },
  { key: 'sleep_hours', short: 'Sleep h', long: 'Hours slept', question: 'How much did you sleep?', min: 0, max: 16, color: '#0EA5E9', unit: 'h' },
];

export const metricByKey = (k: MetricKey) => METRICS.find((m) => m.key === k)!;

/** Colour for a 1-10 score (red → yellow → green). */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#E5E7EB';
  const t = (score - 1) / 9;
  const hue = Math.round(t * 120);
  return `hsl(${hue}, 65%, 55%)`;
}
