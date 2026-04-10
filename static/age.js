var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n, title = "") {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix2 = title && `"${title}" `;
    throw new Error(`${prefix2}expected integer >= 0, got ${n}`);
  }
}
function abytes(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix2 = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix2 + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash must wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function rotl(word, shift) {
  return word << shift | word >>> 32 - shift >>> 0;
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
var swap32IfBE = isLE ? (u) => u : byteSwap32;
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function kdfInputToBytes(data, errorTitle = "") {
  if (typeof data === "string")
    return utf8ToBytes(data);
  return abytes(data, void 0, errorTitle);
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function checkOpts(defaults, opts2) {
  if (opts2 !== void 0 && {}.toString.call(opts2) !== "[object Object]")
    throw new Error("options must be object or undefined");
  const merged = Object.assign(defaults, opts2);
  return merged;
}
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts2) => hashCons(opts2).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts2) => hashCons(opts2);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes(bytesLength = 32) {
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var oidNist = (suffix) => ({
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/hmac.js
var _HMAC = class {
  oHash;
  iHash;
  blockLen;
  outputLen;
  finished = false;
  destroyed = false;
  constructor(hash, key) {
    ahash(hash);
    abytes(key, void 0, "key");
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    abytes(out, this.outputLen, "output");
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to ||= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac = (hash, key, message) => new _HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new _HMAC(hash, key);

// node_modules/@noble/hashes/hkdf.js
function extract(hash, ikm, salt) {
  ahash(hash);
  if (salt === void 0)
    salt = new Uint8Array(hash.outputLen);
  return hmac(hash, salt, ikm);
}
var HKDF_COUNTER = /* @__PURE__ */ Uint8Array.of(0);
var EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
function expand(hash, prk, info, length = 32) {
  ahash(hash);
  anumber(length, "length");
  const olen = hash.outputLen;
  if (length > 255 * olen)
    throw new Error("Length must be <= 255*HashLen");
  const blocks = Math.ceil(length / olen);
  if (info === void 0)
    info = EMPTY_BUFFER;
  else
    abytes(info, void 0, "info");
  const okm = new Uint8Array(blocks * olen);
  const HMAC = hmac.create(hash, prk);
  const HMACTmp = HMAC._cloneInto();
  const T = new Uint8Array(HMAC.outputLen);
  for (let counter = 0; counter < blocks; counter++) {
    HKDF_COUNTER[0] = counter + 1;
    HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T).update(info).update(HKDF_COUNTER).digestInto(T);
    okm.set(T, olen * counter);
    HMAC._cloneInto(HMACTmp);
  }
  HMAC.destroy();
  HMACTmp.destroy();
  clean(T, HKDF_COUNTER);
  return okm.slice(0, length);
}
var hkdf = (hash, ikm, salt, info, length) => expand(hash, extract(hash, ikm, salt), info, length);

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE3) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE3;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE3 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE3);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE3);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA384_IV = /* @__PURE__ */ Uint32Array.from([
  3418070365,
  3238371032,
  1654270250,
  914150663,
  2438529370,
  812702999,
  355462360,
  4144912697,
  1731405415,
  4290775857,
  2394180231,
  1750603025,
  3675008525,
  1694076839,
  1203062813,
  3204075428
]);

// node_modules/@noble/hashes/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var shrSH = (h, _l, s) => h >>> s;
var shrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F: F2, G, H } = this;
    return [A, B, C, D, E, F2, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F2, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F2 | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F: F2, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F2, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F2;
      F2 = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F2 = F2 + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F2, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor() {
    super(32);
  }
};
var K512 = /* @__PURE__ */ (() => split([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
var SHA2_64B = class extends HashMD {
  constructor(outputLen) {
    super(128, outputLen, 16, false);
  }
  // prettier-ignore
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  // prettier-ignore
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32(offset += 4);
    }
    for (let i = 16; i < 80; i++) {
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
      const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
      const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
      const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0; i < 80; i++) {
      const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
      const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
      const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L(T1l, sigma0l, MAJl);
      Ah = add3H(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean(SHA512_W_H, SHA512_W_L);
  }
  destroy() {
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
};
var _SHA384 = class extends SHA2_64B {
  Ah = SHA384_IV[0] | 0;
  Al = SHA384_IV[1] | 0;
  Bh = SHA384_IV[2] | 0;
  Bl = SHA384_IV[3] | 0;
  Ch = SHA384_IV[4] | 0;
  Cl = SHA384_IV[5] | 0;
  Dh = SHA384_IV[6] | 0;
  Dl = SHA384_IV[7] | 0;
  Eh = SHA384_IV[8] | 0;
  El = SHA384_IV[9] | 0;
  Fh = SHA384_IV[10] | 0;
  Fl = SHA384_IV[11] | 0;
  Gh = SHA384_IV[12] | 0;
  Gl = SHA384_IV[13] | 0;
  Hh = SHA384_IV[14] | 0;
  Hl = SHA384_IV[15] | 0;
  constructor() {
    super(48);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);
var sha384 = /* @__PURE__ */ createHasher(
  () => new _SHA384(),
  /* @__PURE__ */ oidNist(2)
);

// node_modules/@scure/base/index.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes2(b) {
  if (!isBytes2(b))
    throw new Error("Uint8Array expected");
}
function isArrayOf(isString, arr) {
  if (!Array.isArray(arr))
    return false;
  if (arr.length === 0)
    return true;
  if (isString) {
    return arr.every((item) => typeof item === "string");
  } else {
    return arr.every((item) => Number.isSafeInteger(item));
  }
}
function afn(input) {
  if (typeof input !== "function")
    throw new Error("function expected");
  return true;
}
function astr(label2, input) {
  if (typeof input !== "string")
    throw new Error(`${label2}: string expected`);
  return true;
}
function anumber2(n) {
  if (!Number.isSafeInteger(n))
    throw new Error(`invalid integer: ${n}`);
}
function aArr(input) {
  if (!Array.isArray(input))
    throw new Error("array expected");
}
function astrArr(label2, input) {
  if (!isArrayOf(true, input))
    throw new Error(`${label2}: array of strings expected`);
}
function anumArr(label2, input) {
  if (!isArrayOf(false, input))
    throw new Error(`${label2}: array of numbers expected`);
}
// @__NO_SIDE_EFFECTS__
function chain(...args) {
  const id = (a) => a;
  const wrap = (a, b) => (c) => a(b(c));
  const encode2 = args.map((x) => x.encode).reduceRight(wrap, id);
  const decode2 = args.map((x) => x.decode).reduce(wrap, id);
  return { encode: encode2, decode: decode2 };
}
// @__NO_SIDE_EFFECTS__
function alphabet(letters) {
  const lettersA = typeof letters === "string" ? letters.split("") : letters;
  const len = lettersA.length;
  astrArr("alphabet", lettersA);
  const indexes = new Map(lettersA.map((l, i) => [l, i]));
  return {
    encode: (digits) => {
      aArr(digits);
      return digits.map((i) => {
        if (!Number.isSafeInteger(i) || i < 0 || i >= len)
          throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${letters}`);
        return lettersA[i];
      });
    },
    decode: (input) => {
      aArr(input);
      return input.map((letter) => {
        astr("alphabet.decode", letter);
        const i = indexes.get(letter);
        if (i === void 0)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${letters}`);
        return i;
      });
    }
  };
}
// @__NO_SIDE_EFFECTS__
function join(separator = "") {
  astr("join", separator);
  return {
    encode: (from) => {
      astrArr("join.decode", from);
      return from.join(separator);
    },
    decode: (to) => {
      astr("join.decode", to);
      return to.split(separator);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function padding(bits, chr = "=") {
  anumber2(bits);
  astr("padding", chr);
  return {
    encode(data) {
      astrArr("padding.encode", data);
      while (data.length * bits % 8)
        data.push(chr);
      return data;
    },
    decode(input) {
      astrArr("padding.decode", input);
      let end = input.length;
      if (end * bits % 8)
        throw new Error("padding: invalid, string should have whole number of bytes");
      for (; end > 0 && input[end - 1] === chr; end--) {
        const last = end - 1;
        const byte = last * bits;
        if (byte % 8 === 0)
          throw new Error("padding: invalid, string has too much padding");
      }
      return input.slice(0, end);
    }
  };
}
var gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
var radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from, to) => from + (to - gcd(from, to));
var powers = /* @__PURE__ */ (() => {
  let res = [];
  for (let i = 0; i < 40; i++)
    res.push(2 ** i);
  return res;
})();
function convertRadix2(data, from, to, padding2) {
  aArr(data);
  if (from <= 0 || from > 32)
    throw new Error(`convertRadix2: wrong from=${from}`);
  if (to <= 0 || to > 32)
    throw new Error(`convertRadix2: wrong to=${to}`);
  if (/* @__PURE__ */ radix2carry(from, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${/* @__PURE__ */ radix2carry(from, to)}`);
  }
  let carry = 0;
  let pos = 0;
  const max = powers[from];
  const mask = powers[to] - 1;
  const res = [];
  for (const n of data) {
    anumber2(n);
    if (n >= max)
      throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
    carry = carry << from | n;
    if (pos + from > 32)
      throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
    pos += from;
    for (; pos >= to; pos -= to)
      res.push((carry >> pos - to & mask) >>> 0);
    const pow = powers[pos];
    if (pow === void 0)
      throw new Error("invalid carry");
    carry &= pow - 1;
  }
  carry = carry << to - pos & mask;
  if (!padding2 && pos >= from)
    throw new Error("Excess padding");
  if (!padding2 && carry > 0)
    throw new Error(`Non-zero padding: ${carry}`);
  if (padding2 && pos > 0)
    res.push(carry >>> 0);
  return res;
}
// @__NO_SIDE_EFFECTS__
function radix2(bits, revPadding = false) {
  anumber2(bits);
  if (bits <= 0 || bits > 32)
    throw new Error("radix2: bits should be in (0..32]");
  if (/* @__PURE__ */ radix2carry(8, bits) > 32 || /* @__PURE__ */ radix2carry(bits, 8) > 32)
    throw new Error("radix2: carry overflow");
  return {
    encode: (bytes) => {
      if (!isBytes2(bytes))
        throw new Error("radix2.encode input should be Uint8Array");
      return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
    },
    decode: (digits) => {
      anumArr("radix2.decode", digits);
      return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
    }
  };
}
function unsafeWrapper(fn) {
  afn(fn);
  return function(...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {
    }
  };
}
var hasBase64Builtin = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toBase64 === "function" && typeof Uint8Array.fromBase64 === "function")();
var decodeBase64Builtin = (s, isUrl) => {
  astr("base64", s);
  const re = isUrl ? /^[A-Za-z0-9=_-]+$/ : /^[A-Za-z0-9=+/]+$/;
  const alphabet2 = isUrl ? "base64url" : "base64";
  if (s.length > 0 && !re.test(s))
    throw new Error("invalid base64");
  return Uint8Array.fromBase64(s, { alphabet: alphabet2, lastChunkHandling: "strict" });
};
var base64 = hasBase64Builtin ? {
  encode(b) {
    abytes2(b);
    return b.toBase64();
  },
  decode(s) {
    return decodeBase64Builtin(s, false);
  }
} : /* @__PURE__ */ chain(/* @__PURE__ */ radix2(6), /* @__PURE__ */ alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"), /* @__PURE__ */ padding(6), /* @__PURE__ */ join(""));
var base64nopad = /* @__PURE__ */ chain(/* @__PURE__ */ radix2(6), /* @__PURE__ */ alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"), /* @__PURE__ */ join(""));
var BECH_ALPHABET = /* @__PURE__ */ chain(/* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), /* @__PURE__ */ join(""));
var POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
function bech32Polymod(pre) {
  const b = pre >> 25;
  let chk = (pre & 33554431) << 5;
  for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
    if ((b >> i & 1) === 1)
      chk ^= POLYMOD_GENERATORS[i];
  }
  return chk;
}
function bechChecksum(prefix2, words, encodingConst = 1) {
  const len = prefix2.length;
  let chk = 1;
  for (let i = 0; i < len; i++) {
    const c = prefix2.charCodeAt(i);
    if (c < 33 || c > 126)
      throw new Error(`Invalid prefix (${prefix2})`);
    chk = bech32Polymod(chk) ^ c >> 5;
  }
  chk = bech32Polymod(chk);
  for (let i = 0; i < len; i++)
    chk = bech32Polymod(chk) ^ prefix2.charCodeAt(i) & 31;
  for (let v of words)
    chk = bech32Polymod(chk) ^ v;
  for (let i = 0; i < 6; i++)
    chk = bech32Polymod(chk);
  chk ^= encodingConst;
  return BECH_ALPHABET.encode(convertRadix2([chk % powers[30]], 30, 5, false));
}
// @__NO_SIDE_EFFECTS__
function genBech32(encoding) {
  const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
  const _words = /* @__PURE__ */ radix2(5);
  const fromWords = _words.decode;
  const toWords = _words.encode;
  const fromWordsUnsafe = unsafeWrapper(fromWords);
  function encode2(prefix2, words, limit = 90) {
    astr("bech32.encode prefix", prefix2);
    if (isBytes2(words))
      words = Array.from(words);
    anumArr("bech32.encode", words);
    const plen = prefix2.length;
    if (plen === 0)
      throw new TypeError(`Invalid prefix length ${plen}`);
    const actualLength = plen + 7 + words.length;
    if (limit !== false && actualLength > limit)
      throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    const lowered = prefix2.toLowerCase();
    const sum = bechChecksum(lowered, words, ENCODING_CONST);
    return `${lowered}1${BECH_ALPHABET.encode(words)}${sum}`;
  }
  function decode2(str, limit = 90) {
    astr("bech32.decode input", str);
    const slen = str.length;
    if (slen < 8 || limit !== false && slen > limit)
      throw new TypeError(`invalid string length: ${slen} (${str}). Expected (8..${limit})`);
    const lowered = str.toLowerCase();
    if (str !== lowered && str !== str.toUpperCase())
      throw new Error(`String must be lowercase or uppercase`);
    const sepIndex = lowered.lastIndexOf("1");
    if (sepIndex === 0 || sepIndex === -1)
      throw new Error(`Letter "1" must be present between prefix and data only`);
    const prefix2 = lowered.slice(0, sepIndex);
    const data = lowered.slice(sepIndex + 1);
    if (data.length < 6)
      throw new Error("Data must be at least 6 characters long");
    const words = BECH_ALPHABET.decode(data).slice(0, -6);
    const sum = bechChecksum(prefix2, words, ENCODING_CONST);
    if (!data.endsWith(sum))
      throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    return { prefix: prefix2, words };
  }
  const decodeUnsafe = unsafeWrapper(decode2);
  function decodeToBytes(str) {
    const { prefix: prefix2, words } = decode2(str, false);
    return { prefix: prefix2, words, bytes: fromWords(words) };
  }
  function encodeFromBytes(prefix2, bytes) {
    return encode2(prefix2, toWords(bytes));
  }
  return {
    encode: encode2,
    decode: decode2,
    encodeFromBytes,
    decodeToBytes,
    decodeUnsafe,
    fromWords,
    fromWordsUnsafe,
    toWords
  };
}
var bech32 = /* @__PURE__ */ genBech32("bech32");

// node_modules/@noble/hashes/pbkdf2.js
function pbkdf2Init(hash, _password, _salt, _opts) {
  ahash(hash);
  const opts2 = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
  const { c, dkLen, asyncTick } = opts2;
  anumber(c, "c");
  anumber(dkLen, "dkLen");
  anumber(asyncTick, "asyncTick");
  if (c < 1)
    throw new Error("iterations (c) must be >= 1");
  const password = kdfInputToBytes(_password, "password");
  const salt = kdfInputToBytes(_salt, "salt");
  const DK = new Uint8Array(dkLen);
  const PRF = hmac.create(hash, password);
  const PRFSalt = PRF._cloneInto().update(salt);
  return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
}
function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
  PRF.destroy();
  PRFSalt.destroy();
  if (prfW)
    prfW.destroy();
  clean(u);
  return DK;
}
function pbkdf2(hash, password, salt, opts2) {
  const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt, opts2);
  let prfW;
  const arr = new Uint8Array(4);
  const view = createView(arr);
  const u = new Uint8Array(PRF.outputLen);
  for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
    const Ti = DK.subarray(pos, pos + PRF.outputLen);
    view.setInt32(0, ti, false);
    (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
    Ti.set(u.subarray(0, Ti.length));
    for (let ui = 1; ui < c; ui++) {
      PRF._cloneInto(prfW).update(u).digestInto(u);
      for (let i = 0; i < Ti.length; i++)
        Ti[i] ^= u[i];
    }
  }
  return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
}

// node_modules/@noble/hashes/scrypt.js
function XorAndSalsa(prev, pi, input, ii, out, oi) {
  let y00 = prev[pi++] ^ input[ii++], y01 = prev[pi++] ^ input[ii++];
  let y02 = prev[pi++] ^ input[ii++], y03 = prev[pi++] ^ input[ii++];
  let y04 = prev[pi++] ^ input[ii++], y05 = prev[pi++] ^ input[ii++];
  let y06 = prev[pi++] ^ input[ii++], y07 = prev[pi++] ^ input[ii++];
  let y08 = prev[pi++] ^ input[ii++], y09 = prev[pi++] ^ input[ii++];
  let y10 = prev[pi++] ^ input[ii++], y11 = prev[pi++] ^ input[ii++];
  let y12 = prev[pi++] ^ input[ii++], y13 = prev[pi++] ^ input[ii++];
  let y14 = prev[pi++] ^ input[ii++], y15 = prev[pi++] ^ input[ii++];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let i = 0; i < 8; i += 2) {
    x04 ^= rotl(x00 + x12 | 0, 7);
    x08 ^= rotl(x04 + x00 | 0, 9);
    x12 ^= rotl(x08 + x04 | 0, 13);
    x00 ^= rotl(x12 + x08 | 0, 18);
    x09 ^= rotl(x05 + x01 | 0, 7);
    x13 ^= rotl(x09 + x05 | 0, 9);
    x01 ^= rotl(x13 + x09 | 0, 13);
    x05 ^= rotl(x01 + x13 | 0, 18);
    x14 ^= rotl(x10 + x06 | 0, 7);
    x02 ^= rotl(x14 + x10 | 0, 9);
    x06 ^= rotl(x02 + x14 | 0, 13);
    x10 ^= rotl(x06 + x02 | 0, 18);
    x03 ^= rotl(x15 + x11 | 0, 7);
    x07 ^= rotl(x03 + x15 | 0, 9);
    x11 ^= rotl(x07 + x03 | 0, 13);
    x15 ^= rotl(x11 + x07 | 0, 18);
    x01 ^= rotl(x00 + x03 | 0, 7);
    x02 ^= rotl(x01 + x00 | 0, 9);
    x03 ^= rotl(x02 + x01 | 0, 13);
    x00 ^= rotl(x03 + x02 | 0, 18);
    x06 ^= rotl(x05 + x04 | 0, 7);
    x07 ^= rotl(x06 + x05 | 0, 9);
    x04 ^= rotl(x07 + x06 | 0, 13);
    x05 ^= rotl(x04 + x07 | 0, 18);
    x11 ^= rotl(x10 + x09 | 0, 7);
    x08 ^= rotl(x11 + x10 | 0, 9);
    x09 ^= rotl(x08 + x11 | 0, 13);
    x10 ^= rotl(x09 + x08 | 0, 18);
    x12 ^= rotl(x15 + x14 | 0, 7);
    x13 ^= rotl(x12 + x15 | 0, 9);
    x14 ^= rotl(x13 + x12 | 0, 13);
    x15 ^= rotl(x14 + x13 | 0, 18);
  }
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function BlockMix(input, ii, out, oi, r) {
  let head = oi + 0;
  let tail = oi + 16 * r;
  for (let i = 0; i < 16; i++)
    out[tail + i] = input[ii + (2 * r - 1) * 16 + i];
  for (let i = 0; i < r; i++, head += 16, ii += 16) {
    XorAndSalsa(out, tail, input, ii, out, head);
    if (i > 0)
      tail += 16;
    XorAndSalsa(out, head, input, ii += 16, out, tail);
  }
}
function scryptInit(password, salt, _opts) {
  const opts2 = checkOpts({
    dkLen: 32,
    asyncTick: 10,
    maxmem: 1024 ** 3 + 1024
  }, _opts);
  const { N: N2, r, p, dkLen, asyncTick, maxmem, onProgress } = opts2;
  anumber(N2, "N");
  anumber(r, "r");
  anumber(p, "p");
  anumber(dkLen, "dkLen");
  anumber(asyncTick, "asyncTick");
  anumber(maxmem, "maxmem");
  if (onProgress !== void 0 && typeof onProgress !== "function")
    throw new Error("progressCb must be a function");
  const blockSize = 128 * r;
  const blockSize32 = blockSize / 4;
  const pow32 = Math.pow(2, 32);
  if (N2 <= 1 || (N2 & N2 - 1) !== 0 || N2 > pow32)
    throw new Error('"N" expected a power of 2, and 2^1 <= N <= 2^32');
  if (p < 1 || p > (pow32 - 1) * 32 / blockSize)
    throw new Error('"p" expected integer 1..((2^32 - 1) * 32) / (128 * r)');
  if (dkLen < 1 || dkLen > (pow32 - 1) * 32)
    throw new Error('"dkLen" expected integer 1..(2^32 - 1) * 32');
  const memUsed = blockSize * (N2 + p);
  if (memUsed > maxmem)
    throw new Error('"maxmem" limit was hit, expected 128*r*(N+p) <= "maxmem"=' + maxmem);
  const B = pbkdf2(sha256, password, salt, { c: 1, dkLen: blockSize * p });
  const B32 = u32(B);
  const V = u32(new Uint8Array(blockSize * N2));
  const tmp = u32(new Uint8Array(blockSize));
  let blockMixCb = () => {
  };
  if (onProgress) {
    const totalBlockMix = 2 * N2 * p;
    const callbackPer = Math.max(Math.floor(totalBlockMix / 1e4), 1);
    let blockMixCnt = 0;
    blockMixCb = () => {
      blockMixCnt++;
      if (onProgress && (!(blockMixCnt % callbackPer) || blockMixCnt === totalBlockMix))
        onProgress(blockMixCnt / totalBlockMix);
    };
  }
  return { N: N2, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb, asyncTick };
}
function scryptOutput(password, dkLen, B, V, tmp) {
  const res = pbkdf2(sha256, password, B, { c: 1, dkLen });
  clean(B, V, tmp);
  return res;
}
function scrypt(password, salt, opts2) {
  const { N: N2, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb } = scryptInit(password, salt, opts2);
  swap32IfBE(B32);
  for (let pi = 0; pi < p; pi++) {
    const Pi = blockSize32 * pi;
    for (let i = 0; i < blockSize32; i++)
      V[i] = B32[Pi + i];
    for (let i = 0, pos = 0; i < N2 - 1; i++) {
      BlockMix(V, pos, V, pos += blockSize32, r);
      blockMixCb();
    }
    BlockMix(V, (N2 - 1) * blockSize32, B32, Pi, r);
    blockMixCb();
    for (let i = 0; i < N2; i++) {
      const j = (B32[Pi + blockSize32 - 16] & N2 - 1) >>> 0;
      for (let k = 0; k < blockSize32; k++)
        tmp[k] = B32[Pi + k] ^ V[j * blockSize32 + k];
      BlockMix(tmp, 0, B32, Pi, r);
      blockMixCb();
    }
  }
  swap32IfBE(B32);
  return scryptOutput(password, dkLen, B, V, tmp);
}

// node_modules/@noble/ciphers/utils.js
function isBytes3(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abool(b) {
  if (typeof b !== "boolean")
    throw new Error(`boolean expected, not ${b}`);
}
function anumber3(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes3(value, length, title = "") {
  const bytes = isBytes3(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix2 = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix2 + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists2(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput2(out, instance) {
  abytes3(out, void 0, "output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u322(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean2(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView2(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
var isLE2 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function checkOpts2(defaults, opts2) {
  if (opts2 == null || typeof opts2 !== "object")
    throw new Error("options must be defined");
  const merged = Object.assign(defaults, opts2);
  return merged;
}
function equalBytes(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
var wrapCipher = /* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
  function wrappedCipher(key, ...args) {
    abytes3(key, void 0, "key");
    if (!isLE2)
      throw new Error("Non little-endian hardware is not yet supported");
    if (params.nonceLength !== void 0) {
      const nonce = args[0];
      abytes3(nonce, params.varSizeNonce ? void 0 : params.nonceLength, "nonce");
    }
    const tagl = params.tagLength;
    if (tagl && args[1] !== void 0)
      abytes3(args[1], void 0, "AAD");
    const cipher = constructor(key, ...args);
    const checkOutput = (fnLength, output) => {
      if (output !== void 0) {
        if (fnLength !== 2)
          throw new Error("cipher output not supported");
        abytes3(output, void 0, "output");
      }
    };
    let called = false;
    const wrCipher = {
      encrypt(data, output) {
        if (called)
          throw new Error("cannot encrypt() twice with same key + nonce");
        called = true;
        abytes3(data);
        checkOutput(cipher.encrypt.length, output);
        return cipher.encrypt(data, output);
      },
      decrypt(data, output) {
        abytes3(data);
        if (tagl && data.length < tagl)
          throw new Error('"ciphertext" expected length bigger than tagLength=' + tagl);
        checkOutput(cipher.decrypt.length, output);
        return cipher.decrypt(data, output);
      }
    };
    return wrCipher;
  }
  Object.assign(wrappedCipher, params);
  return wrappedCipher;
};
function getOutput(expectedLength, out, onlyAligned = true) {
  if (out === void 0)
    return new Uint8Array(expectedLength);
  if (out.length !== expectedLength)
    throw new Error('"output" expected Uint8Array of length ' + expectedLength + ", got: " + out.length);
  if (onlyAligned && !isAligned32(out))
    throw new Error("invalid output, must be aligned");
  return out;
}
function u64Lengths(dataLength, aadLength, isLE3) {
  abool(isLE3);
  const num = new Uint8Array(16);
  const view = createView2(num);
  view.setBigUint64(0, BigInt(aadLength), isLE3);
  view.setBigUint64(8, BigInt(dataLength), isLE3);
  return num;
}
function isAligned32(bytes) {
  return bytes.byteOffset % 4 === 0;
}
function copyBytes(bytes) {
  return Uint8Array.from(bytes);
}

// node_modules/@noble/ciphers/_arx.js
var encodeStr = (str) => Uint8Array.from(str.split(""), (c) => c.charCodeAt(0));
var sigma16 = encodeStr("expand 16-byte k");
var sigma32 = encodeStr("expand 32-byte k");
var sigma16_32 = u322(sigma16);
var sigma32_32 = u322(sigma32);
function rotl2(a, b) {
  return a << b | a >>> 32 - b;
}
function isAligned322(b) {
  return b.byteOffset % 4 === 0;
}
var BLOCK_LEN = 64;
var BLOCK_LEN32 = 16;
var MAX_COUNTER = 2 ** 32 - 1;
var U32_EMPTY = Uint32Array.of();
function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
  const len = data.length;
  const block = new Uint8Array(BLOCK_LEN);
  const b32 = u322(block);
  const isAligned = isAligned322(data) && isAligned322(output);
  const d32 = isAligned ? u322(data) : U32_EMPTY;
  const o32 = isAligned ? u322(output) : U32_EMPTY;
  for (let pos = 0; pos < len; counter++) {
    core(sigma, key, nonce, b32, counter, rounds);
    if (counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const take = Math.min(BLOCK_LEN, len - pos);
    if (isAligned && take === BLOCK_LEN) {
      const pos32 = pos / 4;
      if (pos % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let j = 0, posj; j < BLOCK_LEN32; j++) {
        posj = pos32 + j;
        o32[posj] = d32[posj] ^ b32[j];
      }
      pos += BLOCK_LEN;
      continue;
    }
    for (let j = 0, posj; j < take; j++) {
      posj = pos + j;
      output[posj] = data[posj] ^ block[j];
    }
    pos += take;
  }
}
function createCipher(core, opts2) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts2({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts2);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  anumber3(counterLength);
  anumber3(rounds);
  abool(counterRight);
  abool(allowShortKeys);
  return (key, nonce, data, output, counter = 0) => {
    abytes3(key, void 0, "key");
    abytes3(nonce, void 0, "nonce");
    abytes3(data, void 0, "data");
    const len = data.length;
    if (output === void 0)
      output = new Uint8Array(len);
    abytes3(output, void 0, "output");
    anumber3(counter);
    if (counter < 0 || counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    if (output.length < len)
      throw new Error(`arx: output (${output.length}) is shorter than data (${len})`);
    const toClean = [];
    let l = key.length;
    let k;
    let sigma;
    if (l === 32) {
      toClean.push(k = copyBytes(key));
      sigma = sigma32_32;
    } else if (l === 16 && allowShortKeys) {
      k = new Uint8Array(32);
      k.set(key);
      k.set(key, 16);
      sigma = sigma16_32;
      toClean.push(k);
    } else {
      abytes3(key, 32, "arx key");
      throw new Error("invalid key size");
    }
    if (!isAligned322(nonce))
      toClean.push(nonce = copyBytes(nonce));
    const k32 = u322(k);
    if (extendNonceFn) {
      if (nonce.length !== 24)
        throw new Error(`arx: extended nonce must be 24 bytes`);
      extendNonceFn(sigma, k32, u322(nonce.subarray(0, 16)), k32);
      nonce = nonce.subarray(16);
    }
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length)
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    if (nonceNcLen !== 12) {
      const nc = new Uint8Array(12);
      nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc;
      toClean.push(nonce);
    }
    const n32 = u322(nonce);
    runCipher(core, sigma, k32, n32, data, output, counter, rounds);
    clean2(...toClean);
    return output;
  };
}

// node_modules/@noble/ciphers/_poly1305.js
function u8to16(a, i) {
  return a[i++] & 255 | (a[i++] & 255) << 8;
}
var Poly1305 = class {
  blockLen = 16;
  outputLen = 16;
  buffer = new Uint8Array(16);
  r = new Uint16Array(10);
  // Allocating 1 array with .subarray() here is slower than 3
  h = new Uint16Array(10);
  pad = new Uint16Array(8);
  pos = 0;
  finished = false;
  // Can be speed-up using BigUint64Array, at the cost of complexity
  constructor(key) {
    key = copyBytes(abytes3(key, 32, "key"));
    const t0 = u8to16(key, 0);
    const t1 = u8to16(key, 2);
    const t2 = u8to16(key, 4);
    const t3 = u8to16(key, 6);
    const t4 = u8to16(key, 8);
    const t5 = u8to16(key, 10);
    const t6 = u8to16(key, 12);
    const t7 = u8to16(key, 14);
    this.r[0] = t0 & 8191;
    this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
    this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
    this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
    this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
    this.r[5] = t4 >>> 1 & 8190;
    this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
    this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
    this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
    this.r[9] = t7 >>> 5 & 127;
    for (let i = 0; i < 8; i++)
      this.pad[i] = u8to16(key, 16 + 2 * i);
  }
  process(data, offset, isLast = false) {
    const hibit = isLast ? 0 : 1 << 11;
    const { h, r } = this;
    const r0 = r[0];
    const r1 = r[1];
    const r2 = r[2];
    const r3 = r[3];
    const r4 = r[4];
    const r5 = r[5];
    const r6 = r[6];
    const r7 = r[7];
    const r8 = r[8];
    const r9 = r[9];
    const t0 = u8to16(data, offset + 0);
    const t1 = u8to16(data, offset + 2);
    const t2 = u8to16(data, offset + 4);
    const t3 = u8to16(data, offset + 6);
    const t4 = u8to16(data, offset + 8);
    const t5 = u8to16(data, offset + 10);
    const t6 = u8to16(data, offset + 12);
    const t7 = u8to16(data, offset + 14);
    let h0 = h[0] + (t0 & 8191);
    let h1 = h[1] + ((t0 >>> 13 | t1 << 3) & 8191);
    let h2 = h[2] + ((t1 >>> 10 | t2 << 6) & 8191);
    let h3 = h[3] + ((t2 >>> 7 | t3 << 9) & 8191);
    let h4 = h[4] + ((t3 >>> 4 | t4 << 12) & 8191);
    let h5 = h[5] + (t4 >>> 1 & 8191);
    let h6 = h[6] + ((t4 >>> 14 | t5 << 2) & 8191);
    let h7 = h[7] + ((t5 >>> 11 | t6 << 5) & 8191);
    let h8 = h[8] + ((t6 >>> 8 | t7 << 8) & 8191);
    let h9 = h[9] + (t7 >>> 5 | hibit);
    let c = 0;
    let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
    c = d0 >>> 13;
    d0 &= 8191;
    d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
    c += d0 >>> 13;
    d0 &= 8191;
    let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
    c = d1 >>> 13;
    d1 &= 8191;
    d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
    c += d1 >>> 13;
    d1 &= 8191;
    let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
    c = d2 >>> 13;
    d2 &= 8191;
    d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
    c += d2 >>> 13;
    d2 &= 8191;
    let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
    c = d3 >>> 13;
    d3 &= 8191;
    d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
    c += d3 >>> 13;
    d3 &= 8191;
    let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
    c = d4 >>> 13;
    d4 &= 8191;
    d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
    c += d4 >>> 13;
    d4 &= 8191;
    let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
    c = d5 >>> 13;
    d5 &= 8191;
    d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
    c += d5 >>> 13;
    d5 &= 8191;
    let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
    c = d6 >>> 13;
    d6 &= 8191;
    d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
    c += d6 >>> 13;
    d6 &= 8191;
    let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
    c = d7 >>> 13;
    d7 &= 8191;
    d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
    c += d7 >>> 13;
    d7 &= 8191;
    let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
    c = d8 >>> 13;
    d8 &= 8191;
    d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
    c += d8 >>> 13;
    d8 &= 8191;
    let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
    c = d9 >>> 13;
    d9 &= 8191;
    d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
    c += d9 >>> 13;
    d9 &= 8191;
    c = (c << 2) + c | 0;
    c = c + d0 | 0;
    d0 = c & 8191;
    c = c >>> 13;
    d1 += c;
    h[0] = d0;
    h[1] = d1;
    h[2] = d2;
    h[3] = d3;
    h[4] = d4;
    h[5] = d5;
    h[6] = d6;
    h[7] = d7;
    h[8] = d8;
    h[9] = d9;
  }
  finalize() {
    const { h, pad } = this;
    const g = new Uint16Array(10);
    let c = h[1] >>> 13;
    h[1] &= 8191;
    for (let i = 2; i < 10; i++) {
      h[i] += c;
      c = h[i] >>> 13;
      h[i] &= 8191;
    }
    h[0] += c * 5;
    c = h[0] >>> 13;
    h[0] &= 8191;
    h[1] += c;
    c = h[1] >>> 13;
    h[1] &= 8191;
    h[2] += c;
    g[0] = h[0] + 5;
    c = g[0] >>> 13;
    g[0] &= 8191;
    for (let i = 1; i < 10; i++) {
      g[i] = h[i] + c;
      c = g[i] >>> 13;
      g[i] &= 8191;
    }
    g[9] -= 1 << 13;
    let mask = (c ^ 1) - 1;
    for (let i = 0; i < 10; i++)
      g[i] &= mask;
    mask = ~mask;
    for (let i = 0; i < 10; i++)
      h[i] = h[i] & mask | g[i];
    h[0] = (h[0] | h[1] << 13) & 65535;
    h[1] = (h[1] >>> 3 | h[2] << 10) & 65535;
    h[2] = (h[2] >>> 6 | h[3] << 7) & 65535;
    h[3] = (h[3] >>> 9 | h[4] << 4) & 65535;
    h[4] = (h[4] >>> 12 | h[5] << 1 | h[6] << 14) & 65535;
    h[5] = (h[6] >>> 2 | h[7] << 11) & 65535;
    h[6] = (h[7] >>> 5 | h[8] << 8) & 65535;
    h[7] = (h[8] >>> 8 | h[9] << 5) & 65535;
    let f = h[0] + pad[0];
    h[0] = f & 65535;
    for (let i = 1; i < 8; i++) {
      f = (h[i] + pad[i] | 0) + (f >>> 16) | 0;
      h[i] = f & 65535;
    }
    clean2(g);
  }
  update(data) {
    aexists2(this);
    abytes3(data);
    data = copyBytes(data);
    const { buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(data, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(buffer, 0, false);
        this.pos = 0;
      }
    }
    return this;
  }
  destroy() {
    clean2(this.h, this.r, this.buffer, this.pad);
  }
  digestInto(out) {
    aexists2(this);
    aoutput2(out, this);
    this.finished = true;
    const { buffer, h } = this;
    let { pos } = this;
    if (pos) {
      buffer[pos++] = 1;
      for (; pos < 16; pos++)
        buffer[pos] = 0;
      this.process(buffer, 0, true);
    }
    this.finalize();
    let opos = 0;
    for (let i = 0; i < 8; i++) {
      out[opos++] = h[i] >>> 0;
      out[opos++] = h[i] >>> 8;
    }
    return out;
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
};
function wrapConstructorWithKey(hashCons) {
  const hashC = (msg, key) => hashCons(key).update(msg).digest();
  const tmp = hashCons(new Uint8Array(32));
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (key) => hashCons(key);
  return hashC;
}
var poly1305 = /* @__PURE__ */ (() => wrapConstructorWithKey((key) => new Poly1305(key)))();

// node_modules/@noble/ciphers/chacha.js
function chachaCore(s, k, n, out, cnt, rounds = 20) {
  let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let r = 0; r < rounds; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function hchacha(s, k, i, out) {
  let x00 = s[0], x01 = s[1], x02 = s[2], x03 = s[3], x04 = k[0], x05 = k[1], x06 = k[2], x07 = k[3], x08 = k[4], x09 = k[5], x10 = k[6], x11 = k[7], x12 = i[0], x13 = i[1], x14 = i[2], x15 = i[3];
  for (let r = 0; r < 20; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = x00;
  out[oi++] = x01;
  out[oi++] = x02;
  out[oi++] = x03;
  out[oi++] = x12;
  out[oi++] = x13;
  out[oi++] = x14;
  out[oi++] = x15;
}
var chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
  counterRight: false,
  counterLength: 4,
  allowShortKeys: false
});
var xchacha20 = /* @__PURE__ */ createCipher(chachaCore, {
  counterRight: false,
  counterLength: 8,
  extendNonceFn: hchacha,
  allowShortKeys: false
});
var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
var updatePadded = (h, msg) => {
  h.update(msg);
  const leftover = msg.length % 16;
  if (leftover)
    h.update(ZEROS16.subarray(leftover));
};
var ZEROS32 = /* @__PURE__ */ new Uint8Array(32);
function computeTag(fn, key, nonce, ciphertext, AAD) {
  if (AAD !== void 0)
    abytes3(AAD, void 0, "AAD");
  const authKey = fn(key, nonce, ZEROS32);
  const lengths = u64Lengths(ciphertext.length, AAD ? AAD.length : 0, true);
  const h = poly1305.create(authKey);
  if (AAD)
    updatePadded(h, AAD);
  updatePadded(h, ciphertext);
  h.update(lengths);
  const res = h.digest();
  clean2(authKey, lengths);
  return res;
}
var _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
  const tagLength = 16;
  return {
    encrypt(plaintext, output) {
      const plength = plaintext.length;
      output = getOutput(plength + tagLength, output, false);
      output.set(plaintext);
      const oPlain = output.subarray(0, -tagLength);
      xorStream(key, nonce, oPlain, oPlain, 1);
      const tag = computeTag(xorStream, key, nonce, oPlain, AAD);
      output.set(tag, plength);
      clean2(tag);
      return output;
    },
    decrypt(ciphertext, output) {
      output = getOutput(ciphertext.length - tagLength, output, false);
      const data = ciphertext.subarray(0, -tagLength);
      const passedTag = ciphertext.subarray(-tagLength);
      const tag = computeTag(xorStream, key, nonce, data, AAD);
      if (!equalBytes(passedTag, tag))
        throw new Error("invalid tag");
      output.set(ciphertext.subarray(0, -tagLength));
      xorStream(key, nonce, output, output, 1);
      clean2(tag);
      return output;
    }
  };
};
var chacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 12, tagLength: 16 }, _poly1305_aead(chacha20));
var xchacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 24, tagLength: 16 }, _poly1305_aead(xchacha20));

// node_modules/@noble/curves/utils.js
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
function abool2(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix2 = title && `"${title}" `;
    throw new Error(prefix2 + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new Error("positive bigint expected, got " + n);
  } else
    anumber(n);
  return n;
}
function numberToHexUnpadded(num) {
  const hex = abignumber(num).toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber2(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber2(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  return hexToNumber2(bytesToHex(copyBytes2(abytes(bytes)).reverse()));
}
function numberToBytesBE2(n, len) {
  anumber(len);
  n = abignumber(n);
  const res = hexToBytes(n.toString(16).padStart(len * 2, "0"));
  if (res.length !== len)
    throw new Error("number too large");
  return res;
}
function numberToBytesLE(n, len) {
  return numberToBytesBE2(n, len).reverse();
}
function copyBytes2(bytes) {
  return Uint8Array.from(bytes);
}
function asciiToBytes(ascii) {
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new Error(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
var isPosBig = (n) => typeof n === "bigint" && _0n <= n;
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  let len;
  for (len = 0; n > _0n; n >>= _1n, len += 1)
    ;
  return len;
}
var bitMask = (n) => (_1n << BigInt(n)) - _1n;
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  anumber(hashLen, "hashLen");
  anumber(qByteLen, "qByteLen");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = (len) => new Uint8Array(len);
  const NULL = Uint8Array.of();
  const byte0 = Uint8Array.of(0);
  const byte1 = Uint8Array.of(1);
  const _maxDrbgIters = 1e3;
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...msgs) => hmacFn(k, concatBytes(v, ...msgs));
  const reseed = (seed = NULL) => {
    k = h(byte0, seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(byte1, seed);
    v = h();
  };
  const gen = () => {
    if (i++ >= _maxDrbgIters)
      throw new Error("drbg: tried max amount of iterations");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function validateObject(object, fields = {}, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}

// node_modules/@noble/curves/abstract/modular.js
var _0n2 = /* @__PURE__ */ BigInt(0);
var _1n2 = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _16n = /* @__PURE__ */ BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n2)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, y = _1n2, u = _1n2, v = _0n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd2 = b;
  if (gcd2 !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n2) / _4n;
  const root = Fp.pow(n, p1div4);
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n) / _8n;
  const n2 = Fp.mul(n, _2n);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return (Fp, n) => {
    let tv1 = Fp.pow(n, c4);
    let tv2 = Fp.mul(tv1, c1);
    const tv3 = Fp.mul(tv1, c2);
    const tv4 = Fp.mul(tv1, c3);
    const e1 = Fp.eql(Fp.sqr(tv2), n);
    const e2 = Fp.eql(Fp.sqr(tv3), n);
    tv1 = Fp.cmov(tv1, tv2, e1);
    tv2 = Fp.cmov(tv4, tv3, e2);
    const e3 = Fp.eql(Fp.sqr(tv2), n);
    const root = Fp.cmov(tv1, tv2, e3);
    assertIsSquare(Fp, root, n);
    return root;
  };
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q2 = P - _1n2;
  let S = 0;
  while (Q2 % _2n === _0n2) {
    Q2 /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q2);
  const Q1div2 = (Q2 + _1n2) / _2n;
  return function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q2);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = Fp.pow(c, exponent);
      M = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts2 = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  validateObject(field, opts2);
  return field;
}
function FpPow(Fp, num, power) {
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return Fp.ONE;
  if (power === _1n2)
    return num;
  let p = Fp.ONE;
  let d = num;
  while (power > _0n2) {
    if (power & _1n2)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n2;
  }
  return p;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n2) / _2n;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
var _Field = class {
  ORDER;
  BITS;
  BYTES;
  isLE;
  ZERO = _0n2;
  ONE = _1n2;
  _lengths;
  _sqrt;
  // cached sqrt
  _mod;
  constructor(ORDER, opts2 = {}) {
    if (ORDER <= _0n2)
      throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
    let _nbitLength = void 0;
    this.isLE = false;
    if (opts2 != null && typeof opts2 === "object") {
      if (typeof opts2.BITS === "number")
        _nbitLength = opts2.BITS;
      if (typeof opts2.sqrt === "function")
        this.sqrt = opts2.sqrt;
      if (typeof opts2.isLE === "boolean")
        this.isLE = opts2.isLE;
      if (opts2.allowedLengths)
        this._lengths = opts2.allowedLengths?.slice();
      if (typeof opts2.modFromBytes === "boolean")
        this._mod = opts2.modFromBytes;
    }
    const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
    if (nByteLength > 2048)
      throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    this.ORDER = ORDER;
    this.BITS = nBitLength;
    this.BYTES = nByteLength;
    this._sqrt = void 0;
    Object.preventExtensions(this);
  }
  create(num) {
    return mod(num, this.ORDER);
  }
  isValid(num) {
    if (typeof num !== "bigint")
      throw new Error("invalid field element: expected bigint, got " + typeof num);
    return _0n2 <= num && num < this.ORDER;
  }
  is0(num) {
    return num === _0n2;
  }
  // is valid and invertible
  isValidNot0(num) {
    return !this.is0(num) && this.isValid(num);
  }
  isOdd(num) {
    return (num & _1n2) === _1n2;
  }
  neg(num) {
    return mod(-num, this.ORDER);
  }
  eql(lhs, rhs) {
    return lhs === rhs;
  }
  sqr(num) {
    return mod(num * num, this.ORDER);
  }
  add(lhs, rhs) {
    return mod(lhs + rhs, this.ORDER);
  }
  sub(lhs, rhs) {
    return mod(lhs - rhs, this.ORDER);
  }
  mul(lhs, rhs) {
    return mod(lhs * rhs, this.ORDER);
  }
  pow(num, power) {
    return FpPow(this, num, power);
  }
  div(lhs, rhs) {
    return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
  }
  // Same as above, but doesn't normalize
  sqrN(num) {
    return num * num;
  }
  addN(lhs, rhs) {
    return lhs + rhs;
  }
  subN(lhs, rhs) {
    return lhs - rhs;
  }
  mulN(lhs, rhs) {
    return lhs * rhs;
  }
  inv(num) {
    return invert(num, this.ORDER);
  }
  sqrt(num) {
    if (!this._sqrt)
      this._sqrt = FpSqrt(this.ORDER);
    return this._sqrt(this, num);
  }
  toBytes(num) {
    return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE2(num, this.BYTES);
  }
  fromBytes(bytes, skipValidation = false) {
    abytes(bytes);
    const { _lengths: allowedLengths, BYTES, isLE: isLE3, ORDER, _mod: modFromBytes } = this;
    if (allowedLengths) {
      if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
        throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
      }
      const padded = new Uint8Array(BYTES);
      padded.set(bytes, isLE3 ? 0 : padded.length - bytes.length);
      bytes = padded;
    }
    if (bytes.length !== BYTES)
      throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
    let scalar = isLE3 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    if (modFromBytes)
      scalar = mod(scalar, ORDER);
    if (!skipValidation) {
      if (!this.isValid(scalar))
        throw new Error("invalid field element: outside of range 0..ORDER");
    }
    return scalar;
  }
  // TODO: we don't need it here, move out to separate fn
  invertBatch(lst) {
    return FpInvertBatch(this, lst);
  }
  // We can't move this out because Fp6, Fp12 implement it
  // and it's unclear what to return in there.
  cmov(a, b, condition) {
    return condition ? b : a;
  }
};
function Field(ORDER, opts2 = {}) {
  return new _Field(ORDER, opts2);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE3 = false) {
  abytes(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE3 ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num, fieldOrder - _1n2) + _1n2;
  return isLE3 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE2(reduced, fieldLen);
}

// node_modules/@noble/curves/abstract/curve.js
var _0n3 = /* @__PURE__ */ BigInt(0);
var _1n3 = /* @__PURE__ */ BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window2, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n3;
  }
  const offsetStart = window2 * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window2 % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n3)
    throw new Error("invalid wNAF");
}
var wNAF = class {
  BASE;
  ZERO;
  Fn;
  bits;
  // Parametrized with a given Point class (not individual point)
  constructor(Point, bits) {
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.Fn = Point.Fn;
    this.bits = bits;
  }
  // non-const time multiplication ladder
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n3) {
      if (n & _1n3)
        p = p.add(d);
      d = d.double();
      n >>= _1n3;
    }
    return p;
  }
  /**
   * Creates a wNAF precomputation window. Used for caching.
   * Default window size is set by `utils.precompute()` and is equal to 8.
   * Number of precomputed points depends on the curve size:
   * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
   * - 𝑊 is the window size
   * - 𝑛 is the bitlength of the curve order.
   * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
   * @param point Point instance
   * @param W window size
   * @returns precomputed point tables flattened to a single array
   */
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window2 = 0; window2 < windows; window2++) {
      base = p;
      points.push(base);
      for (let i = 1; i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  /**
   * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
   * More compact implementation:
   * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
   * @returns real and fake (for const-time) points
   */
  wNAF(W, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W, this.bits);
    for (let window2 = 0; window2 < wo.windows; window2++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window2, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  /**
   * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
   * @param acc accumulator point to add result of multiplication
   * @returns point
   */
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window2 = 0; window2 < wo.windows; window2++) {
      if (n === _0n3)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window2, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  // We calculate precomputes for elliptic curve point multiplication
  // using windowed method. This specifies window size and
  // stores precomputed values. Usually only base point would be precomputed.
  createCache(P, W) {
    validateW(W, this.bits);
    pointWindowSizes.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
};
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n3 || k2 > _0n3) {
    if (k1 & _1n3)
      p1 = p1.add(acc);
    if (k2 & _1n3)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n3;
    k2 >>= _1n3;
  }
  return { p1, p2 };
}
function createField(order, field, isLE3) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE3 });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
function createKeygen(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}

// node_modules/@noble/curves/abstract/montgomery.js
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
var _2n2 = BigInt(2);
function validateOpts(curve) {
  validateObject(curve, {
    adjustScalarBytes: "function",
    powPminus2: "function"
  });
  return Object.freeze({ ...curve });
}
function montgomery(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { P, type, adjustScalarBytes: adjustScalarBytes2, powPminus2, randomBytes: rand } = CURVE;
  const is25519 = type === "x25519";
  if (!is25519 && type !== "x448")
    throw new Error("invalid type");
  const randomBytes_ = rand || randomBytes;
  const montgomeryBits = is25519 ? 255 : 448;
  const fieldLen = is25519 ? 32 : 56;
  const Gu = is25519 ? BigInt(9) : BigInt(5);
  const a24 = is25519 ? BigInt(121665) : BigInt(39081);
  const minScalar = is25519 ? _2n2 ** BigInt(254) : _2n2 ** BigInt(447);
  const maxAdded = is25519 ? BigInt(8) * _2n2 ** BigInt(251) - _1n4 : BigInt(4) * _2n2 ** BigInt(445) - _1n4;
  const maxScalar = minScalar + maxAdded + _1n4;
  const modP = (n) => mod(n, P);
  const GuBytes = encodeU(Gu);
  function encodeU(u) {
    return numberToBytesLE(modP(u), fieldLen);
  }
  function decodeU(u) {
    const _u = copyBytes2(abytes(u, fieldLen, "uCoordinate"));
    if (is25519)
      _u[31] &= 127;
    return modP(bytesToNumberLE(_u));
  }
  function decodeScalar(scalar) {
    return bytesToNumberLE(adjustScalarBytes2(copyBytes2(abytes(scalar, fieldLen, "scalar"))));
  }
  function scalarMult2(scalar, u) {
    const pu = montgomeryLadder(decodeU(u), decodeScalar(scalar));
    if (pu === _0n4)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  function scalarMultBase2(scalar) {
    return scalarMult2(scalar, GuBytes);
  }
  const getPublicKey = scalarMultBase2;
  const getSharedSecret = scalarMult2;
  function cswap(swap, x_2, x_3) {
    const dummy = modP(swap * (x_2 - x_3));
    x_2 = modP(x_2 - dummy);
    x_3 = modP(x_3 + dummy);
    return { x_2, x_3 };
  }
  function montgomeryLadder(u, scalar) {
    aInRange("u", u, _0n4, P);
    aInRange("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = _1n4;
    let z_2 = _0n4;
    let x_3 = u;
    let z_3 = _1n4;
    let swap = _0n4;
    for (let t = BigInt(montgomeryBits - 1); t >= _0n4; t--) {
      const k_t = k >> t & _1n4;
      swap ^= k_t;
      ({ x_2, x_3 } = cswap(swap, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
      swap = k_t;
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B = x_2 - z_2;
      const BB = modP(B * B);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D = x_3 - z_3;
      const DA = modP(D * A);
      const CB = modP(C * B);
      const dacb = DA + CB;
      const da_cb = DA - CB;
      x_3 = modP(dacb * dacb);
      z_3 = modP(x_1 * modP(da_cb * da_cb));
      x_2 = modP(AA * BB);
      z_2 = modP(E * (AA + modP(a24 * E)));
    }
    ({ x_2, x_3 } = cswap(swap, x_2, x_3));
    ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
    const z2 = powPminus2(z_2);
    return modP(x_2 * z2);
  }
  const lengths = {
    secretKey: fieldLen,
    publicKey: fieldLen,
    seed: fieldLen
  };
  const randomSecretKey = (seed = randomBytes_(fieldLen)) => {
    abytes(seed, lengths.seed, "seed");
    return seed;
  };
  const utils = { randomSecretKey };
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getSharedSecret,
    getPublicKey,
    scalarMult: scalarMult2,
    scalarMultBase: scalarMultBase2,
    utils,
    GuBytes: GuBytes.slice(),
    lengths
  });
}

// node_modules/@noble/curves/abstract/weierstrass.js
var divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n3) / den;
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n5;
  const k2neg = k2 < _0n5;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n5;
  if (k1 < _0n5 || k1 >= MAX_NUM || k2 < _0n5 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts2, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts2[optName] === void 0 ? def[optName] : opts2[optName];
  }
  abool2(optsn.lowS, "lowS");
  abool2(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
var DERErr = class extends Error {
  constructor(m = "") {
    super(m);
  }
};
var DER = {
  // asn.1 DER encoding utils
  Err: DERErr,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    // v - value, l - left bytes (unparsed)
    decode(tag, data) {
      const { Err: E } = DER;
      let pos = 0;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(num) {
      const { Err: E } = DER;
      if (num < _0n5)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(bytes) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = abytes(bytes, void 0, "signature");
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var _0n5 = BigInt(0);
var _1n5 = BigInt(1);
var _2n3 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    abool2(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes || pointToBytes;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp.eql(Z, Fp.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(Z);
    const x = Fp.mul(X, iz);
    const y = Fp.mul(Y, iz);
    const zz = Fp.mul(Z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  class Point {
    // base / generator point
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
    // zero / infinity / identity point
    static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
    // 0, 1, 0
    // math field
    static Fp = Fp;
    // scalar field
    static Fn = Fn;
    X;
    Y;
    Z;
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(abytes(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(hexToBytes(hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point, p));
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(Point, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n5 || p.is0())
        return Point.ZERO;
      if (sc === _1n5)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n5)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n5)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      abool2(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point.BASE.precompute(8);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
function ecdh(Point, ecdhOpts = {}) {
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn), { seed: getMinHashLength(Fn.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      const num = Fn.fromBytes(secretKey);
      return Fn.isValidNot0(num);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(abytes(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(Fn.fromBytes(secretKey)).toBytes(isCompressed);
  }
  function isProbPub(item) {
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (!isBytes(item))
      return void 0;
    if ("_lengths" in Fn && Fn._lengths || secretKey === publicKey)
      return void 0;
    const l = abytes(item, void 0, "key").length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = Fn.fromBytes(secretKeyA);
    const b = Point.fromBytes(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey
  };
  const keygen = createKeygen(randomSecretKey, getPublicKey);
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa(Point, hash, ecdsaOpts = {}) {
  ahash(hash);
  validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  ecdsaOpts = Object.assign({}, ecdsaOpts);
  const randomBytes4 = ecdsaOpts.randomBytes || randomBytes;
  const hmac2 = ecdsaOpts.hmac || ((key, msg) => hmac(hash, key, msg));
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: true,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : true,
    format: "compact",
    extraEntropy: false
  };
  const hasLargeCofactor = CURVE_ORDER * _2n3 < Fp.ORDER;
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n5;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function assertSmallCofactor() {
    if (hasLargeCofactor)
      throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return abytes(bytes, sizer);
  }
  class Signature {
    r;
    s;
    recovery;
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null) {
        assertSmallCofactor();
        if (![0, 1, 2, 3].includes(recovery))
          throw new Error("invalid recovery id");
        this.recovery = recovery;
      }
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts.format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(abytes(bytes));
        return new Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = lengths.signature / 2;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes(hex), format);
    }
    assertRecovery() {
      const { recovery } = this;
      if (recovery == null)
        throw new Error("invalid recovery id: must be present");
      return recovery;
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const { r, s } = this;
      const recovery = this.assertRecovery();
      const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("invalid recovery id: sig.r+curve.n != R.x");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes(pprefix((recovery & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h = bits2int_modN(abytes(messageHash, void 0, "msgHash"));
      const u1 = Fn.create(-h * ir);
      const u2 = Fn.create(s * ir);
      const Q2 = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q2.is0())
        throw new Error("invalid recovery: point at infinify");
      Q2.assertValidity();
      return Q2;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts.format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes(DER.hexFromSig(this));
      const { r, s } = this;
      const rb = Fn.toBytes(r);
      const sb = Fn.toBytes(s);
      if (format === "recovered") {
        assertSmallCofactor();
        return concatBytes(Uint8Array.of(this.assertRecovery()), rb, sb);
      }
      return concatBytes(rb, sb);
    }
    toHex(format) {
      return bytesToHex(this.toBytes(format));
    }
  }
  const bits2int = ecdsaOpts.bits2int || function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  };
  const bits2int_modN = ecdsaOpts.bits2int_modN || function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  };
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num) {
    aInRange("num < 2^" + fnBits, num, _0n5, ORDER_MASK);
    return Fn.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    abytes(message, void 0, "message");
    return prehash ? abytes(hash(message), void 0, "prehashed message") : message;
  }
  function prepSig(message, secretKey, opts2) {
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts2, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = Fn.fromBytes(secretKey);
    if (!Fn.isValidNot0(d))
      throw new Error("invalid private key");
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes4(lengths.secretKey) : extraEntropy;
      seedArgs.push(abytes(e, void 0, "extraEntropy"));
    }
    const seed = concatBytes(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const ik = Fn.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n5)
        return;
      const s = Fn.create(ik * Fn.create(m + r * d));
      if (s === _0n5)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n5);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, hasLargeCofactor ? void 0 : recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts2 = {}) {
    const { seed, k2sig } = prepSig(message, secretKey, opts2);
    const drbg = createHmacDrbg(hash.outputLen, Fn.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig.toBytes(opts2.format);
  }
  function verify(signature, message, publicKey, opts2 = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts2, defaultSigOpts);
    publicKey = abytes(publicKey, void 0, "publicKey");
    message = validateMsgAndHash(message, prehash);
    if (!isBytes(signature)) {
      const end = signature instanceof Signature ? ", use sig.toBytes()" : "";
      throw new Error("verify expects Uint8Array signature" + end);
    }
    validateSigLength(signature, format);
    try {
      const sig = Signature.fromBytes(signature, format);
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h * is);
      const u2 = Fn.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts2 = {}) {
    const { prehash } = validateSigOpts(opts2, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}

// node_modules/@noble/curves/ed25519.js
var _1n6 = BigInt(1);
var _2n4 = BigInt(2);
var _3n3 = /* @__PURE__ */ BigInt(3);
var _5n2 = BigInt(5);
var _8n2 = BigInt(8);
var ed25519_CURVE_p = BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
function ed25519_pow_2_252_3(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, _2n4, P) * b2 % P;
  const b5 = pow2(b4, _1n6, P) * x % P;
  const b10 = pow2(b5, _5n2, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n4, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
var x25519 = /* @__PURE__ */ (() => {
  const P = ed25519_CURVE_p;
  return montgomery({
    P,
    type: "x25519",
    powPminus2: (x) => {
      const { pow_p_5_8, b2 } = ed25519_pow_2_252_3(x);
      return mod(pow2(pow_p_5_8, _3n3, P) * b2, P);
    },
    adjustScalarBytes
  });
})();

// node_modules/@noble/curves/nist.js
var p256_CURVE = /* @__PURE__ */ (() => ({
  p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
  n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
  h: BigInt(1),
  a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
  b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
  Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
  Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
}))();
var p384_CURVE = /* @__PURE__ */ (() => ({
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff"),
  n: BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973"),
  h: BigInt(1),
  a: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffc"),
  b: BigInt("0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef"),
  Gx: BigInt("0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7"),
  Gy: BigInt("0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f")
}))();
var p256_Point = /* @__PURE__ */ weierstrass(p256_CURVE);
var p256 = /* @__PURE__ */ ecdsa(p256_Point, sha256);
var p384_Point = /* @__PURE__ */ weierstrass(p384_CURVE);
var p384 = /* @__PURE__ */ ecdsa(p384_Point, sha384);

// node_modules/@noble/hashes/sha3.js
var _0n6 = BigInt(0);
var _1n7 = BigInt(1);
var _2n5 = BigInt(2);
var _7n2 = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n7, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n6;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n7 ^ (R >> _7n2) * _0x71n) % _256n;
    if (R & _2n5)
      t ^= _1n7 << (_1n7 << BigInt(j)) - _1n7;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var Keccak = class _Keccak {
  state;
  pos = 0;
  posOut = 0;
  finished = false;
  state32;
  destroyed = false;
  blockLen;
  suffix;
  outputLen;
  enableXOF = false;
  rounds;
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    anumber(outputLen, "outputLen");
    if (!(0 < blockLen && blockLen < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { blockLen, state } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    aexists(this, false);
    abytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    anumber(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    aoutput(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    clean(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
var sha3_256 = /* @__PURE__ */ genKeccak(
  6,
  136,
  32,
  /* @__PURE__ */ oidNist(8)
);
var sha3_512 = /* @__PURE__ */ genKeccak(
  6,
  72,
  64,
  /* @__PURE__ */ oidNist(10)
);
var genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts2 = {}) => new Keccak(blockLen, suffix, opts2.dkLen === void 0 ? outputLen : opts2.dkLen, true), info);
var shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist(11));
var shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist(12));

// node_modules/@noble/curves/abstract/fft.js
function checkU32(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
    throw new Error("wrong u32 integer:" + n);
  return n;
}
function isPowerOfTwo(x) {
  checkU32(x);
  return (x & x - 1) === 0 && x !== 0;
}
function reverseBits(n, bits) {
  checkU32(n);
  let reversed = 0;
  for (let i = 0; i < bits; i++, n >>>= 1)
    reversed = reversed << 1 | n & 1;
  return reversed;
}
function log2(n) {
  checkU32(n);
  return 31 - Math.clz32(n);
}
function bitReversalInplace(values) {
  const n = values.length;
  if (n < 2 || !isPowerOfTwo(n))
    throw new Error("n must be a power of 2 and greater than 1. Got " + n);
  const bits = log2(n);
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, bits);
    if (i < j) {
      const tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }
  }
  return values;
}
var FFTCore = (F2, coreOpts) => {
  const { N: N2, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
  const bits = log2(N2);
  if (!isPowerOfTwo(N2))
    throw new Error("FFT: Polynomial size should be power of two");
  const isDit = dit !== invertButterflies;
  isDit;
  return (values) => {
    if (values.length !== N2)
      throw new Error("FFT: wrong Polynomial length");
    if (dit && brp)
      bitReversalInplace(values);
    for (let i = 0, g = 1; i < bits - skipStages; i++) {
      const s = dit ? i + 1 + skipStages : bits - i;
      const m = 1 << s;
      const m2 = m >> 1;
      const stride = N2 >> s;
      for (let k = 0; k < N2; k += m) {
        for (let j = 0, grp = g++; j < m2; j++) {
          const rootPos = invertButterflies ? dit ? N2 - grp : grp : j * stride;
          const i0 = k + j;
          const i1 = k + j + m2;
          const omega = roots[rootPos];
          const b = values[i1];
          const a = values[i0];
          if (isDit) {
            const t = F2.mul(b, omega);
            values[i0] = F2.add(a, t);
            values[i1] = F2.sub(a, t);
          } else if (invertButterflies) {
            values[i0] = F2.add(b, a);
            values[i1] = F2.mul(F2.sub(b, a), omega);
          } else {
            values[i0] = F2.add(a, b);
            values[i1] = F2.mul(F2.sub(a, b), omega);
          }
        }
      }
    }
    if (!dit && brp)
      bitReversalInplace(values);
    return values;
  };
};

// node_modules/@noble/post-quantum/utils.js
var randomBytes3 = randomBytes;
function equalBytes2(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function copyBytes3(bytes) {
  return Uint8Array.from(bytes);
}
function splitCoder(label2, ...lengths) {
  const getLength = (c) => typeof c === "number" ? c : c.bytesLen;
  const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
  return {
    bytesLen,
    encode: (bufs) => {
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < lengths.length; i++) {
        const c = lengths[i];
        const l = getLength(c);
        const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
        abytes(b, l, label2);
        res.set(b, pos);
        if (typeof c !== "number")
          b.fill(0);
        pos += l;
      }
      return res;
    },
    decode: (buf) => {
      abytes(buf, bytesLen, label2);
      const res = [];
      for (const c of lengths) {
        const l = getLength(c);
        const b = buf.subarray(0, l);
        res.push(typeof c === "number" ? b : c.decode(b));
        buf = buf.subarray(l);
      }
      return res;
    }
  };
}
function vecCoder(c, vecLen) {
  const bytesLen = vecLen * c.bytesLen;
  return {
    bytesLen,
    encode: (u) => {
      if (u.length !== vecLen)
        throw new Error(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < u.length; i++) {
        const b = c.encode(u[i]);
        res.set(b, pos);
        b.fill(0);
        pos += b.length;
      }
      return res;
    },
    decode: (a) => {
      abytes(a, bytesLen);
      const r = [];
      for (let i = 0; i < a.length; i += c.bytesLen)
        r.push(c.decode(a.subarray(i, i + c.bytesLen)));
      return r;
    }
  };
}
function cleanBytes(...list) {
  for (const t of list) {
    if (Array.isArray(t))
      for (const b of t)
        b.fill(0);
    else
      t.fill(0);
  }
}
function getMask(bits) {
  return (1 << bits) - 1;
}
var EMPTY = Uint8Array.of();

// node_modules/@noble/post-quantum/_crystals.js
var genCrystals = (opts2) => {
  const { newPoly, N: N2, Q: Q2, F: F2, ROOT_OF_UNITY: ROOT_OF_UNITY2, brvBits, isKyber } = opts2;
  const mod3 = (a, modulo = Q2) => {
    const result = a % modulo | 0;
    return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
  };
  const smod = (a, modulo = Q2) => {
    const r = mod3(a, modulo) | 0;
    return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
  };
  function getZettas() {
    const out = newPoly(N2);
    for (let i = 0; i < N2; i++) {
      const b = reverseBits(i, brvBits);
      const p = BigInt(ROOT_OF_UNITY2) ** BigInt(b) % BigInt(Q2);
      out[i] = Number(p) | 0;
    }
    return out;
  }
  const nttZetas2 = getZettas();
  const field = {
    add: (a, b) => mod3((a | 0) + (b | 0)) | 0,
    sub: (a, b) => mod3((a | 0) - (b | 0)) | 0,
    mul: (a, b) => mod3((a | 0) * (b | 0)) | 0,
    inv: (_a) => {
      throw new Error("not implemented");
    }
  };
  const nttOpts = {
    N: N2,
    roots: nttZetas2,
    invertButterflies: true,
    skipStages: isKyber ? 1 : 0,
    brp: false
  };
  const dif = FFTCore(field, { dit: false, ...nttOpts });
  const dit = FFTCore(field, { dit: true, ...nttOpts });
  const NTT2 = {
    encode: (r) => {
      return dif(r);
    },
    decode: (r) => {
      dit(r);
      for (let i = 0; i < r.length; i++)
        r[i] = mod3(F2 * r[i]);
      return r;
    }
  };
  const bitsCoder2 = (d, c) => {
    const mask = getMask(d);
    const bytesLen = d * (N2 / 8);
    return {
      bytesLen,
      encode: (poly) => {
        const r = new Uint8Array(bytesLen);
        for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
          buf |= (c.encode(poly[i]) & mask) << bufLen;
          bufLen += d;
          for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
            r[pos++] = buf & getMask(bufLen);
        }
        return r;
      },
      decode: (bytes) => {
        const r = newPoly(N2);
        for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
          buf |= bytes[i] << bufLen;
          bufLen += 8;
          for (; bufLen >= d; bufLen -= d, buf >>= d)
            r[pos++] = c.decode(buf & mask);
        }
        return r;
      }
    };
  };
  return { mod: mod3, smod, nttZetas: nttZetas2, NTT: NTT2, bitsCoder: bitsCoder2 };
};
var createXofShake = (shake) => (seed, blockLen) => {
  if (!blockLen)
    blockLen = shake.blockLen;
  const _seed = new Uint8Array(seed.length + 2);
  _seed.set(seed);
  const seedLen = seed.length;
  const buf = new Uint8Array(blockLen);
  let h = shake.create({});
  let calls = 0;
  let xofs = 0;
  return {
    stats: () => ({ calls, xofs }),
    get: (x, y) => {
      _seed[seedLen + 0] = x;
      _seed[seedLen + 1] = y;
      h.destroy();
      h = shake.create({}).update(_seed);
      calls++;
      return () => {
        xofs++;
        return h.xofInto(buf);
      };
    },
    clean: () => {
      h.destroy();
      cleanBytes(buf, _seed);
    }
  };
};
var XOF128 = /* @__PURE__ */ createXofShake(shake128);

// node_modules/@noble/post-quantum/ml-kem.js
var N = 256;
var Q = 3329;
var F = 3303;
var ROOT_OF_UNITY = 17;
var { mod: mod2, nttZetas, NTT, bitsCoder } = genCrystals({
  N,
  Q,
  F,
  ROOT_OF_UNITY,
  newPoly: (n) => new Uint16Array(n),
  brvBits: 7,
  isKyber: true
});
var PARAMS = {
  512: { N, Q, K: 2, ETA1: 3, ETA2: 2, du: 10, dv: 4, RBGstrength: 128 },
  768: { N, Q, K: 3, ETA1: 2, ETA2: 2, du: 10, dv: 4, RBGstrength: 192 },
  1024: { N, Q, K: 4, ETA1: 2, ETA2: 2, du: 11, dv: 5, RBGstrength: 256 }
};
var compress = (d) => {
  if (d >= 12)
    return { encode: (i) => i, decode: (i) => i };
  const a = 2 ** (d - 1);
  return {
    // const compress = (i: number) => round((2 ** d / Q) * i) % 2 ** d;
    encode: (i) => ((i << d) + Q / 2) / Q,
    // const decompress = (i: number) => round((Q / 2 ** d) * i);
    decode: (i) => i * Q + a >>> d
  };
};
var polyCoder = (d) => bitsCoder(d, compress(d));
function polyAdd(a, b) {
  for (let i = 0; i < N; i++)
    a[i] = mod2(a[i] + b[i]);
}
function polySub(a, b) {
  for (let i = 0; i < N; i++)
    a[i] = mod2(a[i] - b[i]);
}
function BaseCaseMultiply(a0, a1, b0, b1, zeta) {
  const c0 = mod2(a1 * b1 * zeta + a0 * b0);
  const c1 = mod2(a0 * b1 + a1 * b0);
  return { c0, c1 };
}
function MultiplyNTTs(f, g) {
  for (let i = 0; i < N / 2; i++) {
    let z = nttZetas[64 + (i >> 1)];
    if (i & 1)
      z = -z;
    const { c0, c1 } = BaseCaseMultiply(f[2 * i + 0], f[2 * i + 1], g[2 * i + 0], g[2 * i + 1], z);
    f[2 * i + 0] = c0;
    f[2 * i + 1] = c1;
  }
  return f;
}
function SampleNTT(xof) {
  const r = new Uint16Array(N);
  for (let j = 0; j < N; ) {
    const b = xof();
    if (b.length % 3)
      throw new Error("SampleNTT: unaligned block");
    for (let i = 0; j < N && i + 3 <= b.length; i += 3) {
      const d1 = (b[i + 0] >> 0 | b[i + 1] << 8) & 4095;
      const d2 = (b[i + 1] >> 4 | b[i + 2] << 4) & 4095;
      if (d1 < Q)
        r[j++] = d1;
      if (j < N && d2 < Q)
        r[j++] = d2;
    }
  }
  return r;
}
function sampleCBD(PRF, seed, nonce, eta) {
  const buf = PRF(eta * N / 4, seed, nonce);
  const r = new Uint16Array(N);
  const b32 = u32(buf);
  let len = 0;
  for (let i = 0, p = 0, bb = 0, t0 = 0; i < b32.length; i++) {
    let b = b32[i];
    for (let j = 0; j < 32; j++) {
      bb += b & 1;
      b >>= 1;
      len += 1;
      if (len === eta) {
        t0 = bb;
        bb = 0;
      } else if (len === 2 * eta) {
        r[p++] = mod2(t0 - bb);
        bb = 0;
        len = 0;
      }
    }
  }
  if (len)
    throw new Error(`sampleCBD: leftover bits: ${len}`);
  return r;
}
var genKPKE = (opts2) => {
  const { K, PRF, XOF, HASH512, ETA1, ETA2, du, dv } = opts2;
  const poly1 = polyCoder(1);
  const polyV = polyCoder(dv);
  const polyU = polyCoder(du);
  const publicCoder = splitCoder("publicKey", vecCoder(polyCoder(12), K), 32);
  const secretCoder = vecCoder(polyCoder(12), K);
  const cipherCoder = splitCoder("ciphertext", vecCoder(polyU, K), polyV);
  const seedCoder = splitCoder("seed", 32, 32);
  return {
    secretCoder,
    lengths: {
      secretKey: secretCoder.bytesLen,
      publicKey: publicCoder.bytesLen,
      cipherText: cipherCoder.bytesLen
    },
    keygen: (seed) => {
      abytes(seed, 32, "seed");
      const seedDst = new Uint8Array(33);
      seedDst.set(seed);
      seedDst[32] = K;
      const seedHash = HASH512(seedDst);
      const [rho, sigma] = seedCoder.decode(seedHash);
      const sHat = [];
      const tHat = [];
      for (let i = 0; i < K; i++)
        sHat.push(NTT.encode(sampleCBD(PRF, sigma, i, ETA1)));
      const x = XOF(rho);
      for (let i = 0; i < K; i++) {
        const e = NTT.encode(sampleCBD(PRF, sigma, K + i, ETA1));
        for (let j = 0; j < K; j++) {
          const aji = SampleNTT(x.get(j, i));
          polyAdd(e, MultiplyNTTs(aji, sHat[j]));
        }
        tHat.push(e);
      }
      x.clean();
      const res = {
        publicKey: publicCoder.encode([tHat, rho]),
        secretKey: secretCoder.encode(sHat)
      };
      cleanBytes(rho, sigma, sHat, tHat, seedDst, seedHash);
      return res;
    },
    encrypt: (publicKey, msg, seed) => {
      const [tHat, rho] = publicCoder.decode(publicKey);
      const rHat = [];
      for (let i = 0; i < K; i++)
        rHat.push(NTT.encode(sampleCBD(PRF, seed, i, ETA1)));
      const x = XOF(rho);
      const tmp2 = new Uint16Array(N);
      const u = [];
      for (let i = 0; i < K; i++) {
        const e1 = sampleCBD(PRF, seed, K + i, ETA2);
        const tmp = new Uint16Array(N);
        for (let j = 0; j < K; j++) {
          const aij = SampleNTT(x.get(i, j));
          polyAdd(tmp, MultiplyNTTs(aij, rHat[j]));
        }
        polyAdd(e1, NTT.decode(tmp));
        u.push(e1);
        polyAdd(tmp2, MultiplyNTTs(tHat[i], rHat[i]));
        cleanBytes(tmp);
      }
      x.clean();
      const e2 = sampleCBD(PRF, seed, 2 * K, ETA2);
      polyAdd(e2, NTT.decode(tmp2));
      const v = poly1.decode(msg);
      polyAdd(v, e2);
      cleanBytes(tHat, rHat, tmp2, e2);
      return cipherCoder.encode([u, v]);
    },
    decrypt: (cipherText, privateKey) => {
      const [u, v] = cipherCoder.decode(cipherText);
      const sk = secretCoder.decode(privateKey);
      const tmp = new Uint16Array(N);
      for (let i = 0; i < K; i++)
        polyAdd(tmp, MultiplyNTTs(sk[i], NTT.encode(u[i])));
      polySub(v, NTT.decode(tmp));
      cleanBytes(tmp, sk, u);
      return poly1.encode(v);
    }
  };
};
function createKyber(opts2) {
  const KPKE = genKPKE(opts2);
  const { HASH256, HASH512, KDF } = opts2;
  const { secretCoder: KPKESecretCoder, lengths } = KPKE;
  const secretCoder = splitCoder("secretKey", lengths.secretKey, lengths.publicKey, 32, 32);
  const msgLen = 32;
  const seedLen = 64;
  return {
    info: { type: "ml-kem" },
    lengths: {
      ...lengths,
      seed: 64,
      msg: msgLen,
      msgRand: msgLen,
      secretKey: secretCoder.bytesLen
    },
    keygen: (seed = randomBytes3(seedLen)) => {
      abytes(seed, seedLen, "seed");
      const { publicKey, secretKey: sk } = KPKE.keygen(seed.subarray(0, 32));
      const publicKeyHash = HASH256(publicKey);
      const secretKey = secretCoder.encode([sk, publicKey, publicKeyHash, seed.subarray(32)]);
      cleanBytes(sk, publicKeyHash);
      return { publicKey, secretKey };
    },
    getPublicKey: (secretKey) => {
      const [_sk, publicKey, _publicKeyHash, _z] = secretCoder.decode(secretKey);
      return Uint8Array.from(publicKey);
    },
    encapsulate: (publicKey, msg = randomBytes3(msgLen)) => {
      abytes(publicKey, lengths.publicKey, "publicKey");
      abytes(msg, msgLen, "message");
      const eke = publicKey.subarray(0, 384 * opts2.K);
      const ek = KPKESecretCoder.encode(KPKESecretCoder.decode(copyBytes3(eke)));
      if (!equalBytes2(ek, eke)) {
        cleanBytes(ek);
        throw new Error("ML-KEM.encapsulate: wrong publicKey modulus");
      }
      cleanBytes(ek);
      const kr = HASH512.create().update(msg).update(HASH256(publicKey)).digest();
      const cipherText = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
      cleanBytes(kr.subarray(32));
      return { cipherText, sharedSecret: kr.subarray(0, 32) };
    },
    decapsulate: (cipherText, secretKey) => {
      abytes(secretKey, secretCoder.bytesLen, "secretKey");
      abytes(cipherText, lengths.cipherText, "cipherText");
      const k768 = secretCoder.bytesLen - 96;
      const start = k768 + 32;
      const test = HASH256(secretKey.subarray(k768 / 2, start));
      if (!equalBytes2(test, secretKey.subarray(start, start + 32)))
        throw new Error("invalid secretKey: hash check failed");
      const [sk, publicKey, publicKeyHash, z] = secretCoder.decode(secretKey);
      const msg = KPKE.decrypt(cipherText, sk);
      const kr = HASH512.create().update(msg).update(publicKeyHash).digest();
      const Khat = kr.subarray(0, 32);
      const cipherText2 = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
      const isValid = equalBytes2(cipherText, cipherText2);
      const Kbar = KDF.create({ dkLen: 32 }).update(z).update(cipherText).digest();
      cleanBytes(msg, cipherText2, !isValid ? Khat : Kbar);
      return isValid ? Khat : Kbar;
    }
  };
}
function shakePRF(dkLen, key, nonce) {
  return shake256.create({ dkLen }).update(key).update(new Uint8Array([nonce])).digest();
}
var opts = {
  HASH256: sha3_256,
  HASH512: sha3_512,
  KDF: shake256,
  XOF: XOF128,
  PRF: shakePRF
};
var ml_kem512 = /* @__PURE__ */ createKyber({
  ...opts,
  ...PARAMS[512]
});
var ml_kem768 = /* @__PURE__ */ createKyber({
  ...opts,
  ...PARAMS[768]
});
var ml_kem1024 = /* @__PURE__ */ createKyber({
  ...opts,
  ...PARAMS[1024]
});

// node_modules/@noble/post-quantum/hybrid.js
function ecKeygen(curve, allowZeroKey = false) {
  const lengths = curve.lengths;
  let keygen = curve.keygen;
  if (allowZeroKey) {
    const wCurve = curve;
    const Fn = wCurve.Point.Fn;
    if (!Fn)
      throw new Error("No Point.Fn");
    keygen = (seed = randomBytes3(lengths.seed)) => {
      abytes(seed, lengths.seed, "seed");
      const seedScalar = Fn.isLE ? bytesToNumberLE(seed) : bytesToNumberBE(seed);
      const secretKey = Fn.toBytes(Fn.create(seedScalar));
      return { secretKey, publicKey: curve.getPublicKey(secretKey) };
    };
  }
  return {
    lengths: { secretKey: lengths.secretKey, publicKey: lengths.publicKey, seed: lengths.seed },
    keygen,
    getPublicKey: (secretKey) => curve.getPublicKey(secretKey)
  };
}
function ecdhKem(curve, allowZeroKey = false) {
  const kg = ecKeygen(curve, allowZeroKey);
  if (!curve.getSharedSecret)
    throw new Error("wrong curve");
  return {
    lengths: { ...kg.lengths, msg: kg.lengths.seed, cipherText: kg.lengths.publicKey },
    keygen: kg.keygen,
    getPublicKey: kg.getPublicKey,
    encapsulate(publicKey, rand = randomBytes3(curve.lengths.seed)) {
      const ek = this.keygen(rand).secretKey;
      const sharedSecret = this.decapsulate(publicKey, ek);
      const cipherText = curve.getPublicKey(ek);
      cleanBytes(ek);
      return { sharedSecret, cipherText };
    },
    decapsulate(cipherText, secretKey) {
      const res = curve.getSharedSecret(secretKey, cipherText);
      return curve.lengths.publicKeyHasPrefix ? res.subarray(1) : res;
    }
  };
}
function splitLengths(lst, name) {
  return splitCoder(name, ...lst.map((i) => {
    if (typeof i.lengths[name] !== "number")
      throw new Error("wrong length: " + name);
    return i.lengths[name];
  }));
}
function expandSeedXof(xof) {
  return (seed, seedLen) => xof(seed, { dkLen: seedLen });
}
function combineKeys(realSeedLen, expandSeed, ...ck) {
  const seedCoder = splitLengths(ck, "seed");
  const pkCoder = splitLengths(ck, "publicKey");
  if (realSeedLen === void 0)
    realSeedLen = seedCoder.bytesLen;
  anumber(realSeedLen);
  function expandDecapsulationKey(seed) {
    abytes(seed, realSeedLen);
    const expanded = seedCoder.decode(expandSeed(seed, seedCoder.bytesLen));
    const keys = ck.map((i, j) => i.keygen(expanded[j]));
    const secretKey = keys.map((i) => i.secretKey);
    const publicKey = keys.map((i) => i.publicKey);
    return { secretKey, publicKey };
  }
  return {
    info: { lengths: { seed: realSeedLen, publicKey: pkCoder.bytesLen, secretKey: realSeedLen } },
    getPublicKey(secretKey) {
      return this.keygen(secretKey).publicKey;
    },
    keygen(seed = randomBytes3(realSeedLen)) {
      const { publicKey: pk, secretKey } = expandDecapsulationKey(seed);
      const publicKey = pkCoder.encode(pk);
      cleanBytes(pk);
      cleanBytes(secretKey);
      return { secretKey: seed, publicKey };
    },
    expandDecapsulationKey,
    realSeedLen
  };
}
function combineKEMS(realSeedLen, realMsgLen, expandSeed, combiner, ...kems) {
  const keys = combineKeys(realSeedLen, expandSeed, ...kems);
  const ctCoder = splitLengths(kems, "cipherText");
  const pkCoder = splitLengths(kems, "publicKey");
  const msgCoder = splitLengths(kems, "msg");
  if (realMsgLen === void 0)
    realMsgLen = msgCoder.bytesLen;
  anumber(realMsgLen);
  return {
    lengths: {
      ...keys.info.lengths,
      msg: realMsgLen,
      msgRand: msgCoder.bytesLen,
      cipherText: ctCoder.bytesLen
    },
    getPublicKey: keys.getPublicKey,
    keygen: keys.keygen,
    encapsulate(pk, randomness = randomBytes3(msgCoder.bytesLen)) {
      const pks = pkCoder.decode(pk);
      const rand = msgCoder.decode(randomness);
      const enc = kems.map((i, j) => i.encapsulate(pks[j], rand[j]));
      const sharedSecret = enc.map((i) => i.sharedSecret);
      const cipherText = enc.map((i) => i.cipherText);
      const res = {
        sharedSecret: combiner(pks, cipherText, sharedSecret),
        cipherText: ctCoder.encode(cipherText)
      };
      cleanBytes(sharedSecret, cipherText);
      return res;
    },
    decapsulate(ct, seed) {
      const cts = ctCoder.decode(ct);
      const { publicKey, secretKey } = keys.expandDecapsulationKey(seed);
      const sharedSecret = kems.map((i, j) => i.decapsulate(cts[j], secretKey[j]));
      return combiner(publicKey, cts, sharedSecret);
    }
  };
}
function QSF(label2, pqc, curveKEM, xof, kdf) {
  ahash(xof);
  ahash(kdf);
  return combineKEMS(32, 32, expandSeedXof(xof), (pk, ct, ss) => kdf(concatBytes(ss[0], ss[1], ct[1], pk[1], asciiToBytes(label2))), pqc, curveKEM);
}
var QSF_ml_kem768_p256 = QSF("QSF-KEM(ML-KEM-768,P-256)-XOF(SHAKE256)-KDF(SHA3-256)", ml_kem768, ecdhKem(p256, true), shake256, sha3_256);
var QSF_ml_kem1024_p384 = QSF("QSF-KEM(ML-KEM-1024,P-384)-XOF(SHAKE256)-KDF(SHA3-256)", ml_kem1024, ecdhKem(p384, true), shake256, sha3_256);
function createKitchenSink(label2, pqc, curveKEM, xof, hash) {
  ahash(xof);
  ahash(hash);
  return combineKEMS(32, 32, expandSeedXof(xof), (pk, ct, ss) => {
    const preimage = concatBytes(ss[0], ss[1], ct[0], pk[0], ct[1], pk[1], asciiToBytes(label2));
    const len = 32;
    const ikm = concatBytes(asciiToBytes("hybrid_prk"), preimage);
    const prk = extract(hash, ikm);
    const info = concatBytes(numberToBytesBE2(len, 2), asciiToBytes("shared_secret"), asciiToBytes(""));
    const res = expand(hash, prk, info, len);
    cleanBytes(prk, info, ikm, preimage);
    return res;
  }, pqc, curveKEM);
}
var x25519kem = ecdhKem(x25519);
var KitchenSink_ml_kem768_x25519 = createKitchenSink("KitchenSink-KEM(ML-KEM-768,X25519)-XOF(SHAKE256)-KDF(HKDF-SHA-256)", ml_kem768, x25519kem, shake256, sha256);
var ml_kem768_x25519 = /* @__PURE__ */ (() => combineKEMS(
  32,
  32,
  expandSeedXof(shake256),
  // Awesome label, so much escaping hell in a single line.
  (pk, ct, ss) => sha3_256(concatBytes(ss[0], ss[1], ct[1], pk[1], asciiToBytes("\\.//^\\"))),
  ml_kem768,
  x25519kem
))();
function nistCurveKem(curve, scalarLen, elemLen, nseed) {
  const Fn = curve.Point.Fn;
  if (!Fn)
    throw new Error("no Point.Fn");
  function rejectionSampling(seed) {
    let sk;
    for (let start = 0, end = scalarLen; ; start = end, end += scalarLen) {
      if (end > seed.length)
        throw new Error("rejection sampling failed");
      sk = Fn.fromBytes(seed.subarray(start, end), true);
      if (Fn.isValidNot0(sk))
        break;
    }
    const secretKey = Fn.toBytes(Fn.create(sk));
    const publicKey = curve.getPublicKey(secretKey, false);
    return { secretKey, publicKey };
  }
  return {
    lengths: {
      secretKey: scalarLen,
      publicKey: elemLen,
      seed: nseed,
      msg: nseed,
      cipherText: elemLen
    },
    keygen(seed = randomBytes3(nseed)) {
      abytes(seed, nseed, "seed");
      return rejectionSampling(seed);
    },
    getPublicKey(secretKey) {
      return curve.getPublicKey(secretKey, false);
    },
    encapsulate(publicKey, rand = randomBytes3(nseed)) {
      abytes(rand, nseed, "rand");
      const { secretKey: ek } = rejectionSampling(rand);
      const sharedSecret = this.decapsulate(publicKey, ek);
      const cipherText = curve.getPublicKey(ek, false);
      cleanBytes(ek);
      return { sharedSecret, cipherText };
    },
    decapsulate(cipherText, secretKey) {
      const full = curve.getSharedSecret(secretKey, cipherText);
      return full.subarray(1);
    }
  };
}
function concreteHybridKem(label2, mlkem, curve, nseed) {
  const { secretKey: scalarLen, publicKeyUncompressed: elemLen } = curve.lengths;
  if (!scalarLen || !elemLen)
    throw new Error("wrong curve");
  const curveKem = nistCurveKem(curve, scalarLen, elemLen, nseed);
  const mlkemSeedLen = 64;
  const totalSeedLen = mlkemSeedLen + nseed;
  return combineKEMS(32, 32, (seed) => {
    abytes(seed, 32);
    const expanded = shake256(seed, { dkLen: totalSeedLen });
    const mlkemSeed = expanded.subarray(0, mlkemSeedLen);
    const curveSeed = expanded.subarray(mlkemSeedLen, totalSeedLen);
    return concatBytes(mlkemSeed, curveSeed);
  }, (pk, ct, ss) => sha3_256(concatBytes(ss[0], ss[1], ct[1], pk[1], asciiToBytes(label2))), mlkem, curveKem);
}
var ml_kem768_p256 = /* @__PURE__ */ (() => concreteHybridKem("MLKEM768-P256", ml_kem768, p256, 128))();
var MLKEM768X25519 = ml_kem768_x25519;
var MLKEM768P256 = ml_kem768_p256;

// node_modules/age-encryption/dist/x25519.js
var exportable = false;
var webCryptoOff = false;
async function webCryptoFallback(func, fallback) {
  if (webCryptoOff) {
    return await fallback();
  }
  try {
    return await func();
  } catch (error) {
    if (error instanceof ReferenceError || error instanceof DOMException && error.name === "NotSupportedError") {
      return await fallback();
    } else {
      throw error;
    }
  }
}
async function scalarMult(scalar, u) {
  return await webCryptoFallback(async () => {
    const key = isCryptoKey(scalar) ? scalar : await importX25519Key(scalar);
    const peer = await crypto.subtle.importKey("raw", domBuffer(u), { name: "X25519" }, exportable, []);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: peer }, key, 256));
  }, () => {
    if (isCryptoKey(scalar)) {
      throw new Error("CryptoKey provided but X25519 WebCrypto is not supported");
    }
    return x25519.scalarMult(scalar, u);
  });
}
async function scalarMultBase(scalar) {
  return await webCryptoFallback(async () => {
    return scalarMult(scalar, x25519.GuBytes);
  }, () => {
    if (isCryptoKey(scalar)) {
      throw new Error("CryptoKey provided but X25519 WebCrypto is not supported");
    }
    return x25519.scalarMultBase(scalar);
  });
}
var pkcs8Prefix = /* @__PURE__ */ new Uint8Array([
  48,
  46,
  2,
  1,
  0,
  48,
  5,
  6,
  3,
  43,
  101,
  110,
  4,
  34,
  4,
  32
]);
async function importX25519Key(key) {
  if (key.length !== 32) {
    throw new Error("X25519 private key must be 32 bytes");
  }
  const pkcs8 = new Uint8Array([...pkcs8Prefix, ...key]);
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "X25519" }, exportable, ["deriveBits"]);
}
function isCryptoKey(key) {
  return typeof CryptoKey !== "undefined" && key instanceof CryptoKey;
}
function domBuffer(arr) {
  return arr;
}

// node_modules/age-encryption/dist/io.js
var LineReader = class {
  s;
  transcript = [];
  buf = new Uint8Array(0);
  constructor(stream2) {
    this.s = stream2.getReader();
  }
  async readLine() {
    const line = [];
    while (true) {
      const i = this.buf.indexOf("\n".charCodeAt(0));
      if (i >= 0) {
        line.push(this.buf.subarray(0, i));
        this.transcript.push(this.buf.subarray(0, i + 1));
        this.buf = this.buf.subarray(i + 1);
        return asciiString(flatten(line));
      }
      if (this.buf.length > 0) {
        line.push(this.buf);
        this.transcript.push(this.buf);
      }
      const next = await this.s.read();
      if (next.done) {
        this.buf = flatten(line);
        return null;
      }
      this.buf = next.value;
    }
  }
  close() {
    this.s.releaseLock();
    return { rest: this.buf, transcript: flatten(this.transcript) };
  }
};
function asciiString(bytes) {
  bytes.forEach((b) => {
    if (b < 32 || b > 126) {
      throw Error("invalid non-ASCII byte in header");
    }
  });
  return new TextDecoder().decode(bytes);
}
function flatten(arr) {
  const len = arr.reduce(((sum, line) => sum + line.length), 0);
  const out = new Uint8Array(len);
  let n = 0;
  for (const a of arr) {
    out.set(a, n);
    n += a.length;
  }
  return out;
}
function prepend(s, ...prefixes) {
  return s.pipeThrough(new TransformStream({
    start(controller) {
      for (const p of prefixes) {
        controller.enqueue(p);
      }
    }
  }));
}
function stream(a) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(a);
      controller.close();
    }
  });
}
async function readAll(stream2) {
  if (!(stream2 instanceof ReadableStream)) {
    throw new Error("readAll expects a ReadableStream<Uint8Array>");
  }
  return new Uint8Array(await new Response(stream2).arrayBuffer());
}
async function readAllString(stream2) {
  if (!(stream2 instanceof ReadableStream)) {
    throw new Error("readAllString expects a ReadableStream<Uint8Array>");
  }
  return await new Response(stream2).text();
}
async function read(stream2, n) {
  const reader = stream2.getReader();
  const chunks = [];
  let readBytes = 0;
  while (readBytes < n) {
    const { done, value } = await reader.read();
    if (done) {
      throw Error("stream ended before reading " + n.toString() + " bytes");
    }
    chunks.push(value);
    readBytes += value.length;
  }
  reader.releaseLock();
  const buf = flatten(chunks);
  const data = buf.subarray(0, n);
  const rest = prepend(stream2, buf.subarray(n));
  return { data, rest };
}

// node_modules/age-encryption/dist/format.js
var Stanza = class {
  /**
   * All space-separated arguments on the first line of the stanza.
   * Each argument is a string that does not contain spaces.
   * The first argument is often a recipient type, which should look like
   * `example.com/...` to avoid collisions.
   */
  args;
  /**
   * The raw body of the stanza. This is automatically base64-encoded and
   * split into lines of 48 characters each.
   */
  body;
  constructor(args, body) {
    this.args = args;
    this.body = body;
  }
};
async function parseNextStanza(hdr) {
  const argsLine = await hdr.readLine();
  if (argsLine === null) {
    throw Error("invalid stanza");
  }
  const args = argsLine.split(" ");
  if (args.length < 2 || args.shift() !== "->") {
    return { next: argsLine };
  }
  for (const arg of args) {
    if (arg.length === 0) {
      throw Error("invalid stanza");
    }
  }
  const bodyLines = [];
  for (; ; ) {
    const nextLine = await hdr.readLine();
    if (nextLine === null) {
      throw Error("invalid stanza");
    }
    const line = base64nopad.decode(nextLine);
    if (line.length > 48) {
      throw Error("invalid stanza");
    }
    bodyLines.push(line);
    if (line.length < 48) {
      break;
    }
  }
  const body = flatten(bodyLines);
  return { s: new Stanza(args, body) };
}
async function parseHeader(header) {
  const hdr = new LineReader(header);
  const versionLine = await hdr.readLine();
  if (versionLine !== "age-encryption.org/v1") {
    throw Error("invalid version " + (versionLine ?? "line"));
  }
  const stanzas = [];
  for (; ; ) {
    const { s, next: macLine } = await parseNextStanza(hdr);
    if (s !== void 0) {
      stanzas.push(s);
      continue;
    }
    if (!macLine.startsWith("--- ")) {
      throw Error("invalid header");
    }
    const MAC = base64nopad.decode(macLine.slice(4));
    const { rest, transcript } = hdr.close();
    const headerNoMAC = transcript.slice(0, transcript.length - 1 - macLine.length + 3);
    return { stanzas, headerNoMAC, MAC, headerSize: transcript.length, rest: prepend(header, rest) };
  }
}
function encodeHeaderNoMAC(recipients) {
  const lines = [];
  lines.push("age-encryption.org/v1\n");
  for (const s of recipients) {
    lines.push("-> " + s.args.join(" ") + "\n");
    for (let i = 0; i < s.body.length; i += 48) {
      let end = i + 48;
      if (end > s.body.length)
        end = s.body.length;
      lines.push(base64nopad.encode(s.body.subarray(i, end)) + "\n");
    }
    if (s.body.length % 48 === 0)
      lines.push("\n");
  }
  lines.push("---");
  return new TextEncoder().encode(lines.join(""));
}
function encodeHeader(recipients, MAC) {
  return flatten([
    encodeHeaderNoMAC(recipients),
    new TextEncoder().encode(" " + base64nopad.encode(MAC) + "\n")
  ]);
}

// node_modules/age-encryption/dist/recipients.js
function generateIdentity() {
  return generateX25519Identity();
}
function generateX25519Identity() {
  const scalar = randomBytes(32);
  const identity = bech32.encodeFromBytes("AGE-SECRET-KEY-", scalar).toUpperCase();
  return Promise.resolve(identity);
}
function generateHybridIdentity() {
  const scalar = randomBytes(32);
  const identity = bech32.encodeFromBytes("AGE-SECRET-KEY-PQ-", scalar).toUpperCase();
  return Promise.resolve(identity);
}
async function identityToRecipient(identity) {
  let scalar;
  if (isCryptoKey2(identity)) {
    scalar = identity;
  } else if (identity.startsWith("AGE-SECRET-KEY-PQ-1")) {
    const res = bech32.decodeToBytes(identity);
    if (res.prefix.toUpperCase() !== "AGE-SECRET-KEY-PQ-" || res.bytes.length !== 32) {
      throw Error("invalid identity");
    }
    const recipient2 = MLKEM768X25519.getPublicKey(res.bytes);
    return bech32.encode("age1pq", bech32.toWords(recipient2), false);
  } else {
    const res = bech32.decodeToBytes(identity);
    if (!identity.startsWith("AGE-SECRET-KEY-1") || res.prefix.toUpperCase() !== "AGE-SECRET-KEY-" || res.bytes.length !== 32) {
      throw Error("invalid identity");
    }
    scalar = res.bytes;
  }
  const recipient = await scalarMultBase(scalar);
  return bech32.encodeFromBytes("age", recipient);
}
var HybridRecipient = class {
  recipient;
  constructor(s) {
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("age1pq1") || res.prefix.toLowerCase() !== "age1pq" || res.bytes.length !== 1216) {
      throw Error("invalid recipient");
    }
    this.recipient = res.bytes;
  }
  wrapFileKey(fileKey) {
    const { cipherText: encapsulatedKey, sharedSecret } = MLKEM768X25519.encapsulate(this.recipient);
    const label2 = new TextEncoder().encode("age-encryption.org/mlkem768x25519");
    const { key, nonce } = hpkeContext(hpkeMLKEM768X25519, sharedSecret, label2);
    const ciphertext = chacha20poly1305(key, nonce).encrypt(fileKey);
    return [new Stanza(["mlkem768x25519", base64nopad.encode(encapsulatedKey)], ciphertext)];
  }
};
var HybridIdentity = class {
  identity;
  constructor(s) {
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("AGE-SECRET-KEY-PQ-1") || res.prefix.toUpperCase() !== "AGE-SECRET-KEY-PQ-" || res.bytes.length !== 32) {
      throw Error("invalid identity");
    }
    this.identity = res.bytes;
  }
  unwrapFileKey(stanzas) {
    for (const s of stanzas) {
      if (s.args.length < 1 || s.args[0] !== "mlkem768x25519") {
        continue;
      }
      if (s.args.length !== 2) {
        throw Error("invalid mlkem768x25519 stanza");
      }
      const share = base64nopad.decode(s.args[1]);
      if (share.length !== 1120) {
        throw Error("invalid mlkem768x25519 stanza");
      }
      if (s.body.length !== 32) {
        throw Error("invalid mlkem768x25519 stanza");
      }
      const sharedSecret = MLKEM768X25519.decapsulate(share, this.identity);
      const label2 = new TextEncoder().encode("age-encryption.org/mlkem768x25519");
      const { key, nonce } = hpkeContext(hpkeMLKEM768X25519, sharedSecret, label2);
      try {
        return chacha20poly1305(key, nonce).decrypt(s.body);
      } catch {
        continue;
      }
    }
    return null;
  }
};
var hpkeMLKEM768X25519 = 25722;
var hpkeMLKEM768P256 = 80;
var hpkeDHKEMP256 = 16;
function hpkeContext(kemID, sharedSecret, info) {
  const suiteID = hpkeSuiteID(kemID);
  const pskIDHash = hpkeLabeledExtract(suiteID, void 0, "psk_id_hash", new Uint8Array(0));
  const infoHash = hpkeLabeledExtract(suiteID, void 0, "info_hash", info);
  const ksContext = new Uint8Array(1 + pskIDHash.length + infoHash.length);
  ksContext[0] = 0;
  ksContext.set(pskIDHash, 1);
  ksContext.set(infoHash, 1 + pskIDHash.length);
  const secret = hpkeLabeledExtract(suiteID, sharedSecret, "secret", new Uint8Array(0));
  const key = hpkeLabeledExpand(suiteID, secret, "key", ksContext, 32);
  const nonce = hpkeLabeledExpand(suiteID, secret, "base_nonce", ksContext, 12);
  return { key, nonce };
}
function hpkeSuiteID(kemID) {
  const suiteID = new Uint8Array(10);
  suiteID.set(new TextEncoder().encode("HPKE"), 0);
  suiteID[4] = kemID >> 8 & 255;
  suiteID[5] = kemID & 255;
  suiteID[6] = 0;
  suiteID[7] = 1;
  suiteID[8] = 0;
  suiteID[9] = 3;
  return suiteID;
}
function hpkeLabeledExtract(suiteID, salt, label2, ikm) {
  const labeledIKM = new Uint8Array(7 + suiteID.length + label2.length + ikm.length);
  let offset = 0;
  labeledIKM.set(new TextEncoder().encode("HPKE-v1"), offset);
  offset += "HPKE-v1".length;
  labeledIKM.set(suiteID, offset);
  offset += suiteID.length;
  labeledIKM.set(new TextEncoder().encode(label2), offset);
  offset += label2.length;
  labeledIKM.set(ikm, offset);
  return extract(sha256, labeledIKM, salt);
}
function hpkeLabeledExpand(suiteID, prk, label2, info, length) {
  const labeledInfo = new Uint8Array(2 + 7 + suiteID.length + label2.length + info.length);
  let offset = 0;
  labeledInfo[offset] = length >> 8 & 255;
  labeledInfo[offset + 1] = length & 255;
  offset += 2;
  labeledInfo.set(new TextEncoder().encode("HPKE-v1"), offset);
  offset += "HPKE-v1".length;
  labeledInfo.set(suiteID, offset);
  offset += suiteID.length;
  labeledInfo.set(new TextEncoder().encode(label2), offset);
  offset += label2.length;
  labeledInfo.set(info, offset);
  return expand(sha256, prk, labeledInfo, length);
}
function hpkeDHKEMP256Encapsulate(recipient) {
  if (recipient.length !== p256.lengths.publicKeyUncompressed) {
    recipient = p256.Point.fromBytes(recipient).toBytes(false);
  }
  const ephemeral = p256.utils.randomSecretKey();
  const encapsulatedKey = p256.getPublicKey(ephemeral, false);
  const ss = p256.getSharedSecret(ephemeral, recipient, true).subarray(1);
  const kemContext = new Uint8Array(encapsulatedKey.length + recipient.length);
  kemContext.set(encapsulatedKey, 0);
  kemContext.set(recipient, encapsulatedKey.length);
  const suiteID = new Uint8Array(5);
  suiteID.set(new TextEncoder().encode("KEM"), 0);
  suiteID[3] = hpkeDHKEMP256 >> 8;
  suiteID[4] = hpkeDHKEMP256 & 255;
  const eaePRK = hpkeLabeledExtract(suiteID, void 0, "eae_prk", ss);
  const sharedSecret = hpkeLabeledExpand(suiteID, eaePRK, "shared_secret", kemContext, 32);
  return { encapsulatedKey, sharedSecret };
}
var TagRecipient = class {
  recipient;
  constructor(s) {
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("age1tag1") || res.prefix.toLowerCase() !== "age1tag" || res.bytes.length !== 33) {
      throw Error("invalid recipient");
    }
    this.recipient = res.bytes;
  }
  wrapFileKey(fileKey) {
    const { encapsulatedKey, sharedSecret } = hpkeDHKEMP256Encapsulate(this.recipient);
    const label2 = new TextEncoder().encode("age-encryption.org/p256tag");
    const tag = (() => {
      const recipientHash = sha256(this.recipient).subarray(0, 4);
      const ikm = new Uint8Array(encapsulatedKey.length + recipientHash.length);
      ikm.set(encapsulatedKey, 0);
      ikm.set(recipientHash, encapsulatedKey.length);
      return extract(sha256, ikm, label2).subarray(0, 4);
    })();
    const { key, nonce } = hpkeContext(hpkeDHKEMP256, sharedSecret, label2);
    const ciphertext = chacha20poly1305(key, nonce).encrypt(fileKey);
    return [new Stanza(["p256tag", base64nopad.encode(tag), base64nopad.encode(encapsulatedKey)], ciphertext)];
  }
};
var HybridTagRecipient = class {
  recipient;
  constructor(s) {
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("age1tagpq1") || res.prefix.toLowerCase() !== "age1tagpq" || res.bytes.length !== 1249) {
      throw Error("invalid recipient");
    }
    this.recipient = res.bytes;
  }
  wrapFileKey(fileKey) {
    const { cipherText: encapsulatedKey, sharedSecret } = MLKEM768P256.encapsulate(this.recipient);
    const label2 = new TextEncoder().encode("age-encryption.org/mlkem768p256tag");
    const tag = (() => {
      const recipientHash = sha256(this.recipient.subarray(1184)).subarray(0, 4);
      const ikm = new Uint8Array(encapsulatedKey.length + recipientHash.length);
      ikm.set(encapsulatedKey, 0);
      ikm.set(recipientHash, encapsulatedKey.length);
      return extract(sha256, ikm, label2).subarray(0, 4);
    })();
    const { key, nonce } = hpkeContext(hpkeMLKEM768P256, sharedSecret, label2);
    const ciphertext = chacha20poly1305(key, nonce).encrypt(fileKey);
    return [new Stanza(["mlkem768p256tag", base64nopad.encode(tag), base64nopad.encode(encapsulatedKey)], ciphertext)];
  }
};
var X25519Recipient = class {
  recipient;
  constructor(s) {
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("age1") || res.prefix.toLowerCase() !== "age" || res.bytes.length !== 32) {
      throw Error("invalid recipient");
    }
    this.recipient = res.bytes;
  }
  async wrapFileKey(fileKey) {
    const ephemeral = randomBytes(32);
    const share = await scalarMultBase(ephemeral);
    const secret = await scalarMult(ephemeral, this.recipient);
    const salt = new Uint8Array(share.length + this.recipient.length);
    salt.set(share);
    salt.set(this.recipient, share.length);
    const label2 = new TextEncoder().encode("age-encryption.org/v1/X25519");
    const key = hkdf(sha256, secret, salt, label2, 32);
    return [new Stanza(["X25519", base64nopad.encode(share)], encryptFileKey(fileKey, key))];
  }
};
var X25519Identity = class {
  identity;
  recipient;
  constructor(s) {
    if (isCryptoKey2(s)) {
      this.identity = s;
      this.recipient = scalarMultBase(s);
      return;
    }
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("AGE-SECRET-KEY-1") || res.prefix.toUpperCase() !== "AGE-SECRET-KEY-" || res.bytes.length !== 32) {
      throw Error("invalid identity");
    }
    this.identity = res.bytes;
    this.recipient = scalarMultBase(res.bytes);
  }
  async unwrapFileKey(stanzas) {
    for (const s of stanzas) {
      if (s.args.length < 1 || s.args[0] !== "X25519") {
        continue;
      }
      if (s.args.length !== 2) {
        throw Error("invalid X25519 stanza");
      }
      const share = base64nopad.decode(s.args[1]);
      if (share.length !== 32) {
        throw Error("invalid X25519 stanza");
      }
      const secret = await scalarMult(this.identity, share);
      const recipient = await this.recipient;
      const salt = new Uint8Array(share.length + recipient.length);
      salt.set(share);
      salt.set(recipient, share.length);
      const label2 = new TextEncoder().encode("age-encryption.org/v1/X25519");
      const key = hkdf(sha256, secret, salt, label2, 32);
      const fileKey = decryptFileKey(s.body, key);
      if (fileKey !== null)
        return fileKey;
    }
    return null;
  }
};
var ScryptRecipient = class {
  passphrase;
  logN;
  constructor(passphrase, logN) {
    this.passphrase = passphrase;
    this.logN = logN;
  }
  wrapFileKey(fileKey) {
    const salt = randomBytes(16);
    const label2 = "age-encryption.org/v1/scrypt";
    const labelAndSalt = new Uint8Array(label2.length + 16);
    labelAndSalt.set(new TextEncoder().encode(label2));
    labelAndSalt.set(salt, label2.length);
    const key = scrypt(this.passphrase, labelAndSalt, { N: 2 ** this.logN, r: 8, p: 1, dkLen: 32 });
    return [new Stanza(["scrypt", base64nopad.encode(salt), this.logN.toString()], encryptFileKey(fileKey, key))];
  }
};
var ScryptIdentity = class {
  passphrase;
  constructor(passphrase) {
    this.passphrase = passphrase;
  }
  unwrapFileKey(stanzas) {
    for (const s of stanzas) {
      if (s.args.length < 1 || s.args[0] !== "scrypt") {
        continue;
      }
      if (stanzas.length !== 1) {
        throw Error("scrypt recipient is not the only one in the header");
      }
      if (s.args.length !== 3) {
        throw Error("invalid scrypt stanza");
      }
      if (!/^[1-9][0-9]*$/.test(s.args[2])) {
        throw Error("invalid scrypt stanza");
      }
      const salt = base64nopad.decode(s.args[1]);
      if (salt.length !== 16) {
        throw Error("invalid scrypt stanza");
      }
      const logN = Number(s.args[2]);
      if (logN > 20) {
        throw Error("scrypt work factor is too high");
      }
      const label2 = "age-encryption.org/v1/scrypt";
      const labelAndSalt = new Uint8Array(label2.length + 16);
      labelAndSalt.set(new TextEncoder().encode(label2));
      labelAndSalt.set(salt, label2.length);
      const key = scrypt(this.passphrase, labelAndSalt, { N: 2 ** logN, r: 8, p: 1, dkLen: 32 });
      const fileKey = decryptFileKey(s.body, key);
      if (fileKey !== null)
        return fileKey;
    }
    return null;
  }
};
function encryptFileKey(fileKey, key) {
  const nonce = new Uint8Array(12);
  return chacha20poly1305(key, nonce).encrypt(fileKey);
}
function decryptFileKey(body, key) {
  if (body.length !== 32) {
    throw Error("invalid stanza");
  }
  const nonce = new Uint8Array(12);
  try {
    return chacha20poly1305(key, nonce).decrypt(body);
  } catch {
    return null;
  }
}
function isCryptoKey2(key) {
  return typeof CryptoKey !== "undefined" && key instanceof CryptoKey;
}

// node_modules/age-encryption/dist/stream.js
var chacha20poly1305Overhead = 16;
var chunkSize = /* @__PURE__ */ (() => 64 * 1024)();
var chunkSizeWithOverhead = /* @__PURE__ */ (() => chunkSize + chacha20poly1305Overhead)();
function decryptSTREAM(key) {
  const streamNonce = new Uint8Array(12);
  const incNonce = () => {
    for (let i = streamNonce.length - 2; i >= 0; i--) {
      streamNonce[i]++;
      if (streamNonce[i] !== 0)
        break;
    }
  };
  let firstChunk = true;
  const ciphertextBuffer = new Uint8Array(chunkSizeWithOverhead);
  let ciphertextBufferUsed = 0;
  return new TransformStream({
    transform(chunk, controller) {
      while (chunk.length > 0) {
        if (ciphertextBufferUsed === ciphertextBuffer.length) {
          const decryptedChunk = chacha20poly1305(key, streamNonce).decrypt(ciphertextBuffer);
          controller.enqueue(decryptedChunk);
          incNonce();
          ciphertextBufferUsed = 0;
          firstChunk = false;
        }
        const n = Math.min(ciphertextBuffer.length - ciphertextBufferUsed, chunk.length);
        ciphertextBuffer.set(chunk.subarray(0, n), ciphertextBufferUsed);
        ciphertextBufferUsed += n;
        chunk = chunk.subarray(n);
      }
    },
    flush(controller) {
      streamNonce[11] = 1;
      const decryptedChunk = chacha20poly1305(key, streamNonce).decrypt(ciphertextBuffer.subarray(0, ciphertextBufferUsed));
      if (!firstChunk && decryptedChunk.length === 0) {
        throw new Error("final chunk is empty");
      }
      controller.enqueue(decryptedChunk);
    }
  });
}
function plaintextSize(ciphertextSize2) {
  if (ciphertextSize2 < chacha20poly1305Overhead) {
    throw Error("ciphertext is too small");
  }
  if (ciphertextSize2 === chacha20poly1305Overhead) {
    return 0;
  }
  const fullChunks = Math.floor(ciphertextSize2 / chunkSizeWithOverhead);
  const lastChunk = ciphertextSize2 % chunkSizeWithOverhead;
  if (0 < lastChunk && lastChunk <= chacha20poly1305Overhead) {
    throw Error("ciphertext size is invalid");
  }
  let size = ciphertextSize2;
  size -= fullChunks * chacha20poly1305Overhead;
  size -= lastChunk > 0 ? chacha20poly1305Overhead : 0;
  return size;
}
function encryptSTREAM(key) {
  const streamNonce = new Uint8Array(12);
  const incNonce = () => {
    for (let i = streamNonce.length - 2; i >= 0; i--) {
      streamNonce[i]++;
      if (streamNonce[i] !== 0)
        break;
    }
  };
  const plaintextBuffer = new Uint8Array(chunkSize);
  let plaintextBufferUsed = 0;
  return new TransformStream({
    transform(chunk, controller) {
      while (chunk.length > 0) {
        if (plaintextBufferUsed === plaintextBuffer.length) {
          const encryptedChunk = chacha20poly1305(key, streamNonce).encrypt(plaintextBuffer);
          controller.enqueue(encryptedChunk);
          incNonce();
          plaintextBufferUsed = 0;
        }
        const n = Math.min(plaintextBuffer.length - plaintextBufferUsed, chunk.length);
        plaintextBuffer.set(chunk.subarray(0, n), plaintextBufferUsed);
        plaintextBufferUsed += n;
        chunk = chunk.subarray(n);
      }
    },
    flush(controller) {
      streamNonce[11] = 1;
      const encryptedChunk = chacha20poly1305(key, streamNonce).encrypt(plaintextBuffer.subarray(0, plaintextBufferUsed));
      controller.enqueue(encryptedChunk);
    }
  });
}
function ciphertextSize(plaintextSize2) {
  const chunks = Math.max(1, Math.ceil(plaintextSize2 / chunkSize));
  return plaintextSize2 + chacha20poly1305Overhead * chunks;
}

// node_modules/age-encryption/dist/armor.js
var armor_exports = {};
__export(armor_exports, {
  decode: () => decode,
  encode: () => encode
});
function encode(file) {
  const lines = [];
  lines.push("-----BEGIN AGE ENCRYPTED FILE-----\n");
  for (let i = 0; i < file.length; i += 48) {
    let end = i + 48;
    if (end > file.length)
      end = file.length;
    lines.push(base64.encode(file.subarray(i, end)) + "\n");
  }
  lines.push("-----END AGE ENCRYPTED FILE-----\n");
  return lines.join("");
}
function decode(file) {
  const lines = file.trim().replaceAll("\r\n", "\n").split("\n");
  if (lines.shift() !== "-----BEGIN AGE ENCRYPTED FILE-----") {
    throw Error("invalid header");
  }
  if (lines.pop() !== "-----END AGE ENCRYPTED FILE-----") {
    throw Error("invalid footer");
  }
  function isLineLengthValid(i, l) {
    if (i === lines.length - 1) {
      return l.length > 0 && l.length <= 64 && l.length % 4 === 0;
    }
    return l.length === 64;
  }
  if (!lines.every((l, i) => isLineLengthValid(i, l))) {
    throw Error("invalid line length");
  }
  if (!lines.every((l) => /^[A-Za-z0-9+/=]+$/.test(l))) {
    throw Error("invalid base64");
  }
  return base64.decode(lines.join(""));
}

// node_modules/age-encryption/dist/webauthn.js
var webauthn_exports = {};
__export(webauthn_exports, {
  WebAuthnIdentity: () => WebAuthnIdentity,
  WebAuthnRecipient: () => WebAuthnRecipient,
  createCredential: () => createCredential
});

// node_modules/age-encryption/dist/cbor.js
function readTypeAndArgument(b) {
  if (b.length === 0) {
    throw Error("cbor: unexpected EOF");
  }
  const major = b[0] >> 5;
  const minor = b[0] & 31;
  if (minor <= 23) {
    return [major, minor, b.subarray(1)];
  }
  if (minor === 24) {
    if (b.length < 2) {
      throw Error("cbor: unexpected EOF");
    }
    return [major, b[1], b.subarray(2)];
  }
  if (minor === 25) {
    if (b.length < 3) {
      throw Error("cbor: unexpected EOF");
    }
    return [major, b[1] << 8 | b[2], b.subarray(3)];
  }
  throw Error("cbor: unsupported argument encoding");
}
function readUint(b) {
  const [major, minor, rest] = readTypeAndArgument(b);
  if (major !== 0) {
    throw Error("cbor: expected unsigned integer");
  }
  return [minor, rest];
}
function readByteString(b) {
  const [major, minor, rest] = readTypeAndArgument(b);
  if (major !== 2) {
    throw Error("cbor: expected byte string");
  }
  if (minor > rest.length) {
    throw Error("cbor: unexpected EOF");
  }
  return [rest.subarray(0, minor), rest.subarray(minor)];
}
function readTextString(b) {
  const [major, minor, rest] = readTypeAndArgument(b);
  if (major !== 3) {
    throw Error("cbor: expected text string");
  }
  if (minor > rest.length) {
    throw Error("cbor: unexpected EOF");
  }
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  return [decoder.decode(rest.subarray(0, minor)), rest.subarray(minor)];
}
function readArray(b) {
  const [major, minor, r] = readTypeAndArgument(b);
  if (major !== 4) {
    throw Error("cbor: expected array");
  }
  let rest = r;
  const args = [];
  for (let i = 0; i < minor; i++) {
    let arg;
    [arg, rest] = readTextString(rest);
    args.push(arg);
  }
  return [args, rest];
}
function encodeUint(n) {
  if (n <= 23) {
    return new Uint8Array([n]);
  }
  if (n <= 255) {
    return new Uint8Array([24, n]);
  }
  if (n <= 65535) {
    return new Uint8Array([25, n >> 8, n & 255]);
  }
  throw Error("cbor: unsigned integer too large");
}
function encodeByteString(b) {
  if (b.length <= 23) {
    return new Uint8Array([2 << 5 | b.length, ...b]);
  }
  if (b.length <= 255) {
    return new Uint8Array([2 << 5 | 24, b.length, ...b]);
  }
  if (b.length <= 65535) {
    return new Uint8Array([2 << 5 | 25, b.length >> 8, b.length & 255, ...b]);
  }
  throw Error("cbor: byte string too long");
}
function encodeTextString(s) {
  const b = new TextEncoder().encode(s);
  if (b.length <= 23) {
    return new Uint8Array([3 << 5 | b.length, ...b]);
  }
  if (b.length <= 255) {
    return new Uint8Array([3 << 5 | 24, b.length, ...b]);
  }
  if (b.length <= 65535) {
    return new Uint8Array([3 << 5 | 25, b.length >> 8, b.length & 255, ...b]);
  }
  throw Error("cbor: text string too long");
}
function encodeArray(args) {
  const body = args.flatMap((x) => [...encodeTextString(x)]);
  if (args.length <= 23) {
    return new Uint8Array([4 << 5 | args.length, ...body]);
  }
  if (args.length <= 255) {
    return new Uint8Array([4 << 5 | 24, args.length, ...body]);
  }
  if (args.length <= 65535) {
    return new Uint8Array([4 << 5 | 25, args.length >> 8, args.length & 255, ...body]);
  }
  throw Error("cbor: array too long");
}

// node_modules/age-encryption/dist/webauthn.js
var defaultAlgorithms = [
  { type: "public-key", alg: -8 },
  // Ed25519
  { type: "public-key", alg: -7 },
  // ECDSA with P-256 and SHA-256
  { type: "public-key", alg: -257 }
  // RSA PKCS#1 v1.5 with SHA-256
];
async function createCredential(options) {
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: "", id: options.rpId },
      user: {
        name: options.keyName,
        id: domBuffer2(randomBytes(8)),
        // avoid overwriting existing keys
        displayName: ""
      },
      pubKeyCredParams: defaultAlgorithms,
      authenticatorSelection: {
        requireResidentKey: options.type !== "security-key",
        residentKey: options.type !== "security-key" ? "required" : "discouraged",
        userVerification: "required"
        // prf requires UV
      },
      hints: options.type === "security-key" ? ["security-key"] : [],
      extensions: { prf: {} },
      challenge: new Uint8Array([0]).buffer
      // unused without attestation
    }
  });
  if (!cred.getClientExtensionResults().prf?.enabled) {
    throw Error("PRF extension not available (need macOS 15+, Chrome 132+)");
  }
  const rpId = options.rpId ?? new URL(window.origin).hostname;
  return encodeIdentity(cred, rpId);
}
var prefix = "AGE-PLUGIN-FIDO2PRF-";
function encodeIdentity(credential, rpId) {
  const res = credential.response;
  const version = encodeUint(1);
  const credId = encodeByteString(new Uint8Array(credential.rawId));
  const rp = encodeTextString(rpId);
  const transports = encodeArray(res.getTransports());
  const identityData = new Uint8Array([...version, ...credId, ...rp, ...transports]);
  return bech32.encode(prefix, bech32.toWords(identityData), false).toUpperCase();
}
function decodeIdentity(identity) {
  const res = bech32.decodeToBytes(identity);
  if (!identity.startsWith(prefix + "1")) {
    throw Error("invalid identity");
  }
  const [version, rest1] = readUint(res.bytes);
  if (version !== 1) {
    throw Error("unsupported identity version");
  }
  const [credId, rest2] = readByteString(rest1);
  const [rpId, rest3] = readTextString(rest2);
  const [transports] = readArray(rest3);
  return [credId, rpId, transports];
}
var label = "age-encryption.org/fido2prf";
var WebAuthnInternal = class {
  credId;
  transports;
  rpId;
  constructor(options) {
    if (options?.identity) {
      const [credId, rpId, transports] = decodeIdentity(options.identity);
      this.credId = credId;
      this.transports = transports;
      this.rpId = rpId;
    } else {
      this.rpId = options?.rpId;
    }
  }
  async getCredential(nonce) {
    const assertion = await navigator.credentials.get({
      publicKey: {
        allowCredentials: this.credId ? [{
          id: domBuffer2(this.credId),
          transports: this.transports,
          type: "public-key"
        }] : [],
        challenge: domBuffer2(randomBytes(16)),
        extensions: { prf: { eval: prfInputs(nonce) } },
        userVerification: "required",
        // prf requires UV
        rpId: this.rpId
      }
    });
    const results = assertion.getClientExtensionResults().prf?.results;
    if (results === void 0) {
      throw Error("PRF extension not available (need macOS 15+, Chrome 132+)");
    }
    return results;
  }
};
var WebAuthnRecipient = class extends WebAuthnInternal {
  /**
   * Implements {@link Recipient.wrapFileKey}.
   */
  async wrapFileKey(fileKey) {
    const nonce = randomBytes(16);
    const results = await this.getCredential(nonce);
    const key = deriveKey(results);
    return [new Stanza([label, base64nopad.encode(nonce)], encryptFileKey(fileKey, key))];
  }
};
var WebAuthnIdentity = class extends WebAuthnInternal {
  /**
   * Implements {@link Identity.unwrapFileKey}.
   */
  async unwrapFileKey(stanzas) {
    for (const s of stanzas) {
      if (s.args.length < 1 || s.args[0] !== label) {
        continue;
      }
      if (s.args.length !== 2) {
        throw Error("invalid prf stanza");
      }
      const nonce = base64nopad.decode(s.args[1]);
      if (nonce.length !== 16) {
        throw Error("invalid prf stanza");
      }
      const results = await this.getCredential(nonce);
      const key = deriveKey(results);
      const fileKey = decryptFileKey(s.body, key);
      if (fileKey !== null)
        return fileKey;
    }
    return null;
  }
};
function prfInputs(nonce) {
  const prefix2 = new TextEncoder().encode(label);
  const first = new Uint8Array(prefix2.length + nonce.length + 1);
  first.set(prefix2, 0);
  first[prefix2.length] = 1;
  first.set(nonce, prefix2.length + 1);
  const second = new Uint8Array(prefix2.length + nonce.length + 1);
  second.set(prefix2, 0);
  second[prefix2.length] = 2;
  second.set(nonce, prefix2.length + 1);
  return { first, second };
}
function deriveKey(results) {
  if (results.second === void 0) {
    throw Error("Missing second PRF result");
  }
  const prf = new Uint8Array(results.first.byteLength + results.second.byteLength);
  prf.set(new Uint8Array(results.first), 0);
  prf.set(new Uint8Array(results.second), results.first.byteLength);
  return extract(sha256, prf, new TextEncoder().encode(label));
}
function domBuffer2(arr) {
  return arr;
}

// node_modules/age-encryption/dist/index.js
var Encrypter = class {
  passphrase = null;
  scryptWorkFactor = 18;
  recipients = [];
  /**
   * Set the passphrase to encrypt the file(s) with. This method can only be
   * called once, and can't be called if {@link Encrypter.addRecipient} has
   * been called.
   *
   * The passphrase is passed through the scrypt key derivation function, but
   * it needs to have enough entropy to resist offline brute-force attacks.
   * You should use at least 8-10 random alphanumeric characters, or 4-5
   * random words from a list of at least 2000 words.
   *
   * @param s - The passphrase to encrypt the file with.
   */
  setPassphrase(s) {
    if (this.passphrase !== null) {
      throw new Error("can encrypt to at most one passphrase");
    }
    if (this.recipients.length !== 0) {
      throw new Error("can't encrypt to both recipients and passphrases");
    }
    this.passphrase = s;
  }
  /**
   * Set the scrypt work factor to use when encrypting the file(s) with a
   * passphrase. The default is 18. Using a lower value will require stronger
   * passphrases to resist offline brute-force attacks.
   *
   * @param logN - The base-2 logarithm of the scrypt work factor.
   */
  setScryptWorkFactor(logN) {
    this.scryptWorkFactor = logN;
  }
  /**
   * Add a recipient to encrypt the file(s) for. This method can be called
   * multiple times to encrypt the file(s) for multiple recipients.
   *
   * This version supports native X25519 recipients (`age1...`), hybrid
   * post-quantum recipients (`age1pq1...`), tag recipients (`age1tag1...`),
   * and hybrid tag recipients (`age1tagpq1...`).
   *
   * @param s - The recipient to encrypt the file for. Either a string
   * beginning with `age1...` or an object implementing the {@link Recipient}
   * interface.
   */
  addRecipient(s) {
    if (this.passphrase !== null) {
      throw new Error("can't encrypt to both recipients and passphrases");
    }
    if (typeof s === "string") {
      if (s.startsWith("age1pq1")) {
        this.recipients.push(new HybridRecipient(s));
      } else if (s.startsWith("age1tag1")) {
        this.recipients.push(new TagRecipient(s));
      } else if (s.startsWith("age1tagpq1")) {
        this.recipients.push(new HybridTagRecipient(s));
      } else if (s.startsWith("age1")) {
        this.recipients.push(new X25519Recipient(s));
      } else {
        throw new Error("unrecognized recipient type");
      }
    } else {
      this.recipients.push(s);
    }
  }
  async encrypt(file) {
    const fileKey = randomBytes(16);
    const stanzas = [];
    let recipients = this.recipients;
    if (this.passphrase !== null) {
      recipients = [new ScryptRecipient(this.passphrase, this.scryptWorkFactor)];
    }
    for (const recipient of recipients) {
      stanzas.push(...await recipient.wrapFileKey(fileKey));
    }
    const labelHeader = new TextEncoder().encode("header");
    const hmacKey = hkdf(sha256, fileKey, void 0, labelHeader, 32);
    const mac = hmac(sha256, hmacKey, encodeHeaderNoMAC(stanzas));
    const header = encodeHeader(stanzas, mac);
    const nonce = randomBytes(16);
    const labelPayload = new TextEncoder().encode("payload");
    const streamKey = hkdf(sha256, fileKey, nonce, labelPayload, 32);
    const encrypter = encryptSTREAM(streamKey);
    if (!(file instanceof ReadableStream)) {
      if (typeof file === "string")
        file = new TextEncoder().encode(file);
      return await readAll(prepend(stream(file).pipeThrough(encrypter), header, nonce));
    }
    return Object.assign(prepend(file.pipeThrough(encrypter), header, nonce), {
      size: (size) => ciphertextSize(size) + header.length + nonce.length
    });
  }
};
var Decrypter = class {
  identities = [];
  /**
   * Add a passphrase to decrypt password-encrypted file(s) with. This method
   * can be called multiple times to try multiple passphrases.
   *
   * @param s - The passphrase to decrypt the file with.
   */
  addPassphrase(s) {
    this.identities.push(new ScryptIdentity(s));
  }
  /**
   * Add an identity to decrypt file(s) with. This method can be called
   * multiple times to try multiple identities.
   *
   * @param s - The identity to decrypt the file with. Either a string
   * beginning with `AGE-SECRET-KEY-PQ-1...` or `AGE-SECRET-KEY-1...`, an
   * X25519 private
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey | CryptoKey}
   * object, or an object implementing the {@link Identity} interface.
   *
   * A CryptoKey object must have
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/type | type}
   * `private`,
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/algorithm | algorithm}
   * `{name: 'X25519'}`, and
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/usages | usages}
   * `["deriveBits"]`. For example:
   * ```js
   * const keyPair = await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"])
   * decrypter.addIdentity(key.privateKey)
   * ```
   */
  addIdentity(s) {
    if (isCryptoKey3(s)) {
      this.identities.push(new X25519Identity(s));
    } else if (typeof s === "string") {
      if (s.startsWith("AGE-SECRET-KEY-1")) {
        this.identities.push(new X25519Identity(s));
      } else if (s.startsWith("AGE-SECRET-KEY-PQ-1")) {
        this.identities.push(new HybridIdentity(s));
      } else {
        throw new Error("unrecognized identity type");
      }
    } else {
      this.identities.push(s);
    }
  }
  async decrypt(file, outputFormat) {
    const s = file instanceof ReadableStream ? file : stream(file);
    const { fileKey, headerSize, rest } = await this.decryptHeaderInternal(s);
    const { data: nonce, rest: payload } = await read(rest, 16);
    const label2 = new TextEncoder().encode("payload");
    const streamKey = hkdf(sha256, fileKey, nonce, label2, 32);
    const decrypter = decryptSTREAM(streamKey);
    const out = payload.pipeThrough(decrypter);
    const outWithSize = Object.assign(out, {
      size: (size) => plaintextSize(size - headerSize - nonce.length)
    });
    if (file instanceof ReadableStream)
      return outWithSize;
    if (outputFormat === "text")
      return await readAllString(out);
    return await readAll(out);
  }
  /**
   * Decrypt the file key from a detached header. This is a low-level
   * function that can be used to implement delegated decryption logic.
   * Most users won't need this.
   *
   * It is the caller's responsibility to keep track of what file the
   * returned file key decrypts, and to ensure the file key is not used
   * for any other purpose.
   *
   * @param header - The file's textual header, including the MAC.
   *
   * @returns The file key used to encrypt the file.
   */
  async decryptHeader(header) {
    return (await this.decryptHeaderInternal(stream(header))).fileKey;
  }
  async decryptHeaderInternal(file) {
    const h = await parseHeader(file);
    const fileKey = await this.unwrapFileKey(h.stanzas);
    if (fileKey === null)
      throw Error("no identity matched any of the file's recipients");
    const label2 = new TextEncoder().encode("header");
    const hmacKey = hkdf(sha256, fileKey, void 0, label2, 32);
    const mac = hmac(sha256, hmacKey, h.headerNoMAC);
    if (!compareBytes(h.MAC, mac))
      throw Error("invalid header HMAC");
    return { fileKey, headerSize: h.headerSize, rest: h.rest };
  }
  async unwrapFileKey(stanzas) {
    for (const identity of this.identities) {
      const fileKey = await identity.unwrapFileKey(stanzas);
      if (fileKey !== null)
        return fileKey;
    }
    return null;
  }
};
function compareBytes(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let acc = 0;
  for (let i = 0; i < a.length; i++) {
    acc |= a[i] ^ b[i];
  }
  return acc === 0;
}
function isCryptoKey3(key) {
  return typeof CryptoKey !== "undefined" && key instanceof CryptoKey;
}
export {
  Decrypter,
  Encrypter,
  Stanza,
  armor_exports as armor,
  generateHybridIdentity,
  generateIdentity,
  generateX25519Identity,
  identityToRecipient,
  webauthn_exports as webauthn
};
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@scure/base/index.js:
  (*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/ciphers/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/montgomery.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/ed25519.js:
@noble/curves/nist.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/post-quantum/utils.js:
@noble/post-quantum/_crystals.js:
@noble/post-quantum/ml-kem.js:
@noble/post-quantum/hybrid.js:
  (*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) *)
*/
