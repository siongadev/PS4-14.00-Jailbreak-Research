#!/usr/bin/env python3
"""Extract the official libSceSysCore IPC getter functions (0x1bc0,
0x1cc0) from the captured RX image and disassemble them to recover the
exact ipmimgr_call 0x320 parameter layout."""
import struct

RX_PATH = r'evidence\live\rx_0x81b340000_14.00.bin'
BASE = 0x81B340000

data = open(RX_PATH, 'rb').read()
print(f'RX image: {len(data)} bytes (0x{len(data):x})')

for fn_off, fn_name in [(0x1bc0, 'getter_0x1bc0'),
                        (0x1cc0, 'appinfo_0x1cc0')]:
    print(f'\n=== {fn_name} at RX+0x{fn_off:x} ===')
    chunk = data[fn_off:fn_off + 256]
    for i in range(0, len(chunk), 16):
        row = chunk[i:i + 16]
        hexs = ' '.join(f'{b:02x}' for b in row)
        addr = BASE + fn_off + i
        print(f'  {addr:012x}: {hexs}')

for target in [b'ipmimgr', b'SceSysCore', b'\x20\x03\x00\x00', b'\x20\x04\x00\x00']:
    idx = data.find(target)
    if idx >= 0:
        print(f'\nFound {target} at RX+0x{idx:x}')
        context = data[max(0, idx - 32):idx + 32]
        print('  context:', context.hex())
