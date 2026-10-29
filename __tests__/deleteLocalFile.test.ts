import * as ReactNativeFs from '@dr.pogodin/react-native-fs';
import { deleteLocalFile } from '../src';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  stat: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
}));

const FILE_URI = 'file:///tmp/%E7%85%A7%E7%89%87%20one.jpg';
const FILE_PATH = '/tmp/照片 one.jpg';
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

beforeEach(() => {
  jest.resetAllMocks();
});

test('删除普通文件并在再次 stat 明确不存在后返回 deleted true', async () => {
  jest
    .mocked(ReactNativeFs.stat)
    .mockResolvedValueOnce(fileStat as never)
    .mockRejectedValueOnce(missing('NSCocoaErrorDomain:260'));
  jest.mocked(ReactNativeFs.unlink).mockResolvedValue(undefined);

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'success',
    deleted: true,
  });
  expect(ReactNativeFs.stat).toHaveBeenNthCalledWith(1, FILE_PATH);
  expect(ReactNativeFs.unlink).toHaveBeenCalledWith(FILE_PATH);
  expect(ReactNativeFs.stat).toHaveBeenNthCalledWith(2, FILE_PATH);
});

test.each([
  'ENOENT',
  'NSCocoaErrorDomain:260',
  'NSCocoaErrorDomain:4',
  'NSPOSIXErrorDomain:2',
])('首次 stat 返回明确缺失码 %s 时返回 deleted false', async (code) => {
  jest.mocked(ReactNativeFs.stat).mockRejectedValue(missing(code));

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'success',
    deleted: false,
  });
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('目录不会传给 unlink', async () => {
  jest.mocked(ReactNativeFs.stat).mockResolvedValue(directoryStat as never);

  await expect(deleteLocalFile(FILE_URI)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('普通 stat 权限错误返回 io 并保留 cause', async () => {
  const cause = Object.assign(new Error('permission'), { code: 'EACCES' });
  jest.mocked(ReactNativeFs.stat).mockRejectedValue(cause);

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'failed',
    error: { reason: 'io', message: '本地文件删除失败。', cause },
  });
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('没有 code 的 unlink 异常不会按英文文案猜成不存在', async () => {
  const cause = new Error('no such file or directory');
  jest.mocked(ReactNativeFs.stat).mockResolvedValue(fileStat as never);
  jest.mocked(ReactNativeFs.unlink).mockRejectedValue(cause);

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'failed',
    error: { reason: 'io', message: '本地文件删除失败。', cause },
  });
});

test('unlink 返回明确缺失码时返回 deleted false', async () => {
  jest.mocked(ReactNativeFs.stat).mockResolvedValue(fileStat as never);
  jest.mocked(ReactNativeFs.unlink).mockRejectedValue(missing());

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'success',
    deleted: false,
  });
});

test('Android unlink 以 RNFS 报告竞态消失时经 stat 确认 deleted false', async () => {
  const unlinkCause = Object.assign(new Error('File does not exist'), {
    code: 'RNFS',
  });
  jest
    .mocked(ReactNativeFs.stat)
    .mockResolvedValueOnce(fileStat as never)
    .mockRejectedValueOnce(missing());
  jest.mocked(ReactNativeFs.unlink).mockRejectedValue(unlinkCause);

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'success',
    deleted: false,
  });
  expect(ReactNativeFs.stat).toHaveBeenCalledTimes(2);
});

test('未知 unlink 异常后 stat 也失败时保留 unlink cause', async () => {
  const unlinkCause = Object.assign(new Error('unlink failed'), {
    code: 'RNFS',
  });
  const statCause = Object.assign(new Error('stat failed'), {
    code: 'EACCES',
  });
  jest
    .mocked(ReactNativeFs.stat)
    .mockResolvedValueOnce(fileStat as never)
    .mockRejectedValueOnce(statCause);
  jest.mocked(ReactNativeFs.unlink).mockRejectedValue(unlinkCause);

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'failed',
    error: {
      reason: 'io',
      message: '本地文件删除失败。',
      cause: unlinkCause,
    },
  });
  expect(ReactNativeFs.stat).toHaveBeenCalledTimes(2);
});

test('unlink 正常结束但文件仍存在时返回 io', async () => {
  jest.mocked(ReactNativeFs.stat).mockResolvedValue(fileStat as never);
  jest.mocked(ReactNativeFs.unlink).mockResolvedValue(undefined);

  await expect(deleteLocalFile(FILE_URI)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io', cause: expect.any(Error) },
  });
  expect(ReactNativeFs.stat).toHaveBeenCalledTimes(2);
});

test('删除后核实发生未知 I/O 错误时返回失败而不报告已删除', async () => {
  const cause = Object.assign(new Error('stat failed'), { code: 'EACCES' });
  jest
    .mocked(ReactNativeFs.stat)
    .mockResolvedValueOnce(fileStat as never)
    .mockRejectedValueOnce(cause);
  jest.mocked(ReactNativeFs.unlink).mockResolvedValue(undefined);

  await expect(deleteLocalFile(FILE_URI)).resolves.toEqual({
    status: 'failed',
    error: { reason: 'io', message: '本地文件删除失败。', cause },
  });
});

test.each(['', '/tmp/a.jpg', 'content:///tmp/a.jpg', 'file://host/tmp/a.jpg'])(
  '无效本地 file URI %p 不访问文件系统',
  async (uri) => {
    await expect(deleteLocalFile(uri)).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'invalid_input' },
    });
    expect(ReactNativeFs.stat).not.toHaveBeenCalled();
  },
);
