---
title: 本地资源访问
description: 按需启动的共享回环服务、根内 URL 映射与关闭结果。
---

# createLocalResourceAccess

```ts
declare function createLocalResourceAccess(
  input: LocalResourceAccessInput,
): LocalResourceAccess;
```

为明确的公开根目录创建访问对象，提供 `getUrl(uri)` 和 `close()`。应用持有一个共享对象及关闭权，页面或其他消费者使用其 `getUrl()`；不按每个请求创建新的服务。

## 配置与链接

`input.rootUri` 是宿主明确选择的绝对 `file://` 目录 URI，创建时按值取得。配置无效会同步抛错，创建本身不监听端口。当前 StaticServer 无法安全表示包含双引号或末尾反斜杠的根路径，这两种根配置也会抛错。

```ts
import { createLocalResourceAccess } from '@unif/react-native-files';

// rootUri 和 fileUri 来自宿主已确认的公开目录与文件。
const access = createLocalResourceAccess({ rootUri });
const result = await access.getUrl(fileUri);
if (result.status === 'success') {
  // 将 result.url 交给需要访问该本地资源的消费者。
} else {
  console.warn(result.error.message);
}
```

`getUrl()` 校验正规化路径与公开根的关系。非法 URI 返回 `invalid_input`，根外引用返回 `outside_root`，均不启动服务。相似目录名前缀不会被当作同一目录。合法相对路径逐段编码，保留中文、空格、百分号等名称的文件指向。

这项检查基于路径关系，不解析符号链接真实目标，不构成符号链接或真实路径的沙箱隔离。宿主必须控制公开目录内容和访问授权，不能将任意不可信路径视为已隔离文件。

## 服务生命周期

首次合法请求按需启动 StaticServer，仅监听 `127.0.0.1`，端口由原生 SDK 选择。并发请求共享同次启动结果；启动失败后，下一次显式 `getUrl()` 可以重试，没有后台轮询或自动重启。

成功表示服务就绪且 URL 构造完成，不会读取文件、调用 `stat` 或发 HTTP 探测。因此 `success` 不证明文件存在或 WebView 已加载。URL 随服务和文件的生命周期失效，不作为永久文件身份存储。

已有其他对象持有 SDK 服务时返回 `io`，不会接管或停止它。此接口不支持多根同时服务，不通过更换根目录抢占旧消费者。

## 关闭

```ts
const closed = await access.close();
if (closed.status === 'failed') {
  console.warn(closed.error.message);
}
```

宿主确认所有消费者结束后才关闭。关闭立即阻止新 URL 交付，也阻止等待启动的请求在关闭后返回成功；它不删除根目录或文件。

`close()` 等待 SDK 停止，重复调用复用同一次 Promise 和结果。未启动过服务的原生对象可以成功关闭。停止失败返回 `failed`，不能把清空 JS 引用当作端口已经释放；同一对象不会通过再次 `close()` 自动重试，也不能在关闭后重新开放。

Web 仍执行配置与路径校验，合法 `getUrl()` 和 `close()` 返回 `unsupported`，关闭后的 `getUrl()` 返回 `io`。完整结果见[公开类型](types.md)，典型错误原文见[排障](../troubleshooting.md)。
