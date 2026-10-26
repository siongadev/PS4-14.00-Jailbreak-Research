"""Add the 14.00 fixed-ID Sysmodule loader to the checked native plan."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"expected one anchor, got {source.count(old)}")
    return source.replace(old, new)


def main() -> None:
    old = PROBES / "clone_history_native_invoke_install_v48.js"
    new = PROBES / "clone_history_native_invoke_install_v49.js"
    old_manifest = PROBES / "clone_history_native_invoke_install_v48.json"
    new_manifest = PROBES / "clone_history_native_invoke_install_v49.json"
    if new.exists() or new_manifest.exists():
        raise FileExistsError("v49 already exists")
    source = old.read_text(encoding="utf-8")
    anchor = 'if (!videoCoreRx) throw new Error("videocore_map_missing");'
    source = replace_once(source, anchor, anchor + '''
var sysmodule=liveMap.modules.filter(function(item){
return item.handle===16 && item.name==="libSceSysmodule.sprx";
})[0];
var sysmoduleRx=sysmodule && sysmodule.segments.filter(function(seg){
return seg.kind==="rx" && seg.size===49152;
})[0];
if (!sysmoduleRx) throw new Error("sysmodule_map_missing");''')
    anchor = "var errnoBytes=["
    source = replace_once(source, anchor, '''wrappers.sysmodule_load_id=[sysmoduleRx.start+0x10e0,
[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,
0x41,0x55,0x41,0x54,0x53,0x48,0x83,0xec]];
''' + anchor)
    anchor = "videocore_query17:wrappers.videocore_query17[0] },"
    source = replace_once(source, anchor,
        "videocore_query17:wrappers.videocore_query17[0],"
        "sysmodule_load_id:wrappers.sysmodule_load_id[0] },")
    source = source.replace("v48", "v49")
    payload = source.encode("utf-8")
    if len(payload) > 32768:
        raise ValueError(f"collector script cap exceeded: {len(payload)}")
    new.write_bytes(payload)
    new_manifest.write_text(
        old_manifest.read_text(encoding="utf-8").replace("v48", "v49"),
        encoding="utf-8",
    )
    print(f"{new} {len(payload)} bytes")


if __name__ == "__main__":
    main()
