/* =========================================================
 * viewer.js — Three.js 3D 뷰어
 * ---------------------------------------------------------
 *  - GLB 모델 불러오기 (크기/위치 자동 맞춤)
 *  - 한 손가락(또는 마우스) 드래그 → 모든 방향 360도 자유 회전 + 관성
 *  - 두 손가락 핀치 / 마우스 휠 → 확대·축소
 *  - 짧게 탭(클릭) → 모델에 맞았는지 검사 후 onTap 호출
 *  - 탭할 때 모델이 "꾹" 눌렸다가 튕겨 돌아오는 스프링 애니메이션
 * ========================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ----- 조작 감도 설정 -----
const TAP_MOVE_LIMIT = 10; // 이 픽셀보다 적게 움직이면 "탭"으로 인정
const TAP_TIME_LIMIT = 500; // 이 시간(ms)보다 짧게 누르면 "탭"으로 인정
const ROTATE_SPEED = 0.009; // 드래그 1px 당 회전 각도(라디안)
const INERTIA_DAMPING = 4; // 손을 뗀 뒤 회전이 멈추는 속도 (클수록 빨리 멈춤)
const ZOOM_MIN = 0.55; // 가장 가까이
const ZOOM_MAX = 2.2; // 가장 멀리
const HIT_SPHERE_RADIUS = 0.6; // 모델 가운데 이만큼은 빈틈이 있어도 터치로 인정 (아이들용 여유)

// DRACO 압축 GLB 해제용 파일 (CDN)
const DRACO_PATH = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/";

export class ModelViewer {
  /**
   * @param {HTMLElement} container 캔버스를 넣을 요소
   * @param {{onTap?: Function, onInteract?: Function}} callbacks
   *   onTap(x, y)   : 모델을 탭했을 때 (화면 좌표)
   *   onInteract()  : 사용자가 처음 화면을 만졌을 때 (안내 문구 숨기기 등)
   */
  constructor(container, { onTap, onInteract } = {}) {
    this.container = container;
    this.onTap = onTap;
    this.onInteract = onInteract;

    // ----- 렌더러: 배경은 투명하게 해서 CSS 배경이 보이도록 -----
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 폰 발열/성능을 위해 최대 2배
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    container.appendChild(this.canvas);

    // ----- 장면, 카메라, 조명 -----
    this.scene = new THREE.Scene();

    // 반사 재질(금속 등)이 까맣게 보이지 않도록 은은한 실내 환경광 추가
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.zoom = 1;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);

    // ----- 모델을 담는 그룹 구조 -----
    // squash(눌림 효과, 항상 화면 기준 위아래로 찌그러짐)
    //   └ pivot(드래그 회전)
    //       └ model(불러온 GLB)
    this.squash = new THREE.Group();
    this.pivot = new THREE.Group();
    this.squash.add(this.pivot);
    this.scene.add(this.squash);
    this.model = null;
    this.mixer = null; // GLB 안에 애니메이션이 있으면 재생

    // ----- 상태 값 -----
    this.press = 0; // 눌림 정도 (음수 = 납작)
    this.pressVel = 0; // 눌림 속도 (스프링 계산용)
    this.spinVel = new THREE.Vector2(); // 관성 회전 속도 (px/ms)
    this.pointers = new Map(); // 현재 화면을 누르고 있는 손가락들
    this.pinched = false; // 이번 터치에서 핀치 줌을 했는지
    this.raycaster = new THREE.Raycaster();
    this.hitSphere = new THREE.Sphere(new THREE.Vector3(), HIT_SPHERE_RADIUS);
    this.clock = new THREE.Clock();

    // ----- GLB 로더 (DRACO / Meshopt 압축 파일도 지원) -----
    const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
    this.loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

    this._bindEvents();

    // 화면 크기가 바뀌면(회전, 주소창 숨김 등) 캔버스 크기 다시 맞춤
    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();

    // 매 프레임 그리기
    this.renderer.setAnimationLoop(() => this._tick());
  }

  /* -------------------------------------------------------
   * 모델 불러오기
   * ----------------------------------------------------- */

  /** GLB 파일을 불러와 화면에 표시. onProgress(0~1 또는 null) */
  async loadModel(url, onProgress) {
    const gltf = await this.loader.loadAsync(url, (e) => {
      onProgress?.(e.total ? e.loaded / e.total : null);
    });
    this.setModel(gltf.scene);

    // GLB 안에 움직임(애니메이션)이 들어 있으면 반복 재생
    if (gltf.animations?.length) {
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      gltf.animations.forEach((clip) => this.mixer.clipAction(clip).play());
    }
  }

  /** 3D 객체를 화면 가운데에 알맞은 크기로 배치 */
  setModel(object) {
    if (this.model) this.pivot.remove(this.model);
    this.mixer = null;

    // 모델마다 크기와 원점이 제각각이므로
    // "반지름 1인 공" 안에 딱 들어가도록 크기와 위치를 자동 조정
    const fit = new THREE.Group();
    fit.add(object);
    const sphere = new THREE.Box3().setFromObject(fit).getBoundingSphere(new THREE.Sphere());
    const scale = 1 / (sphere.radius || 1);
    fit.scale.setScalar(scale);
    fit.position.copy(sphere.center).multiplyScalar(-scale);

    this.model = new THREE.Group();
    this.model.add(fit);
    this.pivot.add(this.model);
    this.pivot.quaternion.identity(); // 회전 초기화
  }

  /* -------------------------------------------------------
   * 터치 / 마우스 입력
   * Pointer Events 하나로 마우스·터치·펜을 모두 처리
   * ----------------------------------------------------- */
  _bindEvents() {
    const c = this.canvas;

    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId); // 손가락이 캔버스 밖으로 나가도 계속 추적
      const now = performance.now();
      this.pointers.set(e.pointerId, {
        startX: e.clientX, startY: e.clientY,
        x: e.clientX, y: e.clientY,
        startTime: now, lastMove: now,
        dragging: false,
      });
      this.spinVel.set(0, 0); // 잡으면 관성 회전 멈춤

      if (this.pointers.size === 2) {
        // 두 손가락 → 핀치 줌 시작점 기록
        this.pinchStartDist = this._pointerDistance();
        this.pinchStartZoom = this.zoom;
      }
      this.onInteract?.();
    });

    c.addEventListener("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const now = performance.now();
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      const dt = Math.max(now - p.lastMove, 1);
      p.x = e.clientX;
      p.y = e.clientY;
      p.lastMove = now;

      // --- 두 손가락: 핀치 줌 ---
      if (this.pointers.size >= 2) {
        const ratio = this.pinchStartDist / Math.max(this._pointerDistance(), 1);
        if (Math.abs(ratio - 1) > 0.06) this.pinched = true; // 살짝 떨린 건 무시
        if (this.pinched) this._setZoom(this.pinchStartZoom * ratio);
        return;
      }

      // --- 한 손가락: 일정 거리 이상 움직이면 드래그(회전)로 전환 ---
      if (!p.dragging) {
        const moved = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
        if (moved < TAP_MOVE_LIMIT) return;
        p.dragging = true;
      }
      this._rotate(dx, dy);
      this.spinVel.set(dx / dt, dy / dt); // 손 뗄 때 관성으로 이어서 회전
    });

    const release = (e, cancelled) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      const now = performance.now();

      // 짧게 누르고 거의 안 움직였으면 = 탭
      const isTap = !cancelled && !p.dragging && !this.pinched && now - p.startTime < TAP_TIME_LIMIT;
      if (isTap && this._hitTest(e.clientX, e.clientY)) {
        this.pressVel -= 4.5; // 눌림 애니메이션 시작
        this.onTap?.(e.clientX, e.clientY);
      }

      // 멈춘 채로 손을 떼면 관성 회전 없음
      if (now - p.lastMove > 80) this.spinVel.set(0, 0);
      if (this.pointers.size === 0) this.pinched = false;
    };
    c.addEventListener("pointerup", (e) => release(e, false));
    c.addEventListener("pointercancel", (e) => release(e, true));

    // 마우스 휠 확대·축소 (PC)
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this._setZoom(this.zoom * Math.exp(e.deltaY * 0.001));
    }, { passive: false });

    // 우클릭 메뉴 / 길게 누르기 메뉴 막기
    c.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _pointerDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /**
   * 드래그 방향대로 모델 회전.
   * 화면 기준 세로축(Y)·가로축(X)으로 누적 회전시키므로
   * 위아래·좌우 어느 방향으로도 360도 자유롭게 돌아간다.
   */
  _rotate(dx, dy) {
    const q = _tmpQuat;
    q.setFromAxisAngle(_axisY, dx * ROTATE_SPEED);
    this.pivot.quaternion.premultiply(q);
    q.setFromAxisAngle(_axisX, dy * ROTATE_SPEED);
    this.pivot.quaternion.premultiply(q);
  }

  _setZoom(z) {
    this.zoom = THREE.MathUtils.clamp(z, ZOOM_MIN, ZOOM_MAX);
    this._updateCamera();
  }

  /** 화면 좌표(x, y)를 눌렀을 때 모델에 닿았는지 검사 */
  _hitTest(clientX, clientY) {
    if (!this.model) return false;
    const rect = this.canvas.getBoundingClientRect();
    _ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(_ndc, this.camera);

    // 1) 실제 모델 표면에 닿았는지
    if (this.raycaster.intersectObject(this.model, true).length > 0) return true;
    // 2) 모델 중심 근처(작은 구)는 틈이 있어도 인정 → 어린이도 잘 눌리게
    return this.raycaster.ray.intersectsSphere(this.hitSphere);
  }

  /* -------------------------------------------------------
   * 화면 크기 / 카메라
   * ----------------------------------------------------- */
  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._updateCamera();
  }

  /** 세로 화면에서도 모델(반지름 1)이 잘리지 않도록 카메라 거리 계산 */
  _updateCamera() {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fitDistance = 1.2 / Math.sin(Math.min(vFov, hFov) / 2);
    this.camera.position.set(0, 0, fitDistance * this.zoom);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /* -------------------------------------------------------
   * 매 프레임 실행
   * ----------------------------------------------------- */
  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05); // 탭 전환 등으로 멈췄다 와도 튀지 않게
    const t = this.clock.elapsedTime;

    // --- 관성 회전 (손을 뗀 뒤 서서히 멈춤) ---
    if (this.pointers.size === 0 && this.spinVel.lengthSq() > 1e-6) {
      const ms = dt * 1000;
      this._rotate(this.spinVel.x * ms, this.spinVel.y * ms);
      this.spinVel.multiplyScalar(Math.exp(-INERTIA_DAMPING * dt));
    }

    // --- 눌림 스프링 애니메이션 ---
    // 용수철처럼: 원래 모양(0)으로 돌아가려는 힘 + 흔들림을 줄이는 마찰
    const stiffness = 320;
    const damping = 13;
    this.pressVel += (-stiffness * this.press - damping * this.pressVel) * dt;
    this.press = THREE.MathUtils.clamp(this.press + this.pressVel * dt, -0.3, 0.3);
    const p = this.press;
    // 위아래로 납작해지면 옆으로 퍼지게 (부피감 유지)
    this.squash.scale.set(1 - p * 0.6, 1 + p, 1 - p * 0.6);

    // --- 가만히 있을 때 살짝 둥실둥실 ---
    this.squash.position.y = Math.sin(t * 1.6) * 0.03;

    this.mixer?.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

// 매 프레임 새로 만들지 않도록 재사용하는 임시 객체
const _tmpQuat = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _ndc = new THREE.Vector2();

/* =========================================================
 * GLB 파일이 없을 때(체험 모드, 파일 누락) 보여줄 기본 토끼
 * 간단한 도형(구, 캡슐)을 조합해서 만든다.
 * ========================================================= */
export function createPlaceholderBunny() {
  const bunny = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xfff6f2, roughness: 0.55 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xffa3c2, roughness: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.2 });

  const add = (geo, mat, [x, y, z], scale = [1, 1, 1], rotZ = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(...scale);
    m.rotation.z = rotZ;
    bunny.add(m);
    return m;
  };

  add(new THREE.SphereGeometry(0.7, 40, 32), white, [0, -0.45, 0], [1, 0.9, 0.9]); // 몸통
  add(new THREE.SphereGeometry(0.52, 40, 32), white, [0, 0.4, 0.1]); // 머리
  for (const side of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.13, 0.6, 8, 16), white, [side * 0.2, 1.1, 0], [1, 1, 0.7], -side * 0.15); // 귀
    add(new THREE.CapsuleGeometry(0.07, 0.45, 8, 16), pink, [side * 0.2, 1.1, 0.07], [1, 1, 0.5], -side * 0.15); // 귀 안쪽
    add(new THREE.SphereGeometry(0.065, 16, 12), black, [side * 0.19, 0.48, 0.55]); // 눈
    add(new THREE.SphereGeometry(0.09, 16, 12), pink, [side * 0.3, 0.3, 0.5], [1, 0.6, 0.4]); // 볼터치
    add(new THREE.SphereGeometry(0.2, 20, 16), white, [side * 0.35, -1.05, 0.35], [1, 0.6, 1.4]); // 발
  }
  add(new THREE.SphereGeometry(0.055, 16, 12), pink, [0, 0.36, 0.62]); // 코
  add(new THREE.SphereGeometry(0.2, 20, 16), white, [0, -0.5, -0.66]); // 꼬리
  return bunny;
}
