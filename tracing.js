// Lightweight tracing utility for Universal Article to Gmail Extension
// Provides span and event APIs with buffered logs and background forwarding.
(function(){
  if (window.UAS_TRACE) return; // Avoid re-init
  const buffer = [];
  let spanId = 0;

  function now(){ return performance.now(); }

  function startSpan(name, attrs){
    const span = { id: ++spanId, type: 'span', name, start: now(), end: null, attrs: attrs || {}, events: [] };
    buffer.push(span);
    debugLog({ action: 'startSpan', name, id: span.id });
    return span;
  }

  function addEventToSpan(span, name, attrs){
    const ev = { t: now(), name, attrs: attrs || {} };
    span.events.push(ev);
    buffer.push({ type: 'event', spanId: span.id, name, t: ev.t, attrs: ev.attrs });
    debugLog({ action: 'event', spanId: span.id, name });
    forward({ kind: 'event', spanId: span.id, name, t: ev.t, attrs: ev.attrs });
  }

  function endSpan(span, attrs){
    if (span.end !== null) return; // already ended
    span.end = now();
    if (attrs) Object.assign(span.attrs, attrs);
    debugLog({ action: 'endSpan', name: span.name, id: span.id, durationMs: span.end - span.start });
    forward({ kind: 'span', id: span.id, name: span.name, start: span.start, end: span.end, durationMs: span.end - span.start, attrs: span.attrs, events: span.events });
  }

  function event(name, attrs){
    const e = { type: 'event', name, t: now(), attrs: attrs || {} };
    buffer.push(e);
    debugLog({ action: 'event', name });
    forward({ kind: 'event', name, t: e.t, attrs: e.attrs });
  }

  function forward(payload){
    try {
      chrome.runtime && chrome.runtime.sendMessage && chrome.runtime.sendMessage({ type: 'UAS_TRACE', payload });
    } catch (_) {}
  }

  function debugLog(obj){
    if (console && console.debug) console.debug('UAS TRACE:', obj);
  }

  function getBuffer(){ return buffer.slice(); }

  window.UAS_TRACE = { startSpan, endSpan, event, addEventToSpan, getBuffer };
  window.UAS_TRACE_DUMP = function(){
    const rows = buffer.map(b => {
      if (b.type === 'span') return { kind: 'span', id: b.id, name: b.name, durationMs: b.end ? (b.end - b.start).toFixed(1) : '', events: b.events.length };
      return { kind: 'event', name: b.name, spanId: b.spanId || '', t: b.t };
    });
    console.table(rows);
    return rows;
  };
})();
