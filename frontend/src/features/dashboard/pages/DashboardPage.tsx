import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd';

const rows = [
  { key: 'user', module: '用户管理', capability: '真实 CRUD、按钮权限、软删除', status: '已实现' },
  { key: 'customer', module: '客户管理', capability: '业务 CRUD、数据权限、负责人/部门过滤', status: '已实现' },
  { key: 'rbac', module: '权限模型', capability: '动态菜单、角色、按钮权限、数据范围', status: '已实现' },
  { key: 'realtime', module: '实时能力', capability: 'WebSocket 收发、服务端推送', status: '已实现' },
  { key: 'sse', module: 'AI 流式输出', capability: 'SSE 分段响应、前端流式渲染', status: '已实现' },
];

export function DashboardPage() {
  return (
    <div>
      <Typography.Title level={3}>工作台</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="用户数" value={3} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="客户数" value={4} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="权限点" value={20} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="菜单项" value={26} />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 16 }}>
        <Table
          rowKey="key"
          pagination={false}
          dataSource={rows}
          columns={[
            { title: '模块', dataIndex: 'module', width: 160 },
            { title: '能力点', dataIndex: 'capability' },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (value) => <Tag color="green">{value}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
