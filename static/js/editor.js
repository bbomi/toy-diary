/* ── 일기 작성/수정 폼 ── */

let pendingFiles = []; // 새로 첨부할 파일
let existingPhotos = []; // 기존 사진 (수정 시)
let allTags = []; // 기존 해시태그 목록 (자동완성용)

async function renderEditor(date, isNew = false) {
    pendingFiles = [];
    existingPhotos = [];

    // 기존 태그 목록 + 일기 데이터 동시 로드
    let entry = null;
    const [tagsData] = await Promise.all([
        api('/api/hashtags'),
        (async () => {
            if (!isNew) {
                entry = await api(`/api/entries/${date}`);
                if (entry) existingPhotos = entry.photos || [];
            }
        })()
    ]);
    allTags = tagsData.map(t => t.tag);

    const mood = entry?.mood || '';
    const content = entry?.content || '';
    const tags = entry?.hashtags?.map(t => '#' + t).join(' ') || '';

    let html = `
        <div class="entry-form">
            <div class="form-date">${formatDate(date)}</div>

            <div class="form-group">
                <label>today's mood</label>
                <div class="mood-selector" id="moodSelector">
                    ${MOODS.map((m, i) =>
                        `<button type="button" class="mood-btn${mood === m.key ? ' selected' : ''}"
                                 onclick="selectMood(this, '${m.key}')">
                            <div class="mood-pebble-icon">${pebbleSvg(m.color, m.key)}</div>
                            <span class="mood-label">${m.label}</span>
                        </button>`
                    ).join('')}
                </div>
                <input type="hidden" id="moodInput" value="${mood}">
            </div>

            <div class="form-group">
                <label>today was...</label>
                <textarea id="contentInput" placeholder="what happened today, conversations, people I met...">${content}</textarea>
            </div>

            <div class="form-group">
                <label>hashtag</label>
                <input type="text" id="tagsInput" value="${tags}" placeholder="#daily #cafe #friends"
                       oninput="updateTagSuggestions()">
                <div class="tag-suggestions" id="tagSuggestions"></div>
            </div>

            <div class="form-group">
                <label>photo</label>
                <div class="photo-upload-area" onclick="document.getElementById('photoFile').click()">
                    + add photo
                </div>
                <input type="file" id="photoFile" multiple accept="image/*" style="display:none"
                       onchange="handleFileSelect(this.files)">
                <div class="photo-previews" id="photoPreviews"></div>
            </div>

            <div class="form-actions">
                <button class="btn btn-primary" onclick="saveEntry('${date}')">save</button>
                <button class="btn btn-secondary" onclick="history.back()">cancel</button>
            </div>
        </div>
    `;

    $app.innerHTML = html;
    renderPhotoPreviews();
    updateTagSuggestions();
}

function selectMood(btn, moodKey) {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('moodInput').value = moodKey;
}

// ── 해시태그 자동완성 ──

function getCurrentTags() {
    const input = document.getElementById('tagsInput');
    if (!input) return [];
    return input.value.split(/[\s,]+/)
        .map(t => t.trim().replace(/^#/, ''))
        .filter(t => t);
}

function updateTagSuggestions() {
    const container = document.getElementById('tagSuggestions');
    if (!container || allTags.length === 0) return;

    const current = getCurrentTags();

    let html = '';
    allTags.forEach(tag => {
        const isUsed = current.includes(tag);
        html += `<button type="button" class="tag-pill${isUsed ? ' used' : ''}"
                         onclick="toggleTag('${tag}')">#${tag}</button>`;
    });
    container.innerHTML = html;
}

function toggleTag(tag) {
    const input = document.getElementById('tagsInput');
    const current = getCurrentTags();

    if (current.includes(tag)) {
        // 제거
        const filtered = current.filter(t => t !== tag);
        input.value = filtered.map(t => '#' + t).join(' ');
    } else {
        // 추가
        const newVal = input.value.trim();
        input.value = newVal ? newVal + ' #' + tag : '#' + tag;
    }
    updateTagSuggestions();
}

// ── 사진 관리 ──

function handleFileSelect(fileList) {
    for (const f of fileList) {
        pendingFiles.push(f);
    }
    renderPhotoPreviews();
}

function renderPhotoPreviews() {
    const container = document.getElementById('photoPreviews');
    if (!container) return;

    let html = '';

    existingPhotos.forEach(p => {
        html += `
            <div class="photo-preview">
                <img src="/uploads/${p.filename}" alt="${p.original_name}">
                <button class="remove-btn" onclick="removeExistingPhoto(${p.id})">&times;</button>
            </div>
        `;
    });

    pendingFiles.forEach((f, i) => {
        const url = URL.createObjectURL(f);
        html += `
            <div class="photo-preview">
                <img src="${url}" alt="${f.name}">
                <button class="remove-btn" onclick="removePendingFile(${i})">&times;</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function removeExistingPhoto(photoId) {
    await api(`/api/photos/${photoId}`, { method: 'DELETE' });
    existingPhotos = existingPhotos.filter(p => p.id !== photoId);
    renderPhotoPreviews();
}

function removePendingFile(index) {
    pendingFiles.splice(index, 1);
    renderPhotoPreviews();
}

async function saveEntry(date) {
    const mood = document.getElementById('moodInput').value;
    const content = document.getElementById('contentInput').value;
    const tagsRaw = document.getElementById('tagsInput').value;

    const tags = tagsRaw.split(/[\s,]+/)
        .map(t => t.trim().replace(/^#/, ''))
        .filter(t => t)
        .join(',');

    // 1) 일기 저장
    await api('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, mood, content, hashtags: tags })
    });

    // 2) 새 사진 업로드
    if (pendingFiles.length > 0) {
        const formData = new FormData();
        pendingFiles.forEach(f => formData.append('photos', f));
        await fetch(`/api/entries/${date}/photos`, {
            method: 'POST',
            body: formData
        });
    }

    location.hash = `#/entry/${date}`;
}
