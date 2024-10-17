import { Observable, map, mergeMap } from 'rxjs'

import { HexString } from '@/lib.js'
import { IngressConsumer } from '@/services/ingress/index.js'
import { ApiContext } from '@/services/networking/context.js'
import { NetworkURN } from '@/services/types.js'
import { asSerializable } from '../base/util.js'
import { mapAssetsPalletAssets, mapAssetsRegistryAndLocations } from './ops.js'
import { AssetMapper, AssetMetadata, StorageCodecs, WithRequired, networks } from './types.js'

const BYPASS_MAPPER: AssetMapper = () => []

const bifrostMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('AssetRegistry', 'CurrencyMetadatas')
  const keyPrefix = codec.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'locations'> = {
    assets: codec,
    locations: context.storageCodec('AssetRegistry', 'CurrencyIdToLocations'),
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsRegistryAndLocations(codecs, {
        chainId: networks.bifrost,
        options: {
          ed: 'minimal_balance',
        },
      }),
    },
  ]
  return mappings
}

const hydrationMapper: AssetMapper = (context: ApiContext) => {
  const codec = context.storageCodec('AssetRegistry', 'Assets')
  const keyPrefix = codec.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'locations'> = {
    assets: codec,
    locations: context.storageCodec('AssetRegistry', 'AssetLocations'),
  }
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsRegistryAndLocations(codecs, {
        chainId: networks.hydration,
        options: {
          ed: 'existential_deposit',
          isSufficient: 'is_sufficient',
        },
      }),
    },
  ]
  return mappings
}

const assetHubMapper = (chainId: string) => (context: ApiContext) => {
  const codec = context.storageCodec('Assets', 'Asset')
  const keyPrefix = codec.enc() as HexString
  const codecs: WithRequired<StorageCodecs, 'assets' | 'metadata'> = {
    assets: codec,
    metadata: context.storageCodec('Assets', 'Metadata'),
  }

  const foreignAssetsCodec = context.storageCodec('ForeignAssets', 'Asset')
  const foreignAssetsKeyPrefix = foreignAssetsCodec.enc() as HexString
  const mappings = [
    {
      keyPrefix,
      mapEntry: mapAssetsPalletAssets(codecs, chainId),
    },
    {
      // Foreign assets pallet
      keyPrefix: foreignAssetsKeyPrefix,
      mapEntry: (keyArgs: string, ingress: IngressConsumer) => {
        const assetCodec = foreignAssetsCodec
        const assetMetadataCodec = context.storageCodec('ForeignAssets', 'Metadata')
        return (source: Observable<HexString>): Observable<AssetMetadata> => {
          return source.pipe(
            map((buffer) => {
              const assetId = assetCodec.keyDecoder(keyArgs)[0]
              const multiLocation = asSerializable(assetId)
              const assetDetails = assetCodec.dec(buffer)

              return {
                id: assetId,
                xid: keyArgs,
                updated: Date.now(),
                isSufficient: assetDetails.is_sufficient,
                existentialDeposit: assetDetails.min_balance.toString(),
                chainId,
                multiLocation,
                raw: asSerializable(assetDetails),
              } as AssetMetadata
            }),
            mergeMap((asset) => {
              const key = assetMetadataCodec.enc(asset.id) as HexString
              return ingress.getStorage(asset.chainId as NetworkURN, key).pipe(
                map((buffer) => {
                  const assetDetails = buffer ? assetMetadataCodec.dec(buffer) : null
                  if (assetDetails) {
                    return {
                      ...asset,
                      name: assetDetails.name.asText(),
                      symbol: assetDetails.symbol.asText(),
                      decimals: assetDetails.decimals,
                      raw: asSerializable({
                        ...asset.raw,
                        ...assetDetails,
                      }),
                    }
                  } else {
                    return asset
                  }
                }),
              )
            }),
          )
        }
      },
    },
  ]
  return mappings
}

export const mappers: Record<string, AssetMapper> = {
  [networks.polkadot]: BYPASS_MAPPER,
  [networks.bridgeHub]: BYPASS_MAPPER,
  [networks.nodle]: BYPASS_MAPPER,
  [networks.phala]: BYPASS_MAPPER,
  [networks.mythos]: BYPASS_MAPPER,
  //[networks.pendulum]: pendulumMapper,
  [networks.assetHub]: assetHubMapper(networks.assetHub),
  //[networks.acala]: acalaMapper,
  [networks.bifrost]: bifrostMapper,
  //[networks.astar]: astarMapper,
  //[networks.interlay]: interlayMapper,
  //[networks.centrifuge]: centrifugeMapper,
  [networks.hydration]: hydrationMapper,
  //[networks.moonbeam]: moonbeamMapper,
  //[networks.manta]: mantaMapper,
  [networks.kusama]: BYPASS_MAPPER,
  [networks.kusamaBridgeHub]: BYPASS_MAPPER,
  [networks.kusamaCoretime]: BYPASS_MAPPER,
  [networks.kusamaAssetHub]: assetHubMapper(networks.kusamaAssetHub),
}
