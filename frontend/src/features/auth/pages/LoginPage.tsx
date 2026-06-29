import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../../../api/auth';
import { useAuthStore } from '../../../store/authStore';
import { SliderCaptcha } from '../SliderCaptcha';
import { shouldEnableSliderCaptcha } from '../loginValidation';
import './LoginPage.css';

type LoginForm = {
  username: string;
  password: string;
};

export function LoginPage() {
  const [form] = Form.useForm<LoginForm>();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const username = Form.useWatch('username', form);
  const password = Form.useWatch('password', form);
  const captchaEnabled = shouldEnableSliderCaptcha(username, password);
  const prevEnabled = useRef(captchaEnabled);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCaptcha = () => {
    setCaptchaToken('');
    setCaptchaVersion((version) => version + 1);
  };

  // Only reset captcha when the enabled state transitions (not on every keystroke)
  // Uses debounce to avoid excessive API calls during fast typing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (captchaEnabled !== prevEnabled.current) {
      prevEnabled.current = captchaEnabled;
      // When transitioning to enabled, debounce to avoid API call mid-typing
      if (captchaEnabled) {
        debounceRef.current = setTimeout(() => {
          resetCaptcha();
        }, 600);
      } else {
        // When transitioning to disabled (clearing fields), reset immediately
        resetCaptcha();
      }
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [captchaEnabled]);

  const handleSubmit = async (values: LoginForm) => {
    if (!captchaToken) {
      message.warning('请先完成滑块验证');
      return;
    }

    setSubmitting(true);
    try {
      const data = await loginApi({ ...values, captcha_token: captchaToken });
      setSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
      });
      navigate('/dashboard');
    } catch {
      form.setFieldValue('password', '');
      resetCaptcha();
      message.error('登录失败，用户名或密码错误');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-intro" aria-label="产品信息">
          <Typography.Title level={1}>Enterprise Demo</Typography.Title>
          <Typography.Paragraph>面向企业后台的权限、流程、知识库与运营管理演示环境。</Typography.Paragraph>
          <div className="login-metrics">
            <span>RBAC 权限</span>
            <span>流程审批</span>
            <span>知识沉淀</span>
          </div>
        </section>

        <Card className="login-card">
          <Typography.Title level={3}>账号登录</Typography.Title>
          <Typography.Text type="secondary">输入账号密码后完成滑块安全验证</Typography.Text>

          <Form
            autoComplete="on"
            className="login-form"
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input autoComplete="username" prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <SliderCaptcha
              key={captchaVersion}
              enabled={captchaEnabled}
              onVerified={setCaptchaToken}
            />

            <Button
              block
              disabled={!captchaToken}
              htmlType="submit"
              loading={submitting}
              type="primary"
            >
              登录
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
