import { http } from '../request/http';
import type { Page } from './users';

export type CustomerRow = {
  id: number;
  name: string;
  level: 'IMPORTANT' | 'NORMAL' | 'POTENTIAL';
  phone?: string | null;
  email?: string | null;
  owner: string;
  department: string;
  status: 'ACTIVE' | 'DISABLED';
  remark?: string | null;
};

export type CustomerForm = {
  name: string;
  level?: CustomerRow['level'];
  phone?: string;
  email?: string;
  status?: CustomerRow['status'];
  remark?: string;
};

export async function listCustomers(params: { keyword?: string; page?: number; page_size?: number }): Promise<Page<CustomerRow>> {
  const res = await http.get<unknown, { data: Page<CustomerRow> }>('/customers', { params });
  return res.data;
}

export async function exportCustomers(): Promise<void> {
  const blob = await http.post<unknown, Blob>('/customers/export', {}, { responseType: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `customers_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createCustomer(payload: CustomerForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/customers', payload);
  return res.data;
}

export async function updateCustomer(id: number, payload: CustomerForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/customers/${id}`, payload);
  return res.data;
}

export async function deleteCustomer(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/customers/${id}`);
  return res.data;
}
