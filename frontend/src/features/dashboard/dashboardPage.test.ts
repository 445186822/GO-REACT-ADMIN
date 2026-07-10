import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/dashboard/pages/DashboardPage.tsx'), 'utf8');

describe('dashboard stat cards', () => {
  it('renders six clickable cards in two full desktop rows', () => {
    expect(source).toContain("import { useNavigate } from 'react-router-dom'");
    expect(source).toContain('path: \'/collaboration/todos\'');
    expect(source).toContain("field: 'pending_todos'");
    expect(source).toContain('onClick={() => navigate(card.path)}');
    expect(source).toContain('lg={8}');
  });
});
