"""일기장 데이터베이스 모듈 - SQLite3 CRUD"""

import sqlite3
import os

# Vercel serverless: /tmp 사용, 로컬: data/ 사용
if os.environ.get('VERCEL'):
    DB_PATH = '/tmp/diary.db'
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'diary.db')


def get_connection():
    """DB 연결 생성 (WAL 모드, Row 팩토리)"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """테이블 및 인덱스 생성"""
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS entries (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            date        TEXT NOT NULL UNIQUE,
            mood        TEXT,
            content     TEXT NOT NULL DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            updated_at  TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS photos (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id      INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
            filename      TEXT NOT NULL,
            original_name TEXT,
            created_at    TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS hashtags (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id  INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
            tag       TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
        CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON hashtags(tag);
        CREATE INDEX IF NOT EXISTS idx_hashtags_entry ON hashtags(entry_id);
        CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(entry_id);
    """)
    conn.close()


# ── 일기 CRUD ──

def upsert_entry(date, mood, content, tags):
    """일기 생성 또는 수정 (날짜 기준 upsert). 해시태그도 함께 저장."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        # upsert 엔트리
        cur.execute("""
            INSERT INTO entries (date, mood, content)
            VALUES (?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                mood = excluded.mood,
                content = excluded.content,
                updated_at = datetime('now','localtime')
        """, (date, mood, content))

        entry_id = cur.execute(
            "SELECT id FROM entries WHERE date = ?", (date,)
        ).fetchone()['id']

        # 해시태그 교체 (기존 삭제 후 새로 삽입)
        cur.execute("DELETE FROM hashtags WHERE entry_id = ?", (entry_id,))
        for tag in tags:
            tag = tag.strip().lstrip('#')
            if tag:
                cur.execute(
                    "INSERT INTO hashtags (entry_id, tag) VALUES (?, ?)",
                    (entry_id, tag)
                )

        conn.commit()
        return entry_id
    finally:
        conn.close()


def get_entries_by_month(year_month):
    """월별 일기 목록 (달력 + 목록용). year_month: 'YYYY-MM'"""
    conn = get_connection()
    rows = conn.execute("""
        SELECT id, date, mood, SUBSTR(content, 1, 100) as preview FROM entries
        WHERE date LIKE ? || '%'
        ORDER BY date
    """, (year_month,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_entry_by_date(date):
    """일기 상세 조회 (해시태그 + 사진 포함)"""
    conn = get_connection()
    entry = conn.execute(
        "SELECT * FROM entries WHERE date = ?", (date,)
    ).fetchone()

    if not entry:
        conn.close()
        return None

    entry = dict(entry)
    entry['hashtags'] = [
        r['tag'] for r in conn.execute(
            "SELECT tag FROM hashtags WHERE entry_id = ?", (entry['id'],)
        ).fetchall()
    ]
    entry['photos'] = [
        dict(r) for r in conn.execute(
            "SELECT id, filename, original_name FROM photos WHERE entry_id = ?",
            (entry['id'],)
        ).fetchall()
    ]
    conn.close()
    return entry


def delete_entry(date):
    """일기 삭제. 삭제된 사진 파일명 목록 반환."""
    conn = get_connection()
    entry = conn.execute(
        "SELECT id FROM entries WHERE date = ?", (date,)
    ).fetchone()

    if not entry:
        conn.close()
        return []

    # 삭제 전 사진 파일명 수집
    photos = conn.execute(
        "SELECT filename FROM photos WHERE entry_id = ?", (entry['id'],)
    ).fetchall()
    filenames = [r['filename'] for r in photos]

    # CASCADE로 해시태그 + 사진 레코드도 삭제됨
    conn.execute("DELETE FROM entries WHERE id = ?", (entry['id'],))
    conn.commit()
    conn.close()
    return filenames


# ── 사진 CRUD ──

def add_photo(entry_id, filename, original_name):
    """사진 레코드 추가"""
    conn = get_connection()
    conn.execute(
        "INSERT INTO photos (entry_id, filename, original_name) VALUES (?, ?, ?)",
        (entry_id, filename, original_name)
    )
    conn.commit()
    conn.close()


def delete_photo(photo_id):
    """사진 레코드 삭제. 삭제된 파일명 반환."""
    conn = get_connection()
    row = conn.execute(
        "SELECT filename FROM photos WHERE id = ?", (photo_id,)
    ).fetchone()

    if not row:
        conn.close()
        return None

    filename = row['filename']
    conn.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
    conn.commit()
    conn.close()
    return filename


# ── 해시태그 조회 ──

def get_all_hashtags():
    """전체 해시태그 + 사용 횟수"""
    conn = get_connection()
    rows = conn.execute("""
        SELECT tag, COUNT(*) as count
        FROM hashtags
        GROUP BY tag
        ORDER BY count DESC, tag
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_entries_by_hashtag(tag):
    """특정 해시태그가 있는 일기 목록"""
    conn = get_connection()
    rows = conn.execute("""
        SELECT e.id, e.date, e.mood, SUBSTR(e.content, 1, 100) as preview
        FROM entries e
        JOIN hashtags h ON h.entry_id = e.id
        WHERE h.tag = ?
        ORDER BY e.date DESC
    """, (tag,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
