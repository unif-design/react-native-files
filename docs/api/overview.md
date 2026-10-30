---
title: API 总览
description: 文件操作、下载、本地访问和清理相关 API。
---

# API 总览

所有函数和类型均从 `@unif/react-native-files` 导入：

```ts
import { readLocalFile, writeLocalFile } from '@unif/react-native-files';
import type { ReadLocalFileResult } from '@unif/react-native-files';
```

| 函数                        | 输入与结果                                                                                     | 说明                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `readLocalFile`             | `ReadLocalFileInput` → `Promise<ReadLocalFileResult>`                                          | [UTF-8／base64 读取](file-operations.md)     |
| `writeLocalFile`            | `WriteLocalFileInput` → `Promise<WriteLocalFileResult>`                                        | [UTF-8 覆盖写](file-operations.md)           |
| `copyLocalFile`             | `CopyLocalFileInput` → `Promise<CopyLocalFileResult>`                                          | [复制文件，不覆盖目标](file-operations.md)   |
| `deleteLocalFile`           | `uri: string` → `Promise<DeleteLocalFileResult>`                                               | [删除单个文件](file-operations.md)           |
| `getLocalFileSize`          | `uri: string` → `Promise<LocalSizeResult>`                                                     | [获取文件大小](file-operations.md)           |
| `getLocalDirectorySize`     | `uri: string` → `Promise<LocalSizeResult>`                                                     | [递归统计目录](file-operations.md)           |
| `clearLocalDirectory`       | `uri: string` → `Promise<ClearLocalDirectoryResult>`                                           | [清空目录，保留目录本身](file-operations.md) |
| `downloadLocalFile`         | `DownloadLocalFileInput`、可选 `DownloadLocalFileOptions` → `Promise<DownloadLocalFileResult>` | [HTTP(S) 单文件下载](download.md)            |
| `createLocalResourceAccess` | `LocalResourceAccessInput` → `LocalResourceAccess`                                             | [通过本地 HTTP 访问文件](local-resources.md) |
| `createLocalFileLifetime`   | `cleanup: () => void` → `LocalFileLifetime`                                                    | [等待文件使用结束后清理](lifetime.md)        |
| `getNativeTemporaryRoot`    | 无 → `string \| undefined`                                                                     | [获取应用目录 URI](lifetime.md)              |

## 结果处理

异步操作通过 `status` 返回结果：

| `status`    | 含义                                             |
| ----------- | ------------------------------------------------ |
| `success`   | 操作成功，读取对应结果字段                       |
| `failed`    | 操作失败，读取 `error.reason` 和 `error.message` |
| `cancelled` | 下载已取消                                       |
| `partial`   | 目录中部分内容未能删除，读取 `failures`          |

通用错误原因为 `invalid_input`（参数无效）、`unsupported`（平台不支持）和 `io`（文件或服务操作失败）。下载另有 `http`、`size_limit`；本地访问另有 `outside_root`。具体含义见各 API 页面。

两个同步入口需单独处理：`createLocalResourceAccess()` 的配置无效时会抛错；文件清理回调抛出的同步错误会传回调用 `retire()` 或释放函数的位置。

完整参数与结果定义见[类型参考](types.md)。按 `status` 和 `error.reason` 判断分支，避免匹配中文错误消息；`cause` 仅用于内部诊断。
