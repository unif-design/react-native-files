import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import type { DeleteLocalFileResult } from './types';

export async function deleteLocalFile(
  _uri: string,
): Promise<DeleteLocalFileResult> {
  return localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported);
}
