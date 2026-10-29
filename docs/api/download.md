---
title: 单文件下载
description: HTTP(S) 下载的输入、进度、取消、大小限制和文件归属。
---

# downloadLocalFile

```ts
declare function downloadLocalFile(
  input: DownloadLocalFileInput,
  options?: DownloadLocalFileOptions,
): Promise<DownloadLocalFileResult>;
```

将明确的 HTTP(S) 来源保存到调用方分配的独占 `file://` 目标。函数准备父目录，不额外发送 HEAD、不自动重试、不恢复下载，也不发起上传或业务保存。

## 输入

| 字段                | 约定                                                 |
| ------------------- | ---------------------------------------------------- |
| `sourceUrl`         | 非空 HTTP(S) URL；不改写签名查询内容                 |
| `targetUri`         | 尚未存在的绝对文件 URI；调用方不得与其他操作复用目标 |
| `headers`           | 可选，沿用 RNFS 的类型；调用开始时复制并固定         |
| `maxBytes`          | 可选，非负安全整数；不传时不增加本库大小上限         |
| `connectionTimeout` | 可选，正数，毫秒；仅 Android 实现独立连接超时        |
| `readTimeout`       | 可选，正数，毫秒；遵循已采用 RNFS 的平台行为         |

超时不传时使用 SDK 默认值。Android 手动重定向分支没有完整继承传入的连接／读取超时；iOS 没有独立 `connectionTimeout`。不能将参数已传入等同于所有重定向路径都受同一超时控制。

认证头和请求目标由宿主根据当前身份取得和限制。函数不会持久化请求头；不要把凭据放入 URL、错误展示或诊断内容。

## 用法与进度

以下 `sourceUrl`、`targetUri` 由宿主提供，目标为本次下载独占：

```ts
import { downloadLocalFile } from '@unif/react-native-files';

const controller = new AbortController();
const result = await downloadLocalFile(
  { sourceUrl, targetUri, maxBytes: 10 * 1024 * 1024 },
  {
    signal: controller.signal,
    onProgress(progress) {
      // bytesWritten 是有效写入字节；totalBytes 可能不存在。
      console.log(progress.bytesWritten, progress.totalBytes);
    },
  },
);

if (result.status === 'success') {
  // result.uri、result.sizeBytes、result.statusCode 属于本次成功交付。
} else if (result.status === 'failed') {
  console.warn(result.error.message);
}
```

示例的 10 MiB 是该调用选择的限制，不是库默认值。交互可以在等待期间调用 `controller.abort()`。

`onProgress` 接收只读 `LocalDownloadProgress`。`bytesWritten` 为有效的非负安全整数；总长度未知、无效或小于已写入量时省略 `totalBytes`，不补为零。无效事件被忽略，观察者抛错也不改变下载结果。进度达到 100% 不代表文件已经成功交付。

## 终态与清理

| 结果                    | 含义                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| `success`               | 取得明确的 2xx HTTP 状态，目标实际落地为普通文件，真实 `sizeBytes` 有效且未超限 |
| `cancelled`             | 本次调用被取消；调用前已取消则不发起 I/O                                        |
| `failed` + `http`       | 有效非 2xx 回执，错误含真实 `statusCode`                                        |
| `failed` + `size_limit` | 开始／进度报告或最终文件大小表明超限                                            |
| `failed` + 其他原因     | 输入、平台或 I/O 失败；不会补出虚构的 HTTP 200                                  |

调用方无需重复读取大小确认下载落地。成功表示本次响应内容被保存，不额外保证整份远端资源的一致性或校验和；2xx 中包括分段响应。

取消和超限仅请求停止本次 SDK job。停止请求不等于原生已经停止写入；本调用继续接收原生终态并处理未成功目标。已决定的结果不被迟到回调或后来的取消改写。

未交付成功前，本函数负责本次新目标的清理，不删除已有目标、其他调用或源文件。清理失败保留诊断，不覆盖原终态，也不保证取消或失败后没有残留。成功交付后由调用方使用和释放；后来的取消不会删除成功文件。

采用 RNFS 2.41.0 时，宿主维护并显式应用下载结束交接和目标核实所需修正，再核对实际解析的 SDK 副本；本包不分发补丁。步骤见[宿主接入](../host-setup.md)，完整类型见[公开类型](types.md)。
