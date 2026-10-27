"""Atualiza cargas horárias curriculares publicadas no catálogo público do SIGAA.

Consulta os prefixos presentes nas turmas do semestre configurado. A carga é
CH Total do componente; não usa horários ou cargas horárias dos professores.
"""

import argparse
import json
import re
import time
from urllib.parse import urljoin

try:
    from .coletar_turmas import DATA, Sigaa, atomic_json, read_semester, text, timestamp
except ImportError:
    from coletar_turmas import DATA, Sigaa, atomic_json, read_semester, text, timestamp


SOURCE = "https://sigaa.unb.br/sigaa/public/componentes/busca_componentes.jsf"


def parse_componentes(soup):
    errors = [text(item) for item in soup.select("ul.erros li")]
    if errors:
        if all("Não foram encontrados resultados" in message for message in errors):
            return {}
        raise ValueError("SIGAA: " + " / ".join(errors))
    table = soup.select_one("table.listagem")
    if table is None:
        raise ValueError("Tabela de componentes ausente.")
    headers = [text(item) for item in table.select("thead th")]
    if headers[:4] != ["Código", "Nome", "Tipo", "CH Total"]:
        raise ValueError("Colunas do catálogo alteradas; CH Total não identificada.")
    result = {}
    for row in table.select("tbody tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) < 4:
            raise ValueError("Componente sem colunas esperadas.")
        code, name = text(cells[0]), text(cells[1])
        hours = re.fullmatch(r"(\d+)\s*h", text(cells[3]))
        if not re.fullmatch(r"[A-Z]+\d+", code) or not name or hours is None:
            raise ValueError(f"Metadados inválidos para {code!r}.")
        item = {"nome": name, "cargaHoraria": int(hours[1])}
        if code in result and result[code] != item:
            raise ValueError(f"Cargas horárias divergentes para {code}.")
        result[code] = item
    return result


def component_payload(form, code, level):
    values = {field["name"]: field.get("value", "") for field in form.select("input[type=hidden][name]")}
    code_field = form.find("input", attrs={"onchange": "marcar('form:checkCodigo');"})
    if not values.get("javax.faces.ViewState") or code_field is None:
        raise ValueError("Formulário de componentes alterado ou sessão expirada.")
    for field in form.select("input[type=text][name]"):
        values[field["name"]] = ""
    values.update(
        {
            "form:nivel": level,
            "form:tipo": "0",
            "form:unidades": "0",
            "form:checkCodigo": "on",
            "form:btnBuscarComponentes": "Buscar Componentes",
            code_field["name"]: code,
        }
    )
    return values


def search(client, code, level):
    for attempt in range(3):
        try:
            form = client.read(SOURCE).find("form", id="form")
            if form is None:
                raise ValueError("Formulário de componentes ausente.")
            return parse_componentes(client.read(urljoin(SOURCE, form["action"]), component_payload(form, code, level)))
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
            client.reset()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--codigo", action="append", help="Código específico; repetível. Padrão: todos os prefixos do semestre."
    )
    parser.add_argument(
        "--nivel", choices=["G", "S", "F", "L", "R"], default="G", help="Nível de ensino do catálogo (padrão: G)."
    )
    args = parser.parse_args(argv)
    try:
        semester = read_semester()
        subjects = json.loads((DATA / (semester.replace(".", "-") + ".json")).read_text(encoding="utf-8"))[
            "disciplinas"
        ]
        codes = {item["codigo"] for item in subjects}
        if args.codigo:
            if any(not re.fullmatch(r"[A-Z]+\d+", code) for code in args.codigo):
                raise ValueError("Código inválido; use, por exemplo, MAT0026.")
            queries = sorted(set(args.codigo))
            codes = set(queries)
        else:
            queries = sorted({re.match(r"[A-Z]+", code)[0] for code in codes})
        path = DATA / "componentes.json"
        cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"componentes": {}}
        components = dict(cache["componentes"])
        client = Sigaa()
        found = set()
        for index, query in enumerate(queries):
            if index:
                time.sleep(0.5)
            rows = search(client, query, args.nivel)
            rows = {code: item for code, item in rows.items() if code in codes}
            components.update(rows)
            found.update(rows)
            print(f"{index + 1}/{len(queries)} {query}: {len(rows)} componentes", flush=True)
        if not found:
            raise ValueError("Nenhum componente encontrado; cache anterior preservado.")
        atomic_json(
            path,
            {
                "fonte": SOURCE,
                "atualizadoEm": timestamp(),
                "componentes": dict(sorted(components.items())),
            },
        )
        print(f"Atualizados {len(found)} componentes; {len(codes - components.keys())} códigos sem carga no cache.")
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"Coleta interrompida; cache anterior preservado: {error}\n")


if __name__ == "__main__":
    main()
