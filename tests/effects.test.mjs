import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createTrail, updateTrail, fragmentBudget } from '../app/game/effects.ts';

const trail = createTrail();
const geometry = trail.geometry;
const attribute = geometry.getAttribute('position');
const buffer = attribute.array;
const position = new Vector3();
let disposed = 0;
geometry.addEventListener('dispose', () => disposed++);
for (let i=0;i<10000;i++) updateTrail(trail,position.set(i,.4,-i));
assert.equal(trail.geometry,geometry);
assert.equal(geometry.getAttribute('position'),attribute);
assert.equal(attribute.array,buffer);
assert.equal(disposed,0);
assert.equal(geometry.drawRange.count,16);
assert.equal(buffer[0],9999);
assert.equal(buffer[3],9998);
for(const live of [0,85,88,90,100]) for(const kind of ['brick','drone','hit']) {
  assert(fragmentBudget(kind,false,live)>=0);
  assert(fragmentBudget(kind,false,live)<=Math.max(0,90-live));
}
geometry.dispose();trail.material.dispose();
assert.equal(disposed,1);
console.log('10,000 trail updates retain one GPU buffer; debris budget never exceeds 90.');
