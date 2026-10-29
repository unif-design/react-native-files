---
title: 文件使用期与根目录
description: 按文件持有、退休、释放，以及原生根 URI 的平台选择。
---

# 文件使用期与根目录

## createLocalFileLifetime

```ts
declare function createLocalFileLifetime(
  cleanup: () => void,
): LocalFileLifetime;
```

为单个文件维护持有数量。每个读取者或预览分别调用 `retain()`，得到独立且幂等的释放函数；业务结束对该文件的使用时调用 `retire()`。

只有文件已退休且所有持有都释放后，才调用一次 `cleanup`。退休但仍有持有时可以交接新的持有；清理开始后 `retain()` 返回 `undefined`。重复释放旧持有不会减少新持有，重复退休不会再次清理。

以下 `uri` 归当前场景所有，`onCleanupResult` 由宿主处理删除结果：

```ts
import {
  createLocalFileLifetime,
  deleteLocalFile,
} from '@unif/react-native-files';

const lifetime = createLocalFileLifetime(() => {
  void deleteLocalFile(uri).then(onCleanupResult);
});
const releasePreview = lifetime.retain();

lifetime.retire(); // 结束业务使用，已有预览仍持有文件。
releasePreview?.(); // 预览实际结束，最后一个持有释放后才开始清理。
releasePreview?.(); // 重复回调无副作用。
```

清理回调类型为 `() => void`，对象不等待异步删除，也不保存删除结果或自动重试。宿主处理异步失败；同步抛错会传回触发清理的 `retire()` 或释放函数，不会触发第二次清理。

上传持有在实际 SDK 通知源读取已结束时释放。取消请求、页面关闭和上传 Promise 完成不自动代表 SDK 已停止读取。该对象不查询业务状态、停止上传或管理全局文件集合。

生命周期逻辑可在 Web 使用，不意味着 Web 已支持真实文件删除。

## getNativeTemporaryRoot

```ts
declare function getNativeTemporaryRoot(): string | undefined;
```

| 平台            | 根来源                         |
| --------------- | ------------------------------ |
| iOS             | BlobUtil `fs.dirs.LibraryDir`  |
| Android         | BlobUtil `fs.dirs.DocumentDir` |
| Web／不可用路径 | `undefined`                    |

函数验证原生根为有效绝对路径后逐段编码为 `file://` URI。名称不意味着使用平台缓存目录、自动过期或永久保存；库保留上述根选择，不创建业务子目录，不自动清理。

宿主在根下明确分配自己拥有的目录和独占文件。目录清理不能直接将这个共享根作为默认范围。完整对象结构见[公开类型](types.md)。
