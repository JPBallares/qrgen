#!/usr/bin/env python3
"""
QR Code Generator CLI
---------------------
Env variables:
  QR_IMAGE_PATH - Local file path to a custom center logo image (takes priority)
  QR_IMAGE_URL  - URL of a custom center logo image (fallback if PATH not set)

Requirements:
  pip install qrcode[pil] requests pillow
"""

import os
import sys
import urllib.request
import io
from dotenv import load_dotenv

load_dotenv()

# ── dependency check ──────────────────────────────────────────────────────────
try:
    import qrcode
    from qrcode.image.styledpil import StyledPilImage
    from qrcode.image.styles.moduledrawers import (
        SquareModuleDrawer,
        RoundedModuleDrawer,
        CircleModuleDrawer,
        GappedSquareModuleDrawer,
        VerticalBarsDrawer,
        HorizontalBarsDrawer,
    )
    from qrcode.image.styles.colormasks import SolidFillColorMask
    from PIL import Image, ImageColor
except ImportError:
    print("Missing dependencies. Run:\n  pip install qrcode[pil] requests pillow")
    sys.exit(1)

# ── helpers ───────────────────────────────────────────────────────────────────

COLORS = {
    1: ("Black / White (default)", "#000000", "#FFFFFF"),
    2: ("Navy / White", "#0a2342", "#FFFFFF"),
    3: ("Dark Green / White", "#1a4731", "#FFFFFF"),
    4: ("Deep Purple / White", "#2d1b69", "#FFFFFF"),
    5: ("Dark Red / White", "#7b0000", "#FFFFFF"),
    6: ("Teal / White", "#004d4d", "#FFFFFF"),
    7: ("Black / Yellow", "#000000", "#FFD700"),
    8: ("Dark Blue / Light Blue", "#003366", "#cce0ff"),
    9: ("Custom (enter hex codes)", "", ""),
}

MODULE_STYLES = {
    1: ("Square", SquareModuleDrawer()),
    2: ("Rounded", RoundedModuleDrawer()),
    3: ("Circle dots", CircleModuleDrawer()),
    4: ("Gapped squares", GappedSquareModuleDrawer()),
    5: ("Vertical bars", VerticalBarsDrawer()),
    6: ("Horizontal bars", HorizontalBarsDrawer()),
}

ERROR_LEVELS = {
    1: ("L – 7%  (smallest file)", qrcode.constants.ERROR_CORRECT_L),
    2: ("M – 15% (default)", qrcode.constants.ERROR_CORRECT_M),
    3: ("Q – 25%", qrcode.constants.ERROR_CORRECT_Q),
    4: ("H – 30% (best for logos)", qrcode.constants.ERROR_CORRECT_H),
}


def menu(title, options: dict):
    print(f"\n── {title} ──")
    for k, v in options.items():
        label = v[0] if isinstance(v, tuple) else v
        print(f"  {k}. {label}")
    while True:
        try:
            choice = int(input("Enter number: "))
            if choice in options:
                return choice
        except ValueError:
            pass
        print("Invalid choice, try again.")


def fetch_image(url: str) -> Image.Image | None:
    try:
        print(f"  Fetching logo from: {url}")
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = resp.read()
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception as e:
        print(f"  Warning: could not load image – {e}")
        return None


def embed_logo(
    qr_img: Image.Image, logo: Image.Image, ratio: float = 0.25
) -> Image.Image:
    qr = qr_img.convert("RGBA")
    qr_w, qr_h = qr.size
    max_logo = int(min(qr_w, qr_h) * ratio)
    logo_w, logo_h = logo.size
    scale = min(max_logo / logo_w, max_logo / logo_h)
    new_size = (int(logo_w * scale), int(logo_h * scale))
    logo = logo.resize(new_size, Image.LANCZOS)

    # white padding behind logo
    pad = 10
    bg = Image.new("RGBA", (new_size[0] + pad * 2, new_size[1] + pad * 2), "white")
    bg.paste(logo, (pad, pad), logo)

    pos = ((qr_w - bg.width) // 2, (qr_h - bg.height) // 2)
    qr.paste(bg, pos, bg)
    return qr


# ── main ──────────────────────────────────────────────────────────────────────


def main():
    print("=" * 50)
    print("       QR CODE GENERATOR")
    print("=" * 50)

    # 1. data to encode
    data = input("\nEnter the URL / text to encode:\n> ").strip()
    if not data:
        print("No data entered. Exiting.")
        sys.exit(1)

    # 2. output filename
    default_name = "qrcode.png"
    out_name = input(f"\nOutput filename [{default_name}]: ").strip() or default_name
    if not out_name.lower().endswith(".png"):
        out_name += ".png"

    # 3. error correction
    ec_choice = menu("Error Correction Level", ERROR_LEVELS)
    ec_level = ERROR_LEVELS[ec_choice][1]

    # 4. QR size (box size)
    print("\n── Module Size (box size in pixels) ──")
    print("  Suggested: 10 (normal), 15 (large), 20 (poster)")
    while True:
        try:
            box_size = int(input("Enter box size [10]: ").strip() or "10")
            if 1 <= box_size <= 100:
                break
        except ValueError:
            pass
        print("Enter a number between 1 and 100.")

    # 5. border
    print("\n── Border (quiet zone, in modules) ──")
    while True:
        try:
            border = int(input("Enter border size [4]: ").strip() or "4")
            if 0 <= border <= 20:
                break
        except ValueError:
            pass
        print("Enter a number between 0 and 20.")

    # 6. module style
    style_choice = menu("Module Style", MODULE_STYLES)
    module_drawer = MODULE_STYLES[style_choice][1]

    # 7. color
    color_choice = menu("QR Color Scheme", COLORS)
    if color_choice == 9:
        fg = input("  Foreground hex (e.g. #000000): ").strip() or "#000000"
        bg = input("  Background hex (e.g. #FFFFFF): ").strip() or "#FFFFFF"
    else:
        _, fg, bg = COLORS[color_choice]

    # 8. custom logo via QR_IMAGE_PATH, QR_IMAGE_URL, or manual input
    logo_img = None
    logo_source = None

    logo_path = os.environ.get("QR_IMAGE_PATH", "").strip()
    logo_url = os.environ.get("QR_IMAGE_URL", "").strip()

    if logo_path:
        try:
            logo_img = Image.open(logo_path).convert("RGBA")
            logo_source = f"file:{logo_path}"
            print(f"  Loaded logo from local file: {logo_path}")
        except Exception as e:
            print(f"  Warning: could not load local image – {e}")
    elif logo_url:
        logo_img = fetch_image(logo_url)
        logo_source = logo_url
    else:
        print("\n── Center Logo (optional) ──")
        user_path = input("  Enter local image path (or leave blank to skip): ").strip()
        if user_path:
            try:
                logo_img = Image.open(user_path).convert("RGBA")
                logo_source = f"file:{user_path}"
                print(f"  Loaded logo from: {user_path}")
            except Exception as e:
                print(f"  Warning: could not load image – {e}")
        else:
            print("  (Skipping logo)")

    if logo_img and ec_choice < 4:
        print("  Tip: Error correction 'H' is recommended when using a logo.")

    # 9. generate
    print("\nGenerating QR code …")
    qr = qrcode.QRCode(
        version=None,
        error_correction=ec_level,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)

    def hex_to_rgb(h):
        from PIL import ImageColor

        return ImageColor.getrgb(h)

    color_mask = SolidFillColorMask(
        front_color=hex_to_rgb(fg),
        back_color=hex_to_rgb(bg),
    )

    qr_img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=module_drawer,
        color_mask=color_mask,
    ).convert("RGBA")

    if logo_img:
        qr_img = embed_logo(qr_img, logo_img)

    qr_img.convert("RGB").save(out_name)
    print(f"\n✓ Saved: {out_name}")
    print(f"  Data    : {data[:60]}{'…' if len(data) > 60 else ''}")
    print(f"  Size    : {qr_img.size[0]}×{qr_img.size[1]} px")
    print(f"  Style   : {MODULE_STYLES[style_choice][0]}")
    print(f"  Colors  : fg={fg}  bg={bg}")
    print(f"  Logo    : {'yes (' + str(logo_source)[:50] + ')' if logo_img else 'no'}")


if __name__ == "__main__":
    main()
