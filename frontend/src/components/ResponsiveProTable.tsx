import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Empty, Pagination, Spin, Typography } from 'antd';
import { useMemo, useRef, useState, useEffect, type Key, type ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Types ──────────────────────────────────────────────────────────────

export type ResponsiveProTableProps<T extends Record<string, any>> = {
  columns: ProColumns<T>[];
  rowKey?: string | ((record: T) => Key);
  request?: (params: Record<string, any>, sort: any, filter: any) => Promise<{ data: T[]; total?: number; success?: boolean }>;
  dataSource?: T[];
  loading?: boolean;
  pagination?: any;
  search?: any;
  toolBarRender?: any;
  headerTitle?: ReactNode;
  actionRef?: React.MutableRefObject<any>;
  onRow?: (record: T) => any;
  expandable?: any;
  options?: any;
  mobileMaxFields?: number;
  mobile?: Record<string, { visible?: boolean; priority?: number; label?: string; title?: boolean }>;
  renderMobileActions?: (row: T) => ReactNode;
};

// ── Helpers ────────────────────────────────────────────────────────────

function isActionColumn<T>(col: ProColumns<T>): boolean {
  return col.valueType === 'option' || col.key === 'action' || col.dataIndex === 'action';
}

function columnKey<T>(col: ProColumns<T>): string {
  return String(col.key ?? col.dataIndex ?? '');
}

function columnLabel<T>(col: ProColumns<T>): string {
  if (typeof col.title === 'function') return String(col.dataIndex ?? '');
  if (typeof col.title === 'string') return col.title;
  return String(col.dataIndex ?? '');
}

function renderCellValue<T extends Record<string, any>>(
  row: T, col: ProColumns<T>, index: number,
): ReactNode {
  if (typeof col.render === 'function') {
    const text = (col.dataIndex !== undefined)
      ? (row as any)[col.dataIndex as string]
      : undefined;
    const rendered = (col.render as any)(text, row, index, undefined as any, undefined as any);
    if (rendered !== undefined && rendered !== null && rendered !== '') return rendered;
  }
  const raw = (col.dataIndex !== undefined) ? (row as any)[col.dataIndex as string] : undefined;
  if (raw === undefined || raw === null || raw === '') return <span className="mobile-record-empty-value">-</span>;
  if (Array.isArray(raw)) return raw.length ? raw.join('、') : <span className="mobile-record-empty-value">-</span>;
  return raw as ReactNode;
}

// ── Auto-derive mobile columns ─────────────────────────────────────────

interface MobileSlot<T> {
  key: string;
  label: string;
  col: ProColumns<T>;
  priority: number;
  visible: boolean;
  isTitle: boolean;
}

function deriveMobileSlots<T extends Record<string, any>>(
  columns: ProColumns<T>[],
  maxFields: number,
  overrides?: ResponsiveProTableProps<T>['mobile'],
): { titleCol: MobileSlot<T> | null; fields: MobileSlot<T>[] } {
  const nonAction = columns.filter((c) => !isActionColumn(c));
  if (nonAction.length === 0) return { titleCol: null, fields: [] };

  const slots: MobileSlot<T>[] = nonAction.map((col, idx) => {
    const key = columnKey(col);
    const ov = overrides?.[key];
    return {
      key,
      label: ov?.label ?? columnLabel(col),
      col,
      priority: ov?.priority ?? idx,
      visible: ov?.visible !== false,
      isTitle: ov?.title === true,
    };
  });

  const visible = slots
    .filter((s) => s.visible)
    .sort((a, b) => a.priority - b.priority);

  // Title: explicitly marked column, or the first visible column as fallback.
  const explicitTitle = visible.find((s) => s.isTitle);
  const titleCol = explicitTitle ?? visible[0] ?? null;

  // Fields: exclude the title column, cap at maxFields.
  const fields = visible.filter((s) => s !== titleCol).slice(0, maxFields);

  return { titleCol, fields };
}

// ── Component ──────────────────────────────────────────────────────────

export function ResponsiveProTable<T extends Record<string, any>>(
  props: ResponsiveProTableProps<T>,
) {
  const {
    columns = [],
    rowKey = 'id',
    request,
    dataSource,
    loading: externalLoading,
    pagination,
    search,
    toolBarRender,
    headerTitle,
    actionRef: externalActionRef,
    onRow,
    expandable,
    options,
    mobileMaxFields = 5,
    mobile: mobileOverrides,
    renderMobileActions,
  } = props;

  const isMobile = useIsMobile();

  // Hold latest request in a ref so the effect doesn't re-trigger on render
  const requestRef = useRef(request);
  requestRef.current = request;

  const [mobileData, setMobileData] = useState<{ items: T[]; total: number }>({ items: [], total: 0 });
  const [mobileLoading, setMobileLoading] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 10;

  useEffect(() => {
    if (!isMobile || !requestRef.current) return;
    let cancelled = false;
    setMobileLoading(true);
    requestRef.current({ current: mobilePage, pageSize: mobilePageSize }, {}, {})
      .then((result) => {
        if (cancelled) return;
        setMobileData({ items: result?.data ?? [], total: result?.total ?? 0 });
      })
      .finally(() => {
        if (!cancelled) setMobileLoading(false);
      });
    return () => { cancelled = true; };
  }, [isMobile, mobilePage]);

  const mobileSlots = useMemo(
    () => deriveMobileSlots(columns, mobileMaxFields, mobileOverrides),
    [columns, mobileMaxFields, mobileOverrides],
  );

  // Desktop
  if (!isMobile) {
    return (
      <ProTable<T>
        columns={columns}
        rowKey={rowKey}
        request={request}
        dataSource={dataSource}
        loading={externalLoading}
        pagination={pagination}
        search={search}
        toolBarRender={toolBarRender}
        headerTitle={headerTitle}
        actionRef={externalActionRef}
        onRow={onRow}
        expandable={expandable}
        options={options}
        scroll={{ x: 'max-content' }}
      />
    );
  }

  // ── Mobile card layout ──────────────────────────────────────────────

  const items = dataSource ?? mobileData.items;
  const loading = externalLoading ?? mobileLoading;
  const { titleCol, fields } = mobileSlots;

  return (
    <div className="responsive-pro-table-mobile">
      {toolBarRender && (
        <div className="mobile-record-toolbar">{toolBarRender(undefined, {})}</div>
      )}

      <Spin spinning={Boolean(loading)}>
        {items.length > 0 ? (
          <div className="mobile-record-items">
            {items.map((row, index) => {
              const rowKeyValue = typeof rowKey === 'function' ? rowKey(row) : (row as any)[rowKey];
              return (
                <div className="mobile-record-item" key={rowKeyValue ?? index}>
                  {/* Header: first column as title + actions */}
                  <div className="mobile-record-header">
                    {titleCol ? (
                      <Typography.Text className="mobile-record-title" strong ellipsis>
                        {titleCol.label}：{renderCellValue(row, titleCol.col, index)}
                      </Typography.Text>
                    ) : (
                      <span />
                    )}
                    {renderMobileActions?.(row) && (
                      <div className="mobile-record-actions">{renderMobileActions(row)}</div>
                    )}
                  </div>
                  {/* Fields */}
                  <div className="mobile-record-fields">
                    {fields.map((slot) => (
                      <div className="mobile-record-field" key={slot.key}>
                        <span className="mobile-record-label">{slot.label}</span>
                        <span className="mobile-record-value">{renderCellValue(row, slot.col, index)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty className="mobile-record-empty-state" description="暂无数据" />
        )}
      </Spin>

      {pagination !== false && !dataSource && mobileData.total > mobilePageSize && (
        <div className="mobile-record-pagination">
          <Pagination
            current={mobilePage}
            pageSize={mobilePageSize}
            total={mobileData.total}
            showSizeChanger={false}
            size="small"
            onChange={(page) => setMobilePage(page)}
          />
        </div>
      )}
    </div>
  );
}
