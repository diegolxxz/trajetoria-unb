"""Regressões de caminhos, armazenamento privado e execução dos comandos."""

from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch
from wsgiref.util import setup_testing_defaults

from bottle import default_app
from server import route


PROJECT = Path(__file__).resolve().parents[1]


def request(path, data=None):
    env = {}
    setup_testing_defaults(env)
    env["PATH_INFO"] = path
    if data is not None:
        body = json.dumps(data).encode()
        env.update(REQUEST_METHOD="POST", CONTENT_TYPE="application/json", CONTENT_LENGTH=str(len(body)))
        env["wsgi.input"] = BytesIO(body)
    result = {}

    def start(status, headers, exc_info=None):
        result["status"] = int(status.split()[0])

    response = default_app()(env, start)
    try:
        result["body"] = b"".join(response)
    finally:
        if hasattr(response, "close"):
            response.close()
    return result


def test_history_uses_private_directory_and_creates_it(tmp_path):
    target = tmp_path / "local" / "dados.json"
    data = {"periodos": [{"disciplinas": []}]}
    with patch.object(route, "DATA_FILE", target):
        assert request("/load")["body"] == b"{}"
        assert request("/save", data)["status"] == 200
        assert json.loads(target.read_text(encoding="utf-8")) == data
        assert json.loads(request("/load")["body"]) == data
        before = target.read_bytes()
        assert request("/save", ["invalid"])["status"] == 400
        assert target.read_bytes() == before
    assert list(target.parent.iterdir()) == [target]


def test_private_files_are_not_served():
    for path in ["/local/dados.json", "/dados.json", "/server/route.py", "/references/classroom_code_units.json"]:
        assert request(path)["status"] == 404


def test_public_and_history_roots_are_independent_of_working_directory(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    assert route.ROOT == PROJECT / "public"
    assert route.DATA_FILE == PROJECT / "local" / "dados.json"
    assert request("/")["body"] == (PROJECT / "public/index.html").read_bytes()
    assert request("/data/turmas/index.json")["status"] == 200


def test_all_python_commands_start_from_another_directory(tmp_path):
    commands = [PROJECT / "server/route.py", *sorted((PROJECT / "scripts/scrapers").glob("*.py"))]
    for script in commands:
        completed = subprocess.run(
            [sys.executable, str(script), "--help"], cwd=tmp_path, capture_output=True, timeout=30
        )
        assert completed.returncode == 0, f"{script.name}: {completed.stderr!r}"
        assert b"usage:" in completed.stdout
