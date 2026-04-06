"""Billing routes - Stripe + Razorpay."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.models.database import Subscription, User, Workspace, WorkspaceMember, get_db
from app.schemas.billing import (
    CancelSubscriptionRequest,
    EasebuzzCheckoutRequest,
    RazorpayCheckoutRequest,
    StripeCheckoutRequest,
    SubscriptionResponse,
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.post("/stripe/checkout")
def create_stripe_checkout(
    data: StripeCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.stripe_service import create_checkout_session

    ws = db.query(Workspace).filter(Workspace.id == data.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == ws.id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only owners/admins can manage billing")

    try:
        checkout_url = create_checkout_session(
            workspace_id=str(ws.id),
            plan=data.plan,
            interval=data.interval,
            success_url=f"{settings.FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/billing/cancel",
            customer_email=current_user.email,
        )
        return {"checkout_url": checkout_url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    import stripe

    from app.services.stripe_service import construct_webhook_event

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = construct_webhook_event(payload, sig_header)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        workspace_id = session["metadata"]["workspace_id"]
        plan = session["metadata"]["plan"]
        interval = session["metadata"]["interval"]

        # Create or update subscription
        sub = db.query(Subscription).filter(
            Subscription.workspace_id == workspace_id
        ).first()

        if sub:
            sub.plan = plan
            sub.provider = "stripe"
            sub.provider_subscription_id = session.get("subscription")
            sub.status = "active"
            sub.interval = interval
            sub.currency = "usd"
        else:
            sub = Subscription(
                workspace_id=uuid.UUID(workspace_id),
                plan=plan,
                currency="usd",
                interval=interval,
                provider="stripe",
                provider_subscription_id=session.get("subscription"),
                status="active",
            )
            db.add(sub)

        # Update workspace owner plan
        ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if ws:
            owner = db.query(User).filter(User.id == ws.owner_id).first()
            if owner:
                owner.plan = plan
                owner.plan_currency = "usd"

        db.commit()

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        sub = db.query(Subscription).filter(
            Subscription.provider_subscription_id == subscription["id"]
        ).first()
        if sub:
            sub.status = "cancelled"
            # Downgrade to free
            ws = db.query(Workspace).filter(Workspace.id == sub.workspace_id).first()
            if ws:
                owner = db.query(User).filter(User.id == ws.owner_id).first()
                if owner:
                    owner.plan = "free"
            db.commit()

    return {"status": "ok"}


@router.post("/razorpay/create-subscription")
def create_razorpay_subscription(
    data: RazorpayCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.razorpay_service import create_subscription

    ws = db.query(Workspace).filter(Workspace.id == data.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == ws.id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only owners/admins can manage billing")

    try:
        result = create_subscription(
            workspace_id=str(ws.id),
            plan=data.plan,
            interval=data.interval,
            customer_email=current_user.email,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    import hashlib
    import hmac

    payload = await request.body()

    # Verify webhook signature
    sig = request.headers.get("x-razorpay-signature", "")
    if settings.RAZORPAY_KEY_SECRET:
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if sig != expected:
            raise HTTPException(status_code=400, detail="Invalid signature")

    import json
    event = json.loads(payload)
    event_type = event.get("event")

    if event_type == "subscription.activated":
        entity = event["payload"]["subscription"]["entity"]
        workspace_id = entity.get("notes", {}).get("workspace_id")
        plan = entity.get("notes", {}).get("plan")
        interval = entity.get("notes", {}).get("interval")

        if workspace_id:
            sub = db.query(Subscription).filter(
                Subscription.workspace_id == workspace_id
            ).first()
            if sub:
                sub.plan = plan
                sub.provider = "razorpay"
                sub.provider_subscription_id = entity["id"]
                sub.status = "active"
                sub.currency = "inr"
            else:
                sub = Subscription(
                    workspace_id=uuid.UUID(workspace_id),
                    plan=plan,
                    currency="inr",
                    interval=interval or "monthly",
                    provider="razorpay",
                    provider_subscription_id=entity["id"],
                    status="active",
                )
                db.add(sub)

            ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if ws:
                owner = db.query(User).filter(User.id == ws.owner_id).first()
                if owner:
                    owner.plan = plan
                    owner.plan_currency = "inr"

            db.commit()

    elif event_type == "subscription.cancelled":
        entity = event["payload"]["subscription"]["entity"]
        sub = db.query(Subscription).filter(
            Subscription.provider_subscription_id == entity["id"]
        ).first()
        if sub:
            sub.status = "cancelled"
            ws = db.query(Workspace).filter(Workspace.id == sub.workspace_id).first()
            if ws:
                owner = db.query(User).filter(User.id == ws.owner_id).first()
                if owner:
                    owner.plan = "free"
            db.commit()

    return {"status": "ok"}


@router.post("/easebuzz/checkout")
def create_easebuzz_checkout(
    data: EasebuzzCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.easebuzz_service import initiate_payment

    ws = db.query(Workspace).filter(Workspace.id == data.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == ws.id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only owners/admins can manage billing")

    try:
        result = initiate_payment(
            workspace_id=str(ws.id),
            plan=data.plan,
            interval=data.interval,
            customer_email=current_user.email,
            customer_name=current_user.full_name or "Customer",
            currency=data.currency,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/easebuzz/callback")
async def easebuzz_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Easebuzz payment success/failure callback.

    Easebuzz POSTs to surl (success) or furl (failure) with payment details.
    """
    form_data = await request.form()
    response_data = dict(form_data)

    from app.services.easebuzz_service import verify_payment

    try:
        payment = verify_payment(response_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if payment["status"] == "success":
        workspace_id = payment["workspace_id"]
        plan = payment["plan"]
        interval = payment["interval"]

        if workspace_id:
            sub = db.query(Subscription).filter(
                Subscription.workspace_id == workspace_id
            ).first()

            currency = payment.get("currency", "inr")

            if sub:
                sub.plan = plan
                sub.provider = "easebuzz"
                sub.provider_subscription_id = payment["easebuzz_id"]
                sub.status = "active"
                sub.interval = interval
                sub.currency = currency
            else:
                sub = Subscription(
                    workspace_id=uuid.UUID(workspace_id),
                    plan=plan,
                    currency=currency,
                    interval=interval or "monthly",
                    provider="easebuzz",
                    provider_subscription_id=payment["easebuzz_id"],
                    status="active",
                )
                db.add(sub)

            ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if ws:
                owner = db.query(User).filter(User.id == ws.owner_id).first()
                if owner:
                    owner.plan = plan
                    owner.plan_currency = currency

            db.commit()

    return {"status": "ok", "payment_status": payment["status"], "txnid": payment["txnid"]}


@router.get("/easebuzz/status/{txnid}")
def get_easebuzz_status(
    txnid: str,
    current_user: User = Depends(get_current_user),
):
    """Check Easebuzz transaction status."""
    from app.services.easebuzz_service import transaction_status

    try:
        result = transaction_status(txnid)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription", response_model=SubscriptionResponse)
def get_subscription(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    sub = db.query(Subscription).filter(
        Subscription.workspace_id == workspace_id,
        Subscription.status == "active",
    ).first()

    if not sub:
        return SubscriptionResponse(
            plan=current_user.plan or "free",
            status="active" if current_user.plan != "free" else "none",
            provider=None,
            current_period_end=current_user.trial_ends_at,
            is_trial=current_user.trial_ends_at is not None and current_user.trial_ends_at > datetime.utcnow(),
        )

    return SubscriptionResponse(
        plan=sub.plan,
        status=sub.status,
        provider=sub.provider,
        current_period_end=sub.current_period_end,
        is_trial=False,
    )


@router.post("/cancel")
def cancel_subscription(
    data: CancelSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(
        Subscription.workspace_id == data.workspace_id,
        Subscription.status == "active",
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")

    try:
        if sub.provider == "stripe":
            from app.services.stripe_service import cancel_subscription as stripe_cancel
            stripe_cancel(sub.provider_subscription_id)
        elif sub.provider == "razorpay":
            from app.services.razorpay_service import cancel_subscription as rp_cancel
            rp_cancel(sub.provider_subscription_id)
        elif sub.provider == "easebuzz":
            # Easebuzz doesn't have subscription cancellation API
            # Just mark as cancelled in our DB
            pass

        sub.status = "cancelling"
        db.commit()
        return {"message": "Subscription will be cancelled at end of billing period"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
