# @deepseek-ai/dsh-summarize

English | [中文](README.zh.md)

`dsh-summarize` re-summarizes each completed agent turn into a concise, low-friction closing answer, in the style of Claude Code's short final messages.

## Composition

Load this function plugin after `ctx.agents`. It listens to the `agent/turn-stopping` notification: when a root agent's turn is about to close, it reads the final assistant message and, if it is at least `minChars` long, steers one summary step in the same turn. The summary's own stop boundary cannot recurse because the plugin records the turn it summarized.

## Configuration

| field | default | meaning |
| --- | --- | --- |
| `minChars` | `600` | Skip when the final visible answer is shorter than this. |
| `maxChars` | `400` | Soft target length for the built-in prompt. |
| `includeSubagents` | `false` | Also summarize runtime children. |
| `prompt` | built-in | Full custom summary instruction. |

Invalid length bounds fail plugin load. The plugin owns no session event sequence, so its `./invariant` companion is intentionally empty.
