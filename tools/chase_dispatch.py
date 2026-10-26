#!/usr/bin/env python3
"""Chase the dispatch[0x58] wrapper through the libSceSysCore RX image.

The getter at RX+0x1bc0 does:
  mov rbx, [rip+0x6458]   ; rbx = &global_client (RX+0x1bc0+7+0x6458)
  mov rax, [rdi]           ; rax = client->vtable
  call [rax+0x58]          ; dispatch via vtable entry 11

We need to find:
1. What the global_client pointer points to (the vtable address)
2. The vtable contents at offset 0x58
3. The dispatch function body
"""
import struct
import sys

RX_PATH = r'evidence\live\rx_0x81b340000_14.00.bin'
BASE = 0x81B340000

data = open(RX_PATH, 'rb').read()
print(f'RX image: {len(data)} bytes')

# The getter at 0x1bc0 loads the global via RIP-relative:
# 48 8b 1d 58 64 00 00 = mov rbx, [rip+0x6458]
# RIP at that point = BASE + 0x1bc0 + 7 = BASE + 0x1bc7
# Target = BASE + 0x1bc7 + 0x6458 = BASE + 0x801F
rip_after = 0x1bc0 + 7
global_offset = rip_after + 0x6458
print(f'\nGlobal client ptr at RX+0x{global_offset:x}')
print(f'  bytes: {data[global_offset:global_offset+8].hex()}')
global_val = struct.unpack('<Q', data[global_offset:global_offset+8])[0]
print(f'  value: 0x{global_val:016x}')
if global_val:
    print(f'  → points to RX+0x{global_val - BASE:x}' if global_val >= BASE
          else f'  → absolute address 0x{global_val:x}')

# Now: the getter does mov rax, [rdi] where rdi is the client object.
# The global points to a pointer table. rdi is the first arg of the
# getter, which IS the client object pointer (passed by the framework).
# [rdi] = the vtable pointer.
# The vtable lives in RO data. We need to find it.

# Search for the vtable: the getter function address (BASE + 0x1bc0)
# should appear in a vtable. Search for its 8-byte LE encoding.
fn_addr = BASE + 0x1bc0
fn_bytes = struct.pack('<Q', fn_addr)
print(f'\nSearching for getter address 0x{fn_addr:x} in RX...')
idx = 0
while True:
    idx = data.find(fn_bytes, idx)
    if idx < 0:
        break
    print(f'  found at RX+0x{idx:x}')
    # Dump surrounding vtable entries
    vt_start = max(0, idx - 0x20)
    vt_end = min(len(data), idx + 0x80)
    for vo in range(vt_start, vt_end, 8):
        entry = struct.unpack('<Q', data[vo:vo+8])[0]
        marker = ' ← [0x58/8 = idx 11]' if vo == idx - (idx % 8) + 0x50 else ''
        marker = ''
        if idx <= vo < idx + 8:
            marker = ' ← getter (our search hit)'
        if vo == (idx & ~7) + 0x50:
            marker = ' ← offset 0x50 from vtable base guess'
        print(f'    RX+0x{vo:x}: 0x{entry:016x} {marker}')
    idx += 1

# Also: the second getter at 0x1cc0 uses mov rbx,[rip+0x63d8]
# rip = 0x1cc0+7 = 0x1cc7, target = 0x1cc7 + 0x63d8 = 0x809F
rip2 = 0x1cc0 + 7
glob2 = rip2 + 0x63d8
print(f'\nSecond getter global at RX+0x{glob2:x}')
gv2 = struct.unpack('<Q', data[glob2:glob2+8])[0]
print(f'  value: 0x{gv2:016x}')

# The [rip+X] in the getter loads a POINTER from RX data.
# That pointer IS the client object address (or a pointer to it).
# The client object's first qword is the vtable.
# Let's check if the value at global_offset is a RX offset:
ptr_val = struct.unpack('<Q', data[global_offset:global_offset+8])[0]
if BASE <= ptr_val < BASE + len(data):
    rx_off = ptr_val - BASE
    print(f'\nGlobal points to RX+0x{rx_off:x}')
    vtable_candidate = struct.unpack('<Q', data[rx_off:rx_off+8])[0]
    print(f'  [ptr] = 0x{vtable_candidate:016x}')
    if BASE <= vtable_candidate < BASE + len(data):
        vrx = vtable_candidate - BASE
        print(f'  vtable at RX+0x{vrx:x}')
        # Dump vtable entries 0..15
        for e in range(16):
            entry = struct.unpack('<Q',
                data[vrx + e*8:vrx + e*8 + 8])[0]
            tag = ''
            if e * 8 == 0x58:
                tag = ' ← THIS IS dispatch[0x58]'
            in_rx = BASE <= entry < BASE + len(data)
            loctype = f'RX+0x{entry-BASE:x}' if in_rx else f'0x{entry:x}'
            print(f'    [{e:2d}] off 0x{e*8:02x}: 0x{entry:016x} ({loctype}){tag}')
    elif vtable_candidate == 0:
        print('  [ptr] = NULL (global is filled at runtime)')
