import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import type { ClearLocalDirectoryResult } from './types';

export async function clearLocalDirectory(
  _input: string,
): Promise<ClearLocalDirectoryResult> {
  return localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported);
}
