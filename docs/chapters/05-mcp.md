# 05 · 接入一个真的本地 MCP 服务

<p class="eyebrow">STAGE 05 / 协议让连接可替换，不会自动带来信任</p>

本章接入课程目录服务。模型可以搜索课程概念，结果由一个独立本地进程通过 MCP 返回。数据是固定的，但请求不是伪造的：客户端进行真实协议初始化、工具发现和工具调用。

## 无 Key 逐章实验

这条命令使用真实 Pi 与脚本化 Provider，生成独立练习目录并断言本阶段行为；不调用远程模型。

```sh
npm run stage -- --stage 5
```

## Pi 已有工具接口，MCP 解决什么

Pi 原生扩展可以直接注册工具。若一项能力只服务这个扩展，直接调用函数通常最简单。MCP 增加的是跨进程、跨客户端的工具协议，使同一服务能被不同宿主使用。课程不把 MCP 描述成 Pi 工具循环的替代品，也不假定该版本自带一个通用 MCP 客户端。

本章用官方 MCP TypeScript SDK 搭桥：`examples/mcp-server.ts` 是服务端，`src/integrations/mcp.ts` 是客户端与 Pi 工具适配，`src/integrations/catalog.ts` 是固定目录数据。模型看到的是 `catalog_search`，看不到任意进程启动参数。

## 请求走过哪些边界

```text
Pi 工具 catalog_search({query})
  → CatalogMcpClient
  → stdio 子进程（examples/mcp-server.ts）
  → MCP callTool
  → text / isError
  → Pi 工具结果
```

客户端采用固定的 Node 可执行路径与仓库内服务脚本。模型不能把 `query` 改成启动命令，项目配置也不能悄悄换一个 MCP 服务。`stdio` 的标准输出属于协议，调试日志不能随意混入其中。

实际客户端调用形状是：

```ts
const result = await this.client.callTool(
  { name: "catalog_search", arguments: { query } },
  undefined,
  { timeout: this.timeoutMs, signal },
);
```

这和 HTTP “收到 200 就算成功”一样不能省略应用层检查。MCP 的 `isError` 也要处理；超时、参数错误、取消和进程关闭都属于连接的生命周期。

## 运行第五阶段

```sh
npm run agent -- --stage 5 --workspace examples/workspaces/todo
```

输入：“使用课程目录工具搜索 approval，告诉我哪一章解释应用层策略和 OS 沙箱的区别。”观察工具调用名称和返回的课程条目。它是只读的固定目录，因此计划模式允许使用。

没有模型凭据时运行：

```sh
npm test
npm run test:integration
```

`tests/integrations.test.ts` 直接使用真实 MCP SDK 和本地服务，检查发现与请求；它不依赖模型是否愿意选对工具。Agent 是否合理决定调用 MCP，是另一个需要真实模型评估的问题。

## 实现中的三个选择

**有限 schema。** 查询必须是非空的 1–200 字符字符串，额外参数被拒绝。这使错误尽早暴露。MCP 注解可以说明“只读”意图，但注解本身不是权限执行机制；这里真正的只读性质来自服务只查询固定数据。

**明确收尾。** Pi 工具执行在 `finally` 调用 `client.close()`，成功、异常、取消都应释放服务进程。连接不能留到进程退出时碰运气。

**输出是数据。** 即便文本来自一个 MCP 服务，也不能把“忽略上层规则”当成更高优先级指令。课程把查询结果交给模型作为证据；生产环境还需要根据具体服务审查内容、权限与数据暴露。

## 失败实验与验收

用空查询、超长查询或已关闭客户端发请求，预期明确失败；服务请求发生错误时不能返回看起来正常的空结果。检查测试结束后没有遗留目录服务进程。若模型没选工具，先直接跑客户端测试，区分工具协议故障和模型选择问题。

**验收标准：** 无 Key 时也能完成真实 MCP 工具发现与调用；失败有明确错误；资源被关闭；没有把“服务说它只读”当作安全证明。

## 设计对应与何时不用 MCP

Codex 公开支持 MCP 接入，说明协议是扩展编程 Agent 的一种常见方式。[Codex MCP 文档](https://learn.chatgpt.com/docs/extend/mcp)

本课程只实现一项固定本地服务，不复制远程 OAuth、多服务器管理或产品配置界面。如果能力本来就是一个稳定 CLI，直接传固定参数调用 CLI 可能更少代码、更好诊断；当多个宿主确实需要共享工具契约时，再引入 MCP。
