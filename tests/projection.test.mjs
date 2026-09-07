import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, Vector2, Raycaster, Plane } from 'three';
import { alignArena } from '../app/game/projection.ts';

const corners = [[-8,-10.2],[8,-10.2],[8,10.2],[-8,10.2]];
const targets = [[.276,.065],[.749,.065],[.87,.865],[.145,.865]];
for (const [width, height] of [[320,1000],[390,844],[768,1024],[900,1000],[1440,900],[844,390],[2560,1080]]) {
  const aspect = width / height;
  const camera = new PerspectiveCamera(44, aspect, .1, 200);
  const xScale = aspect < .95 ? .75 : 1.5;
  if (aspect < .95) {
    const distance = Math.max(31, 18 / aspect);
    camera.position.set(0, distance, distance * .28);
    camera.lookAt(0, 0, .6);
  } else {
    const scale = Math.max(1, 1.5 / aspect);
    camera.position.set(0, 22 * scale, 17 * scale);
    camera.lookAt(0, 0, 1.25);
  }
  camera.updateProjectionMatrix();
  alignArena(camera, xScale);
  corners.forEach(([x,z], i) => {
    const p = new Vector3(x*xScale, .04, z).project(camera);
    assert(Math.abs((p.x+1)/2-targets[i][0]) < 1e-9);
    assert(Math.abs((1-p.y)/2-targets[i][1]) < 1e-9);
  });
  const ray = new Raycaster();
  for (const y of [0,.4,1,3]) for (const x of [-8,-4,0,4,8]) for (const z of [-11,-10.2,0,8.5,10.2,11]) {
    const point = new Vector3(x*xScale,y,z);
    const ndc = point.clone().project(camera);
    assert(ndc.z > -1 && ndc.z < 1, `Clipped at ${width}x${height}: ${point.toArray()}`);
    ray.setFromCamera(new Vector2(ndc.x,ndc.y),camera);
    const hit = ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),-y),new Vector3());
    assert(hit && hit.distanceTo(point) < 1e-9, 'Pointer projection must round-trip');
  }
}
console.log('Projection: approved framing, visible depth, and pointer alignment pass at 7 viewport sizes.');
