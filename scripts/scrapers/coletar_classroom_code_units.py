"""Consulta todas as unidades e atualiza o cadastro completo de oferta e prefixos."""

import sys
from coletar_turmas import main

if __name__ == "__main__":
    main(["catalogo", *sys.argv[1:]])
