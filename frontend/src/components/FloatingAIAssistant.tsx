import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Input, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useAIChat } from '../features/collaboration/hooks/useAIChat';

const { Text } = Typography;

export function FloatingAIAssistant() {
  const {
    messages,
    loading,
    conversations,
    activeId,
    sendMessage,
    newConversation,
    switchConversation,
    deleteConversation,
    clearMessages,
  } = useAIChat();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function handleSend() {
    const text = input;
    setInput('');
    await sendMessage(text);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      void handleSend();
    }
  }

  const activeConv = conversations.find((c) => c.id === activeId);

  const historyItems: MenuProps['items'] = conversations.map((conv) => ({
    key: conv.id,
    label: (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          maxWidth: 250,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            fontWeight: conv.id === activeId ? 600 : 400,
          }}
        >
          {conv.title}
        </span>
        {conversations.length > 1 && (
          <DeleteOutlined
            style={{ color: '#ff4d4f', fontSize: 12, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              deleteConversation(conv.id);
            }}
          />
        )}
      </div>
    ),
    onClick: () => switchConversation(conv.id),
  }));

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
      {/* Header */}
      <div className="ai-float-header">
        <Space>
          <Avatar icon={<RobotOutlined />} style={{ background: '#1677ff' }} />
          <div>
            <Text strong>AI 智能助手</Text>
            <br />
            <Text type="secondary" className="ai-float-subtitle">
              右下角浮窗
            </Text>
          </div>
        </Space>
        <Space size={4}>
          <Dropdown menu={{ items: historyItems }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<SwapOutlined />}
              aria-label="切换对话"
              title="切换对话"
            />
          </Dropdown>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={newConversation}
            aria-label="新对话"
            title="新对话"
          />
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={clearMessages}
            aria-label="清空对话"
            title="清空对话"
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setOpen(false)}
            aria-label="关闭 AI 助手"
            title="关闭"
          />
        </Space>
      </div>

      {/* Messages */}
      <div className="ai-float-messages">
        {messages.map((item, index) => (
          <div
            key={`${item.role}-${index}`}
            className={`ai-float-message ai-float-message-${item.role}`}
          >
            <Avatar
              size={28}
              icon={item.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{ background: item.role === 'user' ? '#1677ff' : '#12b76a' }}
            />
            <div className="ai-float-bubble">
              {item.content}
              {loading && index === messages.length - 1 && (
                <span className="ai-float-cursor" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="ai-float-input">
        <Input.TextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送"
          autoSize={{ minRows: 1, maxRows: 3 }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => void handleSend()}
          loading={loading}
          disabled={!input.trim()}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
