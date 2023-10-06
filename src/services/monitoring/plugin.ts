import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { Header } from '@polkadot/types/interfaces';

import Connector from '../connector.js';
import { $QuerySubscription, QuerySubscription } from '../types.js';
import { XcmMessageEvent } from './types.js';
import { FinalizedHeadCollector, MessageCollector } from './collectors/index.js';

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function Monitoring(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const { engine, db, log, config } = fastify;

  const ctx = {
    log,
    config
  };

  const connector = new Connector(ctx);
  const msgCollector = new MessageCollector(ctx, connector, db);

  msgCollector.on('message', (message: XcmMessageEvent) => {
    log.info(
      `out xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}, recipient=${message.recipient}`
    );

    engine.waitOrigin({
      chainId: message.chainId,
      blockHash: message.event.blockHash.toHex()
    }, {
      recipient: message.recipient,
      messageHash: message.messageHash
    });
  });

  msgCollector.on('receive', (message: XcmMessageEvent) => {
    log.info(
      `in xcm: [chainId=${message.chainId}, messageHash=${message.messageHash}`
    );

    engine.waitDestination({
      chainId: message.chainId,
      blockHash: message.event.blockHash.toHex()
    }, {
      messageHash: message.messageHash
    });
  });

  msgCollector.start();

  const finHeadCollector = new FinalizedHeadCollector(ctx, connector);

  finHeadCollector.on('head', ({
    chainId, head
  } : {
    chainId: string | number, head: Header
  }) => {
    log.info(
      `finalized: [chainId=${chainId}, hash=${head.hash.toHex()}, block=${head.number.toNumber()}]`
    );

    engine.onFinalizedBlock({
      chainId, blockHash: head.hash.toHex()
    });
  });

  finHeadCollector.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    msgCollector.stop();
    finHeadCollector.stop();
    await connector.disconnect();
  });

  fastify.get('/subs', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: zodToJsonSchema(
            $QuerySubscription
          )
        }
      }
    }
  }, async (_, reply) => {
    reply.send(msgCollector.listSubscriptions());
  });

  fastify.post <{
    Body: QuerySubscription
  }>('/subs', {
    schema: {
      body: zodToJsonSchema(
        $QuerySubscription
      ),
      response: {
        201: {
          type: 'null',
          description: 'Accepted'
        }
      }
    }
  }, async (request, reply) => {
    msgCollector.subscribe(request.body);

    reply.status(201).send();
  });

  fastify.delete<{
    Params: {
      id: string
    }
  }>('/subs/:id', {
    schema: {
      params: {
        id: { type: 'string', pattern: '[0-9]+' }
      },
      response: {
        201: {
          type: 'null',
          description: 'Accepted'
        }
      }
    }
  }, async (request, reply) => {
    msgCollector.unsubscribe(request.params.id);

    reply.status(201).send();
  });
}

export default Monitoring;