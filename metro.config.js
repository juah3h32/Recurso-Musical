const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Mock react-native-audio-record (native module, not available in Expo managed workflow)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-audio-record': require.resolve('./src/mocks/AudioRecord'),
};

module.exports = config;
