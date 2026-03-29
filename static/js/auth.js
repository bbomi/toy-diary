/* ── PIN 인증 ── */

let pinInput = '';
let authToken = sessionStorage.getItem('diary_token') || '';

// 이미 인증된 세션이면 바로 앱 표시
if (authToken) {
    showApp();
}

function pressKey(num) {
    if (pinInput.length >= 4) return;
    pinInput += num;
    updateDots();

    if (pinInput.length === 4) {
        verifyPin();
    }
}

function pressDelete() {
    pinInput = pinInput.slice(0, -1);
    updateDots();
    document.getElementById('lockError').textContent = '';
}

function updateDots() {
    const dots = document.querySelectorAll('#pinDots .dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < pinInput.length);
    });
}

async function verifyPin() {
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinInput })
        });
        const data = await res.json();

        if (data.ok) {
            authToken = data.token;
            sessionStorage.setItem('diary_token', authToken);
            showApp();
        } else {
            document.getElementById('lockError').textContent = 'wrong password';
            pinInput = '';
            updateDots();
            // 흔들기 애니메이션
            const dots = document.getElementById('pinDots');
            dots.classList.add('shake');
            setTimeout(() => dots.classList.remove('shake'), 500);
        }
    } catch (e) {
        document.getElementById('lockError').textContent = 'connection error';
        pinInput = '';
        updateDots();
    }
}

function showApp() {
    document.getElementById('lockScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}
