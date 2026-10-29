# @unif/react-native-files

React Native 本地文件读写、复制、删除、目录统计与清理、单文件下载，以及应用内 HTTP 资源访问。文件用途、目录分配、身份隔离和释放时机由宿主应用决定。

[文档站](https://unif-design.github.io/react-native-files/) · [npm](https://www.npmjs.com/package/@unif/react-native-files) · [API](docs/api/overview.md) · [原生示例](example) · [MIT 许可证](LICENSE)

## 平台

库本体使用 TypeScript／JavaScript，iOS 和 Android 文件能力依赖宿主安装的原生包。需要重新编译原生应用，不能用 Expo Go 或浏览器演示代替原生验证。

Web 文件操作返回 `unsupported`，`getNativeTemporaryRoot()` 返回 `undefined`；`createLocalFileLifetime()` 仍可使用。资源访问和预取消下载的具体结果见[平台边界](docs/intro.md)。

## 安装

可安装版本以 npm 实际发布记录为准。

```sh
npm install @unif/react-native-files @unif/react-native-logger@0.1.3 \
  @dr.pogodin/react-native-fs@2.41.0 \
  @dr.pogodin/react-native-static-server@0.28.1 \
  react-native-blob-util@0.25.1
```

Peer 要求为 React `>=19.3.0`、React Native `>=0.88.0`、Logger `^0.1.3`，以及上述三个精确版本的原生依赖。本仓开发基线为 React 19.3.1／React Native 0.88.1。URL polyfill 4.0.0 由本包作为普通依赖安装。

宿主从自己统一维护的补丁源取得对应修正，通过宿主流程显式应用，并核对消费应用实际解析的 SDK 副本。完成后安装 iOS Pods，重新编译 iOS／Android 应用：

```sh
cd ios && bundle exec pod install
```

本库不保存或分发 SDK 补丁，也不自动修改消费者依赖。当前 RNFS 2.41.0 与 StaticServer 0.28.1 的必要修正由宿主统一维护和应用；元数据、递归删除、下载真实终态及原生构建要求见[宿主接入](docs/host-setup.md)。

## 最小用法

```ts
import {
  getNativeTemporaryRoot,
  readLocalFile,
  writeLocalFile,
} from '@unif/react-native-files';

const root = getNativeTemporaryRoot();
if (root) {
  // 示例目录由当前应用拥有；写入会覆盖同一目标的内容。
  const uri = `${root}/files-example/note.txt`;
  const written = await writeLocalFile({ uri, content: '你好，Unif Files' });
  if (written.status === 'success') {
    const read = await readLocalFile({ uri: written.uri, encoding: 'utf8' });
    if (read.status === 'failed') {
      console.warn(read.error.message);
    }
  } else {
    console.warn(written.error.message);
  }
}
```

`getNativeTemporaryRoot()` 保留 iOS `LibraryDir`／Android `DocumentDir` 的根选择，不创建业务子目录，也不自动清理文件。所有本地输入使用正确编码的绝对 `file://` URI。

## API 与示例

- [文件与目录](docs/api/file-operations.md)：读写、大小、复制、单文件删除和明确目录清理。
- [单文件下载](docs/api/download.md)：进度、取消、大小限制、真实文件交付和失败清理。
- [本地资源访问](docs/api/local-resources.md)：共享回环服务、根目录映射与关闭。
- [文件使用期](docs/api/lifetime.md)：根目录和按文件持有、退休、释放。
- [公开类型](docs/api/types.md)：全部输入、结果与生命周期接口。
- [原生 example](example)：使用公开入口的 iOS／Android 运行示例；[研发入口](docs/DEVELOPMENT.md)说明分层验证。

目录清理前，宿主须确认目录范围并停止相关写入和使用。下载、复制成功后的文件归调用方；失败清理不承诺磁盘一定没有残留。本站和文档不代表 npm 发布、设备验证或业务验收已完成。
