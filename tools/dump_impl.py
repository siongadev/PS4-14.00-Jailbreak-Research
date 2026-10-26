#!/usr/bin/env python3
"""Dump and disassemble the ipmimgr_impl function at libSceIpmi RX+0x0208.
This is the target of `call e8 c1 ba ff ff` from the dispatch at 0x4742.
It receives (0x320, kid, &result, &params48, 0x30, passthrough) and
performs the actual syscall 622."""
import struct

RX = open(r'evidence\live\rx_0x833f00000_14.00.bin', 'rb').read()
BASE = 0x833F00000

def dump(start, end, label):
    print(f'\n=== {label}: RX+0x{start:x} .. RX+0x{end:x} ===')
    chunk = RX[start:end]
    for i in range(0, len(chunk), 16):
        row = chunk[i:i + 16]
        addr = BASE + start + i
        hexs = ' '.join(f'{b:02x}' for b in row)
        # Annotate known patterns
        ann = ''
        raw = bytes(row)
        if b'\x0f\x05' in raw:
            ann += ' ← SYSCALL'
        if b'\x6e\x02' in raw:
            ann += ' ← 622?'
        print(f'  {addr:012x}: {hexs}{ann}')

# The three call targets from the dispatch function
dump(0x0208, 0x0220, 'ipmimgr_impl entry (call target 1)')

# Also dump 0x0000-0x0220 for the full helper region
dump(0x0000, 0x0118, 'helper_region_start')

# Search for the actual syscall instruction (0x0f 0x05)
print('\n=== All syscall (0F 05) instructions in libSceIpmi ===')
idx = 0
count = 0
while True:
    idx = RX.find(b'\x0f\x05', idx)
    if idx < 0:
        break
    ctx = RX[max(0,idx-8):idx+8]
    print(f'  RX+0x{idx:x}: ...{ctx.hex()}...')
    count += 1
    idx += 1
print(f'  total: {count} syscall instructions')

# Search for mov rax, 622 (0x26e) — any encoding
print('\n=== mov rax, 622 (0x26e) patterns ===')
for pat_name, pat in [
    ('48 c7 c0 6e 02', 'mov rax, 0x26e (full 64-bit)'),
    ('b8 6e 02 00 00', 'mov eax, 0x26e (32-bit)'),
    ('6e 02 00 00', 'raw 6E 02 00 00'),
]:
    idx = 0
    while True:
        idx = RX.find(pat, idx)
        if idx < 0:
            break
        ctx = RX[max(0,idx-8):idx+16]
        print(f'  {pat_name}: RX+0x{idx:x}: {ctx.hex()}')
        idx += 1

# Look at 0x0208 more carefully — is it a valid function?
# Dump 0x0000 to 0x0300 fully
dump(0x0200, 0x0300, 'function_at_0x0208_region')
