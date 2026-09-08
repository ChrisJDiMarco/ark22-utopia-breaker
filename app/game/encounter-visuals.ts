import * as T from 'three';
import { ENEMIES, type EnemyKind } from './campaign';
import type { Drone } from './model';

export function enemyVisual(
  kind: EnemyKind,
  template: T.Object3D | null,
  chrome: T.Material,
) {
  const group = new T.Group();
  if (template) {
    const model = template.clone();
    model.scale.setScalar(kind === 'sentinel' ? 1.85 : 1.6);
    group.add(model);
  } else group.add(new T.Mesh(new T.OctahedronGeometry(0.55), chrome));
  if (kind !== 'thief') {
    for (const side of [-1, 1]) {
      const pod = new T.Mesh(
        kind === 'sentinel'
          ? new T.IcosahedronGeometry(0.35, 0)
          : new T.CapsuleGeometry(0.16, 0.55, 3, 8),
        chrome,
      );
      pod.position.set(side * 0.67, 0, 0);
      pod.rotation.x = Math.PI / 2;
      pod.castShadow = true;
      group.add(pod);
    }
  }
  const ring = new T.Mesh(
    new T.TorusGeometry(kind === 'sentinel' ? 0.85 : 0.66, 0.027, 8, 40),
    new T.MeshBasicMaterial({ color: ENEMIES[kind].color }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.name = 'status-ring';
  group.add(ring);
  if (kind === 'bomber') {
    const warning = new T.Group();
    warning.name = 'warning';
    const beam = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
      new T.LineBasicMaterial({
        color: 0xeb822f,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    const target = new T.Mesh(
      new T.RingGeometry(0.45, 0.5, 40),
      new T.MeshBasicMaterial({
        color: 0xf49b40,
        transparent: true,
        opacity: 0.75,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    target.rotation.x = -Math.PI / 2;
    warning.add(beam, target);
    group.add(warning);
  }
  return group;
}

export function animateEnemy(
  group: T.Object3D,
  d: Drone,
  frozen: boolean,
  reduced: boolean,
) {
  group.position.set(
    d.x,
    1 + (reduced ? 0 : Math.sin(d.age * 3 + d.phase) * 0.12),
    d.z,
  );
  const ring = group.getObjectByName('status-ring') as T.Mesh<
    T.TorusGeometry,
    T.MeshBasicMaterial
  >;
  ring.material.color.setHex(frozen ? 0x96eeff : ENEMIES[d.kind].color);
  const carrying = d.ball !== null || !!d.cargo;
  ring.scale.setScalar(
    carrying
      ? 1.3 + (reduced ? 0 : Math.sin(d.age * 8) * 0.12)
      : d.kind === 'sentinel' && d.hp === 1
        ? 0.7
        : 1,
  );
  ring.rotation.z = reduced ? 0 : d.age;
  const warning = group.getObjectByName('warning');
  if (warning) {
    warning.visible = d.fireIn <= 0.9;
    const beam = warning.children[0] as T.Line;
    const positions = beam.geometry.getAttribute(
      'position',
    ) as T.BufferAttribute;
    positions.setXYZ(0, 0, -0.75, 0);
    positions.setXYZ(1, d.aimX - d.x, -0.9, 8.4 - d.z);
    positions.needsUpdate = true;
    beam.geometry.computeBoundingSphere();
    warning.children[1].position.set(d.aimX - d.x, -0.9, 8.4 - d.z);
  }
}

export function bombVisual() {
  const group = new T.Group();
  const core = new T.Mesh(
    new T.OctahedronGeometry(0.22),
    new T.MeshStandardMaterial({
      color: 0xff9c3e,
      emissive: 0xc15a16,
      emissiveIntensity: 0.8,
      metalness: 0.65,
      roughness: 0.2,
    }),
  );
  core.castShadow = true;
  const ring = new T.Mesh(
    new T.TorusGeometry(0.32, 0.035, 6, 24),
    new T.MeshBasicMaterial({ color: 0xffa658 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(core, ring);
  return group;
}
