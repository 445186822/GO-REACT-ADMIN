import { describe, expect, it } from 'vitest';
import { featureNameFromTable, moduleNameFromTable, permissionPrefixFromTable, routePathFromTable } from './codegenNaming';

describe('code generator naming', () => {
  it('derives valid defaults for multi-word biz tables', () => {
    expect(moduleNameFromTable('biz_sms_records')).toBe('smsrecord');
    expect(permissionPrefixFromTable('biz_sms_records')).toBe('smsrecord');
    expect(routePathFromTable('biz_sms_records')).toBe('/business/smsrecords');
    expect(featureNameFromTable('biz_sms_records')).toBe('sms records');
  });
});
