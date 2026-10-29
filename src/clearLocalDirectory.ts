import { LOCAL_FILE_MESSAGES } from './constants';
import { isMissingFileError, localFileAccess } from './fileAccess';
import { parseLocalFileUri } from './fileUri';
import { localFileFailed } from './localFileFailed';
import type {
  ClearLocalDirectoryResult,
  LocalDirectoryEntryFailure,
  LocalFileLocation,
} from './types';

async function readDirectEntries(path: string) {
  const entries = await localFileAccess.readDir(path);
  const names = new Set<string>();
  if (!Array.isArray(entries))
    throw new Error(LOCAL_FILE_MESSAGES.invalidDirectoryEntry);
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.name !== 'string' ||
      !entry.name ||
      entry.name === '.' ||
      entry.name === '..' ||
      entry.name.includes('/') ||
      entry.name.includes('\u0000') ||
      names.has(entry.name) ||
      entry.path !== `${path === '/' ? '' : path}/${entry.name}`
    )
      throw new Error(LOCAL_FILE_MESSAGES.invalidDirectoryEntry);
    encodeURIComponent(entry.path);
    names.add(entry.name);
  }
  return entries;
}

async function findRootEntry(location: LocalFileLocation) {
  let entries;
  try {
    entries = await readDirectEntries(location.parentPath);
  } catch (cause) {
    if (isMissingFileError(cause)) {
      try {
        await localFileAccess.stat(location.parentPath);
      } catch (parentCause) {
        if (isMissingFileError(parentCause)) return undefined;
        throw parentCause;
      }
    }
    throw cause;
  }
  const root = entries.find((entry) => entry.path === location.path);
  if (
    !root &&
    entries.some(
      (entry) => entry.path.normalize('NFC') === location.path.normalize('NFC'),
    )
  ) {
    // iOS may canonicalize entry names. Ambiguous spelling does not prove absence.
    throw new Error(LOCAL_FILE_MESSAGES.invalidDirectoryEntry);
  }
  if (!root) {
    try {
      await localFileAccess.stat(location.path);
    } catch (cause) {
      if (!isMissingFileError(cause)) throw cause;
      // stat 会跟随链接；父目录含特殊项时，不能排除悬空链接的文件系统别名。
      if (entries.some((entry) => !entry.isFile() && !entry.isDirectory()))
        throw new Error(LOCAL_FILE_MESSAGES.invalidDirectoryEntry);
      return undefined;
    }
    throw new Error(LOCAL_FILE_MESSAGES.invalidDirectoryEntry);
  }
  return root;
}

async function readRootEntries(location: LocalFileLocation) {
  try {
    return await readDirectEntries(location.path);
  } catch (cause) {
    if (
      isMissingFileError(cause) &&
      location.path !== '/' &&
      !(await findRootEntry(location))
    ) {
      return [];
    }
    throw cause;
  }
}

export async function clearLocalDirectory(
  uri: string,
): Promise<ClearLocalDirectoryResult> {
  const location = parseLocalFileUri(uri);
  if (!location)
    return localFileFailed('invalid_input', LOCAL_FILE_MESSAGES.invalidUri);
  let targets: string[];
  try {
    if (location.path !== '/') {
      const root = await findRootEntry(location);
      if (!root) return { status: 'success' };
      if (!root.isDirectory()) {
        return localFileFailed(
          'invalid_input',
          LOCAL_FILE_MESSAGES.clearNotDirectory,
        );
      }
    }
    const rootStat = await localFileAccess.stat(location.path);
    if (!rootStat.isDirectory()) {
      return localFileFailed(
        'invalid_input',
        LOCAL_FILE_MESSAGES.clearNotDirectory,
      );
    }
    targets = (await readRootEntries(location)).map((entry) => entry.path);
  } catch (cause) {
    return localFileFailed('io', LOCAL_FILE_MESSAGES.clearFailed, { cause });
  }
  if (targets.length === 0) return { status: 'success' };

  const deleteErrors = new Map<string, unknown>();
  for (const path of targets) {
    try {
      await localFileAccess.unlink(path);
    } catch (cause) {
      deleteErrors.set(path, cause);
    }
  }

  let remaining: Set<string>;
  try {
    remaining = new Set(
      (await readRootEntries(location)).map((entry) => entry.path),
    );
  } catch (cause) {
    return {
      ...localFileFailed('io', LOCAL_FILE_MESSAGES.clearFailed, { cause }),
      failures: targets.map((path) => ({
        uri: `file://${path.split('/').map(encodeURIComponent).join('/')}`,
        error: localFileFailed('io', LOCAL_FILE_MESSAGES.clearFailed, { cause })
          .error,
      })),
    };
  }
  const failures: LocalDirectoryEntryFailure[] = [];
  for (const path of targets) {
    if (!remaining.has(path)) continue;
    const cause =
      deleteErrors.get(path) ??
      new Error(LOCAL_FILE_MESSAGES.entryStillPresent);
    failures.push({
      uri: `file://${path.split('/').map(encodeURIComponent).join('/')}`,
      error: localFileFailed('io', LOCAL_FILE_MESSAGES.clearFailed, { cause })
        .error,
    });
  }
  if (failures.length === 0) return { status: 'success' };
  if (failures.length < targets.length) return { status: 'partial', failures };
  return {
    ...localFileFailed('io', LOCAL_FILE_MESSAGES.clearFailed),
    failures,
  };
}
