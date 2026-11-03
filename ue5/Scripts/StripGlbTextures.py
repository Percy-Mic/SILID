# Strip embedded images/textures/materials from prepared SILID furniture GLBs.
#
# Interchange's GLB import deadlocks on this machine at the first embedded
# texture build (four reproductions, 2026-11-02: idle CPU, log frozen at
# "Building textures"). Geometry imports fine, so the stripped copies under
# Saved/ImportReady/stripped keep every mesh and UV while removing the
# texture-build step; the build scripts then assign project materials to the
# imported meshes themselves.
#
# Run with any local python:  python StripGlbTextures.py

import json
import os
import struct
import sys

SOURCE_DIR = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\ImportReady"
DEST_DIR = os.path.join(SOURCE_DIR, "stripped")
MAGIC = 0x46546C67  # 'glTF'
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def read_glb(path):
    with open(path, "rb") as stream:
        data = stream.read()
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != MAGIC:
        raise RuntimeError("not a GLB: " + path)
    offset = 12
    json_chunk = None
    bin_chunk = b""
    while offset < length:
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == CHUNK_JSON:
            json_chunk = payload
        elif chunk_type == CHUNK_BIN:
            bin_chunk = payload
    if json_chunk is None:
        raise RuntimeError("no JSON chunk: " + path)
    return json_chunk.decode("utf-8"), bin_chunk


def write_glb(path, json_text, bin_chunk):
    json_bytes = json_text.encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "
    padded_bin = bin_chunk
    while len(padded_bin) % 4:
        padded_bin += b"\x00"
    total = 12 + 8 + len(json_bytes) + (8 + len(padded_bin) if padded_bin else 0)
    with open(path, "wb") as stream:
        stream.write(struct.pack("<III", MAGIC, 1, total))
        stream.write(struct.pack("<II", len(json_bytes), CHUNK_JSON))
        stream.write(json_bytes)
        if padded_bin:
            stream.write(struct.pack("<II", len(padded_bin), CHUNK_BIN))
            stream.write(padded_bin)


def strip(json_text):
    doc = json.loads(json_text)
    # Drop the texture pipeline wholesale: images, their samplers, the
    # textures that reference them, and the materials that sample them.
    for key in ("images", "textures", "samplers", "materials"):
        doc.pop(key, None)
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            prim.pop("material", None)
            exts = prim.get("extensions")
            if exts:
                for name in [n for n in exts if n.startswith("KHR_materials")]:
                    del exts[name]
                if not exts:
                    del prim["extensions"]
    for holder in (doc, doc.get("asset", {})):
        for list_key in ("extensionsUsed", "extensionsRequired"):
            if list_key in holder:
                holder[list_key] = [e for e in holder[list_key] if not e.startswith("KHR_materials")]
                if not holder[list_key]:
                    del holder[list_key]
    return json.dumps(doc, separators=(",", ":"))


def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    names = sorted(n for n in os.listdir(SOURCE_DIR) if n.lower().endswith(".glb"))
    if not names:
        print("No GLBs found in " + SOURCE_DIR)
        return 1
    for name in names:
        src = os.path.join(SOURCE_DIR, name)
        dst = os.path.join(DEST_DIR, name)
        json_text, bin_chunk = read_glb(src)
        write_glb(dst, strip(json_text), bin_chunk)
        print("stripped %-40s %6d -> %6d bytes" % (
            name, os.path.getsize(src), os.path.getsize(dst)))
    print("Done: %d files in %s" % (len(names), DEST_DIR))
    return 0


if __name__ == "__main__":
    sys.exit(main())
