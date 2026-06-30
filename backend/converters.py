import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

MAX_FILE_BYTES = 500 * 1024 * 1024
CONVERSION_TIMEOUT_SEC = 300


def _subprocess_kwargs() -> dict:
    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    return kwargs


class ConversionError(Exception):
    pass


def _run(cmd: list[str], timeout: int = CONVERSION_TIMEOUT_SEC) -> None:
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            **_subprocess_kwargs(),
        )
    except subprocess.TimeoutExpired as exc:
        raise ConversionError("Conversion timed out (5 min limit).") from exc
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "Unknown FFmpeg error").strip()
        raise ConversionError(err[:500])


def ffmpeg_path() -> str | None:
    return shutil.which("ffmpeg")


def ffprobe_path() -> str | None:
    return shutil.which("ffprobe")


def _ytdlp_scripts_exe() -> Path | None:
    """pip on Windows installs yt-dlp.exe next to python.exe (often not on PATH)."""
    if sys.platform != "win32":
        return None
    for scripts in (
        Path(sys.executable).parent / "Scripts",
        Path(sys.executable).parent.parent / "Scripts",
    ):
        for name in ("yt-dlp.exe", "yt-dlp", "yt_dlp.exe"):
            candidate = scripts / name
            if candidate.is_file():
                return candidate
    return None


def ytdlp_available() -> bool:
    """True if yt-dlp can be run by this Python process."""
    if _ytdlp_scripts_exe():
        return True
    if shutil.which("yt-dlp") or shutil.which("yt_dlp"):
        return True
    return importlib.util.find_spec("yt_dlp") is not None


def _ytdlp_cmd_prefix() -> list[str]:
    """Command prefix to invoke yt-dlp."""
    bundled = _ytdlp_scripts_exe()
    if bundled:
        return [str(bundled)]
    exe = shutil.which("yt-dlp") or shutil.which("yt_dlp")
    if exe:
        return [exe]
    if importlib.util.find_spec("yt_dlp") is not None:
        return [sys.executable, "-m", "yt_dlp"]
    return []


def ytdlp_path() -> str | None:
    """Legacy helper — non-None when downloads can run."""
    prefix = _ytdlp_cmd_prefix()
    return prefix[0] if prefix else None


def check_ffmpeg() -> dict:
    ff = ffmpeg_path()
    if not ff:
        return {"ok": False, "message": "FFmpeg not found on PATH."}
    try:
        proc = subprocess.run(
            [ff, "-version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
            **_subprocess_kwargs(),
        )
        line = (proc.stdout or "").splitlines()[0] if proc.stdout else "FFmpeg available"
        return {"ok": True, "message": line}
    except OSError as exc:
        return {"ok": False, "message": str(exc)}


def _load_image(input_path: Path) -> Image.Image:
    if input_path.suffix.lower() == ".svg":
        from svglib.svglib import svg2rlg
        from reportlab.graphics import renderPM
        import tempfile
        drawing = svg2rlg(str(input_path))
        if drawing is None:
            raise ConversionError("Could not parse SVG file.")
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_png = Path(tmp.name)
        try:
            renderPM.drawToFile(drawing, str(tmp_png), fmt="PNG")
            with Image.open(tmp_png) as img:
                img.load()
                return img.copy()
        finally:
            tmp_png.unlink(missing_ok=True)
    else:
        return Image.open(input_path)


def convert_image(
    input_path: Path,
    output_path: Path,
    target_ext: str,
    quality: int = 85,
) -> Path:
    target = target_ext.lower().replace("jpeg", "jpg")

    if target == "svg":
        import vtracer
        import tempfile
        # vtracer works best with PNG, so we'll save a temp PNG first
        img = _load_image(input_path)
        if img.mode != "RGB" and img.mode != "RGBA":
            img = img.convert("RGBA")
        out = output_path.with_suffix(".svg")
        
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_png = Path(tmp.name)
        try:
            img.save(tmp_png, format="PNG")
            img.close()
            vtracer.convert_image_to_svg_py(
                str(tmp_png),
                str(out),
                colormode='color',
                hierarchical='stacked',
                mode='spline',
                filter_speckle=4,
                color_precision=6,
                layer_difference=16,
                corner_threshold=60,
                length_threshold=4.0,
                max_iterations=10,
                splice_threshold=45,
                path_precision=8
            )
            return out
        finally:
            tmp_png.unlink(missing_ok=True)

    img = _load_image(input_path)
    if img.mode in ("RGBA", "LA", "P") and target in ("jpg", "jpeg"):
        img = img.convert("RGB")

    fmt_map = {
        "jpg": "JPEG",
        "jpeg": "JPEG",
        "png": "PNG",
        "webp": "WEBP",
        "bmp": "BMP",
        "tiff": "TIFF",
        "tif": "TIFF",
        "ico": "ICO",
        "gif": "GIF",
    }
    pil_format = fmt_map.get(target, "PNG")
    save_kw: dict = {}
    if pil_format == "JPEG":
        save_kw["quality"] = quality
        save_kw["optimize"] = True
    elif pil_format == "WEBP":
        save_kw["quality"] = quality

    out = output_path.with_suffix(f".{target_ext.lower().replace('jpeg', 'jpg')}")
    img.save(out, format=pil_format, **save_kw)
    return out


def compress_image_to_size(
    input_path: Path,
    output_path: Path,
    target_bytes: int,
    max_dimension: int | None = None,
) -> Path:
    img = _load_image(input_path)
    if max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    ext = input_path.suffix.lower().lstrip(".")
    use_jpeg = ext in ("jpg", "jpeg") or img.mode == "RGB"
    out = output_path.with_suffix(".jpg" if use_jpeg else ".png")
    if not use_jpeg and img.mode == "RGBA":
        pass
    elif img.mode in ("RGBA", "P"):
        if use_jpeg:
            img = img.convert("RGB")

    low, high = 10, 95
    best = None
    while low <= high:
        mid = (low + high) // 2
        tmp = out.with_name(f"_probe_{mid}{out.suffix}")
        if use_jpeg:
            img.save(tmp, "JPEG", quality=mid, optimize=True)
        else:
            img.save(tmp, "PNG", optimize=True)
        size = tmp.stat().st_size
        if size <= target_bytes:
            best = tmp
            low = mid + 1
        else:
            tmp.unlink(missing_ok=True)
            high = mid - 1

    if best is None:
        if use_jpeg:
            img.save(out, "JPEG", quality=30, optimize=True)
        else:
            img.save(out, "PNG", optimize=True)
    else:
        best.replace(out)
    return out


def convert_with_ffmpeg(
    input_path: Path,
    output_path: Path,
    target_ext: str,
    *,
    audio_only: bool = False,
    video_bitrate: str | None = None,
    audio_bitrate: str = "192k",
    quality: int | None = None,
) -> Path:
    ff = ffmpeg_path()
    if not ff:
        raise ConversionError("FFmpeg is not installed. Install FFmpeg and add it to PATH.")

    out = output_path.with_suffix(f".{target_ext.lower()}")
    cmd = [ff, "-y", "-i", str(input_path)]

    if audio_only:
        cmd += ["-vn", "-acodec"]
        if target_ext == "mp3":
            cmd += ["libmp3lame", "-b:a", audio_bitrate]
        elif target_ext == "aac":
            cmd += ["aac", "-b:a", audio_bitrate]
        elif target_ext == "flac":
            cmd += ["flac"]
        elif target_ext == "ogg":
            cmd += ["libvorbis", "-b:a", audio_bitrate]
        elif target_ext == "opus":
            cmd += ["libopus", "-b:a", audio_bitrate]
        else:
            cmd += ["copy"]
    else:
        if target_ext == "gif":
            cmd += ["-vf", "fps=10,scale=480:-1:flags=lanczos", "-loop", "0"]
        elif target_ext == "mp4":
            cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", str(quality or 23)]
            cmd += ["-c:a", "aac", "-b:a", audio_bitrate]
        elif target_ext == "webm":
            cmd += ["-c:v", "libvpx-vp9", "-crf", str(quality or 30), "-b:v", "0"]
            cmd += ["-c:a", "libopus", "-b:a", audio_bitrate]
        else:
            cmd += ["-c", "copy"]

        if video_bitrate:
            cmd = [ff, "-y", "-i", str(input_path), "-b:v", video_bitrate, "-c:a", "aac", "-b:a", "128k"]

    cmd.append(str(out))
    _run(cmd)
    if not out.exists():
        raise ConversionError("FFmpeg did not produce an output file.")
    return out


def extract_audio_from_video(input_path: Path, output_path: Path, target_ext: str = "mp3") -> Path:
    return convert_with_ffmpeg(input_path, output_path, target_ext, audio_only=True)


def compress_media_target_size(
    input_path: Path,
    output_path: Path,
    target_bytes: int,
    ext: str,
) -> Path:
    if ext in {"jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif", "ico", "svg"}:
        return compress_image_to_size(input_path, output_path, target_bytes)

    ff = ffmpeg_path()
    if not ff:
        raise ConversionError("FFmpeg required for video/audio compression.")

    duration = _probe_duration(input_path)
    if not duration or duration <= 0:
        raise ConversionError("Could not read media duration for compression.")

    # Rough total bitrate budget (bits per second)
    target_bps = int((target_bytes * 8) / duration * 0.92)
    audio_bps = min(128_000, max(64_000, target_bps // 5))
    video_bps = max(100_000, target_bps - audio_bps)
    video_k = f"{max(100, video_bps // 1000)}k"
    audio_k = f"{max(64, audio_bps // 1000)}k"

    out = output_path.with_suffix(input_path.suffix)
    if ext in AUDIO_INPUT:
        return convert_with_ffmpeg(
            input_path, output_path, ext, audio_only=True, audio_bitrate=audio_k
        )
    return convert_with_ffmpeg(
        input_path, output_path, ext, video_bitrate=video_k, audio_bitrate=audio_k
    )


def _probe_duration(path: Path) -> float | None:
    fp = ffprobe_path()
    if not fp:
        return None
    cmd = [
        fp,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False, **_subprocess_kwargs())
        if proc.returncode == 0 and proc.stdout.strip():
            return float(proc.stdout.strip())
    except (ValueError, subprocess.TimeoutExpired):
        pass
    return None


AUDIO_INPUT = {"mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus"}


def youtube_info(url: str) -> dict:
    """Fetch video metadata (title, duration, thumbnail) without downloading."""
    prefix = _ytdlp_cmd_prefix()
    if not prefix:
        raise ConversionError(
            "yt-dlp is not installed. Run: py -m pip install yt-dlp"
        )

    import json as _json

    cmd = [*prefix, "--no-playlist", "--dump-json", "--no-download", url]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30, check=False, **_subprocess_kwargs()
        )
    except subprocess.TimeoutExpired as exc:
        raise ConversionError("Timed out fetching video info.") from exc

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "Failed to fetch video info").strip()
        raise ConversionError(err[:300])

    try:
        data = _json.loads(proc.stdout)
    except _json.JSONDecodeError:
        raise ConversionError("Could not parse video info.")

    return {
        "title": data.get("title", "Unknown"),
        "duration": data.get("duration"),
        "duration_string": data.get("duration_string", ""),
        "thumbnail": data.get("thumbnail", ""),
        "uploader": data.get("uploader", ""),
    }


def download_youtube(
    url: str,
    output_dir: Path,
    fmt: str,
    *,
    resolution: str | None = None,
    audio_bitrate: str | None = None,
) -> Path:
    prefix = _ytdlp_cmd_prefix()
    if not prefix:
        raise ConversionError(
            "yt-dlp is not installed. Run: py -m pip install yt-dlp"
        )

    out_template = str(output_dir / "%(title).200s.%(ext)s")
    cmd = [*prefix, "--no-playlist", "-o", out_template]

    if fmt == "mp3":
        br = (audio_bitrate or "192").replace("k", "")
        cmd += ["-x", "--audio-format", "mp3", "--audio-quality", f"{br}K"]
    else:
        height = (resolution or "1080").replace("p", "").strip()
        if height.isdigit():
            cmd += [
                "-f",
                f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/"
                f"best[height<={height}][ext=mp4]/best",
            ]
        else:
            cmd += ["-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"]

    cmd.append(url)
    _run(cmd, timeout=600)

    files = sorted(output_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for f in files:
        if f.is_file() and f.suffix.lower().lstrip(".") in ("mp4", "mp3", "m4a", "webm"):
            if fmt == "mp3" and f.suffix.lower() != ".mp3":
                mp3_out = output_dir / (f.stem + ".mp3")
                convert_with_ffmpeg(f, mp3_out, "mp3", audio_only=True)
                f.unlink(missing_ok=True)
                return mp3_out
            return f
    raise ConversionError("Download finished but no output file was found.")


def convert_file(
    input_path: Path,
    output_dir: Path,
    category: str,
    target_format: str,
    *,
    quality: int = 85,
    target_size_mb: float | None = None,
    extract_audio: bool = False,
) -> Path:
    if input_path.stat().st_size > MAX_FILE_BYTES:
        raise ConversionError("File exceeds 500 MB limit.")

    ext = input_path.suffix.lower().lstrip(".")
    stem = input_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)

    if category == "compress" and target_size_mb:
        target_bytes = int(target_size_mb * 1024 * 1024)
        return compress_media_target_size(
            input_path, output_dir / stem, target_bytes, ext or "mp4"
        )

    target = target_format.lower().replace("jpeg", "jpg")
    if ext == target and category != "compress":
        raise ConversionError(f"Input is already .{target}. Pick a different output format.")

    out_base = output_dir / stem

    if extract_audio or (category == "video" and target in AUDIO_INPUT):
        return extract_audio_from_video(input_path, out_base, target)

    if ext in {"jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "ico", "gif", "svg"}:
        return convert_image(input_path, out_base, target, quality=quality)

    if ext in {"mp4", "avi", "mov", "mkv", "webm", "flv", "wmv", "m4v", "mpeg", "mpg", "3gp"}:
        return convert_with_ffmpeg(
            input_path, out_base, target, quality=quality if target == "mp4" else None
        )

    if ext in AUDIO_INPUT:
        return convert_with_ffmpeg(input_path, out_base, target, audio_only=True)

    raise ConversionError(f"Unsupported file type: .{ext}")
