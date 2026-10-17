"""Extrai somente as colunas solicitadas das tabelas gerais do resultado definitivo."""

import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from bs4 import BeautifulSoup

SLUG = "edital-int-n-7-2026"
FONTE = "https://sei.unb.br/sei/publicacoes/controlador_publicacoes.php?acao=publicacao_visualizar&id_documento=16862911&id_orgao_publicacao=0"
COLUNAS = [
    "Matrícula",
    "Curso",
    "IRA",
    "IPF",
    "Média",
    "Desvio",
    "Nota final",
    "1ª opção",
    "2ª opção",
    "3ª opção",
    "4ª opção",
    "5ª opção",
    "Idiomas Homologados",
    "Alocação Definitiva",
]


def texto(celula):
    return " ".join(celula.get_text(" ", strip=True).split())


def numero(valor):
    return float(valor.replace("%", "").replace(".", "").replace(",", "."))


def extrair(html):
    soup = BeautifulSoup(html, "html.parser")
    resultados, linhas_csv = [], []
    tabelas = 0
    for tabela in soup.find_all("table"):
        linhas = tabela.find_all("tr")
        cabecalho = [texto(c) for c in linhas[0].find_all(["td", "th"])]
        # Exclui a lista de bolsas Savoie, que repete inscritos da lista geral.
        if not set(COLUNAS).issubset(cabecalho):
            continue
        tabelas += 1
        for linha in linhas[1:]:
            celulas = [texto(c) for c in linha.find_all(["td", "th"], recursive=False)]
            if len(celulas) != len(cabecalho):
                raise ValueError("Estrutura da tabela mudou: quantidade de células inesperada.")
            valores = dict(zip(cabecalho, celulas))
            if not re.fullmatch(r"\d+", valores["Matrícula"]):
                raise ValueError("Matrícula inválida na fonte.")
            registro = {
                "matricula": valores["Matrícula"],
                "curso": valores["Curso"],
                "ira": numero(valores["IRA"]),
                "ipf": numero(valores["IPF"]),
                "media": numero(valores["Média"]),
                "desvio": numero(valores["Desvio"]),
                "notaFinal": numero(valores["Nota final"]),
                "opcoes": [valores[f"{n}ª opção"] for n in range(1, 6)],
                "idiomas": valores["Idiomas Homologados"],
                "alocacao": valores["Alocação Definitiva"],
            }
            if not (0 <= registro["ira"] <= 5 and 0 <= registro["ipf"] <= 100 and registro["desvio"] > 0):
                raise ValueError("Valor numérico fora dos limites esperados.")
            resultados.append(registro)
            linhas_csv.append([valores[c] for c in COLUNAS])
    if not resultados or len({r["matricula"] for r in resultados}) != len(resultados):
        raise ValueError("Nenhum resultado encontrado ou matrículas duplicadas.")

    cursos = {}
    for r in resultados:
        # Só atribui turno quando ele consta explicitamente no nome publicado.
        sufixo = re.search(r"\s*[-–—]\s*(DIURNO|NOTURNO)\s*$", r["curso"], re.I)
        nome = r["curso"][: sufixo.start()].strip() if sufixo else r["curso"]
        turno = sufixo.group(1).capitalize() if sufixo else None
        variantes = cursos.setdefault(nome, {})
        chave = (r["curso"], r["media"], r["desvio"])
        variante = variantes.setdefault(
            chave,
            {"cursoFonte": r["curso"], "turno": turno, "media": r["media"], "desvio": r["desvio"], "registros": 0},
        )
        variante["registros"] += 1
    dados = {
        "slug": SLUG,
        "titulo": "Edital INT nº 7/2026",
        "mobilidade": "1º semestre de 2027",
        "publicadoEm": "2026-08-31",
        "extraidoEm": datetime.now(timezone.utc).isoformat(),
        "fonteSha256": hashlib.sha256(html).hexdigest(),
        "fontes": {
            "edital": "https://int.unb.br/edital-int-n-7-2026/",
            "resultado": FONTE,
            "regras": "https://sei.unb.br/sei/publicacoes/controlador_publicacoes.php?acao=publicacao_visualizar&id_documento=16368106&id_orgao_publicacao=0",
        },
        "formula": {"pesoIra": 1, "pesoIpf": 2},
        "cursos": [
            {"nome": nome, "variantes": sorted(v.values(), key=lambda x: (x["cursoFonte"], x["media"], x["desvio"]))}
            for nome, v in sorted(cursos.items())
        ],
        "resultados": resultados,
    }
    return dados, linhas_csv, tabelas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, help="HTML já baixado; dispensa acesso à rede.")
    parser.add_argument("--destino", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "editais")
    args = parser.parse_args()
    if args.html:
        html = args.html.read_bytes()
    else:
        with urlopen(FONTE, timeout=60) as resposta:
            html = resposta.read()
    dados, linhas, tabelas = extrair(html)
    args.destino.mkdir(parents=True, exist_ok=True)
    (args.destino / f"{SLUG}.json").write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (args.destino / f"{SLUG}.csv").open("w", newline="", encoding="utf-8-sig") as arquivo:
        writer = csv.writer(arquivo, delimiter=";")
        writer.writerow(COLUNAS)
        writer.writerows(linhas)
    print(
        json.dumps(
            {
                "tabelas": tabelas,
                "registros": len(linhas),
                "cursos": len(dados["cursos"]),
                "variantesPorCurso": dict(Counter(len(c["variantes"]) for c in dados["cursos"])),
            }
        )
    )


if __name__ == "__main__":
    main()
