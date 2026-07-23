"""
Generate all logo variants for the Qudurat LMS deployment:
- favicon-16x16.png, favicon-32x32.png (transparent)
- apple-touch-icon.png (180x180, white bg — iOS convention)
- icon-192.png, icon-512.png (PWA, transparent)
- favicon.ico (multi-size)
- og-image.png (1200x630, branded)
- logo-transparent.png (original size, transparent bg — for navbar/loading)
- logo-white.png (white version for dark backgrounds)
"""

from PIL import Image, ImageDraw, ImageFilter
import os

SRC = "/home/z/my-project/upload/hema_logo.png"
OUT = "/home/z/my-project/public"
os.makedirs(OUT, exist_ok=True)

# ---------- 1. Load and create transparent version ----------
print("Loading source logo...")
src = Image.open(SRC).convert("RGBA")
W, H = src.size  # 1254x1254

# Make white background transparent.
# "whiteness" = min(255-r, 255-g, 255-b).
#   - whiteness = 0   → pixel is pure white (background)
#   - whiteness = 255 → pixel is pure black (content)
# Strategy:
#   - whiteness <= 5 (clearly white)       → fully transparent (alpha=0)
#   - whiteness 6-30 (anti-aliased edge)   → gradient alpha (soft edge)
#   - whiteness > 30 (clearly content)     → fully opaque (alpha=255)
pixels = src.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = pixels[x, y]
        whiteness = min(255 - r, 255 - g, 255 - b)  # 0 = white, 255 = black
        if whiteness <= 5:
            # Clearly white background → fully transparent
            pixels[x, y] = (r, g, b, 0)
        elif whiteness <= 30:
            # Anti-aliased edge → gradient transparency
            # Map whiteness 5→0 alpha (white side), 30→255 alpha (content side)
            alpha = int(255 * (whiteness - 5) / 25)
            pixels[x, y] = (r, g, b, alpha)
        # else: keep full opacity (alpha=255)

src.save(f"{OUT}/logo-transparent.png")
print(f"  ✓ logo-transparent.png ({W}x{H}, transparent)")

# ---------- 2. Trim to content bbox ----------
# Now find the actual non-transparent content
bbox = src.getbbox()
print(f"  Content bbox after transparency: {bbox}")
trimmed = src.crop(bbox)
TW, TH = trimmed.size
print(f"  Trimmed size: {TW}x{TH}")

# ---------- 3. Generate favicon sizes ----------
def pad_to_square(img, bg_color=(0, 0, 0, 0)):
    """Pad image to square with given background."""
    w, h = img.size
    if w == h:
        return img
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), bg_color)
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas

def resize_with_padding(img, target_size, bg_color=(0, 0, 0, 0)):
    """Resize image to target_size with padding to preserve aspect ratio."""
    w, h = img.size
    scale = min(target_size / w, target_size / h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (target_size, target_size), bg_color)
    canvas.paste(resized, ((target_size - new_w) // 2, (target_size - new_h) // 2), resized)
    return canvas

# Transparent favicons
favicon_16 = resize_with_padding(trimmed, 16)
favicon_32 = resize_with_padding(trimmed, 32)
favicon_16.save(f"{OUT}/favicon-16x16.png")
favicon_32.save(f"{OUT}/favicon-32x32.png")
print(f"  ✓ favicon-16x16.png, favicon-32x32.png")

# ---------- 4. Apple touch icon (180x180, white background) ----------
apple = resize_with_padding(trimmed, 180, bg_color=(255, 255, 255, 255))
apple.save(f"{OUT}/apple-touch-icon.png")
print(f"  ✓ apple-touch-icon.png (180x180, white bg)")

# ---------- 5. PWA icons (192, 512, transparent) ----------
icon_192 = resize_with_padding(trimmed, 192)
icon_512 = resize_with_padding(trimmed, 512)
icon_192.save(f"{OUT}/icon-192.png")
icon_512.save(f"{OUT}/icon-512.png")
print(f"  ✓ icon-192.png, icon-512.png (PWA)")

# ---------- 6. Multi-size favicon.ico ----------
# ICO can contain multiple sizes; PIL supports saving as ICO
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
ico_images = [resize_with_padding(trimmed, s) for s, _ in ico_sizes]
# Save the largest as the base for the ICO
icon_64 = resize_with_padding(trimmed, 64)
icon_64.save(f"{OUT}/favicon.ico", format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64)])
print(f"  ✓ favicon.ico (multi-size)")

# ---------- 7. OG image (1200x630) with branded background ----------
og = Image.new("RGB", (1200, 630), (15, 38, 28))  # deep emerald background
draw = ImageDraw.Draw(og)

# Add subtle gradient overlay (simple radial-ish)
for y in range(630):
    for x in range(1200):
        # Skip — too slow pixel by pixel. Use a simpler approach.
        pass

# Add decorative pattern (dots)
import random
random.seed(42)
for _ in range(150):
    x = random.randint(0, 1200)
    y = random.randint(0, 630)
    r = random.randint(1, 3)
    draw.ellipse([x-r, y-r, x+r, y+r], fill=(255, 255, 255, 30))

# Place logo on the right side (RTL — logo on right reads first)
logo_og = resize_with_padding(trimmed, 320)
og.paste(logo_og, (760, 155), logo_og)

# Draw brand text on the left side
# Use default font (PIL doesn't ship Arabic fonts reliably; use text-as-image approach)
# For simplicity, draw a stylized Latin title bar and Arabic via system font
try:
    from PIL import ImageFont
    # Try common system fonts
    font_paths = [
        "/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    font_large = None
    for fp in font_paths:
        try:
            font_large = ImageFont.truetype(fp, 80)
            break
        except:
            continue
    if font_large:
        draw.text((80, 200), "QUDURAT", fill=(255, 255, 255), font=font_large)
        if font_large:
            font_small = ImageFont.truetype(font_paths[1] if len(font_paths) > 1 else font_paths[0], 32)
            draw.text((80, 310), "Premium Arabic LMS", fill=(180, 220, 200), font=font_small)
except Exception as e:
    print(f"  (font rendering skipped: {e})")

og.save(f"{OUT}/og-image.png", "PNG")
print(f"  ✓ og-image.png (1200x630)")

# ---------- 8. White version for dark backgrounds ----------
# Convert colored pixels to white, keep alpha
white_logo = trimmed.copy()
wp = white_logo.load()
for y in range(white_logo.size[1]):
    for x in range(white_logo.size[0]):
        r, g, b, a = wp[x, y]
        if a > 0:
            wp[x, y] = (255, 255, 255, a)
white_logo.save(f"{OUT}/logo-white.png")
print(f"  ✓ logo-white.png (white version for dark backgrounds)")

# ---------- 9. Original (with white bg) for splash screen ----------
src_rgb = Image.open(SRC).convert("RGB")
# Save the original at smaller size for splash use
splash = resize_with_padding(src_rgb.convert("RGBA"), 400, bg_color=(255, 255, 255, 0))
# Actually for splash, we want the transparent version
splash = resize_with_padding(trimmed, 400)
splash.save(f"{OUT}/logo-splash.png")
print(f"  ✓ logo-splash.png (400px, transparent)")

print("\n✓ All logo variants generated in /public")
print("\nGenerated files:")
for f in sorted(os.listdir(OUT)):
    if f.endswith(('.png', '.ico')):
        size = os.path.getsize(f"{OUT}/{f}")
        print(f"  {f} ({size:,} bytes)")
