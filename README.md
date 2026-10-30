# @unif/react-native-files

React Native 文件工具库，为 iOS 和 Android 应用提供文件读写、下载、目录清理和本地 HTTP 访问。

[文档站](https://unif-design.github.io/react-native-files/) · [npm](https://www.npmjs.com/package/@unif/react-native-files) · [API](docs/api/overview.md) · [原生示例](example) · [MIT 许可证](LICENSE)

## 支持平台

iOS 和 Android 需安装原生依赖、应用 SDK 补丁并重新编译。Expo Go 不支持本库所需的原生依赖。

Web 不支持实际文件操作；文件清理工具 `createLocalFileLifetime()` 可使用。具体返回值见[平台说明](docs/intro.md)。

## 安装

```sh
npm install @unif/react-native-files @unif/react-native-logger@0.1.3 \
  @dr.pogodin/react-native-fs@2.41.0 \
  @dr.pogodin/react-native-static-server@0.28.1 \
  react-native-blob-util@0.25.1
```

要求 React `>=19.3.0`、React Native `>=0.88.0`、Logger `^0.1.3`，原生依赖使用命令中的精确版本。验证基线为 React 19.3.1／React Native 0.88.1。URL polyfill 4.0.0 随本包安装。

按[安装配置](docs/host-setup.md)应用必要的 RNFS 和 StaticServer 补丁。本库不附带或自动应用补丁。iOS 还需安装 Pods：

```sh
cd ios && bundle exec pod install
```

完成配置后重新编译应用。

## 用法

```ts
import {
  getNativeTemporaryRoot,
  readLocalFile,
  writeLocalFile,
} from '@unif/react-native-files';

const root = getNativeTemporaryRoot();
if (root) {
  // 自动创建父目录，覆盖已有文件。
  const uri = `${root}/files-example/note.txt`;
  const written = await writeLocalFile({ uri, content: '你好，Unif Files' });
  if (written.status === 'success') {
    const read = await readLocalFile({ uri: written.uri, encoding: 'utf8' });
    if (read.status === 'success') {
      console.log(read.content); // 你好，Unif Files
    } else {
      console.warn(read.error.message);
    }
  } else {
    console.warn(written.error.message);
  }
}
```

`getNativeTemporaryRoot()` 返回 iOS Library 目录或 Android 应用内部文件目录的 `file://` URI，路径不可用时返回 `undefined`。请为各项功能创建子目录，并自行安排清理。本地文件名按 URI 路径段编码。

## API 与示例

- [文件与目录](docs/api/file-operations.md)：读写、复制、删除、大小统计和目录清理。
- [文件下载](docs/api/download.md)：HTTP(S) 下载、进度、取消和大小限制。
- [本地资源访问](docs/api/local-resources.md)：通过本地 HTTP 服务访问文件。
- [文件清理与目录路径](docs/api/lifetime.md)：等待使用结束后清理文件，获取应用目录。
- [类型参考](docs/api/types.md)：参数、返回结果和错误定义。
- [原生示例](example)与[开发指南](docs/DEVELOPMENT.md)：运行示例、构建和测试。

应用负责文件访问权限和清理时机。删除前应结束相关读写；复制或下载失败后，清理也可能失败，需按返回结果和日志处理残留文件。
