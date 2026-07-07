import { http } from '../request/http';
import type { Page } from './users';

export type ComplexFormExtra = {
  feature_flags?: string[];
  tags?: string[];
  address?: string;
  risk_level?: string;
  delivery_mode?: string;
  approval_required?: boolean;
  approval_note?: string;
  custom_json?: unknown;
};

export type ComplexFormRow = {
  id: number;
  title: string;
  applicant: string;
  department: string;
  category: 'PROCUREMENT' | 'CONTRACT' | 'ASSET' | 'TRAVEL' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  amount?: number | null;
  quantity?: number | null;
  score?: number | null;
  progress?: number | null;
  rating?: number | null;
  enabled: boolean;
  start_date?: string | null;
  end_date?: string | null;
  appointment_time?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  attachment_url?: string | null;
  form_extra?: ComplexFormExtra | null;
  remark?: string | null;
  created_at: string;
};

export type ComplexFormPayload = Omit<ComplexFormRow, 'id' | 'created_at' | 'form_extra'> & {
  form_extra?: ComplexFormExtra;
};

export async function listComplexForms(params: { keyword?: string; status?: string; page?: number; page_size?: number }): Promise<Page<ComplexFormRow>> {
  const res = await http.get<unknown, { data: Page<ComplexFormRow> }>('/complex-forms', { params });
  return res.data;
}

export async function createComplexForm(payload: ComplexFormPayload): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/complex-forms', payload);
  return res.data;
}

export async function updateComplexForm(id: number, payload: ComplexFormPayload): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/complex-forms/${id}`, payload);
  return res.data;
}

export async function deleteComplexForm(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/complex-forms/${id}`);
  return res.data;
}
