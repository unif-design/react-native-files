---
title: 文件清理与目录路径
description: 等待文件使用结束后清理，获取应用目录 URI。
---

# 文件清理与目录路径

## createLocalFileLifetime

等待所有使用者结束后，再执行一次清理。适用于预览、上传等操作共用同一个文件的场景。

```ts
declare function createLocalFileLifetime(
  cleanup: () => void,
): LocalFileLifetime;
```

每个使用者调用 `retain()` 登记使用，结束时调用返回的释放函数。应用调用 `retire()` 将文件标记为待清理；所有使用者都释放后，才执行 `cleanup`。

```ts
import {
  createLocalFileLifetime,
  deleteLocalFile,
} from '@unif/react-native-files';

const lifetime = createLocalFileLifetime(() => {
  void deleteLocalFile(uri).then((result) => {
    if (result.status === 'failed') {
      console.warn(result.error.message);
    }
  });
});
const releasePreview = lifetime.retain(); // 预览开始使用文件。

lifetime.retire(); // 标记待清理，等待预览结束。
releasePreview?.(); // 预览结束时调用，此时开始清理。
releasePreview?.(); // 重复调用不会再次清理。
```

已标记待清理、但仍有使用者时，可以继续调用 `retain()`。清理一旦开始，`retain()` 返回 `undefined`。重复释放或调用 `retire()` 都不会重复清理。

`cleanup` 的类型为 `() => void`。库不等待异步删除，也不重试，应用需自行处理删除结果。同步异常会传回触发清理的 `retire()` 或释放函数。

释放函数应在 SDK 确认不再读取文件后调用。页面关闭、取消请求或上传 Promise 完成不一定表示文件读取已结束；本对象不会停止上传或查询业务状态。

此工具可在 Web 使用，但文件删除仍受平台支持范围限制。

## getNativeTemporaryRoot

获取应用目录的绝对 `file://` URI。

```ts
declare function getNativeTemporaryRoot(): string | undefined;
```

| 平台            | 根来源                         |
| --------------- | ------------------------------ |
| iOS             | BlobUtil `fs.dirs.LibraryDir`  |
| Android         | BlobUtil `fs.dirs.DocumentDir` |
| Web／不可用路径 | `undefined`                    |

返回值已经过路径编码。尽管名称含 `Temporary`，这里使用的是上表中的目录，不是系统缓存目录；库不会自动清理，也不保证文件永久保留。

请在返回目录下创建功能专属子目录，并自行管理文件。调用目录清理时使用该子目录，避免清空整个应用根目录。完整接口见[类型参考](types.md)。
