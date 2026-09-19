export interface Todo { id: number; text: string; done: boolean }

/** Exercise: reject blank text and store the trimmed text. */
export function addTodo(todos: Todo[], text: string): Todo[] {
  const nextId = Math.max(0, ...todos.map(todo => todo.id)) + 1;
  return [...todos, { id: nextId, text, done: false }];
}

export function completeTodo(todos: Todo[], id: number): Todo[] {
  if (!todos.some(todo => todo.id === id)) throw new Error('Unknown todo');
  return todos.map(todo => todo.id === id ? { ...todo, done: true } : todo);
}
