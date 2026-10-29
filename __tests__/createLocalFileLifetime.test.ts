import { createLocalFileLifetime } from '../src/createLocalFileLifetime';

test('业务退休后仍等待读取和多个预览，独立持有恰好释放一次', () => {
  const cleanup = jest.fn();
  const file = createLocalFileLifetime(cleanup);
  const reading = file.retain()!;
  const firstPreview = file.retain()!;
  const secondPreview = file.retain()!;
  file.retire();
  file.retire();
  reading();
  reading();
  firstPreview();
  firstPreview();
  expect(cleanup).not.toHaveBeenCalled();
  secondPreview();
  secondPreview();
  file.retire();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(file.retain()).toBeUndefined();
});

test('持有结束不替代业务退休，旧读取回调不能解除新读取', () => {
  const cleanup = jest.fn();
  const file = createLocalFileLifetime(cleanup);
  const oldRead = file.retain()!;
  oldRead();
  expect(cleanup).not.toHaveBeenCalled();
  const currentRead = file.retain()!;
  file.retire();
  oldRead();
  expect(cleanup).not.toHaveBeenCalled();
  currentRead();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test('尚未实际删除的退休文件仍可交接持有，删除后拒绝新持有', () => {
  const cleanup = jest.fn();
  const file = createLocalFileLifetime(cleanup);
  const reading = file.retain()!;
  file.retire();
  const preview = file.retain()!;
  reading();
  expect(cleanup).not.toHaveBeenCalled();
  preview();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(file.retain()).toBeUndefined();
});

test('无持有立即退休，清理回调重入也不会再次清理', () => {
  const cleanup = jest.fn(() => {
    file.retire();
    expect(file.retain()).toBeUndefined();
  });
  const file = createLocalFileLifetime(cleanup);
  file.retire();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
