"""일기장 데이터베이스 모듈 - Supabase"""

import os
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://veudufwabuaijixzzhxj.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None


def _client():
    """Supabase 클라이언트 반환"""
    global sb
    if not sb:
        key = os.environ.get('SUPABASE_KEY', '')
        if key:
            sb = create_client(SUPABASE_URL, key)
        else:
            raise RuntimeError("SUPABASE_KEY 환경변수가 필요합니다")
    return sb


# ── 일기 CRUD ──

def upsert_entry(date, mood, content, tags):
    """일기 생성 또는 수정 (날짜 기준 upsert). 해시태그도 함께 저장."""
    client = _client()

    # upsert 엔트리
    result = client.table('entries').upsert({
        'date': date,
        'mood': mood,
        'content': content,
        'updated_at': 'now()',
    }, on_conflict='date').execute()

    entry_id = result.data[0]['id']

    # 해시태그 교체
    client.table('hashtags').delete().eq('entry_id', entry_id).execute()
    for tag in tags:
        tag = tag.strip().lstrip('#')
        if tag:
            client.table('hashtags').insert({
                'entry_id': entry_id,
                'tag': tag,
            }).execute()

    return entry_id


def get_entries_by_month(year_month):
    """월별 일기 목록 (달력 + 목록용). year_month: 'YYYY-MM'"""
    client = _client()
    result = client.table('entries') \
        .select('id, date, mood, content') \
        .like('date', f'{year_month}%') \
        .order('date') \
        .execute()

    entries = []
    for r in result.data:
        entries.append({
            'id': r['id'],
            'date': r['date'],
            'mood': r['mood'],
            'preview': (r['content'] or '')[:100],
        })
    return entries


def get_entry_by_date(date):
    """일기 상세 조회 (해시태그 + 사진 포함)"""
    client = _client()
    result = client.table('entries') \
        .select('*') \
        .eq('date', date) \
        .execute()

    if not result.data:
        return None

    entry = result.data[0]

    # 해시태그
    tags_result = client.table('hashtags') \
        .select('tag') \
        .eq('entry_id', entry['id']) \
        .execute()
    entry['hashtags'] = [r['tag'] for r in tags_result.data]

    # 사진
    photos_result = client.table('photos') \
        .select('id, filename, original_name') \
        .eq('entry_id', entry['id']) \
        .execute()
    entry['photos'] = photos_result.data

    return entry


def delete_entry(date):
    """일기 삭제. 삭제된 사진 파일명 목록 반환."""
    client = _client()
    result = client.table('entries') \
        .select('id') \
        .eq('date', date) \
        .execute()

    if not result.data:
        return []

    entry_id = result.data[0]['id']

    # 사진 파일명 수집
    photos = client.table('photos') \
        .select('filename') \
        .eq('entry_id', entry_id) \
        .execute()
    filenames = [r['filename'] for r in photos.data]

    # CASCADE로 해시태그 + 사진 레코드도 삭제됨
    client.table('entries').delete().eq('id', entry_id).execute()

    return filenames


# ── 사진 CRUD ──

def add_photo(entry_id, filename, original_name):
    """사진 레코드 추가"""
    client = _client()
    client.table('photos').insert({
        'entry_id': entry_id,
        'filename': filename,
        'original_name': original_name,
    }).execute()


def delete_photo(photo_id):
    """사진 레코드 삭제. 삭제된 파일명 반환."""
    client = _client()
    result = client.table('photos') \
        .select('filename') \
        .eq('id', photo_id) \
        .execute()

    if not result.data:
        return None

    filename = result.data[0]['filename']
    client.table('photos').delete().eq('id', photo_id).execute()
    return filename


# ── 해시태그 조회 ──

def get_all_hashtags():
    """전체 해시태그 + 사용 횟수"""
    client = _client()
    result = client.table('hashtags') \
        .select('tag') \
        .execute()

    # Python에서 집계
    counts = {}
    for r in result.data:
        tag = r['tag']
        counts[tag] = counts.get(tag, 0) + 1

    return sorted(
        [{'tag': t, 'count': c} for t, c in counts.items()],
        key=lambda x: (-x['count'], x['tag'])
    )


def get_entries_by_hashtag(tag):
    """특정 해시태그가 있는 일기 목록"""
    client = _client()

    # 해당 태그의 entry_id 조회
    tag_result = client.table('hashtags') \
        .select('entry_id') \
        .eq('tag', tag) \
        .execute()

    entry_ids = [r['entry_id'] for r in tag_result.data]
    if not entry_ids:
        return []

    # 해당 엔트리 조회
    result = client.table('entries') \
        .select('id, date, mood, content') \
        .in_('id', entry_ids) \
        .order('date', desc=True) \
        .execute()

    return [{
        'id': r['id'],
        'date': r['date'],
        'mood': r['mood'],
        'preview': (r['content'] or '')[:100],
    } for r in result.data]
