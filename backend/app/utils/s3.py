import uuid
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig

from app.config import settings


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-west-1",
    )


def upload_file(
    file_data: bytes,
    key: str,
    content_type: str = "application/octet-stream",
    bucket: Optional[str] = None,
) -> str:
    s3 = get_s3_client()
    bucket = bucket or settings.S3_BUCKET
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_data,
        ContentType=content_type,
    )
    return f"{settings.S3_ENDPOINT}/{bucket}/{key}"


def upload_screenshot(screenshot_data: bytes, guide_id: str, step_number: int) -> str:
    key = f"screenshots/{guide_id}/step_{step_number}_{uuid.uuid4().hex[:8]}.png"
    return upload_file(screenshot_data, key, "image/png")


def upload_audio(audio_data: bytes, guide_id: str, step_number: int) -> str:
    key = f"audio/{guide_id}/step_{step_number}_{uuid.uuid4().hex[:8]}.wav"
    return upload_file(audio_data, key, "audio/wav")


def upload_video(video_data: bytes, guide_id: str) -> str:
    key = f"videos/{guide_id}/{uuid.uuid4().hex[:8]}.mp4"
    return upload_file(video_data, key, "video/mp4")


def upload_diff_image(image_data: bytes, guide_id: str, step_number: int) -> str:
    key = f"baselines/{guide_id}/diff_step_{step_number}_{uuid.uuid4().hex[:8]}.png"
    return upload_file(image_data, key, "image/png")


def upload_voice_profile(audio_data: bytes, user_id: str) -> str:
    key = f"voice-profiles/{user_id}/{uuid.uuid4().hex[:8]}.wav"
    return upload_file(audio_data, key, "audio/wav")


def upload_annotated_screenshot(image_data: bytes, guide_id: str, step_number: int) -> str:
    key = f"screenshots/{guide_id}/annotated_step_{step_number}_{uuid.uuid4().hex[:8]}.png"
    return upload_file(image_data, key, "image/png")


def download_file(key: str, bucket: Optional[str] = None) -> bytes:
    s3 = get_s3_client()
    bucket = bucket or settings.S3_BUCKET
    response = s3.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


def generate_presigned_url(key: str, expiration: int = 3600, bucket: Optional[str] = None) -> str:
    s3 = get_s3_client()
    bucket = bucket or settings.S3_BUCKET
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expiration,
    )


def delete_file(key: str, bucket: Optional[str] = None):
    s3 = get_s3_client()
    bucket = bucket or settings.S3_BUCKET
    s3.delete_object(Bucket=bucket, Key=key)
