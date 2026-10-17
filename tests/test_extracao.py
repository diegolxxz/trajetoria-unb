import html
import unittest
from scripts.extrair_edital_7_2026 import COLUNAS, extrair


def tabela(linhas, cabecalho=COLUNAS):
    return (
        "<table>"
        + "".join(
            "<tr>" + "".join("<td>" + html.escape(str(c)) + "</td>" for c in linha) + "</tr>"
            for linha in [cabecalho, *linhas]
        )
        + "</table>"
    )


def registro(matricula, curso, media="3,5", desvio="1,20"):
    return [
        matricula,
        curso,
        "4,5",
        "55,00%",
        media,
        desvio,
        "1,933333333",
        "Portugal / Coimbra",
        "",
        "",
        "",
        "",
        "Inglês B2",
        "Portugal / Coimbra",
    ]


class ExtracaoTest(unittest.TestCase):
    def test_agrupa_turnos_e_zeros_a_direita_sem_perder_campos(self):
        fonte = tabela(
            [
                registro("001", "DIREITO - DIURNO"),
                registro("002", "DIREITO - DIURNO", desvio="1,200"),
                registro("003", "DIREITO - NOTURNO", media="3,7"),
            ]
        )
        dados, csv, quantidade = extrair(fonte.encode())
        self.assertEqual(quantidade, 1)
        self.assertEqual(dados["resultados"][0]["matricula"], "001")
        self.assertEqual(dados["resultados"][0]["opcoes"], ["Portugal / Coimbra", "", "", "", ""])
        self.assertEqual(len(csv[0]), 14)
        self.assertEqual(len(dados["cursos"]), 1)
        variantes = dados["cursos"][0]["variantes"]
        self.assertEqual([v["turno"] for v in variantes], ["Diurno", "Noturno"])
        self.assertEqual([v["registros"] for v in variantes], [2, 1])

    def test_descarta_lista_repetida_de_bolsas(self):
        fonte = tabela([registro("001", "DIREITO")], [*COLUNAS[:-1], "Alocação de vaga"]) + tabela(
            [registro("001", "DIREITO")]
        )
        dados, _, _ = extrair(fonte.encode())
        self.assertEqual(len(dados["resultados"]), 1)

    def test_falha_quando_fonte_muda_ou_duplica_matriculas(self):
        for fonte in [
            "<html>Manutenção</html>",
            tabela([registro("001", "DIREITO")[:-1]]),
            tabela([registro("001", "DIREITO"), registro("001", "DIREITO")]),
        ]:
            with self.assertRaises(ValueError):
                extrair(fonte.encode())


if __name__ == "__main__":
    unittest.main()
