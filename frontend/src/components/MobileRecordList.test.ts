import { describe, expect, it } from 'vitest';
import { getMobileColumns, type MobileListColumn } from './MobileRecordList';

type Row = {
  id: number;
  name: string;
  code: string;
  hidden: string;
};

describe('MobileRecordList helpers', () => {
  it('selects visible mobile columns in priority order', () => {
    const columns: MobileListColumn<Row>[] = [
      { title: 'Hidden', dataIndex: 'hidden', mobile: { visible: false, priority: 1 } },
      { title: 'Code', dataIndex: 'code', mobile: { visible: true, priority: 2 } },
      { title: 'Name', dataIndex: 'name', mobile: { title: true, visible: true, priority: 1 } },
    ];

    const selected = getMobileColumns(columns);

    expect(selected.map((column) => column.dataIndex)).toEqual(['name', 'code']);
  });

  it('finds the title column from mobile metadata', () => {
    const columns: MobileListColumn<Row>[] = [
      { title: 'Code', dataIndex: 'code', mobile: { visible: true, priority: 2 } },
      { title: 'Name', dataIndex: 'name', mobile: { title: true, visible: true, priority: 1 } },
    ];

    expect(getMobileColumns(columns).find((column) => column.mobile?.title)?.dataIndex).toBe('name');
  });
});
