---
title: 本地资源访问
description: 通过本地 HTTP 服务访问指定目录中的文件。
---

# createLocalResourceAccess

启动本地 HTTP 服务，为指定目录中的文件生成访问地址。适用于 WebView 等需要 HTTP URL 的组件。

```ts
declare function createLocalResourceAccess(
  input: LocalResourceAccessInput,
): LocalResourceAccess;
```

返回的对象提供 `getUrl(uri)` 和 `close()`。同一服务应由应用创建并共享，使用结束后统一关闭。

## 用法

`rootUri` 指定允许访问的目录，使用绝对 `file://` URI。创建对象时固定该目录，首次调用 `getUrl()` 才启动服务。

```ts
import { createLocalResourceAccess } from '@unif/react-native-files';

// fileUri 位于 rootUri 指定的目录中。
const access = createLocalResourceAccess({ rootUri });
const result = await access.getUrl(fileUri);
if (result.status === 'success') {
  // 将 result.url 作为 WebView 的加载地址。
} else {
  console.warn(result.error.message);
}
```

## 路径与结果

创建对象时，目录 URI 无效、路径包含双引号或以反斜杠结尾都会同步抛错；后两项受当前 StaticServer 配置格式限制。

`getUrl()` 先检查文件路径：无效 URI 返回 `invalid_input`，目录外的路径返回 `outside_root`，这两种情况均不启动服务。路径按目录边界判断，名称前缀相似的目录不会被误认为同一目录。生成的 URL 按路径段编码，支持中文、空格和百分号。

成功返回 `{ status: 'success', url }`，表示服务已启动且地址已生成。函数不检查文件是否存在，也不测试 HTTP 请求或 WebView 加载结果。地址仅在服务运行、文件仍可访问时有效。

路径检查不解析符号链接的真实目标。应用需控制目录内容和访问权限，不能用它隔离不可信文件。

## 服务行为

服务只监听 `127.0.0.1`，端口自动分配；并发请求共用一次启动。启动失败后，再次调用 `getUrl()` 会重试，不会在后台自动重启。

同一时间只支持一个目录的服务。已有其他对象占用 StaticServer 时返回 `io`，不会停止或接管该服务。

## 关闭

```ts
const closed = await access.close();
if (closed.status === 'failed') {
  console.warn(closed.error.message);
}
```

所有使用者结束后再调用 `close()`。关闭开始后，新请求及正在等待启动的请求都不会返回成功；文件和目录不会被删除。

`close()` 等待服务停止，重复调用返回同一个 Promise。服务未启动时也可成功关闭。停止失败返回 `failed`，端口可能仍被占用；再次调用不会重试，关闭后的对象也不能重新启动。

## Web

Web 保留配置和路径检查：配置无效时抛错，非法文件 URI 返回 `invalid_input`，目录外路径返回 `outside_root`。合法的 `getUrl()` 和 `close()` 返回 `unsupported`，关闭后的 `getUrl()` 返回 `io`。

完整结果见[类型参考](types.md)，配置失败时参阅[常见问题](../troubleshooting.md)。
