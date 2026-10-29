module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native[a-z-]*|@react-native|@unif|@dr.pogodin/(react-native-static-server|js-utils))/)',
  ],
  clearMocks: true,
  restoreMocks: true,
};
