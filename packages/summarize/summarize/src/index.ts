/**
 * Re-summarize each completed agent turn into a concise, low-friction closing
 * answer, in the style of Claude Code's short final messages.
 *
 * At the `agent/turn-stopping` boundary (the turn is about to close with no
 * pending work), the plugin steers one extra step that asks the model to condense
 * what it just produced. A per-agent turn guard makes the summary a one-shot, so
 * the summary's own stop boundary cannot recurse.
 *
 * @module @deepseek-ai/dsh-summarize
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'summarize'

/** The agent registry used to scope the plugin to root agents. */
export const inject = ['agents']

/** Default minimum visible-answer length (chars) below which a turn is left as-is. */
export const DEFAULT_MIN_CHARS = 600
/** Default soft target length (chars) the built-in summary prompt asks for. */
export const DEFAULT_MAX_CHARS = 400

/** Plugin configuration. */
export interface Config {
  /** Skip re-summarizing when the final visible answer is already shorter than this. */
  minChars?: number
  /** Soft target length hint passed to the built-in summary prompt. */
  maxChars?: number
  /** Also summarize runtime children (subagents); defaults to root agents only. */
  includeSubagents?: boolean
  /** Fully custom summary instruction; overrides the built-in prompt. */
  prompt?: string
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  minChars: z.number(),
  maxChars: z.number(),
  includeSubagents: z.boolean(),
  prompt: z.string(),
})

/** Built-in summary instruction; `maxChars` is interpolated as a soft length bound. */
export function defaultPrompt(maxChars: number): string {
  return [
    '把这次任务的最终结果浓缩成一份简洁精炼的总结，作为最终回答。要求：',
    '1. 只保留关键结论、关键改动/产出、关键数字和下一步行动（若有）。',
    '2. 删除过程性描述、重复内容、铺垫、客套话和与结论无关的细节。',
    '3. 用最少的字、短句或分点，让读者一眼看懂，降低阅读负担。',
    '4. 不要展开新话题、不要执行新任务，只做总结。',
    `目标长度：${maxChars} 字以内，越短越好。`,
  ].join('\n')
}

/** Validate length bounds at plugin load, failing loud for non-integers or negatives. */
function validateBounds(minChars: number, maxChars: number): void {
  for (const [label, value] of [['minChars', minChars], ['maxChars', maxChars]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`summarize: ${label} must be a non-negative safe integer, got ${String(value)}`)
    }
  }
}

/** Visible text of the turn's final assistant message, or '' when there is none. */
function finalVisibleText(agent: Agent, turn: number): string {
  const events = agent.session.events
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined) continue
    if (event.type !== 'assistant/message' || event.data.turn !== turn) continue
    let text = ''
    for (const block of event.data.message.content) {
      if (block.type === 'text') text += block.text
    }
    return text
  }
  return ''
}

/**
 * Install the summarize listener. The listener is a notification: it reads the
 * final answer and, when the answer is long enough, steers one concise-summary
 * step into the SAME turn (the loop re-reads its inbox and continues). Data
 * decides the outcome, so listener order cannot change it.
 * @param ctx - plugin context; the listener is disposed with it.
 * @param config - length thresholds, subagent scope, and prompt override.
 * @throws when a length bound is not a non-negative safe integer.
 */
export function apply(ctx: Context, config: Config): void {
  const minChars = config.minChars ?? DEFAULT_MIN_CHARS
  const maxChars = config.maxChars ?? DEFAULT_MAX_CHARS
  validateBounds(minChars, maxChars)
  const prompt = config.prompt ?? defaultPrompt(maxChars)

  // Last turn already summarized, per agent. The summary continues the SAME
  // turn, so its own stop boundary re-enters this listener with the same turn
  // number; the guard makes the whole flow a one-shot.
  const summarized = new Map<Agent, number>()

  ctx.on('agent/turn-stopping', ({ agent, turn }) => {
    if (!config.includeSubagents && !ctx.agents.roots().includes(agent)) return
    if ((summarized.get(agent) ?? -1) >= turn) return
    if (finalVisibleText(agent, turn).length < minChars) return
    summarized.set(agent, turn)
    agent.steer(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: name },
    }))
  })

  ctx.on('agent/disposed', ({ agent }) => {
    summarized.delete(agent)
  })
}
