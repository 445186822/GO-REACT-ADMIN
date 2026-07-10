import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import {
  CheckSquareOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { DashboardStats, getDashboardStats } from '../../../api/dashboard';

/** Chart colour palette */
const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

/** Hardcoded module overview data (no backend endpoint yet) */
const MODULE_OVERVIEW = [
  { name: '用户管理', features: 6 },
  { name: '客户管理', features: 8 },
  { name: '权限模型', features: 5 },
  { name: '实时能力', features: 4 },
  { name: 'AI 流式输出', features: 3 },
];

/** Stat card descriptors */
const STAT_CARDS = [
  { title: '用户数', icon: <UserOutlined />, field: 'user_count' as const, path: '/system/users' },
  { title: '客户数', icon: <TeamOutlined />, field: 'customer_count' as const, path: '/business/customers' },
  { title: '今日请求', icon: <RocketOutlined />, field: 'today_requests' as const, path: '/system/monitor' },
  { title: '待审批', icon: <ClockCircleOutlined />, field: 'pending_approvals' as const, path: '/collaboration/approvals' },
  { title: '运行任务', icon: <PlayCircleOutlined />, field: 'running_tasks' as const, path: '/system/scheduler' },
  { title: '待办事项', icon: <CheckSquareOutlined />, field: 'pending_todos' as const, path: '/collaboration/todos' },
];

/** Map backend status code to Chinese label */
const APPROVAL_LABEL: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      setError('获取工作台数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  return { stats, loading, error, retry: fetch };
}

export function DashboardPage() {
  const { stats, loading, error, retry } = useDashboardStats();
  const navigate = useNavigate();

  /* ---- ECharts options ---- */

  const lineOption = stats && {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 20, right: 20, bottom: 30, left: 55 },
    xAxis: {
      type: 'category' as const,
      data: stats.request_trend.map((i) => i.date.slice(5)),
      axisLabel: { color: '#8c8c8c' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#8c8c8c' },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series: [
      {
        type: 'line' as const,
        data: stats.request_trend.map((i) => i.count),
        smooth: true,
        lineStyle: { color: COLORS[0], width: 3 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(22,119,255,0.25)' },
              { offset: 1, color: 'rgba(22,119,255,0.02)' },
            ],
          },
        },
        itemStyle: { color: COLORS[0] },
      },
    ],
  };

  const pieOption = stats && {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie' as const,
        data: stats.customer_level_dist.map((d, i) => ({
          name: d.level,
          value: d.count,
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
        roseType: 'radius' as const,
        radius: ['30%', '65%'],
        label: { color: '#595959' },
        labelLine: { lineStyle: { color: '#d9d9d9' } },
      },
    ],
  };

  const approvalBarOption = stats && {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 20, right: 20, bottom: 30, left: 55 },
    xAxis: {
      type: 'category' as const,
      data: stats.approval_status_dist.map(
        (d) => APPROVAL_LABEL[d.status] ?? d.status,
      ),
      axisLabel: { color: '#8c8c8c' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#8c8c8c' },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series: [
      {
        type: 'bar' as const,
        data: stats.approval_status_dist.map((d, i) => ({
          value: d.count,
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
        barWidth: '40%',
      },
    ],
  };

  const moduleBarOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 20, right: 20, bottom: 30, left: 55 },
    xAxis: {
      type: 'category' as const,
      data: MODULE_OVERVIEW.map((m) => m.name),
      axisLabel: { color: '#8c8c8c' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#8c8c8c' },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series: [
      {
        type: 'bar' as const,
        data: MODULE_OVERVIEW.map((m, i) => ({
          value: m.features,
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
        barWidth: '40%',
      },
    ],
  };

  /* ---- Render helpers ---- */

  const renderChartCard = (
    title: string,
    option: Record<string, unknown> | null,
  ) => (
    <Card title={title} styles={{ body: { padding: 0 } }}>
      {loading ? (
        <Skeleton active style={{ margin: 24 }} />
      ) : (
        <ReactECharts option={option!} style={{ height: 300 }} />
      )}
    </Card>
  );

  /* ---- Main render ---- */

  if (error) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Typography.Text type="danger" style={{ fontSize: 16 }}>
            {error}
          </Typography.Text>
          <br />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={retry}
            style={{ marginTop: 16 }}
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* ---- Stat cards ---- */}
      <Row gutter={[16, 16]}>
        {STAT_CARDS.map((card) => (
          <Col xs={24} sm={12} lg={8} key={card.field}>
            <Card
              hoverable
              onClick={() => navigate(card.path)}
              styles={{ body: { minHeight: 92 } }}
            >
              {loading ? (
                <Skeleton active paragraph={false} />
              ) : (
                <Statistic
                  title={card.title}
                  value={stats![card.field]}
                  prefix={card.icon}
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* ---- Charts row 1 ---- */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          {renderChartCard('近7天请求趋势', lineOption)}
        </Col>
        <Col xs={24} lg={12}>
          {renderChartCard('客户级别分布', pieOption)}
        </Col>
      </Row>

      {/* ---- Charts row 2 ---- */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          {renderChartCard('审批状态统计', approvalBarOption)}
        </Col>
        <Col xs={24} lg={12}>
          {renderChartCard('模块功能概览', moduleBarOption)}
        </Col>
      </Row>
    </div>
  );
}
