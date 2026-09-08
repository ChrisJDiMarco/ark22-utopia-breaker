import * as T from 'three';
import type { FX } from './model';

export function createTrail() {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    'position',
    new T.BufferAttribute(new Float32Array(48), 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setDrawRange(0, 0);
  const line = new T.Line(
    geometry,
    new T.LineBasicMaterial({
      color: 0x50dfff,
      transparent: true,
      opacity: 0.65,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  line.frustumCulled = false;
  return line;
}

export function updateTrail(line: T.Line, position: T.Vector3) {
  const points = line.geometry.getAttribute('position') as T.BufferAttribute;
  (points.array as Float32Array).copyWithin(3, 0, 45);
  points.setXYZ(0, position.x, position.y, position.z);
  points.needsUpdate = true;
  line.geometry.setDrawRange(
    0,
    Math.min(16, line.geometry.drawRange.count + 1),
  );
}

export function fragmentBudget(
  kind: FX['kind'],
  reduced: boolean,
  live: number,
) {
  return Math.max(
    0,
    Math.min(
      90 - live,
      reduced ? 2 : kind === 'brick' ? 5 : kind === 'drone' ? 10 : 3,
    ),
  );
}
