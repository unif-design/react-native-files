import { LOCAL_FILE_MESSAGES } from './constants';
import { isMissingFileError, localFileAccess } from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import { localFileFailed } from './localFileFailed';
import type { LocalSizeResult } from './types';

export async function getLocalDirectorySize(
  uri: string,
): Promise<LocalSizeResult> {
  const location = parseLocalFileUri(uri);
  if (!location)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);

  let root;
  try {
    root = await localFileAccess.stat(location.path);
  } catch (cause) {
    if (isMissingFileError(cause)) return { status: 'success', sizeBytes: 0 };
    return localFileFailed('io', LOCAL_FILE_MESSAGES.directorySizeFailed, {
      cause,
    });
  }
  if (!root.isDirectory()) {
    return localFileFailed(
      'invalid_input',
      LOCAL_FILE_MESSAGES.rootNotDirectory,
    );
  }

  let sizeBytes = 0;
  const directories = [location.path];
  try {
    for (let index = 0; index < directories.length; index += 1) {
      const entries = await localFileAccess.readDir(directories[index]);
      for (const entry of entries) {
        if (entry.isDirectory()) {
          directories.push(entry.path);
        } else if (entry.isFile()) {
          if (
            !Number.isSafeInteger(entry.size) ||
            entry.size < 0 ||
            !Number.isSafeInteger(sizeBytes + entry.size)
          ) {
            return localFileFailed('io', LOCAL_FILE_MESSAGES.invalidSize);
          }
          sizeBytes += entry.size;
        }
      }
    }
    return { status: 'success', sizeBytes };
  } catch (cause) {
    return localFileFailed('io', LOCAL_FILE_MESSAGES.directorySizeFailed, {
      cause,
    });
  }
}
