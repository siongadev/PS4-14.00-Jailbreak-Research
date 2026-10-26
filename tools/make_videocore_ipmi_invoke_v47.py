"""Add checked current-map IPMI entries for the VideoCore service gate."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "probes" / "clone_history_native_invoke_install_v46.js"
NEW = ROOT / "probes" / "clone_history_native_invoke_install_v47.js"
OLD_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v46.json"
NEW_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v47.json"


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"expected one anchor, got {source.count(old)}: {old[:80]}")
    return source.replace(old, new)


def main() -> None:
    if NEW.exists() or NEW_MANIFEST.exists():
        raise FileExistsError("v47 probe already exists")
    source = OLD.read_text(encoding="utf-8")
    anchor = 'if (!netctlRx) throw new Error("netctl_map_missing");'
    extra = '''\nvar ipmi=liveMap.modules.filter(function(item){
return item.handle===27 && item.name==="libSceIpmi.sprx";
})[0];
var ipmiRx=ipmi && ipmi.segments.filter(function(seg){
return seg.kind==="rx" && seg.size===49152;
})[0];
if (!ipmiRx) throw new Error("ipmi_map_missing");'''
    source = replace_once(source, anchor, anchor + extra)
    anchor = "var errnoBytes=["
    extra = '''wrappers.sys622=[kernelRx.start+0x2b300,622];
wrappers.ipmi_config_init=[ipmiRx.start+0x11b0,
[0xc5,0xf8,0x10,0x05,0x88,0x63,0x00,0x00,
0x48,0xb8,0x00,0x00,0x00,0x00,0x01,0x00]];
wrappers.ipmi_client_create=[ipmiRx.start+0x1300,
[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,
0x41,0x55,0x41,0x54,0x53,0x50,0x48,0x85]];
wrappers.ipmi_client_destroy=[ipmiRx.start+0x630,
[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x48,
0x89,0xfb,0x8b,0x7f,0x08,0xe8,0x0e,0x3a]];
'''
    source = replace_once(source, anchor, extra + anchor)
    anchor = "netctl_m17:wrappers.netctl_m17[0] },"
    extra = ("netctl_m17:wrappers.netctl_m17[0],"
             "sys622:wrappers.sys622[0],"
             "ipmi_config_init:wrappers.ipmi_config_init[0],"
             "ipmi_client_create:wrappers.ipmi_client_create[0],"
             "ipmi_client_destroy:wrappers.ipmi_client_destroy[0] },")
    source = replace_once(source, anchor, extra)
    source = source.replace("v46", "v47")
    encoded = source.encode("utf-8")
    if len(encoded) > 32768:
        raise ValueError(f"source exceeds collector cap: {len(encoded)}")
    NEW.write_bytes(encoded)
    NEW_MANIFEST.write_text(
        OLD_MANIFEST.read_text(encoding="utf-8").replace("v46", "v47"),
        encoding="utf-8",
    )
    print(f"{NEW} {len(encoded)} bytes")


if __name__ == "__main__":
    main()
