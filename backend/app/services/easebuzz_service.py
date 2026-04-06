"""Easebuzz Payment Gateway service."""
import hashlib
import uuid as uuid_mod
from typing import Optional

import requests

from app.config import settings

EASEBUZZ_API_URL = (
    "https://pay.easebuzz.in"
    if settings.ENVIRONMENT == "production"
    else "https://testpay.easebuzz.in"
)

# Plan pricing in INR (paise not needed - Easebuzz uses rupees as float strings)
EASEBUZZ_PLANS = {
    "starter_monthly": {"amount": "999.00", "name": "Starter Monthly"},
    "starter_yearly": {"amount": "9590.00", "name": "Starter Annual"},
    "pro_monthly": {"amount": "2499.00", "name": "Pro Monthly"},
    "pro_yearly": {"amount": "23990.00", "name": "Pro Annual"},
    "business_monthly": {"amount": "6999.00", "name": "Business Monthly"},
    "business_yearly": {"amount": "67190.00", "name": "Business Annual"},
}

# International pricing in USD
EASEBUZZ_PLANS_USD = {
    "starter_monthly": {"amount": "15.00", "name": "Starter Monthly"},
    "starter_yearly": {"amount": "144.00", "name": "Starter Annual"},
    "pro_monthly": {"amount": "39.00", "name": "Pro Monthly"},
    "pro_yearly": {"amount": "374.00", "name": "Pro Annual"},
    "business_monthly": {"amount": "99.00", "name": "Business Monthly"},
    "business_yearly": {"amount": "950.00", "name": "Business Annual"},
}


def _generate_hash(data_string: str) -> str:
    """Generate SHA-512 hash for Easebuzz API authentication."""
    return hashlib.sha512(data_string.encode("utf-8")).hexdigest()


def initiate_payment(
    workspace_id: str,
    plan: str,
    interval: str,
    customer_email: str,
    customer_name: str = "Customer",
    customer_phone: str = "9999999999",
    currency: str = "INR",
) -> dict:
    """Initiate an Easebuzz payment and return the payment access key.

    Returns dict with 'access_key' for seamless checkout or 'payment_url' for redirect.
    """
    key = settings.EASEBUZZ_KEY
    salt = settings.EASEBUZZ_SALT

    if not key or not salt:
        raise ValueError("Easebuzz credentials not configured")

    plan_key = f"{plan}_{interval}"

    if currency.upper() != "INR":
        plan_config = EASEBUZZ_PLANS_USD.get(plan_key)
    else:
        plan_config = EASEBUZZ_PLANS.get(plan_key)

    if not plan_config:
        raise ValueError(f"Invalid plan: {plan_key}")

    txnid = f"GF_{uuid_mod.uuid4().hex[:16].upper()}"
    amount = plan_config["amount"]
    productinfo = f"GuidesForge {plan_config['name']}"

    # Build hash string per official Easebuzz SDK:
    # key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
    # udf1 = workspace_id, udf2 = plan, udf3 = interval, udf4 = currency
    hash_string = (
        f"{key}|{txnid}|{amount}|{productinfo}|{customer_name}|{customer_email}"
        f"|{workspace_id}|{plan}|{interval}|{currency.lower()}|||||||{salt}"
    )
    hash_value = _generate_hash(hash_string)

    # Build request payload
    payload = {
        "key": key,
        "txnid": txnid,
        "amount": amount,
        "productinfo": productinfo,
        "firstname": customer_name,
        "phone": customer_phone,
        "email": customer_email,
        "surl": f"{settings.FRONTEND_URL}/billing?payment=success&txnid={txnid}",
        "furl": f"{settings.FRONTEND_URL}/billing?payment=failed&txnid={txnid}",
        "hash": hash_value,
        "udf1": workspace_id,
        "udf2": plan,
        "udf3": interval,
        "udf4": currency.lower(),
    }

    # Add currency for international payments
    if currency.upper() != "INR":
        payload["currency"] = currency.upper()

    # Use /payment/initiateLink endpoint (per official Easebuzz SDK)
    response = requests.post(
        f"{EASEBUZZ_API_URL}/payment/initiateLink",
        data=payload,
        timeout=30,
    )

    if response.status_code != 200:
        raise ValueError(f"Easebuzz API error: HTTP {response.status_code}")

    result = response.json()
    if result.get("status") == 1 and result.get("data"):
        access_key = result["data"]
        return {
            "access_key": access_key,
            "payment_url": f"{EASEBUZZ_API_URL}/pay/{access_key}",
            "txnid": txnid,
            "key": key,
            "environment": "production" if "pay.easebuzz.in" in EASEBUZZ_API_URL else "test",
        }
    else:
        error_msg = result.get("data", "Unknown error")
        raise ValueError(f"Easebuzz error: {error_msg}")


def verify_payment(response_data: dict) -> dict:
    """Verify Easebuzz payment response hash.

    Easebuzz sends a POST callback to surl/furl with payment details.
    Verify the response hash to ensure data integrity.

    Returns dict with payment status and metadata.
    """
    salt = settings.EASEBUZZ_SALT
    if not salt:
        raise ValueError("Easebuzz salt not configured")

    # Response reverse hash format (per official Easebuzz SDK):
    # salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    status = response_data.get("status", "")
    txnid = response_data.get("txnid", "")
    amount = response_data.get("amount", "")
    productinfo = response_data.get("productinfo", "")
    firstname = response_data.get("firstname", "")
    email = response_data.get("email", "")
    udf1 = response_data.get("udf1", "")  # workspace_id
    udf2 = response_data.get("udf2", "")  # plan
    udf3 = response_data.get("udf3", "")  # interval
    key = response_data.get("key", "")
    received_hash = response_data.get("hash", "")

    # Reverse hash: salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    hash_string = (
        f"{salt}|{status}"
        f"|{response_data.get('udf10', '')}|{response_data.get('udf9', '')}"
        f"|{response_data.get('udf8', '')}|{response_data.get('udf7', '')}"
        f"|{response_data.get('udf6', '')}|{response_data.get('udf5', '')}"
        f"|{response_data.get('udf4', '')}|{udf3}|{udf2}|{udf1}"
        f"|{email}|{firstname}|{productinfo}|{amount}|{txnid}|{key}"
    )
    calculated_hash = _generate_hash(hash_string)

    if calculated_hash != received_hash:
        raise ValueError("Hash verification failed - possible tampering")

    return {
        "verified": True,
        "status": status,
        "txnid": txnid,
        "amount": amount,
        "workspace_id": udf1,
        "plan": udf2,
        "interval": udf3,
        "currency": response_data.get("udf4", "inr"),
        "email": email,
        "easebuzz_id": response_data.get("easepayid", ""),
        "payment_mode": response_data.get("mode", ""),
    }


def transaction_status(txnid: str) -> dict:
    """Check transaction status via Easebuzz Transaction API."""
    key = settings.EASEBUZZ_KEY
    salt = settings.EASEBUZZ_SALT

    if not key or not salt:
        raise ValueError("Easebuzz credentials not configured")

    hash_string = f"{key}|{txnid}|{salt}"
    hash_value = _generate_hash(hash_string)

    response = requests.post(
        f"{EASEBUZZ_API_URL}/transaction/v1/retrieve",
        data={
            "key": key,
            "txnid": txnid,
            "hash": hash_value,
        },
        timeout=30,
    )

    if response.status_code != 200:
        raise ValueError(f"Easebuzz API error: HTTP {response.status_code}")

    result = response.json()
    return result


def initiate_refund(
    txnid: str,
    amount: str,
    phone: str,
    email: str,
    refund_reason: Optional[str] = None,
) -> dict:
    """Initiate a refund via Easebuzz Refund API."""
    key = settings.EASEBUZZ_KEY
    salt = settings.EASEBUZZ_SALT

    if not key or not salt:
        raise ValueError("Easebuzz credentials not configured")

    hash_string = f"{key}|{txnid}|{amount}|{email}|{phone}|{salt}"
    hash_value = _generate_hash(hash_string)

    payload = {
        "key": key,
        "txnid": txnid,
        "refund_amount": amount,
        "phone": phone,
        "email": email,
        "hash": hash_value,
    }
    if refund_reason:
        payload["reason"] = refund_reason

    response = requests.post(
        f"{EASEBUZZ_API_URL}/transaction/v1/refund",
        data=payload,
        timeout=30,
    )

    if response.status_code != 200:
        raise ValueError(f"Easebuzz refund error: HTTP {response.status_code}")

    return response.json()
