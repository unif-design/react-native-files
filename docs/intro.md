---
title: 介绍
description: React Native 文件工具库，支持 iOS 和 Android。
---

# 介绍

`@unif/react-native-files` 是 React Native 文件工具库，提供文件读写、下载、目录清理和本地 HTTP 访问。

## 功能

| 能力             | 公开函数                                                           |
| ---------------- | ------------------------------------------------------------------ |
| 读写文件         | `readLocalFile`、`writeLocalFile`                                  |
| 复制与删除       | `copyLocalFile`、`deleteLocalFile`                                 |
| 大小与目录清理   | `getLocalFileSize`、`getLocalDirectorySize`、`clearLocalDirectory` |
| 下载             | `downloadLocalFile`                                                |
| 应用内 HTTP 访问 | `createLocalResourceAccess`                                        |
| 延迟清理文件     | `createLocalFileLifetime`                                          |
| 获取目录路径     | `getNativeTemporaryRoot`                                           |

## 支持平台

iOS 和 Android 应用需安装原生依赖、应用必要的 SDK 补丁并重新编译。详细步骤见[安装配置](host-setup.md)；运行示例见仓库 [example](https://github.com/unif-design/react-native-files/tree/main/example)。Expo Go 不支持本库所需的原生依赖。

Web 不支持实际文件操作：

- 读写、复制、删除、大小和目录清理返回 `failed`，`error.reason` 为 `unsupported`。
- 下载在调用前已取消时返回 `cancelled`，否则返回 `failed`，原因为 `unsupported`。
- 本地资源访问保留参数校验，具体返回值见[本地资源访问](api/local-resources.md#web)。
- `getNativeTemporaryRoot()` 返回 `undefined`；`createLocalFileLifetime()` 可正常使用。

## 使用约定

本地文件使用绝对 `file://` URI。下载来源使用 HTTP(S) URL。相册引用和 `content://` 等地址需先转换为本地文件。

写入会覆盖已有文件；复制和下载要求目标文件尚不存在。删除或清理前，应确认文件不再被预览、上传等操作使用。

应用负责选择目录、控制文件访问权限和安排清理。上传、缓存策略、账号隔离及内容序列化由应用实现。

从[快速开始](quick-start.md)完成一次文件读写，或查阅 [API 总览](api/overview.md)。
