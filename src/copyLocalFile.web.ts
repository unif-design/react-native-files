import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import type { CopyLocalFileInput, CopyLocalFileResult } from './types';

export async function copyLocalFile(
  _input: CopyLocalFileInput,
): Promise<CopyLocalFileResult> {
  return localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported);
}
