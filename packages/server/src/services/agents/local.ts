import { NotFound } from '../../errors.js'
import { AgentServiceOptions } from '../../types.js'
import { Logger, Services } from '../index.js'
import { NotifierHub } from '../notification/index.js'
import { NotifierEvents } from '../notification/types.js'
import { NotificationListener, Subscription } from '../subscriptions/types.js'
import { Agent, AgentId, AgentRuntimeContext, AgentService } from './types.js'
import { XcmAgent } from './xcm/xcm-agent.js'

/**
 * Local agent service.
 */
export class LocalAgentService implements AgentService {
  readonly #log: Logger
  readonly #agents: Record<AgentId, Agent>
  readonly #notifier: NotifierHub

  constructor(ctx: Services, _options: AgentServiceOptions) {
    this.#log = ctx.log
    this.#notifier = new NotifierHub(ctx)
    this.#agents = this.#loadAgents({
      ...ctx,
      notifier: this.#notifier,
    })
  }

  addNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub {
    return this.#notifier.on(eventName, listener)
  }

  removeNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub {
    return this.#notifier.off(eventName, listener)
  }

  getAgentIds(): AgentId[] {
    return Object.keys(this.#agents)
  }

  getAgentById<A extends Agent = Agent>(agentId: AgentId): A {
    if (this.#agents[agentId]) {
      return this.#agents[agentId] as A
    }
    throw new NotFound(`Agent not found (agent=${agentId})`)
  }

  getAgentInputSchema(agentId: AgentId) {
    const agent = this.getAgentById(agentId)
    return agent.inputSchema
  }

  async startAgent(agentId: string, subscriptions: Subscription[] = []) {
    const agent = this.#agents[agentId]
    this.#log.info('[LOCAL] starting agent %s (%s)', agentId, agent.metadata.name ?? 'unnamed')
    await agent.start(subscriptions)
  }

  async stop() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[LOCAL] stopping agent %s', id)
      await agent.stop()
    }
  }

  collectTelemetry() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[LOCAL] collect telemetry from agent %s', id)
      agent.collectTelemetry()
    }
  }

  #loadAgents(ctx: AgentRuntimeContext) {
    const xcm = new XcmAgent(ctx)
    return {
      [xcm.id]: xcm,
    } as unknown as Record<AgentId, Agent>
  }
}
