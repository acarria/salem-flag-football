import pytest
from unittest.mock import patch


class TestSendGroupInvitation:
    """Tests for send_group_invitation."""

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_sends_with_correct_args(self, mock_settings, mock_resend):
        mock_settings.RESEND_API_KEY = "re_test_key"
        mock_settings.EMAIL_FROM = "noreply@salemflag.com"

        from app.services.email_service import send_group_invitation

        send_group_invitation(
            to_email="player@example.com",
            to_name="John",
            inviter_name="Alice",
            group_name="Rockets",
            league_name="Summer 2026",
            token="abc123token",
            app_url="https://salemflag.com",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["from"] == "noreply@salemflag.com"
        assert call_args["to"] == "player@example.com"
        assert "Rockets" in call_args["subject"]
        assert "Summer 2026" in call_args["subject"]
        assert "https://salemflag.com/invite/abc123token" in call_args["html"]
        assert "John" in call_args["html"]
        assert "Alice" in call_args["html"]

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_html_escaping_prevents_xss(self, mock_settings, mock_resend):
        """HTML special characters in user-supplied fields are escaped."""
        mock_settings.RESEND_API_KEY = "re_test_key"
        mock_settings.EMAIL_FROM = "noreply@salemflag.com"

        from app.services.email_service import send_group_invitation

        send_group_invitation(
            to_email="player@example.com",
            to_name='<script>alert("xss")</script>',
            inviter_name='<img src=x onerror=alert(1)>',
            group_name="Team <b>Bold</b>",
            league_name='League "Quoted"',
            token="tok",
            app_url="https://salemflag.com",
        )

        call_args = mock_resend.Emails.send.call_args[0][0]
        html = call_args["html"]
        subject = call_args["subject"]

        # Raw HTML tags must not appear unescaped
        assert "<script>" not in html
        assert "<img " not in html
        assert "&lt;script&gt;" in html
        assert "&lt;img " in html
        # Subject also escapes
        assert "<b>" not in subject
        assert "&lt;b&gt;" in subject

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_error_propagation(self, mock_settings, mock_resend):
        """Exceptions from resend.Emails.send propagate to the caller."""
        mock_settings.RESEND_API_KEY = "re_test_key"
        mock_settings.EMAIL_FROM = "noreply@salemflag.com"
        mock_resend.Emails.send.side_effect = RuntimeError("API failure")

        from app.services.email_service import send_group_invitation

        with pytest.raises(RuntimeError, match="API failure"):
            send_group_invitation(
                to_email="a@b.com",
                to_name="X",
                inviter_name="Y",
                group_name="G",
                league_name="L",
                token="t",
                app_url="https://example.com",
            )


class TestSendContactMessage:
    """Tests for send_contact_message."""

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_sends_with_correct_args(self, mock_settings, mock_resend):
        mock_settings.RESEND_API_KEY = "re_test_key"
        mock_settings.EMAIL_FROM = "noreply@salemflag.com"
        mock_settings.CONTACT_EMAIL = "admin@salemflag.com"

        from app.services.email_service import send_contact_message

        send_contact_message(
            sender_name="Bob Smith",
            sender_email="bob@example.com",
            subject="Question about registration",
            message="When does registration open?",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["from"] == "noreply@salemflag.com"
        assert call_args["to"] == "admin@salemflag.com"
        assert "[Contact]" in call_args["subject"]
        assert "Question about registration" in call_args["subject"]
        assert "Bob Smith" in call_args["html"]
        assert "bob@example.com" in call_args["html"]
        assert "When does registration open?" in call_args["html"]

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_html_escaping_prevents_xss(self, mock_settings, mock_resend):
        """HTML special characters in contact form fields are escaped."""
        mock_settings.RESEND_API_KEY = "re_test_key"
        mock_settings.EMAIL_FROM = "noreply@salemflag.com"
        mock_settings.CONTACT_EMAIL = "admin@salemflag.com"

        from app.services.email_service import send_contact_message

        send_contact_message(
            sender_name='<script>alert("xss")</script>',
            sender_email="evil@test.com",
            subject='<img src=x onerror=alert(1)>',
            message='<div onclick="steal()">Click me</div>',
        )

        call_args = mock_resend.Emails.send.call_args[0][0]
        html = call_args["html"]
        subject = call_args["subject"]

        assert "<script>" not in html
        assert "&lt;script&gt;" in html
        assert "<div " not in html
        assert "&lt;div " in html
        assert "<img " not in subject
        assert "&lt;img " in subject

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_newlines_converted_to_br(self, mock_settings, mock_resend):
        """Newline characters in the message are converted to <br /> tags."""
        mock_settings.RESEND_API_KEY = "re_test_key"
        mock_settings.EMAIL_FROM = "noreply@salemflag.com"
        mock_settings.CONTACT_EMAIL = "admin@salemflag.com"

        from app.services.email_service import send_contact_message

        send_contact_message(
            sender_name="Bob",
            sender_email="bob@example.com",
            subject="Test",
            message="Line one\nLine two\nLine three",
        )

        call_args = mock_resend.Emails.send.call_args[0][0]
        html = call_args["html"]
        assert "Line one<br />Line two<br />Line three" in html

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_error_propagation(self, mock_settings, mock_resend):
        """Exceptions from resend.Emails.send propagate to the caller."""
        mock_settings.RESEND_API_KEY = "re_test_key"
        mock_settings.EMAIL_FROM = "noreply@salemflag.com"
        mock_settings.CONTACT_EMAIL = "admin@salemflag.com"
        mock_resend.Emails.send.side_effect = ConnectionError("Network down")

        from app.services.email_service import send_contact_message

        with pytest.raises(ConnectionError, match="Network down"):
            send_contact_message(
                sender_name="X",
                sender_email="x@y.com",
                subject="S",
                message="M",
            )
