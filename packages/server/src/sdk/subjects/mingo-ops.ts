// Copyright 2023-2024 SO/DA zone
// SPDX-License-Identifier: Apache-2.0

import { AccountId } from '@polkadot-api/substrate-bindings'

import { OperatorType, Options, QueryOperator, getOperator, useOperators } from 'mingo/core'
import { BASIC_CONTEXT } from 'mingo/init/basic'
import { AnyVal, Predicate, RawObject } from 'mingo/types'
import { ensureArray, resolve } from 'mingo/util'

const accountDecoder = AccountId().dec

function addressEq(a: Uint8Array | string, b: Uint8Array | string) {
  return accountDecoder(a) === accountDecoder(b)
}

function isU8a(value?: unknown): value is Uint8Array {
  return (value && (value as Uint8Array).constructor) === Uint8Array || value instanceof Uint8Array
}

function bn(x: AnyVal) {
  switch (typeof x) {
    case 'number':
    case 'string':
    case 'bigint':
      return BigInt(x)
    default:
      throw new Error(`unable to convert ${typeof x} to BN`)
  }
}

function compare(a: AnyVal, b: AnyVal, f: Predicate<AnyVal>): boolean {
  return ensureArray(a).some((x) => f(x, b))
}

function $bn_lt(a: AnyVal, b: AnyVal): boolean {
  return compare(a, b, (x: AnyVal, y: AnyVal) => bn(x) < bn(y))
}

function $bn_lte(a: AnyVal, b: AnyVal): boolean {
  return compare(a, b, (x: AnyVal, y: AnyVal) => bn(x) <= bn(y))
}

function $bn_gt(a: AnyVal, b: AnyVal): boolean {
  return compare(a, b, (x: AnyVal, y: AnyVal) => bn(x) > bn(y))
}

function $bn_gte(a: AnyVal, b: AnyVal): boolean {
  return compare(a, b, (x: AnyVal, y: AnyVal) => bn(x) >= bn(y))
}

function $bn_eq(a: AnyVal, b: AnyVal): boolean {
  return compare(a, b, (x: AnyVal, y: AnyVal) => bn(x) === bn(y))
}

function $bn_neq(a: AnyVal, b: AnyVal): boolean {
  return compare(a, b, (x: AnyVal, y: AnyVal) => bn(x) !== bn(y))
}

function $address_eq(a: AnyVal, b: AnyVal): boolean {
  if ((typeof a === 'string' || isU8a(a)) && (typeof b === 'string' || isU8a(b))) {
    try {
      return addressEq(a, b)
    } catch (_) {
      return false
    }
  }
  return false
}

function $address_neq(a: AnyVal, b: AnyVal): boolean {
  if ((typeof a === 'string' || isU8a(a)) && (typeof b === 'string' || isU8a(b))) {
    try {
      return !addressEq(a, b)
    } catch (_) {
      return false
    }
  }
  return false
}

function createQueryOperator(predicate: Predicate<AnyVal>): QueryOperator {
  const f = (selector: string, value: AnyVal, options: Options) => {
    const opts = { unwrapArray: true }
    const depth = Math.max(1, selector.split('.').length - 1)
    return (obj: RawObject): boolean => {
      // value of field must be fully resolved.
      const lhs = resolve(obj, selector, opts)
      return predicate(lhs, value, { ...options, depth })
    }
  }
  f.op = 'query'
  return f // as QueryOperator;
}

export function installOperators() {
  // Register query operators
  if (
    getOperator(OperatorType.QUERY, '$bn_lt', {
      useGlobalContext: true,
      context: BASIC_CONTEXT,
    }) === null
  ) {
    useOperators(OperatorType.QUERY, {
      $bn_lt: createQueryOperator($bn_lt),
      $bn_lte: createQueryOperator($bn_lte),
      $bn_gt: createQueryOperator($bn_gt),
      $bn_gte: createQueryOperator($bn_gte),
      $bn_eq: createQueryOperator($bn_eq),
      $bn_neq: createQueryOperator($bn_neq),
      $address_eq: createQueryOperator($address_eq),
      $address_neq: createQueryOperator($address_neq),
    })
  }
}
