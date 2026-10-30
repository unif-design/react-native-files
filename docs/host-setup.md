---
title: 安装配置
description: 原生依赖、SDK 补丁、日志和本地 HTTP 配置。
---

# 安装配置

## 版本要求

本库通过原生 SDK 操作文件。安装 peer 依赖后，需完成原生自动链接、iOS Pods 安装并重新编译应用。

| 依赖                                     | 版本要求    | 验证基线 |
| ---------------------------------------- | ----------- | -------- |
| `react`                                  | `>=19.3.0`  | 19.3.1   |
| `react-native`                           | `>=0.88.0`  | 0.88.1   |
| `@dr.pogodin/react-native-fs`            | 精确 2.41.0 | 2.41.0   |
| `@dr.pogodin/react-native-static-server` | 精确 0.28.1 | 0.28.1   |
| `react-native-blob-util`                 | 精确 0.25.1 | 0.25.1   |
| `@unif/react-native-logger`              | `^0.1.3`    | 0.1.3    |

`react-native-url-polyfill` 4.0.0 随本包安装，无需另行配置全局 URL。表中验证基线不代表版本范围内的所有组合都已测试。

本库无需额外的 Provider 或初始化调用。用法见[快速开始](quick-start.md)。

## SDK 补丁

当前依赖需要以下修正。补丁由应用统一维护和应用，本库不附带或自动安装补丁。

| SDK 与版本                                      | 必要修正                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@dr.pogodin/react-native-fs` 2.41.0            | 文件大小与错误返回、目录项识别、递归删除；下载取消或失败时等待原生任务结束，正确报告写入错误并释放任务 |
| `@dr.pogodin/react-native-static-server` 0.28.1 | 修复 Windows 环境构建 Android 时 lighttpd 的 CMake PCRE2／glob 链接问题                                |

RNFS 的 Android 修正使用 `lstat` 判断目录，遇到符号链接时只删除链接本身，不递归目标。它不提供并发写入、重命名或符号链接的安全隔离。

下载修正确保原生任务结束后再清理失败文件，并正确报告无法取得的文件大小。这些原生修正不能用 JavaScript 状态标记代替。

配置顺序：

1. 安装上述版本的依赖。
2. 通过应用已有的补丁流程应用修正，先解决冲突或失败。
3. 检查应用和 Files 实际加载的 SDK 副本。存在多份依赖时，确认 JavaScript 和原生构建使用的副本均已修正。
4. 重新安装 Pods、编译应用，并验证文件操作、下载取消和本地 HTTP 访问。全新安装及 CI 使用同一补丁流程。

包括 BlobUtil 在内的其他 SDK 补丁也由应用统一管理，避免在多个库中重复维护。

## 日志

复制和下载的清理、停止错误使用 `@unif/react-native-logger` 记录，scope 为 `files.localMedia` 和 `files.download`。应用与本库应使用同一个 Logger 实例。

按 [Logger 文档](https://unif-design.github.io/react-native-logger/docs/quick-start)统一配置日志策略、存储和身份。Files 只记录日志，不初始化日志运行时或切换账号。操作是否成功仍以函数返回值为准。

## 本地 HTTP 访问

资源服务使用 `http://127.0.0.1:<port>`。Android release 构建需允许该地址的 HTTP 流量，并在 `AndroidManifest.xml` 中通过 `android:networkSecurityConfig` 引用配置。可参考 [example 配置](https://github.com/unif-design/react-native-files/blob/main/example/android/app/src/main/res/xml/network_security_config.xml)，只开放本地地址；debug 中的 Metro 网络配置不能代替 release 配置。平台说明见 [Android 文档](https://developer.android.com/privacy-and-security/security-config#cleartext-traffic)。

iOS 按应用的 ATS 策略配置本地访问。两个平台均需在最终构建中验证 HTTP 请求、WebView 加载和应用前后台切换。

## 文件管理

应用负责检查外部文件路径及权限，使用功能专属目录。清理前结束相关读写、上传和预览；不要直接清空整个应用根目录。本地 HTTP 服务由应用统一管理，所有使用者结束后再关闭。

配置后的原生行为需在 iOS／Android 应用中验证。常见错误见[常见问题](troubleshooting.md)，构建和测试步骤见[开发指南](DEVELOPMENT.md)。
