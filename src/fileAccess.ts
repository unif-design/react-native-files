import {
  copyFile,
  mkdir,
  readDir,
  readFile,
  writeFile,
  stat,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { LOCAL_FILE_MISSING_CODES } from './constants';

export const localFileAccess = {
  copyFile,
  mkdir,
  readDir,
  readFile,
  writeFile,
  stat,
  unlink,
};

export function getFileErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  const code = error.code;
  return typeof code === 'string' ? code : undefined;
}

export function isMissingFileError(error: unknown) {
  const code = getFileErrorCode(error);
  return code !== undefined && LOCAL_FILE_MISSING_CODES.includes(code);
}
