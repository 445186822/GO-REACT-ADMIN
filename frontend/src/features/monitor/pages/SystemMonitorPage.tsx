import {
  CloudServerOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Card, Col, Progress, Row, Segmented, Skeleton, Statistic, Tag, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDBStats, getOverview, type DBStatsData, type OverviewData } from '../../../api/monitor';

const { Text } = Typography;

type RefreshInterval = 10 | 30 | 60 | 0;

const INTERVAL_OPTIONS: { label: string; value: RefreshInterval }[] = [
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '手动', value: 0 },
];

export function SystemMonitorPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [dbStats, setDBStats] = useState<DBStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ov, db] = await Promise.all([getOverview(), getDBStats()]);
      setOverview(ov);
      setDBStats(db);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (refreshInterval > 0) {
      timerRef.current = setInterval(() => {
        fetchData();
      }, refreshInterval * 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [refreshInterval, fetchData]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 14 }}>
        <Segmented
          options={INTERVAL_OPTIONS}
          value={refreshInterval}
          onChange={(val) => setRefreshInterval(val as RefreshInterval)}
        />
      </div>

      {/* System Overview */}
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic title="Go 版本" value={overview?.go_version} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="CPU 核心" value={overview?.num_cpu} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="协程数" value={overview?.num_goroutine} prefix={<ApiOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行时间" value={overview?.uptime_str} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Memory */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="内存使用">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="已分配" value={overview?.mem_alloc_mb} suffix="MB" />
              </Col>
              <Col span={12}>
                <Statistic title="系统占用" value={overview?.mem_total_mb} suffix="MB" />
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={overview ? Math.round((overview.mem_alloc_mb / Math.max(overview.mem_total_mb, 1)) * 100) : 0}
                status="active"
                format={(p) => `使用率 ${p}%`}
              />
            </div>
          </Card>
        </Col>

        {/* DB Stats */}
        <Col span={12}>
          <Card title={<span><DatabaseOutlined /> 数据库</span>}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="数据库大小" value={dbStats?.db_size_mb} suffix="MB" />
              </Col>
              <Col span={8}>
                <Statistic title="数据表" value={dbStats?.table_count} suffix="张" />
              </Col>
              <Col span={8}>
                <Statistic
                  title="连接数"
                  value={dbStats?.active_conns}
                  suffix={dbStats ? `/ ${dbStats.max_conns}` : ''}
                />
              </Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dbStats?.version?.split(',')[0]}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Business Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="用户总数" value={dbStats?.user_count} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="客户总数" value={dbStats?.customer_count} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总请求数" value={dbStats?.total_requests} prefix={<ApiOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均延迟" value={dbStats?.avg_latency_ms} suffix="ms" prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Total Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="请求统计">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="总请求数" value={dbStats?.total_requests} />
              </Col>
              <Col span={12}>
                <Statistic title="今日请求" value={dbStats?.today_requests} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统状态">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Tag color={overview ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>{overview ? '系统运行正常' : '系统状态异常'}</Tag>
              </Col>
              <Col span={12}>
                <Tag color={dbStats ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>{dbStats ? '数据库连接正常' : '数据库连接异常'}</Tag>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
