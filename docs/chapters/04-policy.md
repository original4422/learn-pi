# 04 · 审批与路径边界

<p class="eyebrow">STAGE 04 / 一次允许，不等于处处允许</p>

本章把前几章已经使用的保护层完整展开：请求能不能进入，能进入是否还需要审批，审批结果如何影响执行，以及如何留下可检查的记录。保护从早期阶段就启用；课程不会为了“循序渐进”让前几章先无保护地写文件。

## 无 Key 逐章实验

这条命令使用真实 Pi 与脚本化 Provider，生成独立练习目录并断言本阶段行为；不调用远程模型。

```sh
npm run stage -- --stage 4
```

## Pi 机制与课程责任

Pi 的 `tool_call` 事件可以阻止工具调用，交互界面可以询问用户。官方示例已有权限提示和路径保护。课程负责统一这些机制：`WorkspacePolicy` 做决策，`ApprovalGate` 处理批准，`src/core/audit.ts` 记录有限的操作元数据，扩展将结果接回 Pi。

它们都是运行在宿主进程里的代码，**不是操作系统沙箱**。可信扩展仍有宿主权限；批准的 shell 能执行任意宿主代码；检查后到实际打开文件前还存在路径替换竞争。更强隔离见[第 08 章](./08-context)。

## 路径检查为什么不只是 startsWith

假设工作区是 `/tmp/lab`，字符串 `/tmp/lab-secret` 也以它开头，却不在同一个目录中。`../`、绝对路径和符号链接同样能绕过朴素字符串判断。

`src/core/policy.ts` 先做词法包含检查，再解析真实路径。对尚不存在的新文件，它逐层找到已经存在的父目录，解析真实位置后再拼接剩余路径。这样 `inside/link/new.txt` 里的 `link` 指向工作区外时，也会被拒绝。悬空符号链接不会当成普通缺失目录放过。

```ts
export function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." &&
     !path.isAbsolute(relative));
}
```

为避免 Pi 与策略对路径解释不同，本课还保守拒绝 `@`、`~`、`file://` 和 Unicode 空格等别名形式，读取要求文件已经存在；执行时使用检查后的规范路径。

受保护名字还包括 `.git`、`.learn-pi`、`.env` 及常见凭据目录，并检查嵌套路径。这里保护课程的工具入口，不保证识别所有敏感文件。递归搜索特别容易带出受保护目录中的内容，所以主课程没有开放通用 `grep` / `find`。

## 默认拒绝的审批门

`ApprovalGate.authorize()` 的关键契约是：策略拒绝不能被批准覆盖；不需要审批的读取可以继续；需要审批但没有回调、处于无交互模式、回调抛错或返回否时，都拒绝。

```ts
if (!decision.allowed) return false;
if (!decision.requiresApproval) return true;
if (this.options.headless || !this.options.confirm) return false;
```

一个“批准所有请求”的回调虽然短，却改变了系统授权含义。课程的 `--approve-fixture` 仅服务带课程标记的可丢弃实验目录，按具体请求处理有限工具；它不是给任意目录开放自动批准，更不会自动批准通用 shell。不过 `verify_project` 会执行模型修改后的代码并继承宿主权限与环境凭据，所以这个开关也不是安全的 shell 替代品。

## 运行审批实验

```sh
npm run agent -- --stage 4 --workspace examples/workspaces/todo
```

由你输入 `/mode execute`，请求一次小修改。第一次在审批处拒绝，检查文件内容没有变化；第二次批准同一项具体修改，检查变化与请求一致。接着要求读 `../outside.txt`、写 `.git/config` 或读取 `.env`：这些应在策略层拒绝，不应提供绕过按钮。

运行 `npm test` 验证越界路径、符号链接、保护目录、拒绝批准及缺失 UI。运行 `npm run test:integration` 验证拒绝结果真的接入 Pi 工具循环。只有策略单元测试通过，还不能证明宿主把它装对了。

## 审计应该记什么

记录时间、工具、决策和原因码，有助于解释“为什么没执行”。不要把全文文件内容、密钥或任意工具输出无差别写入日志。课程日志是本地诊断记录，不是防篡改安全审计系统；拥有宿主权限的人或扩展可以修改它。

如果模型收到拒绝，应让它解释限制或换一种允许的方法，不能循环改写同一危险请求试图绕过。错误原因应足够明确，但不必泄露被保护文件的内容。

**验收标准：** 至少看到四类不同结果：允许读取、执行模式下待批准、用户拒绝、策略直接拒绝；能证明拒绝后没有对应文件副作用。

## 设计对应

Codex 的公开沙箱文档讨论操作系统层面的文件系统与网络限制；Claude Code 也明确区分权限规则与 shell 沙箱。本课程的事件钩子属于应用层准入机制，不能沿用这些产品的沙箱承诺。[Codex 沙箱](https://learn.chatgpt.com/docs/sandboxing)、[Claude Code 权限](https://code.claude.com/docs/en/permissions)

真正值得复用的设计是把“策略允许”“人类批准”“执行环境限制”当成三件不同的事。
