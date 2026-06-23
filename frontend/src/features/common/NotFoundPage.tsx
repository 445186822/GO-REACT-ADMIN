import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

const TITLE = '\u9875\u9762\u4e0d\u5b58\u5728';
const SUB_TITLE = '\u5f53\u524d\u83dc\u5355\u5bf9\u5e94\u7684\u524d\u7aef\u9875\u9762\u5c1a\u672a\u914d\u7f6e\uff0c\u8bf7\u5237\u65b0\u767b\u5f55\u6001\u6216\u68c0\u67e5\u83dc\u5355\u8def\u7531\u3002';
const BACK_LABEL = '\u8fd4\u56de\u5de5\u4f5c\u53f0';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title={TITLE}
      subTitle={SUB_TITLE}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          {BACK_LABEL}
        </Button>
      }
    />
  );
}
