# 进阶参考：用 Python 驱动 Pi RPC

主实现仍然是 TypeScript 原生扩展。只有当你的宿主应用必须是 Python 时，才需要跨进程 RPC；不必为了“Python 读者”再实现一套 Agent。

## 先运行一个无模型探针

```sh
python3 docs/examples/pi_rpc_state.py
```

该脚本启动仓库锁定的真实 Pi RPC 进程，加载第 1 阶段扩展，发送 `get_state`，按请求 ID 读取响应，再关闭进程。它不转发模型凭据、不调用模型，只在 `.cache/python-rpc/` 中创建本地运行状态。完整可编辑源码位于 `docs/examples/pi_rpc_state.py`。

协议核心是每行一个 JSON 对象：

```json
{"id":"state-1","type":"get_state"}
```

响应的 `id` 对应请求，事件流中也可能出现其他消息，所以不能简单“读下一行就是答案”。Python 示例使用异步管道与超时，并在 `finally` 终止子进程。

## 真正发送提示时的区别

已配置模型的 RPC 进程接受这种消息：

```json
{"id":"prompt-1","type":"prompt","message":"Read the project and explain its tests."}
```

`response.success: true` 表示请求被接受，不是任务已完成。`agent_end` 也可能随后还有自动重试或后续工作；锁定版本提供 `agent_settled` 表示运行已完全收敛。你的宿主要处理流式事件、工具错误、取消和最终状态。[固定版本 RPC 文档](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/rpc.md)

扩展的确认 UI 会变成 `extension_ui_request`，需要客户端回复匹配 ID 的 `extension_ui_response`。没有实现这条协议时，不要自动回复批准来“让示例能跑”。本页的状态探针不涉及审批，所以不提供一个隐含全批准的 Python 包装器。

## 为什么它不是主线

RPC 多了一层进程生命周期、消息关联和 UI 协议，但没有减少 TypeScript 扩展本身的职责。Python 可以控制宿主业务流程，Pi 仍执行工具循环，课程扩展仍负责策略。跨语言边界不会自动隔离文件系统，也不会让一个不可信扩展变安全。

验收这个参考示例时，只能说“Python 与真实 Pi 的 RPC 状态通道已连通”。要说“Python 驱动真实模型完成任务”，还必须执行并记录有凭据的提示、工具和结果流程。
