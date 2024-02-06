import { TelemetryEventEmitter } from '../types.js';
import { catcherMetrics } from './catcher.js';
import { engineMetrics } from './engine.js';
import { notifierMetrics } from './notifiers.js';
import { HeadCatcher } from '../../monitoring/head-catcher.js';
import { NotifierHub } from '../../notification/hub.js';
import { MatchingEngine } from '../../monitoring/matching.js';

export function collect(observer: TelemetryEventEmitter) {
  if (observer instanceof MatchingEngine) {
    engineMetrics(observer);
  } else if (observer instanceof HeadCatcher) {
    catcherMetrics(observer);
  } else if (observer instanceof NotifierHub) {
    notifierMetrics(observer);
  }
}