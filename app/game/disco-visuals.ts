import * as T from 'three';
import { BUMPERS } from './disco';
import type { Game } from './model';

export function discoVisuals() {
  const group = new T.Group();
  group.visible = false;
  const chrome = new T.MeshStandardMaterial({
    color: 0xd8e9ff,
    metalness: 1,
    roughness: 0.12,
    flatShading: true,
  });
  const mirrorBall = new T.Mesh(
    new T.SphereGeometry(0.85, 20, 12),
    chrome,
  );
  mirrorBall.position.set(8.65, 1.7, 0);
  group.add(mirrorBall);
  const orbitMaterial = new T.MeshBasicMaterial({ color: 0xff73e7 });
  const orbit = new T.Mesh(
    new T.TorusGeometry(1.12, 0.028, 6, 48),
    orbitMaterial,
  );
  orbit.position.copy(mirrorBall.position);
  orbit.rotation.x = 0.8;
  group.add(orbit);
  const bumpers = BUMPERS.map((b) => {
    const base = new T.Group();
    base.position.set(b.x, 0.16, b.z);
    const rim = new T.MeshStandardMaterial({
      color: b.color,
      emissive: b.color,
      emissiveIntensity: 1.1,
      metalness: 0.5,
      roughness: 0.2,
    });
    const body = new T.Mesh(
      new T.CylinderGeometry(b.radius, b.radius, 0.28, 32),
      chrome,
    );
    body.position.y = 0.14;
    const ring = new T.Mesh(
      new T.TorusGeometry(b.radius - 0.035, 0.045, 6, 40),
      rim,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.31;
    const core = new T.Mesh(new T.OctahedronGeometry(0.24), rim);
    core.position.y = 0.5;
    base.add(body, ring, core);
    group.add(base);
    return { base, core, rim };
  });
  const spots = new T.InstancedMesh(
    new T.CircleGeometry(0.13, 8),
    new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
    32,
  );
  const transform = new T.Object3D(),
    color = new T.Color();
  for (let i = 0; i < 32; i++) {
    transform.position.set(
      -6.8 + (i % 8) * 1.94,
      0.08,
      0.3 + Math.floor(i / 8) * 2.2,
    );
    transform.rotation.x = -Math.PI / 2;
    transform.updateMatrix();
    spots.setMatrixAt(i, transform.matrix);
    spots.setColorAt(i, color.setHSL(i / 32, 0.9, 0.7));
  }
  group.add(spots);
  // No shadow maps, particles, or new geometries are allocated during animation.
  const pink = new T.PointLight(0xff37bc, 9, 22, 2);
  pink.position.set(-5, 3, 2);
  const cyan = new T.PointLight(0x36dfff, 9, 22, 2);
  cyan.position.set(5, 3, -4);
  group.add(pink, cyan);
  return {
    group,
    update(g: Game, reduced: boolean) {
      group.visible = g.variant === 'disco';
      if (!group.visible) return;
      const time = reduced ? 0 : g.discoTime;
      mirrorBall.rotation.y = time * 0.35;
      orbit.rotation.z = time * 0.2;
      spots.rotation.y = Math.sin(time * 0.15) * 0.06;
      pink.intensity = 8 + Math.sin(time * 1.4) * 2;
      cyan.intensity = 8 + Math.cos(time * 1.4) * 2;
      for (let i = 0; i < bumpers.length; i++) {
        const b = bumpers[i];
        b.base.visible = i < 2 || g.level >= 4;
        b.core.rotation.y = time * 1.2;
        b.rim.emissiveIntensity = 1 + Math.sin(time * 2 + i) * 0.25;
      }
    },
  };
}
