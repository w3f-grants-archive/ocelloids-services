import { Observable, share } from 'rxjs'

import { extractEvents, extractTxWithEvents, installOperators } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { IngressConsumer } from '@/services/ingress/index.js'
import { BlockEvent, BlockExtrinsicWithEvents } from '@/services/networking/index.js'
import { NetworkURN } from '@/services/types.js'

export class SharedStreams {
  static #instance: SharedStreams
  readonly #ingress: IngressConsumer

  readonly #blockEvents: Record<string, Observable<BlockEvent>>
  readonly #blockExtrinsics: Record<string, Observable<BlockExtrinsicWithEvents>>

  private constructor(ingress: IngressConsumer) {
    this.#ingress = ingress
    this.#blockEvents = {}
    this.#blockExtrinsics = {}

    installOperators()
  }

  static instance(ingress: IngressConsumer) {
    return SharedStreams.#instance ?? (SharedStreams.#instance = new SharedStreams(ingress))
  }

  checkSupportedNetwork(chainId: NetworkURN) {
    if (!this.#ingress.isNetworkDefined(chainId)) {
      throw new ValidationError(`Network not supported: ${chainId}`)
    }
  }

  blockEvents(chainId: NetworkURN): Observable<BlockEvent> {
    if (!this.#blockEvents[chainId]) {
      this.#blockEvents[chainId] = this.#ingress.finalizedBlocks(chainId).pipe(extractEvents(), share())
    }
    return this.#blockEvents[chainId]
  }

  blockExtrinsics(chainId: NetworkURN): Observable<BlockExtrinsicWithEvents> {
    if (!this.#blockExtrinsics[chainId]) {
      this.#blockExtrinsics[chainId] = this.#ingress
        .finalizedBlocks(chainId)
        .pipe(extractTxWithEvents(), /*flattenCalls(),*/ share())
    }
    return this.#blockExtrinsics[chainId]
  }
}
