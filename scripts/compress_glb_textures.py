"""Shrink a .glb by re-encoding its textures, without touching geometry.

Sketchfab exports carry every normal and metallic-roughness map as lossless PNG
at 1024 px. For a photographic normal map that is 1.4-1.8 MB per map: the
supplied Old Forest Well is 11.2 MB, of which 9.2 MB is four sets of PNGs the
GPU will decode to the same 1024x1024 RGBA it would get from a 120 KB JPEG.

This rewrites the binary chunk in place rather than round-tripping through
Blender, so the node graph, the material bindings and the vertex data are the
bytes the author exported. Base-colour JPEGs are left alone (they are already
compressed at the quality the author chose); PNG maps are re-encoded at 4:4:4
so the packed metalness and roughness channels are not smeared by chroma
subsampling.

    python scripts/compress_glb_textures.py in.glb out.glb [--max 1024] [--quality 92]

Re-run it whenever the source .glb is replaced; the game reads the output from
public/assets/models/.
"""

import argparse
import io
import json
import struct
import sys

from PIL import Image


def read_glb(path):
    blob = open(path, 'rb').read()
    if blob[:4] != b'glTF':
        raise SystemExit(f'{path}: not a glTF binary')
    json_len, _ = struct.unpack('<II', blob[12:20])
    doc = json.loads(blob[20:20 + json_len])
    bin_off = 20 + json_len
    bin_len, _ = struct.unpack('<II', blob[bin_off:bin_off + 8])
    return doc, blob[bin_off + 8:bin_off + 8 + bin_len]


def view_bytes(doc, bin_, index):
    view = doc['bufferViews'][index]
    start = view.get('byteOffset', 0)
    return bin_[start:start + view['byteLength']]


def encode(data, mime, max_px, quality):
    img = Image.open(io.BytesIO(data))
    if max_px and max(img.size) > max_px:
        scale = max_px / max(img.size)
        img = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')
    buf = io.BytesIO()
    # subsampling=0 is 4:4:4: a 4:2:0 normal map develops a visible green fringe,
    # and a metallic-roughness map smears its packed channels into the albedo.
    img.save(buf, format='JPEG', quality=quality, subsampling=0, optimize=True)
    return buf.getvalue(), 'image/jpeg'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--max', type=int, default=1024, help='longest texture edge, px')
    ap.add_argument('--quality', type=int, default=92)
    args = ap.parse_args()

    doc, bin_ = read_glb(args.src)
    before = len(bin_)

    # Re-encode only what is lossless and heavy; keep author-compressed JPEGs.
    replaced = {}
    for i, image in enumerate(doc.get('images', [])):
        if image.get('mimeType') != 'image/png':
            continue
        data = view_bytes(doc, bin_, image['bufferView'])
        new_data, mime = encode(data, image['mimeType'], args.max, args.quality)
        # A lossless-to-lossless swap that grew is not worth keeping.
        if len(new_data) >= len(data):
            continue
        replaced[image['bufferView']] = new_data
        image['mimeType'] = mime
        print(f'  {i:2d} {doc["bufferViews"][image["bufferView"]].get("name", "?"):32s} '
              f'{len(data) // 1024:5d} KB -> {len(new_data) // 1024:5d} KB')

    # Rebuild the binary chunk so the dropped bytes are actually dropped.
    out_bin = bytearray()
    for i, view in enumerate(doc['bufferViews']):
        data = replaced.get(i)
        if data is None:
            data = view_bytes(doc, bin_, i)
        out_bin.extend(b'\0' * (-len(out_bin) % 4))
        view['byteOffset'] = len(out_bin)
        view['byteLength'] = len(data)
        out_bin.extend(data)
    out_bin.extend(b'\0' * (-len(out_bin) % 4))

    doc['buffers'][0]['byteLength'] = len(out_bin)

    js = json.dumps(doc, separators=(',', ':')).encode('utf8')
    js += b' ' * (-len(js) % 4)
    with open(args.dst, 'wb') as fh:
        fh.write(b'glTF')
        fh.write(struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(out_bin)))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack('<II', len(out_bin), 0x004E4942))
        fh.write(out_bin)

    import os
    print(f'bin {before // 1024} KB -> {len(out_bin) // 1024} KB; '
          f'file {os.path.getsize(args.src) // 1024} KB -> {os.path.getsize(args.dst) // 1024} KB')


if __name__ == '__main__':
    sys.exit(main())
