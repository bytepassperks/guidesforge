import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/guidesforge")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Storage (iDrive E2 / S3-compatible)
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "https://s3.us-west-1.idrivee2.com")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "crop-spray-uploads")

    # AI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    MODAL_TOKEN_ID: str = os.getenv("MODAL_TOKEN_ID", "")
    MODAL_TOKEN_SECRET: str = os.getenv("MODAL_TOKEN_SECRET", "")

    # Payments
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")

    # App
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-to-32-byte-random-string")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Email
    MAILGUN_API_KEY: str = os.getenv("MAILGUN_API_KEY", "")
    MAILGUN_DOMAIN: str = os.getenv("MAILGUN_DOMAIN", "guidesforge.org")
    CUSTOMERIO_SITE_ID: str = os.getenv("CUSTOMERIO_SITE_ID", "")
    CUSTOMERIO_API_KEY: str = os.getenv("CUSTOMERIO_API_KEY", "")

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"


settings = Settings()
