import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileAccess } from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import { localFileFailed } from './localFileFailed';
import type { LocalSizeResult } from './types';

export async function getLocalFileSize(uri: string): Promise<LocalSizeResult> {
  const location = parseLocalFileUri(uri);
  if (!location)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);
  try {
    const file = await localFileAccess.stat(location.path);
    if (!file.isFile())
      return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.sizeNotFile);
    if (!Number.isSafeInteger(file.size) || file.size < 0) {
      return localFileFailed('io', LOCAL_FILE_MESSAGES.invalidSize);
    }
    return { status: 'success', sizeBytes: file.size };
  } catch (cause) {
    return localFileFailed('io', LOCAL_FILE_MESSAGES.fileSizeFailed, { cause });
  }
}
