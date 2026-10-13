"""Pilote le moteur ComfyUI de Krita AI Diffusion (http://127.0.0.1:8188).
Etapes : agrandissement + affinage, puis remplacement des fausses lettres par des runes.
Usage : py -3.12 krita_comfy.py <dossier_de_travail>
"""
import json, sys, time, uuid, urllib.request, urllib.parse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

URL = "http://127.0.0.1:8188"
CKPT = "zavychromaxl_v80.safetensors"
UPSCALER = "4x_NMKD-Superscale-SP_178000_G.pth"
W, H = 1024, 968  # 299x282 -> multiple de 8, ratio conserve

POS_BASE = ("fantasy game icon, isometric view, pile of aged parchment scrolls, orange wax seal, "
            "golden ornate borders, neon hexagon frame orange left cyan right, dark navy background, "
            "digital painting, sharp details, high quality")
NEG_BASE = "blurry, lowres, jpeg artifacts, watermark, text, letters, photo"
POS_RUNES = ("(abstract glowing cyan runes:1.3), geometric arcane glyphs, magic symbols engraved on parchment, "
             "circuit-like engravings, soft cyan glow, digital painting")
NEG_RUNES = "(letters:1.4), (text:1.4), words, alphabet, numbers, writing, latin, cyrillic, blurry"

# Zones des fausses lettres, en coordonnees de l'image d'origine (299x282)
ZONES = [
    ("ellipse", (93, 106, 142, 141)),   # feuille du dessus
    ("ellipse", (158, 182, 216, 217)),  # rouleau de droite
    ("ellipse", (68, 62, 104, 108)),    # marque-page a gauche
]


def post(path, data, headers=None):
    req = urllib.request.Request(URL + path, data=data, headers=headers or {}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def upload(p: Path):
    b = "----kc" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{p.name}\"\r\n"
            f"Content-Type: image/png\r\n\r\n").encode() + p.read_bytes() + \
           f"\r\n--{b}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{b}--\r\n".encode()
    return post("/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={b}"})["name"]


def run(graph, out: Path):
    pid = post("/prompt", json.dumps({"prompt": graph, "client_id": "claude"}).encode(),
               {"Content-Type": "application/json"})["prompt_id"]
    t0 = time.time()
    while True:
        time.sleep(2)
        with urllib.request.urlopen(f"{URL}/history/{pid}") as r:
            h = json.loads(r.read())
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st)[:2000])
            for node in h[pid]["outputs"].values():
                for img in node.get("images", []):
                    q = urllib.parse.urlencode({k: img[k] for k in ("filename", "subfolder", "type")})
                    with urllib.request.urlopen(f"{URL}/view?{q}") as r:
                        out.write_bytes(r.read())
                    print("OK", out.name, f"{time.time()-t0:.0f}s")
                    return
        if time.time() - t0 > 600:
            raise TimeoutError(pid)


def common(seed, pos, neg, denoise, latent_from):
    return {
        "ck": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "p": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["ck", 1]}},
        "n": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["ck", 1]}},
        "ks": {"class_type": "KSampler", "inputs": {
            "model": ["ck", 0], "positive": ["p", 0], "negative": ["n", 0], "latent_image": latent_from,
            "seed": seed, "steps": 28, "cfg": 6.0, "sampler_name": "dpmpp_2m", "scheduler": "karras",
            "denoise": denoise}},
        "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["ks", 0], "vae": ["ck", 2]}},
    }


def upscale(work: Path):
    name = upload(work / "01-original.png")
    g = common(42, POS_BASE, NEG_BASE, 0.32, ["enc", 0])
    g.update({
        "li": {"class_type": "LoadImage", "inputs": {"image": name}},
        "um": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": UPSCALER}},
        "up": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["um", 0], "image": ["li", 0]}},
        "sc": {"class_type": "ImageScale", "inputs": {"image": ["up", 0], "upscale_method": "lanczos",
                                                       "width": W, "height": H, "crop": "disabled"}},
        "enc": {"class_type": "VAEEncode", "inputs": {"pixels": ["sc", 0], "vae": ["ck", 2]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["dec", 0], "filename_prefix": "udpt_upscale"}},
    })
    run(g, work / "02-agrandi.png")


def make_mask(work: Path):
    sx, sy = W / 299, H / 282
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    for _, (x0, y0, x1, y1) in ZONES:
        d.ellipse([x0 * sx, y0 * sy, x1 * sx, y1 * sy], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(10))
    m.convert("RGB").save(work / "masque-runes.png")


def runes(work: Path, seed: int, idx: int):
    img = upload(work / "02-agrandi.png")
    msk = upload(work / "masque-runes.png")
    g = common(seed, POS_RUNES, NEG_RUNES, 0.85, ["nm", 0])
    g.update({
        "li": {"class_type": "LoadImage", "inputs": {"image": img}},
        "lm": {"class_type": "LoadImageMask", "inputs": {"image": msk, "channel": "red"}},
        "enc": {"class_type": "VAEEncode", "inputs": {"pixels": ["li", 0], "vae": ["ck", 2]}},
        "nm": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["enc", 0], "mask": ["lm", 0]}},
        "cmp": {"class_type": "ImageCompositeMasked", "inputs": {
            "destination": ["li", 0], "source": ["dec", 0], "x": 0, "y": 0,
            "resize_source": False, "mask": ["lm", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["cmp", 0], "filename_prefix": "udpt_runes"}},
    })
    run(g, work / f"03-runes-v{idx}.png")


if __name__ == "__main__":
    work = Path(sys.argv[1])
    step = sys.argv[2] if len(sys.argv) > 2 else "all"
    if step in ("all", "upscale"):
        upscale(work)
    if step in ("all", "runes"):
        make_mask(work)
        for i, s in enumerate((7, 1234, 98765), 1):
            runes(work, s, i)
