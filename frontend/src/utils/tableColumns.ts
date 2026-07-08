import type { ProColumns } from '@ant-design/pro-components';

const MIN_OPERATION_COLUMN_WIDTH = 180;

type OperationColumnOptions = {
  fixed?: boolean;
  minWidth?: number;
  compact?: boolean;
};

export function operationColumnProps<T = unknown>(
  width = MIN_OPERATION_COLUMN_WIDTH,
  options: OperationColumnOptions = {},
): Pick<ProColumns<T>, 'valueType' | 'width' | 'fixed' | 'className'> {
  const minWidth = options.minWidth ?? MIN_OPERATION_COLUMN_WIDTH;
  const fixed = options.fixed ?? true;

  return {
    valueType: options.compact ? undefined : 'option',
    width: Math.max(width, minWidth),
    fixed: fixed ? 'right' : undefined,
    className: options.compact ? 'table-operation-column table-operation-column-compact' : 'table-operation-column',
  };
}
