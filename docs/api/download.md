---
title: 文件下载
description: 将 HTTP(S) 文件下载到本地，支持进度、取消和大小限制。
---

# downloadLocalFile

将 HTTP(S) 文件下载到指定的本地路径，支持进度回调、取消和大小限制。

```ts
declare function downloadLocalFile(
  input: DownloadLocalFileInput,
  options?: DownloadLocalFileOptions,
): Promise<DownloadLocalFileResult>;
```

目标文件必须尚不存在，父目录会自动创建。不支持断点续传或自动重试，也不会额外发送 HEAD 请求。

## 参数

| 字段                | 约定                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `sourceUrl`         | HTTP(S) URL；查询参数按原样发送                                      |
| `targetUri`         | 目标文件的绝对 `file://` URI；文件须不存在，且不能同时被其他操作写入 |
| `headers`           | 可选，请求头；使用 RNFS 类型，调用开始时复制                         |
| `maxBytes`          | 可选，最大字节数，须为非负安全整数；默认不限制                       |
| `connectionTimeout` | 可选，正数，毫秒；仅 Android 实现独立连接超时                        |
| `readTimeout`       | 可选，正数，毫秒；遵循已采用 RNFS 的平台行为                         |

未设置超时时使用 SDK 默认值。RNFS 2.41.0 的 Android 手动重定向分支未完整继承这两个超时参数，iOS 不支持独立的连接超时。

应用负责检查下载地址和请求权限。认证信息通过 `headers` 传入，不放入 URL 或日志；本函数不保存请求头。

## 用法与进度

以下 `sourceUrl` 为下载地址，`targetUri` 为本次下载使用的新文件路径：

```ts
import { downloadLocalFile } from '@unif/react-native-files';

const controller = new AbortController();
const result = await downloadLocalFile(
  { sourceUrl, targetUri, maxBytes: 10 * 1024 * 1024 },
  {
    signal: controller.signal,
    onProgress(progress) {
      // 已写入字节数；总大小未知时没有 totalBytes。
      console.log(progress.bytesWritten, progress.totalBytes);
    },
  },
);

if (result.status === 'success') {
  // 使用 result.uri，文件大小为 result.sizeBytes。
} else if (result.status === 'failed') {
  console.warn(result.error.message);
}
```

示例限制大小为 10 MiB。下载过程中调用 `controller.abort()` 可取消。

`onProgress` 接收只读进度对象。`bytesWritten` 为非负安全整数；总大小未知、无效或小于已写入量时，省略 `totalBytes`。无效进度会被忽略，回调抛错不影响下载。是否完成以最终结果为准。

## 返回结果

| 结果                    | 含义                                                  |
| ----------------------- | ----------------------------------------------------- |
| `success`               | HTTP 状态为 2xx，本地文件已写入，大小有效且未超限     |
| `cancelled`             | 下载已取消；调用前已取消时不访问网络或文件            |
| `failed` + `http`       | HTTP 状态为非 2xx，错误中包含 `statusCode`            |
| `failed` + `size_limit` | 响应报告的大小、下载进度或最终文件大小超过 `maxBytes` |
| `failed` + 其他原因     | 参数无效、平台不支持、HTTP 状态码无效或 I/O 失败      |

成功结果包含 `uri`、`sizeBytes` 和 `statusCode`，其中大小已从本地文件读取。成功只表示响应内容已保存，不校验远端文件的完整性或校验和；206 等分段响应也可能成功。

## 取消与文件清理

取消或超限后，函数请求原生任务停止，等待任务结束，再清理本次产生的文件。迟到回调不会改变已经确定的结果。取消请求发出后，原生写入可能仍在结束过程中，应等待函数返回。

清理失败会记录日志，保留原结果，磁盘可能有残留。函数不会删除已有目标、其他任务的文件或源文件。下载成功后由应用安排删除，之后再取消不会删除成功文件。

上述行为依赖 RNFS 的必要补丁，见[安装配置](../host-setup.md)。完整类型见[类型参考](types.md)。
