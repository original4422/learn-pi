# Advanced reference: drive Pi RPC from Python

The main implementation remains a native TypeScript extension. Use cross-process RPC when your host application needs to be Python, not as a reason to maintain a second agent implementation.

## Start with a no-model probe

```sh
python3 docs/examples/pi_rpc_state.py
```

This script starts the pinned real Pi RPC process, loads stage 1, sends `get_state`, matches its response by request ID, and closes the process. It forwards no model credentials and makes no model calls. Runtime state stays under `.cache/python-rpc/`. The editable source is `docs/examples/pi_rpc_state.py`.

The protocol uses one JSON object per line:

```json
{"id":"state-1","type":"get_state"}
```

Response IDs correlate requests. Other events can occur between responses, so “read the next line” is not a sufficient client implementation. The Python example uses asynchronous pipes, deadlines, and process cleanup in `finally`.

## Sending a prompt is different

An authenticated RPC process accepts a message such as:

```json
{"id":"prompt-1","type":"prompt","message":"Read the project and explain its tests."}
```

`response.success: true` means acceptance, not task completion. `agent_end` can still be followed by retry or queued work; this pinned version provides `agent_settled` when processing has fully converged. A host must handle streaming events, tool errors, cancellation, and terminal state. [Pinned RPC documentation](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/rpc.md)

Extension confirmation dialogs become `extension_ui_request` messages requiring a matching `extension_ui_response`. Do not automatically approve them merely to get a wrapper working. This state probe does not need approval and deliberately avoids an implicit approve-all Python client.

## Why this is an appendix

RPC adds process lifecycle, message correlation, and UI protocol work without removing the extension's responsibilities. Python can orchestrate host business logic while Pi runs the tool loop and the extension enforces policy. A language boundary does not isolate the filesystem or make untrusted extensions safe.

This example can establish that Python communicates with real Pi's RPC state channel. Claiming that Python drove a live model to complete a task requires a separately executed and recorded authenticated prompt, tool, and result workflow.
