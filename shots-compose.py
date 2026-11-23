"""shots-compose.py — places each high-res capture on a warm, grainy gradient
at 3840x2160, isolating one component per shot (window corner visible, the rest
bleeding off the frame). Run after: node shots-capture.js"""
import json, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 3840, 2160
RAW = Path(__file__).parent / 'shots' / 'raw'
OUT = Path(__file__).parent / 'shots'

# Warm palette, taken from the prototype (cream, terracotta, amber, peach, a hint of sage)
PALETTE = {
    'cream':  (240, 228, 212), 'paper': (248, 240, 228), 'terracotta': (206, 128, 96),
    'clay':   (184, 104, 78),  'amber': (234, 192, 124), 'peach': (241, 182, 150),
    'sage':   (192, 204, 172),
}

# Per shot: where the window's center lands (fraction of the frame) and the gradient blobs.
LAYOUT = {
    '1-pair':         dict(at=(0.42, 0.40), seed=3,  blobs=['terracotta', 'amber', 'peach', 'paper'], radius=110),
    '2-chips':        dict(at=(0.50, 0.50), seed=7,  blobs=['amber', 'peach', 'sage', 'paper'], radius=72),
    '3-verdict':      dict(at=(0.50, 0.50), seed=11, blobs=['clay', 'peach', 'amber', 'paper'], radius=96, fade=['top']),
    '4-what-changed': dict(at=(0.60, 0.30), seed=5,  blobs=['terracotta', 'peach', 'cream', 'amber'], radius=80, fade=['top']),
    '5-site-label':   dict(at=(0.50, 0.46), seed=13, blobs=['amber', 'terracotta', 'paper', 'sage'], radius=110, fade=['bottom']),
    '6-feedback':     dict(at=(0.50, 0.50), seed=17, blobs=['peach', 'clay', 'paper', 'amber'], radius=80),
    '7-mobile':       dict(at=(0.50, 0.53), seed=19, blobs=['terracotta', 'amber', 'peach', 'paper'], radius=130),
}

def gradient(blobs, seed):
    """Soft mesh-like gradient: big blurred color blobs + film grain + gentle vignette."""
    rnd = random.Random(seed)
    w, h = 384, 216
    base = np.full((h, w, 3), PALETTE['cream'], np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for name in blobs:
        cx, cy = rnd.uniform(0.05, 0.95) * w, rnd.uniform(0.05, 0.95) * h
        r = rnd.uniform(0.35, 0.6) * w
        a = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (r * 0.5) ** 2)))[..., None] * rnd.uniform(0.6, 0.9)
        base = base * (1 - a) + np.array(PALETTE[name], np.float32) * a
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    img = img.filter(ImageFilter.GaussianBlur(40))
    arr = np.asarray(img).astype(np.float32)
    # vignette (very light)
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((X - W / 2) / (W / 2)) ** 2 + ((Y - H / 2) / (H / 2)) ** 2)
    arr *= (1 - 0.06 * np.clip(d - 0.4, 0, 1))[..., None]
    # monochrome film grain
    grain = np.random.default_rng(seed).normal(0, 7, (H, W, 1)).astype(np.float32)
    return Image.fromarray((arr + grain).clip(0, 255).astype(np.uint8))

def rounded_mask(size, radius):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m

def shadow_layer(size, box, radius, blur, opacity, dy):
    sh = Image.new('L', size, 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(sh).rounded_rectangle([x0, y0 + dy, x1, y1 + dy], radius=radius, fill=int(255 * opacity))
    return sh.filter(ImageFilter.GaussianBlur(blur))

def place(canvas, img, xy, radius, shadow=(90, 0.22, 40), border=(222, 212, 196), fade=()):
    """Paste a window with rounded corners, a 1-line border, a soft shadow,
    and optional edge fades (where the crop cuts through content)."""
    img = img.copy()
    ImageDraw.Draw(img).rounded_rectangle([1, 1, img.width - 2, img.height - 2], radius=radius, outline=border, width=4)
    mask = np.asarray(rounded_mask(img.size, radius)).astype(np.float32) / 255
    h = img.height
    ramp = np.ones(h, np.float32)
    n = int(h * 0.20)
    t = np.linspace(0, 1, n) ** 1.4
    if 'top' in fade: ramp[:n] *= t
    if 'bottom' in fade: ramp[-n:] *= t[::-1]
    m = Image.fromarray((mask * ramp[:, None] * 255).astype(np.uint8))
    # The shadow fades out faster than the window, so no light band appears where they meet.
    blur, opacity, dy = shadow
    sm = Image.fromarray((mask * (ramp ** 4)[:, None] * 255 * opacity).astype(np.uint8))
    sh = Image.new('L', canvas.size, 0)
    sh.paste(sm, (xy[0], xy[1] + dy))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(Image.new('RGB', canvas.size, (70, 42, 28)), (0, 0), sh)
    canvas.paste(img, xy, m)

def main():
    meta = json.loads((RAW / 'shots.json').read_text())
    for sid, m in meta.items():
        L = LAYOUT[sid]
        canvas = gradient(L['blobs'], L['seed'])
        shot = Image.open(RAW / f'{sid}.png').convert('RGB')
        x, y = int(L['at'][0] * W - shot.width / 2), int(L['at'][1] * H - shot.height / 2)
        place(canvas, shot, (x, y), L['radius'], fade=L.get('fade', ()))
        if 'floatBelow' in m:
            # Float the expanded card just under the verdict line, sliding past the window's left edge.
            card = Image.open(RAW / f'{sid}-float.png').convert('RGB')
            d, c = m['dsf'], m['clip']
            bx0, by1 = (m['floatBelow'][0] - c[0]) * d, (m['floatBelow'][3] - c[1]) * d
            fx, fy = x + int(bx0 - card.width * 0.28), y + int(by1 + 48)
            place(canvas, card, (fx, fy), int(12 * d * m['floatScale']), shadow=(80, 0.32, 56), border=(230, 220, 204))
        canvas.save(OUT / f'{sid}.png', optimize=True)
        canvas.resize((960, 540), Image.LANCZOS).save(RAW / f'{sid}-thumb.png')
        print('composed', sid, shot.size)

if __name__ == '__main__':
    main()
