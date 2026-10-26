import io
RX = open(r'evidence\live\rx_0x833f00000_14.00.bin', 'rb').read()
print('PLT stubs in libSceIpmi RX (jmp [rip+X] = imports from libkernel):')
idx = 0
stubs = []
while True:
    idx = RX.find(b'\xff\x25', idx)
    if idx < 0:
        break
    if idx + 6 <= len(RX):
        rel = int.from_bytes(RX[idx+2:idx+6], 'little')
        got = idx + 6 + rel
        stubs.append((idx, got))
    idx += 1
print(f'Total PLT stubs: {len(stubs)}')
for s, g in stubs:
    if s < 0x300:
        print(f'  PLT +0x{s:03x} -> GOT +0x{g:04x}')
print(f'\nDispatch PLT stub at 0x0208:')
for s, g in stubs:
    if s == 0x0208:
        print(f'  PLT +0x{s:03x} -> GOT +0x{g:04x}')
print('\n=> GOT entries are in the data segment (past RX), filled at')
print('   runtime by the dynamic linker with libkernel addresses.')
print('=> The 0x320 call goes through PLT to libkernel, then kernel.')
io.open(r'scratch_plt_out.txt', 'w').write('done')
