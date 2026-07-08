import type { ProColumns } from '@ant-design/pro-components';
import { Empty, Spin, Typography } from 'antd';
import type { Key, ReactNode } from 'react';

export type MobileColumnMeta<T> = {
  title?: boolean;
  visible?: boolean;
  priority?: number;
  label?: ReactNode;
  render?: (row: T, index: number) => ReactNode;
};

export type MobileListColumn<T> = ProColumns<T> & {
  mobile?: MobileColumnMeta<T>;
};

type MobileRecordListProps<T extends object> = {
  columns: MobileListColumn<T>[];
  dataSource: T[];
  rowKey: keyof T | ((row: T) => Key);
  loading?: boolean;
  toolbar?: ReactNode;
  actions?: (row: T) => ReactNode;
  pagination?: ReactNode;
  emptyText?: string;
};

export function getMobileColumns<T>(columns: MobileListColumn<T>[]) {
  return columns
    .filter((column) => (column.mobile?.title || column.mobile?.visible) && column.mobile?.visible !== false)
    .sort((left, right) => (left.mobile?.priority ?? 999) - (right.mobile?.priority ?? 999));
}

export function MobileRecordList<T extends object>({
  columns,
  dataSource,
  rowKey,
  loading,
  toolbar,
  actions,
  pagination,
  emptyText = '暂无数据',
}: MobileRecordListProps<T>) {
  const mobileColumns = getMobileColumns(columns);
  const titleColumn = mobileColumns.find((column) => column.mobile?.title) ?? mobileColumns[0];
  const fieldColumns = mobileColumns.filter((column) => column !== titleColumn);

  return (
    <div className="mobile-record-list">
      {toolbar ? <div className="mobile-record-toolbar">{toolbar}</div> : null}
      <Spin spinning={Boolean(loading)}>
        {dataSource.length ? (
          <div className="mobile-record-items">
            {dataSource.map((row, index) => (
              <div className="mobile-record-item" key={resolveRowKey(row, rowKey)}>
                <div className="mobile-record-header">
                  <Typography.Text className="mobile-record-title" strong ellipsis>
                    {renderColumnValue(row, titleColumn, index)}
                  </Typography.Text>
                  {actions ? <div className="mobile-record-actions">{actions(row)}</div> : null}
                </div>
                <div className="mobile-record-fields">
                  {fieldColumns.map((column) => (
                    <div className="mobile-record-field" key={String(column.key ?? column.dataIndex ?? getColumnLabel(column))}>
                      <span className="mobile-record-label">{getColumnLabel(column)}</span>
                      <span className="mobile-record-value">{renderColumnValue(row, column, index)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty className="mobile-record-empty-state" description={emptyText} />
        )}
      </Spin>
      {pagination ? <div className="mobile-record-pagination">{pagination}</div> : null}
    </div>
  );
}

function resolveRowKey<T extends object>(row: T, rowKey: keyof T | ((row: T) => Key)) {
  if (typeof rowKey === 'function') {
    return rowKey(row);
  }
  return row[rowKey] as Key;
}

function getColumnLabel<T>(column: MobileListColumn<T>) {
  if (column.mobile?.label) {
    return column.mobile.label;
  }
  if (typeof column.title === 'function') {
    return String(column.dataIndex ?? '');
  }
  return column.title ?? String(column.dataIndex ?? '');
}

function renderColumnValue<T extends object>(row: T, column: MobileListColumn<T> | undefined, index: number) {
  if (!column) {
    return <span className="mobile-record-empty-value">-</span>;
  }
  const customValue = column.mobile?.render?.(row, index);
  if (customValue !== undefined && customValue !== null && customValue !== '') {
    return customValue;
  }
  if (typeof column.render === 'function') {
    const renderedValue = column.render(readDataIndex(row, column.dataIndex) as ReactNode, row, index, undefined as never, undefined as never);
    if (renderedValue !== undefined && renderedValue !== null && renderedValue !== '') {
      return renderedValue as ReactNode;
    }
  }
  return normalizeValue(readDataIndex(row, column.dataIndex));
}

function readDataIndex<T extends object>(row: T, dataIndex: MobileListColumn<T>['dataIndex']) {
  if (dataIndex === undefined) {
    return undefined;
  }
  if (Array.isArray(dataIndex)) {
    return dataIndex.reduce<unknown>((current, key) => {
      if (current === undefined || current === null) {
        return undefined;
      }
      return (current as Record<PropertyKey, unknown>)[key as PropertyKey];
    }, row);
  }
  return (row as Record<PropertyKey, unknown>)[dataIndex as PropertyKey];
}

function normalizeValue(value: unknown): ReactNode {
  if (value === undefined || value === null || value === '') {
    return <span className="mobile-record-empty-value">-</span>;
  }
  if (Array.isArray(value)) {
    return value.length ? value.join('、') : <span className="mobile-record-empty-value">-</span>;
  }
  return value as ReactNode;
}
