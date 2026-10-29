import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import type {
  DownloadLocalFileInput,
  DownloadLocalFileOptions,
  DownloadLocalFileResult,
} from './types';

export async function downloadLocalFile(
  _input: DownloadLocalFileInput,
  options?: DownloadLocalFileOptions,
): Promise<DownloadLocalFileResult> {
  if (options?.signal?.aborted) return { status: 'cancelled' };
  return localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported);
}
