"""Add a byte-checked 14.00 VideoCore output-only method wrapper."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"expected one anchor, got {source.count(old)}")
    return source.replace(old, new)


def main() -> None:
    source_path = PROBES / "clone_history_native_invoke_install_v47.js"
    target_path = PROBES / "clone_history_native_invoke_install_v48.js"
    source_manifest = PROBES / "clone_history_native_invoke_install_v47.json"
    target_manifest = PROBES / "clone_history_native_invoke_install_v48.json"
    if target_path.exists() or target_manifest.exists():
        raise FileExistsError("v48 already exists")
    source = source_path.read_text(encoding="utf-8")
    anchor = 'if (!ipmiRx) throw new Error("ipmi_map_missing");'
    extra = '''
var videoCore=liveMap.modules.filter(function(item){
return item.handle===61 &&
item.name==="libSceVideoCoreServerInterface.sprx";
})[0];
var videoCoreRx=videoCore && videoCore.segments.filter(function(seg){
return seg.kind==="rx" && seg.size===65536;
})[0];
if (!videoCoreRx) throw new Error("videocore_map_missing");'''
    source = replace_once(source, anchor, anchor + extra)
    anchor = "var errnoBytes=["
    extra = '''wrappers.videocore_query17=[videoCoreRx.start+0x1180,
[0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,
0x38,0x48,0x8b,0x1d,0x90,0xee,0x00,0x00]];
'''
    source = replace_once(source, anchor, extra + anchor)
    anchor = "ipmi_client_destroy:wrappers.ipmi_client_destroy[0] },"
    source = replace_once(source, anchor,
        "ipmi_client_destroy:wrappers.ipmi_client_destroy[0],"
        "videocore_query17:wrappers.videocore_query17[0] },")
    source = source.replace("v47", "v48")
    payload = source.encode("utf-8")
    if len(payload) > 32768:
        raise ValueError(f"collector script cap exceeded: {len(payload)}")
    target_path.write_bytes(payload)
    target_manifest.write_text(
        source_manifest.read_text(encoding="utf-8").replace("v47", "v48"),
        encoding="utf-8",
    )
    print(f"{target_path} {len(payload)} bytes")


if __name__ == "__main__":
    main()
