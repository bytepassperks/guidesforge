"""GuidesForge API - Main FastAPI application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import admin, analytics, auth, billing, guides, help, pipeline, sdk, steps, workspace


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: create tables if needed
    from app.models.database import Base, engine
    Base.metadata.create_all(bind=engine)
    print("[STARTUP] Database tables created/verified")

    # Run lightweight column migrations for new fields
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE"
            ))
            conn.commit()
            print("[STARTUP] Migration: is_admin column ensured on users table")
        except Exception as e:
            print(f"[STARTUP] Migration note: {e}")

    yield
    # Shutdown
    print("[SHUTDOWN] Cleaning up...")


app = FastAPI(
    title="GuidesForge API",
    description="AI-powered guide creation platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    print(f"[ERROR] Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Register routers
app.include_router(auth.router)
app.include_router(guides.router)
app.include_router(steps.router)
app.include_router(workspace.router)
app.include_router(billing.router)
app.include_router(analytics.router)
app.include_router(sdk.router)
app.include_router(help.router)
app.include_router(pipeline.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {
        "name": "GuidesForge API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/api/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Embed viewer route (for iframe embeds)
@app.get("/embed/{guide_id}")
async def embed_viewer(guide_id: str):
    """Redirect to frontend embed viewer."""
    return JSONResponse(
        content={
            "redirect": f"{settings.FRONTEND_URL}/embed/{guide_id}",
            "guide_id": guide_id,
        }
    )
