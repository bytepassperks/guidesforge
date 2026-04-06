from typing import Optional

import stripe

from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

STRIPE_PRICES = {
    "starter_monthly": "price_starter_monthly",
    "starter_annual": "price_starter_annual",
    "pro_monthly": "price_pro_monthly",
    "pro_annual": "price_pro_annual",
    "business_monthly": "price_business_monthly",
    "business_annual": "price_business_annual",
}

PLAN_AMOUNTS_USD = {
    "starter_monthly": 1500,
    "starter_annual": 12000,
    "pro_monthly": 3900,
    "pro_annual": 31200,
    "business_monthly": 9900,
    "business_annual": 79200,
}


def create_checkout_session(
    workspace_id: str,
    plan: str,
    interval: str,
    success_url: str,
    cancel_url: str,
    customer_email: Optional[str] = None,
) -> str:
    price_key = f"{plan}_{interval}"
    price_id = STRIPE_PRICES.get(price_key)
    if not price_id:
        raise ValueError(f"Invalid plan/interval combination: {price_key}")

    session_params = {
        "payment_method_types": ["card"],
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": "subscription",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"workspace_id": workspace_id, "plan": plan, "interval": interval},
    }
    if customer_email:
        session_params["customer_email"] = customer_email

    session = stripe.checkout.Session.create(**session_params)
    return session.url


def cancel_subscription(subscription_id: str) -> dict:
    subscription = stripe.Subscription.modify(
        subscription_id,
        cancel_at_period_end=True,
    )
    return {
        "id": subscription.id,
        "status": subscription.status,
        "cancel_at_period_end": subscription.cancel_at_period_end,
        "current_period_end": subscription.current_period_end,
    }


def get_subscription(subscription_id: str) -> dict:
    subscription = stripe.Subscription.retrieve(subscription_id)
    return {
        "id": subscription.id,
        "status": subscription.status,
        "plan": subscription.metadata.get("plan"),
        "current_period_end": subscription.current_period_end,
    }


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
