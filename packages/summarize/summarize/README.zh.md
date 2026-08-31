# @deepseek-ai/dsh-summarize

[English](README.md) | 中文

`dsh-summarize` 在 agent 每完成一轮时，把最终回答重新总结成简洁精炼的收尾（Claude Code 风格）。

## 组合

在 `ctx.agents` 之后加载该函数插件。它监听 `agent/turn-stopping` 通知：当根 agent 的一轮即将结束时，读取最后的 assistant 消息，若长度达到 `minChars`，就在同一轮中引导一步总结。插件会记录已总结的轮次，因此总结自身的停止边界不会递归触发。

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `minChars` | `600` | 最终可见回答短于该长度则跳过。 |
| `maxChars` | `400` | 内置提示词的目标长度。 |
| `includeSubagents` | `false` | 是否同时总结运行时子 agent。 |
| `prompt` | 内置 | 完全自定义的总结指令。 |

非法的长度阈值会让插件加载失败。该插件不拥有任何 session 事件序列，因此其 `./invariant` 伴生为空。
