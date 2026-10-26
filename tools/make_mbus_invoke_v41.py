"""Extend the pinned v40 page caller with one live-byte-checked Mbus entry."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "probes" / "clone_history_native_invoke_install_v40.js"
TARGET = ROOT / "probes" / "clone_history_native_invoke_install_v41.js"
MANIFEST_SOURCE = ROOT / "probes" / "clone_history_native_invoke_install_v40.json"
MANIFEST_TARGET = ROOT / "probes" / "clone_history_native_invoke_install_v41.json"


def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"expected exactly one anchor: {old[:70]!r}")
    return text.replace(old, new)


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    source = replace_once(
        source,
        "  wrappers.ioctl=[kernelRx.start+0x2cfe0,54];",
        """  wrappers.ioctl=[kernelRx.start+0x2cfe0,54];
  var mbus=liveMap.modules.filter(function(x){return x.handle===58&&x.name==="libSceMbus.sprx";})[0];
  var mbusRx=mbus&&mbus.segments.filter(function(x){return x.kind==="rx"&&x.size===49152;})[0];
  if(!mbusRx)throw new Error("mbus_map_missing");
  wrappers.mbus_init=[mbusRx.start+0x32c0,[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,0x41,0x55,0x41,0x54,0x53,0x48,0x81,0xec]];""",
    )
    source = replace_once(
        source,
        "      ioctl:wrappers.ioctl[0] },",
        "      ioctl:wrappers.ioctl[0],mbus_init:wrappers.mbus_init[0] },",
    )
    source = source.replace("v40", "v41")
    if TARGET.exists() or MANIFEST_TARGET.exists():
        raise FileExistsError("v41 probe already exists")
    TARGET.write_text(source, encoding="utf-8")
    manifest = MANIFEST_SOURCE.read_text(encoding="utf-8").replace("v40", "v41")
    MANIFEST_TARGET.write_text(manifest, encoding="utf-8")
    print(TARGET)
    print(MANIFEST_TARGET)


if __name__ == "__main__":
    main()
