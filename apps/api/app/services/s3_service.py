import logging
from uuid import UUID

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)

_s3_client = None


def _get_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
    return _s3_client


def upload_waiver_pdf(
    pdf_bytes: bytes,
    league_id: UUID,
    player_id: UUID,
    signature_id: UUID,
) -> str | None:
    """Upload a signed waiver PDF to S3.

    Returns the S3 key on success, or None if no bucket is configured.
    """
    if not settings.WAIVER_S3_BUCKET:
        logger.debug("WAIVER_S3_BUCKET not set, skipping S3 upload")
        return None

    key = f"waivers/{league_id}/{player_id}/{signature_id}.pdf"
    try:
        _get_client().put_object(
            Bucket=settings.WAIVER_S3_BUCKET,
            Key=key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
        logger.info("Uploaded waiver PDF: s3://%s/%s", settings.WAIVER_S3_BUCKET, key)
        return key
    except ClientError:
        logger.exception("Failed to upload waiver PDF to S3")
        return None


def generate_presigned_url(s3_key: str, expiry: int = 3600) -> str | None:
    """Generate a presigned download URL for a waiver PDF.

    Returns the URL string, or None if the bucket is not configured.
    """
    if not settings.WAIVER_S3_BUCKET or not s3_key:
        return None

    try:
        url = _get_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.WAIVER_S3_BUCKET, "Key": s3_key},
            ExpiresIn=expiry,
        )
        return url
    except ClientError:
        logger.exception("Failed to generate presigned URL for %s", s3_key)
        return None
