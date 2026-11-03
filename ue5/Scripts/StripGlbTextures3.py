import json
import os
import struct
import sys

SOURCE_DIR = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\ImportReady"
DEST_DIR = os.path.join(SOURCE_DIR, "stripped3")
MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def read_glb(path):
    with open(path, "rb") as stream:
        data = stream.read()
    magic, version, length = struct.unpack_from("<III", data, 0)
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
    # Keep materials but make them simple (no textures)
    if "images" in doc:
        del doc["images"]
    if "textures" in doc:
        del doc["textures"]
    if "samplers" in doc:
        del doc["samplers"]
    # Simplify materials
    if "materials" in doc:
        new_mats = []
        for i, mat in enumerate(doc["materials"]):
            new_mats.append({
                "name": mat.get("name", f"mat_{i}"),
                "pbrMetallicRoughness": {
                    "baseColorFactor": mat.get("pbrMetallicRoughness", {}).get("baseColorFactor", [0.8, 0.7, 0.6, 1.0]),
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.9
                }
            })
        doc["materials"] = new_mats
    return json.dumps(doc, separators=(",", ":"))


def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    names = sorted(n for n in os.listdir(SOURCE_DIR) if n.lower().endswith(".glb"))
    for name in names[:2]:  # just test first couple
        src = os.path.join(SOURCE_DIR, name)
        dst = os.path.join(DEST_DIR, name)
        json_text, bin_chunk = read_glb(src)
        write_glb(dst, strip(json_text), bin_chunk)
        print(name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
