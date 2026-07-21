from bottle import route, run, static_file, request, response
import json
import os

DATA_FILE = 'dados.json'

@route('/')
def index():
    """Serve a página principal diretamente da raiz do projeto."""
    resp = static_file('index.html', root='./')
    resp.set_header('Cache-Control', 'no-cache, no-store, must-revalidate')
    resp.set_header('Pragma', 'no-cache')
    resp.set_header('Expires', '0')
    return resp

@route('/css/<filename>')
def serve_css(filename):
    """Serve arquivos CSS."""
    return static_file(filename, root='./css')

@route('/js/<filename>')
def serve_js(filename):
    """Serve arquivos JavaScript."""
    return static_file(filename, root='./js')

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
    print('Servidor rodando em http://localhost:8081')
    run(host='localhost', port=8081, debug=True, reloader=True)
