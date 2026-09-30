/* =========================================================
 * sound.js — 효과음
 * ---------------------------------------------------------
 * Web Audio API를 사용해 빠르게 연타해도 소리가 늦지 않게 재생한다.
 * (HTML <audio> 태그는 아이폰에서 지연이 크고 겹쳐 재생이 어려움)
 *
 *  - "내 소리"  : 학생이 준비한 mp3 파일 (assets/sounds/)
 *  - 나머지     : 파일 없이 코드로 만든 기본 효과음 (항상 사용 가능)
 * ========================================================= */

/** 기본 소리 목록 (id는 저장/재생에 사용). 학생 소리 파일은 main.js에서 앞에 추가됨 */
export const SOUND_OPTIONS = [
  { id: "pop", label: "뽁", emoji: "🫧" },
  { id: "boing", label: "뿅", emoji: "🐰" },
  { id: "bell", label: "딩", emoji: "🔔" },
  { id: "drum", label: "쿵", emoji: "🥁" },
  { id: "coin", label: "띠링", emoji: "🪙" },
  { id: "off", label: "끄기", emoji: "🔇" },
];

export class SoundPlayer {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    this.buffers = new Map(); // id → 디코딩된 소리 파일
    if (this.ctx) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    }
  }

  /**
   * 모바일 브라우저는 사용자가 화면을 만지기 전에는 소리를 막아둔다.
   * 첫 터치 때 이 함수를 불러 오디오를 깨운다.
   */
  unlock() {
    if (!this.ctx) return;
    if (this.ctx.state !== "running") this.ctx.resume();
    if (!this._unlocked) {
      // 아이폰(구형 Safari)은 무음 소리를 한 번 재생해야 완전히 풀림
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
      this._unlocked = true;
    }
  }

  /** 소리 파일을 미리 불러와 둔다. 성공하면 true */
  async loadFile(id, url) {
    if (!this.ctx) return false;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.arrayBuffer();
      // 구형 Safari 호환을 위해 콜백 방식으로 디코딩
      const buffer = await new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
      this.buffers.set(id, buffer);
      return true;
    } catch (err) {
      console.warn(`소리 파일을 불러오지 못했어요: ${url}`, err);
      return false;
    }
  }

  /** id에 해당하는 소리 재생. 매번 음높이를 살짝 바꿔 덜 지루하게 */
  play(id) {
    if (!this.ctx || id === "off") return;
    if (this.ctx.state !== "running") this.ctx.resume();
    const pitch = 0.94 + Math.random() * 0.12;
    const t = this.ctx.currentTime;

    const buffer = this.buffers.get(id);
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = pitch;
      src.connect(this.master);
      src.start(t);
      return;
    }
    (SYNTHS[id] || SYNTHS.pop)(this.ctx, this.master, t, pitch);
  }
}

/* ---------------------------------------------------------
 * 코드로 만드는 기본 효과음들
 * osc(발진기)로 음을 만들고, gain(볼륨)을 빠르게 줄여 "톡" 소리를 만든다.
 * ------------------------------------------------------- */
function tone(ctx, out, { type = "sine", from, to, start, dur, vol = 0.5 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur * 0.8);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.005); // 빠르게 켜고
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur); // 서서히 끄기
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

const SYNTHS = {
  // 뽁: 높은음에서 빠르게 떨어지는 방울 소리
  pop: (ctx, out, t, p) => tone(ctx, out, { from: 900 * p, to: 180 * p, start: t, dur: 0.12, vol: 0.6 }),

  // 뿅: 아래에서 위로 올라가는 소리
  boing: (ctx, out, t, p) => tone(ctx, out, { from: 260 * p, to: 950 * p, start: t, dur: 0.2, vol: 0.45 }),

  // 딩: 맑은 종소리 (기본음 + 배음)
  bell: (ctx, out, t, p) => {
    tone(ctx, out, { from: 1318 * p, start: t, dur: 0.8, vol: 0.35 });
    tone(ctx, out, { from: 2636 * p, start: t, dur: 0.4, vol: 0.12 });
  },

  // 쿵: 낮게 떨어지는 북소리
  drum: (ctx, out, t, p) => tone(ctx, out, { from: 170 * p, to: 45 * p, start: t, dur: 0.3, vol: 0.9 }),

  // 띠링: 게임 동전 소리 (두 음)
  coin: (ctx, out, t, p) => {
    tone(ctx, out, { type: "square", from: 988 * p, start: t, dur: 0.08, vol: 0.12 });
    tone(ctx, out, { type: "square", from: 1319 * p, start: t + 0.07, dur: 0.28, vol: 0.12 });
  },
};
