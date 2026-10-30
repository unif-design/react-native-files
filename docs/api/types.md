---
title: 类型参考
description: 输入参数、返回结果、错误和文件清理接口。
---

# 类型参考

以下类型均可从 `@unif/react-native-files` 导入。结果类型中的成功分支已展开，RNFS 相关字段沿用其类型定义。

```ts
import type {
  ReadLocalFileInput,
  ReadLocalFileResult,
} from '@unif/react-native-files';
```

## 公共错误

```ts
interface LocalFileError {
  reason: 'invalid_input' | 'unsupported' | 'io';
  message: string;
  cause?: unknown;
}

interface LocalFileFailed {
  status: 'failed';
  error: LocalFileError;
}
```

按 `reason` 判断错误类型，`message` 用于说明原因。`cause` 可能包含原始 SDK 异常，仅用于内部诊断，避免直接展示或对外发送。

## 文件内容、复制与大小

```ts
import type { EncodingT } from '@dr.pogodin/react-native-fs';

type LocalFileReadEncoding = Extract<EncodingT, 'utf8' | 'base64'>;

interface ReadLocalFileInput {
  uri: string;
  encoding: LocalFileReadEncoding;
}

type ReadLocalFileResult =
  { status: 'success'; content: string } | LocalFileFailed;

interface WriteLocalFileInput {
  uri: string;
  content: string;
}

type WriteLocalFileResult =
  { status: 'success'; uri: string } | LocalFileFailed;

interface CopyLocalFileInput {
  sourceUri: string;
  targetUri: string;
}

type CopyLocalFileResult = { status: 'success'; uri: string } | LocalFileFailed;

type DeleteLocalFileResult =
  { status: 'success'; deleted: boolean } | LocalFileFailed;

type LocalSizeResult =
  { status: 'success'; sizeBytes: number } | LocalFileFailed;
```

## 目录清理

```ts
interface LocalDirectoryEntryFailure {
  uri: string;
  error: LocalFileError;
}

interface ClearLocalDirectorySuccess {
  status: 'success';
}

interface ClearLocalDirectoryPartial {
  status: 'partial';
  failures: readonly LocalDirectoryEntryFailure[];
}

interface ClearLocalDirectoryFailed extends LocalFileFailed {
  failures?: readonly LocalDirectoryEntryFailure[];
}

type ClearLocalDirectoryResult =
  | ClearLocalDirectorySuccess
  | ClearLocalDirectoryPartial
  | ClearLocalDirectoryFailed;
```

`failures` 列出本次记录的直接子项及错误。`failed` 可能没有该列表；失败目录中也可能已有文件被删除。

## 下载

```ts
import type {
  DownloadFileOptionsT,
  DownloadProgressCallbackResultT,
  DownloadResultT,
} from '@dr.pogodin/react-native-fs';

interface DownloadLocalFileInput extends Pick<
  DownloadFileOptionsT,
  'connectionTimeout' | 'readTimeout' | 'headers'
> {
  sourceUrl: string;
  targetUri: string;
  maxBytes?: number;
}

interface LocalDownloadProgress extends Pick<
  DownloadProgressCallbackResultT,
  'bytesWritten'
> {
  totalBytes?: number;
}

interface DownloadLocalFileOptions {
  signal?: AbortSignal;
  onProgress?(progress: Readonly<LocalDownloadProgress>): void;
}

interface DownloadLocalFileSuccess extends Pick<DownloadResultT, 'statusCode'> {
  status: 'success';
  uri: string;
  sizeBytes: number;
}

interface DownloadLocalFileCancelled {
  status: 'cancelled';
}

interface LocalDownloadHttpError
  extends Omit<LocalFileError, 'reason'>, Pick<DownloadResultT, 'statusCode'> {
  reason: 'http';
}

interface LocalDownloadSizeError extends Omit<LocalFileError, 'reason'> {
  reason: 'size_limit';
}

interface DownloadLocalFileFailed {
  status: 'failed';
  error: LocalFileError | LocalDownloadHttpError | LocalDownloadSizeError;
}

type DownloadLocalFileResult =
  | DownloadLocalFileSuccess
  | DownloadLocalFileCancelled
  | DownloadLocalFileFailed;
```

## 本地资源访问

```ts
interface LocalResourceAccessInput {
  rootUri: string;
}

interface LocalResourceUrlSuccess {
  status: 'success';
  url: string;
}

interface LocalResourceOutsideRootError extends Omit<LocalFileError, 'reason'> {
  reason: 'outside_root';
}

interface LocalResourceUrlFailed {
  status: 'failed';
  error: LocalFileError | LocalResourceOutsideRootError;
}

type LocalResourceUrlResult = LocalResourceUrlSuccess | LocalResourceUrlFailed;

interface CloseLocalResourceSuccess {
  status: 'success';
}

type CloseLocalResourceResult = CloseLocalResourceSuccess | LocalFileFailed;

interface LocalResourceAccess {
  getUrl(uri: string): Promise<LocalResourceUrlResult>;
  close(): Promise<CloseLocalResourceResult>;
}
```

## 文件清理

```ts
interface LocalFileLifetime {
  retain(): (() => void) | undefined;
  retire(): void;
}
```

用法见[文件与目录](file-operations.md)、[文件下载](download.md)、[本地资源访问](local-resources.md)和[文件清理](lifetime.md)。
