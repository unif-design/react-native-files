import { LOCAL_FILE_MESSAGES } from './constants';
import { localFileFailed } from './localFileFailed';
import {
  getLocalResourcePath,
  getLocalResourceRoot,
} from './localResourcePath';
import type {
  CloseLocalResourceResult,
  LocalResourceAccess,
  LocalResourceAccessInput,
} from './types';

export function createLocalResourceAccess(
  input: LocalResourceAccessInput,
): LocalResourceAccess {
  const rootPath = getLocalResourceRoot(input);
  let closing: Promise<CloseLocalResourceResult> | undefined;
  return {
    async getUrl(uri) {
      if (closing)
        return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceClosed);
      const path = getLocalResourcePath(rootPath, uri);
      return typeof path === 'string'
        ? localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported)
        : path;
    },
    close() {
      closing ??= Promise.resolve(
        localFileFailed('unsupported', LOCAL_FILE_MESSAGES.unsupported),
      );
      return closing;
    },
  };
}
