#!/usr/bin/env python3
"""Search libSceIpmi RX and libSceSysCore RO for the ipmimgr dispatch."""
import struct

BASE_IPMI = 0x833F00000
BASE_SYSRO = 0x81B348000

for path, base, label in [
    (r'evidence\live\rx_0x833f00000_14.00.bin', BASE_IPMI, 'libSceIpmi RX'),
    (r'evidence\live\ro_0x81b348000_14.00.bin', BASE_SYSRO, 'SysCore RO'),
]:
    data = open(path, 'rb').read()
    print(f'\n=== {label}: {len(data)} bytes at 0x{base:x} ===')

    # Search for 0x320 as various mov immediates
    for pat_name, pat in [
        ('mov edx,0x320', b'\xba\x20\x03\x00\x00'),
        ('mov esi,0x320', b'\xbe\x20\x03\x00\x00'),
        ('push 0x320', b'\x68\x20\x03\x00\x00'),
        ('mov ecx,0x320', b'\xb9\x20\x03\x00\x00'),
        ('mov edi,0x320', b'\xbf\x20\x03\x00\x00'),
        ('raw dword', b'\x20\x03\x00\x00'),
    ]:
        idx = 0
        hits = []
        while True:
            idx = data.find(pat, idx)
            if idx < 0:
                break
            hits.append(idx)
            idx += 1
        if hits:
            print(f'  {pat_name}: {len(hits)} hits')
            for h in hits[:5]:
                ctx = data[max(0,h-8):h+16]
                print(f'    RX+0x{h:x}: {ctx.hex()}')

    # Search for syscall 622 stub
    stub = b'\x48\xc7\xc0\x6e\x02\x00\x00'
    idx = 0
    while True:
        idx = data.find(stub, idx)
        if idx < 0:
            break
        print(f'  Syscall 622 at +0x{idx:x}')
        ctx = data[max(0,idx-16):idx+24]
        print(f'    context: {ctx.hex()}')
        idx += 1

    # Search for 'SceSysCore' string (vtable client name)
    s = data.find(b'SceSysCore')
    if s >= 0:
        print(f'  SceSysCore string at +0x{s:x}')
        ctx = data[s:s+64]
        print(f'    context: {ctx}')

# RO segment: the client global pointer at SysCore RX+0x801f
# = absolute 0x81B340000 + 0x801F = 0x81B34801F
# RO starts at 0x81B348000, so offset = 0x1F
ro = open(r'evidence\live\ro_0x81b348000_14.00.bin', 'rb').read()
off = 0x81B34801F - BASE_SYSRO
print(f'\n=== SysCore RO: client global at RO+0x{off:x} ===')
if 0 <= off < len(ro) - 8:
    val = struct.unpack('<Q', ro[off:off+8])[0]
    print(f'  value: 0x{val:016x}')
    if val:
        # The value is a runtime address — likely the client object
        print(f'  → runtime client object addr')
        # Can't resolve without the process memory, but we can note it
    # Also dump surroundings for the vtable
    for i in range(max(0,off-16), min(len(ro)-8, off+64), 8):
        v = struct.unpack('<Q', ro[i:i+8])[0]
        marker = ' ← global' if i == off else ''
        print(f'    RO+0x{i:x}: 0x{v:016x}{marker}')
