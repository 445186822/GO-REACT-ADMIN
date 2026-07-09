import { http } from '../request/http';

export type CodegenTable = {
  name: string;
};

export type CodegenColumn = {
  name: string;
  data_type: string;
  is_nullable: boolean;
  has_default: boolean;
  is_primary_key: boolean;
  typescript_type: string;
  form_type: string;
  editable: boolean;
};

export type CodegenFile = {
  path: string;
  content: string;
  exists: boolean;
};

export type CodegenRequest = {
  table_name: string;
  feature_name: string;
  module_name: string;
  route_path: string;
  permission_prefix: string;
  menu_icon: string;
  overwrite?: boolean;
  columns?: CodegenColumn[];
};

export async function listCodegenTables() {
  const res = await http.get<unknown, { data: CodegenTable[] }>('/code-generator/tables');
  return res.data;
}

export async function getCodegenColumns(table: string) {
  const res = await http.get<unknown, { data: CodegenColumn[] }>(`/code-generator/tables/${table}/columns`);
  return res.data;
}

export async function previewCodegen(data: CodegenRequest) {
  const res = await http.post<unknown, { data: { files: CodegenFile[] } }>('/code-generator/preview', data);
  return res.data.files;
}

export async function generateCodegen(data: CodegenRequest) {
  const res = await http.post<unknown, { data: { files: CodegenFile[] } }>('/code-generator/generate', data);
  return res.data.files;
}
