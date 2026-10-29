import { AppState, TurboModuleRegistry } from 'react-native';
import * as fs from '@dr.pogodin/react-native-fs';
import StaticServer, {
  getActiveServer,
  STATES,
} from '@dr.pogodin/react-native-static-server';
import * as files from '../src';

const native = TurboModuleRegistry.getEnforcing(
  'ReactNativeStaticServer',
) as unknown as {
  start: jest.Mock;
  stop: jest.Mock;
  getOpenPort: jest.Mock;
  getLocalIpAddress: jest.Mock;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

let accesses: ReturnType<typeof files.createLocalResourceAccess>[];
beforeEach(() => {
  accesses = [];
  native.start.mockReset().mockResolvedValue('');
  native.stop.mockReset().mockResolvedValue('');
  native.getOpenPort.mockReset().mockResolvedValue(43821);
  jest.mocked(fs.mkdir).mockResolvedValue(undefined);
  jest.mocked(fs.writeFile).mockResolvedValue(undefined);
  jest.mocked(fs.unlink).mockResolvedValue(undefined);
});
afterEach(async () => {
  await Promise.all(accesses.map((access) => access.close()));
});

function create(rootUri = 'file:///fixture/public') {
  const access = files.createLocalResourceAccess({ rootUri });
  accesses.push(access);
  return access;
}

test('创建不启动，非法配置同步拒绝且不访问原生', () => {
  expect(typeof files.createLocalResourceAccess).toBe('function');
  create();
  for (const rootUri of [
    '',
    '/tmp',
    'https://host/root',
    'file:///bad%zz',
    'file:///a?b',
  ]) {
    expect(() => create(rootUri)).toThrow();
  }
  expect(native.start).not.toHaveBeenCalled();
  expect(native.getOpenPort).not.toHaveBeenCalled();
});

test.each([
  'file:///fixture/public-other/a.jpg',
  'file:///elsewhere/public/a.jpg',
  'file:///fixture/public/../private/a.jpg',
  'file:///elsewhere/a.jpg',
])('根外路径 %s 不启动服务', async (uri) => {
  await expect(create().getUrl(uri)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'outside_root' },
  });
  expect(native.start).not.toHaveBeenCalled();
  expect(native.getOpenPort).not.toHaveBeenCalled();
});

test('无效文件引用不启动服务', async () => {
  await expect(create().getUrl('file:///bad%zz')).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(native.start).not.toHaveBeenCalled();
});

test('无法编码的文件引用返回 invalid_input，不 reject 或启动服务', async () => {
  await expect(
    create().getUrl('file:///fixture/public/\ud800'),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(native.start).not.toHaveBeenCalled();
});

test('根包含空格中文百分号保留字符时保持真实位置，普通文件名不受根配置限制', async () => {
  const access = create('file:///fixture/中文%20%25%23%3F');
  await expect(
    access.getUrl('file:///fixture/中文%20%25%23%3F/a%22%5C%0A.jpg'),
  ).resolves.toEqual({
    status: 'success',
    url: 'http://127.0.0.1:43821/a%22%5C%0A.jpg',
  });
  expect(jest.mocked(fs.writeFile).mock.calls[0][1]).toContain(
    'server.document-root = "/fixture/中文 %#?"',
  );
  await expect(
    access.getUrl('file:///fixture/中文%20%25%23%3F-other/a'),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'outside_root' },
  });
});

test('显式根目录自身以及文件系统根按规范化相对路径映射', async () => {
  const access = create('file:///');
  await expect(access.getUrl('file:///')).resolves.toEqual({
    status: 'success',
    url: 'http://127.0.0.1:43821/',
  });
  await expect(access.getUrl('file:///fixture//sub/../a')).resolves.toEqual({
    status: 'success',
    url: 'http://127.0.0.1:43821/fixture/a',
  });
});

test.each(['file:///fixture/a%22b', 'file:///fixture/a%5C'])(
  '不能安全传给 SDK 配置的根 %s 在创建阶段报错',
  (rootUri) => {
    expect(() => create(rootUri)).toThrow();
    expect(native.start).not.toHaveBeenCalled();
  },
);

test.each([
  ['file:///fixture/a%5Cb', '/fixture/a\\b'],
  ['file:///fixture/a%0Ab', '/fixture/a\nb'],
  ['file:///fixture/a%0Db', '/fixture/a\rb'],
  ['file:///fixture/😀', '/fixture/😀'],
])(
  'SDK 可以原样表示的根 %s 保持真实配置和 URL 映射',
  async (rootUri, rootPath) => {
    const access = create(rootUri);
    await expect(access.getUrl(`${rootUri}/child%20name`)).resolves.toEqual({
      status: 'success',
      url: 'http://127.0.0.1:43821/child%20name',
    });
    expect(jest.mocked(fs.writeFile).mock.calls[0][1]).toContain(
      `server.document-root = "${rootPath}"`,
    );
    expect(native.start).toHaveBeenCalledTimes(1);
  },
);

test.each(['file:///fixture/\ud800', 'file:///fixture/\udc00'])(
  '根自身包含无法编码的代理字符 %s 时在创建阶段报错',
  (rootUri) => {
    expect(() => create(rootUri)).toThrow();
    expect(native.start).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  },
);

test('并发合法请求等到同一次启动就绪再分别交付链接', async () => {
  const starting = deferred<void>();
  const ready = deferred<string>();
  native.start.mockImplementationOnce(() => {
    starting.resolve();
    return ready.promise;
  });
  const access = create();
  const first = access.getUrl('file:///fixture/public/a');
  const second = access.getUrl('file:///fixture/public/b');
  let resolved = false;
  const observedFirst = first.then(() => {
    resolved = true;
  });
  await starting.promise;
  expect(resolved).toBe(false);
  ready.resolve('');
  await expect(Promise.all([first, second])).resolves.toEqual([
    { status: 'success', url: 'http://127.0.0.1:43821/a' },
    { status: 'success', url: 'http://127.0.0.1:43821/b' },
  ]);
  await observedFirst;
  expect(native.start).toHaveBeenCalledTimes(1);
});

test('已有本对象实例失活后出现外部实例，获取及关闭不能影响外部对象', async () => {
  const access = create();
  await access.getUrl('file:///fixture/public/a');
  await getActiveServer()!.stop();
  const external = new StaticServer({ fileDir: '/other', id: 56002 });
  await external.start();
  await expect(
    access.getUrl('file:///fixture/public/a'),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  const close = access.close();
  await expect(close).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
  expect(access.close()).toBe(close);
  expect(native.start).toHaveBeenCalledTimes(2);
  expect(native.stop).toHaveBeenCalledTimes(1);
  expect(getActiveServer()).toBe(external);
  expect(external.state).toBe(STATES.ACTIVE);
  await external.stop();
});

test('按值取得根配置，原样指向编码文件并复用已启动服务', async () => {
  const input = { rootUri: 'file:///fixture/public/./' };
  const access = files.createLocalResourceAccess(input);
  accesses.push(access);
  input.rootUri = 'file:///elsewhere';
  const appState = jest.spyOn(AppState, 'addEventListener');
  await expect(
    access.getUrl('file:///fixture/public/sub/../中文%20%25%23%3F.jpg'),
  ).resolves.toEqual({
    status: 'success',
    url: 'http://127.0.0.1:43821/%E4%B8%AD%E6%96%87%20%25%23%3F.jpg',
  });
  await expect(
    access.getUrl('file:///fixture/public/nested/a.jpg'),
  ).resolves.toEqual({
    status: 'success',
    url: 'http://127.0.0.1:43821/nested/a.jpg',
  });
  expect(native.start).toHaveBeenCalledTimes(1);
  expect(native.getOpenPort).toHaveBeenCalledWith('127.0.0.1');
  expect(native.getLocalIpAddress).not.toHaveBeenCalled();
  expect(getActiveServer()?.state).toBe(STATES.ACTIVE);
  expect(appState).not.toHaveBeenCalled();
  const config = jest.mocked(fs.writeFile).mock.calls[0][1];
  expect(config).toContain('server.document-root = "/fixture/public"');
  expect(config).toContain('server.bind = "127.0.0.1"');
  expect(config).not.toContain('mod_webdav');
  expect(fs.stat).not.toHaveBeenCalled();
  expect(fs.readFile).not.toHaveBeenCalled();
});

test('并发获取等待同一次真实启动，启动失败不隐式重试，显式调用可再试', async () => {
  const started = deferred<void>();
  const ready = deferred<string>();
  native.start.mockImplementationOnce(() => {
    started.resolve();
    return ready.promise;
  });
  const access = create();
  const first = access.getUrl('file:///fixture/public/a');
  const second = access.getUrl('file:///fixture/public/b');
  await started.promise;
  expect(getActiveServer()?.state).toBe(STATES.STARTING);
  ready.reject(new Error('start failed'));
  await expect(first).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
  await expect(second).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io' },
  });
  expect(native.start).toHaveBeenCalledTimes(1);
  await expect(access.getUrl('file:///fixture/public/a')).resolves.toEqual({
    status: 'success',
    url: 'http://127.0.0.1:43821/a',
  });
  expect(native.start).toHaveBeenCalledTimes(2);
});

test('启动中关闭使全部排队请求失败，等待真实停止，重复关闭共享结果', async () => {
  const starting = deferred<void>();
  const ready = deferred<string>();
  const stopping = deferred<void>();
  const stopped = deferred<string>();
  native.start.mockImplementationOnce(() => {
    starting.resolve();
    return ready.promise;
  });
  native.stop.mockImplementationOnce(() => {
    stopping.resolve();
    return stopped.promise;
  });
  const access = create();
  const pending = [
    access.getUrl('file:///fixture/public/a'),
    access.getUrl('file:///fixture/public/b'),
  ];
  await starting.promise;
  const close = access.close();
  expect(access.close()).toBe(close);
  let closed = false;
  const observedClose = close.then(() => {
    closed = true;
  });
  ready.resolve('');
  await stopping.promise;
  expect(closed).toBe(false);
  expect(getActiveServer()?.state).toBe(STATES.STOPPING);
  for (const request of pending)
    await expect(request).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'io' },
    });
  stopped.resolve('');
  await expect(close).resolves.toEqual({ status: 'success' });
  await observedClose;
  expect(access.close()).toBe(close);
  await expect(
    access.getUrl('file:///fixture/public/a'),
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
  expect(native.start).toHaveBeenCalledTimes(1);
  expect(native.stop).toHaveBeenCalledTimes(1);
  expect(getActiveServer()).toBeUndefined();
});

test('启动失败时关闭仍结束对象且不报告 URL', async () => {
  const starting = deferred<void>();
  const ready = deferred<string>();
  native.start.mockImplementationOnce(() => {
    starting.resolve();
    return ready.promise;
  });
  const access = create();
  const request = access.getUrl('file:///fixture/public/a');
  await starting.promise;
  const close = access.close();
  ready.reject(new Error('failed'));
  await expect(request).resolves.toMatchObject({ status: 'failed' });
  await expect(close).resolves.toEqual({ status: 'success' });
  expect(native.stop).not.toHaveBeenCalled();
  await expect(
    access.getUrl('file:///fixture/public/a'),
  ).resolves.toMatchObject({ status: 'failed' });
});

test('停止失败保留失败，重复关闭不伪造成功或再停服务', async () => {
  const access = create();
  await access.getUrl('file:///fixture/public/a');
  const cause = new Error('stop failed');
  native.stop.mockRejectedValueOnce(cause);
  const close = access.close();
  await expect(close).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'io', cause },
  });
  expect(access.close()).toBe(close);
  await expect(access.close()).resolves.toMatchObject({ status: 'failed' });
  await expect(
    access.getUrl('file:///fixture/public/a'),
  ).resolves.toMatchObject({ status: 'failed' });
  expect(native.stop).toHaveBeenCalledTimes(1);
});

test('未启动对象关闭不触发原生停止', async () => {
  await expect(create().close()).resolves.toEqual({ status: 'success' });
  expect(native.stop).not.toHaveBeenCalled();
});

test.each(['active', 'starting', 'stopping'])(
  '外部 SDK 对象 %s 时不接管、不停止',
  async (phase) => {
    const external = new StaticServer({ fileDir: '/other', id: 56001 });
    const entered = deferred<void>();
    const release = deferred<string>();
    if (phase === 'starting')
      native.start.mockImplementationOnce(() => {
        entered.resolve();
        return release.promise;
      });
    const start = external.start();
    if (phase === 'starting') await entered.promise;
    else await start;
    let stop: Promise<void> | undefined;
    if (phase === 'stopping') {
      native.stop.mockImplementationOnce(() => {
        entered.resolve();
        return release.promise;
      });
      stop = external.stop();
      await entered.promise;
    }
    const starts = native.start.mock.calls.length;
    const stops = native.stop.mock.calls.length;
    const access = create();
    await expect(
      access.getUrl('file:///fixture/public/a'),
    ).resolves.toMatchObject({ status: 'failed', error: { reason: 'io' } });
    await expect(access.close()).resolves.toEqual({ status: 'success' });
    expect(native.start).toHaveBeenCalledTimes(starts);
    expect(native.stop).toHaveBeenCalledTimes(stops);
    expect(getActiveServer()).toBe(external);
    release.resolve('');
    await start;
    if (stop) await stop;
    else await external.stop();
  },
);
