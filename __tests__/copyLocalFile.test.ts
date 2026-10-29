import * as ReactNativeFs from '@dr.pogodin/react-native-fs';
import { copyLocalFile } from '../src';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  stat: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('@unif/react-native-logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { createLogger: jest.fn(() => mockLogger), mockLogger };
});

const SOURCE_PATH = '/tmp/source image.jpg';
const TARGET_PATH = '/tmp/draft/image copy.jpg';
const SOURCE_URI = 'file:///tmp/source%20image.jpg';
const TARGET_URI = 'file:///tmp/draft/./image%20copy.jpg';

const fileStat = {
  isFile: () => true,
  isDirectory: () => false,
};
const directoryStat = {
  isFile: () => false,
  isDirectory: () => true,
};

const missing = (code: string = 'ENOENT') =>
  Object.assign(new Error(), { code });

function mockAvailableSourceAndMissingTarget() {
  jest.mocked(ReactNativeFs.stat).mockImplementation(async (path) => {
    if (path === SOURCE_PATH) return fileStat as never;
    throw missing();
  });
}

beforeEach(() => {
  jest.mocked(ReactNativeFs.mkdir).mockResolvedValue(undefined);
  jest.mocked(ReactNativeFs.copyFile).mockResolvedValue(undefined);
  jest.mocked(ReactNativeFs.unlink).mockResolvedValue(undefined);
});

test('复制普通文件并保留源文件和调用方目标 URI', async () => {
  mockAvailableSourceAndMissingTarget();

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toEqual({ status: 'success', uri: TARGET_URI });

  expect(ReactNativeFs.stat).toHaveBeenNthCalledWith(1, SOURCE_PATH);
  expect(ReactNativeFs.stat).toHaveBeenNthCalledWith(2, TARGET_PATH);
  expect(ReactNativeFs.mkdir).toHaveBeenCalledWith('/tmp/draft');
  expect(ReactNativeFs.copyFile).toHaveBeenCalledWith(SOURCE_PATH, TARGET_PATH);
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('目标已存在时不覆盖也不删除', async () => {
  jest.mocked(ReactNativeFs.stat).mockImplementation(async (path) => {
    if (path === SOURCE_PATH || path === TARGET_PATH) return fileStat as never;
    throw missing();
  });

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.copyFile).not.toHaveBeenCalled();
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('一次解码和规范化后源目标等价时拒绝复制', async () => {
  await expect(
    copyLocalFile({
      sourceUri: 'file:///tmp/media/%E7%85%A7%E7%89%87/../a%20b.jpg',
      targetUri: 'file:///tmp/media/a%20b.jpg',
    }),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.stat).not.toHaveBeenCalled();
  expect(ReactNativeFs.copyFile).not.toHaveBeenCalled();
});

test.each([
  ['', TARGET_URI],
  ['/tmp/source.jpg', TARGET_URI],
  ['content:///tmp/source.jpg', TARGET_URI],
  ['file://host/tmp/source.jpg', TARGET_URI],
  ['file:///tmp/%ZZ.jpg', TARGET_URI],
  [SOURCE_URI, 'file:///tmp/draft/%00.jpg'],
])('拒绝无效本地 file URI %#', async (sourceUri, targetUri) => {
  await expect(copyLocalFile({ sourceUri, targetUri })).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.stat).not.toHaveBeenCalled();
});

test('源位置是目录时不复制', async () => {
  jest.mocked(ReactNativeFs.stat).mockResolvedValue(directoryStat as never);

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.copyFile).not.toHaveBeenCalled();
});

test('源文件 stat 发生权限错误时保留原 cause', async () => {
  const cause = Object.assign(new Error('permission'), { code: 'EACCES' });
  jest.mocked(ReactNativeFs.stat).mockRejectedValue(cause);

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toEqual({
    status: 'failed',
    error: { reason: 'io', message: '本地文件保存失败。', cause },
  });
  expect(ReactNativeFs.copyFile).not.toHaveBeenCalled();
});

test('创建目标父目录失败时不开始复制和清理', async () => {
  const cause = Object.assign(new Error('mkdir failed'), { code: 'EACCES' });
  mockAvailableSourceAndMissingTarget();
  jest.mocked(ReactNativeFs.mkdir).mockRejectedValue(cause);

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toEqual({
    status: 'failed',
    error: { reason: 'io', message: '本地文件保存失败。', cause },
  });
  expect(ReactNativeFs.copyFile).not.toHaveBeenCalled();
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('复制失败后只清理本次生成的目标文件并保留复制 cause', async () => {
  const cause = Object.assign(new Error('copy failed'), { code: 'EIO' });
  let targetStatCount = 0;
  jest.mocked(ReactNativeFs.stat).mockImplementation(async (path) => {
    if (path === SOURCE_PATH) return fileStat as never;
    targetStatCount += 1;
    if (targetStatCount === 1) throw missing();
    if (targetStatCount === 2) return fileStat as never;
    throw missing();
  });
  jest.mocked(ReactNativeFs.copyFile).mockRejectedValue(cause);

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toEqual({
    status: 'failed',
    error: { reason: 'io', message: '本地文件保存失败。', cause },
  });
  expect(ReactNativeFs.unlink).toHaveBeenCalledTimes(1);
  expect(ReactNativeFs.unlink).toHaveBeenCalledWith(TARGET_PATH);
  expect(ReactNativeFs.unlink).not.toHaveBeenCalledWith(SOURCE_PATH);
});

test('复制未生成目标时不调用 unlink', async () => {
  const cause = Object.assign(new Error('copy failed'), { code: 'EIO' });
  mockAvailableSourceAndMissingTarget();
  jest.mocked(ReactNativeFs.copyFile).mockRejectedValue(cause);

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toMatchObject({ status: 'failed', error: { cause } });
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('目标清理失败不覆盖复制失败并留下无路径诊断', async () => {
  const copyCause = Object.assign(new Error('copy failed'), { code: 'EIO' });
  const cleanupCause = Object.assign(new Error('cleanup failed'), {
    code: 'EACCES',
  });
  let targetStatCount = 0;
  jest.mocked(ReactNativeFs.stat).mockImplementation(async (path) => {
    if (path === SOURCE_PATH) return fileStat as never;
    targetStatCount += 1;
    if (targetStatCount === 1) throw missing();
    return fileStat as never;
  });
  jest.mocked(ReactNativeFs.copyFile).mockRejectedValue(copyCause);
  jest.mocked(ReactNativeFs.unlink).mockRejectedValue(cleanupCause);

  await expect(
    copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI }),
  ).resolves.toEqual({
    status: 'failed',
    error: {
      reason: 'io',
      message: '本地文件保存失败。',
      cause: copyCause,
    },
  });
  const logger = require('@unif/react-native-logger').mockLogger;
  expect(logger.warn).toHaveBeenCalledWith(
    'local_media.copy_cleanup.failed',
    expect.objectContaining({
      phase: 'cleanup',
      outcome: 'failed',
      code: 'EACCES',
    }),
  );
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('/tmp/');
});

test('同一规范化目标正在复制时拒绝第二次写入', async () => {
  mockAvailableSourceAndMissingTarget();
  let finishCopy: (() => void) | undefined;
  jest
    .mocked(ReactNativeFs.copyFile)
    .mockImplementation(() => new Promise((resolve) => (finishCopy = resolve)));

  const first = copyLocalFile({ sourceUri: SOURCE_URI, targetUri: TARGET_URI });
  await Promise.resolve();
  await Promise.resolve();
  await expect(
    copyLocalFile({
      sourceUri: SOURCE_URI,
      targetUri: 'file:///tmp/draft/image%20copy.jpg',
    }),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.copyFile).toHaveBeenCalledTimes(1);
  finishCopy?.();
  await expect(first).resolves.toMatchObject({ status: 'success' });
});
