import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import '@unif/react-native-design/docs-home.css';

export default function Home(): ReactNode {
  return (
    <Layout
      title="本地文件、下载与资源访问"
      description="React Native 本地文件读写、目录操作、下载、回环资源访问与文件使用期管理。"
    >
      <main className="unif-home files-home">
        <section className="hp-hero files-container">
          <span className="hp-eyebrow">Unif React Native</span>
          <h1 className="hp-title">
            读写本地文件，
            <br />
            <span className="accent">按使用期释放。</span>
          </h1>
          <p className="hp-tagline">
            以明确的文件位置完成读写、下载和资源访问，让应用掌握目录范围、操作结果与释放时机。
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
            <p>读取、写入、复制和删除，按实际文件状态交付结果与目录占用。</p>
            <Link to="/docs/api/file-operations">了解文件操作 →</Link>
          </article>
          <article>
            <h2>单文件下载</h2>
            <p>从明确来源下载到独占目标，接收进度、取消、大小限制和终态。</p>
            <Link to="/docs/api/download">了解下载交接 →</Link>
          </article>
          <article>
            <h2>本地资源访问</h2>
            <p>按需启动共享回环服务，为公开根内的资源生成访问链接。</p>
            <Link to="/docs/api/local-resources">了解资源服务 →</Link>
          </article>
        </section>
        <section className="files-container files-example">
          <h2>写入明确目标，接收实际结果</h2>
          <pre>
            <code>{`import { writeLocalFile } from '@unif/react-native-files';

// targetUri 由应用在自己拥有的目录中分配。
const result = await writeLocalFile({
  uri: targetUri,
  content: '你好，Unif Files',
});

if (result.status === 'success') {
  // 使用已写入的 result.uri。
}`}</code>
          </pre>
          <p>
            同一目标的写入会覆盖原内容。多个读取者通过持有与退休交接文件，最后一个持有结束后才开始清理。
          </p>
          <Link to="/docs/api/lifetime">查看文件使用期 →</Link>
          <p className="files-native-note">
            文件能力在 iOS／Android 原生宿主运行，需要安装依赖和必需补丁。
            <Link to="/docs/host-setup">查看宿主接入</Link>，或从
            <Link to="/docs/development">原生示例</Link>开始验证。
          </p>
        </section>
      </main>
    </Layout>
  );
}
