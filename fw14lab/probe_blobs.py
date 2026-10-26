"""Validate local probe manifests and preserve exact source bytes by digest."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re

from .captures import CHECK_ID, HEX_SHA256

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROBE_ROOT = PROJECT_ROOT / "probes"
BLOB_ROOT = PROJECT_ROOT / "control" / "probe_blobs"
MAX_PROBE_BYTES = 32_768
SCRIPT_NAME = re.compile(r"[a-z][a-z0-9_-]{0,63}\.js\Z")


class ProbeError(ValueError):
    """A local probe manifest or stored source is invalid."""


def canonical_json(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False).encode("utf-8")


def validate_manifest(value: object) -> dict:
    if type(value) is not dict or set(value) != {"probe_id", "script", "check_ids", "timeout_ms"}:
        raise ProbeError("invalid probe manifest fields")
    if type(value["probe_id"]) is not str or not CHECK_ID.fullmatch(value["probe_id"]):
        raise ProbeError("invalid probe id")
    if type(value["script"]) is not str or not SCRIPT_NAME.fullmatch(value["script"]):
        raise ProbeError("script must be a simple .js file name")
    check_ids = value["check_ids"]
    if (type(check_ids) is not list or not 1 <= len(check_ids) <= 12 or
            any(type(item) is not str or not CHECK_ID.fullmatch(item) for item in check_ids) or
            len(set(check_ids)) != len(check_ids)):
        raise ProbeError("invalid expected check ids")
    if type(value["timeout_ms"]) is not int or not 1000 <= value["timeout_ms"] <= 30_000:
        raise ProbeError("invalid probe timeout")
    return value


def snapshot_probe(manifest_path: Path, blob_root: Path = BLOB_ROOT) -> tuple[dict, str, str]:
    root = PROBE_ROOT.resolve()
    manifest_path = manifest_path.resolve(strict=True)
    if manifest_path.parent != root or manifest_path.suffix != ".json":
        raise ProbeError("manifest must be directly inside probes/")
    raw_manifest = manifest_path.read_bytes()
    if len(raw_manifest) > 4096:
        raise ProbeError("manifest exceeds size limit")
    try:
        manifest = validate_manifest(json.loads(raw_manifest.decode("utf-8")))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ProbeError("manifest must be UTF-8 JSON") from error
    script_path = (root / manifest["script"]).resolve(strict=True)
    if script_path.parent != root:
        raise ProbeError("script must be directly inside probes/")
    source = script_path.read_bytes()
    if not 1 <= len(source) <= MAX_PROBE_BYTES or source.startswith(b"\xef\xbb\xbf"):
        raise ProbeError("script size or encoding is invalid")
    try:
        source.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ProbeError("script must be UTF-8") from error
    source_sha256 = hashlib.sha256(source).hexdigest()
    canonical_manifest = canonical_json(manifest)
    manifest_sha256 = hashlib.sha256(canonical_manifest).hexdigest()
    blob_root.mkdir(parents=True, exist_ok=True)
    for path, content in ((blob_root / f"{source_sha256}.js", source),
                          (blob_root / f"{manifest_sha256}.json", canonical_manifest)):
        try:
            with path.open("xb") as file:
                file.write(content)
                file.flush()
                os.fsync(file.fileno())
        except FileExistsError:
            if path.read_bytes() != content:
                raise ProbeError("existing probe blob does not match source")
    return manifest, source_sha256, manifest_sha256


def read_probe_blob(source_sha256: str, blob_root: Path = BLOB_ROOT) -> bytes:
    if type(source_sha256) is not str or not HEX_SHA256.fullmatch(source_sha256):
        raise ProbeError("invalid probe digest")
    try:
        source = (blob_root / f"{source_sha256}.js").read_bytes()
    except FileNotFoundError as error:
        raise ProbeError("probe blob is missing") from error
    if (not 1 <= len(source) <= MAX_PROBE_BYTES or
            hashlib.sha256(source).hexdigest() != source_sha256):
        raise ProbeError("probe blob digest mismatch")
    return source
