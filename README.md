# 🐰 3D 클리커 (평생학습관 교육용)

아이패드에서 만든 3D 모델(GLB)을 웹에서 보여주고,
**모델을 톡 누를 때마다 숫자가 올라가는** 모바일 웹게임입니다.
백엔드·DB·로그인·npm 빌드 없이 GitHub Pages에 그대로 올려서 사용합니다.

## 주요 기능
- GLB 3D 모델 표시 (크기·위치 자동 맞춤, 모델 안의 애니메이션 자동 재생)
- 마우스 클릭 / 손가락 터치 모두 지원
- 모델을 누르면 카운트 +1 → 숫자가 통통 튀고, 모델이 "꾹" 눌렸다 튕김
- 누른 자리에 **+1** 글자가 떠올랐다 사라짐
- 한 손가락 드래그로 **모든 방향 360도 자유 회전** (손을 떼면 관성으로 조금 더 돔)
- 두 손가락 핀치 / 마우스 휠로 확대·축소
- 소리 고르기: 내 소리(mp3) · 뽁 · 뿅 · 딩 · 쿵 · 띠링 · 끄기
- 10, 50, 100, 200, 500, 1000번… 달성 축하 메시지
- 카운트와 고른 소리는 **그 기기에 자동 저장** (새로고침해도 유지)
- 학생마다 다른 모델·제목·소리·배경 (`?student=001`)

## 파일 구조
```
index.html            화면 뼈대 (Three.js는 CDN에서 불러옴)
css/style.css         디자인 (모바일 세로 기준, 배경 프리셋, 애니메이션)
js/students.js        ★ 학생 목록 — 선생님이 주로 고치는 파일
js/main.js            URL 읽기, 카운트, 소리 고르기, 화면 연결
js/viewer.js          3D 화면: 모델 로드, 회전, 눌림 효과, 터치 판정
js/sound.js           효과음 (mp3 파일 + 파일 없이 나는 기본음)
js/effects.js         +1 글자, 숫자 튀기, 알림 메시지
assets/models/        학생 GLB 파일을 넣는 곳
assets/sounds/        학생 소리 파일을 넣는 곳
assets/backgrounds/   배경 그림(png/jpg/webp)을 넣는 곳
.nojekyll             GitHub Pages가 파일을 그대로 올리도록 하는 빈 파일
```

## 학생 주소
| 주소 | 결과 |
|---|---|
| `https://아이디.github.io/cliker/` | 체험 모드 (기본 토끼) |
| `https://아이디.github.io/cliker/?student=001` | 경진 – 나의 토끼 |
| `?student=1` | `001`로 자동 인식 |
| `?student=999` (목록에 없음) | 체험 모드 + 안내 메시지 |

학생별 주소를 QR코드로 만들어 나눠주면 편합니다.

## 학생 추가하기
1. 파일을 알맞은 폴더에 올립니다.
   - GLB → `assets/models/` · 소리 → `assets/sounds/` · 배경 그림 → `assets/backgrounds/`
   - GitHub 웹에서 올릴 때: 해당 폴더로 들어간 뒤 **Add file → Upload files**
   - 새 폴더를 만들 때: **Add file → Create new file** 에서 이름 칸에 `폴더이름/파일이름` 처럼
     `/` 를 넣으면 폴더가 만들어집니다. (또는 파일 업로드 화면에 폴더째 끌어다 놓기)
2. `js/students.js` 의 `STUDENTS` 목록에 한 덩어리를 추가합니다.
```js
{
  id: "002",
  name: "민수",
  title: "우주 고양이",
  model: "minsu.glb",
  clickSound: "meow.mp3",              // 여러 개: ["meow.mp3", "purr.mp3"], 없으면 null
  background: "space.png",             // 그림 파일, 또는 sky/sunset/forest/night/candy/ocean/paper, 또는 "#ffe4e1"
},
```
- 배경 그림은 세로 화면에 꽉 차게 잘려서 보입니다. 가운데에 중요한 부분이 오게 하고,
  용량은 **1MB 이하**(jpg 또는 webp 권장)면 빨리 열립니다.
- 파일 이름은 **영어 소문자·숫자·`-`·`_`만** 쓰는 것을 권장합니다 (한글·띄어쓰기 X).
- 대소문자를 정확히 맞춰야 합니다 (`Rabbit.GLB` ≠ `rabbit.glb`).
- 모델 파일이 없거나 이름이 틀리면 기본 토끼가 대신 나오고 안내 메시지가 뜹니다.

## GitHub Pages 배포
1. 이 저장소를 GitHub에 올립니다.
2. 저장소 **Settings → Pages → Build and deployment**
   Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save
3. 1~2분 뒤 `https://아이디.github.io/저장소이름/` 에서 열립니다.

## 내 컴퓨터에서 미리 보기
`index.html`을 더블클릭하면 **동작하지 않습니다** (브라우저 보안 정책).
폴더에서 아래 명령을 실행한 뒤 `http://localhost:8000` 을 여세요.
```bash
python3 -m http.server 8000
```

## 아이패드에서 GLB 만들기 팁
- **Nomad Sculpt**: 파일 → 내보내기 → `glTF` 선택, *Binary(.glb)* 켜기
- **Reality Composer / 기타 앱**: USDZ만 된다면 Blender 등에서 GLB로 변환
- 권장 용량: **모델 1개당 10MB 이하** (학생들 휴대폰 데이터·로딩 시간)
  - 폴리곤이 너무 많으면 Nomad의 *Decimate(폴리곤 줄이기)* 사용
  - 텍스처는 1024×1024 정도면 충분
- 색은 정점 색(Vertex Color)이나 재질 색 모두 표시됩니다.

## 소리 파일 팁
- 형식: **mp3** (m4a, wav도 가능), 길이 **1초 이내**의 짧은 소리
- 소리 파일이 없어도 기본 효과음(뽁·뿅·딩·쿵·띠링)은 항상 사용 가능
- 아이폰은 **무음(진동) 모드**면 소리가 나지 않습니다. 옆 스위치를 확인하세요.

## 알아둘 점
- 카운트는 각 기기의 브라우저에만 저장됩니다 (서버 없음). 다른 폰에서는 0부터 시작.
- 사파리 개인정보 보호(비공개) 모드에서는 새로고침하면 카운트가 초기화될 수 있습니다.
- 인터넷 연결이 필요합니다 (Three.js와 글꼴을 CDN에서 불러옴).
- 지원: iOS Safari 16.4 이상, Android Chrome 최신 버전, PC Chrome/Edge/Safari
