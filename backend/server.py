"""Forma conversion API — Flask backend."""

import io
import os
import shutil
import sys
import tempfile
import urllib.parse
import zipfile
from pathlib import Path


def setup_binaries() -> Path:
    """Copy bundled tool binaries into a temp directory and expose them on PATH."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        base_dir = Path(sys._MEIPASS)
    else:
        base_dir = Path(__file__).resolve().parent.parent

    bin_dir = base_dir / "bin"
    if not bin_dir.is_dir():
        bin_dir = base_dir / "backend" / "bin"

    temp_dir = Path(tempfile.mkdtemp(prefix="forma-binaries-", dir=tempfile.gettempdir()))
    binary_targets = [
        ("ffmpeg", ("ffmpeg.exe", "ffmpeg")),
        ("ffprobe", ("ffprobe.exe", "ffprobe")),
        ("yt-dlp", ("yt-dlp.exe", "yt-dlp")),
        ("spotdl", ("spotdl.exe", "spotdl", "spotdl-4.5.0-win32.exe")),
    ]

    for target_name, candidates in binary_targets:
        source = None
        for name in candidates:
            candidate = bin_dir / name
            if candidate.is_file():
                source = candidate
                break
        if not source:
            continue

        target = temp_dir / (target_name + (".exe" if os.name == "nt" else ""))
        shutil.copy2(source, target)
        if os.name != "nt":
            os.chmod(target, 0o755)

    path_entries = [str(temp_dir)] + [entry for entry in os.environ.get("PATH", "").split(os.pathsep) if entry]
    os.environ["PATH"] = os.pathsep.join(dict.fromkeys(path_entries))
    return temp_dir


setup_binaries()

from flask import Flask, Response, jsonify, request, send_file, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename

from converters import (
    ConversionError,
    check_ffmpeg,
    convert_file,
    download_youtube,
    ffmpeg_path,
    youtube_info,
    ytdlp_available,
    _ytdlp_cmd_prefix,
)
from formats import CATEGORIES, category_for_file, extension_of
from pdf_ops import (
    estimate_compress_size,
    inspect_pdf,
    libreoffice_available,
    pdf_capabilities,
    run_pdf_operation,
)
from spotify_ops import (
    _spotdl_cmd_prefix,
    spotdl_available,
    sse_encode,
    stream_spotify_download,
    get_spotify_info,
)

app = Flask(__name__)
CORS(app, expose_headers=["Content-Disposition", "X-Filename"])

TEMP_ROOT = Path(tempfile.gettempdir()) / "forma_app"
TEMP_ROOT.mkdir(parents=True, exist_ok=True)


def default_downloads_dir() -> str:
    """User Downloads folder, or home directory as fallback."""
    downloads = Path.home() / "Downloads"
    if downloads.is_dir():
        return str(downloads)
    return str(Path.home())


@app.route("/api/health")
def health():
    import sys

    ff = check_ffmpeg()
    ytdlp_ok = ytdlp_available()
    spotdl_ok = spotdl_available()
    return jsonify(
        {
            "status": "ok",
            "python": sys.executable,
            "ffmpeg": ff,
            "yt_dlp": ytdlp_ok,
            "yt_dlp_via": " ".join(_ytdlp_cmd_prefix()) if ytdlp_ok else None,
            "spotdl": spotdl_ok,
            "spotdl_via": " ".join(_spotdl_cmd_prefix()) if spotdl_ok else None,
            "downloads_dir": default_downloads_dir(),
            "pillow": True,
            "pdf": pdf_capabilities(),
            "libreoffice": libreoffice_available(),
        }
    )


@app.route("/api/formats")
def formats():
    return jsonify(CATEGORIES)


@app.route("/api/shutdown", methods=["POST"])
def shutdown():
    def kill():
        import time
        import os
        time.sleep(0.5)
        os._exit(0)
    import threading
    threading.Thread(target=kill).start()
    return jsonify({"message": "Shutting down..."})


@app.route("/api/convert", methods=["POST"])
def convert():
    category = request.form.get("category", "image")
    target_format = request.form.get("target_format", "png")
    quality = int(request.form.get("quality", 85))
    target_size_mb = request.form.get("target_size_mb")
    extract_audio = request.form.get("extract_audio") == "true"

    upload = request.files.get("file")
    if not upload or not upload.filename:
        app.logger.error("No file uploaded.")
        return jsonify({"error": "No file uploaded."}), 400

    orig_ext = extension_of(upload.filename)
    filename = secure_filename(upload.filename)
    
    if orig_ext and not filename.endswith(f".{orig_ext}"):
        filename = f"{filename or 'upload'}.{orig_ext}"
    elif not filename:
        filename = "upload.bin"
    
    ext = extension_of(filename)

    if category != "compress" and not category_for_file(ext, category):
        app.logger.error(f".{ext} is not valid for {category} conversion.")
        return jsonify({"error": f".{ext} is not valid for {category} conversion."}), 400

    work = tempfile.mkdtemp(dir=TEMP_ROOT)
    try:
        input_path = Path(work) / filename
        upload.save(input_path)

        size_mb = float(target_size_mb) if target_size_mb else None
        out = convert_file(
            input_path,
            Path(work) / "out",
            category,
            target_format,
            quality=quality,
            target_size_mb=size_mb,
            extract_audio=extract_audio,
        )
        return send_file(
            out,
            as_attachment=True,
            download_name=out.name,
        )
    except ConversionError as exc:
        app.logger.error(f"ConversionError: {exc}")
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Conversion failed: {exc}"}), 500
    finally:
        shutil.rmtree(work, ignore_errors=True)


@app.route("/api/youtube/info", methods=["POST"])
def youtube_info_route():
    data = request.get_json(force=True, silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL is required."}), 400
    try:
        info = youtube_info(url)
        return jsonify(info)
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch info: {exc}"}), 500


@app.route("/api/youtube", methods=["POST"])
def youtube():
    data = request.get_json(force=True, silent=True) or {}
    url = (data.get("url") or "").strip()
    fmt = (data.get("format") or "mp4").lower()
    resolution = data.get("resolution")
    audio_bitrate = data.get("audio_bitrate")

    if not url:
        return jsonify({"error": "URL is required."}), 400
    if fmt not in ("mp4", "mp3"):
        return jsonify({"error": "Format must be mp4 or mp3."}), 400

    work = tempfile.mkdtemp(dir=TEMP_ROOT)
    try:
        out = download_youtube(
            url,
            Path(work),
            fmt,
            resolution=resolution,
            audio_bitrate=audio_bitrate,
        )
        resp = send_file(out, as_attachment=True, download_name=out.name)
        resp.headers["X-Filename"] = urllib.parse.quote(out.name)
        return resp
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Download failed: {exc}"}), 500
    finally:
        # Keep output until send completes; Flask may stream file — cleanup delayed
        pass


@app.route("/api/spotify/download", methods=["POST"])
def spotify_download():
    data = request.get_json(force=True, silent=True) or {}
    url = (data.get("url") or "").strip()
    output_dir = (data.get("output_dir") or "").strip() or default_downloads_dir()
    as_zip = bool(data.get("as_zip"))

    if not url:
        return jsonify({"error": "URL is required."}), 400

    def generate():
        for event in stream_spotify_download(url, output_dir, as_zip=as_zip):
            yield sse_encode(event)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/api/spotify/info", methods=["POST"])
def spotify_info_route():
    data = request.get_json(force=True, silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL is required."}), 400
    try:
        info = get_spotify_info(url)
        return jsonify(info)
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch info: {exc}"}), 500


def _pdf_route(operation: str):
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return jsonify({"error": "No file uploaded."}), 400

    filename = secure_filename(upload.filename) or "document"
    work = tempfile.mkdtemp(dir=TEMP_ROOT)
    try:
        input_path = Path(work) / filename
        upload.save(input_path)

        options = {}
        for key in request.form:
            if key != "file":
                options[key] = request.form.get(key)

        out = run_pdf_operation(
            operation,
            input_path,
            Path(work) / "out",
            options,
        )
        return send_file(out, as_attachment=True, download_name=out.name)
    except ConversionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"PDF conversion failed: {exc}"}), 500
    finally:
        shutil.rmtree(work, ignore_errors=True)


@app.route("/api/pdf/inspect", methods=["POST"])
def pdf_inspect():
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return jsonify({"error": "No file uploaded."}), 400
    work = tempfile.mkdtemp(dir=TEMP_ROOT)
    try:
        input_path = Path(work) / secure_filename(upload.filename)
        upload.save(input_path)
        info = inspect_pdf(input_path)
        if input_path.suffix.lower() == ".pdf" and request.form.get("operation") in (
            "to-docx",
            "to-pptx",
        ):
            info["warn_image_only"] = info.pop("image_only", False)
        return jsonify(info)
    finally:
        shutil.rmtree(work, ignore_errors=True)


@app.route("/api/pdf/estimate-compress", methods=["POST"])
def pdf_estimate_compress():
    upload = request.files.get("file")
    level = request.form.get("level", "ebook")
    if not upload:
        return jsonify({"error": "No file"}), 400
    work = tempfile.mkdtemp(dir=TEMP_ROOT)
    try:
        p = Path(work) / secure_filename(upload.filename or "f.pdf")
        upload.save(p)
        mb = estimate_compress_size(p, level)
        return jsonify({"estimate_mb": round(mb, 2)})
    finally:
        shutil.rmtree(work, ignore_errors=True)


@app.route("/api/pdf/compress", methods=["POST"])
def pdf_compress():
    return _pdf_route("compress")


@app.route("/api/pdf/to-docx", methods=["POST"])
def pdf_to_docx_route():
    return _pdf_route("to-docx")


@app.route("/api/pdf/to-pptx", methods=["POST"])
def pdf_to_pptx_route():
    return _pdf_route("to-pptx")


@app.route("/api/pdf/from-docx", methods=["POST"])
def pdf_from_docx_route():
    return _pdf_route("from-docx")


@app.route("/api/pdf/from-pptx", methods=["POST"])
def pdf_from_pptx_route():
    return _pdf_route("from-pptx")


@app.route("/api/pdf/epub-to-pdf", methods=["POST"])
def pdf_epub_to_pdf_route():
    return _pdf_route("epub-to-pdf")


@app.route("/api/pdf/pdf-to-epub", methods=["POST"])
def pdf_to_epub_route():
    return _pdf_route("pdf-to-epub")


@app.route("/api/zip", methods=["POST"])
def zip_outputs():
    """Bundle multiple converted files (client sends paths or re-uploads)."""
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files provided."}), 400

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            if f.filename:
                zf.writestr(secure_filename(f.filename), f.read())
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name="forma_outputs.zip")


def main():
    port = int(os.environ.get("FORMA_PORT", 5123))
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
