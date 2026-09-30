/* =========================================================
 * main.js — 앱 시작점
 * ---------------------------------------------------------
 *  1) URL의 ?student=번호 를 읽어 학생 설정을 찾는다
 *  2) 제목·배경·모델·소리를 학생 설정대로 준비한다
 *  3) 모델을 탭하면 카운트 +1, 소리, +1 효과를 실행한다
 *  4) 카운트와 고른 소리는 이 기기(브라우저)에 저장된다
 * ========================================================= */
import { STUDENTS, DEMO_STUDENT } from "./students.js";
import { ModelViewer, createPlaceholderBunny } from "./viewer.js";
import { SoundPlayer, SOUND_OPTIONS } from "./sound.js";
import { spawnPlusOne, bump, showToast, isMilestone } from "./effects.js";

const MODEL_DIR = "assets/models/";
const SOUND_DIR = "assets/sounds/";
const BG_PRESETS = ["sky", "sunset", "forest", "night", "candy", "ocean", "paper"];

// 자주 쓰는 화면 요소
const $ = (id) => document.getElementById(id);
const ui = {
  title: $("title"),
  name: $("student-name"),
  count: $("count"),
  stage: $("stage"),
  fx: $("fx-layer"),
  hint: $("hint"),
  loading: $("loading"),
  loadingText: $("loading-text"),
  toast: $("toast"),
  soundBtn: $("sound-btn"),
  soundSheet: $("sound-sheet"),
  soundList: $("sound-list"),
  resetBtn: $("reset-btn"),
};

/* ---------------------------------------------------------
 * 1) URL에서 학생 찾기
 *    ?student=001  → "001"
 *    ?student=1    → "001" 로 자동 보정 (숫자면 3자리로 맞춤)
 *    없거나 목록에 없으면 → 체험(demo) 학생
 * ------------------------------------------------------- */
function getStudentFromURL() {
  const raw = new URLSearchParams(location.search).get("student");
  if (!raw) return { student: DEMO_STUDENT, missingId: null };

  let id = raw.trim();
  if (/^\d+$/.test(id)) id = id.padStart(3, "0");
  const found = STUDENTS.find((s) => String(s.id) === id);
  return found ? { student: found, missingId: null } : { student: DEMO_STUDENT, missingId: raw };
}

/* ---------------------------------------------------------
 * 브라우저 저장소 (사생활 보호 모드 등에서 실패해도 앱은 동작하도록)
 * ------------------------------------------------------- */
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 저장 실패는 무시 */ }
  },
};

/* ---------------------------------------------------------
 * 2) 학생 설정 적용
 * ------------------------------------------------------- */
const { student, missingId } = getStudentFromURL();
const COUNT_KEY = `clicker:count:${student.id}`;
const SOUND_KEY = `clicker:sound:${student.id}`;

document.title = `${student.title} · 3D 클리커`;
ui.title.textContent = student.title;
ui.name.textContent = student.id === DEMO_STUDENT.id ? "체험 모드" : `${student.name}의 작품`;

// 배경: 이름이 프리셋이면 CSS 클래스로, 아니면 CSS 색상 값으로 바로 적용
const bg = student.background || "sky";
if (BG_PRESETS.includes(bg)) {
  document.body.dataset.bg = bg;
} else {
  document.body.dataset.bg = "custom";
  document.body.style.background = bg;
}

if (missingId) {
  setTimeout(() => showToast(ui.toast, `'${missingId}' 번 학생을 찾지 못해 체험 모드로 열었어요`, 3500), 400);
}

/* ---------------------------------------------------------
 * 카운트
 * ------------------------------------------------------- */
let count = parseInt(store.get(COUNT_KEY), 10) || 0;
ui.count.textContent = count.toLocaleString();

function addCount(x, y) {
  count += 1;
  ui.count.textContent = count.toLocaleString();
  store.set(COUNT_KEY, count);

  bump(ui.count); // 숫자 통통
  spawnPlusOne(ui.fx, x, y); // 누른 위치에 +1
  sound.play(currentSound); // 효과음
  navigator.vibrate?.(8); // 안드로이드에서는 살짝 진동 (아이폰은 지원 안 함)

  if (isMilestone(count)) showToast(ui.toast, `🎉 ${count.toLocaleString()}번 달성!`);
}

ui.resetBtn.addEventListener("click", () => {
  if (!confirm("카운트를 0으로 되돌릴까요?")) return;
  count = 0;
  ui.count.textContent = "0";
  store.set(COUNT_KEY, 0);
  closeSoundSheet();
});

/* ---------------------------------------------------------
 * 3) 3D 뷰어 + 모델 불러오기
 * ------------------------------------------------------- */
const viewer = new ModelViewer(ui.stage, {
  onTap: addCount,
  onInteract: () => ui.hint.classList.add("hide"), // 처음 만지면 안내 문구 숨김
});

async function loadStudentModel() {
  if (!student.model) {
    viewer.setModel(createPlaceholderBunny()); // 체험용 기본 토끼
    return;
  }
  try {
    await viewer.loadModel(MODEL_DIR + student.model, (ratio) => {
      ui.loadingText.textContent = ratio == null
        ? "모델 불러오는 중…"
        : `모델 불러오는 중… ${Math.round(ratio * 100)}%`;
    });
  } catch (err) {
    console.error(err);
    viewer.setModel(createPlaceholderBunny());
    showToast(ui.toast, `모델 파일(${student.model})을 찾지 못해 기본 토끼를 보여줘요`, 4000);
  }
}

/* ---------------------------------------------------------
 * 소리 고르기
 * ------------------------------------------------------- */
const sound = new SoundPlayer();
let hasStudentSound = false;
let currentSound = "pop";

// 모바일은 첫 터치 때 오디오를 깨워야 소리가 난다
const unlockAudio = () => sound.unlock();
document.addEventListener("pointerdown", unlockAudio);
document.addEventListener("touchend", unlockAudio);

async function setupSound() {
  if (student.clickSound) {
    hasStudentSound = await sound.loadFile("student", SOUND_DIR + student.clickSound);
  }
  // 저장해 둔 선택 → 없으면 학생 소리 → 없으면 "뽁"
  const saved = store.get(SOUND_KEY);
  const available = SOUND_OPTIONS.filter((o) => o.id !== "student" || hasStudentSound).map((o) => o.id);
  currentSound = available.includes(saved) ? saved : hasStudentSound ? "student" : "pop";
  renderSoundList();
}

function renderSoundList() {
  ui.soundList.innerHTML = "";
  for (const opt of SOUND_OPTIONS) {
    if (opt.id === "student" && !hasStudentSound) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sound-option" + (opt.id === currentSound ? " selected" : "");
    btn.innerHTML = `<span class="emoji">${opt.emoji}</span><span>${opt.label}</span>`;
    btn.addEventListener("click", () => {
      currentSound = opt.id;
      store.set(SOUND_KEY, opt.id);
      sound.unlock();
      sound.play(opt.id); // 고르면 바로 미리 듣기
      renderSoundList();
    });
    ui.soundList.appendChild(btn);
  }
  const cur = SOUND_OPTIONS.find((o) => o.id === currentSound);
  ui.soundBtn.innerHTML = `<span class="emoji">${cur.emoji}</span> 소리: ${cur.label}`;
}

function openSoundSheet() { ui.soundSheet.classList.add("open"); }
function closeSoundSheet() { ui.soundSheet.classList.remove("open"); }
ui.soundBtn.addEventListener("click", openSoundSheet);
ui.soundSheet.addEventListener("click", (e) => {
  // 바깥(어두운 부분)이나 닫기 버튼을 누르면 닫기
  if (e.target === ui.soundSheet || e.target.closest("[data-close]")) closeSoundSheet();
});

/* ---------------------------------------------------------
 * 아이폰 Safari에서 두 손가락 확대 시 페이지 전체가 확대되는 것 방지
 * ------------------------------------------------------- */
document.addEventListener("gesturestart", (e) => e.preventDefault());

/* ---------------------------------------------------------
 * 시작!
 * ------------------------------------------------------- */
Promise.all([loadStudentModel(), setupSound()]).finally(() => {
  ui.loading.classList.add("hide");
});
