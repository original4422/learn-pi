# 09 · 用 SDK 装配你的教学 Agent

<p class="eyebrow">STAGE 09 / 把能力接成一个可验收的作品</p>

最后一章不再添加一个大工具，而是检查之前的能力是否真能组合：模型、资源、工具、策略、状态与宿主交互必须指向同一个工作区，并在错误路径也能正常收尾。

## 无 Key 逐章实验

这条命令使用真实 Pi 与脚本化 Provider，生成独立练习目录并断言本阶段行为；不调用远程模型。

```sh
npm run stage -- --stage 9
```

## 为什么最后讲 SDK

从第一章起，示例就用真实 Pi SDK 启动运行时；本章才把它作为学习对象完整展开。这样读者先理解扩展承担什么责任，再理解 SDK 如何装配它。SDK 是宿主入口，原生扩展是主要能力实现，不是两套 Agent。

`src/runtime.ts` 的 `createCourseSession()` 依次创建控制器、准备持久状态、设置模型运行时、限制资源加载、加载扩展、创建 Pi 会话、绑定事件，再返回 `prompt()` 和 `close()`。如果扩展加载报错，启动必须失败；保护层不能因为出错而被静默移除。

## 装配图

```text
src/cli.ts ─── 人类命令、模型选择、逐项批准
    │
    ▼
src/runtime.ts ─── createAgentSession + 资源/会话/预算
    │
    ▼
src/extensions/course.ts ─── 工具注册与 tool_call 入口
    ├── core/policy.ts       模式、路径、审批
    ├── core/tasks.ts        工作区任务快照
    ├── core/audit.ts        有限操作记录
    ├── core/checkpoints.ts  样例文件恢复
    ├── integrations/mcp.ts  固定本地 MCP 服务
    ├── integrations/subagents.ts  只读子会话
    └── verification.ts     固定测试 + Git 证据
```

阶段由 `src/stages.ts` 累加能力；最终阶段没有复制出一份“完整版”代码。修复策略模块时，所有阶段共享改进。

## 跑完最终任务

```sh
npm run lab:reset
npm run agent -- --stage 9 --workspace examples/workspaces/todo
```

先在计划模式输入：

```text
目标：修复 addTodo，让它保存去掉首尾空白后的文本，拒绝空白输入，保持 API 不变。
先读工作区说明、实现和测试。建立任务清单。
需要时让 researcher 分析实现、reviewer 审查测试。
给出最小计划，等待我切换执行模式。
```

你审阅计划后输入 `/mode execute`，再要求它创建检查点、验证失败、修改、重新验证并审查 diff。每次批准都对应具体操作。最终答复应交代修改文件、测试结果、差异与未验证项；任务勾选不能代替这些证据。

没有 Key 时，`npm run demo` 运行相同真实 Pi 路径中的脚本化修复闭环，并断言预期文件与测试状态。这个演示检验装配，不评价自然语言规划能力。

## 原生扩展与 SDK 两条入口

```sh
# 课程 CLI：显式工作区、宿主命令与凭据选择
npm run agent -- --stage 9 --workspace examples/workspaces/todo

# 官方 Pi CLI：加载同一个原生扩展
COURSE_ROOT="$PWD"
(
  cd "$COURSE_ROOT/examples/workspaces/todo"
  PI_CODING_AGENT_DIR="$COURSE_ROOT/.cache/pi-agent" LESSON_STAGE=9 \
    "$COURSE_ROOT/node_modules/.bin/pi" --no-extensions -e "$COURSE_ROOT/src/extensions/course.ts"
)
```

第二条先在子 shell 中进入生成的练习目录，再用绝对路径加载仓库里的扩展。退出后原 shell 仍在仓库根目录。检查点只接受实验工具生成的工作区，不接受课程仓库根目录。课程原生扩展注册 `/mode`、`/tasks`；SDK CLI 另行实现 `/status`、`/checkpoint`、`/restore` 和 `/compact` 包装。官方 Pi CLI 本身也有原生 `/compact`，不是本课程新增的能力。

两条入口共享能力模块，但生命周期与认证组合不同。SDK 将相同 `ModelRuntime` 传给子会话；直接 `-e` 加载时，子会话不会自动继承父会话的 OAuth 或自定义 Provider 运行时，环境变量支持的内置 Provider 路径仍可使用。`--no-extensions` 禁用扩展发现，不会移除 Pi 的可信内置 `/llama` 等机制，也不等于没有任何宿主代码运行。

## 生命周期和预算也是产品行为

课程 SDK 主会话每次提示有调用次数与时间上限，子会话也有独立预算；原生 `-e` 入口不经过 SDK 的主提示预算包装。错误要回到宿主，不能以空字符串伪装成功。会话释放、MCP 关闭、取消传播都在失败路径里执行。

## 退出后继续对话

```sh
npm run agent -- --stage 9 --workspace examples/workspaces/todo --resume
```

SDK 默认创建新会话；显式 `--resume` 则通过 Pi 的 `SessionManager.list(cwd, sessionDir)` 选择当前工作区最近活跃的记录，再用 `SessionManager.open()` 交给 `createAgentSession()`。历史用户消息、助手消息和工具结果由 Pi 恢复，新消息追加到同一文件。没有已保存会话时会报错并提示先启动新对话。课程 CLI 启动时打印会话 ID 和文件，便于对照。

会话只负责对话上下文。阶段、模型、模式与审批回调由本次启动重新装配，默认回到 `plan`；工作区文件、任务和检查点保持当前状态。不要在续聊前运行 `lab:reset`，它会生成新的练习目录。当前入口选择最近活跃会话；历史选择器和会话分支仍由 Pi 原生界面提供。

`tests/sessions.test.ts` 使用真实 Pi 和官方脚本模型，先读取文件、记录任务并关闭会话，再以新模型运行时续聊；断言旧消息和工具结果实际进入下一次模型请求、同一会话文件继续追加，以及当前阶段和计划模式生效。另验证默认新对话、最近会话选择、排除其他工作区记录、缺失记录报错和符号链接拒绝。运行 `npm run test:integration` 可复现。

## 最终验收

```sh
npm run verify
npm run test:integration
npm run demo
npm run model:smoke
```

前三项不要求商业模型 Key；`model:smoke` 根据凭据可用性记录真实模型验证或跳过原因。完整结果以仓库验收报告为准，不把“有入口”当成“实测通过”。网站可用 `npm run docs:dev` 本地预览。

**完成标准：** 你能从空练习目录跑完一个真实 Pi 编程工作流，解释每一项能力的来源，展示关键失败路径，并清楚说明应用策略、模型表现和执行环境的边界。

## 接下来改什么

优先选择一个可验证的小问题：增加一种只读工具、为任务快照补跨进程锁、将子 Agent 移到独立进程、或增加历史会话选择器。每次只改变一条责任边界，补上中英说明和对应失败实验。不要把第一版变成“复刻所有产品功能”的承诺。
