"""Valid input/output formats per category."""

VIDEO_INPUT = {"avi", "mov", "mkv", "webm", "flv", "mp4", "m4v", "wmv", "mpeg", "mpg", "3gp"}
VIDEO_OUTPUT = {"mp4", "webm", "mkv", "avi", "mov", "gif"}

AUDIO_INPUT = {"mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus"}
AUDIO_OUTPUT = {"mp3", "wav", "flac", "aac", "ogg", "m4a", "opus"}

IMAGE_INPUT = {"jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "ico", "gif", "svg"}
IMAGE_OUTPUT = {"jpg", "jpeg", "png", "webp", "bmp", "tiff", "ico", "svg"}

COMPRESS_INPUT = IMAGE_INPUT | VIDEO_INPUT | AUDIO_INPUT

def _cat(inputs, outputs, extensions):
    return {
        "inputs": sorted(inputs),
        "outputs": sorted(outputs) if isinstance(outputs, set) else outputs,
        "extensions": sorted(extensions),
    }


CATEGORIES = {
    "video": {**_cat(VIDEO_INPUT, VIDEO_OUTPUT, VIDEO_INPUT), "label": "Video"},
    "audio": {**_cat(AUDIO_INPUT, AUDIO_OUTPUT, AUDIO_INPUT), "label": "Audio"},
    "image": {
        **_cat(IMAGE_INPUT, IMAGE_OUTPUT - {"jpeg"} | {"jpg"}, IMAGE_INPUT),
        "label": "Image",
    },
    "compress": {
        **_cat(COMPRESS_INPUT, ["same"], COMPRESS_INPUT),
        "label": "Compress",
    },
    "youtube": {
        "label": "YouTube",
        "inputs": [],
        "outputs": ["mp4", "mp3"],
        "extensions": [],
    },
    "pdf": {
        "label": "PDF",
        "inputs": ["pdf", "docx", "doc", "pptx", "ppt", "epub"],
        "outputs": ["pdf", "docx", "pptx", "epub"],
        "extensions": ["pdf", "docx", "doc", "pptx", "ppt", "epub"],
    },
    "spotify": {
        "label": "Spotify",
        "inputs": [],
        "outputs": ["mp3"],
        "extensions": [],
    },
}


def extension_of(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def category_for_file(ext: str, active_category: str) -> bool:
    cat = CATEGORIES.get(active_category)
    if not cat:
        return False
    return ext in set(cat["extensions"])
