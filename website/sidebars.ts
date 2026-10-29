import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'quick-start',
    'host-setup',
    {
      type: 'category',
      label: 'API 参考',
      collapsed: false,
      items: [
        'api/overview',
        'api/file-operations',
        'api/download',
        'api/local-resources',
        'api/lifetime',
        'api/types',
      ],
    },
    'troubleshooting',
    'development',
  ],
};

export default sidebars;
