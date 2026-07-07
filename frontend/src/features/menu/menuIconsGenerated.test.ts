import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const generatedPath = resolve(process.cwd(), 'src/features/menu/menuIcons.generated.tsx');
const scriptPath = resolve(process.cwd(), 'scripts/generate-menu-icons.mjs');
const packageSource = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');

describe('generated menu icon registry', () => {
  it('is generated from Ant Design outlined icon exports', () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(generatedPath)).toBe(true);

    const generatedSource = readFileSync(generatedPath, 'utf8');
    const iconNames = [...generatedSource.matchAll(/name: '([^']+)'/g)].map((match) => match[1]);

    expect(iconNames.length).toBeGreaterThan(400);
    expect(iconNames.every((name) => name.endsWith('Outlined'))).toBe(true);
    expect(iconNames.some((name) => name.endsWith('Filled'))).toBe(false);
    expect(iconNames.some((name) => name.endsWith('TwoTone'))).toBe(false);
  });

  it('exposes an npm script for refreshing the generated registry', () => {
    const packageJson = JSON.parse(packageSource) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['generate:menu-icons']).toBe('node scripts/generate-menu-icons.mjs');
  });
});
