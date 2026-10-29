# Files 原生示例

真实 React Native iOS／Android 宿主，从 `@unif/react-native-files` 公共入口验证文件操作、下载、文件持有和回环 HTTP。运行前完成[宿主接入](../docs/host-setup.md)：精确 SDK 版本、由宿主唯一来源显式应用的补丁、实际依赖副本核对及原生重建都是前置条件。库安装不会自动打补丁，Expo Go 和 Web 不能替代此示例。

在库根目录安装依赖并准备宿主补丁后执行：

```sh
yarn check:native-patches --patch-dir <宿主补丁目录>
yarn example start
yarn example android
```

iOS 先在 `example/` 执行 `bundle install`、`bundle exec pod install --project-directory=ios`，再从根目录执行 `yarn example ios`。Android release 仅放行回环地址 `127.0.0.1`；debug 保留 Metro 的开发网络访问。

点击“运行原生验证”只操作本应用根下的 `UnifFilesExample` 目录，验证读写、路径编码、实际大小、复制拒绝覆盖、回环读取、下载与预取消、单文件删除、持有后清理以及目录根保留，结束时关闭服务并清理示例文件。失败会显示实际步骤错误，不宣称验证通过。

该交互没有覆盖所有在途取消或外部并发场景；对应时序由行为测试覆盖，设备和实际业务验收仍应按消费场景执行。若要验证 npm 产物，先使用根目录 `yarn check:consumer` 创建独立宿主，再由宿主准备其补丁并执行同样的验证。
