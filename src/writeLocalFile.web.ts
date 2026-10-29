import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import type { WriteLocalFileInput, WriteLocalFileResult } from './types';

export async function writeLocalFile(
  _input: WriteLocalFileInput,
): Promise<WriteLocalFileResult> {
  return localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported);
}
