import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileAccess } from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import { localFileFailed } from './localFileFailed';
import type { ReadLocalFileInput, ReadLocalFileResult } from './types';

export async function readLocalFile(
  input: ReadLocalFileInput,
): Promise<ReadLocalFileResult> {
  const location = parseLocalFileUri(input?.uri);
  if (!location)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);
  const encoding = input?.encoding;
  if (encoding !== 'utf8' && encoding !== 'base64') {
    return localFileFailed(
      'invalid_input',
      LOCAL_FILE_MESSAGES.invalidReadEncoding,
    );
  }
  try {
    const content = await localFileAccess.readFile(location.path, encoding);
    if (typeof content !== 'string') {
      return localFileFailed('io', LOCAL_FILE_MESSAGES.readFailed);
    }
    return { status: 'success', content };
  } catch (cause) {
    return localFileFailed('io', LOCAL_FILE_MESSAGES.readFailed, { cause });
  }
}
