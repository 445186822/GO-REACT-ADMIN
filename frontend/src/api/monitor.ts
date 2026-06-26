import { http } from '../request/http';

export type OverviewData = {
  go_version: string;
  num_cpu: number;
  num_goroutine: number;
  mem_alloc_mb: number;
  mem_total_mb: number;
  uptime_hours: number;
  uptime_str: string;
};

export type DBStatsData = {
  version: string;
  active_conns: number;
  max_conns: number;
  db_size_mb: number;
  table_count: number;
  total_requests: number;
  today_requests: number;
  avg_latency_ms: number;
  user_count: number;
  customer_count: number;
};

export async function getOverview(): Promise<OverviewData> {
  const res = await http.get<unknown, { data: OverviewData }>('/monitor/overview');
  return res.data;
}

export async function getDBStats(): Promise<DBStatsData> {
  const res = await http.get<unknown, { data: DBStatsData }>('/monitor/db-stats');
  return res.data;
}
