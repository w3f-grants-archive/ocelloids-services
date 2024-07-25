import { jest } from '@jest/globals'

import { ValidationError } from '@/errors.js'
import { Switchboard } from '@/services/subscriptions/switchboard.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { flushPromises } from '@/testing/promises.js'
import { _egress, _services } from '@/testing/services.js'
import { FastifyBaseLogger, FastifyRequest } from 'fastify'
import z, { ZodError } from 'zod'
import WebsocketProtocol from './protocol.js'

const testSub: Subscription = {
  id: 'test-subscription',
  agent: 'xcm',
  owner: 'test-account',
  args: {
    origin: 'urn:ocn:local:1000',
    senders: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'],
    destinations: ['urn:ocn:local:2000'],
  },
  channels: [
    {
      type: 'websocket',
    },
  ],
}

const mockRequest = {
  id: 'mockRequestId',
  ip: 'mockRequestIp',
  server: {},
} as FastifyRequest

const emptyStream = {
  close: jest.fn(),
  once: jest.fn(),
  on: jest.fn(),
  write: jest.fn(),
  send: jest.fn(),
} as any

const testSubData = Buffer.from(JSON.stringify(testSub))
const testSubStream = {
  ...emptyStream,
  on: jest.fn((_: string, fn: (data: Buffer) => void) => {
    fn(testSubData)
  }),
}

describe('WebsocketProtocol', () => {
  let mockLogger
  let testSwitchboard: Switchboard
  let websocketProtocol: WebsocketProtocol

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    } as unknown as FastifyBaseLogger
    testSwitchboard = new Switchboard(_services, {})
    websocketProtocol = new WebsocketProtocol(mockLogger, testSwitchboard, {
      wsMaxClients: 2,
    })
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await _services.levelDB.clear()
    await _services.agentCatalog.stop()
    websocketProtocol.stop()
  })

  describe('handle', () => {
    describe('without auth', () => {
      it('should handle on-demand ephemeral subscriptions', async () => {
        const subscribeSpy = jest.spyOn(testSwitchboard, 'subscribe')
        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()
        expect(subscribeSpy).toHaveBeenCalledTimes(1)
      })

      it('should unsubscribe when socket is closed', async () => {
        const subscribeSpy = jest.spyOn(testSwitchboard, 'subscribe')
        const mockSwitchboardUnsubscribe = jest.spyOn(testSwitchboard, 'unsubscribe')
        let closeHandler: () => Promise<void> = () => Promise.resolve()
        const mockStream = {
          ...testSubStream,
          once: jest.fn((event: string, fn: () => Promise<void>) => {
            if (event === 'close') {
              closeHandler = fn
            }
          }),
        } as any

        await websocketProtocol.handle(mockStream, mockRequest)
        await flushPromises()
        expect(subscribeSpy).toHaveBeenCalledTimes(1)
        await closeHandler()
        expect(mockSwitchboardUnsubscribe).toHaveBeenCalledTimes(1)
      })

      it('should send error if throws ZodError on subscribe', async () => {
        jest.spyOn(testSwitchboard, 'subscribe').mockRejectedValueOnce(
          new ZodError([
            {
              code: z.ZodIssueCode.custom,
              fatal: true,
              message: 'test error',
              path: ['ws-test'],
            },
          ]),
        )
        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()
        expect(jest.spyOn(testSwitchboard, 'subscribe')).toHaveBeenCalledTimes(1)
        expect(testSubStream.send).toHaveBeenCalledWith(
          '{"issues":[{"code":"custom","fatal":true,"message":"test error","path":["ws-test"]}],"name":"ZodError"}',
          expect.any(Function),
        )
      })

      it('should send error if subscription is not valid JSON', async () => {
        const mockData = Buffer.from('macario')
        const mockStream = {
          ...emptyStream,
          on: jest.fn((_: string, fn: (data: Buffer) => void) => {
            fn(mockData)
          }),
        } as any

        await websocketProtocol.handle(mockStream, mockRequest)
        await flushPromises()
        expect(jest.spyOn(testSwitchboard, 'subscribe')).toHaveBeenCalledTimes(0)
        expect(mockStream.send).toHaveBeenCalledWith(
          '{"issues":[{"code":"custom","message":"Invalid JSON","path":[]}],"name":"ZodError"}',
          expect.any(Function),
        )
      })

      it('should send error if throws ValidationError on subscribe', async () => {
        jest
          .spyOn(testSwitchboard, 'subscribe')
          .mockRejectedValueOnce(new ValidationError('test validation error'))
        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()
        expect(jest.spyOn(testSwitchboard, 'subscribe')).toHaveBeenCalledTimes(1)
        expect(testSubStream.send).toHaveBeenCalledWith(
          '{"issues":[{"code":"custom","path":["filter","match"],"message":"test validation error"}],"name":"ZodError"}',
          expect.any(Function),
        )
      })

      it('should close socket stream if throws unknown error on subscribe', async () => {
        jest.spyOn(testSwitchboard, 'subscribe').mockRejectedValueOnce(new Error('test error'))
        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()
        expect(jest.spyOn(testSwitchboard, 'subscribe')).toHaveBeenCalledTimes(1)
        expect(testSubStream.close).toHaveBeenCalledWith(1011, 'server error')
      })

      it('should handle additional connections to existing subscriptions', async () => {
        jest.spyOn(testSwitchboard, 'findSubscription').mockReturnValueOnce(Promise.resolve(testSub))
        const emitSpy = jest.spyOn(websocketProtocol, 'emit')

        await websocketProtocol.handle(emptyStream, mockRequest, {
          subscriptionId: 'test-subscription',
          agentId: 'xcm',
        })
        await flushPromises()
        expect(emitSpy).toHaveBeenCalledWith('telemetrySocketListener', mockRequest.ip, testSub)
        expect(emptyStream.once).toHaveBeenCalledWith('close', expect.any(Function))
      })

      it('should close connection if number of connections exceed maxClients', async () => {
        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()
        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()
        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()

        expect(testSubStream.close).toHaveBeenCalledWith(1013, 'server too busy')
      })

      it('should close connection with error if websocket channel not enabled in subscription', async () => {
        const mockData = Buffer.from(
          JSON.stringify({
            ...testSub,
            channels: [{ type: 'log' }],
          }),
        )
        const mockStream = {
          ...emptyStream,
          on: jest.fn((_: string, fn: (data: Buffer) => void) => {
            fn(mockData)
          }),
        } as any
        jest.spyOn(testSwitchboard, 'findSubscription').mockImplementationOnce(() =>
          Promise.resolve({
            ...testSub,
            channels: [{ type: 'log' }],
          }),
        )

        await websocketProtocol.handle(mockStream, mockRequest, {
          subscriptionId: 'test-subscription',
          agentId: 'xcm',
        })
        await flushPromises()

        expect(mockStream.close).toHaveBeenCalledWith(1007, 'inconsistent payload')
      })

      it('should close connection with error code if unable to add subscription', async () => {
        jest.spyOn(testSwitchboard, 'subscribe').mockImplementationOnce(() => {
          throw new Error('Test error')
        })

        await websocketProtocol.handle(testSubStream, mockRequest)
        await flushPromises()

        expect(testSubStream.close).toHaveBeenCalledWith(1011, 'server error')
      })

      it('should close connection with error code if an error occurs', async () => {
        const mockStream = { close: jest.fn() } as any
        jest.spyOn(testSwitchboard, 'findSubscription').mockImplementationOnce(() => {
          throw new Error('subscription not found')
        })
        await websocketProtocol.handle(mockStream, mockRequest, { subscriptionId: 'testId', agentId: 'xcm' })
        expect(mockStream.close).toHaveBeenCalledWith(1007, 'inconsistent payload')
      })

      it('should broadcast on websocket egress event', async () => {
        const msg = {
          metadata: {
            type: 'test',
            agentId: 'xcm',
            subscriptionId: testSub.id,
            networkId: testSub.args.origin,
            timestamp: Date.now(),
          },
          payload: {},
        }
        const emitSpy = jest.spyOn(websocketProtocol, 'emit')
        await testSwitchboard.subscribe(testSub)

        await websocketProtocol.handle(testSubStream, mockRequest, {
          agentId: 'xcm',
          subscriptionId: testSub.id,
        })
        await flushPromises()
        _egress.emit('websocket', testSub, msg)

        expect(testSubStream.send).toHaveBeenCalledTimes(1)
        expect(emitSpy).toHaveBeenCalledTimes(2)
        expect(emitSpy).toHaveBeenNthCalledWith(2, 'telemetryPublish', {
          type: 'websocket',
          subscription: msg.metadata.subscriptionId,
          agent: msg.metadata.agentId,
          channel: mockRequest.ip,
          error: undefined,
        })
      })

      it('should emit telemetry error events on broadcast error', async () => {
        const msg = {
          metadata: {
            type: 'test',
            agentId: 'xcm',
            subscriptionId: testSub.id,
            networkId: testSub.args.origin,
            timestamp: Date.now(),
          },
          payload: {},
        }
        const emitSpy = jest.spyOn(websocketProtocol, 'emit')
        jest.spyOn(testSubStream, 'send').mockImplementationOnce(() => {
          throw new Error('test error')
        })

        await testSwitchboard.subscribe(testSub)

        await websocketProtocol.handle(testSubStream, mockRequest, {
          agentId: 'xcm',
          subscriptionId: testSub.id,
        })
        await flushPromises()
        _egress.emit('websocket', testSub, msg)

        expect(emitSpy).toHaveBeenCalledTimes(2)
        expect(emitSpy).toHaveBeenNthCalledWith(2, 'telemetryPublishError', {
          type: 'websocket',
          subscription: msg.metadata.subscriptionId,
          agent: msg.metadata.agentId,
          channel: mockRequest.ip,
          error: 'test error',
        })
      })
    })

    describe('with auth', () => {
      const mockVerify = jest.fn()

      const mockRequestWithAuth = {
        id: 'mockRequestId',
        ip: 'mockRequestIp',
        routeOptions: {
          config: { caps: ['*:write'] },
        },
        server: {
          authEnabled: true,
          jwt: {
            verify: mockVerify,
          },
          log: {
            error: jest.fn(),
          },
          accountsRepository: {
            findApiTokenById: (_jti: string) =>
              Promise.resolve({
                id: 'sss',
                status: 'enabled',
                name: 'test-account',
                created_at: Date.now(),
                account_id: 4,
                scope: '*:read *:write',
                account: {
                  id: 4,
                  status: 'enabled',
                  subject: 'macario@cheeto.io',
                  created_at: Date.now(),
                },
              }),
          },
        },
      } as unknown as FastifyRequest

      const testStreamWithAuth = {
        ...testSubStream,
        once: jest.fn((_: string, fn: (data: Buffer) => void) => {
          fn(testSubData)
        }),
      } as any

      it('should subscribe for authorized requests', async () => {
        mockVerify.mockReturnValueOnce({
          sub: 'macario@cheeto.io',
          jti: '01000000000000000000000000',
        })
        const subscribeSpy = jest.spyOn(testSwitchboard, 'subscribe')

        await websocketProtocol.handle(testStreamWithAuth, mockRequestWithAuth)
        await new Promise(setImmediate)
        await flushPromises()

        expect(subscribeSpy).toHaveBeenCalledTimes(1)
      })

      it('should do ownership check on connection to existing subscriptions if auth is enabled', async () => {
        mockVerify.mockReturnValueOnce({
          sub: 'macario@cheeto.io',
          jti: '01000000000000000000000000',
        })
        jest.spyOn(testSwitchboard, 'findSubscription').mockReturnValueOnce(Promise.resolve(testSub))

        await websocketProtocol.handle(testStreamWithAuth, mockRequestWithAuth, {
          subscriptionId: 'test-subscription',
          agentId: 'xcm',
        })
        await new Promise(setImmediate)
        await flushPromises()

        expect(testSwitchboard.findSubscription).toHaveBeenCalled()
        expect(emptyStream.close).toHaveBeenCalledWith(1002, 'auth error')
      })

      it('should close with auth error if not authorized', async () => {
        await websocketProtocol.handle(testStreamWithAuth, mockRequestWithAuth)
        await new Promise(setImmediate)
        await flushPromises()

        expect(jest.spyOn(testSwitchboard, 'subscribe')).toHaveBeenCalledTimes(0)
        expect(mockVerify).toHaveBeenCalledTimes(1)
        expect(testStreamWithAuth.close).toHaveBeenCalledWith(1002, 'auth error')
      })
    })
  })
})
