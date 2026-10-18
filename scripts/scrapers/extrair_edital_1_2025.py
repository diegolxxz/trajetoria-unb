"""Cruza homologação, alocação corrigida e referências por turno do Edital 1/2025."""

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

SLUG = (
    "edital-int-n-1-2025-processo-de-pre-selecao-de-alunos-de-graduacao-da-unb-"
    "ao-intercambio-para-mobilidade-no-periodo-de-agosto-a-dezembro-de-2025"
)
BASE = "https://sei.unb.br/sei/publicacoes/controlador_publicacoes.php?acao=publicacao_visualizar&"
FONTES = {
    "edital": f"https://int.unb.br/{SLUG}/",
    "homologacao": BASE + "id_documento=14172636&id_orgao_publicacao=0",
    "mediasDesvios": BASE + "id_documento=14157383&id_orgao_publicacao=0",
    "regras": BASE + "id_documento=13973039&id_orgao_publicacao=0",
    "alocacao": (
        "https://sei.unb.br/sei/modulos/pesquisa/md_pesq_documento_consulta_externa.php?"
        "1XQweiWbpuyJUe5JOteiAz9uez3vQ1IVgO2H4YBOBedcIXVVXt1H3JU20qPcLf4KVfTnOkiLkNNG3Lqi_ISB14e9djaTUSX0q0-vZjMyojvsK2dEIVklNeLjcpZSxsnv"
    ),
}


def tabela(html, obrigatorias, chave):
    soup = BeautifulSoup(html.decode("iso-8859-1"), "html.parser")
    for t in soup.find_all("table"):
        linhas = [
            [" ".join(c.get_text(" ", strip=True).split()) for c in tr.find_all(["td", "th"], recursive=False)]
            for tr in t.find_all("tr")
        ]
        if not linhas or not set(obrigatorias).issubset(linhas[0]):
            continue
        if any(len(r) != len(linhas[0]) for r in linhas[1:]):
            raise ValueError("Quantidade de células inesperada na publicação.")
        registros = [dict(zip(linhas[0], r)) for r in linhas[1:]]
        if not registros or len({r[chave] for r in registros}) != len(registros):
            raise ValueError(f"Tabela vazia ou com {chave} duplicado.")
        return registros
    raise ValueError(f"Tabela não encontrada: {obrigatorias}")


def numero(valor):
    return float(valor.replace("%", "").replace(",", "."))


def extrair(homologacao, alocacao, medias):
    h = tabela(
        homologacao,
        [
            "Matrícula",
            "Curso",
            "IRA",
            "IPF",
            "Escore Z",
            "Nota Final",
            "Homologação",
            "Idiomas Homologados",
            *[f"{i}ª opção" for i in range(1, 6)],
        ],
        "Matrícula",
    )
    a = tabela(alocacao, ["Matrícula", "Curso", "Alocação", "Idiomas Homologados"], "Matrícula")
    m = tabela(medias, ["Curso", "Média", "Desvio Padrão"], "Curso")
    por_id = {r["Matrícula"]: r for r in a}
    if set(por_id) - {r["Matrícula"] for r in h}:
        raise ValueError("Há alocações sem correspondência na homologação.")
    cursos = {}
    for r in m:
        partes = re.fullmatch(r"(.+) - (Manhã e Tarde|Noite)", r["Curso"])
        if not partes:
            raise ValueError(f"Turno desconhecido: {r['Curso']}")
        nome, turno = partes.groups()
        v = {
            "cursoFonte": nome,
            "turno": turno,
            "referenciaFonte": r["Curso"],
            "media": numero(r["Média"]),
            "desvio": numero(r["Desvio Padrão"]),
            "registros": 0,
        }
        if not 0 <= v["media"] <= 5 or v["desvio"] <= 0:
            raise ValueError("Média ou desvio inválido.")
        cursos.setdefault(nome, []).append(v)
    resultados = []
    for r in h:
        if not re.fullmatch(r"\d+", r["Matrícula"]):
            raise ValueError("Matrícula inválida.")
        ira, ipf, z = numero(r["IRA"]), numero(r["IPF"]), numero(r["Escore Z"])
        if not 0 <= ira <= 5 or not 0 <= ipf <= 100:
            raise ValueError("IRA ou IPF inválido.")
        # A homologação omite o turno. O escore publicado identifica a referência
        # usada, aceitando apenas a diferença causada pelo arredondamento da fonte.
        candidatas = [v for v in cursos.get(r["Curso"], []) if abs((ira - v["media"]) / v["desvio"] - z) <= 0.00001]
        if len(candidatas) != 1:
            raise ValueError(f"Referência ausente ou ambígua para {r['Matrícula']}.")
        v = candidatas[0]
        v["registros"] += 1
        destino = por_id.get(r["Matrícula"])
        if destino and destino["Curso"] != r["Curso"]:
            raise ValueError(f"Curso divergente para {r['Matrícula']}.")
        homologada = r["Homologação"] == "Homologada"
        if destino and not homologada:
            raise ValueError("Inscrição não homologada encontrada na alocação.")
        resultados.append(
            {
                "matricula": r["Matrícula"],
                "curso": r["Curso"],
                "ira": ira,
                "ipf": ipf,
                "media": v["media"],
                "desvio": v["desvio"],
                "notaFinal": numero(r["Nota Final"]),
                "opcoes": [r[f"{i}ª opção"] if r[f"{i}ª opção"] != "-" else "" for i in range(1, 6)],
                "idiomas": destino["Idiomas Homologados"] if destino else r["Idiomas Homologados"],
                "alocacao": destino["Alocação"]
                if destino
                else "Não consta na alocação"
                if homologada
                else "Inscrição não homologada",
                "situacaoInscricao": r["Homologação"],
                "turnoReferencia": v["turno"],
            }
        )
    return {
        "slug": SLUG,
        "titulo": "Edital INT nº 1/2025",
        "mobilidade": "2º semestre de 2025",
        "publicadoEm": "2025-04-30",
        "extraidoEm": datetime.now(timezone.utc).isoformat(),
        "fontes": FONTES,
        "fontesSha256": {
            k: hashlib.sha256(b).hexdigest()
            for k, b in [("homologacao", homologacao), ("alocacao", alocacao), ("mediasDesvios", medias)]
        },
        "formula": {"pesoIra": 1, "pesoIpf": 2},
        "descricaoResultados": "",
        "colunasExtras": [],
        "cursos": [{"nome": nome, "variantes": vs} for nome, vs in sorted(cursos.items())],
        "resultados": resultados,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for campo in ["homologacao", "alocacao", "medias"]:
        parser.add_argument(f"--{campo}-html", type=Path)
    parser.add_argument(
        "--destino", type=Path, default=Path(__file__).resolve().parents[2] / "public" / "data" / "editais"
    )
    args = parser.parse_args()

    def ler(campo, fonte):
        p = getattr(args, campo + "_html")
        if p:
            return p.read_bytes()
        with urlopen(FONTES[fonte], timeout=90) as resposta:
            return resposta.read()

    dados = extrair(ler("homologacao", "homologacao"), ler("alocacao", "alocacao"), ler("medias", "mediasDesvios"))
    args.destino.mkdir(parents=True, exist_ok=True)
    (args.destino / f"{SLUG}.json").write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (args.destino / f"{SLUG}.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(
            [
                "Matrícula",
                "Curso",
                "IRA",
                "IPF",
                "Média",
                "Desvio",
                "Nota final",
                *[f"{i}ª opção" for i in range(1, 6)],
                "Idiomas Homologados",
                "Alocação Definitiva",
            ]
        )
        for r in dados["resultados"]:
            writer.writerow(
                [
                    r["matricula"],
                    r["curso"],
                    *[str(r[k]).replace(".", ",") for k in ["ira", "ipf", "media", "desvio", "notaFinal"]],
                    *r["opcoes"],
                    r["idiomas"],
                    r["alocacao"],
                ]
            )
    print(
        json.dumps(
            {
                "registros": len(dados["resultados"]),
                "cursos": len(dados["cursos"]),
                "referencias": sum(len(c["variantes"]) for c in dados["cursos"]),
                "semAlocacao": dict(
                    Counter(
                        r["alocacao"]
                        for r in dados["resultados"]
                        if r["alocacao"] in ["Não alocado", "Não consta na alocação", "Inscrição não homologada"]
                    )
                ),
            }
        )
    )


if __name__ == "__main__":
    main()
