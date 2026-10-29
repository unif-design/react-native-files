import * as fs from 'node:fs/promises';
import { join } from 'node:path';

export function createFileIoMock() {
  return {
    stat: jest.fn((path: string) => fs.stat(path)),
    readFile: jest.fn((path: string, encoding: BufferEncoding) =>
      fs.readFile(path, encoding),
    ),
    writeFile: jest.fn(
      (path: string, content: string, encoding: BufferEncoding) =>
        fs.writeFile(path, content, encoding),
    ),
    mkdir: jest.fn((path: string) => fs.mkdir(path, { recursive: true })),
    readDir: jest.fn(async (path: string) => {
      const names = await fs.readdir(path);
      return Promise.all(
        names.map(async (name) => {
          const entryPath = join(path, name);
          const metadata = await fs.lstat(entryPath);
          return {
            name,
            path: entryPath,
            size: metadata.size,
            isFile: () => metadata.isFile(),
            isDirectory: () => metadata.isDirectory(),
          };
        }),
      );
    }),
    unlink: jest.fn((path: string) => fs.rm(path, { recursive: true })),
    copyFile: jest.fn(fs.copyFile),
  };
}
