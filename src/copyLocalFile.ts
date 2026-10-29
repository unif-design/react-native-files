import { createLogger } from '@unif/react-native-logger';
import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import {
  getFileErrorCode,
  isMissingFileError,
  localFileAccess,
} from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import type {
  CopyLocalFileInput,
  CopyLocalFileResult,
  LocalFileFailed,
} from './types';

const activeTargetPaths = new Set<string>();
const logger = createLogger('files.localMedia');

function copyFailed(cause: unknown): LocalFileFailed {
  return localFileFailed('io', LOCAL_FILE_MESSAGES.copyFailed, { cause });
}

function logCleanupFailure(code: string | undefined) {
  logger.warn('local_media.copy_cleanup.failed', {
    phase: 'cleanup',
    outcome: 'failed',
    code: code ?? 'local_media.cleanup_failed',
  });
}

async function cleanupIncompleteTarget(targetPath: string) {
  let targetStat;
  try {
    targetStat = await localFileAccess.stat(targetPath);
  } catch (error) {
    if (!isMissingFileError(error)) logCleanupFailure(getFileErrorCode(error));
    return;
  }

  if (!targetStat.isFile()) {
    logCleanupFailure('local_media.cleanup_not_file');
    return;
  }

  try {
    await localFileAccess.unlink(targetPath);
  } catch (error) {
    logCleanupFailure(getFileErrorCode(error));
    return;
  }

  try {
    await localFileAccess.stat(targetPath);
    logCleanupFailure('local_media.cleanup_incomplete');
  } catch (error) {
    if (!isMissingFileError(error)) logCleanupFailure(getFileErrorCode(error));
  }
}

export async function copyLocalFile(
  input: CopyLocalFileInput,
): Promise<CopyLocalFileResult> {
  const sourceUri = input?.sourceUri;
  const targetUri = input?.targetUri;
  const source = parseLocalFileUri(sourceUri);
  const target = parseLocalFileUri(targetUri);
  if (!source || !target)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);
  if (source.path === target.path) {
    return localFileFailed(
      'invalid_input',
      LOCAL_FILE_MESSAGES.equivalentPaths,
    );
  }
  if (activeTargetPaths.has(target.path)) {
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.targetExists);
  }

  activeTargetPaths.add(target.path);
  try {
    let sourceStat;
    try {
      sourceStat = await localFileAccess.stat(source.path);
    } catch (error) {
      return copyFailed(error);
    }
    if (!sourceStat.isFile()) {
      return localFileFailed(
        'invalid_input',
        LOCAL_FILE_MESSAGES.sourceNotFile,
      );
    }

    try {
      await localFileAccess.stat(target.path);
      return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.targetExists);
    } catch (error) {
      if (!isMissingFileError(error)) return copyFailed(error);
    }

    try {
      if (target.parentPath !== '/') {
        await localFileAccess.mkdir(target.parentPath);
      }
    } catch (error) {
      return copyFailed(error);
    }

    try {
      await localFileAccess.copyFile(source.path, target.path);
      return { status: 'success', uri: targetUri };
    } catch (error) {
      await cleanupIncompleteTarget(target.path);
      return copyFailed(error);
    }
  } finally {
    activeTargetPaths.delete(target.path);
  }
}
