"""
GuidesForge Modal Inference Functions
=====================================
Deploys on Modal.com for GPU-accelerated AI processing:
1. Screenshot description (vision model)
2. Narration script generation
3. Text-to-Speech (Kokoro TTS)
4. Video assembly (FFmpeg)
5. Voice cloning (Chatterbox)
6. Staleness check (Playwright + pixelmatch with diff image)
7. Transcribe audio (Whisper large-v3)
8. Detect UI elements (OmniParser V2 / GPT-4o-mini vision)
"""

import modal
import os
import json
import tempfile
import subprocess
from pathlib import Path

# Modal app
app = modal.App("guidesforge")

# Base image with common dependencies
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.6.0",
        "torchaudio==2.6.0",
        "transformers==4.46.0",
        "accelerate==1.0.0",
        "Pillow==10.4.0",
        "requests==2.32.3",
        "boto3==1.35.0",
        "numpy==1.26.4",
    )
    .apt_install("ffmpeg", "libsndfile1")
)

# TTS image with Kokoro
tts_image = base_image.pip_install(
    "kokoro>=0.8.0",
    "soundfile==0.12.1",
    "scipy==1.14.0",
)

# Vision image with moondream2 (free local vision model, no API cost)
vision_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "transformers>=4.44.0",
        "torch==2.6.0",
        "Pillow==10.4.0",
        "requests==2.32.3",
        "boto3==1.35.0",
        "einops",
        "accelerate==1.0.0",
    )
    .apt_install("ffmpeg", "libsndfile1")
)

# Whisper image for audio transcription (local model via faster-whisper, no API cost)
whisper_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "faster-whisper==1.1.0",
        "requests==2.32.3",
        "boto3==1.35.0",
        "numpy==1.26.4",
        "soundfile==0.12.1",
    )
    .apt_install("ffmpeg", "libsndfile1")
)

# S3 configuration
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "https://s3.us-west-1.idrivee2.com")
S3_BUCKET = os.environ.get("S3_BUCKET", "crop-spray-uploads")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "")


def get_s3_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-west-1",
    )


def upload_to_s3(local_path: str, s3_key: str) -> str:
    """Upload a file to S3 and return public URL."""
    client = get_s3_client()
    content_type = "audio/wav"
    if s3_key.endswith(".mp4"):
        content_type = "video/mp4"
    elif s3_key.endswith(".png") or s3_key.endswith(".jpg"):
        content_type = "image/png"
    elif s3_key.endswith(".json"):
        content_type = "application/json"

    client.upload_file(
        local_path,
        S3_BUCKET,
        s3_key,
        ExtraArgs={"ContentType": content_type, "ACL": "public-read"},
    )
    return f"{S3_ENDPOINT}/{S3_BUCKET}/{s3_key}"


def download_from_url(url: str, local_path: str):
    """Download a file from URL."""
    import requests
    resp = requests.get(url, stream=True)
    resp.raise_for_status()
    with open(local_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)


# ─── 1. Screenshot Description ───────────────────────────────────────────────

@app.function(
    image=vision_image,
    gpu="T4",
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=180,
)
def describe_screenshot(screenshot_url: str, context: str = "") -> str:
    """Use moondream2 local vision model to describe what a screenshot shows.
    Runs on T4 GPU — zero API cost, no OpenAI key needed."""
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from PIL import Image
    import requests as req
    import io

    # Download screenshot
    resp = req.get(screenshot_url)
    resp.raise_for_status()
    img = Image.open(io.BytesIO(resp.content)).convert("RGB")

    # Load moondream2
    model_id = "vikhyatk/moondream2"
    model = AutoModelForCausalLM.from_pretrained(
        model_id, trust_remote_code=True, torch_dtype="auto",
        device_map="auto",
    )
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)

    prompt = "Describe what action the user is performing in this screenshot. Be specific about which button, link, or input field they are interacting with. Write a single, clear sentence suitable for a step-by-step guide."
    if context:
        prompt += f" {context}"

    enc_image = model.encode_image(img)
    result = model.answer_question(enc_image, prompt, tokenizer)

    return result.strip() if result else "Interact with the element shown on screen."


# ─── 2. Narration Script Generation ──────────────────────────────────────────

@app.function(
    image=base_image,
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=120,
)
def generate_narration_script(
    steps: list[dict], guide_title: str, language: str = "en"
) -> list[str]:
    """Generate narration scripts from step descriptions.
    Uses template-based generation — zero API cost, no OpenAI key needed."""
    narrations = []
    for step in steps:
        desc = step.get("description", "").strip()
        step_num = step.get("step_number", 1)

        if not desc:
            narrations.append(f"In step {step_num}, continue with the next action.")
            continue

        # Clean up description for narration
        # Make it second-person and natural
        narration = desc
        # If it starts with a verb, add "you" prefix for narration
        if narration[0].isupper() and not narration.lower().startswith("you "):
            narration = f"Next, {narration[0].lower()}{narration[1:]}"

        # Ensure it ends with a period
        if not narration.endswith("."):
            narration += "."

        narrations.append(narration)

    return narrations


# ─── 3. Text-to-Speech (Kokoro) ──────────────────────────────────────────────

@app.function(
    image=tts_image,
    gpu="T4",
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=300,
)
def text_to_speech(
    text: str,
    voice: str = "af_heart",
    speed: float = 1.0,
    guide_id: str = "",
    step_number: int = 0,
) -> str:
    """Convert text to speech using Kokoro TTS. Returns S3 URL of audio file."""
    import kokoro
    import soundfile as sf

    pipeline = kokoro.KPipeline(lang_code="a")
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    # Generate audio
    generator = pipeline(text, voice=voice, speed=speed)
    all_audio = []
    for _, _, audio in generator:
        all_audio.append(audio)

    if all_audio:
        import numpy as np
        combined = np.concatenate(all_audio)
        sf.write(tmp_path, combined, 24000)

    # Upload to S3
    s3_key = f"guides/{guide_id}/audio/step_{step_number}.wav"
    url = upload_to_s3(tmp_path, s3_key)
    os.unlink(tmp_path)

    return url


# ─── 4. Video Assembly (FFmpeg) ──────────────────────────────────────────────

@app.function(
    image=base_image,
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=600,
    cpu=4,
)
def assemble_video(
    guide_id: str,
    steps: list[dict],
    transition: str = "fade",
) -> str:
    """Assemble screenshots + audio into an MP4 video. Returns S3 URL."""
    work_dir = tempfile.mkdtemp()

    # Download all screenshots and audio
    for i, step in enumerate(steps):
        if step.get("screenshot_url"):
            download_from_url(
                step["screenshot_url"], f"{work_dir}/screenshot_{i}.png"
            )
        if step.get("audio_url"):
            download_from_url(step["audio_url"], f"{work_dir}/audio_{i}.wav")

    # Build FFmpeg concat file
    concat_entries = []
    for i, step in enumerate(steps):
        screenshot_path = f"{work_dir}/screenshot_{i}.png"
        audio_path = f"{work_dir}/audio_{i}.wav"

        if not os.path.exists(screenshot_path):
            continue

        # Get audio duration or default to 5 seconds
        duration = 5.0
        if os.path.exists(audio_path):
            try:
                result = subprocess.run(
                    [
                        "ffprobe",
                        "-v",
                        "quiet",
                        "-show_entries",
                        "format=duration",
                        "-of",
                        "csv=p=0",
                        audio_path,
                    ],
                    capture_output=True,
                    text=True,
                )
                duration = float(result.stdout.strip()) + 0.5  # small buffer
            except (ValueError, subprocess.CalledProcessError):
                pass

        concat_entries.append(
            {
                "screenshot": screenshot_path,
                "audio": audio_path if os.path.exists(audio_path) else None,
                "duration": duration,
            }
        )

    if not concat_entries:
        return ""

    # Create individual video segments
    segments = []
    for i, entry in enumerate(concat_entries):
        segment_path = f"{work_dir}/segment_{i}.mp4"

        cmd = [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            entry["screenshot"],
            "-t",
            str(entry["duration"]),
        ]

        if entry["audio"]:
            cmd.extend(["-i", entry["audio"]])
            cmd.extend(
                [
                    "-c:v",
                    "libx264",
                    "-tune",
                    "stillimage",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "192k",
                    "-shortest",
                    "-pix_fmt",
                    "yuv420p",
                    "-vf",
                    "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
                ]
            )
        else:
            cmd.extend(
                [
                    "-c:v",
                    "libx264",
                    "-tune",
                    "stillimage",
                    "-pix_fmt",
                    "yuv420p",
                    "-vf",
                    "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
                    "-an",
                ]
            )

        cmd.append(segment_path)
        subprocess.run(cmd, check=True, capture_output=True)
        segments.append(segment_path)

    # Concatenate all segments
    concat_file = f"{work_dir}/concat.txt"
    with open(concat_file, "w") as f:
        for seg in segments:
            f.write(f"file '{seg}'\n")

    output_path = f"{work_dir}/output.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_file,
            "-c",
            "copy",
            output_path,
        ],
        check=True,
        capture_output=True,
    )

    # Upload to S3
    s3_key = f"guides/{guide_id}/video/guide.mp4"
    url = upload_to_s3(output_path, s3_key)

    # Generate thumbnail from first frame
    thumb_path = f"{work_dir}/thumbnail.jpg"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            output_path,
            "-vframes",
            "1",
            "-q:v",
            "2",
            thumb_path,
        ],
        check=True,
        capture_output=True,
    )
    thumb_s3_key = f"guides/{guide_id}/video/thumbnail.jpg"
    upload_to_s3(thumb_path, thumb_s3_key)

    return url


# ─── 5. Voice Cloning (Chatterbox) ──────────────────────────────────────────

chatterbox_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.6.0",
        "torchaudio==2.6.0",
        "chatterbox-tts==0.1.7",
        "soundfile==0.12.1",
        "requests==2.32.3",
        "boto3==1.35.0",
    )
    .apt_install("ffmpeg", "libsndfile1")
)


@app.function(
    image=chatterbox_image,
    gpu="A10G",
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=600,
)
def voice_clone_tts(
    text: str,
    reference_audio_url: str,
    guide_id: str = "",
    step_number: int = 0,
) -> str:
    """Generate speech using voice cloning with Chatterbox TTS."""
    import torchaudio
    from chatterbox.tts import ChatterboxTTS

    # Download reference audio
    ref_path = tempfile.mktemp(suffix=".wav")
    download_from_url(reference_audio_url, ref_path)

    # Load model
    model = ChatterboxTTS.from_pretrained(device="cuda")

    # Generate speech
    wav = model.generate(text, audio_prompt_path=ref_path)

    # Save output
    out_path = tempfile.mktemp(suffix=".wav")
    torchaudio.save(out_path, wav, model.sr)

    # Upload to S3
    s3_key = f"guides/{guide_id}/audio/step_{step_number}_cloned.wav"
    url = upload_to_s3(out_path, s3_key)

    os.unlink(ref_path)
    os.unlink(out_path)

    return url


# ─── 6. Staleness Check (Playwright Screenshot Comparison) ───────────────────

staleness_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "playwright==1.48.0",
        "Pillow==10.4.0",
        "requests==2.32.3",
        "boto3==1.35.0",
        "numpy==1.26.4",
    )
    .apt_install("libnss3", "libxss1", "libasound2", "libatk-bridge2.0-0", "libgtk-3-0")
    .run_commands("playwright install chromium")
)


@app.function(
    image=staleness_image,
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=300,
)
def check_staleness(
    page_url: str,
    baseline_screenshot_url: str,
    guide_id: str = "",
    step_number: int = 0,
) -> dict:
    """Compare live screenshot against baseline using pixelmatch. Generates red-overlay diff image."""
    from PIL import Image
    import numpy as np
    from playwright.sync_api import sync_playwright

    # Take live screenshot
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(page_url, wait_until="networkidle", timeout=30000)
        live_path = tempfile.mktemp(suffix=".png")
        page.screenshot(path=live_path, full_page=False)
        browser.close()

    # Download baseline
    baseline_path = tempfile.mktemp(suffix=".png")
    download_from_url(baseline_screenshot_url, baseline_path)

    # Compare images
    live_img = Image.open(live_path).convert("RGB").resize((1920, 1080))
    baseline_img = Image.open(baseline_path).convert("RGB").resize((1920, 1080))

    live_arr = np.array(live_img)
    baseline_arr = np.array(baseline_img)

    # Pixel difference
    diff = np.abs(live_arr.astype(float) - baseline_arr.astype(float))
    mean_diff = diff.mean()
    max_pixel_diff = diff.max()

    # Staleness score (0=identical, 1=completely different)
    staleness_score = min(mean_diff / 50.0, 1.0)
    is_stale = staleness_score > 0.15  # 15% threshold

    # Generate red-overlay diff image
    threshold = 30  # pixel diff threshold for marking as changed
    diff_magnitude = np.max(diff, axis=2)  # max channel diff per pixel
    changed_mask = diff_magnitude > threshold

    # Blend: 60% red overlay + 40% original for changed areas
    blend_arr = baseline_arr.copy().astype(float)
    red_overlay = np.zeros_like(blend_arr)
    red_overlay[changed_mask] = [255, 0, 0]
    blend_arr[changed_mask] = (
        blend_arr[changed_mask] * 0.4 + red_overlay[changed_mask] * 0.6
    )

    diff_pil = Image.fromarray(blend_arr.astype(np.uint8))
    diff_path = tempfile.mktemp(suffix=".png")
    diff_pil.save(diff_path)

    # Upload live screenshot
    s3_key = f"guides/{guide_id}/staleness/step_{step_number}_live.png"
    live_url = upload_to_s3(live_path, s3_key)

    # Upload diff image
    diff_s3_key = f"guides/{guide_id}/staleness/step_{step_number}_diff.png"
    diff_url = upload_to_s3(diff_path, diff_s3_key)

    os.unlink(live_path)
    os.unlink(baseline_path)
    os.unlink(diff_path)

    return {
        "is_stale": is_stale,
        "staleness_score": float(staleness_score),
        "mean_pixel_diff": float(mean_diff),
        "max_pixel_diff": float(max_pixel_diff),
        "live_screenshot_url": live_url,
        "diff_image_url": diff_url,
        "guide_id": guide_id,
        "step_number": step_number,
    }


# ─── 7. Transcribe Audio (Whisper large-v3) ─────────────────────────────────

@app.function(
    image=whisper_image,
    gpu="T4",
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=300,
)
def transcribe_audio(
    audio_url: str,
    language: str = "en",
    guide_id: str = "",
) -> dict:
    """Transcribe audio using local faster-whisper large-v3 model. Runs on GPU, no API cost."""
    from faster_whisper import WhisperModel

    # Download audio file
    audio_path = tempfile.mktemp(suffix=".wav")
    download_from_url(audio_url, audio_path)

    # Load faster-whisper model locally on GPU (CTranslate2 backend)
    model = WhisperModel("large-v3", device="cuda", compute_type="float16")

    # Transcribe locally
    segs_iter, info = model.transcribe(
        audio_path,
        language=language if language != "auto" else None,
        task="transcribe",
    )

    # Extract segments with timestamps
    segments = []
    full_text_parts = []
    for seg in segs_iter:
        segments.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
        })
        full_text_parts.append(seg.text.strip())

    os.unlink(audio_path)

    text = " ".join(full_text_parts)
    detected_lang = info.language or language

    # Upload transcript as JSON to S3
    transcript_data = {
        "text": text,
        "language": detected_lang,
        "segments": segments,
    }
    transcript_path = tempfile.mktemp(suffix=".json")
    with open(transcript_path, "w") as f:
        json.dump(transcript_data, f)

    s3_key = f"guides/{guide_id}/transcripts/transcript.json"
    transcript_url = upload_to_s3(transcript_path, s3_key)
    os.unlink(transcript_path)

    return {
        "text": text,
        "language": detected_lang,
        "segments": segments,
        "transcript_url": transcript_url,
        "guide_id": guide_id,
    }


# ─── 8. Detect UI Elements (Click-coordinate annotation, no API cost) ───────

@app.function(
    image=base_image,
    secrets=[modal.Secret.from_name("guidesforge-secrets")],
    timeout=120,
)
def detect_ui_elements(
    screenshot_url: str,
    click_x: int = 0,
    click_y: int = 0,
    guide_id: str = "",
    step_number: int = 0,
) -> dict:
    """Annotate screenshot with click indicator and step number callout.
    Uses click coordinates from the extension — zero API cost, no OpenAI key needed.
    Draws a red circle at the click point with step number label.
    Returns annotated screenshot URL.
    """
    from PIL import Image, ImageDraw
    import requests as req
    import io

    # Build elements list from click coordinates
    elements = {"elements": []}
    if click_x > 0 and click_y > 0:
        elements["elements"].append({
            "type": "click_target",
            "label": f"Step {step_number}",
            "click_x": click_x,
            "click_y": click_y,
            "is_target": True,
        })

    # Download original screenshot
    img_resp = req.get(screenshot_url)
    img = Image.open(io.BytesIO(img_resp.content)).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size

    # Draw annotations on screenshot
    for elem in elements.get("elements", []):
        bbox = elem.get("bbox", [])
        if len(bbox) != 4:
            continue

        # Convert percentage to pixels
        x1 = int(bbox[0] * w / 100)
        y1 = int(bbox[1] * h / 100)
        x2 = int(bbox[2] * w / 100)
        y2 = int(bbox[3] * h / 100)

        if elem.get("is_target"):
            # Target element: thick red rectangle + arrow + label
            for offset in range(4):
                draw.rectangle(
                    [x1 - offset, y1 - offset, x2 + offset, y2 + offset],
                    outline="#EF4444",
                )

            # Draw arrow pointing down to the element
            center_x = (x1 + x2) // 2
            arrow_tip_y = max(0, y1 - 8)
            arrow_start_y = max(0, y1 - 50)
            draw.line(
                [(center_x, arrow_start_y), (center_x, arrow_tip_y)],
                fill="#EF4444", width=3,
            )
            draw.polygon(
                [
                    (center_x, arrow_tip_y),
                    (center_x - 8, arrow_tip_y - 12),
                    (center_x + 8, arrow_tip_y - 12),
                ],
                fill="#EF4444",
            )

            # Label text above arrow
            label = elem.get("label", "")
            if label:
                label_text = label[:40]
                label_y = max(0, arrow_start_y - 28)
                text_bbox = draw.textbbox((0, 0), label_text)
                text_w = text_bbox[2] - text_bbox[0]
                pill_x1 = center_x - text_w // 2 - 8
                pill_x2 = center_x + text_w // 2 + 8
                draw.rounded_rectangle(
                    [pill_x1, label_y, pill_x2, label_y + 24],
                    radius=6,
                    fill="#EF4444",
                )
                draw.text(
                    (center_x - text_w // 2, label_y + 4),
                    label_text,
                    fill="white",
                )
        else:
            # Non-target: subtle outline
            draw.rectangle(
                [x1, y1, x2, y2],
                outline="#94A3B8",
                width=1,
            )

    # If click coordinates provided, draw a click indicator circle
    if click_x > 0 and click_y > 0:
        for r in [20, 15, 10]:
            draw.ellipse(
                [click_x - r, click_y - r, click_x + r, click_y + r],
                outline="#F97316",
                width=2,
            )
        draw.ellipse(
            [click_x - 5, click_y - 5, click_x + 5, click_y + 5],
            fill="#F97316",
        )

    # Save annotated screenshot
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    annotated_path = tempfile.mktemp(suffix=".png")
    with open(annotated_path, "wb") as f:
        f.write(buffer.getvalue())

    s3_key = f"guides/{guide_id}/annotated/step_{step_number}.png"
    annotated_url = upload_to_s3(annotated_path, s3_key)
    os.unlink(annotated_path)

    return {
        "elements": elements.get("elements", []),
        "annotated_screenshot_url": annotated_url,
        "guide_id": guide_id,
        "step_number": step_number,
    }
