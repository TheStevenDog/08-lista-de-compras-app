// Mocks globales seguros para pruebas con Jest + jest-expo

jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (Comp: unknown) => Comp,
    },
    useSharedValue: (val: unknown) => ({ value: val }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withTiming: (val: unknown) => val,
    withSpring: (val: unknown) => val,
    runOnJS: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const createChainableGesture = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'onStart',
      'onUpdate',
      'onEnd',
      'onFinalize',
      'activeOffsetX',
      'failOffsetY',
      'minDuration',
      'runOnJS',
      'enabled',
    ];
    for (const method of methods) {
      chain[method] = () => chain;
    }
    return chain;
  };

  return {
    GestureHandlerRootView: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(View, props, children),
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Gesture: {
      Pan: () => createChainableGesture(),
      LongPress: () => createChainableGesture(),
      Tap: () => createChainableGesture(),
      Simultaneous: (...gestures: unknown[]) => gestures,
      Race: (...gestures: unknown[]) => gestures,
    },
  };
});
