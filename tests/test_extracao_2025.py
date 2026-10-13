import html
import unittest
from scripts.extrair_edital_1_2025 import extrair


def tabela(cabecalho, linhas):
    return ('<table>' + ''.join('<tr>' + ''.join('<td>' + html.escape(str(c)) + '</td>'
            for c in linha) + '</tr>' for linha in [cabecalho, *linhas]) + '</table>').encode('iso-8859-1')


class Extracao2025Test(unittest.TestCase):
    def fontes(self, segunda_media='3,8'):
        homologacao = tabela(['Matrícula', 'Curso', 'IRA', 'IPF', 'Escore Z', 'Nota Final',
                            'Homologação', 'Idiomas Homologados', *[f'{i}ª opção' for i in range(1, 6)]],
                            [[m, 'DIREITO', '4,3', '50%', '0,5', '1,5', 'Homologada', 'Inglês B1',
                              'Portugal / Coimbra', '-', '-', '-', '-'] for m in ['001', '002']])
        alocacao = tabela(['Matrícula', 'Curso', 'Alocação', 'Idiomas Homologados'],
                         [['001', 'DIREITO', 'Portugal / Coimbra', 'Inglês B2']])
        medias = tabela(['Curso', 'Média', 'Desvio Padrão'],
                        [['DIREITO - Manhã e Tarde', '3,3', '1'],
                         ['DIREITO - Noite', segunda_media, '1']])
        return homologacao, alocacao, medias

    def test_cruza_por_matricula_e_identifica_referencia_pelo_escore(self):
        dados = extrair(*self.fontes())
        primeiro, segundo = dados['resultados']
        self.assertEqual(primeiro['matricula'], '001')
        self.assertEqual(primeiro['turnoReferencia'], 'Noite')
        self.assertEqual(primeiro['idiomas'], 'Inglês B2')
        self.assertEqual(primeiro['alocacao'], 'Portugal / Coimbra')
        self.assertEqual(segundo['alocacao'], 'Não consta na alocação')
        self.assertEqual(len(dados['cursos'][0]['variantes']), 2)

    def test_recusa_referencia_incompativel(self):
        with self.assertRaises(ValueError):
            extrair(*self.fontes(segunda_media='4,0'))


if __name__ == '__main__':
    unittest.main()
