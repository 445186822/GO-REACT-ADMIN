import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Dropdown, Empty, Pagination, Spin, Typography } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useMemo, useRef, useState, useCallback, useEffect, type Key, type ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Types ──────────────────────────────────────────────────────────────

export type ResponsiveProTableProps<T extends Record<string, any>> = {
  columns: ProColumns<T>[];
  rowKey?: string | ((record: T) => Key);
  /** ProTable request function — shared between desktop and mobile. */
  request?: (params: Record<string, any>, sort: any, filter: any) => Promise<{ data: T[]; total?: number; success?: boolean }>;
  /** Client-side data (alternative to request). */
  dataSource?: T[];
  loading?: boolean;
  pagination?: any;
  search?: any;
  toolBarRender?: any;
  headerTitle?: ReactNode;
  /** Forwarded to ProTable on desktop. */
  actionRef?: React.MutableRefObject<any>;
  /** Forwarded to ProTable on desktop. */
  onRow?: (record: T) => any;
  /** Forwarded to ProTable on desktop (tree data). */
  expandable?: any;
  /** Forwarded to ProTable on desktop. */
  options?: any;
  /** Max visible fields on mobile cards (default 5). */
  mobileMaxFields?: number;
  /** Override auto-derived mobile metadata per column (keyed by dataIndex or key). */
  mobile?: Record<string, { visible?: boolean; priority?: number; label?: string; title?: boolean }>;
  /** Card-level action dropdown for mobile. If omitted, auto-detected from operation column. */
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
      isTitle: false,
    };
  });

  const visible = slots
    .filter((s) => s.visible)
    .sort((a, b) => a.priority - b.priority);

  const titleCol = visible[0] ?? null;
  if (titleCol) titleCol.isTitle = true;

  // Also check for explicit title override
  if (overrides) {
    for (const [key, ov] of Object.entries(overrides)) {
      if (ov.title) {
        const match = visible.find((s) => s.key === key);
        if (match) {
          if (titleCol) titleCol.isTitle = false;
          match.isTitle = true;
        }
      }
    }
  }

  // Re-sort: title always first
  const explicitTitle = visible.find((s) => s.isTitle);
  const rest = visible.filter((s) => !s.isTitle).slice(0, explicitTitle ? maxFields - 1 : maxFields);
  const fields = explicitTitle ? rest : visible.slice(0, maxFields);

  const finalTitle = explicitTitle ?? (fields.length > 0 ? fields.shift()! : null);

  return { titleCol: finalTitle, fields };
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

  // Mobile internal state (when using request)
  const [mobileData, setMobileData] = useState<{ items: T[]; total: number }>({ items: [], total: 0 });
  const [mobileLoading, setMobileLoading] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 10;

  const fetchMobile = useCallback(async (page: number) => {
    if (!request) return;
    setMobileLoading(true);
    try {
      const result = await request({ current: page, pageSize: mobilePageSize }, {}, {});
      setMobileData({
        items: result?.data ?? [],
        total: result?.total ?? 0,
      });
    } finally {
      setMobileLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (isMobile && request) void fetchMobile(mobilePage);
  }, [isMobile, mobilePage, fetchMobile, request]);

  // Derive mobile layout from ProColumns
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
                  {/* Header */}
                  <div className="mobile-record-header">
                    <Typography.Text className="mobile-record-title" strong ellipsis>
                      {titleCol ? renderCellValue(row, titleCol.col, index) : <span className="mobile-record-empty-value">-</span>}
                    </Typography.Text>
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
