import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import '@unif/react-native-design/docs-home.css';

export default function Home(): ReactNode {
  return (
    <Layout
      title="React Native 文件工具库"
      description="为 iOS 和 Android 应用提供文件读写、下载、目录清理和本地 HTTP 访问。"
    >
      <main className="unif-home files-home">
        <section className="hp-hero files-container">
          <span className="hp-eyebrow">Unif React Native</span>
          <h1 className="hp-title">
            React Native
            <br />
            <span className="accent">文件工具库</span>
          </h1>
          <p className="hp-tagline">
            为 iOS 和 Android 应用提供文件读写、下载、目录清理和本地 HTTP 访问。
          </p>
          <div className="hp-cta-row">
            <Link className="hp-btn hp-btn-primary" to="/docs/quick-start">
              快速开始
            </Link>
            <Link className="hp-btn hp-btn-outline" to="/docs/api/overview">
              查看 API
            </Link>
          </div>
        </section>
        <section
          className="files-container files-features"
          aria-label="核心能力"
        >
          <article>
            <h2>文件与目录</h2>
            <p>读取、写入、复制和删除文件，统计目录大小或清空目录。</p>
            <Link to="/docs/api/file-operations">了解文件操作 →</Link>
          </article>
          <article>
            <h2>文件下载</h2>
            <p>将 HTTP(S) 文件下载到本地，支持进度、取消和大小限制。</p>
            <Link to="/docs/api/download">了解文件下载 →</Link>
          </article>
          <article>
            <h2>本地资源访问</h2>
            <p>
              通过本地 HTTP 服务访问指定目录中的文件，适用于 WebView 加载资源。
            </p>
            <Link to="/docs/api/local-resources">了解本地访问 →</Link>
          </article>
        </section>
        <section className="files-container files-example">
          <h2>写入一个文件</h2>
          <pre>
            <code>{`import {
  getNativeTemporaryRoot,
  writeLocalFile,
} from '@unif/react-native-files';

const root = getNativeTemporaryRoot();
if (root) {
  const result = await writeLocalFile({
    uri: \`\${root}/notes/hello.txt\`,
    content: '你好，Unif Files',
  });
  if (result.status === 'failed') {
    console.warn(result.error.message);
  }
}`}</code>
          </pre>
          <p>按 UTF-8 写入，自动创建父目录。文件已存在时会覆盖原内容。</p>
          <Link to="/docs/api/lifetime">
            多个组件使用同一文件时，如何安排清理？ →
          </Link>
          <p className="files-native-note">
            使用前需安装原生依赖并应用 SDK 补丁。参阅
            <Link to="/docs/host-setup">安装配置</Link>或运行
            <Link to="https://github.com/unif-design/react-native-files/tree/main/example">
              原生示例
            </Link>
            。
          </p>
        </section>
      </main>
    </Layout>
  );
}
