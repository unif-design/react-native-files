import { Platform } from 'react-native';
import BlobUtil from 'react-native-blob-util';
import { getNativeTemporaryRoot } from '../src/getNativeTemporaryRoot';

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {
      LibraryDir: '/app/Library %23#?中文/',
      DocumentDir: '/app/Documents',
    },
  },
}));

test('按原生平台选择根目录并且只编码一次', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const root = 'file:///app/Library%20%2523%23%3F%E4%B8%AD%E6%96%87';
  expect(getNativeTemporaryRoot()).toBe(root);
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(getNativeTemporaryRoot()).toBe('file:///app/Documents');
});

test.each(['', '/', '//', 'relative', '/app/../bad', '/app/./bad', '/app/\n'])(
  '无效根目录 %j 返回 undefined',
  (base) => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.replaceProperty(BlobUtil.fs.dirs, 'LibraryDir', base);
    expect(getNativeTemporaryRoot()).toBeUndefined();
  },
);

test('Web 不提供原生临时目录', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  expect(getNativeTemporaryRoot()).toBeUndefined();
});
