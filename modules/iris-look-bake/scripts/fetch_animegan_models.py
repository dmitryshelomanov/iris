#!/usr/bin/env python3
"""
Download AnimeGANv3 ONNX weights (Shinkai / Hayao) into module assets.

Sources (official GitHub releases; AnimeGANv3 by TachibanaYoshino):
  https://github.com/TachibanaYoshino/AnimeGANv3/releases/tag/v1.1.0
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "models"
IOS_DIR = ROOT / "ios"

MODELS = (
    {
        "name": "AnimeGANv3_Shinkai_37",
        "url": (
            "https://github.com/TachibanaYoshino/AnimeGANv3/releases/download/"
            "v1.1.0/AnimeGANv3_Shinkai_37.onnx"
        ),
        "sha256": "8dc4d789c44db472447806583c56809e155280225b991bd79f9e2cb20793dcb9",
    },
    {
        "name": "AnimeGANv3_Hayao_36",
        "url": (
            "https://github.com/TachibanaYoshino/AnimeGANv3/releases/download/"
            "v1.1.0/AnimeGANv3_Hayao_36.onnx"
        ),
        "sha256": "95ba7b219073fd5b12f569bc38056ffd3019cf4caf15b1feb9f73d1286c9f69d",
    },
)

# Stale AnimeGANv2 assets to remove after a successful v3 fetch.
LEGACY_NAMES = (
    "AnimeGANv2_Shinkai",
    "AnimeGANv2_Hayao",
    "AnimeGANv2_Paprika",
)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_ios_symlink(onnx_path: Path) -> None:
    ios_link = IOS_DIR / onnx_path.name
    target = Path("../assets/models") / onnx_path.name
    if ios_link.is_symlink() and ios_link.readlink() == target:
        return
    if ios_link.exists() or ios_link.is_symlink():
        ios_link.unlink()
    try:
        ios_link.symlink_to(target)
        print(f"Linked {ios_link}")
    except OSError as e:
        print(f"Warning: could not create iOS symlink: {e}")


def remove_legacy() -> None:
    for name in LEGACY_NAMES:
        for path in (OUT_DIR / f"{name}.onnx", IOS_DIR / f"{name}.onnx"):
            if path.is_symlink() or path.exists():
                path.unlink()
                print(f"Removed {path}")


def fetch_one(name: str, url: str, expected: str | None, force: bool) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = OUT_DIR / f"{name}.onnx"

    if onnx_path.exists() and not force:
        digest = sha256_file(onnx_path)
        if expected is None or digest == expected:
            print(f"OK {onnx_path} ({onnx_path.stat().st_size} bytes) sha256={digest}")
            ensure_ios_symlink(onnx_path)
            return onnx_path
        print(f"Checksum mismatch for {name} ({digest}); re-downloading…")

    print(f"Downloading {url}")
    urllib.request.urlretrieve(url, onnx_path)
    digest = sha256_file(onnx_path)
    if expected is not None and digest != expected:
        raise SystemExit(f"SHA256 mismatch for {name}: got {digest}, expected {expected}")
    print(f"Saved {onnx_path} ({onnx_path.stat().st_size} bytes) sha256={digest}")
    ensure_ios_symlink(onnx_path)
    return onnx_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Re-download all ONNX files")
    args = parser.parse_args()

    for model in MODELS:
        fetch_one(model["name"], model["url"], model["sha256"], force=args.force)
    remove_legacy()


if __name__ == "__main__":
    main()
    sys.exit(0)
