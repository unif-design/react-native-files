---
id: development
slug: /development
title: 开发指南
description: 工程规范、文档维护、构建与测试。
---

# 开发指南

本页面向库维护者。应用接入请先阅读[快速开始](quick-start.md)和[安装配置](host-setup.md)。

## 规范与实现依据

本库使用 `create-react-native-library` 的 JavaScript 模板，版本见根 `package.json`。文件操作依赖原生 SDK，本库没有自有原生模块。`example` 提供 iOS／Android 应用。

工程标准采用 [unif-design/.github](https://github.com/unif-design/.github) 的 `a29d71586a63a1b39d9a3acc446741289150ac41` 修订。CI、发布、Agent 入口和 LLM 生成器按 [ONBOARDING](https://github.com/unif-design/.github/blob/main/ONBOARDING.md) 同步，统一在组织标准中维护。

开发使用 `unif-portal-dev-skills` 的 `code-development`，测试、审查和交付分别使用 `code-testing`、`code-review`、`code-delivery`。Files API 以本仓源码和文档为准。

行为契约：

- [文件读写与目录操作](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/files.md)
- [单文件复制、删除与持有](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/local-media-files.md)
- [单文件下载](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/file-download.md)
- [本地资源访问](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/local-resources.md)

## 代码与接口

`src/index.ts` 是原生入口，`src/index.web.ts` 是 Web 入口。修改 API 时同步类型、npm exports、文档和 example。业务目录、账号、上传、草稿及外部协议转换由应用实现。

根目录使用 iOS `LibraryDir`／Android `DocumentDir`。复制和下载路径、目录清理范围、服务关闭时机由应用指定，不在库中增加账号状态、业务目录或重试队列。

日志使用应用共享的 `@unif/react-native-logger`。SDK 补丁由应用统一维护和应用，本库不保存、分发或自动安装补丁。版本与修正要求见[安装配置](host-setup.md)。

## 文档与网站

Markdown 源文件位于 `docs/`，Docusaurus 直接读取；`website/docs` 指向同一目录，供 LLM 生成器使用。首页采用 `@unif/react-native-design` 1.13.6 的 `docs-home.css`。

LLM 生成器由组织 `templates/llms/` 维护，通过 `scripts/sync-repo.sh` 或 `scripts/sync-llms.cjs` 同步。修改 Markdown 后重新构建，生成 `llms.txt`、`llms-full.txt` 和 `md/`；生成产物不入库，也不手工修改。

## 本地检查

使用仓库指定的 Yarn 版本，在根目录执行：

```sh
yarn install --immutable
yarn lint
yarn typecheck
yarn test --runInBand
yarn build
yarn website test
yarn website typecheck
yarn website build
```

`typecheck` 检查库和 example。测试需覆盖失败、部分删除、文件状态、下载取消和超限、服务关闭及重复释放；仅对外部 SDK 使用测试替身。

运行 `yarn test:sdk` 或原生验证前，由应用配置补丁，并检查实际加载的 SDK 版本和文件内容。

分发检查需覆盖 tarball 的导出、类型和文件清单，并从 tarball 安装后测试。网站检查构建、链接、桌面与窄屏、明暗主题、导航和刷新。

`yarn check:consumer` 在仓库外创建全新应用，从 tarball 安装并检查公开类型和 Web 入口，不应用 SDK 补丁。完成应用侧补丁配置后，运行：

```sh
yarn check:native-patches --patch-dir <应用补丁目录> --consumer <消费应用目录>
```

该命令只读核对应用和 Files 实际加载的 SDK 副本。通过后，再进行双端构建和设备检查。

## 原生与交付验证

在 [example](https://github.com/unif-design/react-native-files/tree/main/example) 中验证文件读写、路径编码、目录统计与清理、下载与取消、本地 HTTP 加载与关闭。使用实际原生依赖和已配置补丁的应用。

分别记录静态检查、测试、构建、设备运行和业务验收结果；发布时另核对 npm 产物、CI、GitHub Release 和线上文档。保留有效设计和验收结论，原始日志及个人设备记录保存在仓库外。
