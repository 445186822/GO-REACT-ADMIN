import { http } from '../request/http';

export type AnnouncementRow = {
  id: number;
  title: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  created_by: number;
  published_at: string;
  expired_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;

  // Computed fields
  read_count?: number | null;
  total_count?: number | null;
  my_read_at?: string | null;
};

export type RecipientReadRow = {
  user_id: number;
  display_name: string;
  avatar?: string | null;
  read_at?: string | null;
};

export type ReadStatusResponse = {
  total: number;
  read_count: number;
  readers: RecipientReadRow[];
  unreaders: RecipientReadRow[];
};

export type AnnouncementCreateRequest = {
  title: string;
  content: string;
  category: string;
  priority: string;
  recipient_ids?: number[];
  expired_at?: string;
};

export type AnnouncementUpdateRequest = {
  title?: string;
  content?: string;
  category?: string;
  priority?: string;
  status?: string;
};

export async function listAnnouncements(params?: {
  page?: number;
  page_size?: number;
  scope?: string;
  status?: string;
  category?: string;
}) {
  const res = await http.get<unknown, { data: { items: AnnouncementRow[]; page: number; page_size: number; total: number } }>(
    '/announcements',
    { params },
  );
  return res.data;
}

export async function getAnnouncement(id: number) {
  const res = await http.get<unknown, { data: AnnouncementRow }>(`/announcements/${id}`);
  return res.data;
}

export async function createAnnouncement(data: AnnouncementCreateRequest) {
  return http.post('/announcements', data);
}

export async function updateAnnouncement(id: number, data: AnnouncementUpdateRequest) {
  return http.put(`/announcements/${id}`, data);
}

export async function expireAnnouncement(id: number) {
  return http.put(`/announcements/${id}/expire`);
}

export async function getAnnouncementReadStatus(id: number) {
  const res = await http.get<unknown, { data: ReadStatusResponse }>(`/announcements/${id}/read-status`);
  return res.data;
}

export async function markAnnouncementRead(id: number) {
  return http.put(`/announcements/${id}/read`);
}

export async function unreadAnnouncementCount() {
  const res = await http.get<unknown, { data: { count: number } }>('/announcements/unread-count');
  return res.data.count;
}
