# Glossário

A página `/glossario/` usa `public/data/glossario/termos.json`. O arquivo começa
vazio; nenhuma definição de exemplo é publicada. Edite somente os dados para
adicionar termos. Busca, definições e links de localização funcionam no frontend.

## Formato

O objeto raiz tem `versao: 1` e `termos`, uma lista de objetos:

| Campo | Obrigatório | Conteúdo |
| --- | --- | --- |
| `id` | Sim | Identificador único estável, como um slug |
| `termo` | Sim | Nome completo |
| `descricao` | Sim | Definição em texto simples; aceita quebras de linha |
| `sigla` | Não | Abreviação exibida junto ao nome |
| `aliases` | Não | Lista de grafias, apelidos e nomes alternativos |
| `categoria` | Não | Categoria em texto livre |
| `localizacao` | Não | Objeto descrito abaixo |

`localizacao` aceita `nome`, `endereco`, `latitude` e `longitude`.
Prefira coordenadas conferidas do local ou de sua entrada. Latitude e longitude
são números decimais e devem ser fornecidas juntas. Também é possível informar
apenas o endereço completo. Sem coordenadas ou endereço, os links não aparecem.
Não são necessários URLs de mapa, chave de API ou geolocalização do visitante.

Somente termos com coordenadas ou endereço exibem “Ver localização”. O bloco
começa recolhido e pode ser expandido para consultar o local e abrir Google
Maps, Apple Maps ou Waze. Não há filtro de localização na busca. Links com endereço dependem
da busca do provedor; com coordenadas, o ponto é explícito. O Waze inicia uma
rota quando há coordenadas; com endereço, abre a busca. Não há mapa incorporado.

## Busca

Ignora caixa, acentos e pontuação; busca nome, sigla, aliases, definição e local.
Nome e sigla exatos têm prioridade. Permite uma edição/troca em palavras com
quatro ou mais caracteres e duas com oito ou mais. Não corrige automaticamente
siglas curtas para evitar confundir locais diferentes. Todos os termos de uma
consulta precisam corresponder. Resultados aproximados são identificados.

Os dados são renderizados como texto, sem HTML. IDs duplicados e coordenadas
inválidas interrompem o carregamento para não publicar destinos incorretos.
