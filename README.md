# @unif/react-native-files

React Native 文件工具库，提供文件读写、复制、下载、目录清理和本地 HTTP 访问。

[文档站](https://unif-design.github.io/react-native-files/) · [API](docs/api/overview.md) · [原生示例](example/README.md) · [npm](https://www.npmjs.com/package/@unif/react-native-files) · [MIT 许可证](LICENSE)

## 接入要求

iOS／Android 需要原生依赖、SDK 补丁和重新编译。Expo Go 不支持；Web 仅可使用文件生命周期工具，实际文件操作返回不支持，详见[平台说明](docs/intro.md#支持平台)。

| 依赖                   | 支持要求                | 本仓开发组合 |
| ---------------------- | ----------------------- | ------------ |
| React                  | `>=19.3.0`              | 19.3.1       |
| React Native           | `>=0.88.0`              | 0.88.1       |
| Logger                 | `^0.1.3`                | 0.1.3        |
| RNFS                   | 精确 2.41.0，需宿主补丁 | 2.41.0       |
| StaticServer           | 精确 0.28.1，需宿主补丁 | 0.28.1       |
| react-native-blob-util | 精确 0.25.1             | 0.25.1       |

完整依赖与补丁要求见[安装配置](docs/host-setup.md)。URL polyfill 随本包安装，无需另行配置；开发组合不代表全部版本组合已通过设备验证。

## 安装

1. 安装本库及 peer 依赖：

   ```sh
   npm install @unif/react-native-files @unif/react-native-logger@0.1.3 \
     @dr.pogodin/react-native-fs@2.41.0 \
     @dr.pogodin/react-native-static-server@0.28.1 \
     react-native-blob-util@0.25.1
   ```

2. 按[安装配置](docs/host-setup.md#sdk-补丁)应用宿主维护的 RNFS、StaticServer 补丁，核对实际使用的依赖副本。本库不附带或自动应用补丁。
3. iOS 安装 Pods，然后重新编译应用。需要本地 HTTP 访问时，一并完成[网络配置](docs/host-setup.md#本地-http-访问)。

本库无需额外的 Provider 或初始化调用。

## 写入一个文件

```ts
import {
  getNativeTemporaryRoot,
  writeLocalFile,
} from '@unif/react-native-files';

const root = getNativeTemporaryRoot();
if (root) {
  const result = await writeLocalFile({
    uri: `${root}/files-example/note.txt`,
    content: '你好，Unif Files',
  });
  if (result.status === 'success') {
    console.log(result.uri);
  } else {
    console.warn(result.error.message);
  }
}
```

写入使用 UTF-8，自动创建父目录并覆盖已有文件。`getNativeTemporaryRoot()` 返回 iOS Library 或 Android 应用内部文件目录的 URI，不是系统缓存目录；不可用时返回 `undefined`。动态文件名需按 URI 路径段编码。

应用自行安排清理，删除前应确认所有读写、预览和上传均已结束。复制、下载不覆盖已有目标；失败后的清理也可能失败，应按结果和日志处理残留文件。

## 更多用法

- [快速开始](docs/quick-start.md)：完整读写示例和结果处理。
- [文件与目录](docs/api/file-operations.md)、[文件下载](docs/api/download.md)：复制、删除、大小统计、目录清理、进度和取消。
- [本地 HTTP 访问](docs/api/local-resources.md)、[文件清理与目录路径](docs/api/lifetime.md)：服务关闭与共享文件的清理时机。
- [原生示例](example/README.md)与[开发指南](docs/DEVELOPMENT.md)：运行、构建和验证。
