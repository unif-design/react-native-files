function loadWebFactory() {
  jest.resetModules();
  jest.doMock('@dr.pogodin/react-native-static-server', () => {
    throw new Error('Web 不能加载原生 HTTP 服务 SDK');
  });
  jest.doMock('@dr.pogodin/react-native-fs', () => {
    throw new Error('Web 不能加载原生文件 SDK');
  });
  const {
    createLocalResourceAccess,
  } = require('../src/createLocalResourceAccess.web');
  return createLocalResourceAccess as typeof import('../src/createLocalResourceAccess.web').createLocalResourceAccess;
}

test('Web 本地资源入口不加载原生 SDK，有效请求明确 unsupported，输入检查仍生效', async () => {
  const createLocalResourceAccess = loadWebFactory();
  expect(() => createLocalResourceAccess({ rootUri: '/invalid' })).toThrow();
  const access = createLocalResourceAccess({
    rootUri: 'file:///fixture/public',
  });
  await expect(
    access.getUrl('file:///fixture/public/a'),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  await expect(access.getUrl('/invalid')).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  await expect(
    access.getUrl('file:///fixture/private/a'),
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'outside_root' },
  });
  const close = access.close();
  expect(access.close()).toBe(close);
  await expect(close).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  await expect(
    access.getUrl('file:///fixture/public/a'),
  ).resolves.toMatchObject({ status: 'failed' });
});

test.each([
  'file:///fixture/a%5Cb',
  'file:///fixture/a%0Ab',
  'file:///fixture/a%0Db',
  'file:///fixture/😀',
])('Web 对安全根 %s 保持与原生一致的配置输入范围', async (rootUri) => {
  const createLocalResourceAccess = loadWebFactory();
  const access = createLocalResourceAccess({ rootUri });
  await expect(access.getUrl(`${rootUri}/child`)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
});

test.each([
  'file:///fixture/a%22b',
  'file:///fixture/a%5C',
  'file:///fixture/\ud800',
  'file:///fixture/\udc00',
])('Web 对不可安全表达或无法编码的根 %s 在创建时拒绝', (rootUri) => {
  const createLocalResourceAccess = loadWebFactory();
  expect(() => createLocalResourceAccess({ rootUri })).toThrow();
});
