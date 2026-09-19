# 实验与验收

实验不是只看 Agent 给出一句“完成了”。每个结论都要对应文件、事件、进程结果或测试断言。以下矩阵说明哪种证据能回答哪种问题。

## 检查矩阵

| 命令 | 验证内容 | 不证明什么 |
| --- | --- | --- |
| `npm run check` | TypeScript 与锁定 API 的兼容 | 运行时策略正确 |
| `npm test` | 路径、审批、任务、恢复、MCP、分派和运行时测试 | 商业模型的规划质量 |
| `npm run test:integration` | 真实 Pi 会话、扩展与本地 MCP | 远程模型任务成功率 |
| `npm run demo` | 真实工具闭环与恢复，模型响应脚本化 | 自主推理能力 |
| `npm run docs:build` | 双语静态网站生成与链接构建检查 | 视觉在所有设备完全一致 |
| `npm run docs:check` | 页面/导航对等与内部链接 | 翻译永远没有语义遗漏 |
| `npm run model:smoke` | 有凭据时真实模型样例修复 | 所有模型、所有项目泛化效果 |

## 逐章实验卡

| 阶段 | 成功案例 | 必做失败案例 | 可观察证据 |
| --- | --- | --- | --- |
| 1 | 读取样例 | 请求写入 | 工具面与文件未变 |
| 2 | 人切换执行模式 | plan 下改文件 | `plan_is_read_only` |
| 3 | 重启恢复任务 | 无效状态/损坏快照 | ID、revision、恢复或显式错误 |
| 4 | 批准具体修改 | 拒绝、越界、符号链接 | 无副作用与原因码 |
| 5 | 目录查询 | 空查询、关闭后请求 | MCP 实际响应/错误 |
| 6 | 双角色研究 | 一个子任务失败或超时 | 有序结果与并发上限 |
| 7 | 修复后测试通过 | 恢复原始失败代码 | diff 与测试状态变化 |
| 8 | 检查上下文/容器 | 根写入和联网失败 | 真实进程退出结果 |
| 9 | 完整编程任务 | 无凭据或预算用尽 | 明确跳过/失败，没有虚假成功 |

## 复现实验的顺序

```sh
npm ci --ignore-scripts
npm run verify
npm run test:integration
npm run demo
npm run model:smoke
```

`model:smoke` 会生成 `reports/model-smoke.json`。没有匹配凭据时标记 `SKIPPED`，而不是使用脚本响应后标记远程成功。演示报告在脚本输出的 `.cache/demos/` 子目录中。

真实模型 smoke 会在可丢弃目录自动批准有限工具，包括执行修改后的测试代码，继承宿主权限与环境。它适合你信任的本地样例环境；需要约束执行时，先使用下面的容器配置。

## 容器隔离实验

需要运行中的 Docker Engine。在仓库根目录执行：

```sh
docker build -f containers/Dockerfile -t learn-pi:local .
mkdir -p examples/workspaces/container
docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 --tmpfs /tmp -v "$PWD/examples/workspaces/container:/workspace" learn-pi:local scripts/container-init.ts
docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 --tmpfs /tmp -v "$PWD/examples/workspaces/container:/workspace" learn-pi:local scripts/container-probe.ts
```

初始化要求挂载目录为空；若已经做过实验，另选一个新的可丢弃目录，不要盲删个人文件。Linux 主机要让 UID 1000 可写挂载目录。探针检查样例写入、镜像只读、已知宿主路径缺失和出站 TCP 被阻止；它不能证明所有宿主文件或所有网络路径都不可见。

整个 Pi 进程与扩展在容器内运行。离线探针不传任何模型凭据。真实模型需要显式开放网络与传入所需环境变量；那时配置不再保证无网络，也没有域名级白名单。详见 `containers/README.md`。

本次构建机器能找到 Docker CLI，但没有可连接的 daemon，因此镜像构建与探针运行**尚未验证**。配置、预期与未验证状态分开记录，不把工具存在当成实验通过。

## 如何记录自己的验收

记录日期、Node/Pi 版本、命令、退出码、对应报告路径，以及任何跳过原因。模型实验再记录 Provider/模型 ID、改动 diff 与测试结果，不记录密钥。每次声明“完成”时，明确这是类型通过、确定性行为通过、真实集成通过还是远程模型任务通过。
