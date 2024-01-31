import EventEmitter from 'node:events';

import { Logger, Services } from '../../services/types.js';
import { QuerySubscription, XcmMatched } from '../monitoring/types.js';
import { Notifier } from './types.js';

export class LogNotifier extends EventEmitter implements Notifier {
  #log: Logger;

  constructor({ log }: Services) {
    super();

    this.#log = log;
  }

  async notify(
    sub: QuerySubscription,
    msg: XcmMatched
  ) {
    this.#log.info(
      '[%s ➜ %s] NOTIFICATION subscription=%s, messageHash=%s, outcome=%s (o: #%s, d: #%s)',
      msg.origin.chainId,
      msg.destination.chainId,
      sub.id,
      msg.messageHash,
      msg.outcome,
      msg.origin.blockNumber,
      msg.destination.blockNumber
    );
    return Promise.resolve();
  }
}
