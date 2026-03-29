/* ── 달력 & 목록 뷰 ── */

let calendarYear, calendarMonth;
let currentView = 'calendar';
let listOnlyDiary = false;

// 공통 헤더: 월 네비게이션 + 오른쪽 뷰 전환 아이콘
function viewHeader() {
    const calIcon = currentView === 'calendar' ? 'active' : '';
    const listIcon = currentView === 'list' ? 'active' : '';

    return `
        <div class="view-header">
            <div class="calendar-nav">
                <button onclick="navMonth(-1)">&larr;</button>
                <span class="month-label">${MONTH_NAMES[calendarMonth - 1]} ${calendarYear}</span>
                <button onclick="navMonth(1)">&rarr;</button>
            </div>
            <div class="view-icons">
                <button class="view-icon-btn ${calIcon}" onclick="switchView('calendar')" title="Calendar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                </button>
                <button class="view-icon-btn ${listIcon}" onclick="switchView('list')" title="List">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                        <line x1="8" y1="18" x2="21" y2="18"/>
                        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                        <line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

async function renderCalendar(year, month) {
    const now = new Date();
    calendarYear = year || calendarYear || now.getFullYear();
    calendarMonth = month || calendarMonth || (now.getMonth() + 1);

    if (currentView === 'list') {
        await renderListView();
    } else {
        await renderCalendarView();
    }
}

// ── 달력 뷰 ──
async function renderCalendarView() {
    const monthStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
    const [entries, hashtags] = await Promise.all([
        api(`/api/entries?month=${monthStr}`),
        api('/api/hashtags')
    ]);

    const moodMap = {};
    entries.forEach(e => { moodMap[e.date] = e.mood; });

    const today = todayStr();
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    let html = viewHeader();
    html += `<div class="calendar-grid">`;

    DAY_NAMES.forEach(d => {
        html += `<div class="day-header">${d}</div>`;
    });

    for (let i = 0; i < firstDay; i++) {
        html += `<div class="day-cell empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const mood = moodMap[dateStr];
        const isToday = dateStr === today;
        const dayOfWeek = new Date(calendarYear, calendarMonth - 1, d).getDay();

        let classes = 'day-cell';
        if (isToday) classes += ' today';
        if (dayOfWeek === 0) classes += ' sunday';
        if (dayOfWeek === 6) classes += ' saturday';
        if (mood) classes += ' has-mood';

        const target = mood !== undefined ? `#/entry/${dateStr}` : `#/new/${dateStr}`;
        const moodObj = getMood(mood);

        html += `
            <div class="${classes}" onclick="location.hash='${target}'">
                ${moodObj ? `<div class="mood-pebble">${pebbleSvg(moodObj.color, dateStr)}</div>` : ''}
                <span class="day-num">${d}</span>
            </div>
        `;
    }

    html += `</div>`;

    if (hashtags.length > 0) {
        html += `<div class="hashtag-cloud"><h3>hashtags</h3><div class="tags">`;
        hashtags.forEach(h => {
            html += `<a class="tag-pill" href="#/tag/${encodeURIComponent(h.tag)}">#${h.tag}<span class="count">${h.count}</span></a>`;
        });
        html += `</div></div>`;
    }

    $app.innerHTML = html;
}

// ── 목록 뷰 ──
async function renderListView() {
    const monthStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
    const entries = await api(`/api/entries?month=${monthStr}`);

    const entryMap = {};
    entries.forEach(e => { entryMap[e.date] = e; });

    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    let html = viewHeader();

    html += `
        <div class="list-filter">
            <label class="checkbox-label">
                <input type="checkbox" id="onlyDiary" ${listOnlyDiary ? 'checked' : ''}
                       onchange="toggleOnlyDiary(this.checked)">
                <span>diary only</span>
            </label>
        </div>
    `;

    html += `<div class="entry-list">`;

    let hasItems = false;

    for (let d = daysInMonth; d >= 1; d--) {
        const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const entry = entryMap[dateStr];
        const dayOfWeek = new Date(calendarYear, calendarMonth - 1, d).getDay();
        const dowName = DAY_NAMES[dayOfWeek];

        if (listOnlyDiary && !entry) continue;

        hasItems = true;
        const moodObj = entry ? getMood(entry.mood) : null;

        if (entry) {
            html += `
                <div class="list-item has-entry" onclick="location.hash='#/entry/${dateStr}'">
                    <div class="list-date">
                        <span class="list-day">${d}</span>
                        <span class="list-dow">${dowName}</span>
                    </div>
                    <div class="list-mood">
                        ${moodObj ? `<div class="list-mood-pebble">${pebbleSvg(moodObj.color, dateStr)}</div>` : ''}
                    </div>
                    <div class="list-content">
                        <div class="list-preview">${escapeHtml(entry.preview || '')}</div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="list-item" onclick="location.hash='#/new/${dateStr}'">
                    <div class="list-date">
                        <span class="list-day">${d}</span>
                        <span class="list-dow">${dowName}</span>
                    </div>
                    <div class="list-mood"></div>
                    <div class="list-content">
                        <div class="list-empty-hint">tap to write</div>
                    </div>
                </div>
            `;
        }
    }

    if (!hasItems) {
        html += `
            <div class="empty-state">
                <div class="emoji">📝</div>
                <p>no entries this month</p>
            </div>
        `;
    }

    html += `</div>`;
    $app.innerHTML = html;
}

function switchView(view) {
    currentView = view;
    renderCalendar(calendarYear, calendarMonth);
}

function toggleOnlyDiary(checked) {
    listOnlyDiary = checked;
    renderListView();
}

function navMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth > 12) { calendarMonth = 1; calendarYear++; }
    if (calendarMonth < 1) { calendarMonth = 12; calendarYear--; }
    renderCalendar(calendarYear, calendarMonth);
}
