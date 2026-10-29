import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as RNFS from '@dr.pogodin/react-native-fs';
import * as files from '../src';

jest.mock('@dr.pogodin/react-native-fs', () =>
  require('./fileIoFixture').createFileIoMock(),
);
let directory: string;
let path: string;
let uri: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'portal-read-file-'));
  path = join(directory, '中文 %20 ?#.txt');
  uri = pathToFileURL(path).href;
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('读取公共入口存在', () => {
  expect(files.readLocalFile).toEqual(expect.any(Function));
});

test.each(['utf8', 'base64'] as const)(
  '按 %s 读取原文及空文件，不解析 JSON',
  async (encoding) => {
    await writeFile(path, '{中文 invalid json\n');
    const content =
      encoding === 'utf8'
        ? '{中文 invalid json\n'
        : 'e+S4reaWhyBpbnZhbGlkIGpzb24K';
    await expect(files.readLocalFile({ uri, encoding })).resolves.toEqual({
      status: 'success',
      content,
    });
    expect(RNFS.readFile).toHaveBeenCalledWith(path, encoding);
    await writeFile(path, '');
    await expect(files.readLocalFile({ uri, encoding })).resolves.toEqual({
      status: 'success',
      content: '',
    });
    expect(RNFS.unlink).not.toHaveBeenCalled();
  },
);

test.each([null, undefined, 0, {}, []])(
  'SDK 非字符串不冒充空文件 %#',
  async (content) => {
    jest.mocked(RNFS.readFile).mockResolvedValueOnce(content as never);
    await expect(
      files.readLocalFile({ uri, encoding: 'utf8' }),
    ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  },
);

test('SDK 读取异常保留 cause，原文件不删除', async () => {
  await writeFile(path, 'keep');
  const cause = new Error('decode failed');
  jest.mocked(RNFS.readFile).mockRejectedValueOnce(cause);
  await expect(
    files.readLocalFile({ uri, encoding: 'utf8' }),
  ).resolves.toMatchObject({ status: 'failed', error: { cause } });
  expect(await readFile(path, 'utf8')).toBe('keep');
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('缺失文件和目录无法作为内容读取', async () => {
  for (const value of [uri, pathToFileURL(directory).href]) {
    await expect(
      files.readLocalFile({ uri: value, encoding: 'utf8' }),
    ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  }
});

test.each([
  { uri: '/tmp/raw', encoding: 'utf8' },
  { uri: 'file:///tmp/%ZZ', encoding: 'utf8' },
  { uri: 'file:///tmp/file', encoding: 'ascii' },
  { uri: 'file:///tmp/file' },
  null,
])('非法引用或未明确编码不运行 I/O %#', async (input) => {
  await expect(files.readLocalFile(input as never)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(RNFS.readFile).not.toHaveBeenCalled();
});
