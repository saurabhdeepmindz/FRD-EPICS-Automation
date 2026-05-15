"""Throwaway: inspect rendered section h2 labels in smoke output."""
import re
import os
import glob

tmpdir = os.environ.get("TEMP") or os.environ.get("TMP") or "."
print("TMP=", tmpdir)
patterns = ["mod-*-frd-preview.html", "mod-*-ftc-preview.html"]
files = []
for p in patterns:
    files.extend(glob.glob(os.path.join(tmpdir, p)))
print("found", len(files), "files")
INTERNAL = [
    re.compile(r"step\s*\d+", re.I),
    re.compile(r"introduction", re.I),
    re.compile(r"output\s*checklist", re.I),
    re.compile(r"validate\s*the\s*frd", re.I),
    re.compile(r"sign[\s-]?off", re.I),
    re.compile(r"definition\s*of\s*done", re.I),
]
section_re = re.compile(r'<section id="sec-[^"]+" class="doc-section">\s*<h2[^>]*>(.+?)</h2>', re.DOTALL)
tag_re = re.compile(r"<[^>]+>")
for f in sorted(files):
    with open(f, encoding="utf-8") as fh:
        html = fh.read()
    labels = section_re.findall(html)
    print(f"\n== {os.path.basename(f)} == ({len(labels)} top-level sections)")
    for raw in labels:
        clean = tag_re.sub("", raw).strip()
        hit = any(p.search(clean) for p in INTERNAL)
        tag = "!! LEAK" if hit else "  ok  "
        print(f"  {tag} {clean[:100]}")
