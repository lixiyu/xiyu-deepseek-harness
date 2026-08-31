# Auto-summarize completed turns

English | [中文](README.zh.md)

This overlay opts one `dsh web` process into automatic re-summarization: after an agent turn closes, the plugin steers one extra step that condenses the final answer into a short, low-friction summary (Claude Code style). It only fires when the final visible answer is long enough (`minChars`, default 600), so already-terse answers stay as-is.

```sh
dsh web --patch examples/web-summarize/cordis.yml
```

## How it works

- Listens to the `agent/turn-stopping` notification, the same interception point the Claude Code `Stop` hook uses.
- Reads the turn's final assistant message; if it is shorter than `minChars`, nothing happens.
- Otherwise steers one summary step in the SAME turn with a model-facing instruction, and records the turn so the summary's own stop boundary cannot recurse.
- Applies to root agents only by default; set `includeSubagents: true` to also summarize subagents.

## Configuration

All fields are optional:

| field | default | meaning |
| --- | --- | --- |
| `minChars` | `600` | Skip when the final visible answer is shorter than this. |
| `maxChars` | `400` | Soft target length for the built-in prompt. |
| `includeSubagents` | `false` | Also summarize runtime child agents. |
| `prompt` | built-in | Full custom summary instruction (overrides the built-in). |

The built-in prompt asks for key conclusions, changes, numbers, and next steps, and to drop process, repetition, and filler.
