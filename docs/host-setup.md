---
title: 宿主与补丁
description: 原生依赖、必需补丁、共享日志运行时和宿主的文件责任。
---

# 宿主与补丁

## 依赖接线

本包是 JavaScript 库，文件能力使用现有原生 SDK。宿主安装 peer 依赖并完成原生自动链接、iOS Pods 和应用重新编译。

| 依赖                                     | 公开要求    | 开发基线 |
| ---------------------------------------- | ----------- | -------- |
| `react`                                  | `>=19.3.0`  | 19.3.1   |
| `react-native`                           | `>=0.88.0`  | 0.88.1   |
| `@dr.pogodin/react-native-fs`            | 精确 2.41.0 | 2.41.0   |
| `@dr.pogodin/react-native-static-server` | 精确 0.28.1 | 0.28.1   |
| `react-native-blob-util`                 | 精确 0.25.1 | 0.25.1   |
| `@unif/react-native-logger`              | `^0.1.3`    | 0.1.3    |

`react-native-url-polyfill` 4.0.0 是本包的普通依赖，消费者无需另行安装或设置全局 URL 替换。版本范围不证明所有组合都已经过原生或设备验证。

没有额外的文件 Provider 或库级初始化函数。根目录、资源服务实例和业务生命周期按实际入口组合；消费示例见[快速开始](quick-start.md)。

## 宿主维护的 SDK 修正

本库不保存或随 npm 包分发 SDK 补丁，也不自动修改消费者依赖。补丁由宿主在统一来源维护和应用。采用当前 SDK 基线时，需要保持以下能力：

| SDK 与版本                                      | 必要修正                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@dr.pogodin/react-native-fs` 2.41.0            | 真实文件元数据与错误交付、目录项判断和递归删除；下载取消／失败等待原生真实终态，保留目标落地错误与任务释放 |
| `@dr.pogodin/react-native-static-server` 0.28.1 | Windows 宿主构建 Android 时 lighttpd 的 CMake PCRE2／glob 链接修正                                         |

RNFS 的 Android 递归删除使用 `lstat` 识别节点，只递归真实目录；符号链接删除链接本身。该修正不提供外部并发重命名或写入下的事务隔离，也不把一般文件路径检查变成真实路径沙箱。

下载停止请求必须与原生真实终态交接，结束后才清理未交付目标。缺失或不可用的元数据不能用虚构大小代替；递归删除和下载任务释放也不能仅由 JavaScript 标记模拟。

宿主按以下顺序接入：

1. 安装精确版本的依赖，准备真实消费应用。
2. 从宿主统一维护的来源取得对应补丁，通过宿主已有机制显式应用；同版本存在不同内容时先审查冲突，不覆盖差异或跳过失败。
3. 从应用与 Files 的实际解析位置检查 SDK 版本及修正内容。依赖存在多份安装副本时，确认 JavaScript 消费和原生构建实际使用的副本，不能只检查顶层清单。
4. 重新安装 Pods、重新构建原生应用，并验证实际文件与网络行为。干净安装和 CI 也应执行相同的宿主补丁与核对流程。

宿主统一管理包含 BlobUtil 在内的其他 SDK 修正。Files 不为这些依赖另建补丁来源，也不在其他库中重复保存补丁。

## 共享日志运行时

复制失败清理与下载停止／清理诊断使用 `@unif/react-native-logger` 根入口，scope 为 `files.localMedia` 和 `files.download`。logger 是 peer，宿主与本库使用同一运行时实例。

宿主按 [Logger 文档](https://unif-design.github.io/react-native-logger/docs/quick-start)统一安装日志策略、存储和身份；本库不自行安装 logger、不切换身份、不创建日志目录。不要给每个文件操作安装一套运行时。日志用于诊断，不替代文件函数返回的结果。

## 宿主责任与验证

本地资源服务返回 `http://127.0.0.1:<port>`。Android release 宿主需要在网络安全配置中显式允许这个回环地址，并从 `AndroidManifest.xml` 的 `android:networkSecurityConfig` 引用；不要仅凭 debug 的 Metro 网络策略判定 release 可用。可沿用 [example 的精确地址配置](https://github.com/unif-design/react-native-files/blob/main/example/android/app/src/main/res/xml/network_security_config.xml)，无需全局开放远端 HTTP。平台规则见 [Android 网络安全配置](https://developer.android.com/privacy-and-security/security-config#cleartext-traffic)。iOS 按宿主既有 ATS 策略配置本地访问，分别验证最终构建中的实际 HTTP 请求与 WebView 加载。

- 在自己拥有的目录分配目标，检查来自外部协议的路径和权限，不直接使用任意不可信 URI。
- 清理目录前确认完整范围，停止相关写入并处理上传、预览等持有者；不默认清空共享原生根。
- 将共享资源服务的关闭权保留在应用组装处，核对 WebView 的实际回环 HTTP 加载和应用前后台行为。
- 对实际 iOS／Android 工程验证原生链接、补丁、文件落地、取消和关闭。JS 构建、Web 返回值和测试替身不能代替这些结果。

具体失败诊断见[排障](troubleshooting.md)，开发与交付检查见[研发入口](DEVELOPMENT.md)。
