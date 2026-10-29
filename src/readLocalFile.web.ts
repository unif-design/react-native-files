import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import type { ReadLocalFileInput, ReadLocalFileResult } from './types';

export async function readLocalFile(
  _input: ReadLocalFileInput,
): Promise<ReadLocalFileResult> {
  return localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported);
}
