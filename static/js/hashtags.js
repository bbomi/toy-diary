/* ── 해시태그 필터 뷰 ── */

async function renderHashtagView(tag) {
    const entries = await api(`/api/hashtags/${encodeURIComponent(tag)}`);

    let html = `
        <div class="hashtag-view">
            <h2><span>#${tag}</span> entries</h2>
    `;

    if (entries.length === 0) {
        html += `
            <div class="empty-state">
                <div class="emoji">🏷️</div>
                <p>no entries with this tag</p>
            </div>
        `;
    } else {
        html += `<div class="entry-list">`;
        entries.forEach(e => {
            const preview = e.preview || '';
            html += `
                <div class="entry-card" onclick="location.hash='#/entry/${e.date}'">
                    <div class="card-mood">${pebbleSvg(getMood(e.mood)?.color || '#ccc', e.date)}</div>
                    <div>
                        <div class="card-date">${formatDate(e.date)}</div>
                        <div class="card-preview">${escapeHtml(preview)}</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    html += `
            <br>
            <button class="btn btn-secondary" onclick="location.hash='#/'">back</button>
        </div>
    `;

    $app.innerHTML = html;
}
