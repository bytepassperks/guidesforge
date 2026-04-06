"""Customer.io integration for behavioral email and event tracking.
Uses the Customer.io Track API to identify users, track events,
and trigger automated campaigns (welcome, staleness alerts, trial expiry).
"""
import json
from base64 import b64encode
from typing import Optional

import requests

from app.config import settings


def _get_auth_header() -> dict:
    """Build Basic auth header for Customer.io Track API."""
    if not settings.CUSTOMERIO_SITE_ID or not settings.CUSTOMERIO_API_KEY:
        return {}
    token = b64encode(
        f"{settings.CUSTOMERIO_SITE_ID}:{settings.CUSTOMERIO_API_KEY}".encode()
    ).decode()
    return {"Authorization": f"Basic {token}"}


def _track_api(method: str, path: str, payload: Optional[dict] = None) -> bool:
    """Make a request to the Customer.io Track API."""
    headers = _get_auth_header()
    if not headers:
        print("[CUSTOMERIO] Not configured — skipping")
        return False

    headers["Content-Type"] = "application/json"
    url = f"https://track.customer.io/api/v1{path}"

    try:
        resp = requests.request(method, url, headers=headers, json=payload, timeout=10)
        if resp.status_code not in (200, 201, 204):
            print(f"[CUSTOMERIO] {method} {path} failed: {resp.status_code} {resp.text}")
            return False
        return True
    except Exception as e:
        print(f"[CUSTOMERIO] Error: {e}")
        return False


def identify_user(
    user_id: str,
    email: str,
    full_name: Optional[str] = None,
    plan: str = "free",
    created_at: Optional[int] = None,
) -> bool:
    """Identify/update a user in Customer.io."""
    attributes: dict = {"email": email, "plan": plan}
    if full_name:
        attributes["name"] = full_name
    if created_at:
        attributes["created_at"] = created_at
    return _track_api("PUT", f"/customers/{user_id}", attributes)


def track_event(
    user_id: str,
    event_name: str,
    data: Optional[dict] = None,
) -> bool:
    """Track a named event for a user."""
    payload: dict = {"name": event_name}
    if data:
        payload["data"] = data
    return _track_api("POST", f"/customers/{user_id}/events", payload)


def delete_user(user_id: str) -> bool:
    """Remove a user from Customer.io."""
    return _track_api("DELETE", f"/customers/{user_id}")


# ── Convenience wrappers for common events ──────────────────────────────────

def on_user_registered(user_id: str, email: str, full_name: Optional[str] = None) -> None:
    """Call when a new user signs up."""
    import time

    identify_user(user_id, email, full_name, plan="pro", created_at=int(time.time()))
    track_event(user_id, "signed_up", {"plan": "pro_trial"})


def on_trial_expired(user_id: str) -> None:
    """Call when a user's trial expires."""
    track_event(user_id, "trial_expired")


def on_guide_created(user_id: str, guide_id: str, title: str) -> None:
    """Call when a user creates a guide."""
    track_event(user_id, "guide_created", {"guide_id": guide_id, "title": title})


def on_guide_published(user_id: str, guide_id: str, title: str) -> None:
    """Call when a guide is published."""
    track_event(user_id, "guide_published", {"guide_id": guide_id, "title": title})


def on_staleness_detected(user_id: str, guide_id: str, diff_pct: float) -> None:
    """Call when staleness is detected on a guide."""
    track_event(user_id, "staleness_detected", {
        "guide_id": guide_id,
        "diff_percentage": diff_pct,
    })


def on_plan_changed(user_id: str, old_plan: str, new_plan: str) -> None:
    """Call when a user changes plan."""
    track_event(user_id, "plan_changed", {"old_plan": old_plan, "new_plan": new_plan})
    # Update the user's plan attribute
    _track_api("PUT", f"/customers/{user_id}", {"plan": new_plan})
