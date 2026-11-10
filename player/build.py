import re
from pathlib import Path

root = Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")
js = (root / "app.js").read_text(encoding="utf-8")

SAMPLES_HTML = """
    <div class="samples">
      <span>或快速加载：</span>
      <button class="sample-btn" data-src="data/Kendrick Lamar - N95 (Official Audio).wav">N95</button>
    </div>
"""

html = re.sub(r'\s*<div class="samples">.*?</div>\n', SAMPLES_HTML, html, flags=re.S)
html = html.replace(
    '<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>"
)
html = html.replace('<script src="app.js"></script>', f"<script>\n{js}\n</script>")

out = root.parent / "transcribe-player.html"
out.write_text(html, encoding="utf-8")
print(f"written: {out} ({out.stat().st_size} bytes)")
