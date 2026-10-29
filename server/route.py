from bottle import route, static_file, request, response, redirect, abort, HTTPResponse, default_app, debug, hook, error
from pathlib import Path
import argparse
import json
import os
import sys
import tempfile
from datetime import datetime
from wsgiref.simple_server import make_server, WSGIRequestHandler

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / "public"
DATA_FILE = PROJECT / "local" / "dados.json"


@hook("after_request")
def cache_local():
    # Local edits must appear on reload, including updated CSS and JavaScript.
    response.set_header("Cache-Control", "no-store")
    if request.path in ("/load", "/save"):
        response.set_header("X-Robots-Tag", "noindex")


@error(404)
def pagina_nao_encontrada(erro):
    response.content_type = "text/html; charset=UTF-8"
    response.set_header("X-Robots-Tag", "noindex")
    return (ROOT / "404.html").read_text(encoding="utf-8")


@route("/")
def index():
    return static_file("index.html", root=str(ROOT))


@route("/turmas")
@route("/turmas/")
@route("/gerador-grade")
@route("/gerador-grade/")
@route("/grade")
@route("/grade/")
@route("/ira")
@route("/ira/")
@route("/intercambio")
@route("/intercambio/")
@route("/intercambio/<edital>")
@route("/intercambio/<edital>/")
def pagina(edital=None):
    pasta = request.path.strip("/").split("/")[0]
    if edital:
        pasta += "/" + edital
    arquivo = ROOT / pasta / "index.html"
    if not arquivo.is_file() or not arquivo.resolve().is_relative_to(ROOT):
        abort(404, "Página não encontrada")
    if not request.path.endswith("/"):
        return redirect(request.path + "/")
    if pasta == "ira":
        html = arquivo.read_text(encoding="utf-8").replace(
            "<head>", '<head>\n    <meta name="sincronizar-arquivo" content="true">', 1
        )
        resp = HTTPResponse(body=html, headers={"Content-Type": "text/html; charset=UTF-8"})
    else:
        resp = static_file(pasta + "/index.html", root=str(ROOT))
    resp.set_header("Cache-Control", "no-cache, no-store, must-revalidate")
    resp.set_header("Pragma", "no-cache")
    resp.set_header("Expires", "0")
    return resp


@route("/favicon.ico")
@route("/favicon.svg")
@route("/favicon-96x96.png")
@route("/apple-touch-icon.png")
@route("/icon-192.png")
@route("/icon-512.png")
@route("/site.webmanifest")
@route("/robots.txt")
@route("/sitemap.xml")
def serve_favicon():
    filename = request.path.lstrip("/")
    types = {
        "favicon.ico": "image/x-icon",
        "favicon.svg": "image/svg+xml",
        "sitemap.xml": "application/xml",
        "robots.txt": "text/plain",
        "site.webmanifest": "application/manifest+json",
    }
    return static_file(filename, root=str(ROOT), mimetype=types.get(filename, True))


@route("/css/<filename>")
def serve_css(filename):
    """Serve arquivos CSS."""
    return static_file(filename, root=str(ROOT / "css"))


@route("/js/<filename>")
def serve_js(filename):
    """Serve arquivos JavaScript."""
    return static_file(filename, root=str(ROOT / "js"))


@route("/data/turmas/<filename>")
def serve_turmas(filename):
    resp = static_file(filename, root=str(ROOT / "data" / "turmas"))
    resp.set_header("Cache-Control", "no-cache")
    return resp


@route("/data/editais/<filename>")
def serve_edital(filename):
    resp = static_file(filename, root=str(ROOT / "data" / "editais"))
    resp.set_header("Cache-Control", "no-cache")
    return resp


@route("/save", method="POST")
def save_data():
    """Salva dados no arquivo JSON (backup local)."""
    try:
        data = request.json
        if not isinstance(data, dict):
            response.status = 400
            return {"status": "error", "message": "O histórico deve ser um objeto JSON."}
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=DATA_FILE.parent, prefix=".historico-", suffix=".tmp", delete=False
            ) as f:
                temporary = Path(f.name)
                json.dump(data, f, ensure_ascii=False, indent=4, allow_nan=False)
            os.replace(temporary, DATA_FILE)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
        return {"status": "success"}
    except Exception as e:
        response.status = 500
        return {"status": "error", "message": str(e)}


@route("/load", method="GET")
def load_data():
    """Carrega dados do arquivo JSON."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                response.status = 500
                print("Histórico inválido em dados.json; arquivo preservado.", file=sys.stderr)
                return {"erro": "Não foi possível ler o histórico local."}
    return {}


def main():
    parser = argparse.ArgumentParser(description="Servidor local do Trajetória Unb, com histórico em dados.json.")
    parser.add_argument("--host", default="127.0.0.1", help="Endereço de escuta (padrão: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8082, help="Porta HTTP (padrão: 8080).")
    parser.add_argument("--debug", action="store_true", help="Exibir detalhes de erros do servidor.")
    parser.add_argument("--quiet", action="store_true", help="Ocultar registros de requisições.")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("A porta deve estar entre 1 e 65535.")
    debug(args.debug)

    class LocalHandler(WSGIRequestHandler):
        def log_request(self, code="-", size="-"):
            if not args.quiet:
                print(f"{datetime.now():%H:%M:%S}  {code}  {self.command} {self.path.split('?')[0]}", flush=True)

    try:
        server = make_server(args.host, args.port, default_app(), handler_class=LocalHandler)
    except OSError as erro:
        print(f"Não foi possível iniciar em {args.host}:{args.port}: {erro}", file=sys.stderr)
        print("Se a porta estiver ocupada, tente: uv run python server/route.py --port 8081", file=sys.stderr)
        return 1
    url_host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
    url = f"http://{url_host}:{args.port}"
    print(
        f"\nTrajetória Unb | servidor local\n\n"
        f"  Início       {url}/\n"
        f"  Calculadora  {url}/ira/\n"
        f"  Intercâmbio  {url}/intercambio/\n"
        f"  Turmas       {url}/turmas/\n"
        f"  Grade        {url}/grade/\n\n"
        f"  Histórico    {DATA_FILE}\n"
        f"  Arquivo      {'encontrado' if DATA_FILE.exists() else 'será criado ao salvar'}\n"
        f"  Debug        {'ativado' if args.debug else 'desativado'}\n\n"
        "Recarregue a página após editar HTML, CSS ou JavaScript.\n"
        "Reinicie o servidor após editar Python. Ctrl+C para encerrar.\n",
        flush=True,
    )
    try:
        with server:
            server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
