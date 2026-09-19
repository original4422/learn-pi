import test from 'node:test';
import assert from 'node:assert/strict';
import { addTodo, completeTodo } from './todo.ts';
test('adds a todo without mutating the input', () => {
  const source = [{ id: 4, text: 'read Pi', done: true }];
  assert.deepEqual(addTodo(source, 'write tests')[1], { id: 5, text: 'write tests', done: false });
  assert.equal(source.length, 1);
});
test('trims surrounding whitespace', () => assert.equal(addTodo([], '  learn Pi  ')[0]?.text, 'learn Pi'));
test('rejects blank text', () => assert.throws(() => addTodo([], ' \n  '), /empty|blank/i));
test('completion preserves other todos', () => {
  const todos = addTodo(addTodo([], 'one'), 'two');
  assert.equal(completeTodo(todos, 1)[0]?.done, true);
  assert.equal(todos[0]?.done, false);
  assert.throws(() => completeTodo(todos, 99), /Unknown/);
});
