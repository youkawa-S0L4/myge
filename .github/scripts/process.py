#!/usr/bin/env python3
"""Chạy tự động trong GitHub Actions mỗi khi có ảnh mới trong images/.
Resize + convert ảnh sang WebP để nhẹ, xoá bản gốc nặng, và tạo images.json.
Bạn không cần chạy file này thủ công — Actions lo hết.
"""
import json
from pathlib import Path
from PIL import Image, ImageOps

IMAGES_DIR = Path("images")
OUTPUT = Path("images.json")
RASTER_EXT = {".jpg", ".jpeg", ".png"}
MAX_DIM = 2000
QUALITY = 82


def optimize():
    if not IMAGES_DIR.exists():
        return
    for p in sorted(IMAGES_DIR.iterdir()):
        if p.suffix.lower() in RASTER_EXT:
            img = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
            img.thumbnail((MAX_DIM, MAX_DIM))
            out = p.with_suffix(".webp")
            img.save(out, "WEBP", quality=QUALITY)
            p.unlink()  # xoá bản gốc nặng, chỉ giữ bản webp đã nén
            print(f"Tối ưu: {p.name} -> {out.name}")


def build_manifest():
    if not IMAGES_DIR.exists():
        return
    files = sorted(p for p in IMAGES_DIR.iterdir() if p.suffix.lower() == ".webp")
    manifest = []
    for p in files:
        with Image.open(p) as img:
            w, h = img.size
        manifest.append({
            "src": f"images/{p.name}",
            "caption": p.stem.replace("_", " "),
            "w": w,
            "h": h,
        })
    OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"Đã tạo {OUTPUT} với {len(manifest)} ảnh.")


if __name__ == "__main__":
    optimize()
    build_manifest()
  
