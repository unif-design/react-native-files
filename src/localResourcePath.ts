import { LOCAL_FILE_MESSAGES } from './constants';
import { parseLocalFileUri } from './fileUri';
import { localFileFailed } from './localFileFailed';
import type { LocalResourceAccessInput, LocalResourceUrlFailed } from './types';

export function getLocalResourceRoot(input: LocalResourceAccessInput): string {
  const root = parseLocalFileUri(input?.rootUri);
  if (!root) throw new Error(LOCAL_FILE_MESSAGES.invalidResourceRoot);
  try {
    encodeURIComponent(root.path);
  } catch {
    throw new Error(LOCAL_FILE_MESSAGES.invalidResourceRoot);
  }
  // SDK 0.28 writes fileDir directly into a quoted lighttpd config value.
  // A quote ends that value; a trailing backslash escapes its closing quote.
  if (root.path.includes('"') || root.path.endsWith('\\')) {
    throw new Error(LOCAL_FILE_MESSAGES.unsupportedResourceRoot);
  }
  return root.path;
}

export function getLocalResourcePath(
  rootPath: string,
  uri: string,
): string | LocalResourceUrlFailed {
  const file = parseLocalFileUri(uri);
  if (!file)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);

  const prefix = rootPath === '/' ? '/' : `${rootPath}/`;
  if (file.path !== rootPath && !file.path.startsWith(prefix)) {
    return {
      status: 'failed',
      error: {
        reason: 'outside_root',
        message: LOCAL_FILE_MESSAGES.resourceOutsideRoot,
      },
    };
  }
  const relativePath =
    file.path === rootPath ? '' : file.path.slice(prefix.length);
  try {
    return relativePath.split('/').map(encodeURIComponent).join('/');
  } catch {
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);
  }
}
