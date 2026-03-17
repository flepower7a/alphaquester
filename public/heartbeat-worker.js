// Web Worker for heartbeat polling - runs even when tab is in background
let timers = {};

self.onmessage = function(e) {
  const { action, id, interval } = e.data;
  
  if (action === 'start') {
    // Clear existing timer for this id
    if (timers[id]) clearInterval(timers[id]);
    
    // Send immediate first tick
    self.postMessage({ type: 'tick', id });
    
    // Start interval
    timers[id] = setInterval(() => {
      self.postMessage({ type: 'tick', id });
    }, interval);
  }
  
  if (action === 'stop') {
    if (timers[id]) {
      clearInterval(timers[id]);
      delete timers[id];
    }
  }
  
  if (action === 'stopAll') {
    Object.keys(timers).forEach(key => {
      clearInterval(timers[key]);
    });
    timers = {};
  }
};
