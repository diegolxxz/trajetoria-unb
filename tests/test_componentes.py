"""Fixtures reduced from the public SIGAA response for MAT0026 (2026-10-27)."""

import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from bs4 import BeautifulSoup

from scripts.scrapers.coletar_componentes import component_payload, main, parse_componentes


HTML = """
<table class="listagem"><thead><tr><th>Código</th><th>Nome</th><th>Tipo</th>
<!-- <th>CR Total</th> --><th>CH Total</th><th></th></tr></thead><tbody>
<tr class="linhaPar"><td>MAT0026</td><td>CÁLCULO 2</td><td>DISCIPLINA</td>
<td>90h</td><td><a title="Detalhes do Componente Curricular"
onclick="jsfcljs(document.getElementById('formListagemComponentes'),{'id':'177892','publico':'public'},'');">Detalhes</a></td></tr>
</tbody></table>
"""


class ComponentesTests(unittest.TestCase):
    def test_reads_official_total_workload_without_inventing_credits(self):
        self.assertEqual(
            parse_componentes(BeautifulSoup(HTML, "html.parser")),
            {"MAT0026": {"nome": "CÁLCULO 2", "cargaHoraria": 90}},
        )

    def test_missing_workload_is_not_zero(self):
        with self.assertRaises(ValueError):
            parse_componentes(BeautifulSoup(HTML.replace("90h", ""), "html.parser"))

    def test_rejects_changed_column_meaning(self):
        with self.assertRaises(ValueError):
            parse_componentes(BeautifulSoup(HTML.replace("CH Total", "CH Docente"), "html.parser"))

    def test_errors_and_missing_results_do_not_become_empty_cache(self):
        with self.assertRaises(ValueError):
            parse_componentes(BeautifulSoup("<ul class='erros'><li>Sessão expirada</li></ul>", "html.parser"))

    def test_conflicting_duplicate_metadata_is_rejected(self):
        row = BeautifulSoup(HTML, "html.parser").select_one("tbody tr")
        with self.assertRaises(ValueError):
            parse_componentes(
                BeautifulSoup(HTML.replace("</tbody>", str(row).replace("90h", "60h") + "</tbody>"), "html.parser")
            )

    def test_search_keeps_dynamic_code_input_and_public_viewstate(self):
        form = BeautifulSoup(
            """<form><input type="hidden" name="javax.faces.ViewState" value="j_id1">
        <input type="text" name="form:dynamic11" onchange="marcar('form:checkCodigo');">
        <input type="text" name="form:dynamic13" onchange="marcar('form:checkNome');"></form>""",
            "html.parser",
        ).form
        values = component_payload(form, "MAT", "G")
        self.assertEqual(values["form:dynamic11"], "MAT")
        self.assertEqual(values["javax.faces.ViewState"], "j_id1")
        self.assertEqual(values["form:checkCodigo"], "on")
        self.assertNotIn("form:checkNome", values)

    def test_network_failure_preserves_existing_cache(self):
        with TemporaryDirectory() as directory:
            data = Path(directory)
            (data / "2026-2.json").write_text(json.dumps({"disciplinas": [{"codigo": "MAT0026"}]}), encoding="utf-8")
            path = data / "componentes.json"
            previous = '{"componentes":{"MAT0026":{"cargaHoraria":90}}}'
            path.write_text(previous, encoding="utf-8")
            with (
                patch("scripts.scrapers.coletar_componentes.DATA", data),
                patch("scripts.scrapers.coletar_componentes.read_semester", return_value="2026.2"),
                patch("scripts.scrapers.coletar_componentes.Sigaa"),
                patch("scripts.scrapers.coletar_componentes.search", side_effect=OSError("network unavailable")),
            ):
                with self.assertRaises(SystemExit) as error:
                    main([])
            self.assertEqual(error.exception.code, 1)
            self.assertEqual(path.read_text(encoding="utf-8"), previous)


if __name__ == "__main__":
    unittest.main()
