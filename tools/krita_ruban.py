"""Repare le marque-page dore : part de la v3, remet le ruban d'origine, puis le retouche sans lettres."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import krita_comfy as kc

work = Path(sys.argv[1])
sx, sy = kc.W / 299, kc.H / 282
box = [66 * sx, 52 * sy, 108 * sx, 112 * sy]

base = Image.open(work / "03-runes-v3.png").convert("RGB")
src = Image.open(work / "02-agrandi.png").convert("RGB")
m = Image.new("L", base.size, 0)
ImageDraw.Draw(m).ellipse(box, fill=255)
m = m.filter(ImageFilter.GaussianBlur(8))
Image.composite(src, base, m).save(work / "04-base-ruban.png")
m.convert("RGB").save(work / "masque-runes.png")  # le script principal lit ce nom

kc.POS_RUNES = ("ornate golden ribbon bookmark tucked in parchment, (engraved abstract geometric patterns:1.3), "
                "filigree, metallic gold, small cyan glow, digital painting, sharp")
for i, (seed, dn) in enumerate(((11, 0.55), (222, 0.6), (3333, 0.65)), 1):
    kc.common_seed = seed
    img = kc.upload(work / "04-base-ruban.png")
    msk = kc.upload(work / "masque-runes.png")
    g = kc.common(seed, kc.POS_RUNES, kc.NEG_RUNES, dn, ["nm", 0])
    g.update({
        "li": {"class_type": "LoadImage", "inputs": {"image": img}},
        "lm": {"class_type": "LoadImageMask", "inputs": {"image": msk, "channel": "red"}},
        "enc": {"class_type": "VAEEncode", "inputs": {"pixels": ["li", 0], "vae": ["ck", 2]}},
        "nm": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["enc", 0], "mask": ["lm", 0]}},
        "cmp": {"class_type": "ImageCompositeMasked", "inputs": {
            "destination": ["li", 0], "source": ["dec", 0], "x": 0, "y": 0,
            "resize_source": False, "mask": ["lm", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["cmp", 0], "filename_prefix": "udpt_ruban"}},
    })
    kc.run(g, work / f"05-final-v{i}.png")
