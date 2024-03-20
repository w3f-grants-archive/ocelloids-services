import { blake3 } from 'hash-wasm';

import { XcmNotifyMessage, AnyJson, AssetsTrapped } from '../../../..';

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export type XcmJourneyWaypoint = {
  chainId: string;
  blockNumber?: string;
  outcome?: string;
  error?: AnyJson;
  event?: any;
  extrinsic?: any;
  instructions?: any;
  assetsTrapped?: AnyJson;
  skipped?: boolean;
  timeout?: boolean;
};

export type XcmJourney = {
  id: string;
  sender: AnyJson;
  updated: number;
  created: string;
  instructions: any;
  origin: XcmJourneyWaypoint;
  destination: XcmJourneyWaypoint;
  stops: XcmJourneyWaypoint[];
};

export async function toJourneyId({ origin, destination, messageId, waypoint: { messageHash } }: XcmNotifyMessage) {
  return messageId === undefined
    ? await blake3(`${origin.chainId}:${origin.blockNumber}|${destination.chainId}|${messageHash}`)
    : Promise.resolve(messageId);
}

function updateFailures(journey: XcmJourney): XcmJourney {
  const failureIndex = journey.stops.findIndex((s) => s.outcome === 'Fail');
  if (failureIndex === -1) {
    return journey;
  }

  journey.destination.outcome = 'Fail';
  journey.destination.skipped = true;

  if (failureIndex < journey.stops.length - 1) {
    journey.stops = journey.stops.map((s, i) => {
      if (i > failureIndex) {
        return {
          ...s,
          outcome: 'Fail',
          skipped: true
        };
      } else {
        return s;
      }
    });
  }
  return journey;
}

function updateTimeout(journey: XcmJourney) {
  journey.destination.timeout = true;
  journey.stops = journey.stops.map(s => {
    if (s.outcome === undefined) {
      return {
        ...s,
        timeout: true
      };
    } else {
      return s;
    }
  });

  return journey;
}

async function toJourney(xcm: XcmNotifyMessage): Promise<XcmJourney> {
  const stops =
    xcm.legs.length > 1
      ? xcm.legs
          .slice(0, -1)
          .map(({ to: chainId }) => (chainId === xcm.waypoint.chainId ? { ...xcm.waypoint } : { chainId }))
      : [];

  const now = Date.now();

  return updateFailures({
    id: await toJourneyId(xcm),
    sender: xcm.sender,
    updated: now,
    created: dateTimeFormat.format(now),
    instructions: xcm.waypoint.instructions,
    origin: {
      ...xcm.origin,
    },
    destination: {
      ...xcm.destination,
    },
    stops,
  });
}

export async function mergeJourney(xcm: XcmNotifyMessage, journey?: XcmJourney): Promise<XcmJourney> {
  if (journey === undefined) {
    journey = await toJourney(xcm);
  }

  if (xcm.type === 'xcm.timeout') {
    return { ...updateTimeout(journey) }
  }

  if (journey.origin.chainId === xcm.waypoint.chainId) {
    journey.origin = xcm.waypoint;
    return { ...journey };
  }

  if (journey.destination.chainId === xcm.waypoint.chainId) {
    if (xcm.waypoint.outcome) {
      journey.updated = Date.now();
      journey.destination = xcm.waypoint;
      return { ...journey };
    }
    return journey;
  }

  const stopIndex = journey.stops.findIndex((s) => s.chainId === xcm.waypoint.chainId);

  journey.updated = Date.now();

  if (stopIndex === -1) {
    // Shuld not happen :P
    journey.stops.push({ ...xcm.waypoint });
    return { ...journey };
  } else {
    const stop = journey.stops[stopIndex];

    if (stop.outcome || xcm.waypoint.outcome === undefined) {
      return journey;
    }

    journey.stops[stopIndex] = {
      ...stop,
      ...xcm.waypoint,
    };
    return { ...updateFailures(journey) };
  }
}
