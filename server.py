import http.server
import os
import re

CHUNK = 64 * 1024


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        self._range_remaining = None
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404)
            return None

        size = os.fstat(f.fileno()).st_size
        ctype = self.guess_type(path)
        self._range_remaining = None

        range_header = self.headers.get("Range")
        if range_header:
            m = re.match(r"bytes=(\d*)-(\d*)", range_header.strip())
            if m:
                start_s, end_s = m.groups()
                if start_s == "" and end_s == "":
                    pass
                else:
                    if start_s == "":
                        length = int(end_s)
                        start = max(0, size - length)
                        end = size - 1
                    else:
                        start = int(start_s)
                        end = int(end_s) if end_s else size - 1
                        end = min(end, size - 1)
                    if start >= size or start > end:
                        f.close()
                        self.send_error(416)
                        return None
                    length = end - start + 1
                    self.send_response(206)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Length", str(length))
                    self.end_headers()
                    f.seek(start)
                    self._range_remaining = length
                    return f

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(size))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_range_remaining", None)
        while remaining is None or remaining > 0:
            n = CHUNK if remaining is None else min(CHUNK, remaining)
            data = source.read(n)
            if not data:
                break
            outputfile.write(data)
            if remaining is not None:
                remaining -= len(data)


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(
        ("0.0.0.0", 8765), RangeHandler
    ).serve_forever()
