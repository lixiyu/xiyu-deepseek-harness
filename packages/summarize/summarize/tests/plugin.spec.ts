import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as summarize from '../src/index.ts'
import type { Config } from '../src/index.ts'

const LONG = 'x'.repeat(700)

/** Minimal stop-finish text response: the loop assembles it into an assistant message. */
function textResponse(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

class ScriptedAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(private readonly script: StreamChunk[][]) {
    super()
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const chunks = this.script.shift()
    if (chunks === undefined) throw new Error('ScriptedAdapter: script exhausted')
    for (const chunk of chunks) yield chunk
  }
}

async function loopHarness(adapter: ScriptedAdapter, config: Config = {}): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(summarize, config)
  ctx.llm.registerAdapter(['mock'], adapter)
  return ctx
}

function send(agent: Agent, text: string): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
}

function summarizeSteers(agent: Agent): number {
  return agent.session.events.filter(event =>
    event.type === 'user/message'
    && event.data.source.kind === 'plugin'
    && event.data.source.plugin === 'summarize',
  ).length
}

function lastAssistantText(agent: Agent): string {
  for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
    const event = agent.session.events[index]
    if (event === undefined || event.type !== 'assistant/message') continue
    let text = ''
    for (const block of event.data.message.content) {
      if (block.type === 'text') text += block.text
    }
    return text
  }
  return ''
}

describe('summarize plugin', () => {
  it('has the Loader-safe function-plugin export shape', () => {
    expect('default' in summarize).toBe(false)
    expect(summarize.name).toBe('summarize')
    expect(summarize.inject).toEqual(['agents'])
    expect(summarize.Config).toBeDefined()
    expect(typeof summarize.apply).toBe('function')
    const loader = Object.create(Loader.prototype) as Loader
    expect(loader.unwrapExports(summarize)).toBe(summarize)
  })

  it('steers one concise summary after a long final answer', async () => {
    const adapter = new ScriptedAdapter([textResponse(LONG), textResponse('short summary')])
    const ctx = await loopHarness(adapter)
    const agent = ctx.agentLoop.create(SessionId('long'), { provider: 'mock', model: 'mock' })

    send(agent, 'do the thing')
    await agent.whenIdle()

    expect(adapter.requests).toHaveLength(2)
    expect(summarizeSteers(agent)).toBe(1)
    expect(lastAssistantText(agent)).toBe('short summary')
    await ctx.fiber.dispose()
  })

  it('leaves a short final answer untouched', async () => {
    const adapter = new ScriptedAdapter([textResponse('done')])
    const ctx = await loopHarness(adapter)
    const agent = ctx.agentLoop.create(SessionId('short'), { provider: 'mock', model: 'mock' })

    send(agent, 'hi')
    await agent.whenIdle()

    expect(adapter.requests).toHaveLength(1)
    expect(summarizeSteers(agent)).toBe(0)
    expect(lastAssistantText(agent)).toBe('done')
    await ctx.fiber.dispose()
  })

  it('does not recurse when the summary itself is still long', async () => {
    const adapter = new ScriptedAdapter([textResponse(LONG), textResponse(LONG)])
    const ctx = await loopHarness(adapter)
    const agent = ctx.agentLoop.create(SessionId('recursive'), { provider: 'mock', model: 'mock' })

    send(agent, 'verbose task')
    await agent.whenIdle()

    expect(adapter.requests).toHaveLength(2)
    await ctx.fiber.dispose()
  })

  it('honors a custom threshold and prompt', async () => {
    const adapter = new ScriptedAdapter([textResponse('medium answer'), textResponse('ok')])
    const ctx = await loopHarness(adapter, { minChars: 10, prompt: 'CUSTOM: condense it' })
    const agent = ctx.agentLoop.create(SessionId('custom'), { provider: 'mock', model: 'mock' })

    send(agent, 'explain')
    await agent.whenIdle()

    expect(adapter.requests).toHaveLength(2)
    const steer = agent.session.events.find(event =>
      event.type === 'user/message'
      && event.data.source.kind === 'plugin'
      && event.data.source.plugin === 'summarize',
    )
    expect(steer?.type === 'user/message' && steer.data.content).toContainEqual({ type: 'text', text: 'CUSTOM: condense it' })
    await ctx.fiber.dispose()
  })

  it('fails loud for invalid length bounds', async () => {
    for (const bad of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const ctx = new Context()
      await mountAgentLoopTestDependencies(ctx)
      await expect(ctx.plugin(summarize, { minChars: bad })).rejects.toThrow(/minChars/)
      await ctx.fiber.dispose()
    }
  })
})
