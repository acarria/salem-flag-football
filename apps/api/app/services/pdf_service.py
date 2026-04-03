import logging
from datetime import datetime

from fpdf import FPDF

logger = logging.getLogger(__name__)

# Helvetica is Latin-1 only. Replace common Unicode chars with ASCII equivalents.
_UNICODE_REPLACEMENTS = {
    "\u2014": "--",   # em dash
    "\u2013": "-",    # en dash
    "\u2018": "'",    # left single quote
    "\u2019": "'",    # right single quote
    "\u201c": '"',    # left double quote
    "\u201d": '"',    # right double quote
    "\u2026": "...",  # ellipsis
    "\u00a0": " ",    # non-breaking space
}


def _sanitize_for_latin1(text: str) -> str:
    for char, replacement in _UNICODE_REPLACEMENTS.items():
        text = text.replace(char, replacement)
    return text


def generate_waiver_pdf(
    waiver_content: str,
    waiver_version: str,
    league_name: str,
    player_name: str,
    signed_at: datetime,
    ip_address: str | None,
) -> bytes:
    """Generate a signed waiver PDF and return the raw bytes."""
    waiver_content = _sanitize_for_latin1(waiver_content)
    league_name = _sanitize_for_latin1(league_name)
    player_name = _sanitize_for_latin1(player_name)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Title
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Liability Waiver", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)

    # Metadata
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"League: {league_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Waiver Version: {waiver_version}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Divider
    pdf.set_draw_color(180, 180, 180)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    # Waiver body
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, waiver_content)
    pdf.ln(8)

    # Divider
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    # Signature block
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Electronic Signature", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Signed by: {player_name}", new_x="LMARGIN", new_y="NEXT")

    signed_at_str = signed_at.strftime("%B %d, %Y at %I:%M %p UTC")
    pdf.cell(0, 6, f"Date: {signed_at_str}", new_x="LMARGIN", new_y="NEXT")

    if ip_address:
        pdf.cell(0, 6, f"IP Address: {ip_address}", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(8)

    # Footer
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(
        0, 4,
        "This document was signed electronically in accordance with the "
        "Electronic Signatures in Global and National Commerce Act (ESIGN Act).",
    )

    return bytes(pdf.output())
