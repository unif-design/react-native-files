import { URL } from 'react-native-url-polyfill';
import { downloadFile, stopDownload } from '@dr.pogodin/react-native-fs';
import { createLogger } from '@unif/react-native-logger';
import { LOCAL_FILE_MESSAGES } from './constants';
import { deleteLocalFile } from './deleteLocalFile';
import {
  getFileErrorCode,
  isMissingFileError,
  localFileAccess,
} from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import { getLocalFileSize } from './getLocalFileSize';
import { localFileFailed } from './localFileFailed';
import type {
  DownloadLocalFileInput,
  DownloadLocalFileOptions,
  DownloadLocalFileResult,
} from './types';

const activeTargetPaths = new Set<string>();
const logger = createLogger('files.download');

function validSourceUrl(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^https?:\/\//i.test(value) ||
    value.trim() !== value
  )
    return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !!parsed.hostname
    );
  } catch {
    return false;
  }
}

function validTimeout(value: number | undefined) {
  return value === undefined || (Number.isFinite(value) && value > 0);
}

function validBytes(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export async function downloadLocalFile(
  input: DownloadLocalFileInput,
  options?: DownloadLocalFileOptions,
): Promise<DownloadLocalFileResult> {
  const { signal, onProgress } = options ?? {};
  if (signal?.aborted) return { status: 'cancelled' };
  const {
    sourceUrl,
    targetUri,
    maxBytes,
    connectionTimeout,
    readTimeout,
    headers,
  } = input ?? {};
  const requestHeaders = headers ? { ...headers } : undefined;
  const target = parseLocalFileUri(targetUri);
  if (
    !target ||
    !validSourceUrl(sourceUrl) ||
    (maxBytes !== undefined && !validBytes(maxBytes)) ||
    !validTimeout(connectionTimeout) ||
    !validTimeout(readTimeout)
  ) {
    return localFileFailed(
      'invalid_input',
      LOCAL_FILE_MESSAGES.invalidDownload,
    );
  }
  if (activeTargetPaths.has(target.path)) {
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.targetExists);
  }
  activeTargetPaths.add(target.path);
  let ownsTarget = false;
  let jobId: number | undefined;
  let jobRunning = false;
  let stopped = false;
  let decision: DownloadLocalFileResult | undefined;

  function stop() {
    if (!jobRunning || jobId === undefined || stopped) return;
    stopped = true;
    try {
      stopDownload(jobId);
    } catch (cause) {
      logger.warn('files.download_stop.failed', {
        code: getFileErrorCode(cause) ?? 'download.stop_failed',
      });
    }
  }
  function cancel() {
    if (decision) return;
    decision = { status: 'cancelled' };
    stop();
  }
  function checkLimit(bytes: number) {
    if (
      decision ||
      maxBytes === undefined ||
      !validBytes(bytes) ||
      bytes <= maxBytes
    )
      return;
    decision = {
      status: 'failed',
      error: {
        reason: 'size_limit',
        message: LOCAL_FILE_MESSAGES.downloadSizeLimit,
      },
    };
    stop();
  }

  signal?.addEventListener('abort', cancel);
  try {
    try {
      await localFileAccess.stat(target.path);
      decision ??= localFileFailed(
        'invalid_input',
        LOCAL_FILE_MESSAGES.targetExists,
      );
      return decision;
    } catch (cause) {
      if (!isMissingFileError(cause)) throw cause;
    }
    ownsTarget = true;
    if (decision) return decision;
    if (target.parentPath !== '/')
      await localFileAccess.mkdir(target.parentPath);
    if (decision) return decision;

    jobRunning = true;
    const job = downloadFile({
      fromUrl: sourceUrl,
      toFile: target.path,
      ...(requestHeaders ? { headers: requestHeaders } : {}),
      ...(connectionTimeout === undefined ? {} : { connectionTimeout }),
      ...(readTimeout === undefined ? {} : { readTimeout }),
      begin: (event) => {
        if (jobRunning && !decision) checkLimit(event.contentLength);
      },
      progress: (event) => {
        if (!jobRunning || decision || !validBytes(event.bytesWritten)) return;
        checkLimit(event.bytesWritten);
        checkLimit(event.contentLength);
        if (decision) return;
        const totalBytes =
          validBytes(event.contentLength) &&
          event.contentLength >= event.bytesWritten
            ? event.contentLength
            : undefined;
        try {
          onProgress?.({
            bytesWritten: event.bytesWritten,
            ...(totalBytes === undefined ? {} : { totalBytes }),
          });
        } catch {
          /* An observer cannot change this transfer's result. */
        }
      },
    });
    jobId = job.jobId;
    if (decision) stop();
    const response = await job.promise;
    jobRunning = false;
    if (decision) return decision;
    const statusCode = response?.statusCode;
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      decision = localFileFailed('io', LOCAL_FILE_MESSAGES.downloadFailed);
    } else if (statusCode < 200 || statusCode >= 300) {
      decision = {
        status: 'failed',
        error: {
          reason: 'http',
          message: LOCAL_FILE_MESSAGES.downloadHttpFailed,
          statusCode,
        },
      };
    } else {
      const size = await getLocalFileSize(targetUri);
      if (!decision) {
        if (size.status === 'failed') {
          decision = localFileFailed('io', size.error.message, {
            cause: size.error.cause,
          });
        } else {
          checkLimit(size.sizeBytes);
          decision ??= {
            status: 'success',
            statusCode,
            uri: targetUri,
            sizeBytes: size.sizeBytes,
          };
        }
      }
    }
    return decision;
  } catch (cause) {
    decision ??= localFileFailed('io', LOCAL_FILE_MESSAGES.downloadFailed, {
      cause,
    });
    return decision;
  } finally {
    jobRunning = false;
    signal?.removeEventListener('abort', cancel);
    try {
      if (ownsTarget && decision?.status !== 'success') {
        const cleanup = await deleteLocalFile(targetUri);
        if (cleanup.status === 'failed') {
          logger.warn('files.download_cleanup.failed', {
            code:
              getFileErrorCode(cleanup.error.cause) ??
              'download.cleanup_failed',
            phase: 'cleanup',
            outcome: 'failed',
          });
        }
      }
    } finally {
      activeTargetPaths.delete(target.path);
    }
  }
}
