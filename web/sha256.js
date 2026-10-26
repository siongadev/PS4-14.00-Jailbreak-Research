"use strict";

(function (root) {
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotateRight(value, count) {
    return (value >>> count) | (value << (32 - count));
  }

  // Encode Unicode scalar values as UTF-8. Lone surrogates become U+FFFD.
  function utf8Bytes(text) {
    var bytes = [];
    var i;
    var value;
    var next;
    if (typeof text !== "string") {
      throw new TypeError("SHA-256 input must be a string");
    }
    for (i = 0; i < text.length; i += 1) {
      value = text.charCodeAt(i);
      if (value >= 0xd800 && value <= 0xdbff) {
        next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
        if (next >= 0xdc00 && next <= 0xdfff) {
          value = 0x10000 + ((value - 0xd800) << 10) + (next - 0xdc00);
          i += 1;
        } else {
          value = 0xfffd;
        }
      } else if (value >= 0xdc00 && value <= 0xdfff) {
        value = 0xfffd;
      }
      if (value < 0x80) {
        bytes.push(value);
      } else if (value < 0x800) {
        bytes.push(0xc0 | (value >>> 6));
        bytes.push(0x80 | (value & 0x3f));
      } else if (value < 0x10000) {
        bytes.push(0xe0 | (value >>> 12));
        bytes.push(0x80 | ((value >>> 6) & 0x3f));
        bytes.push(0x80 | (value & 0x3f));
      } else {
        bytes.push(0xf0 | (value >>> 18));
        bytes.push(0x80 | ((value >>> 12) & 0x3f));
        bytes.push(0x80 | ((value >>> 6) & 0x3f));
        bytes.push(0x80 | (value & 0x3f));
      }
    }
    return bytes;
  }

  function wordHex(value) {
    return ("00000000" + (value >>> 0).toString(16)).slice(-8);
  }

  function hex(text) {
    var bytes = utf8Bytes(text);
    var bitLengthHigh = Math.floor(bytes.length / 0x20000000);
    var bitLengthLow = (bytes.length * 8) >>> 0;
    var state = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    var words = new Array(64);
    var offset;
    var i;
    var a;
    var b;
    var c;
    var d;
    var e;
    var f;
    var g;
    var h;
    var s0;
    var s1;
    var choice;
    var majority;
    var first;
    var second;

    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 3; i >= 0; i -= 1) bytes.push((bitLengthHigh >>> (i * 8)) & 0xff);
    for (i = 3; i >= 0; i -= 1) bytes.push((bitLengthLow >>> (i * 8)) & 0xff);

    for (offset = 0; offset < bytes.length; offset += 64) {
      for (i = 0; i < 16; i += 1) {
        words[i] = ((bytes[offset + i * 4] << 24) |
                    (bytes[offset + i * 4 + 1] << 16) |
                    (bytes[offset + i * 4 + 2] << 8) |
                    bytes[offset + i * 4 + 3]) >>> 0;
      }
      for (i = 16; i < 64; i += 1) {
        s0 = rotateRight(words[i - 15], 7) ^
             rotateRight(words[i - 15], 18) ^ (words[i - 15] >>> 3);
        s1 = rotateRight(words[i - 2], 17) ^
             rotateRight(words[i - 2], 19) ^ (words[i - 2] >>> 10);
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
      }

      a = state[0]; b = state[1]; c = state[2]; d = state[3];
      e = state[4]; f = state[5]; g = state[6]; h = state[7];
      for (i = 0; i < 64; i += 1) {
        s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        choice = (e & f) ^ (~e & g);
        first = (h + s1 + choice + K[i] + words[i]) >>> 0;
        s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        majority = (a & b) ^ (a & c) ^ (b & c);
        second = (s0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + first) >>> 0;
        d = c; c = b; b = a; a = (first + second) >>> 0;
      }
      state[0] = (state[0] + a) >>> 0;
      state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0;
      state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0;
      state[5] = (state[5] + f) >>> 0;
      state[6] = (state[6] + g) >>> 0;
      state[7] = (state[7] + h) >>> 0;
    }
    return state.map(wordHex).join("");
  }

  root.FW14_SHA256 = { hex: hex };
}(window));
