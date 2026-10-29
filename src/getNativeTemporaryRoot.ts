import { Platform } from 'react-native';
import BlobUtil from 'react-native-blob-util';

export function getNativeTemporaryRoot(): string | undefined {
  const base =
    Platform.OS === 'ios'
      ? BlobUtil.fs.dirs.LibraryDir
      : Platform.OS === 'android'
        ? BlobUtil.fs.dirs.DocumentDir
        : undefined;
  if (
    typeof base !== 'string' ||
    !base.startsWith('/') ||
    base.replace(/\/+$/, '').length <= 1 ||
    Array.from(base).some((character) => character.charCodeAt(0) <= 31) ||
    base.split('/').some((part) => part === '.' || part === '..')
  )
    return undefined;
  return `file://${base.replace(/\/+$/, '').split('/').map(encodeURIComponent).join('/')}`;
}
