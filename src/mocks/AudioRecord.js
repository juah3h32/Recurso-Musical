// Mock for react-native-audio-record (native module not available in Expo managed)
const AudioRecord = {
  init: () => {},
  start: () => {},
  stop: () => Promise.resolve(''),
  on: () => ({ remove: () => {} }),
};

export default AudioRecord;
