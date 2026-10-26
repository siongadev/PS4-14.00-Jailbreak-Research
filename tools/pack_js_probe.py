"""Pack one readable probe under the collector's 32 KiB script limit.

Install the packer with ``python -m pip install rjsmin==1.3.0``.
The readable source remains the review target; the packed file is what the
manifest sends to the PS4 browser.
"""

from __future__ import annotations

import argparse
from pathlib import Path


MAX_SCRIPT_BYTES = 32_768


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        import rjsmin
    except ImportError as error:
        parser.error("install rjsmin==1.3.0 to pack JavaScript probes")
        raise error
    packed = rjsmin.jsmin(args.source.read_text(encoding="utf-8"))
    payload = packed.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8")
    size = len(payload)
    if size > MAX_SCRIPT_BYTES:
        parser.error(f"packed script is {size} bytes, above {MAX_SCRIPT_BYTES}")
    args.output.write_bytes(payload)
    print(f"{args.output}: {size} bytes")


if __name__ == "__main__":
    main()
