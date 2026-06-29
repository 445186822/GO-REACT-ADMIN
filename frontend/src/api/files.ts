import { http } from '../request/http';
import type { Page } from './users';

export type FileRow = {
  id: number;
  original_name: string;
  mime_type: string;
  size: number;
  uploader_id: number;
  uploader: string;
  biz_type?: string | null;
  biz_id?: number | null;
  created_at: string;
};

export async function listFiles(params: { keyword?: string; page?: number; page_size?: number }): Promise<Page<FileRow>> {
  const res = await http.get<unknown, { data: Page<FileRow> }>('/files', { params });
  return res.data;
}

export async function uploadFile(file: File): Promise<{ id: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await http.post<unknown, { data: { id: number } }>('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function downloadFile(row: FileRow): Promise<void> {
  await downloadFileById(row.id, row.original_name);
}

export async function createFileObjectUrl(id: number): Promise<string> {
  const blob = await http.get<unknown, Blob>(`/files/${id}/download`, { responseType: 'blob' });
  return URL.createObjectURL(blob);
}

export async function downloadFileById(id: number, fileName: string): Promise<void> {
  const blob = await http.get<unknown, Blob>(`/files/${id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deleteFile(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/files/${id}`);
  return res.data;
}
