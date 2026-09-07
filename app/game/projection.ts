import { Matrix4, Vector3, type PerspectiveCamera } from 'three';
/** Match the live 3D play plane to the approved arena's perspective. */
export function alignArena(camera: PerspectiveCamera, xScale: number) {
  const world = [
    [-8, -10.2],
    [8, -10.2],
    [8, 10.2],
    [-8, 10.2],
  ];
  const target = [
    [0.276, 0.065],
    [0.749, 0.065],
    [0.87, 0.865],
    [0.145, 0.865],
  ];
  camera.updateMatrixWorld();
  const a: number[][] = [];
  world.forEach(([x, z], i) => {
    const p = new Vector3(x * xScale, 0.04, z).project(camera),
      u = target[i][0] * 2 - 1,
      v = 1 - target[i][1] * 2;
    a.push(
      [p.x, p.y, 1, 0, 0, 0, -u * p.x, -u * p.y, u],
      [0, 0, 0, p.x, p.y, 1, -v * p.x, -v * p.y, v],
    );
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const k = a[col][col];
    for (let j = col; j < 9; j++) a[col][j] /= k;
    for (let row = 0; row < 8; row++)
      if (row !== col) {
        const q = a[row][col];
        for (let j = col; j < 9; j++) a[row][j] -= q * a[col][j];
      }
  }
  const h = a.map((row) => row[8]);
  const warp = new Matrix4().set(
    h[0],
    h[1],
    0,
    h[2],
    h[3],
    h[4],
    0,
    h[5],
    h[6],
    h[7],
    1,
    0,
    h[6],
    h[7],
    0,
    1,
  );
  camera.projectionMatrix.premultiply(warp);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
