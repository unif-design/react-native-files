---
id: development
slug: /development
title: 研发入口
description: 公开契约、工程规范、同源文档和分层验证。
---

# 研发入口

## 规范与实现依据

本库是 `create-react-native-library` 的 JavaScript 库形态，模板版本记录在根 `package.json`。库无自有 iOS／Android 模块；原生行为来自明确版本的 peer 和宿主维护的必要 SDK 修正，example 使用真实 React Native 宿主。

工程接入采用 [unif-design/.github](https://github.com/unif-design/.github) 的 [ONBOARDING](https://github.com/unif-design/.github/blob/main/ONBOARDING.md) 与同步流程，标准来源为 main 的 `a29d71586a63a1b39d9a3acc446741289150ac41`。共享 CI、发布、Agent 入口和 LLM 生成实现从组织标准同步，不在本库复制维护另一套规则。

开发使用 `unif-portal-dev-skills` 的 `code-development`，按工作内容取得 `code-testing`、`code-review` 和 `code-delivery`。本库的接口资料是本仓公开文档与源码，不编造 Files 专属技能名称。

公开行为依据以下平台契约，库文档将其组织为独立包的消费接口：

- [文件读写与目录操作](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/files.md)
- [单文件复制、删除与持有](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/local-media-files.md)
- [单文件下载](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/file-download.md)
- [本地资源访问](https://github.com/unif-design/unif-platform-architecture/blob/main/capabilities/local-resources.md)

## 公共入口与消费边界

`src/index.ts` 是原生公开入口，Web 入口保留相同 API 形状和已定义的不支持语义。源码、类型产物、npm exports、文档和 example 同步维护。业务目录、账号来源、上传、草稿和外部协议转换保留在宿主。

根目录选择保持 iOS `LibraryDir`／Android `DocumentDir`。复制与下载目标、目录清理范围和资源服务生命周期由调用方明确；库不引入账号状态、业务子目录、重试队列或额外默认限制。

日志只通过 `@unif/react-native-logger` 的公开根入口接入宿主共享运行时。SDK 补丁由宿主统一维护，本库不保存、镜像或随 npm 包分发补丁，不自动修改消费者依赖。RNFS 2.41.0、StaticServer 0.28.1 的必要修正及实际依赖副本核对见[宿主接入](host-setup.md)。

## 文档与网站

`docs/` 是 Markdown 唯一来源，Docusaurus 直接读取；`website/docs` 指向同一目录供共享 LLM 生成器使用。网站使用 `@unif/react-native-design` 1.13.6 的公开 `docs-home.css`，没有原生文件能力的 Web 模拟。

LLM 实现由组织 `templates/llms/` 维护，经 `scripts/sync-repo.sh` 或 `scripts/sync-llms.cjs` 下发。修改文档源后构建生成 `llms.txt`、`llms-full.txt` 和 `md/`，这些产物不入库。不要在本库另建生成器或直接编辑同步来的实现。

## 本地检查

从库根目录执行当前脚本；安装使用仓库固定的 Yarn 版本：

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

`typecheck` 包括库和 example 的源码消费。自动化验证应覆盖失败与部分成功、目标归属、真实文件状态核实、下载取消和超限终态、资源服务关闭以及重复释放；测试替身保持被测实现真实，只替换外部 SDK 边界。

SDK 与消费者验证先准备真实消费应用，再由宿主显式应用其统一维护的补丁，最后从实际解析位置核对 SDK 版本与修正。完成这项前置后运行 `yarn test:sdk` 等适用边界检查；库的准备或验证过程不代替宿主应用补丁。

分发另验真实 tarball 的公开导出、类型和文件清单，确认没有重复补丁，再以安装产物验证消费者。网站检查构建、链接、桌面／窄屏、明暗主题、导航和刷新。

`yarn check:consumer` 创建仓库外的全新消费者，从真实 tarball 安装并验证全部公开类型和 Web 入口；它不读取或应用宿主补丁，生成的记录会明确标记原生验收待完成。宿主从唯一维护源显式准备该消费者后，使用 `yarn check:native-patches --patch-dir <宿主补丁目录> --consumer <消费者目录>` 只读核对应用与 Files 实际解析的每份 SDK，再在该消费者执行双端构建与设备检查。普通依赖安装或未准备补丁的 CI 编译不能替代这一步。

## 原生与交付验证

仓库 [example](https://github.com/unif-design/react-native-files/tree/main/example) 通过包公开入口调用真实原生依赖。先确认补丁和原生依赖，再验证读写与路径编码、目录统计和授权清理、真实网络下载与停止、回环资源加载和关闭。

源码检查、自动化测试、JS bundle、原生编译、设备验证和真实业务验收分别记录。npm 发布、远端 CI、GitHub Release 和文档部署也各自核验；任何一层通过都不自动证明其他层已完成。保留有效设计与必要验收结论，原始日志和个人设备操作记录不作为公开文档内容。
