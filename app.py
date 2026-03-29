"""일기장 Flask 서버 - Supabase backend"""

import os
import uuid
from flask import Flask, request, jsonify, redirect, render_template
from werkzeug.utils import secure_filename

import db

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://veudufwabuaijixzzhxj.supabase.co')
STORAGE_BUCKET = 'diary-photos'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def storage_public_url(filename):
    return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{filename}"


# ── 페이지 ──

@app.route('/')
def index():
    return render_template('index.html')


# ── 일기 API ──

@app.route('/api/entries')
def list_entries():
    month = request.args.get('month', '')
    if not month:
        return jsonify({'error': 'month parameter required'}), 400
    entries = db.get_entries_by_month(month)
    return jsonify(entries)


@app.route('/api/entries/<date>')
def get_entry(date):
    entry = db.get_entry_by_date(date)
    if not entry:
        return jsonify(None), 404
    return jsonify(entry)


@app.route('/api/entries', methods=['POST'])
def save_entry():
    data = request.get_json()
    if not data or not data.get('date'):
        return jsonify({'error': 'date required'}), 400

    tags = [t.strip().lstrip('#') for t in data.get('hashtags', '').split(',') if t.strip()]
    entry_id = db.upsert_entry(
        date=data['date'],
        mood=data.get('mood', ''),
        content=data.get('content', ''),
        tags=tags
    )
    return jsonify({'id': entry_id, 'date': data['date']})


@app.route('/api/entries/<date>', methods=['DELETE'])
def delete_entry(date):
    filenames = db.delete_entry(date)
    # Supabase Storage에서 사진 파일 삭제
    if filenames:
        try:
            client = db._client()
            client.storage.from_(STORAGE_BUCKET).remove(filenames)
        except Exception:
            pass
    return jsonify({'deleted': True})


# ── 사진 API ──

@app.route('/api/entries/<date>/photos', methods=['POST'])
def upload_photos(date):
    entry = db.get_entry_by_date(date)
    if not entry:
        return jsonify({'error': 'save entry first'}), 404

    client = db._client()
    files = request.files.getlist('photos')
    uploaded = []
    for f in files:
        if f and allowed_file(f.filename):
            ext = f.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            file_bytes = f.read()
            content_type = f.content_type or 'image/jpeg'

            client.storage.from_(STORAGE_BUCKET).upload(
                filename,
                file_bytes,
                file_options={"content-type": content_type}
            )
            db.add_photo(entry['id'], filename, secure_filename(f.filename))
            uploaded.append(filename)

    return jsonify({'uploaded': uploaded})


@app.route('/api/photos/<int:photo_id>', methods=['DELETE'])
def delete_photo(photo_id):
    filename = db.delete_photo(photo_id)
    if not filename:
        return jsonify({'error': 'photo not found'}), 404

    try:
        client = db._client()
        client.storage.from_(STORAGE_BUCKET).remove([filename])
    except Exception:
        pass
    return jsonify({'deleted': True})


@app.route('/uploads/<filename>')
def serve_upload(filename):
    """Supabase Storage public URL로 리다이렉트"""
    return redirect(storage_public_url(filename))


# ── 해시태그 API ──

@app.route('/api/hashtags')
def list_hashtags():
    return jsonify(db.get_all_hashtags())


@app.route('/api/hashtags/<tag>')
def entries_by_hashtag(tag):
    return jsonify(db.get_entries_by_hashtag(tag))


# ── 서버 실행 (로컬) ──
if __name__ == '__main__':
    print("diary server: http://localhost:5000")
    app.run(debug=True, port=5000)
