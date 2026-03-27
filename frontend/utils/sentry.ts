import * as Sentry from '@sentry/react-native';

export const initSentry = () => {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      debug: __DEV__,
      tracesSampleRate: 1.0,
    });
  }
};

export const wrapSentry = (Component: any) => {
  return Sentry.wrap(Component);
};
