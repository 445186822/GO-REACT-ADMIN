import {
  ClearOutlined,
  DeleteOutlined,
  HistoryOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Empty, Input, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useAIChat } from '../hooks/useAIChat';

const { Text } = Typography;

export function AIAssistantPage() {
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

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div className="ai-page-container">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="ai-page-sidebar">
          <div className="ai-page-sidebar-header">
            <Space>
              <HistoryOutlined />
              <Text strong>对话历史</Text>
            </Space>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={newConversation}
            >
              新对话
            </Button>
          </div>

          <div className="ai-page-sidebar-list">
            {conversations.length === 0 && (
              <Empty description="暂无对话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`ai-page-conv-item ${conv.id === activeId ? 'ai-page-conv-item-active' : ''}`}
                onClick={() => switchConversation(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') switchConversation(conv.id);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="ai-page-conv-item-title">
                  <RobotOutlined style={{ fontSize: 13, marginRight: 6, opacity: 0.6 }} />
                  <span className="ai-page-conv-item-text">{conv.title}</span>
                </div>
                <div className="ai-page-conv-item-actions">
                  {conversations.length > 1 && (
                    <Popconfirm
                      title="确认删除此对话？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Tooltip title="删除对话">
                        <DeleteOutlined
                          className="ai-page-conv-item-delete"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="ai-page-main">
        {/* Header card */}
        <div className="ai-page-header">
          <Space>
            <Avatar icon={<RobotOutlined />} size={40} style={{ background: '#1677ff' }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>
                AI 智能助手
              </Text>
              <br />
              <Space size={4}>
                <Tag color="blue" style={{ fontSize: 11 }}>
                  <ThunderboltOutlined /> 企业助手
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  对话会保存到当前用户历史
                </Text>
              </Space>
            </div>
          </Space>
          <Space>
            <Button size="small" icon={<ClearOutlined />} onClick={clearMessages}>
              清空对话
            </Button>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? '隐藏历史' : '对话历史'}
            </Button>
          </Space>
        </div>

        {/* Messages area */}
        <div className="ai-page-messages">
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`ai-page-message ai-page-message-${msg.role}`}
            >
              <Avatar
                size={36}
                icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                style={{
                  background: msg.role === 'user' ? '#1890ff' : '#12b76a',
                  flexShrink: 0,
                }}
              />
              <div className="ai-page-bubble">
                {msg.content || (loading && index === messages.length - 1) ? (
                  msg.content
                ) : null}
                {!msg.content && loading && index === messages.length - 1 && (
                  <span className="ai-page-cursor" />
                )}
                {msg.content && loading && index === messages.length - 1 && (
                  <span className="ai-page-cursor" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="ai-page-input-area">
          <Input.TextArea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <div className="ai-page-input-footer">
            <Text type="secondary" style={{ fontSize: 11 }}>
              Enter 发送 · Shift+Enter 换行
            </Text>
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
      </div>
    </div>
  );
}
