"""Extrai homologação e alocação do Edital INT 3/2024 (IRA sem padronização)."""
import argparse
import csv
import hashlib
import io
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from extrair_edital_1_2025 import tabela, numero
from extrair_edital_10_2024 import limpar

SLUG = 'edital-int-no-3-2024-processo-de-pre-selecao-de-alunos-de-graduacao-da-unb-ao-intercambio-para-mobilidade-no-periodo-de-agosto-a-dezembro-de-2024'
FONTES = {
    'edital': f'https://int.unb.br/{SLUG}/',
    'homologacao': 'https://sei.unb.br/sei/publicacoes/controlador_publicacoes.php?acao=publicacao_visualizar&id_documento=12271234&id_orgao_publicacao=0',
    'homologacaoPdf': 'https://int.unb.br/wp-content/uploads/2026/07/SEI_UnB_-_10997420_-_Resultado_definitivo_da_homologacao.pdf',
    'alocacao': 'https://int.unb.br/wp-content/uploads/2026/07/SEI_UnB-11045088-Resultado-Definitivo-da-alocao-de-vagas-do-Edital.pdf',
    'regras': 'https://int.unb.br/wp-content/uploads/2026/07/SEI_10904856_Edital_3_INT.pdf',
}


def alocacoes(pdf):
    import pdfplumber
    linhas = []
    with pdfplumber.open(io.BytesIO(pdf)) as doc:
        for i, pagina in enumerate(doc.pages):
            tabelas = pagina.find_tables()
            if not tabelas:
                raise ValueError(f'Tabela ausente na página {i+1}.')
            t = tabelas[0]
            xs = sorted({x for c in t.rows[0].cells if c for x in (c[0], c[2])})
            # As bordas verticais incompletas cortam a última linha de algumas páginas.
            # Estender as divisórias recupera a linha, continuada na página seguinte.
            fim = t.bbox[3] if i == len(doc.pages)-1 else max(
                e['bottom'] for e in pagina.edges if e['orientation'] == 'v' and e['top'] >= t.bbox[1]-1)
            area = pagina.crop((t.bbox[0], t.bbox[1], t.bbox[2], fim))
            for tabela_pdf in area.extract_tables({'vertical_strategy': 'explicit',
                    'explicit_vertical_lines': xs, 'explicit_horizontal_lines': [fim]}):
                for row in tabela_pdf:
                    r = [limpar(c).replace('Achitetiura', 'Achitettura') for c in row]
                    if r[0] == 'Matrícula':
                        continue
                    if len(r) != 11:
                        raise ValueError('Número de células inesperado.')
                    if r[0].isdigit():
                        linhas.append(r)
                    elif not r[0] and linhas:
                        linhas[-1] = [' '.join(filter(None, (a, b))) for a, b in zip(linhas[-1], r)]
                    else:
                        raise ValueError(f'Linha inesperada: {r}')
    registros = {r[0]: r for r in linhas}
    if not registros or len(registros) != len(linhas):
        raise ValueError('Alocação vazia ou matrícula duplicada.')
    return registros


def extrair(homologacao, alocacao):
    h = tabela(homologacao, ['Matrícula', 'Curso', 'IRA', 'IPF', 'NF'], 'Matrícula')
    a = alocacoes(alocacao)
    if set(a) != {r['Matrícula'] for r in h}:
        raise ValueError('As matrículas das publicações não coincidem.')
    resultados = []
    for r in h:
        d = a[r['Matrícula']]
        if d[1].replace(' ', '') != r['Curso'].replace(' ', '') or any(
            numero(d[i]) != numero(r[k]) for i, k in [(4, 'CHTE'), (5, 'CHTP'), (6, 'IPF'), (7, 'IRA'), (8, 'NF')]):
            raise ValueError(f'Dados divergentes para {r["Matrícula"]}.')
        situacao = d[9]
        destino = d[3] or ('Desistente' if 'desist' in situacao.lower() else
                          'Inscrição não homologada' if situacao != 'Homologada' else 'Não consta na alocação')
        resultados.append({'matricula': r['Matrícula'], 'curso': r['Curso'],
            'ira': numero(d[7]), 'ipf': numero(d[6]), 'media': None, 'desvio': None,
            'notaFinal': numero(d[8]), 'opcoes': [''] * 5, 'idiomas': d[2],
            'alocacao': destino, 'situacaoInscricao': situacao})
    cursos = Counter(r['curso'] for r in resultados)
    return {'slug': SLUG, 'titulo': 'Edital INT nº 3/2024', 'mobilidade': '2º semestre de 2024',
        'publicadoEm': '2024-03-14', 'extraidoEm': datetime.now(timezone.utc).isoformat(),
        'fontes': FONTES, 'fontesSha256': {k: hashlib.sha256(b).hexdigest() for k,b in
            [('homologacao', homologacao), ('alocacao', alocacao)]},
        'formula': {'tipo': 'ira-direto', 'pesoIra': 1, 'pesoIpf': 2},
        'descricaoResultados': 'Opções de destino não informadas nas tabelas consultadas.',
        'colunasExtras': [], 'cursos': [{'nome': nome, 'variantes': []} for nome in sorted(cursos)],
        'resultados': resultados}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--homologacao-html', type=Path)
    parser.add_argument('--alocacao-pdf', type=Path)
    parser.add_argument('--destino', type=Path, default=Path(__file__).resolve().parents[1] / 'data/editais')
    args = parser.parse_args()
    def ler(path, fonte):
        return path.read_bytes() if path else urlopen(FONTES[fonte], timeout=90).read()
    dados = extrair(ler(args.homologacao_html, 'homologacao'), ler(args.alocacao_pdf, 'alocacao'))
    args.destino.mkdir(parents=True, exist_ok=True)
    (args.destino / f'{SLUG}.json').write_text(json.dumps(dados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (args.destino / f'{SLUG}.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['Matrícula', 'Curso', 'IRA', 'IPF', 'Média', 'Desvio', 'Nota final',
                         *[f'{i}ª opção' for i in range(1,6)], 'Idiomas Homologados', 'Alocação Definitiva'])
        for r in dados['resultados']:
            writer.writerow([r['matricula'], r['curso'],
                *['' if r[k] is None else str(r[k]).replace('.', ',') for k in ['ira','ipf','media','desvio','notaFinal']],
                *r['opcoes'], r['idiomas'], r['alocacao']])
    print(json.dumps({'registros': len(dados['resultados']), 'cursos': len(dados['cursos'])}))


if __name__ == '__main__':
    main()
