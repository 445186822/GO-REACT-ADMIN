import { http } from '../request/http';

export interface RequestTrendItem {
  date: string;
  count: number;
}

export interface CustomerLevelDist {
  level: string;
  count: number;
}

export interface ApprovalStatusDist {
  status: string;
  count: number;
}

export interface DashboardStats {
  user_count: number;
  customer_count: number;
  today_requests: number;
  pending_approvals: number;
  running_tasks: number;
  request_trend: RequestTrendItem[];
  customer_level_dist: CustomerLevelDist[];
  approval_status_dist: ApprovalStatusDist[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await http.get<unknown, { data: DashboardStats }>('/dashboard/stats');
  return res.data;
}
