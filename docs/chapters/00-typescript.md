# 00 · Python 开发者需要的最少 TypeScript

<p class="eyebrow">前导课 / 读懂扩展，再扩展运行时</p>

你不需要先学完 JavaScript。完成本章后，你应该能读懂一个 Pi 扩展的参数、异步执行和事件处理，并判断哪些检查在编译时发生，哪些必须在运行时发生。这里使用的类型与文件都来自后续主实现；不再维护一套 Python Agent。

## 先运行，再读语法

按[快速开始](../guide/quickstart)安装 Node 与依赖后，在仓库根目录运行：

```sh
npm run check
npm run demo
```

第一条验证 TypeScript 类型，第二条把脚本化 Provider 接入**真实 Pi**，运行可重复的工具循环。前者不执行你的 Agent，后者执行但不调用商业模型。这两个结果回答不同问题，不能互相替代。

## 类型是给程序员的，不会替你检查 JSON

Python 的 `dict` 对应 JavaScript 对象；`list` 对应数组；`None` 在这里通常对应 `null` 或 `undefined`。不要把 `undefined` 当成空字符串：它表示属性缺失或函数没有返回值。TypeScript 的接口描述形状，运行时不会自动产生验证器。

`src/core/tasks.ts` 用字面量联合类型限制状态：

```ts
export type TaskStatus = "pending" | "in_progress" | "done";
export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
```

可以把 `Task` 理解为 Python 中带 `TypedDict` 标注的字典。`status: "finished"` 会被类型检查拒绝，但从磁盘读取的 JSON 仍可能包含它。因此 `TaskStore` 同时保留 `validateState()`：检查版本、ID 唯一性、时间戳和状态值。`as TaskState` 只是类型断言，**不是验证**。

| Python 习惯 | 本项目 TypeScript 写法 | 需要留意 |
| --- | --- | --- |
| `def f(x: str) -> bool` | `function f(x: string): boolean` | 类型通常在构建时擦除 |
| `Optional[str]` | `string \| undefined` | 读取前先判断缺失 |
| `Literal["plan", "execute"]` | `"plan" \| "execute"` | 精确状态比随意字符串可靠 |
| `dataclass` | `interface` + 普通对象 | 接口不创建运行时实例 |
| `raise ValueError(...)` | `throw new Error(...)` | `catch` 值应当按未知类型处理 |
| `with` / `finally` | `try { ... } finally { ... }` | 进程、连接和会话要显式清理 |

## 模块：名字从哪里来

```ts
import path from "node:path";
import { TaskStore } from "./core/tasks.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
```

`node:` 是 Node 标准库；相对路径是自己的模块；裸包名来自依赖。ESM 项目里源码是 `.ts`，导入路径仍可能写 `.js`，TypeScript 和构建工具会解析源文件。这不是文件丢失。`import type` 只引入编译期类型，不会在运行时加载一个同名值。

`export` 决定模块公开什么。课程把路径检查、任务存储、MCP 连接分开，目的是让每个模块的职责可以独立验证，而不是为了多建几个文件。

## Promise：结果晚一点才到

Python 的 `async def` 对应 `async function`。Promise 表示一个尚未完成或已经完成的结果；`await` 等它完成，并把失败转换成当前调用点抛出的异常。

```ts
const store = new TaskStore("/absolute/workspace/.learn-pi/tasks.json");
const task = await store.add("Run the sample tests");
await store.update(task.id, "in_progress");
const tasks = await store.list();
```

这是 API 用法示例，后续 Agent 会替你创建带边界的存储路径。`store.add()` 没有 `await` 时，你拿到的是 Promise，不能当成任务对象使用。两个相互依赖的写入必须顺序等待；独立只读任务才适合并发。

`Promise.all()` 遇到一个拒绝就拒绝整体，但不会自动取消其他已启动任务。本课程的子 Agent 池显式限制并发，并把每个子任务收敛成成功或失败结果；“写了 async”从来不等于“有并发管理”。

## 事件和工具：两个方向的函数调用

工具注册把函数提供给模型；事件订阅让 Pi 在运行时调用你的函数。下面是官方扩展接口的最小形状，不是课程的完整保护实现：

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    if (event.toolName === "write") {
      return { block: true, reason: "This example is read-only" };
    }
  });
}
```

回调像 Python 中传入的函数对象；箭头函数 `(event) => ...` 是另一种函数语法。返回 `{ block: true }` 是和 Pi 约定好的协议，不是 JavaScript 魔法。完整实现位于 `src/extensions/course.ts`，还会检查模式、路径、审批和审计。

工具参数用 `typebox` 构造 schema。`Type.String()` 生成描述字符串参数的运行时对象；它和 `text: string` 这种类型标注不是一回事。模型输出是外部输入，因此即便 TypeScript 已通过，也要对参数、文件内容和 MCP 响应做运行时检查。

## 小实验与失败检查

1. 打开 `src/core/tasks.ts`，找到 `TaskStatus`、`validateState` 和 `add`。解释为什么三处都需要存在。
2. 在编辑器中临时把一个 `TaskStatus` 赋值为 `"finished"`，运行 `npm run check`，观察类型错误，再撤销改动。
3. 运行 `npm test`。找到无效任务数据和损坏快照的测试，确认这些是编译器不能代劳的检查。
4. 阅读 `src/integrations/mcp.ts` 的 `try/finally`。假设请求抛错，哪一行仍会关闭进程？如果删除它，会留下什么资源？

**验收标准：** 你能解释“接口、schema、状态验证”的分工，能识别一个漏掉的 `await`，并知道 `finally` 为什么是工具实现的一部分。

## 与熟悉的 Agent 对照

使用 Codex 或 Claude Code 时，语言细节通常被藏在产品后面。这里学习 TypeScript 的目的，是让策略变成可读、可检查的程序。类型正确不能证明策略安全；真正的边界还要通过[第 04 章](./04-policy)的拒绝和越界实验验证。

下一步：[认识真实 Pi](./01-pi)。
