"""Read real Pi RPC state without a model request. Run from any directory."""
import asyncio
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


async def main():
    agent_dir = ROOT / ".cache" / "python-rpc"
    agent_dir.mkdir(parents=True, exist_ok=True)
    # Deliberately do not forward provider credentials to this no-key probe.
    env = {
        "PATH": os.environ.get("PATH", ""),
        "PI_CODING_AGENT_DIR": str(agent_dir),
        "PI_OFFLINE": "1", "PI_TELEMETRY": "0", "LESSON_STAGE": "1",
    }
    process = await asyncio.create_subprocess_exec(
        "node", str(ROOT / "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js"),
        "--mode", "rpc", "--offline", "--no-approve", "--no-session",
        "--no-extensions", "--no-skills", "--no-prompt-templates",
        "--no-themes", "--no-context-files", "--system-prompt", "RPC state probe",
        "--extension", str(ROOT / "src/extensions/course.ts"),
        cwd=agent_dir, env=env,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    # Drain diagnostics so a filled pipe cannot block the child.
    diagnostics = asyncio.create_task(process.stderr.read())
    try:
        request = {"id": "state-1", "type": "get_state"}
        process.stdin.write((json.dumps(request) + "\n").encode())
        await process.stdin.drain()

        async def response():
            while True:
                line = await process.stdout.readline()
                if not line:
                    raise RuntimeError("Pi closed stdout before its response")
                event = json.loads(line)
                if event.get("type") == "response" and event.get("id") == "state-1":
                    if not event.get("success"):
                        raise RuntimeError(event.get("error", "RPC request failed"))
                    return event

        result = await asyncio.wait_for(response(), timeout=20)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print("PASS: real Pi RPC get_state; zero model requests.")
    finally:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
        await diagnostics


if __name__ == "__main__":
    asyncio.run(main())
