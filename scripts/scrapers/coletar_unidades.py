"""Gera a seleção de unidades a partir do cadastro completo, sem consultar o SIGAA."""

import sys
from coletar_turmas import main

if __name__ == "__main__":
    main(["unidades", *sys.argv[1:]])
