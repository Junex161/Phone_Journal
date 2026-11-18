// The daily mini questionnaire. Each question is a 1-10 scale stored in its own column.
// To change wording, edit `label` / `low` / `high`. Adding a question also needs a DB column.

export type QuestionKey = 'rating' | 'energy' | 'sleep';

export interface Question {
  key: QuestionKey;
  label: string;
  short: string;
  low: string;
  high: string;
  color: string;
}

export const QUESTIONS: Question[] = [
  { key: 'rating', label: 'How was your day?', short: 'Day', low: 'Awful', high: 'Amazing', color: '#4F6DF5' },
  { key: 'energy', label: 'How was your energy?', short: 'Energy', low: 'Drained', high: 'Full', color: '#F59E0B' },
  { key: 'sleep', label: 'How well did you sleep last night?', short: 'Sleep', low: 'Terribly', high: 'Great', color: '#10B981' },
];

/** Colour for a 1-10 score (red → yellow → green). */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#E5E7EB';
  const t = (score - 1) / 9;
  const hue = Math.round(t * 120);
  return `hsl(${hue}, 65%, 55%)`;
}
