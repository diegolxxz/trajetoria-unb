"""Cruza a homologação, a correção da alocação e as médias oficiais do Edital 1/2026."""
import argparse
import csv
import hashlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from bs4 import BeautifulSoup
from pypdf import PdfReader

SLUG = ('edital-int-n-1-2026-processo-de-pre-selecao-de-alunos-de-graduacao-da-unb-'
        'ao-intercambio-para-mobilidade-no-periodo-de-agosto-a-dezembro-de-2026')
EDITAL = f'https://int.unb.br/{SLUG}/'
HOMOLOGACAO = ('https://sei.unb.br/sei/modulos/pesquisa/md_pesq_documento_consulta_externa.php?'
               '1XQweiWbpuyJUe5JOteiAz9uez3vQ1IVgO2H4YBOBecXQDfdSPFMRJe5zpQZqw_lu9UhViNnhBrwc_'
               'eZZGT3ZBFRKEUPd7-hM935MbQmPoOFB3ctuHQ7Hjn2QqNYAJum')
ALOCACAO = ('https://sei.unb.br/sei/modulos/pesquisa/md_pesq_documento_consulta_externa.php?'
            '1XQweiWbpuyJUe5JOteiAz9uez3vQ1IVgO2H4YBOBed_5LP9RoSVOzgHMO4bDOnWYz-CKYrrABq3M2jCPw'
            'S69sHQOKlTMBJPyrJZRMxYHL-7tDQp7FNZQRO6DkU9mXbT')
MEDIAS = 'https://int.unb.br/wp-content/uploads/2026/07/Informao-de-Mdias-e-Desvios-Padro.pdf'

COLUNAS_HOMOLOGACAO = ['Matrícula', 'Curso', 'IRA', 'CHTP', 'CHTE', 'IPF', 'Escore Z', 'Nota final',
                       '1ª opção', '2ª opção', '3ª opção', '4ª opção', '5ª opção',
                       'Idiomas Homologados', 'Situação da Inscrição', 'Observação', 'Recurso']
COLUNAS_ALOCACAO = ['Matrícula', 'Curso', 'Classificação', 'Alocação', 'Idiomas Homologados', 'Recurso Alocação']
COLUNAS_CSV = ['Matrícula', 'Curso', 'IRA', 'IPF', 'Média', 'Desvio Padrão', 'Nota final',
               '1ª opção', '2ª opção', '3ª opção', '4ª opção', '5ª opção', 'Idiomas Homologados',
               'Situação da Inscrição', 'Classificação', 'Alocação', 'Observação']


def texto(celula):
    return ' '.join(celula.get_text(' ', strip=True).split())


def tabela_sei(conteudo, colunas):
    # O SEI anuncia ISO-8859-1; passar bytes diretamente ao BeautifulSoup perde acentos.
    soup = BeautifulSoup(conteudo.decode('iso-8859-1'), 'html.parser')
    for tabela in soup.find_all('table'):
        linhas = tabela.find_all('tr')
        if not linhas:
            continue
        cabecalho = [texto(c) for c in linhas[0].find_all(['th', 'td'], recursive=False)]
        if cabecalho != colunas:
            continue
        dados = []
        for linha in linhas[1:]:
            celulas = [texto(c) for c in linha.find_all(['th', 'td'], recursive=False)]
            if len(celulas) != len(colunas):
                raise ValueError('A estrutura da tabela do SEI mudou.')
            registro = dict(zip(colunas, celulas))
            if not re.fullmatch(r'\d+', registro['Matrícula']):
                raise ValueError('Matrícula inválida na tabela do SEI.')
            dados.append(registro)
        if not dados or len({r['Matrícula'] for r in dados}) != len(dados):
            raise ValueError('Tabela vazia ou com matrículas duplicadas.')
        return dados
    raise ValueError('Tabela esperada não encontrada no documento do SEI.')


def numero(valor):
    return float(valor.replace('%', '').replace('.', '').replace(',', '.'))


def formato(valor):
    return str(valor).replace('.', ',')


def medias_pdf(conteudo):
    medias = {}
    for pagina in PdfReader(io.BytesIO(conteudo)).pages:
        for linha in pagina.extract_text().splitlines():
            # Uma linha longa do PDF une o último caractere do curso ao primeiro dígito.
            encontrado = re.fullmatch(r'(.+?)(\d+,\d+)\s+(\d+,\d+)', linha.strip())
            if not encontrado:
                continue
            curso, media, desvio = encontrado.groups()
            curso = curso.strip()
            if curso in medias or numero(desvio) <= 0:
                raise ValueError(f'Média duplicada ou desvio inválido: {curso}')
            medias[curso] = (numero(media), numero(desvio))
    if len(medias) < 60:
        raise ValueError('O PDF de médias parece incompleto.')
    return medias


def extrair(homologacao_html, alocacao_html, medias_bytes):
    inscritos = tabela_sei(homologacao_html, COLUNAS_HOMOLOGACAO)
    alocados = tabela_sei(alocacao_html, COLUNAS_ALOCACAO)
    medias = medias_pdf(medias_bytes)
    por_matricula = {r['Matrícula']: r for r in alocados}
    ids_inscritos = {r['Matrícula'] for r in inscritos}
    ausentes = set(por_matricula) - ids_inscritos
    if ausentes:
        raise ValueError(f'Alocações sem homologação: {sorted(ausentes)}')
    cursos_inscritos = {r['Curso'] for r in inscritos}
    sem_media = cursos_inscritos - set(medias)
    if sem_media:
        raise ValueError(f'Cursos sem média e desvio: {sorted(sem_media)}')

    resultados = []
    linhas_csv = []
    contagens_curso = {}
    for r in inscritos:
        a = por_matricula.get(r['Matrícula'])
        if a and a['Curso'] != r['Curso']:
            raise ValueError(f'Curso divergente para matrícula {r["Matrícula"]}.')
        media, desvio = medias[r['Curso']]
        homologada = r['Situação da Inscrição'].casefold() == 'homologada'
        if a and not homologada:
            raise ValueError(f'Inscrição não homologada foi alocada: {r["Matrícula"]}.')
        observacoes = [r['Observação']]
        if a and a['Recurso Alocação']:
            observacoes.append(f'Recurso da alocação: {a["Recurso Alocação"]}')
        observacao = ' · '.join(x for x in observacoes if x)
        alocacao = a['Alocação'] if a else 'Não alocado' if homologada else 'Inscrição não homologada'
        registro = {
            'matricula': r['Matrícula'], 'curso': r['Curso'], 'ira': numero(r['IRA']),
            'ipf': numero(r['IPF']), 'media': media, 'desvio': desvio,
            'notaFinal': numero(r['Nota final']),
            'opcoes': [r[f'{i}ª opção'] for i in range(1, 6)],
            'idiomas': (a['Idiomas Homologados'] if a and a['Idiomas Homologados'] else r['Idiomas Homologados']),
            'alocacao': alocacao, 'situacaoInscricao': r['Situação da Inscrição'],
            'classificacao': a['Classificação'] if a else '', 'observacao': observacao,
        }
        if not 0 <= registro['ira'] <= 5 or not 0 <= registro['ipf'] <= 100:
            raise ValueError(f'IRA ou IPF fora do intervalo: {r["Matrícula"]}.')
        resultados.append(registro)
        contagens_curso[r['Curso']] = contagens_curso.get(r['Curso'], 0) + 1
        linhas_csv.append([
            registro['matricula'], registro['curso'], r['IRA'], r['IPF'], formato(media), formato(desvio),
            r['Nota final'], *registro['opcoes'], registro['idiomas'], registro['situacaoInscricao'],
            registro['classificacao'], registro['alocacao'], registro['observacao'],
        ])

    cursos = [{'nome': nome, 'variantes': [{'cursoFonte': nome, 'turno': None,
              'media': medias[nome][0], 'desvio': medias[nome][1], 'registros': contagens_curso.get(nome, 0)}]}
              for nome in sorted(medias)]
    dados = {
        'slug': SLUG, 'titulo': 'Edital INT nº 1/2026', 'mobilidade': '2º semestre de 2026',
        'publicadoEm': '2026-03-17', 'extraidoEm': datetime.now(timezone.utc).isoformat(),
        'fontes': {'edital': EDITAL, 'homologacao': HOMOLOGACAO, 'alocacao': ALOCACAO,
                   'mediasDesvios': MEDIAS},
        'fontesSha256': {'homologacao': hashlib.sha256(homologacao_html).hexdigest(),
                        'alocacao': hashlib.sha256(alocacao_html).hexdigest(),
                        'mediasDesvios': hashlib.sha256(medias_bytes).hexdigest()},
        'formula': {'pesoIra': 1, 'pesoIpf': 2},
        'descricaoResultados': '',
        'colunasExtras': [],
        'cursos': cursos, 'resultados': resultados,
    }
    return dados, linhas_csv


def ler_fonte(caminho, url):
    return caminho.read_bytes() if caminho else urlopen(url, timeout=90).read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--homologacao-html', type=Path)
    parser.add_argument('--alocacao-html', type=Path)
    parser.add_argument('--medias-pdf', type=Path)
    parser.add_argument('--destino', type=Path, default=Path(__file__).resolve().parents[1] / 'data' / 'editais')
    args = parser.parse_args()
    dados, linhas = extrair(ler_fonte(args.homologacao_html, HOMOLOGACAO),
                           ler_fonte(args.alocacao_html, ALOCACAO), ler_fonte(args.medias_pdf, MEDIAS))
    args.destino.mkdir(parents=True, exist_ok=True)
    (args.destino / f'{SLUG}.json').write_text(json.dumps(dados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (args.destino / f'{SLUG}.csv').open('w', newline='', encoding='utf-8-sig') as arquivo:
        writer = csv.writer(arquivo, delimiter=';')
        writer.writerow(COLUNAS_CSV)
        writer.writerows(linhas)
    print(json.dumps({'inscricoes': len(linhas), 'alocados': sum(r['classificacao'] != '' for r in dados['resultados']),
                      'cursosComInscritos': sum(c['variantes'][0]['registros'] > 0 for c in dados['cursos']),
                      'cursosComMedia': len(dados['cursos'])}, ensure_ascii=True))


if __name__ == '__main__':
    main()
