# 容器实验 / Container experiment

This is a Docker boundary around the **whole Pi process**, not a claim that extension hooks sandbox host execution. Build needs network; the offline probe runs without it. Docker Engine must already be running.

```sh
docker build -f containers/Dockerfile -t learn-pi:local .
mkdir -p examples/workspaces/container
# The mount must be empty; this initializes a fresh marker with root /workspace.
docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 --tmpfs /tmp -v "$PWD/examples/workspaces/container:/workspace" learn-pi:local scripts/container-init.ts
docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 --tmpfs /tmp -v "$PWD/examples/workspaces/container:/workspace" learn-pi:local scripts/container-probe.ts
```

The probe verifies writable sample, read-only image, missing host file and blocked outbound TCP. It cannot prove immunity to kernel vulnerabilities or every host file being absent. Never mount `/`, the Docker socket, SSH credentials or your entire home directory. On Linux ensure the sample directory is writable by UID 1000. Keep Docker's default seccomp profile.

For a **live model**, omit `--network none` and explicitly pass just the required key with `--env ANTHROPIC_API_KEY` (key value stays out of command history). Use `-it` and the image default command for interactive approval. Network access then exists; this example is not an egress allowlist. Do not mount Pi auth from the host by default.

中文：整个 Pi、其扩展和子 Agent 都在容器中运行；审批依然用于表达意图，容器负责进程/挂载边界。先构建镜像，在全新挂载目录初始化，运行无网络探针。在线模型需要明确恢复网络并只传入所需凭据。这里不提供网络域名白名单，也不宣称容器绝对安全。容器内外工作区的绝对路径不同，不能直接复用宿主机检查点标记。

Acceptance on the build machine: Docker CLI is present, but no running daemon was reachable. Image build and probe are **not yet verified** here. These exact commands are the outstanding local experiment, not a passed test.
