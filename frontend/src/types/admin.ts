export interface AdminConfig {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminConfigCreateRequest {
  email: string;
  role: string;
}

export interface AdminConfigUpdateRequest {
  role?: string;
  is_active?: boolean;
} 