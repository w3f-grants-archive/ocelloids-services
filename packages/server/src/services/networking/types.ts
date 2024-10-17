import { type Decoder } from '@polkadot-api/substrate-bindings'

export type StorageCodec<T = any> = {
  enc: (...args: any[]) => string
  dec: Decoder<T>
  keyDecoder: (value: string) => any[]
}

export type Event = {
  module: string
  name: string
  value: Record<string, any>
}

export type EventRecord<T = Event> = {
  phase: {
    type: string
    value: number
  }
  event: T
  topics: any[]
}

export type Extrinsic = {
  module: string
  method: string
  signed: boolean
  signature: any
  address: any
  args: Record<string, any>
}

export type Block = {
  hash: string
  number: number
  extrinsics: Extrinsic[]
  events: EventRecord[]
}

export type BlockContext = {
  blockNumber: number
  blockHash: string
  blockPosition: number
  timestamp?: number
}

export type ExtrinsicWithContext = Extrinsic & BlockContext

export type BlockEvent = Event &
  BlockContext & {
    extrinsic?: ExtrinsicWithContext
    extrinsicPosition?: number
  }
