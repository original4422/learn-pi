# 06 · 分派任务，也负责收敛结果

<p class="eyebrow">STAGE 06 / 分开上下文，不等于分开机器</p>

子 Agent 的价值不是让终端同时闪动两行文字，而是把一个有明确输入和交付物的子任务交给独立上下文，再把可用证据带回来。本章只有两个角色：只读研究员 `researcher` 和只读审查员 `reviewer`。

## 无 Key 逐章实验

这条命令使用真实 Pi 与脚本化 Provider，生成独立练习目录并断言本阶段行为；不调用远程模型。

```sh
npm run stage -- --stage 6
```

## Pi 已有什么，这次要补什么

Pi SDK 可以创建多个真实会话，官方扩展目录也有子 Agent 示例。课程新增的是一个受限分派池：1–6 个任务，最多 2 个并发，每项有时间、工具调用、模型轮数和输出长度预算；失败会保留为结构化结果，不把其他子任务的成功一起丢掉。

源码集中在 `src/integrations/subagents.ts`：`createReadOnlyChildSession()` 装配真实 Pi 子会话，`runPiChild()` 驱动它，`runSubagents()` 管理调度，`createSubagentTool()` 将接口暴露给父模型。

## 上下文隔离具体意味着什么

子会话使用新的内存会话记录和独立系统提示，只收到分派的任务；不自动继承父对话、父事件钩子、项目扩展、Skills 或指令文件。父级路径策略**不会自动继承**，所以创建子会话时必须重新安装策略。它只拥有 `read` 与 `ls`，不能写文件、运行 shell 或继续创建子 Agent。

```ts
export interface ChildTask {
  role: "researcher" | "reviewer";
  task: string;
}
```

它仍与父 Agent 共享 Node 进程和文件系统。因此这里的隔离是上下文与工具权限隔离，不是容器、进程或 OS 隔离。子 Agent 正在读的文件可能被父 Agent 改掉；并发读取也不等于一致快照。

## 运行第六阶段

```sh
npm run agent -- --stage 6 --workspace examples/workspaces/todo
```

输入一个明确的分派要求：

```text
用 delegate_readonly 分派两项独立任务：
1. researcher 阅读 todo.ts，列出行为和输入边界，引用文件路径。
2. reviewer 阅读 todo.test.ts，指出缺少的边界案例。
汇总一致结论、冲突点和还没有验证的假设。不要修改文件。
```

研究员应报告现状，审查员应指出具体风险，父 Agent 负责整合。让两个子 Agent 都写“修好这个项目”并不能产生清晰协作，反而会重复工作。

## 预算与失败收敛

默认每项最多 60 秒、12 次工具调用、6 次模型调用，返回文本最多 8,000 字符。超限需要成为可见失败或截断标记，不能偷偷吞掉。

`runSubagents()` 按输入顺序返回 `fulfilled`、`rejected` 或 `cancelled`。一个普通失败不会丢失同组成功；父取消会传递 `AbortSignal`。超时工位退出，不立刻启动替代任务，避免一个不理会取消的任务仍在后台运行时突破并发上限。

这仍是协作取消，不是操作系统强制终止任意代码。注入测试 runner 可能不遵守信号，宿主扩展也可能失控；强制隔离要另加进程或容器边界。

## 无 Key 与真实模型分别验证什么

`npm test` 用可控 runner 验证并发上限、错误收敛、取消和输出截断。`npm run test:integration` 创建真实 Pi 子会话，验证资源加载与工具边界。脚本化 Provider 可以驱动真实子会话执行读取，但不能证明研究与审查的结论正确。

使用真实模型时，额外检查：是否把猜测当事实、是否引用不存在的路径、是否声称运行了不可用的测试。不要让“两个 Agent 都这样说”代替证据。

**验收标准：** 同时最多两项运行；失败结果可见且不吞掉成功结果；子会话没有写入/shell 工具；父 Agent 能标注尚未验证的结论。

## 设计对应

Claude Code 与 Codex 的公开子 Agent 文档都强调分派工作与独立上下文。本课借用这种职责分离思想，但只实现两种只读角色和固定上限；不复制产品的团队通信、长期后台任务或权限系统。[Claude Code 子 Agent](https://code.claude.com/docs/en/sub-agents)、[Codex 子 Agent](https://learn.chatgpt.com/docs/agent-configuration/subagents)
