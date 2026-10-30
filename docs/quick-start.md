---
title: 快速开始
description: 安装依赖，写入并读取一个文本文件。
---

# 快速开始

## 安装

在 React Native 项目中安装本库及依赖：

```sh
npm install @unif/react-native-files @unif/react-native-logger@0.1.3 \
  @dr.pogodin/react-native-fs@2.41.0 \
  @dr.pogodin/react-native-static-server@0.28.1 \
  react-native-blob-util@0.25.1
```

按[安装配置](host-setup.md)应用必要的 SDK 补丁。本库不附带或自动应用补丁；安装 npm 包后仍需完成这一步。

iOS 项目还需安装 Pods：

```sh
cd ios && bundle exec pod install
```

最后重新编译 iOS 或 Android 应用。版本要求和本地 HTTP 配置见[安装配置](host-setup.md)。

## 读写文本

下面在应用目录中创建 `files-example/note.txt`，然后读取内容：

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
      console.log(read.content); // 你好，Unif Files
    } else {
      console.warn(read.error.message);
    }
  } else {
    console.warn(written.error.message);
  }
}
```

`getNativeTemporaryRoot()` 返回 iOS Library 目录或 Android 应用内部文件目录的 URI；路径不可用时返回 `undefined`。请在返回目录下创建自己的子目录，库不会自动分配或清理文件。详情见[目录路径](api/lifetime.md#getnativetemporaryroot)。

写入使用 UTF-8，会创建父目录并覆盖已有文件。读取需指定 `utf8` 或 `base64`；空文件返回空字符串。写入不是原子替换，失败时不会回滚原内容。

## 处理结果

通过 `result.status` 判断结果，成功后再使用文件。复制和下载要求目标文件尚不存在，且同一目标不能同时被其他操作写入。

文件使用结束后由应用删除。多个组件共用文件时，可用[延迟清理](api/lifetime.md)等待所有使用者结束后再删除。

继续阅读[文件与目录](api/file-operations.md)、[文件下载](api/download.md)或[本地资源访问](api/local-resources.md)。
