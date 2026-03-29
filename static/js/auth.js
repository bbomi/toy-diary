/* ── PIN 인증 ── */

let pinInput = '';

// 페이지 로드 시 세션 확인
document.addEventListener('DOMContentLoaded', function() {
    const saved = sessionStorage.getItem('diary_token');
    if (saved) {
        showApp();
    }
});

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
            sessionStorage.setItem('diary_token', data.token);
            showApp();
        } else {
            document.getElementById('lockError').textContent = 'wrong password';
            pinInput = '';
            updateDots();
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
    // 인증 완료 후 라우터 시작
    if (typeof startApp === 'function') {
        startApp();
    }
}
