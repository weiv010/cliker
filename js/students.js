/* =========================================================
 * students.js — 학생별 설정 파일
 * ---------------------------------------------------------
 * 새 학생을 추가하려면 STUDENTS 배열에 { ... } 한 덩어리를 복사해서
 * 붙여넣고 값만 바꾸면 됩니다. (쉼표 , 를 빠뜨리지 않게 주의!)
 *
 *  id         : URL에 쓰는 번호.  예) ?student=001
 *  name       : 학생 이름 (화면에 "경진의 작품" 처럼 표시)
 *  title      : 작품 제목 (화면 맨 위에 크게 표시)
 *  model      : assets/models/ 폴더 안의 GLB 파일 이름
 *               (null 이면 내장된 기본 토끼 모델을 보여줌)
 *  clickSound : assets/sounds/ 폴더 안의 소리 파일 이름 (mp3/wav/m4a)
 *               여러 개면 대괄호로 묶기: ["a.mp3", "b.mp3"] → "내 소리 1, 2"
 *               (null 이면 파일 없이 기본 효과음만 사용)
 *  background : 배경. 세 가지 방법 중 하나
 *               1) 그림 파일: assets/backgrounds/ 폴더의 파일 이름  예) "sky.png"
 *               2) 준비된 이름: sky, sunset, forest, night, candy, ocean, paper
 *               3) CSS 색상: "#ffe4e1" 또는 "linear-gradient(#fff, #fdd)"
 * ========================================================= */

/** student 값이 없거나 목록에 없을 때 보여줄 체험용 설정 */
export const DEMO_STUDENT = {
  id: "demo",
  name: "체험",
  title: "3D 클리커 체험",
  model: null, // "demo.glb" 를 넣고 파일을 올리면 그 모델로 바뀝니다
  clickSound: null,
  background: "sky",
};

/** 학생 목록 */
export const STUDENTS = [
  {
    id: "001",
    name: "경진",
    title: "네모 키캡",
    model: "cliker.glb",
    clickSound: ["blue-switch.mp3", "red-switch.mp3"],
    background: "sky.png",
  },

  // ↓ 새 학생 예시 (앞의 // 를 지우면 사용됩니다)
  // {
  //   id: "002",
  //   name: "민수",
  //   title: "우주 고양이",
  //   model: "minsu.glb",
  //   clickSound: "meow.mp3",
  //   background: "night",
  // },
];
