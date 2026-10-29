import type {
  DownloadFileOptionsT,
  DownloadProgressCallbackResultT,
  DownloadResultT,
  EncodingT,
} from '@dr.pogodin/react-native-fs';

export interface LocalFileLifetime {
  retain(): (() => void) | undefined;
  retire(): void;
}

export interface LocalResourceAccessInput {
  rootUri: string;
}

export interface LocalResourceUrlSuccess {
  status: 'success';
  url: string;
}

export interface LocalResourceOutsideRootError extends Omit<
  LocalFileError,
  'reason'
> {
  reason: 'outside_root';
}

export interface LocalResourceUrlFailed {
  status: 'failed';
  error: LocalFileError | LocalResourceOutsideRootError;
}

export type LocalResourceUrlResult =
  LocalResourceUrlSuccess | LocalResourceUrlFailed;

export interface CloseLocalResourceSuccess {
  status: 'success';
}

export type CloseLocalResourceResult =
  CloseLocalResourceSuccess | LocalFileFailed;

export interface LocalResourceAccess {
  getUrl(uri: string): Promise<LocalResourceUrlResult>;
  close(): Promise<CloseLocalResourceResult>;
}

export interface CopyLocalFileInput {
  sourceUri: string;
  targetUri: string;
}

export type LocalFileErrorReason = 'invalid_input' | 'unsupported' | 'io';

export interface LocalFileError {
  reason: LocalFileErrorReason;
  message: string;
  cause?: unknown;
}

export interface CopyLocalFileSuccess {
  status: 'success';
  uri: string;
}

export interface LocalFileFailed {
  status: 'failed';
  error: LocalFileError;
}

export type CopyLocalFileResult = CopyLocalFileSuccess | LocalFileFailed;

export interface DeleteLocalFileSuccess {
  status: 'success';
  deleted: boolean;
}

export type DeleteLocalFileResult = DeleteLocalFileSuccess | LocalFileFailed;

export interface LocalFileLocation {
  path: string;
  parentPath: string;
}

export interface LocalSizeSuccess {
  status: 'success';
  sizeBytes: number;
}

export type LocalSizeResult = LocalSizeSuccess | LocalFileFailed;

export type LocalFileReadEncoding = Extract<EncodingT, 'utf8' | 'base64'>;

export interface ReadLocalFileInput {
  uri: string;
  encoding: LocalFileReadEncoding;
}

export interface ReadLocalFileSuccess {
  status: 'success';
  content: string;
}

export type ReadLocalFileResult = ReadLocalFileSuccess | LocalFileFailed;

export interface WriteLocalFileInput {
  uri: string;
  content: string;
}

export interface WriteLocalFileSuccess {
  status: 'success';
  uri: string;
}

export type WriteLocalFileResult = WriteLocalFileSuccess | LocalFileFailed;

export interface LocalDirectoryEntryFailure {
  uri: string;
  error: LocalFileError;
}

export interface ClearLocalDirectorySuccess {
  status: 'success';
}

export interface ClearLocalDirectoryPartial {
  status: 'partial';
  failures: readonly LocalDirectoryEntryFailure[];
}

export interface ClearLocalDirectoryFailed extends LocalFileFailed {
  failures?: readonly LocalDirectoryEntryFailure[];
}

export type ClearLocalDirectoryResult =
  | ClearLocalDirectorySuccess
  | ClearLocalDirectoryPartial
  | ClearLocalDirectoryFailed;

export interface DownloadLocalFileInput extends Pick<
  DownloadFileOptionsT,
  'connectionTimeout' | 'readTimeout' | 'headers'
> {
  sourceUrl: string;
  targetUri: string;
  maxBytes?: number;
}

export interface LocalDownloadProgress extends Pick<
  DownloadProgressCallbackResultT,
  'bytesWritten'
> {
  totalBytes?: number;
}

export interface DownloadLocalFileOptions {
  signal?: AbortSignal;
  onProgress?(progress: Readonly<LocalDownloadProgress>): void;
}

export interface DownloadLocalFileSuccess extends Pick<
  DownloadResultT,
  'statusCode'
> {
  status: 'success';
  uri: string;
  sizeBytes: number;
}

export interface DownloadLocalFileCancelled {
  status: 'cancelled';
}

export interface LocalDownloadHttpError
  extends Omit<LocalFileError, 'reason'>, Pick<DownloadResultT, 'statusCode'> {
  reason: 'http';
}

export interface LocalDownloadSizeError extends Omit<LocalFileError, 'reason'> {
  reason: 'size_limit';
}

export interface DownloadLocalFileFailed {
  status: 'failed';
  error: LocalFileError | LocalDownloadHttpError | LocalDownloadSizeError;
}

export type DownloadLocalFileResult =
  | DownloadLocalFileSuccess
  | DownloadLocalFileCancelled
  | DownloadLocalFileFailed;
