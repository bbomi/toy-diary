/* ── SPA 라우터 + 공통 유틸리티 ── */

const $app = document.getElementById('app');

// 요일 이름
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const MOODS = [
    { key: 'depressed', label: '우울', color: '#6ba3c7' },
    { key: 'angry', label: '화남', color: '#3a3a3a' },
    { key: 'soso', label: '그냥저냥', color: '#e8d44d' },
    { key: 'good', label: '기분좋음', color: '#8ecc6a' },
    { key: 'happy', label: '행복', color: '#f0943a' },
];

// 무드 key로 객체 찾기
function getMood(key) {
    return MOODS.find(m => m.key === key);
}

// 조약돌 SVG 모양 (5가지 비정형 path)
const PEBBLE_PATHS = [
    'M25,4 C38,2 48,8 49,18 C50,30 44,42 32,46 C18,50 6,40 3,28 C0,16 10,6 25,4Z',
    'M22,3 C36,1 50,10 48,24 C46,38 36,48 22,47 C8,46 1,34 2,20 C3,8 12,4 22,3Z',
    'M28,2 C42,4 52,14 48,28 C44,42 30,50 16,46 C4,42 0,26 6,14 C12,4 20,1 28,2Z',
    'M20,5 C34,0 50,8 50,22 C50,36 40,48 26,48 C12,48 2,38 2,24 C2,12 8,6 20,5Z',
    'M26,2 C40,4 50,12 46,28 C42,44 28,50 14,44 C2,38 0,22 8,12 C14,4 20,1 26,2Z',
];

// 날짜 기반으로 조약돌 모양 결정 (같은 날짜는 항상 같은 모양)
function getPebblePath(seed) {
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return PEBBLE_PATHS[Math.abs(hash) % PEBBLE_PATHS.length];
}

// 조약돌 SVG 생성
function pebbleSvg(color, seed) {
    const path = getPebblePath(seed || 0);
    return `<svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
        <path d="${path}" fill="${color}"/>
    </svg>`;
}

// ── API 헬퍼 ──
async function api(path, options = {}) {
    // 인증 토큰 헤더 추가
    const token = sessionStorage.getItem('diary_token') || '';
    options.headers = options.headers || {};
    options.headers['X-Diary-Token'] = token;

    const res = await fetch(path, options);
    if (res.status === 401) {
        sessionStorage.removeItem('diary_token');
        // 잠금화면으로 돌아가기 (리로드 대신)
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('lockScreen').style.display = 'flex';
        return null;
    }
    if (!res.ok && res.status !== 404) {
        throw new Error(`API error: ${res.status}`);
    }
    return res.json();
}

// ── 날짜 포맷 ──
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const month = MONTH_NAMES[d.getMonth()];
    const day = d.getDate();
    const dow = DAY_NAMES[d.getDay()];
    return `${month} ${day}, ${d.getFullYear()} (${dow})`;
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── HTML 이스케이프 ──
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── 라우터 ──
function router() {
    const hash = location.hash || '#/';
    const parts = hash.slice(2).split('/'); // '#/' 제거

    if (parts[0] === '' || parts[0] === undefined) {
        renderCalendar();
    } else if (parts[0] === 'entry' && parts[1]) {
        renderViewer(parts[1]);
    } else if (parts[0] === 'edit' && parts[1]) {
        renderEditor(parts[1]);
    } else if (parts[0] === 'new' && parts[1]) {
        renderEditor(parts[1], true);
    } else if (parts[0] === 'tag' && parts[1]) {
        renderHashtagView(decodeURIComponent(parts[1]));
    } else {
        renderCalendar();
    }
}

// 인증 완료 후 라우터 시작 (auth.js에서 호출)
function startApp() {
    router();
    window.addEventListener('hashchange', router);
}
