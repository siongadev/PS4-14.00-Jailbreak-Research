"""Read one member from a large public ZIP using HTTP byte ranges.

This is a source-inspection aid. It refuses servers that ignore Range and caps
each request and extracted member so it cannot silently download a full archive.
"""

import argparse
import hashlib
import io
import sys
import urllib.request
import zipfile
from collections import OrderedDict
from pathlib import Path


BLOCK_SIZE = 4 * 1024 * 1024
MAX_CACHED_BLOCKS = 4
MAX_MEMBER_SIZE = 16 * 1024 * 1024
MAX_TOTAL_TRANSFER = 128 * 1024 * 1024


class HTTPRangeReader(io.RawIOBase):
    def __init__(self, url):
        self.url = url
        request = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(request, timeout=30) as response:
            self.length = int(response.headers["Content-Length"])
            if "bytes" not in response.headers.get("Accept-Ranges", ""):
                raise ValueError("server does not advertise HTTP byte ranges")
        self.position = 0
        self.cache = OrderedDict()
        self.transferred = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        if whence == io.SEEK_SET:
            position = offset
        elif whence == io.SEEK_CUR:
            position = self.position + offset
        elif whence == io.SEEK_END:
            position = self.length + offset
        else:
            raise ValueError("invalid seek mode")
        if position < 0:
            raise ValueError("negative seek")
        self.position = position
        return position

    def _block(self, block_number):
        if block_number in self.cache:
            self.cache.move_to_end(block_number)
            return self.cache[block_number]
        start = block_number * BLOCK_SIZE
        end = min(start + BLOCK_SIZE, self.length) - 1
        if self.transferred + end - start + 1 > MAX_TOTAL_TRANSFER:
            raise ValueError("remote ZIP transfer exceeds 128 MiB limit")
        request = urllib.request.Request(
            self.url, headers={"Range": f"bytes={start}-{end}"}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status != 206:
                raise ValueError(f"server ignored Range (HTTP {response.status})")
            content_range = response.headers.get("Content-Range", "")
            if content_range != f"bytes {start}-{end}/{self.length}":
                raise ValueError(f"unexpected Content-Range: {content_range}")
            data = response.read(BLOCK_SIZE + 1)
        if len(data) != end - start + 1:
            raise ValueError("short or oversized HTTP range response")
        self.transferred += len(data)
        self.cache[block_number] = data
        if len(self.cache) > MAX_CACHED_BLOCKS:
            self.cache.popitem(last=False)
        return data

    def read(self, size=-1):
        if self.position >= self.length:
            return b""
        if size < 0:
            size = self.length - self.position
        remaining = min(size, self.length - self.position)
        chunks = []
        while remaining:
            block_number, offset = divmod(self.position, BLOCK_SIZE)
            block = self._block(block_number)
            piece = block[offset : offset + remaining]
            if not piece:
                raise ValueError("empty block slice")
            chunks.append(piece)
            self.position += len(piece)
            remaining -= len(piece)
        return b"".join(chunks)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("suffix", help="unique archive member suffix")
    parser.add_argument("--contains", action="store_true", help="list members containing this text instead")
    parser.add_argument("--out", type=Path, help="output file; omit to list matches")
    args = parser.parse_args()

    reader = HTTPRangeReader(args.url)
    with zipfile.ZipFile(reader) as archive:
        matches = [entry for entry in archive.infolist()
                   if (args.suffix in entry.filename if args.contains
                       else entry.filename.endswith(args.suffix))]
        for entry in matches:
            print(f"{entry.filename}\t{entry.file_size} bytes")
        if args.out:
            if len(matches) != 1:
                raise ValueError(f"expected one matching member, got {len(matches)}")
            entry = matches[0]
            if entry.file_size > MAX_MEMBER_SIZE:
                raise ValueError("member exceeds size limit")
            data = archive.read(entry)
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_bytes(data)
            print(f"SHA-256 {hashlib.sha256(data).hexdigest()}")
    print(f"Transferred {reader.transferred:,} of {reader.length:,} archive bytes", file=sys.stderr)


if __name__ == "__main__":
    main()
