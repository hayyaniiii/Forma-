"""Spotify download operations via spotdl."""

import importlib.util
import json
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path
import urllib.request
from bs4 import BeautifulSoup

SPOTIFY_URL_PATTERNS = {
    "track": re.compile(r"(?:open\.spotify\.com/track/|spotify:track:)", re.I),
    "album": re.compile(r"(?:open\.spotify\.com/album/|spotify:album:)", re.I),
    "playlist": re.compile(r"(?:open\.spotify\.com/playlist/|spotify:playlist:)", re.I),
}

ANSI_ESCAPE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def _subprocess_kwargs() -> dict:
    kwargs = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    return kwargs


STATUS_PROGRESS = {
    "Processing": 8,
    "Downloading": 40,
    "Converting": 72,
    "Embedding metadata": 88,
    "Done": 100,
    "Skipped": 100,
    "Error": 100,
}
STATUSES = "|".join(re.escape(s) for s in STATUS_PROGRESS)
TRACK_LINE = re.compile(
    rf"^(?:\d{{4}}-\d{{2}}-\d{{2}}.*?\s+)?(?:INFO|WARNING|ERROR)(?:\s+\S+){{0,3}}\s+"
    rf"(?P<name>.+):\s+(?P<status>{STATUSES})$"
)
SIMPLE_TRACK_LINE = re.compile(rf"^(?P<name>.+):\s+(?P<status>{STATUSES})$")
OVERALL_LINE = re.compile(r"(?P<done>\d+)/(?P<total>\d+)\s+complete", re.I)


def _spotdl_scripts_exe() -> Path | None:
    if sys.platform != "win32":
        return None
    for scripts in (
        Path(sys.executable).parent / "Scripts",
        Path(sys.executable).parent.parent / "Scripts",
    ):
        for name in ("spotdl.exe", "spotdl"):
            candidate = scripts / name
            if candidate.is_file():
                return candidate
    return None


def spotdl_available() -> bool:
    if _spotdl_scripts_exe():
        return True
    if shutil.which("spotdl"):
        return True
    importlib.invalidate_caches()
    return importlib.util.find_spec("spotdl") is not None


def _spotdl_cmd_prefix() -> list[str]:
    bundled = _spotdl_scripts_exe()
    if bundled:
        return [str(bundled)]
    exe = shutil.which("spotdl")
    if exe:
        return [exe]
    importlib.invalidate_caches()
    if importlib.util.find_spec("spotdl") is not None:
        return [sys.executable, "-m", "spotdl"]
    return []


def detect_link_type(url: str) -> str | None:
    u = (url or "").strip()
    if not u:
        return None
    for kind, pattern in SPOTIFY_URL_PATTERNS.items():
        if pattern.search(u):
            return kind
    return None


def _is_spotify_url(url: str) -> bool:
    return detect_link_type(url) is not None


def get_spotify_info(url: str) -> dict:
    link_type = detect_link_type(url)
    if not link_type:
        return {"error": "Not a valid Spotify URL"}
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read()
        soup = BeautifulSoup(html, 'html.parser')
        title_meta = soup.find('meta', property='og:title')
        desc_meta = soup.find('meta', property='og:description')
        title = title_meta['content'] if title_meta else None
        desc = desc_meta['content'] if desc_meta else None
        return {
            "title": title,
            "description": desc,
            "type": link_type,
            "url": url
        }
    except Exception as e:
        return {"error": str(e)}


def _clean_line(text: str) -> str:
    text = ANSI_ESCAPE.sub("", text).replace("\r", "").strip()
    if not text:
        return ""
    if set(text) <= {"─", "━", "│", " ", "="}:
        return ""
    if "%" in text and "complete" not in text.lower():
        return ""
    return text


def _parse_track_line(text: str) -> dict | None:
    for pattern in (TRACK_LINE, SIMPLE_TRACK_LINE):
        match = pattern.match(text)
        if not match:
            continue
        name = match.group("name").strip()
        status = match.group("status").strip()
        if not name or name.lower().startswith("spotdl"):
            return None
        track_id = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or name
        progress = STATUS_PROGRESS.get(status, 10)
        return {
            "type": "track",
            "id": track_id,
            "name": name,
            "status": status,
            "progress": progress,
            "done": status in ("Done", "Skipped"),
            "error": status == "Error",
        }
    return None


def _parse_overall_line(text: str) -> dict | None:
    match = OVERALL_LINE.search(text)
    if not match:
        return None
    done = int(match.group("done"))
    total = int(match.group("total"))
    if total <= 0:
        return None
    return {
        "type": "overall",
        "completed": done,
        "total": total,
        "progress": int(done / total * 100),
    }


def _snapshot_files(directory: Path) -> set[str]:
    if not directory.is_dir():
        return set()
    return {f.name for f in directory.iterdir() if f.is_file()}


def _zip_files(files: list[Path], zip_path: Path) -> Path:
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, arcname=path.name)
    return zip_path


def stream_spotify_download(url: str, output_dir: str | Path, *, as_zip: bool = False):
    """Yield SSE-style event dicts while spotdl runs."""
    u = (url or "").strip()
    if not u or not _is_spotify_url(u):
        yield {"type": "error", "message": "Invalid Spotify URL."}
        return

    out = Path(output_dir)
    if not out.is_dir():
        yield {"type": "error", "message": f"Output folder does not exist: {out}"}
        return

    prefix = _spotdl_cmd_prefix()
    if not prefix:
        yield {
            "type": "error",
            "message": "spotdl is not installed. Run: py -m pip install spotdl",
        }
        return

    link_type = detect_link_type(u)
    yield {"type": "start", "link_type": link_type}

    before_files = _snapshot_files(out)

    output_template = str(out / "{artists} - {title}.{output-ext}")
    cmd = [
        *prefix,
        u,
        "--output",
        output_template,
        "--overwrite",
        "skip",
        "--simple-tui",
        "--log-level",
        "INFO",
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=str(out),
            **_subprocess_kwargs(),
        )
    except OSError as exc:
        yield {"type": "error", "message": str(exc)}
        return

    seen_tracks: dict[str, str] = {}

    assert proc.stdout is not None
    for raw in proc.stdout:
        text = _clean_line(raw)
        if not text:
            continue

        overall = _parse_overall_line(text)
        if overall:
            yield overall
            continue

        track = _parse_track_line(text)
        if track:
            key = f"{track['id']}:{track['status']}"
            if track["status"] in ("Downloading", "Converting", "Embedding metadata"):
                last = seen_tracks.get(track["id"])
                if last == track["status"]:
                    continue
                seen_tracks[track["id"]] = track["status"]
                
                # Enforce max 100 tracks
                if len(seen_tracks) >= 100:
                    yield {"type": "log", "line": "Playlist size limit reached (100). Terminating download."}
                    proc.terminate()
                    break

            yield track
            continue

        if "error" in text.lower() and "downloading" not in text.lower():
            yield {"type": "log", "line": text}

    code = proc.wait()
    if code == 0:
        done: dict = {"type": "done", "code": code, "output_dir": str(out)}
        new_files = sorted(
            out / name for name in (_snapshot_files(out) - before_files)
        )
        if as_zip and len(new_files) > 1:
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            zip_path = out / f"spotify_download_{stamp}.zip"
            _zip_files(new_files, zip_path)
            for path in new_files:
                path.unlink(missing_ok=True)
            done["zip_path"] = str(zip_path)
            done["file_count"] = len(new_files)
        yield done
    else:
        yield {"type": "done", "code": code, "error": f"spotdl exited with code {code}"}


def sse_encode(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"
