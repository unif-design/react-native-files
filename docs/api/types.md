---
title: 公开类型
description: 根入口导出的 34 个输入、结果与生命周期类型。
---

# 公开类型

从 `@unif/react-native-files` 使用 `import type` 导入以下类型。字段以源码公开入口为准；下列将内部成功结构展开，不增加内部类型的公开导出。RNFS 相关字段继续使用其原有类型。

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

`message` 是操作失败说明；`cause` 可能保留原始 SDK 异常，仅供内部诊断。不要通过错误文案匹配判断状态或把 `cause` 原样交给外部消费者。

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

`failures` 指向本次快照中的直接子项。`failed` 不一定能提供该列表；失败目录内部也可能已经删除部分内容。

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

## 文件使用期

```ts
interface LocalFileLifetime {
  retain(): (() => void) | undefined;
  retire(): void;
}
```

函数输入、结果与副作用分别见[文件操作](file-operations.md)、[下载](download.md)、[本地资源](local-resources.md)和[文件使用期](lifetime.md)。
