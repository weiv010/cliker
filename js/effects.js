/* =========================================================
 * effects.js — 화면 효과 (HTML/CSS 애니메이션)
 * ========================================================= */

const MAX_FLOATERS = 40; // 너무 빠르게 연타해도 화면이 느려지지 않게 개수 제한

/** 누른 위치(x, y)에 "+1" 글자가 떠올랐다 사라지는 효과 */
export function spawnPlusOne(layer, x, y, text = "+1") {
  if (layer.childElementCount >= MAX_FLOATERS) layer.firstElementChild.remove();

  const el = document.createElement("div");
  el.className = "plus-one";
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  // 좌우로 조금씩 다르게 흩어지도록 랜덤 값 전달 (CSS에서 사용)
  el.style.setProperty("--drift", `${Math.round(Math.random() * 60 - 30)}px`);
  el.style.setProperty("--tilt", `${Math.round(Math.random() * 24 - 12)}deg`);
  layer.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

/** 요소를 "통" 튀게 하는 효과 (카운트 숫자에 사용) */
export function bump(el) {
  el.classList.remove("bump");
  void el.offsetWidth; // 애니메이션을 처음부터 다시 시작시키는 트릭
  el.classList.add("bump");
}

/** 잠깐 나타났다 사라지는 알림 메시지 */
let toastTimer;
export function showToast(el, message, ms = 1800) {
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

/** 축하 메시지를 띄울 횟수인지 확인 (10, 50, 100, 200, 500, 1000, 그 뒤로 1000마다) */
export function isMilestone(n) {
  return [10, 50, 100, 200, 500].includes(n) || (n >= 1000 && n % 1000 === 0);
}
