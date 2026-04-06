"""Plan enforcement - guide limits, seat limits, SDK MAU limits per plan."""

PLAN_LIMITS = {
    "free": {
        "guides_per_month": 10,
        "total_guides": 50,
        "seats": 1,
        "sdk_mau": 0,
        "video_output": True,
        "doc_output": True,
        "tour_output": False,
        "help_center": False,
        "analytics": "basic",
        "white_label": False,
        "voice_clone": False,
        "staleness_detection": False,
        "watermark": True,
    },
    "starter": {
        "guides_per_month": 100,
        "total_guides": 500,
        "seats": 2,
        "sdk_mau": 100,
        "video_output": True,
        "doc_output": True,
        "tour_output": True,
        "help_center": True,
        "analytics": "basic",
        "white_label": False,
        "voice_clone": False,
        "staleness_detection": True,
        "watermark": False,
    },
    "pro": {
        "guides_per_month": -1,  # unlimited
        "total_guides": -1,
        "seats": 5,
        "sdk_mau": 1000,
        "video_output": True,
        "doc_output": True,
        "tour_output": True,
        "help_center": True,
        "analytics": "advanced",
        "white_label": False,
        "voice_clone": True,
        "staleness_detection": True,
        "watermark": False,
    },
    "business": {
        "guides_per_month": -1,
        "total_guides": -1,
        "seats": 10,
        "sdk_mau": 10000,
        "video_output": True,
        "doc_output": True,
        "tour_output": True,
        "help_center": True,
        "analytics": "advanced",
        "white_label": True,
        "voice_clone": True,
        "staleness_detection": True,
        "watermark": False,
    },
    "enterprise": {
        "guides_per_month": -1,
        "total_guides": -1,
        "seats": -1,
        "sdk_mau": -1,
        "video_output": True,
        "doc_output": True,
        "tour_output": True,
        "help_center": True,
        "analytics": "advanced",
        "white_label": True,
        "voice_clone": True,
        "staleness_detection": True,
        "watermark": False,
    },
}


def get_plan_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def check_guide_limit(plan: str, current_guide_count: int) -> bool:
    """Returns True if user can create more guides."""
    limits = get_plan_limits(plan)
    max_guides = limits["total_guides"]
    if max_guides == -1:
        return True
    return current_guide_count < max_guides


def check_seat_limit(plan: str, current_member_count: int) -> bool:
    """Returns True if workspace can add more members."""
    limits = get_plan_limits(plan)
    max_seats = limits["seats"]
    if max_seats == -1:
        return True
    return current_member_count < max_seats


def check_feature_access(plan: str, feature: str) -> bool:
    """Check if a plan has access to a specific feature."""
    limits = get_plan_limits(plan)
    return bool(limits.get(feature, False))
