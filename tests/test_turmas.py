from copy import deepcopy
import json
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest

from scripts.scrapers.coletar_turmas import (
    atomic_json,
    collect,
    merge_subjects,
    parse_results,
    parse_units,
    payload,
    is_postgraduate,
    update_units,
    collect_catalog,
    read_semester,
    update_index,
    main,
)


def soup(html):
    return BeautifulSoup(html, "html.parser")


def result_html(semester="2026.2"):
    return soup(f"""<table class="listagem">
    <tr class="agrupador"><td><span class="tituloDisciplina">CIC0001 - COMPUTAÇÃO</span></td></tr>
    <tr class="linhaPar"><td>01</td><td>{semester}</td><td>ANA (30h)<br>JOÃO (30h)</td>
    <td>24M12 (10/08/2026 - 14/12/2026)<span class="popUp">Segunda e quarta</span></td>
    <td></td><td>0</td><td>--</td><td>ICC - SALA 01</td></tr></table>""")


def test_parse_classroom_preserves_source_values():
    subject, classroom = parse_results(result_html(), "2026.2")[0]
    assert subject == ("CIC0001", "COMPUTAÇÃO")
    assert classroom == {
        "numero": "01",
        "professores": [{"nome": "ANA", "cargaHoraria": 30}, {"nome": "JOÃO", "cargaHoraria": 30}],
        "horarios": ["24M12"],
        "local": "ICC - SALA 01",
        "vagas": 0,
        "matriculados": None,
    }


def test_missing_table_or_wrong_semester_is_not_empty_result():
    with pytest.raises(ValueError):
        parse_results(soup("<html>Sessão expirada</html>"), "2026.2")
    with pytest.raises(ValueError):
        parse_results(result_html("2026.1"), "2026.2")
    assert parse_results(soup('<ul class="erros"><li>Não foram encontrados resultados</li></ul>'), "2026.2") == []
    with pytest.raises(ValueError):
        parse_results(
            soup('<ul class="erros"><li>Não foram encontrados resultados</li><li>Erro interno</li></ul>'), "2026.2"
        )


def test_form_keeps_viewstate_and_dynamic_button():
    form = soup("""<form><input name="formTurma" value="formTurma">
    <input name="javax.faces.ViewState" value="state123">
    <input type="submit" name="dynamic123" value="Buscar">
    <select name="formTurma:inputDepto"><option value="0">Escolha</option>
    <option value="508">COMPUTAÇÃO</option></select></form>""").form
    assert parse_units(form) == {"508": "COMPUTAÇÃO"}
    values = payload(form, "508", "2026.2")
    assert values["dynamic123"] == "Buscar"
    assert values["javax.faces.ViewState"] == "state123"
    assert values["formTurma:inputNivel"] == ""
    assert values["formTurma:inputDepto"] == "508"
    assert values["formTurma:inputAno"] == "2026"
    assert values["formTurma:inputPeriodo"] == "2"


def test_duplicates_merge_units_but_distinct_rows_are_preserved():
    rows = parse_results(result_html(), "2026.2")
    merged = merge_subjects({"508": rows, "504": deepcopy(rows)})
    assert len(merged) == 1
    assert len(merged[0]["turmas"]) == 1
    assert merged[0]["turmas"][0]["unidades"] == ["508", "504"]
    other = deepcopy(rows)
    other[0][1]["vagas"] = 30
    variants = merge_subjects({"508": rows, "504": other})[0]["turmas"]
    assert len(variants) == 2
    assert {row["vagas"] for row in variants} == {0, 30}
    assert {row["numero"] for row in variants} == {"01"}


def test_partial_collection_fails():
    class Client:
        def search(self, unit, semester):
            if unit == "504":
                raise RuntimeError("Falha de conexão")
            return parse_results(result_html(), semester)

    with patch("scripts.scrapers.coletar_turmas.time.sleep"), pytest.raises(RuntimeError):
        collect("2026.2", {"508": "Computação", "504": "Exatas"}, Client())


def test_failed_json_write_preserves_previous_file(tmp_path):
    path = tmp_path / "2026-2.json"
    path.write_text('{"anterior":true}', encoding="utf-8")
    with pytest.raises(ValueError):
        atomic_json(path, {"invalid": float("nan")})
    assert path.read_text(encoding="utf-8") == '{"anterior":true}'
    assert list(tmp_path.iterdir()) == [path]


def test_unit_selection_uses_complete_catalog_without_network():
    assert is_postgraduate("PROGRAMA DE PÓS-GRADUAÇÃO EM COMPUTAÇÃO")
    assert not is_postgraduate("DEPTO CIÊNCIAS DA COMPUTAÇÃO")
    catalog = {
        "semesters": ["2026.2"],
        "source": "sigaa",
        "generated_at": "2026-10-17",
        "units": {"1": "DEPARTAMENTO A", "2": "DEPARTAMENTO B", "3": "PROGRAMA DE PÓS-GRADUAÇÃO"},
        "units_without_classes": [2],
    }
    result = update_units("2026.2", catalog)
    assert result["unidades"] == {"1": "DEPARTAMENTO A"}
    assert result["unidadesPosGraduacao"] == ["3"]
    assert result["unidadesSemTurmas"] == ["2"]
    with pytest.raises(ValueError):
        update_units("2027.1", catalog)


def test_complete_catalog_queries_every_unit_including_postgraduate():
    form = soup("""<form><select name="formTurma:inputDepto">
    <option value="1">DEPARTAMENTO A</option><option value="2">DEPARTAMENTO B</option>
    <option value="3">PROGRAMA DE PÓS-GRADUAÇÃO</option></select></form>""").form

    class Client:
        def form(self):
            return form

    rows = parse_results(result_html(), "2026.2")
    with patch("scripts.scrapers.coletar_turmas.query_units", return_value={"1": rows, "2": [], "3": rows}) as query:
        result = collect_catalog("2026.2", Client())
    assert set(query.call_args.args[1]) == {"1", "2", "3"}
    assert result["units_without_classes"] == [2]
    assert result["prefixes"] == {"CIC": [1, 3]}
    assert result["semesters"] == ["2026.2"]
    with patch("scripts.scrapers.coletar_turmas.query_units", return_value={"1": [], "2": [], "3": []}):
        with pytest.raises(ValueError):
            collect_catalog("2026.2", Client())


def test_alternative_names_for_same_code_are_preserved():
    rows = parse_results(result_html(), "2026.2")
    other = [(("CIC0001", "INTRODUÇÃO À COMPUTAÇÃO"), rows[0][1])]
    subject = merge_subjects({"508": rows, "504": other})[0]
    assert subject["nome"] == "COMPUTAÇÃO"
    assert subject["nomesAlternativos"] == ["INTRODUÇÃO À COMPUTAÇÃO"]
    assert len(subject["turmas"]) == 1


def test_semester_config_validates_value(tmp_path):
    path = tmp_path / "coleta.json"
    path.write_text('{"semestre":"2026.2"}', encoding="utf-8")
    assert read_semester(path) == "2026.2"
    for value in [{}, {"semestre": "2026.3"}, {"semestre": 2026.2}, []]:
        path.write_text(json.dumps(value), encoding="utf-8")
        with pytest.raises(ValueError):
            read_semester(path)


def test_index_preserves_other_semesters_without_duplicates():
    previous = {"semestre": "2026.1", "arquivo": "2026-1.json"}
    index = {"versao": 1, "semestres": [previous]}
    data = {"semestre": "2026.2", "atualizadoEm": "now", "disciplinas": [{"turmas": [{}, {}]}]}
    updated = update_index(update_index(index, data), data)
    assert len(updated["semestres"]) == 2
    assert updated["semestres"][0]["turmas"] == 2
    assert updated["semestres"][1] == previous
    assert index["semestres"] == [previous]


def test_semester_flag_removed_before_any_network_call():
    with patch("scripts.scrapers.coletar_turmas.Sigaa") as client:
        with pytest.raises(SystemExit) as error:
            main(["turmas", "--semestre", "2026.2"])
        assert error.value.code == 2
        client.assert_not_called()


def test_json_output_is_readable(tmp_path):
    path = tmp_path / "result.json"
    atomic_json(path, {"units": {"1": "Computação"}})
    assert '\n  "units": {' in path.read_text(encoding="utf-8")
    assert json.loads(path.read_text(encoding="utf-8")) == {"units": {"1": "Computação"}}
