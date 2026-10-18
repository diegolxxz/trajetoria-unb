"""Cruza a homologação retificada e a alocação do Edital INT 10/2024.

As referências são estimadas de IRA = média + desvio * IRA padronizado.
Não há identificação pública de turno nem lista de preferências nessas fontes.
"""

import argparse
import csv
import hashlib
import io
import json
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from urllib.request import urlopen

from extrair_edital_1_2025 import tabela, numero

SLUG = (
    "edital-int-no-10-2024-processo-de-pre-selecao-de-alunos-de-graduacao-da-unb-"
    "ao-intercambio-para-mobilidade-no-periodo-de-janeiro-a-julho-de-2025"
)
FONTES = {
    "edital": f"https://int.unb.br/{SLUG}/",
    "homologacao": "https://sei.unb.br/sei/publicacoes/controlador_publicacoes.php?acao=publicacao_visualizar&id_documento=12963717&id_orgao_publicacao=0",
    "homologacaoPdf": "https://int.unb.br/wp-content/uploads/2026/07/SEI_UnB-11614498-Edital.pdf",
    "alocacao": "https://int.unb.br/wp-content/uploads/2026/07/SEI_UnB-11649915-Resultado-Definitivo-da-Alocao-de-Vagas.pdf",
    "alocacaoProvisoria": "https://int.unb.br/wp-content/uploads/2026/07/SEI_UnB-11623025-Edital-10-INT-Resultado-Provisrio-da-Alocacao-de-Vagas.pdf",
}


def limpar(celula):
    texto = unicodedata.normalize("NFKC", " ".join((celula or "").split()))
    # Ligaduras ausentes no mapa de caracteres do PDF, conferidas na imagem.
    texto = texto.replace("incompa\x00vel", "incompatível").replace("\x00", "ti")
    return texto


def alocacoes(pdf):
    import pdfplumber

    registros = {}
    with pdfplumber.open(io.BytesIO(pdf)) as documento:
        for pagina in documento.pages:
            for t in pagina.extract_tables():
                if not t or t[0][0] != "Matrícula":
                    continue
                for linha in t[1:]:
                    r = list(map(limpar, linha))
                    if len(r) != 11 or not r[0].isdigit():
                        raise ValueError(f"Linha inesperada na alocação: {r}")
                    # Erro de digitação na fonte; os demais campos coincidem com a homologação.
                    matricula = "200023446" if r[0] == "2200023446" else r[0]
                    if matricula in registros:
                        raise ValueError(f"Alocação duplicada: {matricula}")
                    registros[matricula] = r
    if not registros:
        raise ValueError("Tabela de alocação não encontrada.")
    return registros


def referencias(registros):
    """Consensos de pontos colineares, sem atribuir turnos que a fonte omite.

    Dois pontos só bastam quando são os únicos do curso. Em cursos mistos,
    exigimos três registros e rejeitamos empates e associações ambíguas.
    A tolerância cobre IRA publicado com 4 casas e escore com 5 casas.
    """
    restantes = list(range(len(registros)))
    grupos = []

    def cabe(r, media, desvio):
        return abs(r["ira"] - media - desvio * r["iraPadronizado"]) <= 0.000051 + desvio * 0.0000051

    while len(restantes) >= 2:
        candidatos = {}
        for i, j in combinations(restantes, 2):
            a, b = registros[i], registros[j]
            dz = a["iraPadronizado"] - b["iraPadronizado"]
            if abs(dz) < 0.05:
                continue
            desvio = (a["ira"] - b["ira"]) / dz
            media = a["ira"] - desvio * a["iraPadronizado"]
            if not (0 <= media <= 5 and 0 < desvio <= 2.5):
                continue
            ids = tuple(k for k in restantes if cabe(registros[k], media, desvio))
            minimo = 2 if len(registros) == 2 else 3
            if len(ids) >= minimo:
                candidatos[ids] = (media, desvio)
        if not candidatos:
            break
        maior = max(map(len, candidatos))
        melhores = [ids for ids in candidatos if len(ids) == maior]
        if len(melhores) != 1:
            break
        ids = melhores[0]
        # Regressão usando todos os registros do consenso para reduzir arredondamento.
        xs = [registros[k]["iraPadronizado"] for k in ids]
        ys = [registros[k]["ira"] for k in ids]
        x, y = sum(xs) / len(xs), sum(ys) / len(ys)
        desvio = sum((a - x) * (b - y) for a, b in zip(xs, ys)) / sum((a - x) ** 2 for a in xs)
        media = y - desvio * x
        if not all(cabe(registros[k], media, desvio) for k in ids):
            break
        grupos.append({"media": media, "desvio": desvio, "estimada": True, "ids": ids})
        restantes = [k for k in restantes if k not in ids]
    # Não forçar a associação de um candidato compatível com mais de uma referência.
    for k, r in enumerate(registros):
        matches = [g for g in grupos if cabe(r, g["media"], g["desvio"])]
        r["media"] = matches[0]["media"] if len(matches) == 1 else None
        r["desvio"] = matches[0]["desvio"] if len(matches) == 1 else None
    variantes = []
    for g in grupos:
        membros = [r for r in registros if r["media"] == g["media"] and r["desvio"] == g["desvio"]]
        if membros:
            variantes.append(
                {
                    "cursoFonte": registros[0]["curso"],
                    "turno": None,
                    "media": g["media"],
                    "desvio": g["desvio"],
                    "estimada": True,
                    "registros": len(membros),
                    "matriculasBase": [registros[k]["matricula"] for k in g["ids"]],
                }
            )
    sem = sum(r["media"] is None for r in registros)
    if sem:
        variantes.append(
            {
                "cursoFonte": registros[0]["curso"],
                "turno": None,
                "media": None,
                "desvio": None,
                "registros": sem,
                "motivo": "Dados insuficientes para distinguir ou estimar esta referência.",
            }
        )
    return variantes


def extrair(homologacao, alocacao):
    h = tabela(homologacao, ["Matrícula", "Curso", "IRA", "IPF", "IRA padronizado", "Nota Final"], "Matrícula")
    a = alocacoes(alocacao)
    if set(a) - {r["Matrícula"] for r in h}:
        raise ValueError("Alocação sem correspondência na homologação.")
    resultados = []
    cursos = defaultdict(list)
    for r in h:
        destino = a.get(r["Matrícula"])
        if destino:
            if destino[1] != r["Curso"] or any(
                numero(destino[i]) != numero(r[campo])
                for i, campo in [
                    (4, "IRA"),
                    (5, "CHTP"),
                    (6, "CHTE"),
                    (7, "IPF"),
                    (8, "IRA padronizado"),
                    (9, "Nota Final"),
                ]
            ):
                raise ValueError(f"Dados divergentes: {r['Matrícula']}")
        situacao = r["Inscrição homologada?"]
        registro = {
            "matricula": r["Matrícula"],
            "curso": r["Curso"],
            "ira": numero(r["IRA"]),
            "ipf": numero(r["IPF"]),
            "iraPadronizado": numero(r["IRA padronizado"]),
            "notaFinal": numero(r["Nota Final"]),
            "opcoes": [""] * 5,
            "idiomas": destino[2] if destino else r["Idioma homologado"],
            "alocacao": destino[3]
            if destino
            else "Desistente"
            if "desist" in r["Observação Recurso"].lower()
            else "Não consta na alocação"
            if situacao == "Homologada"
            else "Inscrição não homologada",
            "situacaoInscricao": situacao,
        }
        resultados.append(registro)
        cursos[registro["curso"]].append(registro)
    referencias_cursos = [{"nome": nome, "variantes": referencias(rs)} for nome, rs in sorted(cursos.items())]
    return {
        "slug": SLUG,
        "titulo": "Edital INT nº 10/2024",
        "mobilidade": "1º semestre de 2025",
        "publicadoEm": "2024-08-30",
        "extraidoEm": datetime.now(timezone.utc).isoformat(),
        "fontes": FONTES,
        "fontesSha256": {
            k: hashlib.sha256(b).hexdigest() for k, b in [("homologacao", homologacao), ("alocacao", alocacao)]
        },
        "formula": {"pesoIra": 1, "pesoIpf": 2},
        "colunasExtras": [],
        "descricaoResultados": "Opções de destino não encontradas nas publicações consultadas.",
        "metodoReferencias": "Estimativas por IRA = média + desvio × IRA padronizado, com tolerância de arredondamento. Turnos não publicados. Referências sem consenso suficiente ficam indisponíveis.",
        "correcoes": [
            {
                "campo": "matricula",
                "fonte": "alocacao",
                "publicado": "2200023446",
                "utilizado": "200023446",
                "motivo": "Curso, IRA, CHTP, CHTE, IPF, escore e nota coincidem com a homologação.",
            }
        ],
        "cursos": referencias_cursos,
        "resultados": resultados,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--homologacao-html", type=Path)
    parser.add_argument("--alocacao-pdf", type=Path)
    parser.add_argument("--destino", type=Path, default=Path(__file__).resolve().parents[2] / "public" / "data/editais")
    args = parser.parse_args()

    def ler(path, fonte):
        return path.read_bytes() if path else urlopen(FONTES[fonte], timeout=90).read()

    dados = extrair(ler(args.homologacao_html, "homologacao"), ler(args.alocacao_pdf, "alocacao"))
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
                    *[
                        "" if r[k] is None else str(r[k]).replace(".", ",")
                        for k in ["ira", "ipf", "media", "desvio", "notaFinal"]
                    ],
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
                "referenciasEstimadas": sum(bool(v.get("estimada")) for c in dados["cursos"] for v in c["variantes"]),
                "registrosSemReferencia": sum(r["media"] is None for r in dados["resultados"]),
            }
        )
    )


if __name__ == "__main__":
    main()
