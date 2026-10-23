import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteSelected, restoreDeleted } from '../src/deletion.js';
const rows = () => [
 { id:'a', ja:'A', selected:true, quantity:2, allergens:[true,null,false] },
 { id:'b', ja:'B', selected:false, quantity:1 },
 { id:'c', ja:'C', selected:true, quantity:3 },
 { id:'d', ja:'D', selected:false, quantity:1 },
];
test('bulk deletion removes selected rows and restores original order and complete row data', () => {
 const original = rows(), deleted = deleteSelected(original);
 assert.deepEqual(deleted.rows.map(p => p.id), ['b','d']);
 assert.deepEqual(restoreDeleted(deleted.rows, deleted.action), original);
});
test('Undo retains later edits and inserted rows instead of rolling the entire list back', () => {
 const original = rows(), deleted = deleteSelected(original);
 const current = [{id:'new',ja:'New',selected:false}, ...deleted.rows.map(p => p.id === 'b' ? {...p,ja:'Edited B',quantity:7} : p)];
 const restored = restoreDeleted(current, deleted.action);
 assert.deepEqual(restored.map(p => p.id), ['new','a','b','c','d']);
 assert.equal(restored.find(p => p.id === 'b').ja, 'Edited B');
 assert.equal(restored.find(p => p.id === 'b').quantity, 7);
 assert.deepEqual(restored[1].allergens, [true,null,false]);
});
test('consecutive deletes can be undone in reverse order, including an empty list', () => {
 const original = rows().map(p => ({...p,selected:true}));
 const first = deleteSelected(original);
 assert.equal(first.rows.length, 0);
 assert.deepEqual(restoreDeleted([], first.action), original);
 const partial = deleteSelected(rows());
 const second = deleteSelected(partial.rows.map(p => ({...p, selected:true})));
 const restoredSecond = restoreDeleted(second.rows, second.action);
 assert.deepEqual(restoreDeleted(restoredSecond,partial.action).map(p => p.id), ['a','b','c','d']);
});
