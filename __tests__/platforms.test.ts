test('Web 临时根不加载原生文件 SDK，明确没有可用根目录', () => {
  jest.resetModules();
  jest.doMock('react-native-blob-util', () => {
    throw new Error('Web 不应加载原生文件 SDK');
  });
  const {
    getNativeTemporaryRoot,
  } = require('../src/getNativeTemporaryRoot.web');
  expect(getNativeTemporaryRoot()).toBeUndefined();
});

test('Web 复制、删除和目录统计明确返回 unsupported 且不加载原生文件 SDK', async () => {
  jest.resetModules();
  jest.doMock('@dr.pogodin/react-native-fs', () => {
    throw new Error('Web 不应加载原生文件 SDK');
  });

  let copyLocalFile: typeof import('../src/copyLocalFile.web').copyLocalFile;
  let getLocalDirectorySize: typeof import('../src/getLocalDirectorySize.web').getLocalDirectorySize;
  let deleteLocalFile: typeof import('../src/deleteLocalFile.web').deleteLocalFile;
  jest.isolateModules(() => {
    ({ getLocalDirectorySize } = require('../src/getLocalDirectorySize.web'));
    ({ copyLocalFile } = require('../src/copyLocalFile.web'));
    ({ deleteLocalFile } = require('../src/deleteLocalFile.web'));
  });

  await expect(
    copyLocalFile!({
      sourceUri: 'file:///tmp/source.jpg',
      targetUri: 'file:///tmp/target.jpg',
    }),
  ).resolves.toEqual({
    status: 'failed',
    error: {
      reason: 'unsupported',
      message: '当前平台不支持本地文件操作。',
    },
  });
  await expect(
    getLocalDirectorySize!('file:///tmp/cache'),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  await expect(deleteLocalFile!('file:///tmp/target.jpg')).resolves.toEqual({
    status: 'failed',
    error: {
      reason: 'unsupported',
      message: '当前平台不支持本地文件操作。',
    },
  });
});

test('Web 新文件操作明确 unsupported，不加载原生 SDK', async () => {
  jest.resetModules();
  jest.doMock('@dr.pogodin/react-native-fs', () => {
    throw new Error('Web 不应加载原生文件 SDK');
  });
  const { readLocalFile } = require('../src/readLocalFile.web');
  const { writeLocalFile } = require('../src/writeLocalFile.web');
  const { getLocalFileSize } = require('../src/getLocalFileSize.web');
  const { clearLocalDirectory } = require('../src/clearLocalDirectory.web');
  for (const result of [
    readLocalFile({ uri: 'file:///tmp/file', encoding: 'utf8' }),
    writeLocalFile({ uri: 'file:///tmp/file', content: '' }),
    getLocalFileSize('file:///tmp/file'),
    clearLocalDirectory('file:///tmp/directory'),
  ]) {
    await expect(result).resolves.toEqual({
      status: 'failed',
      error: {
        reason: 'unsupported',
        message: '当前平台不支持本地文件操作。',
      },
    });
  }
});

test('Web 下载明确 unsupported，前置取消零 SDK 访问', async () => {
  jest.resetModules();
  jest.doMock('@dr.pogodin/react-native-fs', () => {
    throw new Error('Web 不应加载原生文件 SDK');
  });
  const { downloadLocalFile } = require('../src/downloadLocalFile.web');
  const input = {
    sourceUrl: 'https://example.invalid/a',
    targetUri: 'file:///tmp/a',
  };
  await expect(downloadLocalFile(input)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  const controller = new AbortController();
  controller.abort();
  await expect(
    downloadLocalFile(input, { signal: controller.signal }),
  ).resolves.toEqual({ status: 'cancelled' });
});

test('Web 公共入口保留文件生命周期且不加载原生 SDK', async () => {
  jest.resetModules();
  jest.doMock('@dr.pogodin/react-native-fs', () => {
    throw new Error('Web 不应加载原生文件 SDK');
  });
  jest.doMock('react-native-blob-util', () => {
    throw new Error('Web 不应加载原生文件 SDK');
  });
  jest.doMock('@dr.pogodin/react-native-static-server', () => {
    throw new Error('Web 不应加载原生静态服务 SDK');
  });
  const files: typeof import('../src/index.web') = require('../src/index.web');
  expect(Object.keys(files).sort()).toEqual([
    'clearLocalDirectory',
    'copyLocalFile',
    'createLocalFileLifetime',
    'createLocalResourceAccess',
    'deleteLocalFile',
    'downloadLocalFile',
    'getLocalDirectorySize',
    'getLocalFileSize',
    'getNativeTemporaryRoot',
    'readLocalFile',
    'writeLocalFile',
  ]);
  expect(files.getNativeTemporaryRoot()).toBeUndefined();
  for (const result of [
    files.copyLocalFile({
      sourceUri: 'file:///tmp/source',
      targetUri: 'file:///tmp/target',
    }),
    files.deleteLocalFile('file:///tmp/target'),
    files.getLocalDirectorySize('file:///tmp'),
    files.getLocalFileSize('file:///tmp/target'),
    files.readLocalFile({ uri: 'file:///tmp/target', encoding: 'utf8' }),
    files.writeLocalFile({ uri: 'file:///tmp/target', content: '' }),
    files.clearLocalDirectory('file:///tmp'),
    files.downloadLocalFile({
      sourceUrl: 'https://example.invalid/file',
      targetUri: 'file:///tmp/target',
    }),
  ]) {
    await expect(result).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'unsupported' },
    });
  }
  const access = files.createLocalResourceAccess({ rootUri: 'file:///tmp' });
  await expect(access.getUrl('file:///tmp/target')).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  await expect(access.close()).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  const cleanup = jest.fn();
  const lifetime = files.createLocalFileLifetime(cleanup);
  const release = lifetime.retain();
  lifetime.retire();
  expect(cleanup).not.toHaveBeenCalled();
  release?.();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
