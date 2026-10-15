import unittest
import json
from pathlib import Path
from wsgiref.util import setup_testing_defaults
import route
from bottle import default_app


def get(caminho):
    env = {}
    setup_testing_defaults(env)
    env['PATH_INFO'] = caminho
    resposta = {}
    def start(status, headers, exc_info=None):
        resposta.update(status=status, headers=dict(headers))
    resultado = default_app()(env, start)
    try:
        resposta['body'] = b''.join(resultado)
    finally:
        if hasattr(resultado, 'close'):
            resultado.close()
    return resposta


class RotasTest(unittest.TestCase):
    def test_paginas_e_redirecionamentos(self):
        catalogo = json.loads((Path(route.ROOT) / 'data/editais/index.json').read_text(encoding='utf-8'))
        for caminho in ['/ira', '/intercambio', *['/intercambio/' + e['slug'] for e in catalogo]]:
            redirecionamento = get(caminho)
            self.assertIn(redirecionamento['status'].split()[0], ('302', '303'))
            self.assertTrue(redirecionamento['headers']['Location'].endswith(caminho + '/'))
            resposta = get(caminho + '/')
            self.assertTrue(resposta['status'].startswith('200'))
            self.assertIn(b'<html', resposta['body'])
        self.assertIn(get('/')['status'].split()[0], ('302', '303'))
        self.assertTrue(get('/intercambio/inexistente/')['status'].startswith('404'))

    def test_recursos_das_paginas(self):
        for caminho in ['/js/common.js', '/js/calculos.js', '/js/functionality.js', '/js/intercambio.js', '/css/intercambio.css', '/data/editais/index.json', '/data/editais/edital-int-n-7-2026.json', '/data/editais/edital-int-n-7-2026.csv']:
            self.assertTrue(get(caminho)['status'].startswith('200'), caminho)

    def test_favicons(self):
        for caminho, tipo in [('/favicon.ico', 'image/x-icon'), ('/favicon.svg', 'image/svg+xml')]:
            with self.subTest(caminho=caminho):
                resposta = get(caminho)
                self.assertTrue(resposta['status'].startswith('200'))
                self.assertEqual(resposta['headers']['Content-Type'], tipo)
                self.assertEqual(resposta['body'], (route.ROOT / caminho.lstrip('/')).read_bytes())

    def test_sincronizacao_apenas_no_servidor_python(self):
        marcador = b'<meta name="sincronizar-arquivo" content="true">'
        self.assertIn(marcador, get('/ira/')['body'])
        self.assertNotIn(marcador, (route.ROOT / 'ira/index.html').read_bytes())


if __name__ == '__main__':
    unittest.main()
