# learn-pi 协作约定

这是独立本地教学仓库，执行范围以 `PROJECT_BRIEF.md` 为准。主实现只维护 TypeScript，扩展真实 Pi，不重写一个假的运行时。

- Pi 版本固定为 `0.85.1`；源码和 npm 对照见 `reports/version-lock.json`。升级前同时检查扩展、SDK、原生 CLI 与 RPC 的变化，不能直接引用 current main。
- 中文文档在 `docs/`，英文对应页在 `docs/en/`。内容、导航和实验保持对等；默认中文。
- 能力代码在 `src/extensions/course.ts` 注册，通过 `src/stages.ts` 累加。底层模块只维护一套。
- 模型、工具输出和项目文件不能提升权限。审批与路径过滤是应用策略，不是 OS 沙箱。对真实 Pi 的路径规范化必须有集成回归测试。
- 测试在仓库 `.cache/` 中创建可丢弃工作区。不得在课程源目录、上级仓库或用户任意 Git 仓库执行恢复实验。样例由 `npm run lab:reset` 生成。
- 无 Key 测试使用官方 fauxProvider 驱动真实 Pi；必须写明“脚本模型”，不得称为真实模型效果验证。在线实测入口 `npm run model:smoke` 没凭据必须记录 SKIPPED。
- 本仓库认证默认使用 `.cache/pi-agent` 或环境变量，不静默创建或修改用户全局 Pi 配置。禁止提交密钥和原始会话。
- 运行 `npm run verify`；代码变更影响集成时同时运行 `npm run demo`。网站视觉与语言切换需浏览器检查。
- 允许关键节点做本地 Git 提交。公开仓库、推送、部署或社媒发布必须另获明确指示。
