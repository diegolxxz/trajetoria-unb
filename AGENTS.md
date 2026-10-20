# Convenções do projeto

- `public/` é a raiz do site publicado; `dist/` é gerado. Preserve as URLs ao mover arquivos. Código Python e referências ficam fora de `public/`.
- Preserve `local/dados.json` e as chaves existentes do localStorage. Testes de escrita usam diretórios temporários; verificações no navegador usam um contexto isolado.
- Exiba números em pt-BR com até quatro casas decimais, usando `AppUnB.numero`. Preserve a precisão original nos dados, cálculos, ordenação e cache.
- Mantenha tabelas compactas, idiomas em linhas separadas e colunas totalmente vazias ocultas conforme os filtros. Estilos comuns ficam em `public/css/interface.css`; editais compartilham `public/js/intercambio.js`.
- Ao importar ou atualizar editais, leia `docs/dados.md`: fórmulas e referências são específicas de cada seleção. Cruze documentos pela matrícula e registre fontes e estimativas, sem inventar turnos.
- Ao alterar a coleta de turmas, leia `docs/dados.md`: selecione unidades no JSON antes da busca; mantenha o filtro de nível do SIGAA vazio. Cadastro de unidades é atualizado separadamente da coleta frequente. Preserve variantes de turma e diferencie `null` de zero.
- Modo avançado de Turmas está retirado até a coleta desses dados existir. Era o checkbox `modoAvancadoTurmas` à direita de “Mais filtros” em `public/turmas/index.html`; `public/js/turmas.js` alternava o aviso `detalhesModo`. Ao retomar, use essa posição e o bloco `avancado` descrito em `docs/dados.md`.
- Após mudar caminhos, confira servidor, scrapers, imports dos testes, lint e build. Execute as verificações do README e confirme que a publicação contém apenas arquivos públicos.
