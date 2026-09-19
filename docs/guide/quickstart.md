# 快速开始

从无 Key 实验开始，先确认工具和运行时能正常工作，再接入真实模型。所有命令在 `learn-pi` 仓库根目录执行，练习数据单独生成。

## 1. 准备环境

需要 Node.js **22.19.0 或更新版本**、npm 与 Git。建议使用 Node 24 LTS；不要用 Node 20 勉强运行。检查：

```sh
node --version
npm --version
git --version
# 使用 nvm 时，先运行 nvm install && nvm use（读取 .nvmrc 的 24.16.0）。
npm ci --ignore-scripts
```

依赖及传递依赖由 `package-lock.json` 锁定。`--ignore-scripts` 避免安装时执行包脚本；本课程验证的是文本工具与文档流程，不依赖剪贴板或图像处理的可选原生能力。Pi 固定为 `0.85.1`，不需要全局安装另一个版本。

## 2. 无 Key 跑通真实 Pi

```sh
npm run check
npm test
npm run test:integration
npm run stage -- --stage 1
npm run demo
```

你应该看到演示中的真实 Pi 分派读取、任务、MCP、检查点、编辑和验证工具，最终报告样例测试从失败变为通过，再恢复原始文件。演示工作区与 JSON 报告保存在 `.cache/demos/` 下，脚本会输出具体位置。

::: tip 这里“真实”的范围
Pi 会话、扩展加载、工具执行、本地 MCP 进程和 Git 操作都是真实的。模型响应由官方测试 Provider 脚本化生成，没有远程推理，也不能据此宣称真实模型完成了任务。
:::

`npm test` 包含有意触发失败的测试案例；断言这些错误符合预期后，测试套件本身仍应通过。Todo 练习的初始失败也是设计好的，不代表课程安装失败。

## 3. 打开中文文档站

```sh
npm run docs:dev
```

在终端显示的本地地址打开网站，默认通常为 `http://127.0.0.1:5173`。右上角语言菜单可以切换同一页面的英文版本。要验证构建产物：

```sh
npm run docs:build
npm run docs:check
npm run docs:preview
```

预览只监听本机回环地址，不公开部署。端口占用时使用终端显示的新地址。

## 4. 准备模型凭据

课程 CLI 读取 Provider 环境变量，并使用仓库内 `.cache/pi-agent/` 作为认证目录，不自动读取全局 Pi 认证。不要把 Key 写进代码、提示词或提交的文件。

如果使用 Pi 交互登录，在仓库根目录运行：

```sh
PI_CODING_AGENT_DIR="$PWD/.cache/pi-agent" npm exec pi --
```

在 Pi 中执行 `/login`，按 Provider 的实际支持方式登录，再退出。也可在本机安全地配置对应 Provider 环境变量，例如 `ANTHROPIC_API_KEY`。可用 Provider 与模型以锁定版本和你的账户权限为准；课程不预设所有人能使用同一个模型。

## 5. 启动最终 Agent

```sh
npm run lab:reset
npm run agent -- --stage 9 --workspace examples/workspaces/todo
```

`lab:reset` 生成带课程标记的可丢弃目录；重新运行会重置这个练习，勿在其中放个人文件。Agent 默认处于 `plan` 模式。先请它读代码和测试、建立计划，然后由你输入 `/mode execute`，再逐项批准需要的操作。

| 命令 | 作用 |
| --- | --- |
| `/status` | 查看阶段、模式和会话统计 |
| `/mode plan` / `/mode execute` | 由人切换模式 |
| `/tasks` | 查看工作区任务清单 |
| `/checkpoint 修复前` | 第 7 阶段起创建样例检查点 |
| `/restore 实际检查点ID` | 确认后恢复样例普通文件 |
| `/compact` | 第 8 阶段起调用 Pi 压缩 |
| `/quit` | 退出并释放会话 |

可用 `--provider` 和 `--model` 指定实际可用模型，用 `--stage 1` 到 `--stage 9` 回到对应课程阶段。`--prompt` 是单次非交互模式；默认拒绝需要人工批准的写入。

`--approve-fixture` 只接受课程标记目录，并自动批准有限的写入、验证和检查点工具。**其中验证会执行模型修改后的项目代码，仍持有宿主权限和继承的环境凭据。它不是安全的 shell 替代品。** 如需限制执行环境，使用容器实验。

## 常见问题

**没有匹配模型。** 检查当前 shell 的 Provider 环境配置或本地 Pi 登录；不要输出认证文件内容。无凭据仍可完成前述全部离线实验。

**一开始测试失败。** `examples/fixtures/todo` 故意保留两个缺陷。课程测试应通过；练习项目需要在第 07 章修复。

**执行模式仍然拒绝。** 检查阶段是否开放工具、路径是否被保护、是否没有交互 UI。执行模式不会绕过路径或审批。

**运行恢复报错。** 只能在生成的原始练习目录使用清单内的检查点。复制到另一绝对路径或移入容器后，必须在那里重新初始化标记。

下一步：[学习路线](./route)或[TypeScript 前导课](../chapters/00-typescript)。
