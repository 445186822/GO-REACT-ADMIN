import type { TodoRow } from '../../api/collaboration';

export type TodoScope = 'pending' | 'done';

export function todoScopeLabel(scope: TodoScope) {
  return scope === 'pending' ? '待办' : '已办';
}

export function countTodosByScope(items: TodoRow[]) {
  return items.reduce(
    (counts, item) => {
      counts[item.todo_status === 'done' ? 'done' : 'pending'] += 1;
      return counts;
    },
    { pending: 0, done: 0 },
  );
}
