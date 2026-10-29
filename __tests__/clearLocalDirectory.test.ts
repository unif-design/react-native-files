import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as RNFS from '@dr.pogodin/react-native-fs';
import * as files from '../src';

jest.mock('@dr.pogodin/react-native-fs', () =>
  require('./fileIoFixture').createFileIoMock(),
);
let fixture: string;
let directory: string;
let uri: string;
beforeEach(async () => {
  const fresh = require('./fileIoFixture').createFileIoMock();
  jest.mocked(RNFS.readDir).mockImplementation(fresh.readDir);
  fixture = await mkdtemp(join(tmpdir(), 'portal-clear-directory-'));
  directory = join(fixture, '中文 %20 ?#');
  await mkdir(directory);
  uri = pathToFileURL(directory).href;
});
afterEach(async () => {
  await rm(fixture, { recursive: true, force: true });
});

test('清理公共入口存在', () => {
  expect(files.clearLocalDirectory).toEqual(expect.any(Function));
});

test('清理快照全部直接项，保留根目录、外部目录与链接指向内容', async () => {
  const outside = join(fixture, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'keep'), 'outside');
  await mkdir(join(directory, 'nested'));
  await writeFile(join(directory, 'nested', 'bytes'), 'nested');
  await writeFile(join(directory, 'empty %20 ?#'), '');
  await symlink(outside, join(directory, 'directory-link'));
  await symlink(join(fixture, 'missing'), join(directory, 'dangling-link'));
  await expect(files.clearLocalDirectory(uri)).resolves.toEqual({
    status: 'success',
  });
  expect(await readdir(directory)).toEqual([]);
  expect((await lstat(directory)).isDirectory()).toBe(true);
  expect(await readFile(join(outside, 'keep'), 'utf8')).toBe('outside');
  expect(RNFS.unlink).toHaveBeenCalledTimes(4);
  expect(RNFS.unlink).not.toHaveBeenCalledWith(directory);
});

test('明确不存在和空目录成功，不执行删除', async () => {
  await expect(files.clearLocalDirectory(uri)).resolves.toEqual({
    status: 'success',
  });
  await expect(
    files.clearLocalDirectory(pathToFileURL(join(fixture, 'missing')).href),
  ).resolves.toEqual({ status: 'success' });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('拒绝文件、根链接及非法 URI，不删除目录外内容', async () => {
  const file = join(fixture, 'file');
  await writeFile(file, 'keep');
  const link = join(fixture, 'link');
  await symlink(directory, link);
  for (const value of [
    pathToFileURL(file).href,
    pathToFileURL(link).href,
    '/tmp/raw',
  ]) {
    await expect(files.clearLocalDirectory(value)).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'invalid_input' },
    });
  }
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('一项拒绝仍清理其他项，失败项使用原直接子项 URI 且不重删', async () => {
  const failedPath = join(directory, 'a %20 ?#');
  await writeFile(failedPath, 'keep');
  await writeFile(join(directory, 'z'), 'remove');
  const cause = Object.assign(new Error('denied'), { code: 'EACCES' });
  jest.mocked(RNFS.unlink).mockRejectedValueOnce(cause);
  await expect(files.clearLocalDirectory(uri)).resolves.toEqual({
    status: 'partial',
    failures: [
      {
        uri: pathToFileURL(failedPath).href,
        error: { reason: 'io', message: expect.any(String), cause },
      },
    ],
  });
  expect(await readdir(directory)).toEqual(['a %20 ?#']);
  expect(RNFS.unlink).toHaveBeenCalledTimes(2);
});

test('SDK resolve 后目标仍在，包括 stat 跟随后缺失的悬空链接，必须全部失败', async () => {
  await writeFile(join(directory, 'file'), 'keep');
  await symlink(join(fixture, 'missing'), join(directory, 'link'));
  jest
    .mocked(RNFS.unlink)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined);
  const result = await files.clearLocalDirectory(uri);
  expect(result).toMatchObject({
    status: 'failed',
    failures: [
      { uri: `${uri}/file`, error: { reason: 'io' } },
      { uri: `${uri}/link`, error: { reason: 'io' } },
    ],
  });
  expect(await readdir(directory)).toEqual(['file', 'link']);
  expect(RNFS.unlink).toHaveBeenCalledTimes(2);
});

test('SDK ENOENT 不能代替缺失证明，真实移除后异常可确认成功', async () => {
  const path = join(directory, 'file');
  await writeFile(path, 'keep');
  const cause = Object.assign(new Error('missing child'), { code: 'ENOENT' });
  jest.mocked(RNFS.unlink).mockRejectedValueOnce(cause);
  await expect(files.clearLocalDirectory(uri)).resolves.toMatchObject({
    status: 'failed',
    failures: [{ uri: `${uri}/file`, error: { cause } }],
  });
  jest.mocked(RNFS.unlink).mockImplementationOnce(async () => {
    await rm(path);
    throw cause;
  });
  await expect(files.clearLocalDirectory(uri)).resolves.toEqual({
    status: 'success',
  });
});

test.each(['EACCES', 'ENOENT'])(
  '必要枚举失败 %s 不能当根缺失，不做删除',
  async (code) => {
    const cause = Object.assign(new Error('entry unavailable'), { code });
    const original = jest.mocked(RNFS.readDir).getMockImplementation()!;
    jest.mocked(RNFS.readDir).mockImplementation(async (path) => {
      if (path === directory) throw cause;
      return original(path);
    });
    await expect(files.clearLocalDirectory(uri)).resolves.toMatchObject({
      status: 'failed',
      error: { cause },
    });
    expect(RNFS.unlink).not.toHaveBeenCalled();
  },
);

test('删除后的确认读取失败不能宣称完成或再次删除', async () => {
  const path = join(directory, 'file');
  await writeFile(path, 'bytes');
  const cause = Object.assign(new Error('confirmation denied'), {
    code: 'EACCES',
  });
  jest.mocked(RNFS.unlink).mockImplementationOnce(async (target) => {
    await rm(target);
    jest.mocked(RNFS.readDir).mockRejectedValueOnce(cause);
  });
  await expect(files.clearLocalDirectory(uri)).resolves.toMatchObject({
    status: 'failed',
    failures: [{ uri: `${uri}/file`, error: { cause } }],
  });
  expect(RNFS.unlink).toHaveBeenCalledTimes(1);
});

test.each([
  { name: '../outside', path: 'outside' },
  { name: '.', path: 'root' },
  { name: 'safe', path: 'outside' },
  { name: 'a/b', path: 'nested' },
  { name: 'bad\u0000', path: 'root' },
])('异常直接项拒绝整个快照且不执行越界 I/O %#', async (entry) => {
  const outside = join(fixture, 'outside');
  await writeFile(outside, 'keep');
  const badPath =
    entry.path === 'outside'
      ? outside
      : entry.path === 'root'
        ? directory
        : join(directory, 'a/b');
  const original = jest.mocked(RNFS.readDir).getMockImplementation()!;
  jest.mocked(RNFS.readDir).mockImplementation(async (path) => {
    if (path === directory)
      return [
        { name: 'safe', path: join(directory, 'safe') },
        { name: entry.name, path: badPath },
      ] as never;
    return original(path);
  });
  await expect(files.clearLocalDirectory(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
  expect(RNFS.unlink).not.toHaveBeenCalled();
  expect(await readFile(outside, 'utf8')).toBe('keep');
});

test('清理等待期间不扩张快照，也不读取可变 SDK 条目作为删除路径', async () => {
  await writeFile(join(directory, 'a'), 'remove');
  await writeFile(join(directory, 'b'), 'remove');
  const original = jest.mocked(RNFS.readDir).getMockImplementation()!;
  let snapshot: Awaited<ReturnType<typeof RNFS.readDir>>;
  jest.mocked(RNFS.readDir).mockImplementation(async (path) => {
    const entries = await original(path);
    if (path === directory && !snapshot) snapshot = entries;
    return entries;
  });
  jest.mocked(RNFS.unlink).mockImplementationOnce(async (path) => {
    await rm(path);
    snapshot[1].path = join(fixture, 'outside');
    await writeFile(join(directory, 'new'), 'keep');
  });
  await expect(files.clearLocalDirectory(uri)).resolves.toEqual({
    status: 'success',
  });
  expect(await readdir(directory)).toEqual(['new']);
  expect(RNFS.unlink).toHaveBeenLastCalledWith(join(directory, 'b'));
});

test('父目录本身明确缺失时，目标目录同样不存在', async () => {
  await expect(
    files.clearLocalDirectory(
      pathToFileURL(join(fixture, 'missing-parent', 'target')).href,
    ),
  ).resolves.toEqual({ status: 'success' });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('父目录枚举的子项 ENOENT 不能证明根目录缺失', async () => {
  const cause = Object.assign(new Error('sibling metadata missing'), {
    code: 'ENOENT',
  });
  jest.mocked(RNFS.readDir).mockRejectedValueOnce(cause);
  await expect(files.clearLocalDirectory(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io', cause },
  });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('SDK 正规化名称与引用不一致时不能凭未匹配宣称缺失或误删另一项', async () => {
  const nfdPath = join(fixture, 'e\u0301');
  const nfcPath = join(fixture, '\u00e9');
  jest
    .mocked(RNFS.readDir)
    .mockResolvedValueOnce([
      { name: '\u00e9', path: nfcPath, isDirectory: () => true },
    ] as never);
  await expect(
    files.clearLocalDirectory(pathToFileURL(nfdPath).href),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('根目录项与 stat 类型不一致时拒绝清理，不把链接类型升级成目录', async () => {
  jest.mocked(RNFS.stat).mockResolvedValueOnce({
    isDirectory: () => false,
    isFile: () => false,
  } as never);
  await expect(files.clearLocalDirectory(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('无法编码为有效 URI 的 SDK 子项在删除前失败，不抛出未处理异常', async () => {
  const original = jest.mocked(RNFS.readDir).getMockImplementation()!;
  jest.mocked(RNFS.readDir).mockImplementation(async (path) => {
    if (path === directory)
      return [{ name: '\ud800', path: `${directory}/\ud800` }] as never;
    return original(path);
  });
  jest.mocked(RNFS.unlink).mockResolvedValueOnce(undefined);
  await expect(files.clearLocalDirectory(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('父目录没有字面匹配但原始路径实际存在时失败，不误报已清理或改写删除目标', async () => {
  const actualPath = join(fixture, 'CaseTarget');
  const inputPath = join(fixture, 'casetarget');
  await mkdir(actualPath);
  await writeFile(join(actualPath, 'keep.txt'), 'keep');
  // Model the SDK on a case-insensitive filesystem without requiring the test host to be one.
  const originalStat = jest.mocked(RNFS.stat).getMockImplementation()!;
  jest
    .mocked(RNFS.stat)
    .mockImplementationOnce((path) =>
      originalStat(path === inputPath ? actualPath : path),
    );
  await expect(
    files.clearLocalDirectory(pathToFileURL(inputPath).href),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  expect(RNFS.stat).toHaveBeenCalledWith(inputPath);
  expect(RNFS.unlink).not.toHaveBeenCalled();
  expect(await readFile(join(actualPath, 'keep.txt'), 'utf8')).toBe('keep');
});

test('父目录未匹配时原始路径 stat 权限失败不能冒充不存在', async () => {
  const inputPath = join(fixture, 'unmatched');
  const cause = Object.assign(new Error('denied'), { code: 'EACCES' });
  jest.mocked(RNFS.stat).mockRejectedValueOnce(cause);
  await expect(
    files.clearLocalDirectory(pathToFileURL(inputPath).href),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io', cause },
  });
  expect(RNFS.stat).toHaveBeenCalledWith(inputPath);
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('大小写不同的悬空根链接不能凭跟随式 stat ENOENT 报告目录缺失', async () => {
  const actualPath = join(fixture, 'DanglingRoot');
  const inputPath = join(fixture, 'danglingroot');
  await symlink(join(fixture, 'missing-target'), actualPath);
  await expect(
    files.clearLocalDirectory(pathToFileURL(inputPath).href),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  expect(RNFS.unlink).not.toHaveBeenCalled();
  expect((await lstat(actualPath)).isSymbolicLink()).toBe(true);
});

test.each([
  ['Σ', 'ς'],
  ['ß', 'SS'],
  ['ſ', 'S'],
])('根缺失不能靠 Unicode 名称小写推断：%s 与 %s', async (stored, spelling) => {
  const actualPath = join(fixture, stored);
  const inputPath = join(fixture, spelling);
  await symlink(join(fixture, 'missing-target'), actualPath);
  await expect(
    files.clearLocalDirectory(pathToFileURL(inputPath).href),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  expect(RNFS.unlink).not.toHaveBeenCalled();
  expect((await lstat(actualPath)).isSymbolicLink()).toBe(true);
});

test('未匹配路径明确 ENOENT 但父目录存在特殊项时无法确认缺失', async () => {
  jest.mocked(RNFS.readDir).mockResolvedValueOnce([
    {
      name: 'special',
      path: join(fixture, 'special'),
      isFile: () => false,
      isDirectory: () => false,
    },
  ] as never);
  await expect(
    files.clearLocalDirectory(pathToFileURL(join(fixture, 'missing')).href),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('原始路径明确 ENOENT 且父目录只有普通文件和目录时保留缺失成功', async () => {
  await writeFile(join(fixture, 'regular.txt'), 'keep');
  await expect(
    files.clearLocalDirectory(pathToFileURL(join(fixture, 'missing')).href),
  ).resolves.toEqual({ status: 'success' });
  expect(RNFS.unlink).not.toHaveBeenCalled();
  expect(await readFile(join(fixture, 'regular.txt'), 'utf8')).toBe('keep');
});
