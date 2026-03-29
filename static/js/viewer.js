/* ── 일기 상세 보기 ── */

async function renderViewer(date) {
    const entry = await api(`/api/entries/${date}`);

    if (!entry) {
        $app.innerHTML = `
            <div class="empty-state">
                <div class="emoji">📝</div>
                <p>no entry for ${formatDate(date)}</p>
                <br>
                <button class="btn btn-primary" onclick="location.hash='#/new/${date}'">write</button>
                <button class="btn btn-secondary" onclick="location.hash='#/'" style="margin-left:8px">back</button>
            </div>
        `;
        return;
    }

    let html = `<div class="entry-view">`;

    // 날짜 + 무드
    html += `<div class="view-date">${formatDate(date)}</div>`;
    if (entry.mood) {
        const m = getMood(entry.mood);
        if (m) {
            html += `<div class="view-mood">
                <div class="mood-pebble-icon">${pebbleSvg(m.color, date)}</div>
                <span class="mood-label">${m.label}</span>
            </div>`;
        }
    }

    // 본문
    html += `<div class="view-content">${escapeHtml(entry.content)}</div>`;

    // 사진
    if (entry.photos && entry.photos.length > 0) {
        html += `<div class="view-photos">`;
        entry.photos.forEach(p => {
            html += `<img src="/uploads/${p.filename}" alt="${escapeHtml(p.original_name)}"
                         onclick="openPhotoModal('/uploads/${p.filename}')">`;
        });
        html += `</div>`;
    }

    // 해시태그
    if (entry.hashtags && entry.hashtags.length > 0) {
        html += `<div class="view-tags">`;
        entry.hashtags.forEach(tag => {
            html += `<a class="tag-pill" href="#/tag/${encodeURIComponent(tag)}">#${tag}</a>`;
        });
        html += `</div>`;
    }

    // 액션 버튼
    html += `
        <div class="view-actions">
            <button class="btn btn-primary" onclick="location.hash='#/edit/${date}'">edit</button>
            <button class="btn btn-danger" onclick="confirmDelete('${date}')">delete</button>
            <button class="btn btn-secondary" onclick="location.hash='#/'">calendar</button>
        </div>
    `;

    html += `</div>`;
    $app.innerHTML = html;
}

async function confirmDelete(date) {
    if (!confirm('delete this entry?')) return;
    await api(`/api/entries/${date}`, { method: 'DELETE' });
    location.hash = '#/';
}

function openPhotoModal(src) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.innerHTML = `<img src="${src}">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}
