import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Unif Files',
  tagline: 'React Native 文件工具库',
  url: 'https://unif-design.github.io',
  baseUrl: '/react-native-files/',
  organizationName: 'unif-design',
  projectName: 'react-native-files',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } },
  i18n: { defaultLocale: 'zh-Hans', locales: ['zh-Hans'] },
  presets: [
    [
      'classic',
      {
        docs: { path: '../docs', sidebarPath: './sidebars.ts' },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: { defaultMode: 'light', respectPrefersColorScheme: true },
    navbar: {
      title: 'Unif Files',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          label: '文档',
          position: 'left',
        },
        { to: '/docs/api/overview', label: 'API', position: 'left' },
        {
          href: 'https://github.com/unif-design/react-native-files',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: '文档',
          items: [
            { label: '快速开始', to: '/docs/quick-start' },
            { label: '安装配置', to: '/docs/host-setup' },
            { label: '开发指南', to: '/docs/development' },
          ],
        },
        {
          title: '资源',
          items: [
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@unif/react-native-files',
            },
            {
              label: '原生示例',
              href: 'https://github.com/unif-design/react-native-files/tree/main/example',
            },
            { label: 'LLM 文档', href: 'pathname:///llms.txt' },
          ],
        },
        {
          title: 'Unif 生态',
          items: [
            { label: '文档总站', href: 'https://unif.design' },
            {
              label: 'Design',
              href: 'https://unif-design.github.io/react-native-design/',
            },
            {
              label: 'Logger',
              href: 'https://unif-design.github.io/react-native-logger/',
            },
            {
              label: 'Camera',
              href: 'https://unif-design.github.io/react-native-camera/',
            },
          ],
        },
      ],
      copyright: '@unif/react-native-files · MIT',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
