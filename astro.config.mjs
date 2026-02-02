import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.myfate.org',
  integrations: [
    starlight({
      title: 'MYFATE',
      description: '八字四柱命理参考文档',
      defaultLocale: 'root',
      locales: {
        root: {
          label: '中文',
          lang: 'zh-CN',
        },
      },
      social: [
        { icon: 'external', label: '应用', href: 'https://myfate.org' },
        { icon: 'github', label: 'GitHub', href: 'https://github.com/HayatoKanee/myfate-docs' },
      ],
      sidebar: [
        {
          label: '基础知识',
          items: [
            { label: '阴阳', slug: 'basics/yinyang' },
            { label: '五行', slug: 'basics/wuxing' },
            { label: '天干', slug: 'basics/tiangan' },
            { label: '地支', slug: 'basics/dizhi' },
            { label: '干支', slug: 'basics/ganzhi' },
            { label: '八字', slug: 'basics/bazi' },
          ],
        },
        {
          label: '进阶概念',
          items: [
            { label: '旺相休囚死', slug: 'advanced/wangxiang' },
            { label: '十神', slug: 'advanced/shishen' },
            { label: '生耗值', slug: 'advanced/shenghao' },
            { label: '特殊格局', slug: 'advanced/teshu-geju' },
          ],
        },
        {
          label: '应用',
          items: [
            { label: '八字排盘', link: 'https://myfate.org' },
          ],
        },
      ],
      customCss: [
        './src/styles/custom.css',
      ],
      // Disable default features we don't need
      editLink: {
        baseUrl: 'https://github.com/HayatoKanee/myfate-docs/edit/main/',
      },
      lastUpdated: true,
    }),
  ],
});
