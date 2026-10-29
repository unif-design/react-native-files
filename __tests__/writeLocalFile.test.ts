import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
  directory = await mkdtemp(join(tmpdir(), 'portal-write-file-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('写入公共入口存在', () => {
  expect(files.writeLocalFile).toEqual(expect.any(Function));
});

test('创建父目录并按 UTF-8 原样覆盖，空内容也是成功写入', async () => {
  const path = join(directory, '中文 %20 ?#', 'content.txt');
  const uri = pathToFileURL(path).href;
  for (const content of ['中文\nraw JSON{', '', 'replacement']) {
    await expect(files.writeLocalFile({ uri, content })).resolves.toEqual({
      status: 'success',
      uri,
    });
    expect(await readFile(path, 'utf8')).toBe(content);
    expect(RNFS.writeFile).toHaveBeenLastCalledWith(path, content, 'utf8');
  }
});

test('等待前捕获 uri/content，完成前不交付成功', async () => {
  const path = join(directory, 'original');
  const input = { uri: pathToFileURL(path).href, content: 'original content' };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  jest.mocked(RNFS.mkdir).mockImplementationOnce(() => pending);
  let completed = false;
  const result = files.writeLocalFile(input).then((value) => {
    completed = true;
    return value;
  });
  input.uri = pathToFileURL(join(directory, 'other')).href;
  input.content = 'mutated';
  await Promise.resolve();
  expect(completed).toBe(false);
  release();
  await expect(result).resolves.toEqual({
    status: 'success',
    uri: pathToFileURL(path).href,
  });
  expect(await readFile(path, 'utf8')).toBe('original content');
  expect(await readdir(directory)).toEqual(['original']);
});

test.each(['mkdir', 'writeFile'] as const)(
  '%s 失败不删除原文件、不重试或制造备份',
  async (operation) => {
    const path = join(directory, 'keep');
    await writeFile(path, 'keep');
    const cause = Object.assign(new Error('denied'), { code: 'EACCES' });
    jest.mocked(RNFS[operation]).mockRejectedValueOnce(cause);
    await expect(
      files.writeLocalFile({
        uri: pathToFileURL(path).href,
        content: 'replace',
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'io', cause },
    });
    expect(await readFile(path, 'utf8')).toBe('keep');
    expect(await readdir(directory)).toEqual(['keep']);
    expect(RNFS[operation]).toHaveBeenCalledTimes(1);
    expect(RNFS.unlink).not.toHaveBeenCalled();
  },
);

test.each([
  null,
  { uri: '/tmp/raw', content: '' },
  { uri: 'file:///tmp/a', content: null },
])('非法输入不准备目录或写入 %#', async (input) => {
  await expect(files.writeLocalFile(input as never)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(RNFS.mkdir).not.toHaveBeenCalled();
  expect(RNFS.writeFile).not.toHaveBeenCalled();
});
