module.exports = {
  name: 'SnickyLink',
  slug: 'snickylink',
  version: '0.2.0',
  orientation: 'portrait',
  scheme: 'snickylink',
  userInterfaceStyle: 'dark',
  splash: { backgroundColor: '#3A1620', resizeMode: 'contain' },
  android: {
    package: 'com.snickylink.app',
    adaptiveIcon: { backgroundColor: '#3A1620' },
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES'],
  },
  ios: { bundleIdentifier: 'com.snickylink.app', supportsTablet: false },
  plugins: [
    'expo-router',
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
  extra: { eas: { projectId: '62ef66cf-2d36-49fc-87fd-2c100f520c46' } },
};
