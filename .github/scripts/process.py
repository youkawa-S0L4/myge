#!/usr/bin/env python3
"""Chạy tự động trong GitHub Actions mỗi khi có ảnh mới trong manga/.

Cấu trúc thư mục mong đợi:
  manga/<series-slug>/_series.json
      { "title": "...", "author": "...", "tags": ["Hành động", "Học đường"] }
  manga/<series-slug>/<chapter-slug>/*.jpg|jpeg|png

Script sẽ: nén ảnh sang WebP, xoá bản gốc nặng, và tạo library.json chứa
toàn bộ danh sách truyện/chương/trang/tag cho trang web đọc.
"""
import json
import re
from pathlib import Path
from PIL import Image, ImageOps

MANGA_DIR = Path("manga")
OUTPUT = Path("library.json")
RASTER_EXT = {".jpg", ".jpeg", ".png"}
MAX_DIM = 2000
QUALITY = 85


def natural_key(s):
    """Sắp xếp 'chap-2' trước 'chap-10' thay vì theo thứ tự chữ cái."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]


def titleize(slug):
    return " ".join(w.capitalize() for w in re.split(r'[-_]+', slug) if w)


def optimize_images():
    if not MANGA_DIR.exists():
        return
    for p in MANGA_DIR.rglob("*"):
        if p.is_file() and p.suffix.lower() in RASTER_EXT:
            img = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
            img.thumbnail((MAX_DIM, MAX_DIM))
            out = p.with_suffix(".webp")
            img.save(out, "WEBP", quality=QUALITY)
            p.unlink()
            print(f"Tối ưu: {p} -> {out.name}")


def build_library():
    if not MANGA_DIR.exists():
        OUTPUT.write_text("[]")
        return

    library = []
    series_dirs = sorted(
        (d for d in MANGA_DIR.iterdir() if d.is_dir()),
        key=lambda d: natural_key(d.name)
    )

    for series_dir in series_dirs:
        meta = {}
        meta_path = series_dir / "_series.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
            except Exception:
                meta = {}

        title = meta.get("title") or titleize(series_dir.name)
        author = meta.get("author") or "Không rõ"
        tags = meta.get("tags") or []
        if not isinstance(tags, list):
            tags = []

        chapter_dirs = sorted(
            (d for d in series_dir.iterdir() if d.is_dir()),
            key=lambda d: natural_key(d.name)
        )

        chapters = []
        cover = None
        for ch_dir in chapter_dirs:
            pages = sorted(
                (p for p in ch_dir.iterdir() if p.suffix.lower() == ".webp"),
                key=lambda p: natural_key(p.name)
            )
            if not pages:
                continue
            page_paths = [p.as_posix() for p in pages]
            chapters.append({
                "name": titleize(ch_dir.name),
                "slug": ch_dir.name,
                "pages": page_paths,
            })
            if cover is None:
                cover = page_paths[0]

        if not chapters:
            continue

        library.append({
            "slug": series_dir.name,
            "title": title,
            "author": author,
            "tags": tags,
            "cover": cover,
            "chapters": chapters,
        })

    OUTPUT.write_text(json.dumps(library, ensure_ascii=False, indent=2))
    print(f"Đã tạo {OUTPUT} với {len(library)} bộ truyện.")


if __name__ == "__main__":
    optimize_images()
    build_library()
