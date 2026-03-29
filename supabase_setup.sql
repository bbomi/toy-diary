-- Supabase SQL Editor에서 실행할 테이블 생성 SQL
-- Dashboard > SQL Editor > New query > 아래 전체 복사 붙여넣기 > Run

CREATE TABLE IF NOT EXISTS entries (
    id BIGSERIAL PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    mood TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
    id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hashtags (
    id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    tag TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON hashtags(tag);
CREATE INDEX IF NOT EXISTS idx_hashtags_entry ON hashtags(entry_id);
CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(entry_id);

-- Storage 버킷은 Dashboard > Storage > New bucket에서 생성
-- 이름: diary-photos, Public bucket: ON
