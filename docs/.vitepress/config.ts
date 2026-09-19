import { defineConfig } from 'vitepress';

const chapters = [
  ['00-typescript', '00 · Python → TypeScript', '00 · Python → TypeScript'],
  ['01-pi', '01 · 认识真实 Pi', '01 · Meet the real Pi'],
  ['02-plan', '02 · 先探索，再执行', '02 · Explore, then execute'],
  ['03-tasks', '03 · 可恢复的任务清单', '03 · Recoverable tasks'],
  ['04-policy', '04 · 审批与路径边界', '04 · Approvals & paths'],
  ['05-mcp', '05 · 接入本地 MCP', '05 · A local MCP connection'],
  ['06-subagents', '06 · 分派与收敛', '06 · Delegate & converge'],
  ['07-coding', '07 · 编程与 Git 检查点', '07 · Code & checkpoints'],
  ['08-context', '08 · 上下文与隔离', '08 · Context & isolation'],
  ['09-sdk', '09 · 装配你的 Agent', '09 · Assemble your agent'],
];
const sidebar = (en = false) => {
  const prefix = en ? '/en/' : '/';
  return [
    { text: en ? 'Start here' : '从这里开始', items: [
      { text: en ? 'Quickstart' : '快速开始', link: `${prefix}guide/quickstart` },
      { text: en ? 'Learning route' : '学习路线', link: `${prefix}guide/route` },
      { text: en ? 'Architecture & code map' : '架构与源码地图', link: `${prefix}guide/architecture` },
    ] },
    { text: en ? 'The course · 00—09' : '课程 · 00—09', items: chapters.map(([path, zh, english]) => ({ text: en ? english : zh, link: `${prefix}chapters/${path}` })) },
    { text: en ? 'Workbench' : '实验工作台', items: [
      { text: en ? 'Labs & acceptance' : '实验与验收', link: `${prefix}guide/labs` },
      { text: en ? 'Design comparisons' : '设计对照', link: `${prefix}reference/comparison` },
      { text: en ? 'Versions & sources' : '版本与来源', link: `${prefix}reference/sources` },
      { text: en ? 'Python RPC reference' : 'Python RPC 进阶参考', link: `${prefix}reference/python-rpc` },
      { text: en ? 'Contributing' : '参与贡献', link: `${prefix}reference/contributing` },
    ] },
  ];
};

export default defineConfig({
  title: 'learn-pi',
  description: '从真实 Pi 出发，用 TypeScript 构建自己的编程 Agent。',
  cleanUrls: true,
  lastUpdated: false,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]],
  markdown: { lineNumbers: true },
  locales: {
    root: {
      label: '简体中文', lang: 'zh-CN',
      themeConfig: {
        nav: [{ text: '开始学习', link: '/guide/quickstart' }, { text: '课程', link: '/chapters/00-typescript' }, { text: '实验', link: '/guide/labs' }],
        sidebar: sidebar(),
        outline: { label: '本页内容', level: [2, 3] },
        docFooter: { prev: '上一页', next: '下一页' },
        sidebarMenuLabel: '课程目录', returnToTopLabel: '返回顶部', darkModeSwitchLabel: '显示模式',
        footer: { message: '真实运行时 · 可阅读的边界 · 可重复的实验', copyright: 'MIT · learn-pi contributors · 2026' },
      },
    },
    en: {
      label: 'English', lang: 'en', description: 'Extend the real Pi with TypeScript, one deliberate capability at a time.',
      themeConfig: {
        nav: [{ text: 'Get started', link: '/en/guide/quickstart' }, { text: 'Course', link: '/en/chapters/00-typescript' }, { text: 'Labs', link: '/en/guide/labs' }],
        sidebar: sidebar(true), outline: { label: 'On this page', level: [2, 3] },
        footer: { message: 'A real runtime. Readable boundaries. Repeatable experiments.', copyright: 'MIT · learn-pi contributors · 2026' },
      },
    },
  },
  themeConfig: {
    logo: '/favicon.svg', siteTitle: 'learn-pi',
    search: {
      provider: 'local',
      options: {
        locales: {
          root: { translations: {
            button: { buttonText: '搜索', buttonAriaLabel: '搜索课程' },
            modal: {
              displayDetails: '显示详细结果', resetButtonTitle: '清空搜索', backButtonTitle: '返回', noResultsText: '没有找到相关内容',
              footer: { selectText: '选择', selectKeyAriaLabel: '回车键', navigateText: '切换', navigateUpKeyAriaLabel: '向上', navigateDownKeyAriaLabel: '向下', closeText: '关闭', closeKeyAriaLabel: '退出键' },
            },
          } },
        },
      },
    },
  },
});
