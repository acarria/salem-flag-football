import html

from pydantic import BaseModel, EmailStr, Field, field_validator


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str
    recaptcha_token: str = Field(..., max_length=2048)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return html.escape(v)

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Subject is required")
        if len(v) > 200:
            raise ValueError("Subject must be 200 characters or fewer")
        return html.escape(v)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message is required")
        if len(v) > 2000:
            raise ValueError("Message must be 2000 characters or fewer")
        return html.escape(v)
