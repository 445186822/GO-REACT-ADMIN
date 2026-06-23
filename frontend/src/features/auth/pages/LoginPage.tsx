import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../../../api/auth';
import { useAuthStore } from '../../../store/authStore';
import './LoginPage.css';

type LoginForm = {
  username: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const handleSubmit = async (values: LoginForm) => {
    try {
      const data = await loginApi(values);
      setSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
      });
      navigate('/dashboard');
    } catch {
      message.error('登录失败，请检查用户名、密码或服务状态。');
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <Typography.Title level={3}>Enterprise Demo</Typography.Title>
        <Typography.Text type="secondary">企业级可复制全栈模板</Typography.Text>
        <Form layout="vertical" className="login-form" onFinish={handleSubmit}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
