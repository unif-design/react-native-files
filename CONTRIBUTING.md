# 参与开发

本库维护可独立消费的文件公共能力。开发规范与契约入口见 [AGENTS.md](AGENTS.md) 和[研发入口](docs/DEVELOPMENT.md)，公开接入见 [README](README.md)。

使用仓库固定的 Node／Yarn 版本，运行 `yarn install --immutable`。SDK 补丁由宿主统一维护和显式应用；接线与验证前置见[宿主接入](docs/host-setup.md)，不得在库内再保存一套补丁。

提交前执行 `yarn typecheck`、`yarn lint`、`yarn test`、`yarn build`，根据实际影响验证 tarball 消费、文档站、原生宿主和设备。新公开 API 同步类型、文档、示例和消费者。测试预期来自既定契约，不为通过检查改变行为。

提交与 PR 使用中文 Conventional Commits，在 `codex/` 分支工作并经过组织 CI。普通版本不升级首位版本号；正式发布沿用机器人／OIDC，不从本机直接发布。保持无关工作区修改，计划、设计和有效验收依据不因任务完成而删除。
