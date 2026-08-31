/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-summarize`.
 * @module @deepseek-ai/dsh-summarize/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-summarize'

/** Cordis companion plugin name. */
export const name = 'summarize-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package owns no independent event sequence or mutable
 * data relation beyond the steering it contributes through the agent loop's typed
 * `agent/turn-stopping` notification.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
