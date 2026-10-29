import type { LocalFileLocation } from './types';

function normalizeAbsolutePath(path: string) {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

export function parseLocalFileUri(uri: unknown): LocalFileLocation | undefined {
  if (typeof uri !== 'string' || !uri.startsWith('file:///')) return undefined;

  const encodedPath = uri.slice('file://'.length);
  if (encodedPath.includes('?') || encodedPath.includes('#')) return undefined;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    return undefined;
  }
  if (!decodedPath.startsWith('/') || decodedPath.includes('\u0000')) {
    return undefined;
  }

  const path = normalizeAbsolutePath(decodedPath);
  const separatorIndex = path.lastIndexOf('/');
  return {
    path,
    parentPath: separatorIndex === 0 ? '/' : path.slice(0, separatorIndex),
  };
}
