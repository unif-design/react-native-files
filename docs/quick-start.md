---
title: 快速开始
description: 安装原生依赖、应用必需补丁，并完成一次明确文件的读写。
---

# 快速开始

## 安装依赖与补丁

可安装版本以 [npm](https://www.npmjs.com/package/@unif/react-native-files) 为准。在 React Native 宿主安装：

```sh
npm install @unif/react-native-files @unif/react-native-logger@0.1.3 \
  @dr.pogodin/react-native-fs@2.41.0 \
  @dr.pogodin/react-native-static-server@0.28.1 \
  react-native-blob-util@0.25.1
```

本包不保存或分发 SDK 补丁，也不自动修改已安装的依赖。宿主按自身统一维护的补丁源和应用流程完成必要修正，再核对实际解析的依赖副本：

1. 确认 RNFS 2.41.0、StaticServer 0.28.1 及补丁对应版本，保留宿主已有流程。
2. 由宿主显式应用其维护的补丁，补丁冲突或失败时先处理差异。
3. 从实际消费者的解析位置核对 SDK 版本和修正内容，确认原生构建使用的副本一致。
4. 重新安装 iOS Pods，并重新编译 iOS／Android 应用。

```sh
cd ios && bundle exec pod install
```

随后重新编译 iOS／Android 应用。开发基线为 React 19.3.1、React Native 0.88.1；依赖范围不等于每个组合都已完成设备验证。原生版本、日志运行时和补丁说明见[宿主接入](host-setup.md)。

## 选择应用拥有的文件位置

```ts
import {
  getNativeTemporaryRoot,
  readLocalFile,
  writeLocalFile,
} from '@unif/react-native-files';

const root = getNativeTemporaryRoot();
if (root) {
  const uri = `${root}/files-example/note.txt`;
  const written = await writeLocalFile({ uri, content: '你好，Unif Files' });
  if (written.status === 'success') {
    const read = await readLocalFile({ uri: written.uri, encoding: 'utf8' });
    if (read.status === 'success') {
      // read.content 是文件文本；解析和使用方式由当前功能决定。
    } else {
      console.warn(read.error.message);
    }
  } else {
    console.warn(written.error.message);
  }
}
```

`root` 不可用时由宿主结束本次文件操作并给出场景反馈，不拼接 `undefined` 或回退到未经授权的目录。示例子目录只服务于当前示例；库不会替应用分配业务目录。

写入自动准备父目录并覆盖同一目标，没有原子替换或回滚保证。读取编码必须明确为 `utf8` 或 `base64`，空文件成功返回空字符串。

## 接收结果并安排释放

只在 `status === 'success'` 后使用交付的 URI。复制、下载需要调用方分配尚未存在的独占目标，不能与其他写入并发复用。

成功文件由调用方持有。涉及上传、预览等多个读取者时，使用[文件使用期](api/lifetime.md)在实际读取结束后释放；不以页面关闭、取消请求或上传 Promise 完成代替 SDK 的读取结束通知。

接下来可查阅[文件操作](api/file-operations.md)、[下载](api/download.md)、[本地资源访问](api/local-resources.md)和[排障](troubleshooting.md)。
