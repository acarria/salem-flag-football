"""Unit tests for pdf_service.py — no DB required."""

from datetime import datetime, timezone

from app.services.pdf_service import generate_waiver_pdf


class TestGenerateWaiverPdf:
    def test_returns_valid_pdf_bytes(self):
        pdf = generate_waiver_pdf(
            waiver_content="This is a test waiver.",
            waiver_version="2025-v1",
            league_name="Test League",
            player_name="Jane Doe",
            signed_at=datetime(2026, 1, 15, 14, 30, tzinfo=timezone.utc),
            ip_address="192.168.1.1",
        )
        assert isinstance(pdf, bytes)
        assert pdf[:5] == b"%PDF-"
        assert len(pdf) > 100

    def test_generates_multipage_for_long_content(self):
        long_content = "This is a line of waiver text.\n" * 200
        pdf = generate_waiver_pdf(
            waiver_content=long_content,
            waiver_version="v1",
            league_name="Salem League",
            player_name="Alex Johnson",
            signed_at=datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc),
            ip_address=None,
        )
        assert isinstance(pdf, bytes)
        assert pdf[:5] == b"%PDF-"
        assert len(pdf) > 1000

    def test_no_ip_address(self):
        # Should not raise when ip_address is None
        pdf = generate_waiver_pdf(
            waiver_content="Content.",
            waiver_version="v1",
            league_name="League",
            player_name="Player",
            signed_at=datetime.now(timezone.utc),
            ip_address=None,
        )
        assert pdf[:5] == b"%PDF-"
