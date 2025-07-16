// Mock for Puppeteer debug functionality to prevent dynamic import errors
export const debug = () => () => {};
export const setDebugLevel = () => {};
export const getDebugLevel = () => 0;

// Mock the debugLevel function that's causing issues
export const debugLevel = () => {
  return {
    debug: () => () => {},
    setDebugLevel: () => {},
    getDebugLevel: () => 0,
  };
};

export default {
  debug,
  setDebugLevel,
  getDebugLevel,
  debugLevel,
};