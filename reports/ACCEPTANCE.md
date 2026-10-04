# learn-pi v1 本地验收报告

验收日期：2026-09-19。**课程、渐进代码、最终 Agent、双语站点与离线/真实 Pi 集成验收通过。远程模型效果和容器运行分别记录为未验证。** 本报告没有把脚本模型、配置文件或 CLI 启动当成真实模型任务成功。

[English report](ACCEPTANCE.en.md) · [机器可读结果](acceptance.json) · [版本证据](version-lock.json)

2026-09-30 续聊增量验收：新增显式 `--resume`，使用 Pi 原生会话接口恢复当前工作区最近活跃的对话。Node 24.16.0 下 `npm run verify`（48/48 测试）、`npm run demo` 与 CLI 帮助检查通过；详见 [续聊验收记录](session-resume.json)。

## 交付范围

仓库：`/Users/original/Project/github/personal_project/learn-pi`，独立 Git 仓库。所有项目文件和实验产物均限定在此目录。未修改 `learn-codex`、`learn-claude-code` 或工作区级设置，未配置远端、推送、公开部署或发布社媒。

- 一套 TypeScript 原生扩展实现，使用真实 `@earendil-works/pi-coding-agent@0.85.1`；SDK 装配入口为 `src/runtime.ts` / `src/cli.ts`。
- 00–09 共十章中英教程，包括 Python→TypeScript 前导课；两种语言各 19 页，完整导航、实验、架构图、来源、贡献说明与 Python RPC 进阶参考。
- 九个可独立运行的无 Key 阶段：`npm run stage -- --stage 1` 至 `9`。每次在 `.cache/stages/` 创建新样例及 `.learn-pi/stage-report.json`。
- 最终编程样例、真实 MCP stdio 服务、只读子 Pi 会话、计划/执行、持久任务、审批/路径策略、审计、实际测试与 Git 检查点。
- 图解保留 SVG/Vue/CSS 源文件。网站默认中文，有英文切换和本地全文搜索。

## 版本和环境

| 项目 | 实际值 |
| --- | --- |
| OS | Darwin 24.6.0 arm64 |
| 最终验收 Node | 24.16.0（`.nvmrc`） |
| npm | 11.16.0 |
| Git | 2.39.5（Apple Git-154） |
| Pi / pi-ai | 0.85.1，精确依赖与锁文件 |
| npm `gitHead` | `d981de1229ef899957bbe968bc8dcda02a21f477` |
| MCP SDK / TypeBox | 1.30.0 / 1.3.7 |
| VitePress | 1.6.4 |

已对照 npm 元数据、对应 commit 的源码包信息与文档、安装包和 lockfile integrity。`npm run version:check` 可在本地重新检查。首次安装使用 `npm install --ignore-scripts` 并成功安装 481 个包；复现使用 `npm ci --ignore-scripts`。未修改全局 Node 或 Pi 设置。此机器默认 shell 的 Node 20 不符合 Pi 要求，运行前请在仓库执行 `nvm use`，或选择其他 Node >=22.19.0。

## 实际检查结果

| 命令 / 检查 | 结果 | 证据范围 |
| --- | --- | --- |
| `npm run verify` | **PASS** | 版本核验、TypeScript、全部测试、站点构建与链接检查 |
| `npm test`（verify 内） | **45/45 PASS，0 skipped** | 含全部九阶段的聚合测试 |
| `npm run docs:build` | **PASS** | 39 个生成页，含 38 个内容页及 404 页 |
| `npm run docs:check` | **PASS** | 19 中文 + 19 英文；1,280 个内部链接/锚点；默认 `zh-CN` |
| `npm run demo` | **PASS** | 真实 Pi 工具分派：原始测试失败→编辑→4 个测试通过→diff→恢复原文件 |
| `npm run stage -- --stage 9` | **PASS** | 11 次脚本模型响应，完成修复、验证、任务更新与文件恢复 |
| 原生 Pi CLI / RPC | **PASS** | Pi 自身加载实际 `.ts` 扩展、工具与命令注册、离线 RPC 启动；0 模型请求 |
| `python3 docs/examples/pi_rpc_state.py` | **PASS** | 真实 RPC `get_state`，`messageCount=0`；不是 Python Agent 主实现 |
| 浏览器人工检查 | **PASS** | 中文首页、英文首页、同章节切换、中文 MCP 搜索、390px 宽度无横向溢出 |
| `npm run model:smoke` | **SKIPPED** | 未发现匹配的可用 Provider 凭据 |
| Docker 构建 / 隔离探针 | **NOT RUN** | Docker CLI 存在，但 daemon 无法连接 |

原始输出：[完整验证](verification.txt)、[最终站点构建](docs.txt)、[离线闭环](demo.txt)、[Python RPC](python-rpc.txt)、[模型状态](model-smoke.json)。机器可读结果与浏览器检查在 [acceptance.json](acceptance.json)。

行为测试覆盖计划期修改拒绝、无界面/用户拒绝/回调失败、越界和符号链接、Pi 路径别名与读路径回退、持久会话目录逃逸、任务原子写入和损坏恢复、真实 MCP 请求与进程回收、子任务失败/超时/取消/并发上限、实际子 Pi 读取、模型与工具预算、Git 检查点隔离及恢复、继承 Git 环境和 fsmonitor 不影响验证。测试修复了集成层问题，没有只依赖策略函数的 Mock。

## 本地验收方式

当前预览：<http://127.0.0.1:4173/>；英文：<http://127.0.0.1:4173/en/>。已在应用内打开并保留中文首页。服务随本机进程生命周期存在；如已停止，可重启：

```sh
cd /Users/original/Project/github/personal_project/learn-pi
nvm use
npm run docs:dev -- --port 4173
```

另一个终端可验收无需 Key 的作品：

```sh
nvm use
npm run stage -- --stage 6
npm run demo
npm run verify
```

有模型凭据时，按 [快速开始](../docs/guide/quickstart.md)配置环境变量或仓库内 `.cache/pi-agent/` 登录，再运行 `npm run lab:reset` 与 `npm run agent -- --stage 9 --workspace examples/workspaces/todo`。

## 已知边界与未验证项

1. **模型**：官方 fauxProvider 仅生成确定的模型消息；Pi 会话、工具、MCP、文件操作和 Git 是真实执行。没有 API 凭据，因此远程修复质量、实际 Provider 调用及在线压缩质量没有通过验证。`model:smoke` 保留了有凭据时的执行路径与预算。
2. **执行环境**：路径检查和审批是应用层策略，存在检查与执行之间的竞争窗口；批准的 bash/测试代码可使用宿主权限。`--approve-fixture` 自动批准有限工具名，包括执行模型改过的代码，不能作为沙箱。容器配置和明确探针命令已交付，但此机没有运行 Docker daemon，未声称隔离通过。
3. **子 Agent**：独立上下文和只读工具，仍共享 Node 进程/文件系统。SDK 父子共享模型运行时；原生 `pi -e` 的子会话不继承父会话 OAuth/自定义 Provider，环境变量认证的内置 Provider 可用。原生入口也没有 SDK 完整的调用/时间预算包装。
4. **存储与恢复**：任务写入只支持同一进程内串行协调，不提供跨进程事务。任务内容不证明任务完成。Git 恢复仅支持标记的可丢弃工作区和已知 ID；不恢复会话/任务/受保护文件，不记录空目录，拒绝符号链接；预检后的文件复制不是断电原子事务。
5. **课程宿主**：`--resume` 继续当前工作区最近活跃的对话；历史选择和分支由 Pi 原生界面提供。原生 Pi 自身的 Skills 等能力不等于课程默认自动加载。示例验证命令面向随仓库交付的 Todo 项目，通用工程应自己定义验证器。
6. **外部运行**：尚未实测 Linux 容器、其他操作系统、所有 Provider 或所有模型。文档和来源按锁定版本与验收日期标注，不承诺完整复刻 Codex/Claude Code。

## 本地 Git 里程碑

- `930cf65`：渐进 Pi 实现、保护层和真实集成测试。
- `8143cb6`：完整双语课程、文档站与九阶段离线实验。
- 验收记录另作本地提交，完整记录可用 `git log --oneline` 查看。未配置远端。
