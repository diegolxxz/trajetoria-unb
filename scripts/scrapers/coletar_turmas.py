"""Coleta pública de unidades e turmas do SIGAA, sem autenticação.

Fluxo e parser adaptados do Followw UnB, do mesmo autor.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
from threading import local
from datetime import datetime, timezone
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import re
import tempfile
import time
import unicodedata
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import HTTPCookieProcessor, Request, build_opener

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SOURCE = "https://sigaa.unb.br/sigaa/public/turmas/listar.jsf"
DATA = ROOT / "public" / "data" / "turmas"


def text(node):
    return " ".join(node.get_text(" ", strip=True).split())


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as file:
            name = file.name
            json.dump(data, file, ensure_ascii=False, indent=2, allow_nan=False)
            file.write("\n")
        os.replace(name, path)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


def parse_units(form):
    select = form.find("select", attrs={"name": "formTurma:inputDepto"})
    if select is None:
        raise ValueError("Seletor de unidades ausente.")
    units = {
        option["value"]: text(option)
        for option in select.find_all("option")
        if str(option.get("value", "")).isdigit() and int(option["value"]) > 0
    }
    if not units or any(not name for name in units.values()):
        raise ValueError("Cadastro de unidades vazio ou inválido.")
    return dict(sorted(units.items(), key=lambda pair: int(pair[0])))


def payload(form, unit, semester):
    values = {}
    for field in form.find_all("input"):
        kind = field.get("type", "text").lower()
        if not field.get("name") or kind in ("submit", "button", "reset", "file", "image"):
            continue
        if kind in ("checkbox", "radio") and not field.has_attr("checked"):
            continue
        values[field["name"]] = field.get("value", "")
    for field in form.find_all("select"):
        option = field.find("option", selected=True) or field.find("option")
        if field.get("name"):
            values[field["name"]] = option.get("value", "") if option else ""
    button = form.find("input", attrs={"type": "submit", "value": "Buscar"})
    if not values.get("javax.faces.ViewState") or button is None or not button.get("name"):
        raise ValueError("Formulário sem ViewState ou botão Buscar; sessão expirada ou layout alterado.")
    year, period = semester.split(".")
    values.update(
        {
            "formTurma:inputDepto": unit,
            "formTurma:inputNivel": "",
            "formTurma:inputAno": year,
            "formTurma:inputPeriodo": period,
            button["name"]: "Buscar",
        }
    )
    return values


def parse_results(soup, semester):
    messages = [text(item) for item in soup.select("ul.erros li")]
    if messages:
        normalized = [
            unicodedata.normalize("NFKD", message).encode("ascii", "ignore").decode().lower() for message in messages
        ]
        if all("nao foram encontrados resultados" in message for message in normalized):
            return []
        raise ValueError("SIGAA: " + " / ".join(messages))
    table = soup.select_one("table.listagem")
    if table is None:
        raise ValueError("Tabela de turmas ausente; resposta não será considerada uma unidade vazia.")
    result = []
    subject = None
    for row in table.find_all("tr"):
        classes = set(row.get("class", []))
        if "agrupador" in classes:
            title = row.select_one(".tituloDisciplina")
            if title is None or " - " not in text(title):
                raise ValueError("Disciplina sem código/nome reconhecível.")
            code, name = text(title).split(" - ", 1)
            subject = (code, name)
        elif classes & {"linhaPar", "linhaImpar"}:
            cells = row.find_all("td", recursive=False)
            if subject is None or len(cells) < 8:
                raise ValueError("Linha de turma sem disciplina ou colunas esperadas.")
            if text(cells[1]) != semester:
                raise ValueError(f"Semestre inesperado: {text(cells[1])}; esperado {semester}.")
            teachers = []
            for line in cells[2].stripped_strings:
                match = re.fullmatch(r"(.+?)(?:\s*\((\d+)\s*h\))?", " ".join(line.split()))
                if match:
                    teachers.append({"nome": match[1], "cargaHoraria": int(match[2]) if match[2] else None})
            schedule = BeautifulSoup(str(cells[3]), "html.parser")
            for popup in schedule.select(".popUp"):
                popup.decompose()
            schedule = re.sub(r"\s*\([^)]*\)\s*", " ", text(schedule)).strip()
            number = text(cells[0])
            if not number:
                raise ValueError("Turma sem número.")
            result.append(
                (
                    subject,
                    {
                        "numero": number,
                        "professores": teachers,
                        "horarios": schedule.split(),
                        "local": text(cells[7]) or None,
                        "vagas": int(text(cells[5])) if text(cells[5]).isdigit() else None,
                        "matriculados": int(text(cells[6])) if text(cells[6]).isdigit() else None,
                    },
                )
            )
    return result


class Sigaa:
    def __init__(self):
        self.reset()

    def reset(self):
        self.opener = build_opener(HTTPCookieProcessor(CookieJar()))
        self.read("https://sigaa.unb.br/sigaa/public/home.jsf")

    def read(self, url, data=None):
        if urlsplit(url).hostname != "sigaa.unb.br" or urlsplit(url).scheme != "https":
            raise ValueError("Destino inesperado no formulário SIGAA.")
        request = Request(
            url,
            data=urlencode(data).encode() if data is not None else None,
            headers={"User-Agent": "TrajetoriaUnb/1.0 (consulta publica de turmas)"},
        )
        with self.opener.open(request, timeout=45) as response:
            raw = response.read()
            encoding = response.headers.get_content_charset() or "utf-8"
            html = raw.decode(encoding)
            return BeautifulSoup(html, "html.parser")

    def form(self):
        form = self.read(SOURCE).find("form", id="formTurma")
        if form is None:
            raise ValueError("Formulário de turmas ausente.")
        return form

    def search(self, unit, semester):
        for attempt in range(3):
            try:
                if attempt:
                    self.reset()
                form = self.form()
                action = urljoin(SOURCE, form.get("action", ""))
                return parse_results(self.read(action, payload(form, unit, semester)), semester)
            except (OSError, ValueError) as error:
                if attempt == 2:
                    raise RuntimeError(f"Unidade {unit}: falha após 3 tentativas: {error}") from error
                time.sleep(2 * (attempt + 1))


def merge_subjects(groups):
    subjects = {}
    for unit, rows in groups.items():
        for (code, name), classroom in rows:
            subject = subjects.setdefault(code, {"codigo": code, "nome": name, "turmas": {}})
            if subject["nome"] != name:
                aliases = subject.setdefault("nomesAlternativos", [])
                if name not in aliases:
                    aliases.append(name)
            # O SIGAA pode repetir o número com dados diferentes na mesma disciplina.
            # O hash serve apenas para agrupar linhas idênticas durante a coleta.
            key = sha256(json.dumps(classroom, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
            previous = subject["turmas"].get(key)
            if previous:
                if unit not in previous["unidades"]:
                    previous["unidades"].append(unit)
            else:
                subject["turmas"][key] = {"referencia": key, **classroom, "unidades": [unit]}
    return [
        {
            **subject,
            "turmas": [
                {
                    **{field: value for field, value in row.items() if field not in ("referencia", "professores")},
                    "professores": [teacher["nome"] for teacher in row["professores"]],
                }
                for row in sorted(subject["turmas"].values(), key=lambda row: (row["numero"], row["referencia"]))
            ],
        }
        for _, subject in sorted(subjects.items())
    ]


def query_units(semester, units, client=None):
    sessions = local()

    def search_unit(unit):
        if client is not None:
            session = client
        else:
            if not hasattr(sessions, "client"):
                sessions.client = Sigaa()
            session = sessions.client
        rows = session.search(unit, semester)
        time.sleep(0.5)
        return rows

    groups = {}
    with ThreadPoolExecutor(max_workers=1 if client is not None else 2) as pool:
        tasks = {pool.submit(search_unit, unit): unit for unit in units}
        try:
            for task in as_completed(tasks):
                unit = tasks[task]
                groups[unit] = task.result()
                print(f"[{len(groups)}/{len(units)}] {unit} - {units[unit]}: {len(groups[unit])} turma(s)", flush=True)
        except Exception:
            for task in tasks:
                task.cancel()
            raise
    return {unit: groups[unit] for unit in units}


def is_postgraduate(name):
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().upper()
    return bool(re.search(r"POS[\s-]*GRADUACAO", normalized))


def collect_catalog(semester, client):
    units = parse_units(client.form())
    groups = query_units(semester, units)
    if not any(groups.values()):
        raise ValueError("Nenhuma turma encontrada; cadastro completo anterior preservado.")
    prefixes = {}
    for unit, rows in groups.items():
        for (code, _), _classroom in rows:
            match = re.match(r"[A-Za-z]+", code)
            if match:
                prefixes.setdefault(match[0], set()).add(int(unit))
    return {
        "source": SOURCE,
        "generated_at": timestamp(),
        "semesters": [semester],
        "units": units,
        "units_without_classes": [int(unit) for unit, rows in groups.items() if not rows],
        "prefixes": {prefix: sorted(ids) for prefix, ids in sorted(prefixes.items())},
    }


def update_units(semester, catalog):
    if catalog.get("semesters") != [semester]:
        raise ValueError("Atualize classroom_code_units.json para o semestre configurado antes de filtrar unidades.")
    units = catalog["units"]
    empty = {str(unit) for unit in catalog["units_without_classes"]}
    postgraduate = {unit for unit, name in units.items() if is_postgraduate(name)}
    selected = {unit: name for unit, name in units.items() if unit not in empty and unit not in postgraduate}
    if not selected:
        raise ValueError("Nenhuma unidade com oferta; cadastro anterior preservado.")
    return {
        "versao": 1,
        "fonte": catalog["source"],
        "atualizadoEm": timestamp(),
        "cadastroAtualizadoEm": catalog["generated_at"],
        "semestreVerificado": semester,
        "unidades": selected,
        "unidadesPosGraduacao": sorted(postgraduate, key=int),
        "unidadesSemTurmas": sorted(empty - postgraduate, key=int),
    }


def collect(semester, units, client=None):
    groups = query_units(semester, units, client)
    subjects = merge_subjects(groups)
    if not subjects:
        raise ValueError("Nenhuma turma encontrada; arquivo anterior preservado.")
    return {
        "atualizadoEm": timestamp(),
        "semestre": semester,
        "disciplinas": subjects,
    }


def read_semester(path=None):
    path = path or ROOT / "config" / "coleta.json"
    config = json.loads(path.read_text(encoding="utf-8"))
    semester = config.get("semestre") if isinstance(config, dict) else None
    if not isinstance(semester, str) or not re.fullmatch(r"20\d{2}\.[12]", semester):
        raise ValueError('config/coleta.json deve conter "semestre" no formato "2026.2" (período 1 ou 2).')
    return semester


def update_index(index, data):
    semester = data["semestre"]
    entry = {
        "semestre": semester,
        "arquivo": semester.replace(".", "-") + ".json",
        "atualizadoEm": data["atualizadoEm"],
        "fonte": SOURCE,
        "disciplinas": len(data["disciplinas"]),
        "turmas": sum(len(subject["turmas"]) for subject in data["disciplinas"]),
    }
    return {
        **index,
        "semestres": sorted(
            [item for item in index["semestres"] if item["semestre"] != semester] + [entry],
            key=lambda item: item["semestre"],
            reverse=True,
        ),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("acao", choices=["catalogo", "unidades", "turmas"])
    args = parser.parse_args(argv)
    try:
        semester = read_semester()
        print(f"Semestre: {semester} (config/coleta.json)", flush=True)
        if args.acao == "catalogo":
            catalog = collect_catalog(semester, Sigaa())
            atomic_json(DATA / "classroom_code_units.json", catalog)
            print(
                f"Cadastro completo atualizado: {len(catalog['units'])} unidades; "
                f"{len(catalog['units_without_classes'])} sem turmas."
            )
            return
        if args.acao == "unidades":
            source = json.loads((DATA / "classroom_code_units.json").read_text(encoding="utf-8"))
            catalog = update_units(semester, source)
            atomic_json(DATA / "unidades.json", catalog)
            print(f"Seleção atualizada: {len(catalog['unidades'])} unidades em public/data/turmas/unidades.json")
            return
        catalog = json.loads((DATA / "unidades.json").read_text(encoding="utf-8"))
        if catalog.get("semestreVerificado") != semester:
            raise ValueError("Seleção de unidades pertence a outro semestre. Atualize o cadastro completo e a seleção.")
        units = catalog["unidades"]
        if not units:
            raise ValueError("Cadastro de unidades vazio.")
        index_path = DATA / "index.json"
        index = (
            json.loads(index_path.read_text(encoding="utf-8"))
            if index_path.exists()
            else {"versao": 1, "semestres": []}
        )
        data = collect(semester, units)
        index = update_index(index, data)
        filename = semester.replace(".", "-") + ".json"
        atomic_json(DATA / filename, {"disciplinas": data["disciplinas"]})
        atomic_json(index_path, index)
        print(f"Salvo: {len(data['disciplinas'])} disciplinas em public/data/turmas/{filename}; índice atualizado.")
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        parser.exit(1, f"Coleta interrompida: {error}\n")


if __name__ == "__main__":
    main()
