---
title: API 总览
description: 全部公开函数、类型与结果分支。
---

# API 总览

所有函数和公开类型均从 `@unif/react-native-files` 根入口导入。不使用 `src`、`lib` 或内部工具路径。

| 函数                        | 输入与结果                                                                                     | 说明                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `readLocalFile`             | `ReadLocalFileInput` → `Promise<ReadLocalFileResult>`                                          | [UTF-8／base64 读取](file-operations.md) |
| `writeLocalFile`            | `WriteLocalFileInput` → `Promise<WriteLocalFileResult>`                                        | [UTF-8 覆盖写](file-operations.md)       |
| `copyLocalFile`             | `CopyLocalFileInput` → `Promise<CopyLocalFileResult>`                                          | [复制到独占目标](file-operations.md)     |
| `deleteLocalFile`           | `uri: string` → `Promise<DeleteLocalFileResult>`                                               | [删除单个文件](file-operations.md)       |
| `getLocalFileSize`          | `uri: string` → `Promise<LocalSizeResult>`                                                     | [文件实际字节数](file-operations.md)     |
| `getLocalDirectorySize`     | `uri: string` → `Promise<LocalSizeResult>`                                                     | [递归统计目录](file-operations.md)       |
| `clearLocalDirectory`       | `uri: string` → `Promise<ClearLocalDirectoryResult>`                                           | [清理明确目录的内容](file-operations.md) |
| `downloadLocalFile`         | `DownloadLocalFileInput`、可选 `DownloadLocalFileOptions` → `Promise<DownloadLocalFileResult>` | [HTTP(S) 单文件下载](download.md)        |
| `createLocalResourceAccess` | `LocalResourceAccessInput` → `LocalResourceAccess`                                             | [共享本地 HTTP 访问](local-resources.md) |
| `createLocalFileLifetime`   | `cleanup: () => void` → `LocalFileLifetime`                                                    | [按文件持有与退休](lifetime.md)          |
| `getNativeTemporaryRoot`    | 无 → `string \| undefined`                                                                     | [已编码的原生根 URI](lifetime.md)        |

## 结果处理

普通文件操作失败使用 `LocalFileFailed`，其 `LocalFileError.reason` 为 `invalid_input`、`unsupported` 或 `io`。目录清理另有 `partial`；下载另有 `cancelled`、`http` 和 `size_limit`；资源链接另有 `outside_root`。

`createLocalResourceAccess()` 在配置无效时同步抛出错误；其余正常操作结果按返回类型接收。`createLocalFileLifetime()` 调用宿主的同步清理回调，回调抛错不会被库吞掉。

[公开类型参考](types.md)列出全部 34 个根导出类型。仅在源码内部使用的路径结构、错误原因别名和部分成功结构不单独导出；消费者可通过公开结果类型收窄。
