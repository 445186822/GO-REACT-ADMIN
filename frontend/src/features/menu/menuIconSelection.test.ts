import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const menuListSource = readFileSync(resolve(process.cwd(), 'src/features/menu/pages/MenuListPage.tsx'), 'utf8');
const basicLayoutSource = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');
const globalCss = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('menu icon selection', () => {
  it('uses a shared selectable icon registry instead of a free text icon field', () => {
    expect(menuListSource).toContain("from '../menuIcons'");
    expect(basicLayoutSource).toContain("from '../features/menu/menuIcons'");
    expect(menuListSource).toContain('<ProFormSelect');
    expect(menuListSource).toContain('name="icon"');
    expect(menuListSource).toContain('optionRender');
    expect(menuListSource).toContain('menu-icon-select-popup');
    expect(menuListSource).not.toContain('<ProFormText name="icon"');
    expect(globalCss).toContain('.menu-icon-select-popup .rc-virtual-list-holder-inner');
    expect(globalCss).toContain('grid-template-columns');
  });

  it('renders menu icons with previews in the menu table', () => {
    expect(menuListSource).toContain('renderMenuIconLabel');
    expect(menuListSource).toContain('render: (_, row) => renderMenuIconLabel(row.icon)');
  });
});
