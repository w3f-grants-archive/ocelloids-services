import { Observable, map, mergeMap, filter } from 'rxjs';

import type { PolkadotPrimitivesV5InherentData } from '@polkadot/types/lookup';
import type { Registry } from '@polkadot/types/types';

import { ControlQuery, filterNonNull, types } from '@sodazone/ocelloids-sdk';
import { getMessageId, matchExtrinsic } from './util.js';
import { fromXcmpFormat } from './xcm-format.js';
import { GenericXcmRelayedWithContext, XcmRelayedWithContext } from '../types.js';
import { createNetworkId, getChainId, getConsensus } from '../../config.js';
import { OcnURN } from '../../types.js';

export function extractRelayReceive(origin: OcnURN, messageControl: ControlQuery, registry: Registry) {
  return (source: Observable<types.TxWithIdAndEvent>): Observable<XcmRelayedWithContext> => {
    return source.pipe(
      filter(({ extrinsic }) => matchExtrinsic(extrinsic, 'parainherent', 'enter')),
      map(({ extrinsic, dispatchError }) => {
        const { backedCandidates } = extrinsic.args[0] as unknown as PolkadotPrimitivesV5InherentData;
        const backed = backedCandidates.find((c) => c.candidate.descriptor.paraId.toString() === getChainId(origin));
        if (backed) {
          const { horizontalMessages } = backed.candidate.commitments;
          const message = horizontalMessages.find(({ recipient }) => {
            return messageControl.value.test({
              recipient: createNetworkId(getConsensus(origin), recipient.toNumber().toString()),
            });
          });
          if (message) {
            const xcms = fromXcmpFormat(message.data, registry);
            const { blockHash, blockNumber, extrinsicId } = extrinsic;
            return xcms.map(
              (xcmProgram) =>
                new GenericXcmRelayedWithContext({
                  blockHash: blockHash.toHex(),
                  blockNumber: blockNumber.toPrimitive(),
                  recipient: createNetworkId(getConsensus(origin), message.recipient.toString()),
                  messageHash: xcmProgram.hash.toHex(),
                  messageId: getMessageId(xcmProgram),
                  origin,
                  extrinsicId,
                  outcome: dispatchError ? 'Fail' : 'Success',
                  error: dispatchError ? dispatchError.toHuman() : null,
                })
            );
          }
        }
        return null;
      }),
      filterNonNull(),
      mergeMap((x) => x)
    );
  };
}
