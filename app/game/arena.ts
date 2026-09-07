import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { alignArena } from './projection';
import { Game, POWER, type Snapshot, type FX } from './model';

type Particle = {
  mesh: T.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
};
const COLORS = [0xedc582, 0x69cadc, 0x86b2e3, 0xec9dac, 0x68cfc2, 0xbca5e0];
export class Arena {
  renderer: T.WebGLRenderer;
  composer: EffectComposer;
  scene = new T.Scene();
  world = new T.Group();
  camera = new T.PerspectiveCamera(44, 1, 0.1, 200);
  game = new Game();
  raf = 0;
  observer: ResizeObserver;
  env: T.WebGLRenderTarget;
  mirror: Reflector;
  meshes = new Map<number, T.Object3D>();
  paddle = new T.Group();
  droneTemplate: T.Object3D | null = null;
  boss = new T.Group();
  shield: T.Mesh;
  particles: Particle[] = [];
  rings: { mesh: T.Mesh; life: number; max: number }[] = [];
  trails = new Map<number, T.Vector3[]>();
  trailMeshes = new Map<number, T.Line>();
  clock = 0;
  last = 0;
  lastUI = 0;
  gone = false;
  keys = new Set<string>();
  sound = false;
  audio: AudioContext | null = null;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  fps = 60;
  frameSum = 0;
  frameN = 0;
  loaded = 0;
  private ray = new T.Raycaster();
  private plane = new T.Plane(new T.Vector3(0, 1, 0), -0.4);
  private cleanups: (() => void)[] = [];
  private textures: T.Texture[] = [];
  private ceramic = new T.MeshPhysicalMaterial({
    color: 0xe7ece7,
    metalness: 0.26,
    roughness: 0.19,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  private chrome = new T.MeshPhysicalMaterial({
    color: 0xd4dddd,
    metalness: 1,
    roughness: 0.14,
  });
  private glow = new T.MeshStandardMaterial({
    color: 0x6ae3f8,
    emissive: 0x2cc9ea,
    emissiveIntensity: 2.5,
    roughness: 0.25,
  });
  private ballMaterial = new T.MeshPhysicalMaterial({
    color: 0xf5ffff,
    metalness: 0.9,
    roughness: 0.07,
    clearcoat: 1,
    emissive: 0x30636f,
    emissiveIntensity: 0.3,
  });
  private brickMaterials = COLORS.map(
    (color) =>
      new T.MeshPhysicalMaterial({
        color,
        metalness: 0.08,
        roughness: 0.055,
        transmission: 0.78,
        thickness: 0.6,
        ior: 1.5,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        iridescence: 0.2,
        envMapIntensity: 1.8,
      }),
  );
  private sharedGeo = new Set<T.BufferGeometry>();
  private sharedMat = new Set<T.Material>();
  private clearBrick = new T.MeshPhysicalMaterial({
    color: 0xe0eef0,
    metalness: 0.05,
    roughness: 0.045,
    transmission: 0.85,
    thickness: 0.6,
    ior: 1.5,
    clearcoat: 1,
    envMapIntensity: 1.9,
  });
  private brickGeo = new RoundedBoxGeometry(1.28, 0.45, 0.6, 3, 0.1);
  private trimGeo = new RoundedBoxGeometry(1.3, 0.065, 0.62, 2, 0.04);
  private ballGeo = new T.SphereGeometry(0.4, 32, 20);
  private fragmentGeo = new T.TetrahedronGeometry(0.1);
  constructor(
    public host: HTMLElement,
    public onUpdate: (s: Snapshot) => void = () => {},
  ) {
    for (const g of [
      this.brickGeo,
      this.trimGeo,
      this.ballGeo,
      this.fragmentGeo,
    ])
      this.sharedGeo.add(g);
    for (const m of [
      this.ceramic,
      this.chrome,
      this.glow,
      this.ballMaterial,
      this.clearBrick,
      ...this.brickMaterials,
    ])
      this.sharedMat.add(m);
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    host.appendChild(this.renderer.domElement);
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      'aria-label',
      'Game arena. Move with left and right arrows. Space to launch. E for pulse. P to pause.',
    );
    this.scene.background = null;
    this.renderer.setClearColor(0x000000, 0);
    this.scene.fog = null;
    this.world.scale.x = 1.5;
    this.scene.add(this.world);
    const pm = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.env = pm.fromScene(room, 0.03);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.8;
    room.dispose();
    pm.dispose();
    this.scene.add(new T.HemisphereLight(0xe8f7ff, 0x426477, 0.42));
    const sun = new T.DirectionalLight(0xffeed3, 4.5);
    sun.position.set(-16, 25, -9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -28,
      right: 28,
      top: 28,
      bottom: -28,
      near: 0.5,
      far: 90,
    });
    sun.shadow.radius = 3;
    sun.shadow.normalBias = 0.018;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);
    const fill = new T.DirectionalLight(0x99dfff, 0.6);
    fill.position.set(12, 12, 7);
    this.scene.add(fill);
    this.mirror = new Reflector(new T.PlaneGeometry(16, 20.8), {
      color: 0xb7cbd0,
      textureWidth: 768,
      textureHeight: 768,
      clipBias: 0.003,
    });
    this.mirror.rotation.x = -Math.PI / 2;
    this.mirror.position.y = 0.042;
    const reflection = this.mirror.material as T.ShaderMaterial;
    reflection.transparent = true;
    reflection.depthWrite = false;
    reflection.fragmentShader = reflection.fragmentShader.replace(
      'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
      'gl_FragColor = vec4(base.rgb, base.a * 0.17);',
    );
    this.world.add(this.mirror);
    const contact = new T.Mesh(
      new T.PlaneGeometry(16, 20.8),
      new T.ShadowMaterial({ color: 0x244956, opacity: 0.24 }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.049;
    contact.receiveShadow = true;
    this.world.add(contact);
    this.world.add(this.paddle);
    this.paddle.position.set(0, 0.45, 8.5);
    this.box(3, 0.4, 0.7, 0, 0, 0, this.chrome, 0.2, this.paddle);
    this.box(2.3, 0.13, 0.45, 0, 0.23, 0, this.glow, 0.15, this.paddle);
    this.paddle.scale.y = 1.4;
    this.shield = new T.Mesh(new T.BoxGeometry(16, 0.05, 0.12), this.glow);
    this.shield.position.set(0, 0.25, 10.1);
    this.world.add(this.shield);
    const core = new T.Mesh(
      new T.IcosahedronGeometry(1, 2),
      new T.MeshPhysicalMaterial({
        color: 0xe3bf8b,
        metalness: 0.78,
        roughness: 0.13,
        clearcoat: 1,
      }),
    );
    core.scale.set(1.5, 0.7, 0.6);
    this.boss.add(core);
    for (const r of [1.1, 1.5]) {
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.04, 8, 64), this.glow);
      ring.rotation.x = Math.PI / 2;
      this.boss.add(ring);
    }
    this.world.add(this.boss);
    new T.TextureLoader().load('/textures/atrium-light.png', (tex) => {
      if (this.gone) {
        tex.dispose();
        return;
      }
      tex.mapping = T.EquirectangularReflectionMapping;
      tex.colorSpace = T.SRGBColorSpace;
      const gen = new T.PMREMGenerator(this.renderer);
      const next = gen.fromEquirectangular(tex);
      gen.dispose();
      this.env.dispose();
      this.env = next;
      this.scene.environment = next.texture;
      this.scene.environmentIntensity = 1.2;
      this.textures.push(tex);
    });
    this.loadModels();
    this.bind();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.draw(0);
  }
  private box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    r = 0.15,
    parent: T.Object3D = this.world,
  ) {
    const o = new T.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  private loadModels() {
    const loader = new GLTFLoader();
    for (const [name, url] of [
      ['paddle', '/models/paddle-hero-v2.glb'],
      ['drone', '/models/drone-thief.glb'],
    ])
      loader.load(
        url,
        (asset) => {
          if (this.gone) {
            this.free(asset.scene);
            return;
          }
          asset.scene.traverse((o) => {
            if (o instanceof T.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material]) {
                if (m instanceof T.MeshStandardMaterial)
                  m.envMapIntensity = 0.95;
              }
            }
          });
          if (name === 'paddle') {
            this.freeEntity(this.paddle);
            this.paddle.clear();
            this.paddle.add(asset.scene);
          } else if (name === 'drone') {
            this.droneTemplate = asset.scene;
            asset.scene.traverse((o) => {
              if (o instanceof T.Mesh) {
                this.sharedGeo.add(o.geometry);
                for (const m of Array.isArray(o.material)
                  ? o.material
                  : [o.material])
                  this.sharedMat.add(m);
              }
            });
          }
          this.loaded++;
        },
        undefined,
        () => {
          this.host.dataset.assetWarning = 'A decorative model could not load';
        },
      );
  }
  private bind() {
    const move = (e: PointerEvent) => {
      const r = this.host.getBoundingClientRect(),
        v = new T.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        );
      this.ray.setFromCamera(v, this.camera);
      const p = this.ray.ray.intersectPlane(this.plane, new T.Vector3());
      if (p) this.game.target = p.x / this.world.scale.x;
    };
    const down = (e: PointerEvent) => {
      move(e);
      this.renderer.domElement.focus({ preventScroll: true });
      this.enableAudio();
      if (this.game.mode !== 'menu') this.game.action();
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('button,[role="dialog"],input'))
        return;
      if (
        [
          'ArrowLeft',
          'ArrowRight',
          ' ',
          'a',
          'd',
          'A',
          'D',
          'e',
          'E',
          'p',
          'P',
          'Escape',
        ].includes(e.key)
      ) {
        e.preventDefault();
        this.keys.add(e.key.toLowerCase());
        if (!e.repeat) {
          if (e.key === ' ') {
            this.enableAudio();
            this.game.action();
          }
          if (e.key.toLowerCase() === 'e') this.game.pulse();
          if (e.key.toLowerCase() === 'p' || e.key === 'Escape')
            this.game.pause();
        }
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const blur = () => {
      this.keys.clear();
      if (this.game.mode === 'playing') this.game.pause();
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    this.host.addEventListener('pointermove', move);
    this.host.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    const contextLost = (e: Event) => {
      e.preventDefault();
      blur();
      this.host.dataset.error =
        'Graphics connection interrupted. Reload to recover.';
    };
    this.renderer.domElement.addEventListener('webglcontextlost', contextLost);
    this.cleanups.push(() => {
      this.host.removeEventListener('pointermove', move);
      this.host.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
      this.renderer.domElement.removeEventListener(
        'webglcontextlost',
        contextLost,
      );
    });
  }
  enableAudio() {
    if (!this.audio)
      try {
        this.audio = new AudioContext();
      } catch {}
    if (this.audio?.state === 'suspended') void this.audio.resume();
  }
  setSound(value: boolean) {
    this.sound = value;
    this.enableAudio();
  }
  action() {
    this.enableAudio();
    this.game.action();
    this.renderer.domElement.focus({ preventScroll: true });
  }
  private tone(
    f: number,
    duration = 0.12,
    type: OscillatorType = 'sine',
    volume = 0.025,
  ) {
    if (!this.sound || !this.audio) return;
    const t = this.audio.currentTime,
      o = this.audio.createOscillator(),
      g = this.audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.audio.destination);
    o.start(t);
    o.stop(t + duration);
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    if (w / h < 0.95) {
      this.world.scale.x = 0.75;
      const distance = Math.max(31, 18 / (w / h));
      this.camera.position.set(0, distance, distance * 0.28);
      this.camera.lookAt(0, 0, 0.6);
    } else {
      this.world.scale.x = 1.5;
      const scale = Math.max(1, 1.5 / (w / h));
      this.camera.position.set(0, 22 * scale, 17 * scale);
      this.camera.lookAt(0, 0, 1.25);
    }
    this.camera.updateProjectionMatrix();
    alignArena(this.camera, this.world.scale.x);
  }

  private sync() {
    const alive = new Set<number>();
    for (const br of this.game.bricks) {
      alive.add(br.id);
      let o = this.meshes.get(br.id);
      if (!o) {
        o = new T.Group();
        const m = new T.Mesh(
          this.brickGeo,
          br.id % 3 === 0 ? this.clearBrick : this.brickMaterials[br.row],
        );
        m.castShadow = true;
        m.receiveShadow = true;
        o.add(m);
        const trim = new T.Mesh(this.trimGeo, this.chrome);
        trim.position.y = -0.24;
        o.add(trim);
        const top = new T.Mesh(
          new T.BoxGeometry(1.06, 0.01, 0.012),
          br.burst ? this.glow : this.ceramic,
        );
        top.position.set(0, 0.231, 0.2);
        o.add(top);
        if (br.max > 1) {
          const badge = new T.Mesh(
            new T.BoxGeometry(0.32, 0.015, 0.26),
            this.chrome,
          );
          badge.position.y = 0.234;
          o.add(badge);
        }
        o.position.set(br.x, 0.4, br.z);
        this.world.add(o);
        this.meshes.set(br.id, o);
      }
      o.scale.y = br.hp < br.max ? 0.7 : 1;
    }
    for (const b of this.game.balls) {
      alive.add(b.id);
      let o = this.meshes.get(b.id);
      if (!o) {
        o = new T.Mesh(this.ballGeo, this.ballMaterial);
        o.scale.x = 0.9;
        o.castShadow = true;
        this.world.add(o);
        this.meshes.set(b.id, o);
      }
      o.position.set(b.x, b.captor !== null ? 0.85 : 0.39, b.z);
      if (!b.held) {
        const points = this.trails.get(b.id) ?? [];
        points.unshift(o.position.clone());
        if (points.length > 16) points.pop();
        this.trails.set(b.id, points);
        let line = this.trailMeshes.get(b.id);
        if (!line) {
          line = new T.Line(
            new T.BufferGeometry(),
            new T.LineBasicMaterial({
              color: 0x50dfff,
              transparent: true,
              opacity: 0.65,
              blending: T.AdditiveBlending,
              depthWrite: false,
            }),
          );
          this.world.add(line);
          this.trailMeshes.set(b.id, line);
        }
        line.geometry.dispose();
        line.geometry = new T.BufferGeometry().setFromPoints(points);
      }
    }
    for (const d of this.game.drones) {
      alive.add(d.id);
      let o = this.meshes.get(d.id);
      if (!o) {
        o = new T.Group();
        if (this.droneTemplate) {
          const model = this.droneTemplate.clone();
          model.scale.setScalar(1.6);
          o.add(model);
        } else {
          const body = new T.Mesh(new T.OctahedronGeometry(0.55), this.chrome);
          o.add(body);
        }
        const ring = new T.Mesh(
          new T.TorusGeometry(0.66, 0.023, 6, 40),
          new T.MeshBasicMaterial({ color: 0xf864a1 }),
        );
        ring.rotation.x = -Math.PI / 2;
        o.add(ring);
        this.world.add(o);
        this.meshes.set(d.id, o);
      }
      o.position.set(d.x, 1 + Math.sin(this.clock * 3 + d.phase) * 0.12, d.z);
      o.rotation.y = Math.sin(this.clock + d.phase) * 0.2;
      const ring = o.children[o.children.length - 1];
      ring.scale.setScalar(
        d.ball !== null || d.cargo ? 1.3 + Math.sin(this.clock * 8) * 0.12 : 1,
      );
    }
    for (const drop of this.game.drops) {
      alive.add(drop.id);
      let o = this.meshes.get(drop.id);
      if (!o) {
        o = new T.Group();
        const mat = new T.MeshPhysicalMaterial({
          color: POWER[drop.kind].color,
          metalness: 0.45,
          roughness: 0.15,
          clearcoat: 1,
          emissive: POWER[drop.kind].color,
          emissiveIntensity: 0.3,
        });
        const mesh = new T.Mesh(
          new RoundedBoxGeometry(0.68, 0.3, 0.68, 2, 0.12),
          mat,
        );
        mesh.castShadow = true;
        o.add(mesh);
        const cv = document.createElement('canvas');
        cv.width = 64;
        cv.height = 64;
        const c = cv.getContext('2d')!;
        c.fillStyle = '#092e3b';
        c.font = 'bold 48px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(POWER[drop.kind].glyph, 32, 34);
        const tex = new T.CanvasTexture(cv);
        this.textures.push(tex);
        const label = new T.Mesh(
          new T.PlaneGeometry(0.5, 0.5),
          new T.MeshBasicMaterial({ map: tex, transparent: true }),
        );
        label.rotation.x = -Math.PI / 2;
        label.position.y = 0.16;
        o.add(label);
        o.userData.unique = true;
        this.world.add(o);
        this.meshes.set(drop.id, o);
      }
      o.position.set(drop.x, 0.7 + Math.sin(this.clock * 5) * 0.12, drop.z);
      o.rotation.y = Math.sin(this.clock * 2) * 0.2;
    }
    for (const s of this.game.shots) {
      alive.add(s.id);
      let o = this.meshes.get(s.id);
      if (!o) {
        o = new T.Mesh(new T.CapsuleGeometry(0.045, 0.65, 3, 6), this.glow);
        o.rotation.x = Math.PI / 2;
        this.world.add(o);
        this.meshes.set(s.id, o);
      }
      o.position.set(s.x, 0.4, s.z);
    }
    for (const [id, o] of this.meshes)
      if (!alive.has(id)) {
        this.world.remove(o);
        this.freeEntity(o);
        this.meshes.delete(id);
        const trail = this.trailMeshes.get(id);
        if (trail) {
          this.world.remove(trail);
          trail.geometry.dispose();
          (trail.material as T.Material).dispose();
          this.trailMeshes.delete(id);
        }
        this.trails.delete(id);
      }
    this.paddle.position.x = this.game.paddle;
    this.paddle.scale.x = this.game.width / 3;
    this.paddle.rotation.z = this.reduced
      ? 0
      : -(this.game.target - this.game.paddle) * 0.018;
    this.shield.visible = this.game.shield > 0;
    this.shield.scale.y = 1 + Math.sin(this.clock * 5) * 0.2;
    this.boss.visible = this.game.boss > 0;
    this.boss.position.set(this.game.bossX, 0.9, -9);
    this.boss.rotation.y = this.clock * 0.3;
  }
  private effect(e: FX) {
    const count = this.reduced
      ? 3
      : e.kind === 'brick'
        ? 14
        : e.kind === 'drone'
          ? 24
          : 6;
    if (e.kind === 'pulse') {
      const m = new T.Mesh(
        new T.RingGeometry(0.92, 1, 96),
        new T.MeshBasicMaterial({
          color: e.color,
          transparent: true,
          opacity: 0.65,
          side: T.DoubleSide,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(e.x, 0.2, e.z);
      this.world.add(m);
      this.rings.push({ mesh: m, life: 0.8, max: 0.8 });
      this.tone(160, 0.45, 'triangle', 0.04);
      return;
    }
    this.tone(
      e.kind === 'paddle'
        ? 320
        : e.kind === 'power'
          ? 920
          : e.kind === 'lost'
            ? 110
            : 550 + this.game.combo * 15,
      e.kind === 'power' ? 0.35 : 0.1,
      e.kind === 'drone' ? 'triangle' : 'sine',
    );
    if (this.particles.length > 250) return;
    for (let i = 0; i < count; i++) {
      const mat = new T.MeshPhysicalMaterial({
        color: e.color,
        metalness: 0.5,
        roughness: 0.15,
        transparent: true,
        emissive: e.color,
        emissiveIntensity: 0.25,
      });
      const mesh = new T.Mesh(this.fragmentGeo, mat);
      mesh.position.set(e.x, 0.5, e.z);
      mesh.scale.setScalar(0.7 + Math.random() * 1.7);
      this.world.add(mesh);
      const life = 0.45 + Math.random() * 0.55;
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 4,
        vy: 1 + Math.random() * 3,
        vz: (Math.random() - 0.5) * 4,
        life,
        max: life,
      });
    }
  }
  private draw = (now: number) => {
    if (this.gone) return;
    this.raf = requestAnimationFrame(this.draw);
    const rawDt = this.last ? (now - this.last) / 1000 : 0.016;
    const dt = Math.min(rawDt, 0.05);
    this.last = now;
    this.clock += dt;
    if (this.game.mode !== 'paused') {
      if (this.keys.has('arrowleft') || this.keys.has('a'))
        this.game.target -= dt * 17;
      if (this.keys.has('arrowright') || this.keys.has('d'))
        this.game.target += dt * 17;
      this.game.target = T.MathUtils.clamp(this.game.target, -6.5, 6.5);
      this.game.step(dt);
      for (const e of this.game.events.splice(0)) this.effect(e);
      this.sync();
      for (const p of this.particles) {
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 8 * dt;
        p.mesh.rotation.x += dt * 3;
        (p.mesh.material as T.MeshPhysicalMaterial).opacity = p.life / p.max;
        if (p.life <= 0) {
          this.world.remove(p.mesh);
          (p.mesh.material as T.Material).dispose();
          this.particles = this.particles.filter((o) => o !== p);
        }
      }
      for (const r of this.rings) {
        r.life -= dt;
        r.mesh.scale.setScalar(1 + (1 - r.life / r.max) * 22);
        (r.mesh.material as T.MeshBasicMaterial).opacity =
          (r.life / r.max) * 0.6;
        if (r.life <= 0) {
          this.world.remove(r.mesh);
          r.mesh.geometry.dispose();
          (r.mesh.material as T.Material).dispose();
          this.rings = this.rings.filter((o) => o !== r);
        }
      }
    }
    if (now - this.lastUI > 90) {
      this.onUpdate(this.game.snapshot());
      this.lastUI = now;
      this.host.dataset.fps = String(Math.round(this.fps));
      this.host.dataset.models = String(this.loaded);
    }
    this.frameSum += rawDt;
    this.frameN++;
    if (this.frameSum > 1) {
      this.fps = this.frameN / this.frameSum;
      this.frameSum = 0;
      this.frameN = 0;
    }
    this.composer.render();
  };
  private freeEntity(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        if (!this.sharedGeo.has(o.geometry)) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (!this.sharedMat.has(m)) {
            if (m instanceof T.MeshBasicMaterial && m.map) {
              m.map.dispose();
              this.textures = this.textures.filter((t) => t !== m.map);
            }
            m.dispose();
          }
      }
    });
  }
  private free(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
  }
  dispose() {
    this.gone = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.cleanups.forEach((f) => f());
    this.free(this.scene);
    if (this.droneTemplate) this.free(this.droneTemplate);
    this.env.dispose();
    this.mirror.getRenderTarget().dispose();
    this.textures.forEach((t) => t.dispose());
    this.brickGeo.dispose();
    this.trimGeo.dispose();
    this.fragmentGeo.dispose();
    this.ballGeo.dispose();
    this.composer.passes.forEach((p) => p.dispose());
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    void this.audio?.close();
  }
}
