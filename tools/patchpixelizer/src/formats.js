// File writers: Paint.NET (.pdn), Photoshop (.psd), PNG.
// The .pdn layout mirrors files saved by Paint.NET 5.1 (PDN3 header + .NET
// BinaryFormatter object graph + gzip-chunked BGRA pixel data).

const PDN_VERSION = [5, 111, 9445, 2548];
const PDN_VERSION_STR = PDN_VERSION.join('.');
const KVP_ARRAY_TYPE =
  'System.Collections.Generic.KeyValuePair`2[[System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089],[System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089]]';

class ByteWriter {
  constructor() { this.parts = []; this.len = 0; }
  bytes(arr) { const u = arr instanceof Uint8Array ? arr : Uint8Array.from(arr); this.parts.push(u); this.len += u.length; return this; }
  u8(v) { return this.bytes([v & 0xff]); }
  bool(v) { return this.u8(v ? 1 : 0); }
  i16le(v) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v, true); return this.bytes(b); }
  i32le(v) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, true); return this.bytes(b); }
  i64le(v) { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(v), true); return this.bytes(b); }
  u16be(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, false); return this.bytes(b); }
  i16be(v) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v, false); return this.bytes(b); }
  u32be(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, false); return this.bytes(b); }
  i32be(v) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, false); return this.bytes(b); }
  ascii(s) { return this.bytes([...s].map((c) => c.charCodeAt(0))); }
  // .NET length-prefixed UTF-8 string (7-bit varint length)
  lps(s) {
    const enc = new TextEncoder().encode(s);
    let n = enc.length;
    const pre = [];
    do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; pre.push(b); } while (n);
    return this.bytes(pre).bytes(enc);
  }
  toBytes() {
    const out = new Uint8Array(this.len);
    let o = 0;
    for (const p of this.parts) { out.set(p, o); o += p.length; }
    return out;
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) { a = (a + buf[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

// Raw deflate using "stored" (uncompressed) blocks: tiny images, so no need for real compression.
function deflateStored(data) {
  const w = new ByteWriter();
  if (data.length === 0) return w.bytes([1, 0, 0, 0xff, 0xff]).toBytes();
  for (let o = 0; o < data.length; o += 65535) {
    const chunk = data.subarray(o, Math.min(o + 65535, data.length));
    const final = o + 65535 >= data.length ? 1 : 0;
    const n = chunk.length;
    w.bytes([final, n & 0xff, n >> 8, ~n & 0xff, (~n >> 8) & 0xff]).bytes(chunk);
  }
  return w.toBytes();
}
function gzip(data) {
  const w = new ByteWriter();
  w.bytes([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff]).bytes(deflateStored(data));
  const tail = new Uint8Array(8);
  const dv = new DataView(tail.buffer);
  dv.setUint32(0, crc32(data), true);
  dv.setUint32(4, data.length, true);
  return w.bytes(tail).toBytes();
}
function zlibStored(data) {
  const w = new ByteWriter();
  w.bytes([0x78, 0x01]).bytes(deflateStored(data)).u32be(adler32(data));
  return w.toBytes();
}

// rgba: Uint8ClampedArray/Uint8Array, length w*h*4, non-premultiplied RGBA
export function encodePNG(rgba, width, height) {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const w = new ByteWriter();
  const chunk = (type, body) => {
    const t = new TextEncoder().encode(type);
    const both = new Uint8Array(t.length + body.length);
    both.set(t); both.set(body, t.length);
    w.u32be(body.length).bytes(both).u32be(crc32(both));
  };
  w.bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new ByteWriter().u32be(width).u32be(height).bytes([8, 6, 0, 0, 0]).toBytes();
  chunk('IHDR', ihdr);
  chunk('IDAT', zlibStored(raw));
  chunk('IEND', new Uint8Array(0));
  return w.toBytes();
}

function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// layers: [{ name, rgba }] bottom-to-top, each rgba length width*height*4
export function encodePDN(layers, width, height) {
  const w = new ByteWriter();

  // --- XML header ---
  const flat = flatten(layers, width, height);
  const thumb = base64(encodePNG(flat, width, height));
  const xml = `<pdnImage width="${width}" height="${height}" layers="${layers.length}" savedWithVersion="${PDN_VERSION_STR}"><custom><thumb png="${thumb}" /></custom></pdnImage>`;
  const xmlBytes = new TextEncoder().encode(xml);
  w.ascii('PDN3');
  w.bytes([xmlBytes.length & 0xff, (xmlBytes.length >> 8) & 0xff, (xmlBytes.length >> 16) & 0xff]);
  w.bytes(xmlBytes);
  w.bytes([0x00, 0x01]);

  // --- BinaryFormatter (NRBF) object graph ---
  const DATA_LIB = 2, CORE_LIB = 3;
  const DOC = 1, LAYERLIST = 4, VERSION = 5, DOC_META = 6, ITEMS = 7;
  let nextId = 8;
  const L = layers.map(() => {
    const ids = { layer: nextId, blProps: nextId + 1, surface: nextId + 2, props: nextId + 3, blendOp: nextId + 4, mem: nextId + 5, name: nextId + 6, meta: nextId + 7, blendMode: -(nextId + 8) };
    nextId += 9;
    return ids;
  });

  const classHeader = (rt, id, name, members, lib) => {
    w.u8(rt).i32le(id).lps(name).i32le(members.length);
    for (const [n] of members) w.lps(n);
    for (const [, t] of members) w.u8(t.bt);
    for (const [, t] of members) {
      if (t.bt === 0 || t.bt === 7) w.u8(t.prim);
      else if (t.bt === 3) w.lps(t.cls);
      else if (t.bt === 4) w.lps(t.cls).i32le(t.lib);
    }
    if (rt === 5) w.i32le(lib);
  };
  const P = (prim) => ({ bt: 0, prim });
  const BOOL = P(1), BYTE = P(2), I32 = P(8), I64 = P(9);
  const CLS = (cls, lib) => ({ bt: 4, cls, lib });
  const SYS = (cls) => ({ bt: 3, cls });
  const STR = { bt: 1 }, OBJARR = { bt: 5 };
  const ref = (id) => w.u8(9).i32le(id);
  const emptyKvpArray = (id) => w.u8(7).i32le(id).u8(0).i32le(1).i32le(0).u8(3).lps(KVP_ARRAY_TYPE);

  w.u8(0).i32le(1).i32le(-1).i32le(1).i32le(0); // stream header
  w.u8(12).i32le(DATA_LIB).lps(`PaintDotNet.Data, Version=${PDN_VERSION_STR}, Culture=neutral, PublicKeyToken=null`);

  classHeader(5, DOC, 'PaintDotNet.Document', [
    ['isDisposed', BOOL], ['layers', CLS('PaintDotNet.LayerList', DATA_LIB)], ['width', I32], ['height', I32],
    ['savedWith', SYS('System.Version')], ['userMetadataItems', SYS(KVP_ARRAY_TYPE + '[]')],
  ], DATA_LIB);
  w.bool(false); ref(LAYERLIST); w.i32le(width).i32le(height); ref(VERSION); ref(DOC_META);

  classHeader(5, LAYERLIST, 'PaintDotNet.LayerList', [
    ['parent', CLS('PaintDotNet.Document', DATA_LIB)], ['ArrayList+_items', OBJARR], ['ArrayList+_size', I32], ['ArrayList+_version', I32],
  ], DATA_LIB);
  ref(DOC); ref(ITEMS); w.i32le(layers.length).i32le(layers.length);

  classHeader(4, VERSION, 'System.Version', [['_Major', I32], ['_Minor', I32], ['_Build', I32], ['_Revision', I32]]);
  for (const v of PDN_VERSION) w.i32le(v);

  emptyKvpArray(DOC_META);

  const cap = Math.max(4, layers.length);
  w.u8(16).i32le(ITEMS).i32le(cap);
  for (const ids of L) ref(ids.layer);
  if (cap > layers.length) w.u8(13).u8(cap - layers.length);

  w.u8(12).i32le(CORE_LIB).lps(`PaintDotNet.Core, Version=${PDN_VERSION_STR}, Culture=neutral, PublicKeyToken=null`);

  // first layer defines class metadata; later layers reference it with ClassWithId records
  const meta = {};
  const obj = (key, id, name, members, lib) => {
    if (meta[key]) { w.u8(1).i32le(id).i32le(meta[key]); return; }
    meta[key] = id;
    classHeader(5, id, name, members, lib);
  };
  layers.forEach((layer, i) => {
    const ids = L[i];
    obj('layer', ids.layer, 'PaintDotNet.BitmapLayer', [
      ['properties', CLS('PaintDotNet.BitmapLayer+BitmapLayerProperties', DATA_LIB)], ['surface', CLS('PaintDotNet.Surface', CORE_LIB)],
      ['Layer+isDisposed', BOOL], ['Layer+width', I32], ['Layer+height', I32], ['Layer+properties', CLS('PaintDotNet.Layer+LayerProperties', DATA_LIB)],
    ], DATA_LIB);
    ref(ids.blProps); ref(ids.surface); w.bool(false).i32le(width).i32le(height); ref(ids.props);

    obj('blProps', ids.blProps, 'PaintDotNet.BitmapLayer+BitmapLayerProperties', [['blendOp', CLS('PaintDotNet.UserBlendOps+NormalBlendOp', DATA_LIB)]], DATA_LIB);
    ref(ids.blendOp);

    obj('surface', ids.surface, 'PaintDotNet.Surface', [['width', I32], ['height', I32], ['stride', I32], ['scan0', CLS('PaintDotNet.MemoryBlock', CORE_LIB)]], CORE_LIB);
    w.i32le(width).i32le(height).i32le(width * 4); ref(ids.mem);

    obj('props', ids.props, 'PaintDotNet.Layer+LayerProperties', [
      ['name', STR], ['userMetadataItems', SYS(KVP_ARRAY_TYPE + '[]')], ['visible', BOOL], ['isBackground', BOOL], ['opacity', BYTE],
      ['blendMode', CLS('PaintDotNet.LayerBlendMode', DATA_LIB)],
    ], DATA_LIB);
    w.u8(6).i32le(ids.name).lps(layer.name);
    ref(ids.meta);
    w.bool(layer.visible !== false).bool(i === 0).u8(255);
    obj('blendMode', ids.blendMode, 'PaintDotNet.LayerBlendMode', [['value__', I32]], DATA_LIB);
    w.i32le(0);

    obj('blendOp', ids.blendOp, 'PaintDotNet.UserBlendOps+NormalBlendOp', [], DATA_LIB);

    obj('mem', ids.mem, 'PaintDotNet.MemoryBlock', [['length64', I64], ['hasParent', BOOL], ['deferred', BOOL]], CORE_LIB);
    w.i64le(width * height * 4).bool(false).bool(true);

    emptyKvpArray(ids.meta);
  });
  w.u8(11); // MessageEnd

  // --- deferred pixel data, one block per layer: BGRA, gzip chunks ---
  const CHUNK = 0x40000;
  for (const layer of layers) {
    const bgra = new Uint8Array(width * height * 4);
    for (let p = 0; p < bgra.length; p += 4) {
      bgra[p] = layer.rgba[p + 2]; bgra[p + 1] = layer.rgba[p + 1]; bgra[p + 2] = layer.rgba[p]; bgra[p + 3] = layer.rgba[p + 3];
    }
    w.u8(0).u32be(CHUNK);
    for (let o = 0, n = 0; o < bgra.length; o += CHUNK, n++) {
      const gz = gzip(bgra.subarray(o, Math.min(o + CHUNK, bgra.length)));
      w.u32be(n).u32be(gz.length).bytes(gz);
    }
  }
  return w.toBytes();
}

// layers: [{ name, rgba }] bottom-to-top
export function encodePSD(layers, width, height) {
  const w = new ByteWriter();
  w.ascii('8BPS').u16be(1).bytes([0, 0, 0, 0, 0, 0]).u16be(4).u32be(height).u32be(width).u16be(8).u16be(3);
  w.u32be(0); // color mode data
  w.u32be(0); // image resources

  const plane = (rgba, c) => {
    const out = new Uint8Array(width * height);
    for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4 + c];
    return out;
  };
  const li = new ByteWriter();
  li.i16be(-layers.length); // negative: merged image's first extra channel is transparency
  for (const layer of layers) {
    li.i32be(0).i32be(0).i32be(height).i32be(width).u16be(4);
    for (const id of [-1, 0, 1, 2]) li.i16be(id).u32be(2 + width * height);
    li.ascii('8BIM').ascii('norm').u8(255).u8(0).u8(layer.visible === false ? 2 : 0).u8(0);
    const name = new TextEncoder().encode(layer.name).subarray(0, 255);
    const nameLen = 1 + name.length;
    const pad = (4 - (nameLen % 4)) % 4;
    li.u32be(4 + 4 + nameLen + pad).u32be(0).u32be(0).u8(name.length).bytes(name).bytes(new Uint8Array(pad));
  }
  for (const layer of layers) {
    for (const c of [3, 0, 1, 2]) li.u16be(0).bytes(plane(layer.rgba, c));
  }
  if (li.len % 2) li.u8(0);
  const liBytes = li.toBytes();
  w.u32be(4 + liBytes.length + 4).u32be(liBytes.length).bytes(liBytes).u32be(0);

  const flat = flatten(layers, width, height);
  w.u16be(0);
  for (const c of [0, 1, 2, 3]) w.bytes(plane(flat, c));
  return w.toBytes();
}

function flatten(layers, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (const layer of layers) {
    if (layer.visible === false) continue;
    for (let p = 0; p < out.length; p += 4) {
      const a = layer.rgba[p + 3] / 255;
      if (!a) continue;
      const ba = out[p + 3] / 255;
      const oa = a + ba * (1 - a);
      for (let c = 0; c < 3; c++) out[p + c] = (layer.rgba[p + c] * a + out[p + c] * ba * (1 - a)) / oa;
      out[p + 3] = oa * 255;
    }
  }
  return out;
}
