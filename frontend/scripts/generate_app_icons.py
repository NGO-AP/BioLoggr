"""Generate BioLoggr favicon and PWA icons (🌿) into frontend/public/."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BACKGROUND = (15, 23, 42, 255)  # #0f172a — manifest background_color
LEAF = "\U0001F33F"


def _emoji_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts\seguiemj.ttf"),
        Path(r"C:\Windows\Fonts\Segoe UI Emoji.ttf"),
        Path("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"),
        Path("/usr/share/fonts/google-noto-emoji/NotoColorEmoji.ttf"),
    ]
    for path in candidates:
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    raise FileNotFoundError(
        "No color emoji font found. Install Noto Color Emoji (Linux) or run on Windows."
    )


def render_leaf(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BACKGROUND)
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.62)
    font = _emoji_font(font_size)
    draw.text((size // 2, size // 2), LEAF, font=font, anchor="mm", embedded_color=True)
    return img


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    sizes_ico = (16, 32, 48)
    ico_frames = [render_leaf(s) for s in sizes_ico]
    ico_frames[0].save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in sizes_ico],
        append_images=ico_frames[1:],
    )
    render_leaf(192).save(PUBLIC / "icon-192.png", optimize=True)
    render_leaf(512).save(PUBLIC / "icon-512.png", optimize=True)
    print(f"Wrote favicon.ico, icon-192.png, icon-512.png -> {PUBLIC}")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
