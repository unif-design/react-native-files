---
title: 概览
description: 本地文件、下载、资源访问与文件使用期的职责和平台范围。
---

# 本地文件能力

`@unif/react-native-files` 为 React Native 应用提供明确文件位置的操作。宿主选择文件用途、目标目录、访问范围和释放时机；库负责单次操作的校验、SDK 交接与结果表达。

| 能力             | 公开函数                                                           |
| ---------------- | ------------------------------------------------------------------ |
| 文件内容         | `readLocalFile`、`writeLocalFile`                                  |
| 文件交接         | `copyLocalFile`、`deleteLocalFile`                                 |
| 大小与目录清理   | `getLocalFileSize`、`getLocalDirectorySize`、`clearLocalDirectory` |
| 下载             | `downloadLocalFile`                                                |
| 应用内 HTTP 访问 | `createLocalResourceAccess`                                        |
| 文件使用期       | `createLocalFileLifetime`、`getNativeTemporaryRoot`                |

## 平台

iOS／Android 使用 RNFS、StaticServer 和 BlobUtil 的原生实现。库没有自有原生模块，消费应用负责安装依赖、应用宿主统一维护的必要补丁并重新原生构建。本库不保存或分发 SDK 补丁，详见[宿主接入](host-setup.md)。

Web 入口保留以下语义：

- 读写、复制、删除、大小和目录清理返回 `failed`，`error.reason` 为 `unsupported`。
- 下载在调用前已经取消时返回 `cancelled`；其他调用返回 `unsupported`。
- 资源访问对象仍校验根配置和路径：无效配置抛错、非法 URI 返回 `invalid_input`、根外路径返回 `outside_root`；合法请求返回 `unsupported`。`close()` 返回 `unsupported`，关闭后 `getUrl()` 返回 `io`。
- `getNativeTemporaryRoot()` 返回 `undefined`；`createLocalFileLifetime()` 的持有与退休逻辑不依赖原生能力，仍可使用。

文档站展示接口和原生运行入口。原生文件行为应在仓库 [example](https://github.com/unif-design/react-native-files/tree/main/example) 或实际宿主中验证，Expo Go 和 Web 不能替代这些验证。

## 文件与状态归属

本地操作接收绝对 `file://` URI。远程 HTTP(S) 地址只交给下载函数；相册或内容提供者的专有引用先由所属能力交接。业务序列化、账号隔离、上传、缓存分类和恢复策略由对应场景维护。

写入会覆盖明确目标；复制和下载拒绝已有目标。单文件删除不清空目录；目录清理要求宿主确认整个目标范围，停止相关写入并处理仍在使用的资源。

结果按 `status` 区分成功、失败，以及下载取消或目录部分失败。成功路径是实际交付，错误 `cause` 供内部诊断，不直接转发到界面、外部协议或模型上下文。全部结构见[公开类型](api/types.md)。

从[快速开始](quick-start.md)接入，或直接查阅 [API 总览](api/overview.md)。
