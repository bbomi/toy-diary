"""일기장 Flask 서버"""

import os
import uuid
from flask import Flask, request, jsonify, send_from_directory, render_template
from werkzeug.utils import secure_filename

import db

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# Vercel serverless: /tmp 사용, 로컬: data/uploads 사용
if os.environ.get('VERCEL'):
    UPLOAD_DIR = '/tmp/uploads'
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'data', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ── 페이지 ──

@app.route('/')
def index():
    return render_template('index.html')


# ── 일기 API ──

@app.route('/api/entries')
def list_entries():
    """월별 일기 목록. ?month=2026-03"""
    month = request.args.get('month', '')
    if not month:
        return jsonify({'error': 'month 파라미터 필요'}), 400
    entries = db.get_entries_by_month(month)
    return jsonify(entries)


@app.route('/api/entries/<date>')
def get_entry(date):
    """일기 상세 조회"""
    entry = db.get_entry_by_date(date)
    if not entry:
        return jsonify(None), 404
    return jsonify(entry)


@app.route('/api/entries', methods=['POST'])
def save_entry():
    """일기 생성/수정"""
    data = request.get_json()
    if not data or not data.get('date'):
        return jsonify({'error': 'date 필수'}), 400

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
    """일기 삭제 (사진 파일도 함께 삭제)"""
    filenames = db.delete_entry(date)
    for f in filenames:
        path = os.path.join(UPLOAD_DIR, f)
        if os.path.exists(path):
            os.remove(path)
    return jsonify({'deleted': True})


# ── 사진 API ──

@app.route('/api/entries/<date>/photos', methods=['POST'])
def upload_photos(date):
    """사진 업로드"""
    entry = db.get_entry_by_date(date)
    if not entry:
        return jsonify({'error': '일기를 먼저 저장하세요'}), 404

    files = request.files.getlist('photos')
    uploaded = []
    for f in files:
        if f and allowed_file(f.filename):
            ext = f.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            f.save(os.path.join(UPLOAD_DIR, filename))
            db.add_photo(entry['id'], filename, secure_filename(f.filename))
            uploaded.append(filename)

    return jsonify({'uploaded': uploaded})


@app.route('/api/photos/<int:photo_id>', methods=['DELETE'])
def delete_photo(photo_id):
    """사진 개별 삭제"""
    filename = db.delete_photo(photo_id)
    if not filename:
        return jsonify({'error': '사진 없음'}), 404

    path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(path):
        os.remove(path)
    return jsonify({'deleted': True})


@app.route('/uploads/<filename>')
def serve_upload(filename):
    """업로드된 사진 서빙"""
    return send_from_directory(UPLOAD_DIR, filename)


# ── 해시태그 API ──

@app.route('/api/hashtags')
def list_hashtags():
    """전체 해시태그 목록"""
    return jsonify(db.get_all_hashtags())


@app.route('/api/hashtags/<tag>')
def entries_by_hashtag(tag):
    """해시태그별 일기 목록"""
    return jsonify(db.get_entries_by_hashtag(tag))


# ── 초기화 (Vercel + 로컬 공용) ──
os.makedirs(UPLOAD_DIR, exist_ok=True)
db.init_db()

# ── 서버 실행 (로컬) ──
if __name__ == '__main__':
    print("diary server: http://localhost:5000")
    app.run(debug=True, port=5000)
