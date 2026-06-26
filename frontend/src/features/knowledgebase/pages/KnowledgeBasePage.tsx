import { DeleteOutlined, EditOutlined, EyeOutlined, FolderOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
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
import { App, Button, Card, Col, Drawer, Empty, Row, Space, Statistic, Tabs, Tag, Tree, Typography, type TreeDataNode } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
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

const { Text, Title } = Typography;

type KnowledgeTab = 'articles' | 'faqs' | 'categories';

type WorkspaceProps = {
  initialTab?: KnowledgeTab;
};

export function KnowledgeBasePage() {
  return <KnowledgeWorkspace initialTab="articles" />;
}

export function KnowledgeArticlesPage() {
  return <KnowledgeWorkspace initialTab="articles" />;
}

export function KnowledgeFAQPage() {
  return <KnowledgeWorkspace initialTab="faqs" />;
}

export function KnowledgeCategoriesPage() {
  return <KnowledgeWorkspace initialTab="categories" />;
}

function KnowledgeWorkspace({ initialTab = 'articles' }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>(initialTab);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selectedCategoryID, setSelectedCategoryID] = useState<number | undefined>();
  const articleRef = useRef<ActionType>(null);
  const faqRef = useRef<ActionType>(null);

  async function loadCategories() {
    setCategories(await treeCategories());
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const treeData = useMemo(() => toTreeData(categories), [categories]);

  function reloadCurrentList() {
    articleRef.current?.reload();
    faqRef.current?.reload();
  }

  return (
    <div className="kb-workspace">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <Card
            title={<Space><FolderOutlined />分类导航</Space>}
            extra={<Button type="text" icon={<ReloadOutlined />} onClick={() => void loadCategories()} />}
          >
            {treeData.length ? (
              <Tree
                blockNode
                treeData={[{ title: '全部知识', key: 'all', children: treeData }]}
                defaultExpandAll
                selectedKeys={[selectedCategoryID ? String(selectedCategoryID) : 'all']}
                onSelect={(keys) => {
                  const key = String(keys[0] ?? 'all');
                  setSelectedCategoryID(key === 'all' ? undefined : Number(key));
                  reloadCurrentList();
                }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类" />
            )}
          </Card>
          <div className="kb-stats">
            <Statistic title="分类" value={flatCategories.length} />
            <Statistic title="当前筛选" value={selectedCategoryID ? flatCategories.find((item) => item.id === selectedCategoryID)?.name ?? '-' : '全部'} />
          </div>
        </Col>

        <Col xs={24} lg={18}>
          <div className="kb-toolbar">
            <div>
              <Title level={3}>知识库工作台</Title>
              <Text type="secondary">统一维护企业文章、FAQ 和分类，避免多个菜单割裂管理。</Text>
            </div>
          </div>

          <Tabs
            className="kb-tabs"
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as KnowledgeTab)}
            items={[
              {
                key: 'articles',
                label: '文章',
                children: <ArticlePanel actionRef={articleRef} categoryID={selectedCategoryID} categories={flatCategories} />,
              },
              {
                key: 'faqs',
                label: 'FAQ',
                children: <FAQPanel actionRef={faqRef} categoryID={selectedCategoryID} categories={flatCategories} />,
              },
              {
                key: 'categories',
                label: '分类维护',
                children: <CategoryPanel categories={categories} flatCategories={flatCategories} reload={loadCategories} />,
              },
            ]}
          />
        </Col>
      </Row>
    </div>
  );
}

function ArticlePanel({ actionRef, categoryID, categories }: { actionRef: React.RefObject<ActionType | null>; categoryID?: number; categories: CategoryRow[] }) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ArticleRow | null>(null);
  const [viewing, setViewing] = useState<ArticleRow | null>(null);

  const columns: ProColumns<ArticleRow>[] = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        PUBLISHED: { text: '已发布' },
        DRAFT: { text: '草稿' },
        ARCHIVED: { text: '归档' },
      },
      render: (_, row) => <Tag color={row.status === 'PUBLISHED' ? 'green' : row.status === 'DRAFT' ? 'gold' : 'default'}>{row.status}</Tag>,
    },
    { title: '作者', dataIndex: 'author_name', width: 120, search: false },
    { title: '浏览', dataIndex: 'view_count', width: 90, search: false },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 170, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 210,
      render: (_, row) => (
        <Space>
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
    setViewing(await getArticle(id));
  }

  function confirmDelete(row: ArticleRow) {
    modal.confirm({
      title: `删除文章「${row.title}」？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteArticle(row.id);
        message.success('文章已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: ArticleForm) {
    const payload = { ...values, category_id: values.category_id ?? categoryID };
    if (editing) {
      await updateArticle(editing.id, payload);
    } else {
      await createArticle(payload);
    }
    message.success(editing ? '文章已更新' : '文章已创建');
    setOpen(false);
    setEditing(null);
    actionRef.current?.reload();
    return true;
  }

  return (
    <>
      <ProTable<ArticleRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const page = await listArticles({
            keyword: typeof params.title === 'string' ? params.title : undefined,
            status: typeof params.status === 'string' ? params.status : undefined,
            category_id: categoryID ? String(categoryID) : undefined,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: page.items, total: page.total, success: true };
        }}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        pagination={{ defaultPageSize: 10 }}
        toolBarRender={() => [
          <Permission code="kb:update" key="add">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增文章</Button>
          </Permission>,
        ]}
      />
      <ArticleFormModal open={open} editing={editing} categories={categories} categoryID={categoryID} onOpenChange={setOpen} onFinish={submit} />
      <Drawer title={viewing?.title} open={Boolean(viewing)} width={680} onClose={() => setViewing(null)}>
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{viewing?.content}</Typography.Paragraph>
      </Drawer>
    </>
  );
}

function FAQPanel({ actionRef, categoryID, categories }: { actionRef: React.RefObject<ActionType | null>; categoryID?: number; categories: CategoryRow[] }) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FAQRow | null>(null);

  const columns: ProColumns<FAQRow>[] = [
    { title: '问题', dataIndex: 'question', ellipsis: true },
    { title: '答案', dataIndex: 'answer', ellipsis: true, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        ENABLED: { text: '启用' },
        DISABLED: { text: '停用' },
      },
      render: (_, row) => <Tag color={row.status === 'ENABLED' ? 'green' : 'default'}>{row.status}</Tag>,
    },
    { title: '排序', dataIndex: 'sort_order', width: 90, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, row) => (
        <Space>
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
      title: `删除 FAQ「${row.question}」？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteFAQ(row.id);
        message.success('FAQ 已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: FAQForm) {
    const payload = { ...values, category_id: values.category_id ?? categoryID };
    if (editing) {
      await updateFAQ(editing.id, payload);
    } else {
      await createFAQ(payload);
    }
    message.success(editing ? 'FAQ 已更新' : 'FAQ 已创建');
    setOpen(false);
    setEditing(null);
    actionRef.current?.reload();
    return true;
  }

  return (
    <>
      <ProTable<FAQRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const page = await listFAQs({
            keyword: typeof params.question === 'string' ? params.question : undefined,
            status: typeof params.status === 'string' ? params.status : undefined,
            category_id: categoryID ? String(categoryID) : undefined,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: page.items, total: page.total, success: true };
        }}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        pagination={{ defaultPageSize: 10 }}
        toolBarRender={() => [
          <Permission code="kb:update" key="add">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增 FAQ</Button>
          </Permission>,
        ]}
      />
      <FAQFormModal open={open} editing={editing} categories={categories} categoryID={categoryID} onOpenChange={setOpen} onFinish={submit} />
    </>
  );
}

function CategoryPanel({ categories, flatCategories, reload }: { categories: CategoryRow[]; flatCategories: CategoryRow[]; reload: () => Promise<void> }) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const treeData = useMemo(() => toTreeData(categories), [categories]);

  function confirmDelete(row: CategoryRow) {
    modal.confirm({
      title: `删除分类「${row.name}」？`,
      content: '有关联文章、FAQ 或子分类时，系统会阻止删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCategory(row.id);
          message.success('分类已删除');
          await reload();
        } catch {
          message.error('分类仍有关联内容，不能删除');
        }
      },
    });
  }

  async function submit(values: CategoryForm) {
    if (editing) {
      await updateCategory(editing.id, values);
    } else {
      await createCategory(values);
    }
    message.success(editing ? '分类已更新' : '分类已创建');
    setOpen(false);
    setEditing(null);
    await reload();
    return true;
  }

  return (
    <>
      <Card
        title="分类维护"
        extra={
          <Permission code="kb:update">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增分类</Button>
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
                        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => { setEditing(row); setOpen(true); }}>编辑</Button>
                        <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>删除</Button>
                      </Space>
                    </Permission>
                  ) : null}
                </Space>
              );
            }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类" />
        )}
      </Card>
      <CategoryFormModal open={open} editing={editing} categories={flatCategories} onOpenChange={setOpen} onFinish={submit} />
    </>
  );
}

function ArticleFormModal(props: {
  open: boolean;
  editing: ArticleRow | null;
  categories: CategoryRow[];
  categoryID?: number;
  onOpenChange: (open: boolean) => void;
  onFinish: (values: ArticleForm) => Promise<boolean>;
}) {
  return (
    <ModalForm<ArticleForm>
      key={props.editing?.id ?? 'new'}
      title={props.editing ? '编辑文章' : '新增文章'}
      open={props.open}
      width={720}
      modalProps={{ destroyOnHidden: true, onCancel: () => props.onOpenChange(false) }}
      initialValues={props.editing ?? { status: 'PUBLISHED', is_pinned: false, category_id: props.categoryID }}
      onFinish={props.onFinish}
    >
      <ProFormText name="title" label="标题" rules={[{ required: true }]} />
      <ProFormSelect name="category_id" label="分类" options={categoryOptions(props.categories)} />
      <ProFormText name="tags" label="标签" placeholder="多个标签用逗号分隔" />
      <ProFormSwitch name="is_pinned" label="置顶" />
      <ProFormSelect
        name="status"
        label="状态"
        options={[
          { label: '已发布', value: 'PUBLISHED' },
          { label: '草稿', value: 'DRAFT' },
          { label: '归档', value: 'ARCHIVED' },
        ]}
      />
      <ProFormTextArea name="content" label="内容" fieldProps={{ rows: 8 }} rules={[{ required: true }]} />
    </ModalForm>
  );
}

function FAQFormModal(props: {
  open: boolean;
  editing: FAQRow | null;
  categories: CategoryRow[];
  categoryID?: number;
  onOpenChange: (open: boolean) => void;
  onFinish: (values: FAQForm) => Promise<boolean>;
}) {
  return (
    <ModalForm<FAQForm>
      key={props.editing?.id ?? 'new'}
      title={props.editing ? '编辑 FAQ' : '新增 FAQ'}
      open={props.open}
      width={640}
      modalProps={{ destroyOnHidden: true, onCancel: () => props.onOpenChange(false) }}
      initialValues={props.editing ?? { status: 'ENABLED', sort_order: 0, category_id: props.categoryID }}
      onFinish={props.onFinish}
    >
      <ProFormText name="question" label="问题" rules={[{ required: true }]} />
      <ProFormTextArea name="answer" label="答案" fieldProps={{ rows: 6 }} rules={[{ required: true }]} />
      <ProFormSelect name="category_id" label="分类" options={categoryOptions(props.categories)} />
      <ProFormDigit name="sort_order" label="排序" min={0} />
      <ProFormSelect
        name="status"
        label="状态"
        options={[
          { label: '启用', value: 'ENABLED' },
          { label: '停用', value: 'DISABLED' },
        ]}
      />
    </ModalForm>
  );
}

function CategoryFormModal(props: {
  open: boolean;
  editing: CategoryRow | null;
  categories: CategoryRow[];
  onOpenChange: (open: boolean) => void;
  onFinish: (values: CategoryForm) => Promise<boolean>;
}) {
  const selectableCategories = props.categories.filter((item) => item.id !== props.editing?.id);
  return (
    <ModalForm<CategoryForm>
      key={props.editing?.id ?? 'new'}
      title={props.editing ? '编辑分类' : '新增分类'}
      open={props.open}
      modalProps={{ destroyOnHidden: true, onCancel: () => props.onOpenChange(false) }}
      initialValues={props.editing ?? { status: 'ENABLED', sort_order: 0 }}
      onFinish={props.onFinish}
    >
      <ProFormText name="name" label="分类名称" rules={[{ required: true }]} />
      <ProFormSelect name="parent_id" label="上级分类" allowClear options={categoryOptions(selectableCategories)} />
      <ProFormDigit name="sort_order" label="排序" min={0} />
      <ProFormSelect
        name="status"
        label="状态"
        options={[
          { label: '启用', value: 'ENABLED' },
          { label: '停用', value: 'DISABLED' },
        ]}
      />
    </ModalForm>
  );
}

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

function categoryOptions(categories: CategoryRow[]) {
  return categories.map((item) => ({ label: item.name, value: item.id }));
}
