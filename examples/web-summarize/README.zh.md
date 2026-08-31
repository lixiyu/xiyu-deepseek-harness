# 完成后自动总结

[English](README.md) | 中文

此 overlay 让一个 `dsh web` 进程启用「完成后自动总结」：agent 每完成一轮，插件会额外引导一步，把最终回答压缩成简洁精炼的收尾（Claude Code 风格）。仅当最终可见回答足够长（`minChars`，默认 600 字）时才触发，已经简洁的回答保持原样。

```sh
dsh web --patch examples/web-summarize/cordis.yml
```

## 原理

- 监听 `agent/turn-stopping` 通知——与 Claude Code 的 `Stop` hook 是同一个拦截点。
- 读取本轮最后的 assistant 消息；短于 `minChars` 则不动作。
- 否则在同一轮中引导一步总结（面向模型的指令），并记录该轮，避免总结自身的停止边界再次触发（一次性）。
- 默认只作用于根 agent；设置 `includeSubagents: true` 可同时总结子 agent。

## 配置

所有字段均可选：

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `minChars` | `600` | 最终可见回答短于该长度则跳过。 |
| `maxChars` | `400` | 内置提示词的目标长度（软约束）。 |
| `includeSubagents` | `false` | 是否同时总结运行时子 agent。 |
| `prompt` | 内置 | 完全自定义的总结指令（覆盖内置）。 |

内置提示词要求：只保留关键结论、改动/产出、关键数字和下一步；删除过程、重复、铺垫和客套话。
