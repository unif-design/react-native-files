import {
  clearLocalDirectory,
  copyLocalFile,
  createLocalFileLifetime,
  createLocalResourceAccess,
  deleteLocalFile,
  downloadLocalFile,
  getLocalDirectorySize,
  getLocalFileSize,
  getNativeTemporaryRoot,
  readLocalFile,
  writeLocalFile,
} from '@unif/react-native-files';
import type {
  LocalFileLifetime,
  LocalResourceAccessInput,
  LocalResourceAccess,
  LocalResourceUrlSuccess,
  LocalResourceOutsideRootError,
  LocalResourceUrlFailed,
  LocalResourceUrlResult,
  CloseLocalResourceSuccess,
  CloseLocalResourceResult,
  DownloadLocalFileInput,
  LocalDownloadProgress,
  DownloadLocalFileOptions,
  DownloadLocalFileSuccess,
  DownloadLocalFileCancelled,
  LocalDownloadHttpError,
  LocalDownloadSizeError,
  DownloadLocalFileFailed,
  DownloadLocalFileResult,
  CopyLocalFileInput,
  CopyLocalFileResult,
  DeleteLocalFileResult,
  LocalFileError,
  LocalFileFailed,
  LocalSizeResult,
  LocalFileReadEncoding,
  ReadLocalFileInput,
  ReadLocalFileResult,
  WriteLocalFileInput,
  WriteLocalFileResult,
  LocalDirectoryEntryFailure,
  ClearLocalDirectorySuccess,
  ClearLocalDirectoryPartial,
  ClearLocalDirectoryFailed,
  ClearLocalDirectoryResult,
} from '@unif/react-native-files';

export type PublishedFileTypes = [
  LocalFileLifetime,
  LocalResourceAccessInput,
  LocalResourceAccess,
  LocalResourceUrlSuccess,
  LocalResourceOutsideRootError,
  LocalResourceUrlFailed,
  LocalResourceUrlResult,
  CloseLocalResourceSuccess,
  CloseLocalResourceResult,
  DownloadLocalFileInput,
  LocalDownloadProgress,
  DownloadLocalFileOptions,
  DownloadLocalFileSuccess,
  DownloadLocalFileCancelled,
  LocalDownloadHttpError,
  LocalDownloadSizeError,
  DownloadLocalFileFailed,
  DownloadLocalFileResult,
  CopyLocalFileInput,
  CopyLocalFileResult,
  DeleteLocalFileResult,
  LocalFileError,
  LocalFileFailed,
  LocalSizeResult,
  LocalFileReadEncoding,
  ReadLocalFileInput,
  ReadLocalFileResult,
  WriteLocalFileInput,
  WriteLocalFileResult,
  LocalDirectoryEntryFailure,
  ClearLocalDirectorySuccess,
  ClearLocalDirectoryPartial,
  ClearLocalDirectoryFailed,
  ClearLocalDirectoryResult,
];

export async function consumePublicFiles() {
  const uri = 'file:///fixture/file';
  const root: string | undefined = getNativeTemporaryRoot();
  const lifetime: LocalFileLifetime = createLocalFileLifetime(() => {});
  const access: LocalResourceAccess = createLocalResourceAccess({
    rootUri: 'file:///fixture',
  });
  const copied: CopyLocalFileResult = await copyLocalFile({
    sourceUri: uri,
    targetUri: `${uri}-copy`,
  });
  const downloaded: DownloadLocalFileResult = await downloadLocalFile(
    {
      sourceUrl: 'https://example.invalid/file',
      targetUri: `${uri}-download`,
    },
    {
      onProgress(progress: Readonly<LocalDownloadProgress>) {
        return progress.bytesWritten;
      },
    },
  );
  const deleted: DeleteLocalFileResult = await deleteLocalFile(uri);
  const directorySize: LocalSizeResult =
    await getLocalDirectorySize('file:///fixture');
  const fileSize: LocalSizeResult = await getLocalFileSize(uri);
  const read: ReadLocalFileResult = await readLocalFile({
    uri,
    encoding: 'utf8',
  });
  const written: WriteLocalFileResult = await writeLocalFile({
    uri,
    content: '',
  });
  const cleared: ClearLocalDirectoryResult =
    await clearLocalDirectory('file:///fixture');
  return {
    root,
    lifetime,
    access,
    copied,
    downloaded,
    deleted,
    directorySize,
    fileSize,
    read,
    written,
    cleared,
  };
}
