'use strict';

const fs = require('fs');
const path = require('path');
const { createController } = require('./public/offer-delivery-retry.js');

function assert(value, message) { if (!value) throw new Error(message); }

function timerHarness() {
  const pending = [];
  return {
    setTimer(fn) { pending.push(fn); return fn; },
    clearTimer(fn) { const index = pending.indexOf(fn); if (index >= 0) pending.splice(index, 1); },
    async next() { const fn = pending.shift(); if (fn) { fn(); await new Promise(resolve => setImmediate(resolve)); } },
    get size() { return pending.length; }
  };
}

(async () => {
  const app = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
  assert(app.includes("send: current => sendSignal('offer', current)"), 'offer replay does not reuse the existing localDescription');
  assert(app.includes('generation === state.rtcPeerGeneration'), 'offer replay is not tied to the active RTC generation');
  assert(app.includes("cancelOfferDeliveryRetry('answer-applied')"), 'answer does not cancel offer replay');
  assert(app.includes("closePeerConnection('offer-delivery-exhausted')"), 'bounded retry does not rebuild the RTC generation');

  {
    const timers = timerHarness();
    let calls = 0;
    let delivered = false;
    const controller = createController({ maxAttempts: 3, retryDelaysMs: [1, 1], setTimer: timers.setTimer, clearTimer: timers.clearTimer });
    await controller.start({
      description: { type: 'offer', sdp: 'same-offer' }, isActive: () => true,
      send: async description => { calls += 1; assert(description.sdp === 'same-offer', 'retry created or changed the offer'); return calls === 1 ? null : { delivered: 1 }; },
      onDelivered: () => { delivered = true; }, onFailed() {}, onExhausted() {}, onError() {}
    });
    assert(!delivered && calls === 1 && timers.size === 1, 'failed offer was treated as delivered or not scheduled');
    await timers.next();
    assert(delivered && calls === 2 && timers.size === 0, 'existing offer was not delivered by bounded replay');
  }

  {
    const timers = timerHarness();
    let calls = 0;
    let delivered = false;
    const controller = createController({ maxAttempts: 3, retryDelaysMs: [1, 1], setTimer: timers.setTimer, clearTimer: timers.clearTimer });
    await controller.start({ description: { type: 'offer' }, isActive: () => true, send: async () => { calls += 1; return { delivered: calls < 3 ? 0 : 1 }; }, onDelivered: () => { delivered = true; }, onFailed() {}, onExhausted() {}, onError(error) { throw error; } });
    await timers.next(); await timers.next();
    assert(calls === 3 && delivered && timers.size === 0, 'delivered:0 did not replay until confirmed delivery');
  }

  {
    const timers = timerHarness();
    let calls = 0;
    let exhausted = 0;
    const controller = createController({ maxAttempts: 3, retryDelaysMs: [1, 1], setTimer: timers.setTimer, clearTimer: timers.clearTimer });
    await controller.start({ description: {}, isActive: () => true, send: async () => { calls += 1; return { delivered: 0 }; }, onDelivered() {}, onFailed() {}, onExhausted: () => { exhausted += 1; }, onError(error) { throw error; } });
    await timers.next(); await timers.next();
    assert(calls === 3 && exhausted === 1 && timers.size === 0, 'offer replay exceeded its configured bound');
  }

  {
    const timers = timerHarness();
    let generation = 1;
    let calls = 0;
    const controller = createController({ setTimer: timers.setTimer, clearTimer: timers.clearTimer });
    await controller.start({ description: {}, isActive: () => generation === 1, send: async () => { calls += 1; return { delivered: 0 }; }, onDelivered() {}, onFailed() {}, onExhausted() {}, onError(error) { throw error; } });
    generation = 2;
    await timers.next();
    assert(calls === 1, 'stale RTC generation retried its offer');
  }

  {
    const timers = timerHarness();
    let calls = 0;
    const controller = createController({ setTimer: timers.setTimer, clearTimer: timers.clearTimer });
    await controller.start({ description: {}, isActive: () => true, send: async () => { calls += 1; return { delivered: 0 }; }, onDelivered() {}, onFailed() {}, onExhausted() {}, onError(error) { throw error; } });
    controller.cancel();
    await timers.next();
    assert(calls === 1 && timers.size === 0, 'answer cancellation left an offer retry active');
  }

  console.log('OFFER_DELIVERY_RETRY_OK');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
