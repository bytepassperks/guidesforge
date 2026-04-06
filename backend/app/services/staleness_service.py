"""Staleness detection using Playwright + pixel comparison.
Runs as Render cron: 30 20 * * * (2 AM IST / 8:30 PM UTC)
"""
import asyncio
import io
import numpy as np
from typing import Optional, Dict
from datetime import datetime

from PIL import Image
from sqlalchemy.orm import Session

from app.utils.s3 import upload_file, upload_diff_image


async def capture_screenshot(url: str, cookies: Optional[list] = None) -> bytes:
    """Headless Chromium screenshot via Playwright."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        if cookies:
            await page.context.add_cookies(cookies)
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1000)
            screenshot = await page.screenshot(full_page=False)
        except Exception as e:
            print(f"[STALENESS] Error capturing {url}: {e}")
            screenshot = None
        finally:
            await browser.close()
        return screenshot


def compare_screenshots(baseline_bytes: bytes, current_bytes: bytes) -> Dict:
    """Compare two screenshots using pixel diff.
    Returns diff_percentage and diff_image_bytes."""
    img1 = np.array(Image.open(io.BytesIO(baseline_bytes)).convert("RGB"))
    img2 = np.array(Image.open(io.BytesIO(current_bytes)).convert("RGB"))

    # Resize to same dimensions if needed
    if img1.shape != img2.shape:
        h = min(img1.shape[0], img2.shape[0])
        w = min(img1.shape[1], img2.shape[1])
        img1 = img1[:h, :w]
        img2 = img2[:h, :w]

    # Pixel diff
    diff = np.abs(img1.astype(float) - img2.astype(float))
    threshold = 30  # pixel difference threshold
    changed_pixels = np.any(diff > threshold, axis=2)
    total_pixels = changed_pixels.size
    different_pixels = np.sum(changed_pixels)
    diff_percentage = (different_pixels / total_pixels) * 100

    # Generate diff visualization (red overlay on changed areas)
    diff_image = img2.copy()
    diff_image[changed_pixels] = [255, 0, 0]  # Red overlay
    diff_pil = Image.fromarray(diff_image)
    diff_buffer = io.BytesIO()
    diff_pil.save(diff_buffer, format="PNG")
    diff_bytes = diff_buffer.getvalue()

    return {
        "diff_percentage": round(diff_percentage, 2),
        "diff_image_bytes": diff_bytes,
        "changed_pixels": int(different_pixels),
        "total_pixels": int(total_pixels),
    }


async def run_staleness_check_for_guide(guide_id: str, db: Session, s3_client=None) -> float:
    """Run staleness check for all steps of a guide.
    Returns the maximum diff percentage found."""
    from app.models.database import Guide, GuideStep

    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        return 0.0

    steps = db.query(GuideStep).filter(
        GuideStep.guide_id == guide_id,
        GuideStep.baseline_screenshot_url.isnot(None),
        GuideStep.page_url.isnot(None),
    ).all()

    max_diff = 0.0
    any_stale = False

    for step in steps:
        try:
            # Capture current screenshot
            current_screenshot = await capture_screenshot(step.page_url)
            if current_screenshot is None:
                continue

            # Upload current screenshot
            current_url = upload_file(
                current_screenshot,
                f"baselines/{guide_id}/current_step_{step.step_number}.png",
                "image/png",
            )
            step.current_screenshot_url = current_url

            # Download baseline for comparison
            import requests
            baseline_resp = requests.get(step.baseline_screenshot_url)
            if baseline_resp.status_code != 200:
                continue

            # Compare
            result = compare_screenshots(baseline_resp.content, current_screenshot)
            step.pixel_diff_percentage = result["diff_percentage"]

            if result["diff_percentage"] > 15.0:
                step.is_stale = True
                any_stale = True
                # Upload diff image
                diff_url = upload_diff_image(
                    result["diff_image_bytes"], str(guide_id), step.step_number
                )
                step.diff_image_url = diff_url

            max_diff = max(max_diff, result["diff_percentage"])

        except Exception as e:
            print(f"[STALENESS] Error checking step {step.step_number}: {e}")
            continue

    # Update guide status
    guide.staleness_score = max_diff / 100.0
    guide.last_staleness_check = datetime.utcnow()
    if any_stale:
        guide.status = "stale"

    db.commit()
    return max_diff
