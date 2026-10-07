// Worker: downloads the model (cached), builds an onnxruntime-web session, runs AISplit.
var post = function (m, tr) { self.postMessage(m, tr || []); };
async function fetchBytes(url, onBytes) {
  var cache = null, res = null;
  try { cache = await caches.open('remaster-lab-model-v2'); res = await cache.match(url); } catch (e) { cache = null; }
  var fromCache = !!res;
  if (!res) { res = await fetch(url); if (!res.ok) throw new Error('Could not download ' + url.split('/').pop() + ' (' + res.status + ')'); }
  var total = +res.headers.get('content-length') || 0, reader = res.clone().body.getReader(), chunks = [], got = 0;
  for (;;) { var r = await reader.read(); if (r.done) break; chunks.push(r.value); got += r.value.length; onBytes && onBytes(r.value.length); }
  if (cache && !fromCache) { try { await cache.put(url, res); } catch (e) {} }
  var out = new Uint8Array(got), o = 0; chunks.forEach(function (c) { out.set(c, o); o += c.length; }); return out;
}
function b64decode(bytes) { // base64 text bytes -> binary
  var str = new TextDecoder().decode(bytes).replace(/\s+/g, '');
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(str);
  var bin = atob(str), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}
var ENC = 'none';
async function fetchParts(urls, onBytes) {
  var parts = []; for (var i = 0; i < urls.length; i++) { var b = await fetchBytes(urls[i], onBytes); parts.push(ENC === 'base64' ? b64decode(b) : b); }
  var n = parts.reduce(function (a, p) { return a + p.length; }, 0), out = new Uint8Array(n), o = 0;
  parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out;
}
self.onmessage = async function (e) {
  var d = e.data;
  if (d.type !== 'run') return;
  try {
    var m = d.manifest, base = d.base, got = 0; ENC = m.encoding || 'none';
    var asList = function (x) { return Array.isArray(x) ? x : [x]; };
    function onBytes(n) { got += n; post({ stage: 'download', p: Math.min(1, got / m.totalBytes) }); }
    post({ stage: 'download', p: 0 });
    importScripts(d.ortUrl);
    ort.env.wasm.wasmPaths = d.ortBase;
    ort.env.wasm.numThreads = d.threads;
    var wasm = await fetchParts(asList(m.wasm).map(function (f) { return base + f; }), onBytes);
    ort.env.wasm.wasmBinary = wasm.buffer;
    var graph = await fetchParts(asList(m.graph).map(function (f) { return base + f; }), onBytes);
    var w16 = await fetchParts(asList(m.weights).map(function (f) { return base + f; }), onBytes);
    post({ stage: 'prepare' });
    var w32 = AISplit.f16to32(new Uint16Array(w16.buffer, 0, w16.length / 2)); w16 = null;
    var opts = function (ep) { return { executionProviders: [ep], graphOptimizationLevel: 'all', externalData: [{ path: m.externalDataName, data: new Uint8Array(w32.buffer) }] }; };
    var session = null, ep = 'wasm';
    if (d.gpu && self.navigator && self.navigator.gpu) {
      try { session = await ort.InferenceSession.create(graph, opts('webgpu')); ep = 'webgpu'; } catch (err) { session = null; post({ stage: 'note', text: 'WebGPU not usable here (' + (err && err.message || err) + '); using CPU.' }); }
    }
    if (!session) session = await ort.InferenceSession.create(graph, opts('wasm'));
    w32 = null;
    post({ stage: 'ready', ep: ep });
    var res = await AISplit.separate(ort, session, d.L, d.R, function (p, eta) { post({ stage: 'split', p: p, eta: eta, ep: ep }); }, null, ['drums', 'bass', 'vocals']);
    post({ stage: 'done', ep: ep, stems: res }, [res.drums[0].buffer, res.drums[1].buffer, res.bass[0].buffer, res.bass[1].buffer, res.vocals[0].buffer, res.vocals[1].buffer]);
  } catch (err) { post({ stage: 'error', message: String(err && err.message || err) }); }
};
