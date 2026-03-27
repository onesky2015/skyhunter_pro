export const initSentry = () => {
  // Web 端暂时不初始化 @sentry/react-native 以防报错
};

export const wrapSentry = (Component: any) => {
  return Component;
};
