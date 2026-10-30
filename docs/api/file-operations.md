---
title: 文件与目录
description: 读取、写入、复制和删除文件，统计或清空目录。
---

# 文件与目录

本页 API 使用绝对 `file://` URI，例如 `file:///app/files/note.txt`。动态文件名应使用 `encodeURIComponent()` 编码后再拼接，不要重复编码已有 URI。不接受裸路径、HTTP URL 或 `content://` 地址。

路径中的 `.` 和 `..` 会被解析。应用需自行检查访问权限与目录范围；这些函数不提供符号链接隔离。

## readLocalFile

一次读取文件的全部内容。

```ts
declare function readLocalFile(
  input: ReadLocalFileInput,
): Promise<ReadLocalFileResult>;
```

传入 `uri` 和 `encoding: 'utf8' | 'base64'`。成功返回 `{ status: 'success', content }`；空文件的 `content` 为空字符串。base64 结果不含 `data:` 前缀，JSON 解析由应用处理。读取失败返回 `failed`。

## writeLocalFile

按 UTF-8 写入文本，覆盖已有文件。

```ts
declare function writeLocalFile(
  input: WriteLocalFileInput,
): Promise<WriteLocalFileResult>;
```

传入 `uri` 和字符串 `content`。父目录不存在时自动创建，成功返回 `{ status: 'success', uri }`。不支持追加或原子替换，失败时不会回滚。

写入 JSON 前使用 `JSON.stringify()`；读取后自行解析。读取或解析失败不会自动删除文件。

## copyLocalFile

复制文件，保留源文件，不覆盖目标。

```ts
declare function copyLocalFile(
  input: CopyLocalFileInput,
): Promise<CopyLocalFileResult>;
```

传入 `sourceUri` 和 `targetUri`。源必须是普通文件，源与目标路径不能相同。自动创建目标父目录；目标已存在或正被另一次复制使用时，返回 `invalid_input`。

成功返回 `{ status: 'success', uri: targetUri }`。复制失败会尝试删除本次产生的不完整文件；删除失败时记录日志，结果仍为复制失败，磁盘可能有残留。

不支持取消。应用需避免其他操作或进程同时写入目标，库内的并发检查不提供跨进程锁。

## deleteLocalFile

删除单个文件，并确认文件已不存在。

```ts
declare function deleteLocalFile(uri: string): Promise<DeleteLocalFileResult>;
```

只接受普通文件；目录或其他文件系统节点返回 `invalid_input`。

| 结果                                    | 含义                                   |
| --------------------------------------- | -------------------------------------- |
| `{ status: 'success', deleted: true }`  | 本次删除成功，文件已不存在             |
| `{ status: 'success', deleted: false }` | 文件已不存在，但未确认是本次删除完成的 |
| `{ status: 'failed', error }`           | 删除失败或无法确认结果                 |

无需提前检查文件是否存在。删除前应确认文件不再使用；函数不支持取消或自动重试。

## getLocalFileSize 与 getLocalDirectorySize

```ts
declare function getLocalFileSize(uri: string): Promise<LocalSizeResult>;
declare function getLocalDirectorySize(uri: string): Promise<LocalSizeResult>;
```

成功返回 `{ status: 'success', sizeBytes }`，单位为字节，值为非负安全整数。

`getLocalFileSize()` 读取普通文件的大小，不加载文件内容。空文件返回 `0`；文件不存在、输入为目录或大小无效时失败。

`getLocalDirectorySize()` 递归统计目录内普通文件的总大小。目录不存在或为空时返回 `0`；读取失败、大小无效或总和超出安全整数范围时返回失败，不返回部分统计值。统计期间应避免修改目录；结果表示文件大小总和，不是磁盘剩余空间。

## clearLocalDirectory

递归删除目录内容，保留目录本身。

```ts
declare function clearLocalDirectory(
  uri: string,
): Promise<ClearLocalDirectoryResult>;
```

清理前停止该目录内的读写，确认其中的文件都可删除。请使用功能专属目录，避免直接清空 `LibraryDir`、`DocumentDir` 等应用根目录。

函数先记录目录中的直接子项，再逐项删除并检查结果。一项失败不影响其余项。目录本身是符号链接，或无法确认子项属于该目录时，不执行删除。

| `status`  | 含义                                                            |
| --------- | --------------------------------------------------------------- |
| `success` | 目录不存在、为空，或本次记录的子项已全部不存在                  |
| `partial` | 部分子项未能确认删除，详见 `failures`                           |
| `failed`  | 无法读取或确认目录，或全部子项未能确认删除；可能附带 `failures` |

失败目录中也可能已有文件被删除，操作不会回滚或自动重试，也不返回释放的字节数。清理期间新增或重命名的文件不保证被处理。

完整参数与结果定义见[类型参考](types.md)。
