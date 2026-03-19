// Polyfills for Jest + jsdom environment (Node 20)
// MSW v1 uses node-fetch which needs these in some environments.
// This file runs before test framework setup (via jest "setupFiles").

/* eslint-disable @typescript-eslint/no-var-requires */
const { TextEncoder, TextDecoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}
