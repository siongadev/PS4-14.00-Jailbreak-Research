"""Make one marked LNC method packet differential with final word zero."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def main() -> None:
    source = (PROBES / "clone_history_lnc_raw_status_v1.js").read_text(
        encoding="utf-8"
    )
    source = source.replace('put64(0x568,1);', 'put64(0x568,0);')
    source = source.replace('lnc_raw_method_before', 'lnc_raw_flag0_before')
    source = source.replace('lnc_raw_method_after', 'lnc_raw_flag0_after')
    source = source.replace('lnc_raw_status_v1', 'lnc_raw_flag0_v1')
    if 'put64(0x568,0);' not in source or 'lnc_raw_flag0_before' not in source:
        raise ValueError("expected packet and marker anchors missing")
    target = PROBES / "clone_history_lnc_raw_flag0_v1.js"
    target.write_text(source, encoding="utf-8")
    (PROBES / "clone_history_lnc_raw_flag0_v1.json").write_text(
        '{"probe_id":"clone_history_lnc_raw_flag0_v1",'
        '"script":"clone_history_lnc_raw_flag0_v1.js",'
        '"check_ids":["lnc_raw_flag0_v1"],"timeout_ms":30000}\n',
        encoding="utf-8",
    )
    print(target, target.stat().st_size)


if __name__ == "__main__":
    main()
