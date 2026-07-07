import type { MenuRow } from '../../api/menus';

export type MenuTreeRow = MenuRow & {
  children?: MenuTreeRow[];
};

export function buildMenuTree(rows: MenuRow[]): MenuTreeRow[] {
  const nodeByID = new Map<number, MenuTreeRow>();
  const roots: MenuTreeRow[] = [];

  for (const row of rows) {
    nodeByID.set(row.id, { ...row });
  }

  for (const row of rows) {
    const node = nodeByID.get(row.id);
    if (!node) {
      continue;
    }
    if (row.parent_id && nodeByID.has(row.parent_id)) {
      const parent = nodeByID.get(row.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortMenuTree(roots);
  return roots;
}

export function menuParentOptions(rows: MenuRow[], editingID?: number) {
  const options: Array<{ label: string; value: number }> = [];
  const walk = (nodes: MenuTreeRow[], depth: number) => {
    for (const node of nodes) {
      if (node.id === editingID) {
        continue;
      }
      if (node.type !== 'button') {
        options.push({ label: `${'  '.repeat(depth)}${node.name} (${typeText(node.type)})`, value: node.id });
      }
      if (node.children) {
        walk(node.children, depth + 1);
      }
    }
  };
  walk(buildMenuTree(rows), 0);
  return options;
}

function sortMenuTree(nodes: MenuTreeRow[]) {
  nodes.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  for (const node of nodes) {
    if (node.children) {
      sortMenuTree(node.children);
    }
  }
}

export function typeText(type: MenuRow['type']) {
  if (type === 'directory') return '目录';
  if (type === 'page') return '页面';
  return '按钮';
}
