import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as RNFS from '@dr.pogodin/react-native-fs';
import * as files from '../src';

jest.mock('@dr.pogodin/react-native-fs', () =>
  require('./fileIoFixture').createFileIoMock(),
);
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'portal-file-size-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('文件大小公共入口存在', () => {
  expect(files.getLocalFileSize).toEqual(expect.any(Function));
});

test.each([0, 64, 6])('读取实际字节 %s，不读取文件内容', async (sizeBytes) => {
  const path = join(directory, '中文 %20 ?#');
  await writeFile(path, sizeBytes === 6 ? '中文' : Buffer.alloc(sizeBytes));
  await expect(
    files.getLocalFileSize(pathToFileURL(path).href),
  ).resolves.toEqual({ status: 'success', sizeBytes });
  expect(RNFS.stat).toHaveBeenCalledWith(path);
  expect(RNFS.readFile).not.toHaveBeenCalled();
});

test.each([
  undefined,
  null,
  NaN,
  Infinity,
  -1,
  1.5,
  '64',
  Number.MAX_SAFE_INTEGER + 1,
])('不可用大小返回失败 %#', async (size) => {
  jest.mocked(RNFS.stat).mockResolvedValueOnce({
    size,
    isFile: () => true,
    isDirectory: () => false,
  } as never);
  await expect(
    files.getLocalFileSize('file:///tmp/file'),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
});

test('拒绝目录和特殊节点；缺失或不可读文件失败', async () => {
  await expect(
    files.getLocalFileSize(pathToFileURL(directory).href),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  jest.mocked(RNFS.stat).mockResolvedValueOnce({
    size: 0,
    isFile: () => false,
    isDirectory: () => false,
  } as never);
  await expect(
    files.getLocalFileSize('file:///tmp/special'),
  ).resolves.toMatchObject({ status: 'failed' });
  await expect(
    files.getLocalFileSize(pathToFileURL(join(directory, 'missing')).href),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
});

test('非法 URI 不执行 stat', async () => {
  await expect(
    files.getLocalFileSize('file:///tmp/%00'),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(RNFS.stat).not.toHaveBeenCalled();
});
