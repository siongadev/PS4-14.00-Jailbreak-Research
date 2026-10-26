#!/usr/bin/env python3
"""Find the ipmimgr dispatch wrapper in libSceSysCore RX by searching
for the syscall-622 stub and the 0x320/0x400 operation constants."""
import struct

RX_PATH = r'evidence\live\rx_0x81b340000_14.00.bin'
BASE = 0x81B340000
data = open(RX_PATH, 'rb').read()
print(f'RX image: {len(data)} bytes')

# 1. Search for syscall 622 stub: mov rax, 622; syscall (or call [rip+X])
# Standard wrapper: 48 c7 c0 6e 02 00 00 (mov rax, 0x26e)
syscall622 = b'\x48\xc7\xc0\x6e\x02\x00\x00'
idx = 0
while True:
    idx = data.find(syscall622, idx)
    if idx < 0:
        break
    print(f'Syscall 622 stub at RX+0x{idx:x}')
    # Dump surrounding code
    ctx = data[max(0,idx-16):idx+32]
    print(f'  context: {ctx.hex()}')
    idx += 1

# 2. Search for 0x320 as a 32-bit immediate in mov instructions
# mov edx, 0x320 = BA 20 03 00 00
# mov esi, 0x320 = BE 20 03 00 00
# mov edi, 0x320 = BF 20 03 00 00
# push 0x320 = 68 20 03 00 00
# cmp/mov with REX prefix: 41 BA 20 03 00 00 etc.
for pat_name, patterns in [
    ('mov edx,0x320', [b'\xba\x20\x03\x00\x00']),
    ('mov esi,0x320', [b'\xbe\x20\x03\x00\x00']),
    ('mov edi,0x320', [b'\xbf\x20\x03\x00\x00']),
    ('push 0x320', [b'\x68\x20\x03\x00\x00']),
    ('mov r8d,0x320', [b'\x41\xb8\x20\x03\x00\x00']),
    ('mov r9d,0x320', [b'\x41\xb9\x20\x03\x00\x00']),
    ('raw 20 03 00 00', [b'\x20\x03\x00\x00']),
    ('mov ecx,0x320', [b'\xb9\x20\x03\x00\x00']),
]:
    for pat in patterns:
        idx = 0
        hits = []
        while True:
            idx = data.find(pat, idx)
            if idx < 0:
                break
            hits.append(idx)
            idx += 1
        if hits:
            print(f'{pat_name}: {len(hits)} hits at ' +
                  ', '.join(f'0x{h:x}' for h in hits[:8]))

# 3. Same for 0x400 (connect op)
for pat_name, patterns in [
    ('mov edx,0x400', [b'\xba\x00\x04\x00\x00']),
    ('mov esi,0x400', [b'\xbe\x00\x04\x00\x00']),
    ('push 0x400', [b'\x68\x00\x04\x00\x00']),
]:
    for pat in patterns:
        idx = 0
        hits = []
        while True:
            idx = data.find(pat, idx)
            if idx < 0:
                break
            hits.append(idx)
            idx += 1
        if hits:
            print(f'{pat_name}: {len(hits)} hits at ' +
                  ', '.join(f'0x{h:x}' for h in hits[:8]))

# 4. Dump the full RX as annotated function boundaries
# Look for standard function prologues (push rbp = 55)
print('\n--- Function boundaries (push rbp) ---')
idx = 0
funcs = []
while idx < len(data):
    if data[idx] == 0x55 and idx + 1 < len(data) and data[idx+1] == 0x48:
        funcs.append(idx)
    idx += 1
print(f'{len(funcs)} functions found')
for f in funcs[:30]:
    size = 0
    ret = data.find(b'\xc3', f)
    if ret > 0:
        size = ret - f
    print(f'  RX+0x{f:04x} ({size}B to ret)')
