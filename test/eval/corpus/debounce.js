'use strict';

/**
 * Returns a function that delays calling `fn` until `wait` ms have passed
 * without another call. `leading` calls immediately on the first call.
 */
function debounce(fn, wait, { leading = false } = {}) {
  let timer = null;
  let pendingArgs = null;

  function flush() {
    timer = null;
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      fn.apply(this, args);
    }
  }

  function debounced(...args) {
    const callNow = leading && timer === null;
    pendingArgs = callNow ? null : args;
    clearTimeout(timer);
    timer = setTimeout(flush.bind(this), wait);
    if (callNow) {
      fn.apply(this, args);
    }
  }

  debounced.cancel = function cancel() {
    clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };

  debounced.flush = function flushNow() {
    if (timer !== null) {
      clearTimeout(timer);
      flush.call(this);
    }
  };

  return debounced;
}

module.exports = { debounce };
