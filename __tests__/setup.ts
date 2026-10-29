jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => {
  const actual = jest.requireActual(
    'react-native/Libraries/TurboModule/TurboModuleRegistry',
  );
  const unconfiguredServerOperation = () => {
    throw new Error('本测试未配置本地 HTTP 服务原生结果。');
  };
  const staticServer = {
    getConstants: () => ({
      CRASHED: 'CRASHED',
      LAUNCHED: 'LAUNCHED',
      TERMINATED: 'TERMINATED',
      IS_MAC_CATALYST: false,
    }),
    onServerEvent: jest.fn(() => ({ remove: jest.fn() })),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    getActiveServerId: jest.fn(unconfiguredServerOperation),
    getLocalIpAddress: jest.fn(unconfiguredServerOperation),
    getOpenPort: jest.fn(unconfiguredServerOperation),
    start: jest.fn(unconfiguredServerOperation),
    stop: jest.fn(unconfiguredServerOperation),
  };
  return {
    ...actual,
    getEnforcing: (name: string) =>
      name === 'ReactNativeStaticServer'
        ? staticServer
        : actual.getEnforcing(name),
  };
});

jest.mock('@dr.pogodin/react-native-fs', () => {
  const unconfiguredFileOperation = () => {
    throw new Error('本测试未配置本地文件 I/O 结果。');
  };
  return {
    CachesDirectoryPath: '/fixture/cache',
    DocumentDirectoryPath: '/fixture/Documents',
    LibraryDirectoryPath: '/fixture/library',
    TemporaryDirectoryPath: '/fixture/tmp',
    ExternalDirectoryPath: null,
    ExternalCachesDirectoryPath: null,
    getAllExternalFilesDirs: jest.fn(async () => []),
    stat: jest.fn(unconfiguredFileOperation),
    readDir: jest.fn(unconfiguredFileOperation),
    readFile: jest.fn(unconfiguredFileOperation),
    writeFile: jest.fn(unconfiguredFileOperation),
    copyFile: jest.fn(unconfiguredFileOperation),
    mkdir: jest.fn(unconfiguredFileOperation),
    unlink: jest.fn(unconfiguredFileOperation),
  };
});

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: {
        CacheDir: '/fixture/cache',
        LibraryDir: '/fixture/library',
        DocumentDir: '/fixture/documents',
      },
    },
  },
}));
