---
title: 文件与目录
description: 读写、复制、删除、字节大小与明确目录的清理语义。
---

# 文件与目录

所有输入位置为绝对 `file://` URI，例如 `file:///app/files/%E6%96%87%E4%BB%B6%20%231.txt`。文件名中的空格、中文、`%`、`?`、`#` 按路径段编码；不要对已有 URI 重复编码。裸路径、远程 URL 和内容提供者引用不作为本地文件输入。

路径会解码并正规化 `.`／`..`。合法 URI 不代表调用方拥有操作权限；身份隔离、目录准入和文件所有权由宿主检查。这些函数不提供真实路径或符号链接的沙箱隔离。

## readLocalFile

```ts
declare function readLocalFile(
  input: ReadLocalFileInput,
): Promise<ReadLocalFileResult>;
```

`input` 包含 `uri` 与明确的 `encoding: 'utf8' | 'base64'`。一次读取完整文件，成功返回 `{ status: 'success', content }`。base64 不带 data URI 前缀，函数不推断 MIME、不解析 JSON。空文件返回空字符串；读取失败返回 `failed`，不以错误文案或空字符串冒充内容。

## writeLocalFile

```ts
declare function writeLocalFile(
  input: WriteLocalFileInput,
): Promise<WriteLocalFileResult>;
```

`input` 包含 `uri` 与字符串 `content`。准备父目录后按 UTF-8 写入，覆盖目标原有内容。SDK 确认写入后返回 `{ status: 'success', uri }`。不提供追加、备份、自动重试、原子替换或事务回滚。

JSON 序列化和解析归内容使用方；读取或解析失败不会自动删除源文件。

## copyLocalFile

```ts
declare function copyLocalFile(
  input: CopyLocalFileInput,
): Promise<CopyLocalFileResult>;
```

`input` 包含 `sourceUri` 和 `targetUri`。源必须是普通文件，正规化后的源与目标不能相同。函数准备目标父目录，目标已存在或正在被本函数的另一复制占用时返回 `invalid_input`，不覆盖目标。

SDK 确认复制完成后返回 `{ status: 'success', uri: targetUri }`，源文件保持不变。实际开始复制后失败会尝试清理本次不完整目标；清理失败记录诊断，仍返回复制失败，不保证磁盘没有残留。

调用方分配独占目标并协调其他写入。这项检查不提供跨进程原子占用，复制也没有取消参数或 `cancelled` 结果。

## deleteLocalFile

```ts
declare function deleteLocalFile(uri: string): Promise<DeleteLocalFileResult>;
```

只删除明确的普通文件。目录或其他不支持的节点返回 `invalid_input`。函数确认删除后的状态：

| 结果                                    | 含义                                       |
| --------------------------------------- | ------------------------------------------ |
| `{ status: 'success', deleted: true }`  | 本次删除完成，已确认文件不存在             |
| `{ status: 'success', deleted: false }` | 已确认文件不存在，未将其计为本次完成的删除 |
| `{ status: 'failed', error }`           | 无法确认完成，或发生未识别的 I/O 错误      |

不需要在外部先做一次存在性检查。删除前，宿主确认文件不再被读取、预览、草稿或后续操作使用。该函数没有取消或后台重试。

## getLocalFileSize 与 getLocalDirectorySize

```ts
declare function getLocalFileSize(uri: string): Promise<LocalSizeResult>;
declare function getLocalDirectorySize(uri: string): Promise<LocalSizeResult>;
```

成功均返回 `{ status: 'success', sizeBytes }`，字节数必须为非负安全整数。

`getLocalFileSize()` 只接受普通文件，通过元数据取得大小，不读取完整内容。真实空文件返回 `0`；目录输入失败，文件缺失或无法取得有效大小也失败。

`getLocalDirectorySize()` 递归累加目录内普通文件的大小；根目录明确不存在或为空时返回 `0`。必要目录或文件信息不可读取、大小无效或总和溢出时返回失败，不交付局部统计。该结果不是系统剩余空间，也不是并发写入下的原子快照。

## clearLocalDirectory

```ts
declare function clearLocalDirectory(
  uri: string,
): Promise<ClearLocalDirectoryResult>;
```

清理指定目录的内容并保留根目录。宿主先确认目录清理权、范围和仍在使用的文件，停止该目录的写入。不要把整个 `LibraryDir`、`DocumentDir` 或其他共享根当作默认清理目标。

函数核对根目录和直接子项，取得本次目标快照，再逐项递归删除；一项失败仍处理其余目标。最后重新枚举以确认快照目标是否还存在。根链接、无法确认归属的路径或名称不进入删除。

| `status`  | 含义                                                      |
| --------- | --------------------------------------------------------- |
| `success` | 目录明确缺失、没有子项，或本次快照目标已确认全部不存在    |
| `partial` | 部分目标未确认移除，`failures` 列出对应直接子项和错误     |
| `failed`  | 无法读取或确认目录，或全部目标未完成；可能附带 `failures` |

失败子目录内部可能已有部分内容被删除，没有回滚。函数不自动重删、不推算释放字节，也不保证并发新增文件被纳入本次快照；宿主必须协调写入和外部重命名。

相关输入和结果的完整定义见[公开类型](types.md)。
