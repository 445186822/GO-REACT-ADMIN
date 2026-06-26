import { http } from '../request/http';
import type { Page } from './users';

// Categories
export type CategoryRow = {
  id: number;
  name: string;
  parent_id?: number | null;
  sort_order: number;
  status: string;
  children?: CategoryRow[];
};

export type CategoryForm = {
  name: string;
  parent_id?: number | null;
  sort_order?: number;
  status?: string;
};

export async function treeCategories(): Promise<CategoryRow[]> {
  const res = await http.get<unknown, { data: CategoryRow[] }>('/kb/categories/tree');
  return res.data;
}

export async function createCategory(payload: CategoryForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/kb/categories', payload);
  return res.data;
}

export async function updateCategory(id: number, payload: CategoryForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/kb/categories/${id}`, payload);
  return res.data;
}

export async function deleteCategory(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/kb/categories/${id}`);
  return res.data;
}

// Articles
export type ArticleRow = {
  id: number;
  title: string;
  content: string;
  category_id?: number | null;
  tags?: string | null;
  is_pinned: boolean;
  view_count: number;
  like_count: number;
  status: string;
  author_name: string;
  created_at: string;
};

export type ArticleForm = {
  title: string;
  content: string;
  category_id?: number | null;
  tags?: string;
  is_pinned?: boolean;
  status?: string;
};

export async function listArticles(params: {
  keyword?: string;
  category_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<Page<ArticleRow>> {
  const res = await http.get<unknown, { data: Page<ArticleRow> }>('/kb/articles', { params });
  return res.data;
}

export async function getArticle(id: number): Promise<ArticleRow> {
  const res = await http.get<unknown, { data: ArticleRow }>(`/kb/articles/${id}`);
  return res.data;
}

export async function createArticle(payload: ArticleForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/kb/articles', payload);
  return res.data;
}

export async function updateArticle(id: number, payload: ArticleForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/kb/articles/${id}`, payload);
  return res.data;
}

export async function deleteArticle(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/kb/articles/${id}`);
  return res.data;
}

// FAQs
export type FAQRow = {
  id: number;
  question: string;
  answer: string;
  category_id?: number | null;
  sort_order: number;
  view_count: number;
  like_count: number;
  status: string;
};

export type FAQForm = {
  question: string;
  answer: string;
  category_id?: number | null;
  sort_order?: number;
  status?: string;
};

export async function listFAQs(params: {
  keyword?: string;
  category_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<Page<FAQRow>> {
  const res = await http.get<unknown, { data: Page<FAQRow> }>('/kb/faqs', { params });
  return res.data;
}

export async function createFAQ(payload: FAQForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/kb/faqs', payload);
  return res.data;
}

export async function updateFAQ(id: number, payload: FAQForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/kb/faqs/${id}`, payload);
  return res.data;
}

export async function deleteFAQ(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/kb/faqs/${id}`);
  return res.data;
}
