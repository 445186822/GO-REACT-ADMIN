import { ClearOutlined, CloseOutlined, RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Input, Space, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { sendAssistantMessage } from '../api/assistant';

const { Text } = Typography;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const welcomeMessage: ChatMessage = {
  role: 'assistant',
  content: '你好，我是 AI 智能助手。可以帮助你解答系统使用、数据分析、文档和工作流相关问题。',
};

export function FloatingAIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    const assistantIdx = nextMessages.length;
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendAssistantMessage(text);
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = { role: 'assistant', content: reply };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = {
          role: 'assistant',
          content: 'AI 服务暂时不可用，请检查后端服务和 AI 配置后再试。',
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setMessages([welcomeMessage]);
  }

  if (!open) {
    return (
      <Button
        type="primary"
        shape="circle"
        size="large"
        className="ai-float-trigger"
        icon={<RobotOutlined />}
        onClick={() => setOpen(true)}
        aria-label="打开 AI 助手"
      />
    );
  }

  return (
    <div className="ai-float-panel">
      <div className="ai-float-header">
        <Space>
          <Avatar icon={<RobotOutlined />} style={{ background: '#1677ff' }} />
          <div>
            <Text strong>AI 智能助手</Text>
            <br />
            <Text type="secondary" className="ai-float-subtitle">右下角浮窗</Text>
          </div>
        </Space>
        <Space size={4}>
          <Button type="text" size="small" icon={<ClearOutlined />} onClick={clear} aria-label="清空对话" />
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setOpen(false)} aria-label="关闭 AI 助手" />
        </Space>
      </div>

      <div className="ai-float-messages">
        {messages.map((item, index) => (
          <div key={`${item.role}-${index}`} className={`ai-float-message ai-float-message-${item.role}`}>
            <Avatar
              size={28}
              icon={item.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{ background: item.role === 'user' ? '#1677ff' : '#12b76a' }}
            />
            <div className="ai-float-bubble">
              {item.content || (loading && index === messages.length - 1 ? <Spin size="small" /> : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="ai-float-input">
        <Input.TextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="输入消息，Enter 发送"
          autoSize={{ minRows: 1, maxRows: 3 }}
          disabled={loading}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={() => void send()} loading={loading} disabled={!input.trim()}>
          发送
        </Button>
      </div>
    </div>
  );
}
