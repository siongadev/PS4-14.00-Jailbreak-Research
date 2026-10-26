"""Add the source-defined 14.00 VideoOut initializer to the checked caller."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "probes" / "clone_history_native_invoke_install_v42.js"
NEW = ROOT / "probes" / "clone_history_native_invoke_install_v44.js"
OLD_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v42.json"
NEW_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v44.json"


def main() -> None:
    source = OLD.read_text(encoding="utf-8")
    old = ("  wrappers.mbus_query=[mbusRx.start+0x2190,"
           "[0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,"
           "0x38,0x48,0x8b,0x1d,0x88,0x9e,0x00,0x00]];")
    new = ("  var video=liveMap.modules.filter(function(x){return x.handle===60&&x.name===\"libSceVideoOut.sprx\";})[0];"
           "\n  var videoRx=video&&video.segments.filter(function(x){return x.kind===\"rx\"&&x.size===98304;})[0];"
           "\n  if(!videoRx)throw new Error(\"videoout_map_missing\");"
           "\n  wrappers.video_init=[videoRx.start+0x28f0,"
           "[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x48,"
           "0x83,0xe4,0xe0,0x48,0x83,0xec,0x60,0x4c]];")
    if source.count(old) != 1:
        raise ValueError("Mbus query anchor changed")
    source = source.replace(old, new)
    old_export = "mbus_init:wrappers.mbus_init[0],mbus_query:wrappers.mbus_query[0] },"
    new_export = "mbus_init:wrappers.mbus_init[0],video_init:wrappers.video_init[0] },"
    if source.count(old_export) != 1:
        raise ValueError("Mbus export anchor changed")
    source = source.replace(old_export, new_export).replace("v42", "v44")
    if NEW.exists() or NEW_MANIFEST.exists():
        raise FileExistsError("v44 probe already exists")
    encoded = source.encode("utf-8")
    if len(encoded) > 32768:
        raise ValueError(f"source exceeds collector cap: {len(encoded)}")
    NEW.write_bytes(encoded)
    NEW_MANIFEST.write_text(
        OLD_MANIFEST.read_text(encoding="utf-8").replace("v42", "v44"),
        encoding="utf-8",
    )
    print(f"{NEW} {len(encoded)} bytes")


if __name__ == "__main__":
    main()
