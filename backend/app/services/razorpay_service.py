from typing import Optional

import razorpay

from app.config import settings

client = None
if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

RAZORPAY_PLANS = {
    "starter_monthly": {"amount": 99900, "period": "monthly", "interval": 1, "name": "Starter Monthly"},
    "starter_annual": {"amount": 799900, "period": "yearly", "interval": 1, "name": "Starter Annual"},
    "pro_monthly": {"amount": 249900, "period": "monthly", "interval": 1, "name": "Pro Monthly"},
    "pro_annual": {"amount": 1999900, "period": "yearly", "interval": 1, "name": "Pro Annual"},
    "business_monthly": {"amount": 699900, "period": "monthly", "interval": 1, "name": "Business Monthly"},
    "business_annual": {"amount": 5599900, "period": "yearly", "interval": 1, "name": "Business Annual"},
}

_plan_cache = {}


def get_or_create_plan(plan_key: str) -> str:
    if plan_key in _plan_cache:
        return _plan_cache[plan_key]

    if not client:
        raise ValueError("Razorpay client not configured")

    plan_config = RAZORPAY_PLANS.get(plan_key)
    if not plan_config:
        raise ValueError(f"Invalid plan: {plan_key}")

    try:
        plans = client.plan.all({"count": 100})
        for p in plans.get("items", []):
            if p.get("item", {}).get("name") == plan_config["name"]:
                _plan_cache[plan_key] = p["id"]
                return p["id"]
    except Exception:
        pass

    plan = client.plan.create({
        "period": plan_config["period"],
        "interval": plan_config["interval"],
        "item": {
            "name": plan_config["name"],
            "amount": plan_config["amount"],
            "currency": "INR",
            "description": f"GuidesForge {plan_config['name']}",
        },
    })
    _plan_cache[plan_key] = plan["id"]
    return plan["id"]


def create_subscription(
    workspace_id: str,
    plan: str,
    interval: str,
    customer_email: Optional[str] = None,
) -> dict:
    if not client:
        raise ValueError("Razorpay client not configured")

    plan_key = f"{plan}_{interval}"
    plan_id = get_or_create_plan(plan_key)

    subscription = client.subscription.create({
        "plan_id": plan_id,
        "total_count": 12 if interval == "monthly" else 1,
        "quantity": 1,
        "notes": {
            "workspace_id": workspace_id,
            "plan": plan,
            "interval": interval,
        },
    })

    return {
        "subscription_id": subscription["id"],
        "short_url": subscription.get("short_url"),
        "status": subscription["status"],
    }


def verify_payment_signature(
    razorpay_payment_id: str,
    razorpay_subscription_id: str,
    razorpay_signature: str,
) -> bool:
    if not client:
        return False

    try:
        client.utility.verify_payment_signature({
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_subscription_id": razorpay_subscription_id,
            "razorpay_signature": razorpay_signature,
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        return False


def cancel_subscription(subscription_id: str) -> dict:
    if not client:
        raise ValueError("Razorpay client not configured")

    result = client.subscription.cancel(subscription_id)
    return {"id": result["id"], "status": result["status"]}
