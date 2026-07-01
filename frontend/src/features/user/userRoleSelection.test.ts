import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const userListSource = readFileSync(resolve(process.cwd(), 'src/features/user/pages/UserListPage.tsx'), 'utf8');
const usersApiSource = readFileSync(resolve(process.cwd(), 'src/api/users.ts'), 'utf8');

describe('user role selection', () => {
  it('uses multi-role ids in the user form and API contract', () => {
    expect(userListSource).toContain('name="role_ids"');
    expect(userListSource).toContain('mode="multiple"');
    expect(usersApiSource).toContain('role_ids?: number[]');
  });
});
