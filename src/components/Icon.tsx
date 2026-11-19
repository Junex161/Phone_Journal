import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'journal'
  | 'calendar'
  | 'stats'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'mic'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** Small stroke icons drawn with SVG (24×24 grid). */
export function Icon({ name, size = 24, color, strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'journal' && (
        <>
          <Path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" {...p} />
          <Path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" {...p} />
          <Line x1="9" y1="8" x2="15" y2="8" {...p} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...p} />
          <Line x1="3.5" y1="10" x2="20.5" y2="10" {...p} />
          <Line x1="8" y1="3" x2="8" y2="7" {...p} />
          <Line x1="16" y1="3" x2="16" y2="7" {...p} />
        </>
      )}
      {name === 'stats' && (
        <>
          <Line x1="5" y1="20" x2="5" y2="13" {...p} />
          <Line x1="10" y1="20" x2="10" y2="6" {...p} />
          <Line x1="15" y1="20" x2="15" y2="10" {...p} />
          <Line x1="20" y1="20" x2="20" y2="4" {...p} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Line x1="4" y1="7" x2="20" y2="7" {...p} />
          <Line x1="4" y1="17" x2="20" y2="17" {...p} />
          <Circle cx="9" cy="7" r="2.5" {...p} fill={color} />
          <Circle cx="15" cy="17" r="2.5" {...p} fill={color} />
        </>
      )}
      {name === 'sun' && (
        <>
          <Circle cx="12" cy="12" r="4" {...p} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return (
              <Line
                key={a}
                x1={12 + Math.cos(r) * 7}
                y1={12 + Math.sin(r) * 7}
                x2={12 + Math.cos(r) * 9.5}
                y2={12 + Math.sin(r) * 9.5}
                {...p}
              />
            );
          })}
        </>
      )}
      {name === 'moon' && <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...p} />}
      {name === 'mic' && (
        <>
          <Rect x="9" y="3" width="6" height="11" rx="3" {...p} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0" {...p} />
          <Line x1="12" y1="17.5" x2="12" y2="21" {...p} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === 'chevronLeft' && <Path d="M15 5l-7 7 7 7" {...p} />}
      {name === 'chevronRight' && <Path d="M9 5l7 7-7 7" {...p} />}
    </Svg>
  );
}
