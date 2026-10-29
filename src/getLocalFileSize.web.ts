import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import type { LocalSizeResult } from './types';

export async function getLocalFileSize(
  _input: string,
): Promise<LocalSizeResult> {
  return localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported);
}
