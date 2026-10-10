from bottle import route, run, static_file, request, response, redirect, abort
from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / 'dados.json'

@route('/')
def index():
    return redirect('/ira/')

@route('/ira')
@route('/ira/')
@route('/intercambio')
@route('/intercambio/')
@route('/intercambio/<edital>')
@route('/intercambio/<edital>/')
def pagina(edital=None):
    pasta = 'ira' if request.path.startswith('/ira') else 'intercambio'
    if edital:
        pasta += '/' + edital
    arquivo = ROOT / pasta / 'index.html'
    if not arquivo.is_file() or not arquivo.resolve().is_relative_to(ROOT):
        abort(404, 'Página não encontrada')
    if not request.path.endswith('/'):
        return redirect(request.path + '/')
    resp = static_file(pasta + '/index.html', root=str(ROOT))
    resp.set_header('Cache-Control', 'no-cache, no-store, must-revalidate')
    resp.set_header('Pragma', 'no-cache')
    resp.set_header('Expires', '0')
    return resp

@route('/css/<filename>')
def serve_css(filename):
    """Serve arquivos CSS."""
    return static_file(filename, root=str(ROOT / 'css'))

@route('/js/<filename>')
def serve_js(filename):
    """Serve arquivos JavaScript."""
    return static_file(filename, root=str(ROOT / 'js'))

@route('/data/editais/<filename>')
def serve_edital(filename):
    resp = static_file(filename, root=str(ROOT / 'data' / 'editais'))
    resp.set_header('Cache-Control', 'no-cache')
    return resp

@route('/save', method='POST')
def save_data():
    """Salva dados no arquivo JSON (backup local)."""
    try:
        data = request.json
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return {"status": "success"}
    except Exception as e:
        response.status = 500
        return {"status": "error", "message": str(e)}

@route('/load', method='GET')
def load_data():
    """Carrega dados do arquivo JSON."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

if __name__ == '__main__':
    print('Servidor rodando em http://localhost:8080')
    run(host='localhost', port=8080, debug=True, reloader=True)
