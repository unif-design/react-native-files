import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileAccess } from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import { localFileFailed } from './localFileFailed';
import type { WriteLocalFileInput, WriteLocalFileResult } from './types';

export async function writeLocalFile(
  input: WriteLocalFileInput,
): Promise<WriteLocalFileResult> {
  const uri = input?.uri;
  const content = input?.content;
  const location = parseLocalFileUri(uri);
  if (!location)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);
  if (typeof content !== 'string') {
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidContent);
  }
  try {
    if (location.parentPath !== '/')
      await localFileAccess.mkdir(location.parentPath);
    await localFileAccess.writeFile(location.path, content, 'utf8');
    return { status: 'success', uri };
  } catch (cause) {
    return localFileFailed('io', LOCAL_FILE_MESSAGES.writeFailed, { cause });
  }
}
