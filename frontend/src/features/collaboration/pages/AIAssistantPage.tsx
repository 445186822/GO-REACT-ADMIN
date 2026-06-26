import { ClearOutlined, RobotOutlined, SendOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Input, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { sendAssistantMessage } from '../../../api/assistant';

const { Text } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const welcomeMessage: Message = {
  role: 'assistant',
  content: '你好，我是企业平台的 AI 智能助手。\n\n我可以帮助你解答系统使用问题、提供数据分析建议、协助文档编写，并给出工作流和审批配置建议。',
};

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    const assistantIdx = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
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
    setMessages([{ role: 'assistant', content: '对话已清空。有什么可以帮助你的？' }]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', maxWidth: 820, margin: '0 auto' }}>
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Space>
          <Avatar icon={<RobotOutlined />} size={40} style={{ background: '#1677ff' }} />
          <div>
            <Text strong style={{ fontSize: 16 }}>AI 智能助手</Text>
            <br />
            <Space size={4}>
              <Tag color="blue" style={{ fontSize: 11 }}><ThunderboltOutlined /> 企业助手</Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>对话会保存到当前用户历史</Text>
            </Space>
          </div>
        </Space>
        <Button size="small" icon={<ClearOutlined />} onClick={clear} style={{ float: 'right', marginTop: 8 }}>清空对话</Button>
      </Card>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
        {messages.map((msg, index) => (
          <div key={`${msg.role}-${index}`} style={{ display: 'flex', gap: 12, marginBottom: 20, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <Avatar
              size={36}
              icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{ background: msg.role === 'user' ? '#1890ff' : '#12b76a', flexShrink: 0 }}
            />
            <div style={{
              maxWidth: '75%',
              padding: '10px 16px',
              borderRadius: 8,
              lineHeight: 1.7,
              background: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
              color: msg.role === 'user' ? '#fff' : '#333',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content || (loading && index === messages.length - 1 ? <Spin size="small" /> : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ marginTop: 16 }}>
        <Input.TextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loading}
          style={{ borderRadius: 8 }}
        />
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11, marginRight: 8 }}>Enter 发送 · Shift+Enter 换行</Text>
          <Button type="primary" icon={<SendOutlined />} onClick={() => void send()} loading={loading} disabled={!input.trim()}>发送</Button>
        </div>
      </div>
    </div>
  );
}
