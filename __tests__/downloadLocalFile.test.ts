import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ReactNativeFs from '@dr.pogodin/react-native-fs';
import type {
  DownloadFileOptionsT,
  DownloadResultT,
} from '@dr.pogodin/react-native-fs';
import { downloadLocalFile } from '../src';
import { createFileIoMock } from './fileIoFixture';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  ...require('./fileIoFixture').createFileIoMock(),
  downloadFile: jest.fn(),
  stopDownload: jest.fn(),
}));
jest.mock('@unif/react-native-logger', () => ({
  createLogger: () => ({ warn: jest.fn() }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let directory: string;
let target: string;
let targetUri: string;
let nextJobId: number;
const sourceUrl = 'https://example.invalid/a%20b?signature=A%2Fb+z&x=1';

function transfer() {
  const jobId = ++nextJobId;
  const ended = deferred<DownloadResultT>();
  const started = deferred<DownloadFileOptionsT>();
  jest.mocked(ReactNativeFs.downloadFile).mockImplementationOnce((options) => {
    started.resolve(options);
    return { jobId, promise: ended.promise };
  });
  return { ...ended, jobId, started: started.promise };
}

async function finish(
  job: ReturnType<typeof transfer>,
  statusCode = 200,
  content = 'abc',
) {
  const options = await job.started;
  await fs.writeFile(options.toFile, content);
  job.resolve({ jobId: job.jobId, statusCode, bytesWritten: 999 });
}

beforeEach(async () => {
  nextJobId = 40;
  directory = await fs.mkdtemp(join(tmpdir(), 'portal-download-'));
  target = join(directory, 'nested', 'file.bin');
  targetUri = pathToFileURL(target).href;
  const io = createFileIoMock();
  for (const name of ['stat', 'mkdir', 'unlink'] as const) {
    jest.mocked(ReactNativeFs[name]).mockImplementation(io[name] as never);
  }
  jest.mocked(ReactNativeFs.downloadFile).mockReset();
  jest.mocked(ReactNativeFs.stopDownload).mockReset();
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

test('授权下载固定请求头，不将凭据写入目标URI或被后续对象修改改变', async () => {
  const job = transfer();
  const headers = { Authorization: 'Bearer original' };
  const pending = downloadLocalFile({ sourceUrl, targetUri, headers });
  headers.Authorization = 'Bearer changed';
  const options = await job.started;
  expect(options.headers).toEqual({ Authorization: 'Bearer original' });
  expect(options.toFile).toBe(target);
  expect(options.fromUrl).toBe(sourceUrl);
  await finish(job);
  expect((await pending).status).toBe('success');
});

test.each([
  [200, 'abc'],
  [206, ''],
  [204, ''],
])('HTTP %s 成功采用真实落地大小', async (statusCode, content) => {
  const job = transfer();
  const result = downloadLocalFile({ sourceUrl, targetUri });
  await finish(job, statusCode as number, content as string);
  await expect(result).resolves.toEqual({
    status: 'success',
    statusCode,
    uri: targetUri,
    sizeBytes: Buffer.byteLength(content as string),
  });
  expect(ReactNativeFs.downloadFile).toHaveBeenCalledTimes(1);
  expect(await fs.readFile(target, 'utf8')).toBe(content);
});

test.each([301, 404, 500])(
  '非 2xx %s 返回真实 HTTP 状态并清理产物',
  async (statusCode) => {
    const job = transfer();
    const result = downloadLocalFile({ sourceUrl, targetUri });
    await finish(job, statusCode);
    await expect(result).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'http', statusCode },
    });
    await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

test.each([undefined, 0, NaN, 200.5, 600])(
  '无效状态 %s 不能补成功',
  async (statusCode) => {
    const job = transfer();
    const result = downloadLocalFile({ sourceUrl, targetUri });
    await job.started;
    job.resolve({ jobId: 41, statusCode, bytesWritten: 0 } as DownloadResultT);
    await expect(result).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'io' },
    });
  },
);

test('原本已有目标不会覆盖或删除', async () => {
  await fs.mkdir(join(directory, 'nested'));
  await fs.writeFile(target, 'original');
  await expect(
    downloadLocalFile({ sourceUrl, targetUri }),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.downloadFile).not.toHaveBeenCalled();
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
  expect(await fs.readFile(target, 'utf8')).toBe('original');
});

test('网络失败保留 cause 并清理真实半成品', async () => {
  const cause = new Error('synthetic network');
  const job = transfer();
  const result = downloadLocalFile({ sourceUrl, targetUri });
  await job.started;
  await fs.writeFile(target, 'partial');
  job.reject(cause);
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io', cause },
  });
  await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('前置取消不进行任何文件或网络 I/O', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    downloadLocalFile({ sourceUrl, targetUri }, { signal: controller.signal }),
  ).resolves.toEqual({ status: 'cancelled' });
  expect(ReactNativeFs.stat).not.toHaveBeenCalled();
  expect(ReactNativeFs.mkdir).not.toHaveBeenCalled();
  expect(ReactNativeFs.downloadFile).not.toHaveBeenCalled();
});

test('目录准备中取消不启动下载', async () => {
  const gate = deferred<void>();
  const entered = deferred<void>();
  jest.mocked(ReactNativeFs.mkdir).mockImplementationOnce(async () => {
    entered.resolve();
    await gate.promise;
  });
  const controller = new AbortController();
  const result = downloadLocalFile(
    { sourceUrl, targetUri },
    { signal: controller.signal },
  );
  await entered.promise;
  controller.abort();
  gate.resolve();
  await expect(result).resolves.toEqual({ status: 'cancelled' });
  expect(ReactNativeFs.downloadFile).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'] as const)(
  '取消等真实 %s 后清理，不能在停止请求时先删除',
  async (ending) => {
    const job = transfer();
    const controller = new AbortController();
    const result = downloadLocalFile(
      { sourceUrl, targetUri },
      { signal: controller.signal },
    );
    await job.started;
    await fs.writeFile(target, 'partial');
    controller.abort();
    expect(ReactNativeFs.stopDownload).toHaveBeenCalledWith(41);
    expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
    expect(await fs.readFile(target, 'utf8')).toBe('partial');
    if (ending === 'resolve') await finish(job);
    else job.reject(new Error('late rejection'));
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

test.each(['resolve', 'reject'] as const)(
  '超过声明长度后 %s 均返回 size_limit 并清理',
  async (ending) => {
    const job = transfer();
    const controller = new AbortController();
    const result = downloadLocalFile(
      { sourceUrl, targetUri, maxBytes: 2 },
      { signal: controller.signal },
    );
    const options = await job.started;
    options.begin?.({
      jobId: 41,
      statusCode: 200,
      contentLength: 3,
      headers: {},
    });
    controller.abort();
    expect(ReactNativeFs.stopDownload).toHaveBeenCalledTimes(1);
    await fs.writeFile(target, 'abc');
    if (ending === 'resolve')
      job.resolve({ jobId: 41, statusCode: 200, bytesWritten: 3 });
    else job.reject(new Error('stopped'));
    await expect(result).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'size_limit' },
    });
    await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

test('进度写入超限，未知总长也停止', async () => {
  const job = transfer();
  const result = downloadLocalFile({ sourceUrl, targetUri, maxBytes: 2 });
  const options = await job.started;
  options.progress?.({ jobId: 41, bytesWritten: 3, contentLength: -1 });
  expect(ReactNativeFs.stopDownload).toHaveBeenCalledWith(41);
  await finish(job);
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'size_limit' },
  });
});

test('最终真实大小再次检查，声明和进度不能代替', async () => {
  const job = transfer();
  const result = downloadLocalFile({ sourceUrl, targetUri, maxBytes: 0 });
  await finish(job);
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'size_limit' },
  });
  await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('成功回调但文件未落地返回 io', async () => {
  const job = transfer();
  const result = downloadLocalFile({ sourceUrl, targetUri });
  await job.started;
  job.resolve({ jobId: 41, statusCode: 200, bytesWritten: 0 });
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
});

test.each([NaN, -1, Infinity, undefined, '3'])(
  '真实大小不可用 %s 不交付成功',
  async (size) => {
    const job = transfer();
    const result = downloadLocalFile({ sourceUrl, targetUri });
    await job.started;
    jest
      .mocked(ReactNativeFs.stat)
      .mockResolvedValueOnce({ isFile: () => true, size } as never);
    job.resolve({ jobId: 41, statusCode: 200, bytesWritten: 3 });
    await expect(result).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'io' },
    });
  },
);

test('落地检查期间取消仍清理，成功交付后取消不会删除', async () => {
  const job = transfer();
  const controller = new AbortController();
  const result = downloadLocalFile(
    { sourceUrl, targetUri },
    { signal: controller.signal },
  );
  await job.started;
  const stat = deferred<Awaited<ReturnType<typeof ReactNativeFs.stat>>>();
  const entered = deferred<void>();
  jest.mocked(ReactNativeFs.stat).mockImplementationOnce(() => {
    entered.resolve();
    return stat.promise;
  });
  await finish(job);
  await entered.promise;
  controller.abort();
  stat.resolve((await fs.stat(target)) as never);
  await expect(result).resolves.toEqual({ status: 'cancelled' });
  await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  const next = transfer();
  const nextController = new AbortController();
  const success = downloadLocalFile(
    { sourceUrl, targetUri },
    { signal: nextController.signal },
  );
  await finish(next);
  await success;
  nextController.abort();
  expect(await fs.readFile(target, 'utf8')).toBe('abc');
});

test('输入快照保留签名地址与超时，只接一次 SDK 且无后台恢复', async () => {
  const job = transfer();
  const input = {
    sourceUrl,
    targetUri,
    connectionTimeout: 3000,
    readTimeout: 4000,
    maxBytes: 3,
  };
  const result = downloadLocalFile(input);
  Object.assign(input, {
    sourceUrl: 'https://different.invalid',
    targetUri: 'file:///different',
    readTimeout: 1,
    maxBytes: 0,
  });
  const options = await job.started;
  expect(options).toMatchObject({
    fromUrl: sourceUrl,
    toFile: target,
    connectionTimeout: 3000,
    readTimeout: 4000,
  });
  expect(options.background).toBeFalsy();
  expect(options.resumable).toBeUndefined();
  await finish(job);
  await expect(result).resolves.toMatchObject({
    status: 'success',
    uri: targetUri,
  });
});

test('有效进度映射，观察者异常和晚进度不改结果', async () => {
  const job = transfer();
  const onProgress = jest.fn(() => {
    throw new Error('observer');
  });
  const result = downloadLocalFile({ sourceUrl, targetUri }, { onProgress });
  const options = await job.started;
  options.progress?.({ jobId: 41, bytesWritten: NaN, contentLength: 10 });
  options.progress?.({ jobId: 41, bytesWritten: 1, contentLength: -1 });
  options.progress?.({ jobId: 41, bytesWritten: 2, contentLength: 1 });
  options.progress?.({ jobId: 41, bytesWritten: 3, contentLength: 3 });
  expect(onProgress.mock.calls).toEqual([
    [{ bytesWritten: 1 }],
    [{ bytesWritten: 2 }],
    [{ bytesWritten: 3, totalBytes: 3 }],
  ]);
  await finish(job);
  await expect(result).resolves.toMatchObject({ status: 'success' });
  options.progress?.({ jobId: 41, bytesWritten: 4, contentLength: 4 });
  expect(onProgress).toHaveBeenCalledTimes(3);
});

test('规范化同目标独占，旧回调不干扰新目标', async () => {
  const first = transfer();
  const firstController = new AbortController();
  const oldResult = downloadLocalFile(
    { sourceUrl, targetUri },
    { signal: firstController.signal },
  );
  const oldOptions = await first.started;
  await expect(
    downloadLocalFile({
      sourceUrl,
      targetUri: targetUri.replace('/file.bin', '/./file.bin'),
    }),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  const next = transfer();
  const nextUri = pathToFileURL(join(directory, 'next.bin')).href;
  const onProgress = jest.fn();
  const nextResult = downloadLocalFile(
    { sourceUrl, targetUri: nextUri },
    { onProgress },
  );
  await next.started;
  firstController.abort();
  first.reject(new Error('stopped'));
  await oldResult;
  oldOptions.progress?.({ jobId: 41, bytesWritten: 999, contentLength: 999 });
  expect(onProgress).not.toHaveBeenCalled();
  await finish(next);
  await expect(nextResult).resolves.toMatchObject({
    status: 'success',
    uri: nextUri,
  });
  expect(ReactNativeFs.unlink).not.toHaveBeenCalledWith(
    join(directory, 'next.bin'),
  );
});

test.each([
  { sourceUrl: 'ftp://host/a' },
  { sourceUrl: 'not-url' },
  { sourceUrl: 'https://' },
  { targetUri: '/tmp/a' },
  { maxBytes: -1 },
  { maxBytes: 0.5 },
  { maxBytes: Infinity },
  { connectionTimeout: 0 },
  { readTimeout: NaN },
])('输入无效零 I/O %#', async (overrides) => {
  await expect(
    downloadLocalFile({ sourceUrl, targetUri, ...overrides }),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(ReactNativeFs.stat).not.toHaveBeenCalled();
  expect(ReactNativeFs.downloadFile).not.toHaveBeenCalled();
});

test('目标检查期间取消且目标原本存在，不删除已有文件', async () => {
  const gate = deferred<Awaited<ReturnType<typeof ReactNativeFs.stat>>>();
  const entered = deferred<void>();
  const controller = new AbortController();
  await fs.mkdir(join(directory, 'nested'));
  await fs.writeFile(target, 'original');
  jest.mocked(ReactNativeFs.stat).mockImplementationOnce(() => {
    entered.resolve();
    return gate.promise;
  });
  const result = downloadLocalFile(
    { sourceUrl, targetUri },
    { signal: controller.signal },
  );
  await entered.promise;
  controller.abort();
  gate.resolve((await fs.stat(target)) as never);
  await expect(result).resolves.toEqual({ status: 'cancelled' });
  expect(await fs.readFile(target, 'utf8')).toBe('original');
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('下载结束落地是目录时失败，不能递归删除目录', async () => {
  const job = transfer();
  const result = downloadLocalFile({ sourceUrl, targetUri });
  await job.started;
  await fs.mkdir(target);
  job.resolve({ jobId: 41, statusCode: 200, bytesWritten: 0 });
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
  expect((await fs.stat(target)).isDirectory()).toBe(true);
  expect(ReactNativeFs.unlink).not.toHaveBeenCalled();
});

test('清理失败不覆盖原网络失败，不把残留当成成功', async () => {
  const job = transfer();
  const cause = new Error('network');
  const result = downloadLocalFile({ sourceUrl, targetUri });
  await job.started;
  await fs.writeFile(target, 'partial');
  jest
    .mocked(ReactNativeFs.unlink)
    .mockRejectedValueOnce(
      Object.assign(new Error('cleanup'), { code: 'EACCES' }),
    );
  job.reject(cause);
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io', cause },
  });
  expect(await fs.readFile(target, 'utf8')).toBe('partial');
});

test('清理期间后来取消不改写已经决定的 HTTP 失败', async () => {
  const job = transfer();
  const controller = new AbortController();
  const result = downloadLocalFile(
    { sourceUrl, targetUri },
    { signal: controller.signal },
  );
  const cleanup = deferred<void>();
  const entered = deferred<void>();
  jest.mocked(ReactNativeFs.unlink).mockImplementationOnce(async (path) => {
    entered.resolve();
    await cleanup.promise;
    await fs.unlink(path);
  });
  await finish(job, 404);
  await entered.promise;
  controller.abort();
  cleanup.resolve();
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'http', statusCode: 404 },
  });
  expect(ReactNativeFs.stopDownload).not.toHaveBeenCalled();
});

test('真实 RN URL 全局环境仍接受大写 HTTPS，下载 SDK 收到完整原签名串', async () => {
  const previous = global.URL;
  const NativeURL = jest.requireActual('react-native/Libraries/Blob/URL').URL;
  const source = 'HTTPS://example.invalid/A%2fb?signature=A%2Fb+Z&x=1#Part';
  expect(new NativeURL(source).protocol).toBe('HTTPS:');
  global.URL = NativeURL;
  try {
    const job = transfer();
    const result = downloadLocalFile({
      sourceUrl: source,
      targetUri,
    });
    // Race the public result against the SDK handoff so an invalid-input regression fails without hanging.
    const first = await Promise.race([job.started, result]);
    expect(first).toMatchObject({ fromUrl: source });
    await finish(job);
    await expect(result).resolves.toMatchObject({ status: 'success' });
    expect(global.URL).toBe(NativeURL);
  } finally {
    global.URL = previous;
  }
});
