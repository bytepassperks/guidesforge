"""DodoPayments service - unified payment gateway replacing Stripe/Razorpay/Easebuzz."""
import logging

from dodopayments import DodoPayments

from app.config import settings

logger = logging.getLogger(__name__)

# DodoPayments product IDs (created via API)
DODO_PRODUCTS = {
    "starter_monthly": "pdt_0Nc94XrWPR0xzKXFdI8MU",
    "starter_yearly": "pdt_0Nc94b1so0JD3T8zayTUD",
    "pro_monthly": "pdt_0Nc94b5u717wLdQ9uaz2u",
    "pro_yearly": "pdt_0Nc94bCvILUg1odJbbjMc",
    "business_monthly": "pdt_0Nc94bHWpwCcIxKepWPGu",
    "business_yearly": "pdt_0Nc94bLQbVXP1CwYmfLa5",
}


def _get_client() -> DodoPayments:
    """Get an initialized DodoPayments client."""
    api_key = settings.DODO_PAYMENTS_API_KEY
    if not api_key:
        raise ValueError("DODO_PAYMENTS_API_KEY not configured")

    return DodoPayments(
        bearer_token=api_key,
        environment="live_mode",
    )


def create_checkout_session(
    workspace_id: str,
    plan: str,
    interval: str,
    customer_email: str,
    customer_name: str = "Customer",
) -> dict:
    """Create a DodoPayments checkout session for a subscription.

    Returns dict with checkout_url and session_id.
    """
    plan_key = f"{plan}_{interval}"
    product_id = DODO_PRODUCTS.get(plan_key)
    if not product_id:
        raise ValueError(f"Invalid plan: {plan_key}")

    client = _get_client()

    return_url = f"{settings.FRONTEND_URL}/billing?payment=success"

    session = client.checkout_sessions.create(
        product_cart=[
            {
                "product_id": product_id,
                "quantity": 1,
            }
        ],
        customer={
            "email": customer_email,
            "name": customer_name,
        },
        payment_link=True,
        return_url=return_url,
        metadata={
            "workspace_id": workspace_id,
            "plan": plan,
            "interval": interval,
        },
    )

    checkout_url = getattr(session, "url", None) or getattr(session, "checkout_url", None)
    session_id = getattr(session, "session_id", None) or getattr(session, "id", None)

    if not checkout_url:
        # Try to construct from session response
        logger.warning("No checkout_url in response, session attrs: %s", dir(session))
        raise ValueError("Failed to get checkout URL from DodoPayments")

    return {
        "checkout_url": checkout_url,
        "session_id": str(session_id) if session_id else None,
        "product_id": product_id,
        "plan": plan,
        "interval": interval,
    }


def verify_webhook(payload: bytes, headers: dict) -> dict:
    """Verify and parse a DodoPayments webhook event.

    Uses the official SDK's unwrap method for signature verification.
    Falls back to unsafe_unwrap if no webhook key is configured.
    """
    webhook_key = settings.DODO_PAYMENTS_WEBHOOK_KEY
    client = _get_client()

    if webhook_key:
        # Use SDK's built-in signature verification
        client = DodoPayments(
            bearer_token=settings.DODO_PAYMENTS_API_KEY,
            environment="live_mode",
            webhook_key=webhook_key,
        )
        event = client.webhooks.unwrap(
            payload,
            headers={
                "webhook-id": headers.get("webhook-id", ""),
                "webhook-signature": headers.get("webhook-signature", ""),
                "webhook-timestamp": headers.get("webhook-timestamp", ""),
            },
        )
    else:
        # No webhook key - parse without verification (not recommended for production)
        logger.warning("No DODO_PAYMENTS_WEBHOOK_KEY set - skipping signature verification")
        import json
        event = json.loads(payload)

    return event
