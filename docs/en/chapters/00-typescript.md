# 00 · The TypeScript a Python developer needs

<p class="eyebrow">PRELUDE / READ THE EXTENSION BEFORE EXTENDING THE RUNTIME</p>

You do not need to learn all of JavaScript first. After this chapter, you should be able to read a Pi extension's parameters, asynchronous execution, and event handlers—and distinguish compile-time checks from runtime checks. The types and files come from the implementation you will extend. There is no second Python agent to maintain.

## Run something before studying syntax

After installing the runtime and dependencies in the [quickstart](../guide/quickstart), run these from the repository root:

```sh
npm run check
npm run demo
```

The first checks TypeScript types. The second connects a scripted provider to **real Pi**, producing a repeatable tool loop. A type check does not run the agent; the demo runs the agent without calling a commercial model. These results answer different questions.

## Types help the programmer; they do not validate JSON

A Python `dict` is usually a JavaScript object; a `list` is an array. `None` often corresponds to `null` or `undefined`. An `undefined` value is not an empty string: it represents an absent property or missing return value. A TypeScript interface describes a shape and does not create a runtime validator.

`src/core/tasks.ts` uses a literal union for task states:

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

Think of `Task` as a dictionary annotated with Python's `TypedDict`. A literal `status: "finished"` fails type checking, but JSON read from disk can still contain it. That is why `TaskStore` also has `validateState()`, checking versions, unique IDs, timestamps, and allowed states. Writing `as TaskState` is an assertion, **not validation**.

| Python habit | TypeScript in this project | Important difference |
| --- | --- | --- |
| `def f(x: str) -> bool` | `function f(x: string): boolean` | Types are normally erased |
| `Optional[str]` | `string \| undefined` | Check presence before use |
| `Literal["plan", "execute"]` | `"plan" \| "execute"` | Explicit states constrain mistakes |
| `dataclass` | `interface` + ordinary object | Interfaces create no runtime instances |
| `raise ValueError(...)` | `throw new Error(...)` | Treat caught values as unknown |
| `with` / `finally` | `try { ... } finally { ... }` | Close connections and sessions explicitly |

## Modules tell you where names come from

```ts
import path from "node:path";
import { TaskStore } from "./core/tasks.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
```

`node:` identifies Node's standard library, relative paths identify your modules, and bare package names come from dependencies. In an ESM project, an import can end in `.js` even when its source is `.ts`; TypeScript and the toolchain resolve the source. This is not a missing file. `import type` imports only a compile-time name.

`export` defines a module's public interface. Separating path policy, task storage, and MCP transport lets us test meaningful responsibilities independently; creating more files is not the objective.

## A Promise is a result that may arrive later

Python's `async def` corresponds to `async function`. A Promise represents a pending or completed result. `await` waits for completion and surfaces rejection as an exception at that call site.

```ts
const store = new TaskStore("/absolute/workspace/.learn-pi/tasks.json");
const task = await store.add("Run the sample tests");
await store.update(task.id, "in_progress");
const tasks = await store.list();
```

This illustrates the API; the agent later creates the bounded storage path for you. Without `await`, `store.add()` gives you a Promise, not a task. Dependent mutations must be awaited in order. Independent reads may run concurrently.

`Promise.all()` rejects when one input rejects, but does not automatically cancel other work already started. Our subagent pool explicitly limits concurrency and turns every child outcome into success or failure. Writing `async` does not implement concurrency management.

## Events and tools call functions in opposite directions

Registering a tool exposes a function to the model. Subscribing to an event asks Pi to call your function during execution. This is the minimal official extension shape, not the course's complete protection layer:

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

A callback is a function value, just as in Python. `(event) => ...` is an arrow function. Returning `{ block: true }` follows Pi's event contract; it is not a special JavaScript feature. `src/extensions/course.ts` adds modes, paths, approval, and audit records.

Tool parameters use `typebox` schemas. `Type.String()` produces a runtime object describing a string parameter; it differs from a `text: string` type annotation. Model output is external input, so parameters, persisted files, and MCP responses still need runtime validation.

## Experiment and failure checks

1. Open `src/core/tasks.ts`. Locate `TaskStatus`, `validateState`, and `add`; explain why all three exist.
2. Temporarily assign `"finished"` to a `TaskStatus` in your editor. Run `npm run check`, observe the error, and undo your change.
3. Run `npm test`. Locate invalid-data and corrupted-snapshot cases. The compiler cannot perform these checks.
4. Inspect `try/finally` in `src/integrations/mcp.ts`. Which line still closes the subprocess when a request throws? What would remain if it were removed?

**Completion criterion:** distinguish interfaces, schemas, and state validation; identify a missing `await`; and explain why cleanup belongs in a tool implementation.

## Connection to familiar agents

Codex and Claude Code hide most language details behind a product. Learning TypeScript here makes policy readable and inspectable. Correct types do not prove a secure policy; [chapter 04](./04-policy) tests actual denial and path boundaries.

Continue to [the real Pi](./01-pi).
