import type {
  LocalFileError,
  LocalFileErrorReason,
  LocalFileFailed,
} from './types';

export function localFileFailed(
  reason: LocalFileErrorReason,
  message: string,
  details?: Pick<LocalFileError, 'cause'>,
): LocalFileFailed {
  return { status: 'failed', error: { reason, message, ...details } };
}
