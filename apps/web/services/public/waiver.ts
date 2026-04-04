export interface SignedWaiverSummary {
  signature_id: string;
  league_id: string;
  league_name: string;
  waiver_version: string;
  signed_at: string;
  full_name_typed: string;
  has_pdf: boolean;
}

export interface SignedWaiverDetail extends SignedWaiverSummary {
  waiver_content: string;
}
