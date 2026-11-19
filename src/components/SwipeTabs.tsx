import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';

interface Props {
  index: number;
  count: number;
  onChange: (index: number) => void;
  children: ReactNode;
}

const SWIPE_DISTANCE = 60;

/**
 * Lets the user swipe left/right anywhere in the content to switch tabs.
 * Only clearly horizontal gestures are taken, so vertical scrolling and the
 * horizontal chip rows inside screens keep working.
 */
export function SwipeTabs({ index, count, onChange, children }: Props) {
  const { width } = useWindowDimensions();
  const drag = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const prevIndex = useRef(index);
  const state = useRef({ index, count, onChange });
  state.current = { index, count, onChange };

  // Slide the new screen in from the side we came from.
  useEffect(() => {
    if (prevIndex.current !== index) {
      enter.setValue(index > prevIndex.current ? width * 0.25 : -width * 0.25);
      drag.setValue(0);
      Animated.spring(enter, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
      prevIndex.current = index;
    }
  }, [index, width, enter, drag]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderMove: (_e, g) => {
          const { index: i, count: n } = state.current;
          // Resist at the first/last tab.
          const atEdge = (g.dx > 0 && i === 0) || (g.dx < 0 && i === n - 1);
          drag.setValue(atEdge ? g.dx * 0.2 : g.dx * 0.5);
        },
        onPanResponderRelease: (_e, g) => {
          const { index: i, count: n, onChange: change } = state.current;
          const fast = Math.abs(g.vx) > 0.5;
          if ((g.dx < -SWIPE_DISTANCE || (fast && g.dx < 0)) && i < n - 1) change(i + 1);
          else if ((g.dx > SWIPE_DISTANCE || (fast && g.dx > 0)) && i > 0) change(i - 1);
          else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag],
  );

  return (
    <Animated.View
      style={[styles.fill, { transform: [{ translateX: Animated.add(drag, enter) }] }]}
      {...responder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
