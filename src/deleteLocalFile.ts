import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import { isMissingFileError, localFileAccess } from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import type { DeleteLocalFileResult, LocalFileFailed } from './types';

function deleteFailed(cause: unknown): LocalFileFailed {
  return localFileFailed('io', LOCAL_FILE_MESSAGES.deleteFailed, { cause });
}

export async function deleteLocalFile(
  uri: string,
): Promise<DeleteLocalFileResult> {
  const location = parseLocalFileUri(uri);
  if (!location)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);

  let fileStat;
  try {
    fileStat = await localFileAccess.stat(location.path);
  } catch (error) {
    if (isMissingFileError(error)) return { status: 'success', deleted: false };
    return deleteFailed(error);
  }

  if (fileStat.isDirectory()) {
    return localFileFailed(
      'invalid_input',
      LOCAL_FILE_MESSAGES.deleteDirectory,
    );
  }
  if (!fileStat.isFile()) {
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.deleteNotFile);
  }

  try {
    await localFileAccess.unlink(location.path);
  } catch (error) {
    if (isMissingFileError(error)) return { status: 'success', deleted: false };
    try {
      await localFileAccess.stat(location.path);
    } catch (statError) {
      if (isMissingFileError(statError)) {
        return { status: 'success', deleted: false };
      }
    }
    return deleteFailed(error);
  }

  try {
    await localFileAccess.stat(location.path);
    return deleteFailed(new Error('删除操作完成后文件仍存在。'));
  } catch (error) {
    if (isMissingFileError(error)) return { status: 'success', deleted: true };
    return deleteFailed(error);
  }
}
