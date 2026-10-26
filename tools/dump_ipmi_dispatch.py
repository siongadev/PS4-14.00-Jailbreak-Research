#!/usr/bin/env python3
"""Dump and annotate the libSceIpmi dispatch function that constructs
the 0x320 (sync method invoke) ipmimgr_call."""
import struct

RX = open(r'evidence\live\rx_0x833f00000_14.00.bin', 'rb').read()
BASE = 0x833F00000

# The mov edi,0x320 is at +0x4719. The function prologue is somewhere
# before it. Search backward for push rbp (55 48 89 e5)
probe = 0x4719
fn_start = probe
for back in range(probe, probe - 0x200, -1):
    if RX[back:back+4] == b'\x55\x48\x89\xe5':
        fn_start = back
        break
print(f'Dispatch function starts at libIpmi RX+0x{fn_start:x}')

# Find the function end (ret = c3, or the next push rbp)
fn_end = probe + 0x200
for fwd in range(probe, min(probe + 0x200, len(RX))):
    if RX[fwd] == 0xc3:
        fn_end = fwd + 1
        break
print(f'  ends at ~RX+0x{fn_end:x} ({fn_end - fn_start} bytes)')

# Hex dump with 16-byte rows
print(f'\n--- Full dump RX+0x{fn_start:x} .. RX+0x{fn_end:x} ---')
chunk = RX[fn_start:fn_end]
for i in range(0, len(chunk), 16):
    row = chunk[i:i + 16]
    addr = BASE + fn_start + i
    hexs = ' '.join(f'{b:02x}' for b in row)
    print(f'  {addr:012x}: {hexs}')

# Find nearby syscall stub (rax=622 = 0x26e)
# Pattern: 48 c7 c0 6e 02 or b8 6e 02 00 00
for pat_name, pats in [
    ('mov rax,0x26e', [b'\x48\xc7\xc0\x6e\x02', b'\xb8\x6e\x02\x00\x00',
                        b'\x48\xc7\xc0\x6e\x02\x00\x00']),
    ('int 0x80 / syscall', [b'\x0f\x05', b'\xcd\x80']),
]:
    for pat in pats:
        idx = fn_start
        while idx < fn_end:
            idx = RX.find(pat, idx, fn_end + 64)
            if idx < 0:
                break
            print(f'  {pat_name} at RX+0x{idx:x}')
            ctx = RX[idx:idx+16]
            print(f'    {ctx.hex()}')
            idx += 1

# Also scan wider for syscall instructions near the function
print('\n--- Scanning wider for syscall stubs near dispatch ---')
for offset in range(fn_start - 0x200, min(fn_end + 0x200, len(RX)) - 8):
    if RX[offset:offset+7] == b'\x48\xc7\xc0\x6e\x02\x00\x00':
        ctx = RX[offset:offset+24]
        print(f'  syscall622 stub at RX+0x{offset:x}: {ctx.hex()}')
    if RX[offset:offset+5] == b'\xb8\x6e\x02\x00\x00':
        ctx = RX[offset:offset+16]
        print(f'  mov eax,622 at RX+0x{offset:x}: {ctx.hex()}')

# String references in the function (SceSysCoreApp etc.)
print('\n--- Service name strings in libSceIpmi ---')
for svc in [b'SceSysCoreApp\x00', b'SceSysCoreApp2\x00', b'SceLncService\x00',
            b'SceVshctl\x00']:
    idx = RX.find(svc)
    if idx >= 0:
        print(f'  {svc[:-1].decode()}: RX+0x{idx:x}')
