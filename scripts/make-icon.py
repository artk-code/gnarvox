#!/usr/bin/env python3
"""Generate the gnarvox Studio app icon (1024x1024 PNG).

A dark rounded square with a green waveform — matches the app's UI palette.
Feed the output to `npx tauri icon scripts/icon.png` to produce all platform
icon formats under src-tauri/icons/.
"""

import math
import os

from PIL import Image, ImageDraw

SIZE = 1024
BG = (13, 17, 23, 255)        # --bg
PANEL = (21, 27, 36, 255)     # --bg-panel
ACCENT = (61, 220, 151, 255)  # --accent
ACCENT2 = (90, 169, 255, 255) # --accent-2


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def main() -> None:
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background rounded square with a subtle inner panel.
    rounded_rect(d, (0, 0, SIZE - 1, SIZE - 1), SIZE // 5, BG)
    rounded_rect(d, (40, 40, SIZE - 41, SIZE - 41), SIZE // 6, PANEL)

    # Waveform bars: symmetric envelope shaped like speech.
    n = 21
    margin = 130
    span = SIZE - 2 * margin
    bar_w = int(span / n * 0.55)
    center_y = SIZE // 2
    max_h = 330

    for i in range(n):
        t = i / (n - 1)
        # Speech-like envelope: a couple of syllable humps.
        env = (
            0.25
            + 0.75 * abs(math.sin(math.pi * t * 3.0)) * (1.0 - 0.45 * abs(2 * t - 1))
        )
        h = int(max_h * env)
        x = margin + int(t * span)
        # Gradient from accent green to accent blue across the wave.
        r = int(ACCENT[0] + (ACCENT2[0] - ACCENT[0]) * t)
        g = int(ACCENT[1] + (ACCENT2[1] - ACCENT[1]) * t)
        b = int(ACCENT[2] + (ACCENT2[2] - ACCENT[2]) * t)
        rounded_rect(
            d,
            (x - bar_w // 2, center_y - h, x + bar_w // 2, center_y + h),
            bar_w // 2,
            (r, g, b, 255),
        )

    out = os.path.join(os.path.dirname(__file__), 'icon.png')
    img.save(out)
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
