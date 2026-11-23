"""shots-v2-compose.py — composes shots/v2/raw on the warm gradient (same look as shots-compose.py).
Decision shots: 3840x2160. Iteration images (i-*): same sizes as the earlier g-* pairs."""
import json, importlib.util
from pathlib import Path
from PIL import Image
spec = importlib.util.spec_from_file_location('sc', Path(__file__).parent / 'shots-compose.py')
sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
RAW = Path(__file__).parent / 'shots/v2/raw'; OUT = Path(__file__).parent / 'shots/v2'
B = ['terracotta', 'amber', 'peach', 'paper']
LAYOUT = {
  'hero':       dict(at=(0.42, 0.40), seed=3,  blobs=B, radius=110),
  'd-pair':     dict(at=(0.42, 0.40), seed=23, blobs=['clay', 'amber', 'peach', 'paper'], radius=110),
  'd-pills':    dict(at=(0.50, 0.50), seed=7,  blobs=['amber', 'peach', 'sage', 'paper'], radius=72),
  'd-logos':    dict(at=(0.50, 0.50), seed=29, blobs=['peach', 'amber', 'cream', 'sage'], radius=72),
  'd-popover':  dict(at=(0.50, 0.50), seed=31, blobs=['terracotta', 'peach', 'amber', 'paper'], radius=90),
  'd-quiet':    dict(at=(0.50, 0.50), seed=37, blobs=['sage', 'paper', 'amber', 'cream'], radius=90),
  'd-verdict':  dict(at=(0.50, 0.50), seed=11, blobs=['clay', 'peach', 'amber', 'paper'], radius=96, fade=['top']),
  'd-attrib':   dict(at=(0.60, 0.30), seed=5,  blobs=['terracotta', 'peach', 'cream', 'amber'], radius=80, fade=['top']),
  'd-site':     dict(at=(0.50, 0.50), seed=13, blobs=['amber', 'terracotta', 'paper', 'sage'], radius=110),
  'd-badge':    dict(at=(0.50, 0.50), seed=41, blobs=['sage', 'peach', 'paper', 'amber'], radius=90),
  'd-feedback': dict(at=(0.50, 0.50), seed=17, blobs=['peach', 'clay', 'paper', 'amber'], radius=80),
  'mobile':     dict(at=(0.50, 0.53), seed=19, blobs=B, radius=130),
}
ITER = {'i-pills': (2400, 1000), 'i-chips': (2400, 1000), 'i-panel': (2400, 1500), 'i-popover': (2400, 1500)}

def main():
    meta = json.loads((RAW / 'shots.json').read_text())
    for sid, L in LAYOUT.items():
        m = meta[sid]; canvas = sc.gradient(L['blobs'], L['seed'])
        shot = Image.open(RAW / f'{sid}.png').convert('RGB')
        if shot.width > sc.W * 0.94 or shot.height > sc.H * 0.94 and not L.get('fade'):
            k = min(sc.W * 0.94 / shot.width, sc.H * 0.94 / shot.height, 1); shot = shot.resize((int(shot.width * k), int(shot.height * k)), Image.LANCZOS)
        x, y = int(L['at'][0] * sc.W - shot.width / 2), int(L['at'][1] * sc.H - shot.height / 2)
        sc.place(canvas, shot, (x, y), L['radius'], fade=L.get('fade', ()))
        if 'floatBelow' in m:
            card = Image.open(RAW / f'{sid}-float.png').convert('RGB'); d, c = m['dsf'], m['clip']
            bx0, by1 = (m['floatBelow'][0] - c[0]) * d, (m['floatBelow'][3] - c[1]) * d
            sc.place(canvas, card, (x + int(bx0 - card.width * 0.28), y + int(by1 + 48)), int(12 * d * m['floatScale']), shadow=(80, 0.32, 56), border=(230, 220, 204))
        canvas.convert('RGB').save(OUT / f'{sid}.jpg', quality=88, optimize=True); print('composed', sid)
    for sid, (w, h) in ITER.items():
        # Gradient scaled to the pair's size, window centered at ~80% width
        g = sc.gradient(B, 53).resize((w, h), Image.LANCZOS) if h != 1000 else sc.gradient(['amber', 'peach', 'sage', 'paper'], 7).crop((0, 0, 3840, 1600)).resize((w, h), Image.LANCZOS)
        shot = Image.open(RAW / f'{sid}.png').convert('RGB')
        k = 2400 * 0.82 / 1680 if sid in ('i-pills', 'i-chips') else min(w * 0.82 / shot.width, h * 0.82 / shot.height); shot = shot.resize((int(shot.width * k), int(shot.height * k)), Image.LANCZOS)
        sc.place(g, shot, ((w - shot.width) // 2, (h - shot.height) // 2 if sid not in ('i-pills', 'i-chips') else 150), 28)
        g.convert('RGB').save(OUT / f'{sid}.jpg', quality=88, optimize=True); print('composed', sid)

if __name__ == '__main__': main()
