import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  FolderOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tree,
  Typography,
  type TreeDataNode,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  createArticle,
  createCategory,
  createFAQ,
  deleteArticle,
  deleteCategory,
  deleteFAQ,
  getArticle,
  listArticles,
  listFAQs,
  treeCategories,
  updateArticle,
  updateCategory,
  updateFAQ,
  type ArticleForm,
  type ArticleRow,
  type CategoryForm,
  type CategoryRow,
  type FAQForm,
  type FAQRow,
} from '../../../api/knowledgeBase';
import { Permission } from '../../../components/Permission';
import { operationColumnProps } from '../../../utils/tableColumns';

const { Text } = Typography;

export function KnowledgeBasePage() {
  return <KnowledgeHome />;
}

export function KnowledgeArticlesPage() {
  return <KnowledgeHome />;
}

export function KnowledgeFAQPage() {
  return <KnowledgeHome />;
}

export function KnowledgeCategoriesPage() {
  return <KnowledgeHome />;
}

function KnowledgeHome() {
  const [view, setView] = useState<'articles' | 'faqs' | 'categories'>('articles');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [articleCount, setArticleCount] = useState(0);
  const [faqCount, setFaqCount] = useState(0);
  const articleRef = useRef<ActionType>(null);
  const faqRef = useRef<ActionType>(null);
  const [categoryReload, setCategoryReload] = useState(0);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const catOptions = useMemo(
    () => [{ label: '全部分类', value: undefined }, ...flatCategories.map((c) => ({ label: c.name, value: c.id }))],
    [flatCategories],
  );

  async function loadCategories() {
    try {
      setCategories(await treeCategories());
    } catch {
      // silent - categories will show as empty
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [categoryReload]);

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Row align="middle" justify="end" style={{ marginBottom: 14 }}>
        <Col>
          <Space>
            <Select
              allowClear
              placeholder="按分类筛选"
              style={{ width: 180 }}
              options={catOptions}
              value={categoryFilter}
              onChange={(val) => {
                setCategoryFilter(val);
                setTimeout(() => {
                  articleRef.current?.reload();
                  faqRef.current?.reload();
                }, 0);
              }}
            />
            <Button onClick={() => { setCategoryReload((n) => n + 1); }} icon={<ReloadOutlined />}>
              刷新分类
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Tab Cards - replacing Ant Tabs with visual cards for clarity */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { key: 'articles' as const, icon: <BookOutlined />, label: '文章管理', desc: '撰写、编辑和发布知识文章' },
          { key: 'faqs' as const, icon: <QuestionCircleOutlined />, label: 'FAQ 管理', desc: '维护常见问题与解答' },
          { key: 'categories' as const, icon: <FolderOutlined />, label: '分类管理', desc: '管理知识库的目录结构' },
        ].map((item) => (
          <Col xs={24} md={8} key={item.key}>
            <Card
              hoverable
              size="small"
              style={{
                border: view === item.key ? '2px solid #1677ff' : undefined,
                background: view === item.key ? '#f0f5ff' : undefined,
                cursor: 'pointer',
              }}
              onClick={() => setView(item.key)}
            >
              <Space>
                <span style={{ fontSize: 24, color: view === item.key ? '#1677ff' : '#666' }}>{item.icon}</span>
                <div>
                  <Text strong style={{ color: view === item.key ? '#1677ff' : undefined }}>{item.label}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Content Area */}
      {view === 'articles' && (
        <ArticlePanel actionRef={articleRef} categoryID={categoryFilter} categories={flatCategories} onCountChange={setArticleCount} />
      )}
      {view === 'faqs' && (
        <FAQPanel actionRef={faqRef} categoryID={categoryFilter} categories={flatCategories} onCountChange={setFaqCount} />
      )}
      {view === 'categories' && (
        <CategoryPanel
          categories={categories}
          flatCategories={flatCategories}
          reload={async () => { setCategoryReload((n) => n + 1); }}
        />
      )}
    </div>
  );
}

// ── Article Panel ──────────────────────────────────────────────

function ArticlePanel({ actionRef, categoryID, categories, onCountChange }: { actionRef: React.RefObject<ActionType | null>; categoryID?: number; categories: CategoryRow[]; onCountChange?: (count: number) => void }) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ArticleRow | null>(null);
  const [viewing, setViewing] = useState<ArticleRow | null>(null);

  const columns: ProColumns<ArticleRow>[] = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_, row) => (
        <Space>
          {row.is_pinned && <PushpinOutlined style={{ color: '#faad14' }} />}
          <a onClick={() => void openView(row.id)}>{row.title}</a>
        </Space>
      ),
    },
    {
      title: '分类', dataIndex: 'category_id', width: 120,
      render: (_, row) => {
        const cat = categories.find((c) => c.id === row.category_id);
        return cat ? <Tag>{cat.name}</Tag> : <Text type="secondary">-</Text>;
      },
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      valueType: 'select',
      valueEnum: { PUBLISHED: { text: '已发布' }, DRAFT: { text: '草稿' }, ARCHIVED: { text: '归档' } },
      render: (_, row) => (
        <Tag color={row.status === 'PUBLISHED' ? 'green' : row.status === 'DRAFT' ? 'gold' : 'default'}>
          {{ PUBLISHED: '已发布', DRAFT: '草稿', ARCHIVED: '归档' }[row.status] || row.status}
        </Tag>
      ),
    },
    { title: '浏览', dataIndex: 'view_count', width: 80, search: false, align: 'right' },
    { title: '作者', dataIndex: 'author_name', width: 100, search: false },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160, search: false },
    {
      title: '操作', ...operationColumnProps<ArticleRow>(220),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openView(row.id)}>查看</Button>
          <Permission code="kb:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); setOpen(true); }}>编辑</Button>
          </Permission>
          <Permission code="kb:update">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>删除</Button>
          </Permission>
        </Space>
      ),
    },
  ];

  async function openView(id: number) {
    try { setViewing(await getArticle(id)); } catch { message.error('加载文章失败'); }
  }

  function confirmDelete(row: ArticleRow) {
    modal.confirm({
      title: `删除文章「${row.title}」？`,
      okText: '删除', okButtonProps: { danger: true },
      onOk: async () => {
        try { await deleteArticle(row.id); message.success('已删除'); actionRef.current?.reload(); }
        catch { message.error('删除文章失败，请稍后重试'); }
      },
    });
  }

  async function submit(values: ArticleForm) {
    try {
      const payload = { ...values, category_id: values.category_id ?? categoryID };
      if (editing) { await updateArticle(editing.id, payload); } else { await createArticle(payload); }
      message.success(editing ? '更新成功' : '创建成功');
      setOpen(false); setEditing(null); actionRef.current?.reload();
      return true;
    } catch {
      message.error('保存文章失败，请稍后重试');
      return false;
    }
  }

  return (
    <>
      <ProTable<ArticleRow>
        actionRef={actionRef} rowKey="id" columns={columns}
        scroll={{ x: 'max-content' }}
        request={async (params) => {
          try {
            const page = await listArticles({
              keyword: typeof params.title === 'string' ? params.title : undefined,
              status: typeof params.status === 'string' ? params.status : undefined,
              category_id: categoryID ? String(categoryID) : undefined,
              page: params.current, page_size: params.pageSize,
            });
            onCountChange?.(page.total ?? 0);
            return { data: page.items, total: page.total, success: true };
          } catch {
            message.error('加载文章列表失败');
            return { data: [], total: 0, success: false };
          }
        }}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        pagination={{ defaultPageSize: 10 }}
        toolBarRender={() => [
          <Permission code="kb:update" key="add">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增文章</Button>
          </Permission>,
        ]}
      />
      <ModalForm<ArticleForm>
        key={editing?.id ?? 'new'} title={editing ? '编辑文章' : '新增文章'}
        open={open} width={720}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={editing ?? { status: 'PUBLISHED', is_pinned: false, category_id: categoryID }}
        onFinish={submit}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <Row gutter={16}>
          <Col span={12}><ProFormSelect name="category_id" label="分类" options={categories.map((c) => ({ label: c.name, value: c.id }))} /></Col>
          <Col span={12}><ProFormSelect name="status" label="状态" options={[{ label: '已发布', value: 'PUBLISHED' }, { label: '草稿', value: 'DRAFT' }, { label: '归档', value: 'ARCHIVED' }]} /></Col>
        </Row>
        <ProFormText name="tags" label="标签" placeholder="多个标签用逗号分隔" />
        <ProFormSwitch name="is_pinned" label="置顶" />
        <ProFormTextArea name="content" label="内容" fieldProps={{ rows: 10 }} rules={[{ required: true }]} />
      </ModalForm>
      <Drawer title={viewing?.title} open={Boolean(viewing)} width={680} onClose={() => setViewing(null)}>
        <div className="markdown-content">
          <ReactMarkdown>{viewing?.content || ''}</ReactMarkdown>
        </div>
      </Drawer>
    </>
  );
}

// ── FAQ Panel ───────────────────────────────────────────────────

function FAQPanel({ actionRef, categoryID, categories, onCountChange }: { actionRef: React.RefObject<ActionType | null>; categoryID?: number; categories: CategoryRow[]; onCountChange?: (count: number) => void }) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FAQRow | null>(null);

  const columns: ProColumns<FAQRow>[] = [
    { title: '问题', dataIndex: 'question', ellipsis: true, width: 150 },
    { title: '答案', dataIndex: 'answer', ellipsis: true, width: 300, search: false },
    {
      title: '分类', dataIndex: 'category_id', width: 110,
      render: (_, row) => {
        const cat = categories.find((c) => c.id === row.category_id);
        return cat ? <Tag>{cat.name}</Tag> : <Text type="secondary">-</Text>;
      },
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      valueType: 'select',
      valueEnum: { ENABLED: { text: '启用' }, DISABLED: { text: '停用' } },
      render: (_, row) => <Tag color={row.status === 'ENABLED' ? 'green' : 'default'}>{row.status === 'ENABLED' ? '启用' : '停用'}</Tag>,
    },
    { title: '排序', dataIndex: 'sort_order', width: 70, search: false },
    {
      title: '操作', ...operationColumnProps<FAQRow>(180),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="kb:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); setOpen(true); }}>编辑</Button>
          </Permission>
          <Permission code="kb:update">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>删除</Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function confirmDelete(row: FAQRow) {
    modal.confirm({
      title: `删除 FAQ「${row.question}」？`, okText: '删除', okButtonProps: { danger: true },
      onOk: async () => {
        try { await deleteFAQ(row.id); message.success('已删除'); actionRef.current?.reload(); }
        catch { message.error('删除 FAQ 失败，请稍后重试'); }
      },
    });
  }

  async function submit(values: FAQForm) {
    try {
      const payload = { ...values, category_id: values.category_id ?? categoryID };
      if (editing) { await updateFAQ(editing.id, payload); } else { await createFAQ(payload); }
      message.success(editing ? '更新成功' : '创建成功');
      setOpen(false); setEditing(null); actionRef.current?.reload();
      return true;
    } catch {
      message.error('保存 FAQ 失败，请稍后重试');
      return false;
    }
  }

  return (
    <>
      <ProTable<FAQRow>
        actionRef={actionRef} rowKey="id" columns={columns}
        request={async (params) => {
          try {
            const page = await listFAQs({
              keyword: typeof params.question === 'string' ? params.question : undefined,
              status: typeof params.status === 'string' ? params.status : undefined,
              category_id: categoryID ? String(categoryID) : undefined,
              page: params.current, page_size: params.pageSize,
            });
            onCountChange?.(page.total ?? 0);
            return { data: page.items, total: page.total, success: true };
          } catch {
            message.error('加载 FAQ 列表失败');
            return { data: [], total: 0, success: false };
          }
        }}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        pagination={{ defaultPageSize: 10 }}
        toolBarRender={() => [
          <Permission code="kb:update" key="add">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增 FAQ</Button>
          </Permission>,
        ]}
      />
      <ModalForm<FAQForm>
        key={editing?.id ?? 'new'} title={editing ? '编辑 FAQ' : '新增 FAQ'}
        open={open} width={600}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={editing ?? { status: 'ENABLED', sort_order: 0, category_id: categoryID }}
        onFinish={submit}
      >
        <ProFormText name="question" label="问题" rules={[{ required: true }]} />
        <ProFormTextArea name="answer" label="答案" fieldProps={{ rows: 6 }} rules={[{ required: true }]} />
        <Row gutter={16}>
          <Col span={12}><ProFormSelect name="category_id" label="分类" options={categories.map((c) => ({ label: c.name, value: c.id }))} /></Col>
          <Col span={12}><ProFormSelect name="status" label="状态" options={[{ label: '启用', value: 'ENABLED' }, { label: '停用', value: 'DISABLED' }]} /></Col>
        </Row>
        <ProFormDigit name="sort_order" label="排序" min={0} />
      </ModalForm>
    </>
  );
}

// ── Category Panel ──────────────────────────────────────────────

function CategoryPanel({ categories, flatCategories, reload }: { categories: CategoryRow[]; flatCategories: CategoryRow[]; reload: () => Promise<void> }) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const treeData = useMemo(() => toTreeData(categories), [categories]);

  function confirmDelete(row: CategoryRow) {
    modal.confirm({
      title: `删除分类「${row.name}」？`,
      content: '如有关联文章或子分类，系统将阻止删除。',
      okText: '删除', okButtonProps: { danger: true },
      onOk: async () => {
        try { await deleteCategory(row.id); message.success('已删除'); await reload(); }
        catch { message.error('分类仍有关联内容，无法删除'); }
      },
    });
  }

  async function submit(values: CategoryForm) {
    try {
      if (editing) { await updateCategory(editing.id, values); } else { await createCategory(values); }
      message.success(editing ? '更新成功' : '创建成功');
      setOpen(false); setEditing(null); await reload();
      return true;
    } catch {
      message.error('保存分类失败，请稍后重试');
      return false;
    }
  }

  return (
    <>
      <Row gutter={24}>
        <Col xs={24} md={10}>
          <Card
            title={<Space><FolderOutlined />分类结构</Space>}
            extra={
              <Permission code="kb:update">
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增分类</Button>
              </Permission>
            }
          >
            {treeData.length ? (
              <Tree
                blockNode
                defaultExpandAll
                treeData={treeData}
                titleRender={(node) => {
                  const row = flatCategories.find((item) => item.id === Number(node.key));
                  return (
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <span>{node.title as string}</span>
                      {row ? (
                        <Permission code="kb:update">
                          <Space size={4}>
                            <Button size="small" type="link" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setEditing(row); setOpen(true); }} />
                            <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); confirmDelete(row); }} />
                          </Space>
                        </Permission>
                      ) : null}
                    </Space>
                  );
                }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类，点击上方按钮创建" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card title="说明">
            <Typography.Paragraph>
              <Text strong>分类</Text> 用于组织知识库中的文章和 FAQ。支持多级分类（父分类 → 子分类）。
            </Typography.Paragraph>
            <ul>
              <li>创建文章或 FAQ 时，可选择关联到一个分类</li>
              <li>分类不影响权限，仅用于内容组织和筛选</li>
              <li>删除分类前请确保没有关联的文章或 FAQ</li>
            </ul>
            <Statistic title="分类总数" value={flatCategories.length} />
          </Card>
        </Col>
      </Row>

      <ModalForm<CategoryForm>
        key={editing?.id ?? 'new'} title={editing ? '编辑分类' : '新增分类'}
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={editing ?? { status: 'ENABLED', sort_order: 0 }}
        onFinish={submit}
      >
        <ProFormText name="name" label="分类名称" rules={[{ required: true }]} />
        <ProFormSelect
          name="parent_id" label="上级分类" allowClear
          options={flatCategories.filter((c) => c.id !== editing?.id).map((c) => ({ label: c.name, value: c.id }))}
        />
        <Row gutter={16}>
          <Col span={12}><ProFormDigit name="sort_order" label="排序" min={0} /></Col>
          <Col span={12}>
            <ProFormSelect name="status" label="状态"
              options={[{ label: '启用', value: 'ENABLED' }, { label: '停用', value: 'DISABLED' }]}
            />
          </Col>
        </Row>
      </ModalForm>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function toTreeData(categories: CategoryRow[]): TreeDataNode[] {
  return categories.map((item) => ({
    title: item.name,
    key: String(item.id),
    children: item.children ? toTreeData(item.children) : undefined,
  }));
}

function flattenCategories(categories: CategoryRow[], depth = 0): CategoryRow[] {
  return categories.flatMap((item) => [
    { ...item, name: `${'  '.repeat(depth)}${item.name}` },
    ...flattenCategories(item.children ?? [], depth + 1),
  ]);
}
