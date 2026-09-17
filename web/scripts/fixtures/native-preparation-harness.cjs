'use strict';
// Deterministic browser/transport failure injection. Real native execution has a separate Electron gate.
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  crypto = require('node:crypto');
const { MessageChannel } = require('node:worker_threads');
const compiler = require('../../tm-start-compiler.js'),
  documentAPI = require('../../tm-start-preparation-document.js');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const scenario = () => ({ id: 'source', characters: [{ id: 'player', name: '合成测试' }], factions: [] });
function fixture() {
  const index = '<html><head></head><body></body></html>',
    text = '// pinned native fixture';
  const row = { file: 'core.js', request: 'core.js?v=1', byteLength: Buffer.byteLength(text), sha256: sha(text) };
  const manifest = {
    schemaVersion: 'tm-native-runtime-manifest/1',
    indexHash: sha(index),
    template: index,
    scripts: [row],
    styles: [],
    totalResourceBytes: row.byteLength,
  };
  manifest.runtimeHash = sha(JSON.stringify(manifest));
  return {
    manifest,
    files: new Map([
      ['index.html', index],
      ['core.js', text],
      ['tm-start-runtime-manifest.json', JSON.stringify(manifest)],
    ]),
  };
}
function harness(options = {}) {
  const f = fixture(),
    listeners = new Set(),
    ports = [],
    state = { calls: [], frames: [], resources: f, config: null, initCount: 0, closed: false };
  const doc = {
    currentScript: { src: 'https://game.example/app/tm-start-preparation.js' },
    body: {
      appendChild(frame) {
        state.frames.push(frame);
        frame.isConnected = true;
        queueMicrotask(() => {
          if (!frame.isConnected) return;
          if (frame.onload) frame.onload();
          const event = {
            source: frame.contentWindow,
            origin: 'null',
            data: { type: 'tm-start-ready', ...state.config },
          };
          if (options.ready) options.ready({ event, frame, listeners, state });
          else listeners.forEach((fn) => fn(event));
        });
      },
    },
    createElement(type) {
      if (type !== 'iframe') throw Error('unexpected element');
      const frame = {
        dataset: {},
        style: {},
        isConnected: false,
        attrs: {},
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        remove() {
          this.isConnected = false;
          state.frames = state.frames.filter((r) => r !== this);
        },
        contentWindow: {
          postMessage(data, targetOrigin, transfers) {
            if (data.type !== 'tm-start-connect' || targetOrigin !== '*') throw Error('unexpected handshake');
            const port = transfers[0];
            ports.push(port);
            port.onmessage = (event) => {
              state.initCount++;
              const request = event.data;
              const reply = (changes) =>
                port.postMessage({
                  ...state.config,
                  type: 'prepared',
                  sourceHash: request.sourceHash,
                  hashAuthority: 'parent-webcrypto-readback',
                  bytes: new TextEncoder().encode(
                    JSON.stringify({
                      P: { ai: {} },
                      GM: { sid: 'source', playerCharacterId: 'player', running: true },
                    }),
                  ).buffer,
                  observation: { errors: [] },
                  ...changes,
                });
              if (options.initialize) options.initialize({ request, reply, port, state });
              else reply({});
            };
            port.start();
          },
        },
      };
      return frame;
    },
  };
  const context = {
    URL,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    AbortController,
    Map,
    Set,
    Promise,
    Object,
    Number,
    Error,
    crypto: crypto.webcrypto,
    MessageChannel,
    document: doc,
    setTimeout,
    clearTimeout,
    addEventListener(name, fn) {
      if (name === 'message') listeners.add(fn);
    },
    removeEventListener(name, fn) {
      if (name === 'message') listeners.delete(fn);
    },
    fetch: async (url, config) => {
      state.calls.push({ url, config });
      if (options.fetch) {
        const answer = options.fetch(url, config, state);
        if (answer !== undefined) return answer;
      }
      const value = f.files.get(new URL(url).pathname.split('/').pop());
      return new Response(value == null ? 'missing' : value, { status: value == null ? 404 : 200 });
    },
    TM: {
      StartCompiler: compiler,
      StartPreparationDocument: {
        ...documentAPI,
        create(m, texts, config) {
          state.config = config;
          return documentAPI.create(m, texts, config);
        },
      },
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../tm-start-preparation.js'), 'utf8'), context, {
    filename: 'tm-start-preparation.js',
  });
  return {
    api: context.TM.StartPreparation,
    state,
    listeners,
    context,
    dispose() {
      context.TM.StartPreparation.cancel();
      ports.forEach((p) => p.close());
    },
  };
}
module.exports = { fixture, harness, scenario, sha };
