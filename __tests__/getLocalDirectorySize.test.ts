import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { getLocalDirectorySize } from '../src';

jest.mock('@dr.pogodin/react-native-fs', () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  return {
    stat: jest.fn((file: string) => fs.lstat(file)),
    readDir: jest.fn(async (directory: string) => {
      const names: string[] = await fs.readdir(directory);
      return Promise.all(
        names.map(async (name) => {
          const filePath = path.join(directory, name);
          const item = await fs.lstat(filePath);
          return {
            name,
            path: filePath,
            size: item.size,
            isFile: () => item.isFile(),
            isDirectory: () => item.isDirectory(),
          };
        }),
      );
    }),
    copyFile: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn(),
  };
});

let directory: string;
let uri: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'portal-directory-size-'));
  uri = pathToFileURL(directory).href;
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('递归统计普通文件真实字节，保留零和 64，忽略目录大小与符号链接', async () => {
  await mkdir(join(directory, 'nested', 'empty'), { recursive: true });
  await writeFile(join(directory, 'empty'), '');
  await writeFile(join(directory, 'nested', '64-bytes'), Buffer.alloc(64));
  await writeFile(join(directory, 'nested', 'text'), '中文');
  await symlink(join(directory, 'nested'), join(directory, 'link'));
  await expect(getLocalDirectorySize(uri)).resolves.toEqual({
    status: 'success',
    sizeBytes: 70,
  });
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test('空目录与 SDK 明确报告不存在的根目录分别返回零', async () => {
  await expect(getLocalDirectorySize(uri)).resolves.toEqual({
    status: 'success',
    sizeBytes: 0,
  });
  await expect(getLocalDirectorySize(`${uri}/missing`)).resolves.toEqual({
    status: 'success',
    sizeBytes: 0,
  });
});

test.each([
  'NSCocoaErrorDomain:260',
  'NSCocoaErrorDomain:4',
  'NSPOSIXErrorDomain:2',
])('明确的 iOS 根目录缺失码 %s 返回零', async (code) => {
  jest
    .mocked(RNFS.stat)
    .mockRejectedValueOnce(Object.assign(new Error('missing'), { code }));
  await expect(getLocalDirectorySize(uri)).resolves.toEqual({
    status: 'success',
    sizeBytes: 0,
  });
  expect(RNFS.readDir).not.toHaveBeenCalled();
});

test('拒绝非目录根，不将普通文件大小交付为目录占用', async () => {
  const file = join(directory, 'file');
  await writeFile(file, 'bytes');
  await expect(
    getLocalDirectorySize(pathToFileURL(file).href),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(RNFS.readDir).not.toHaveBeenCalled();
});

test.each([
  '',
  '/tmp/cache',
  'https://host/file',
  'file://host/tmp/cache',
  'file:///tmp/%ZZ',
  'file:///tmp/%00',
  'file:///tmp/a?b',
])('非法 URI 不读取文件系统 %#', async (value) => {
  await expect(getLocalDirectorySize(value)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(RNFS.stat).not.toHaveBeenCalled();
  expect(RNFS.readDir).not.toHaveBeenCalled();
});

test('中文、空格、百分号、问号和井号 URI 仅解码一次', async () => {
  const nested = join(directory, '中文 %20 ?#');
  await mkdir(nested);
  await writeFile(join(nested, 'file'), 'valid');
  await expect(
    getLocalDirectorySize(pathToFileURL(nested).href),
  ).resolves.toEqual({ status: 'success', sizeBytes: 5 });
  expect(RNFS.stat).toHaveBeenCalledWith(nested);
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
])('不可用大小失败且不交付局部和 %#', async (size) => {
  jest.mocked(RNFS.readDir).mockResolvedValueOnce([
    {
      path: `${directory}/good`,
      size: 64,
      isFile: () => true,
      isDirectory: () => false,
    },
    {
      path: `${directory}/unknown`,
      size,
      isFile: () => true,
      isDirectory: () => false,
    },
  ] as never);
  await expect(getLocalDirectorySize(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
});

test('总和超出安全整数失败', async () => {
  jest.mocked(RNFS.readDir).mockResolvedValueOnce([
    {
      path: `${directory}/max`,
      size: Number.MAX_SAFE_INTEGER,
      isFile: () => true,
      isDirectory: () => false,
    },
    {
      path: `${directory}/one`,
      size: 1,
      isFile: () => true,
      isDirectory: () => false,
    },
  ] as never);
  await expect(getLocalDirectorySize(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
});

test('根目录权限失败保留失败事实及 cause', async () => {
  const cause = Object.assign(new Error('permission'), { code: 'EACCES' });
  jest.mocked(RNFS.stat).mockRejectedValueOnce(cause);
  await expect(getLocalDirectorySize(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io', cause },
  });
});

test.each(['ENOENT', 'EACCES', 'metadata_unavailable'])(
  '子目录或单项元数据失败 %s 不交付已累计字节',
  async (code) => {
    const cause = Object.assign(new Error('entry metadata unavailable'), {
      code,
    });
    jest
      .mocked(RNFS.readDir)
      .mockResolvedValueOnce([
        {
          path: `${directory}/good`,
          size: 64,
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          path: `${directory}/child`,
          size: 99,
          isFile: () => false,
          isDirectory: () => true,
        },
      ] as never)
      .mockRejectedValueOnce(cause);
    await expect(getLocalDirectorySize(uri)).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'io', cause },
    });
  },
);
