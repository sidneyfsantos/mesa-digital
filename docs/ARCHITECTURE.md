# Arquitetura inicial — Mesa Digital

## 1. Status e finalidade

Este documento define a arquitetura inicial proposta para o Mesa Digital, uma plataforma SaaS multi-tenant, cloud-first, voltada a restaurantes, bares, lanchonetes, cafeterias, confeitarias e estabelecimentos similares com atendimento presencial configurável.

O documento orienta o MVP e as evoluções imediatamente previsíveis. Ele não é uma especificação completa de implementação. Decisões ainda não validadas estão identificadas como abertas e devem ser formalizadas posteriormente por ADRs (Architecture Decision Records).

## 2. Visão geral

O Mesa Digital será uma plataforma central única, atendendo muitos estabelecimentos. Cada estabelecimento será um tenant com isolamento lógico completo. Não haverá uma instalação da aplicação por cliente.

O consumidor acessará uma aplicação web responsiva, instalável opcionalmente como PWA, por meio de uma credencial de entrada, inicialmente um QR de mesa fixa ou de placa/comanda móvel. O painel administrativo e as telas operacionais serão acessados por usuários autenticados do estabelecimento. Pedidos confirmados serão persistidos no backend central e distribuídos em tempo real às estações pertinentes, como cozinha e bar.

A arquitetura inicial recomendada é um **monólito modular**, com frontend e backend implantáveis separadamente, PostgreSQL como fonte de verdade, armazenamento de objetos para imagens e Redis como componente auxiliar quando sua necessidade estiver comprovada. Essa abordagem reduz a complexidade operacional do MVP sem impedir a separação futura de módulos com carga ou ciclo de vida próprios.

```text
Consumidor (QR/PWA)        Equipe (painel/operação)
          |                           |
          +---------- HTTPS ----------+
                         |
                 Frontend Next.js
                         |
                 API NestJS modular
                  |       |       |
             PostgreSQL  Redis  Armazenamento
             (verdade)  (aux.)   de objetos
                  |
             Outbox/eventos
                  |
        WebSocket/SSE para operação
```

## 3. Objetivos arquiteturais

1. Garantir isolamento entre tenants em todas as camadas.
2. Preservar integridade, rastreabilidade e histórico comercial dos pedidos.
3. Entregar o pedido à operação com baixa latência, sem fazer do canal em tempo real a fonte de verdade.
4. Permitir administração autônoma do catálogo, pontos de atendimento, QR Codes, usuários e permissões.
5. Escalar horizontalmente os componentes stateless e evoluir módulos sem reescrever o produto.
6. Manter segurança, observabilidade, backup e recuperação como requisitos do produto desde o início.
7. Preparar idempotência, retry e futura operação degradada, sem implementar offline completo no MVP.
8. Evitar complexidade prematura, especialmente microserviços, infraestrutura local por restaurante e event sourcing integral.

## 4. Limites do sistema

### 4.1 Dentro do escopo

- cadastro e configuração do estabelecimento;
- usuários, papéis e permissões;
- categorias, produtos, fotos, preços, adicionais e promoções;
- disponibilidade e ativação de itens;
- pontos de atendimento fixos ou móveis e ciclo de vida de suas credenciais QR;
- cardápio público contextualizado por estabelecimento e origem do atendimento;
- abertura e fechamento operacional da sessão de atendimento;
- carrinho, confirmação e criação de múltiplas rodadas/pedidos na mesma sessão;
- roteamento operacional de itens para cozinha e bar;
- acompanhamento de estados do pedido e de seus itens;
- consumo consolidado da sessão e solicitação da conta para o atendimento;
- solicitação, aprovação ou rejeição de cancelamento;
- auditoria dos eventos críticos;
- base transacional que permita relatórios futuros.

### 4.2 Fora do MVP

- aplicação móvel nativa obrigatória para consumidores ou equipe;
- offline completo e sincronização bidirecional;
- infraestrutura local em cada estabelecimento;
- microserviços independentes por domínio;
- instalação dedicada por tenant;
- motor fiscal, emissão de documentos fiscais ou integrações fiscais;
- pagamentos online, adquirência, conciliação e divisão de pagamentos;
- estoque e ficha técnica avançados;
- reservas, delivery, pousadas ou generalização para segmentos não relacionados;
- BI analítico avançado e data warehouse;
- integrações com ERP, PDV, impressoras ou marketplaces, salvo decisão posterior de MVP.

As fronteiras de pagamento, fiscal e integrações externas devem ser mantidas explícitas para futura inclusão, sem modelá-las profundamente antes da definição de requisitos.

## 5. Análise da stack candidata

### 5.1 Frontend: Next.js e TypeScript

É uma escolha adequada. Permite uma aplicação responsiva/PWA, boa experiência de desenvolvimento e opções de renderização que ajudam tempo de carregamento e descoberta do cardápio. O painel e a operação podem compartilhar design system e tipos, sem necessariamente compartilhar regras de autorização.

Cuidados:

- autorização nunca deve depender apenas do frontend;
- cache de páginas públicas deve variar por tenant, versão do catálogo e contexto válido do QR;
- dados específicos do contexto de entrada não devem vazar por cache compartilhado;
- PWA deve começar com cache seguro de assets e leituras apropriadas, sem tratar mutações offline como concluídas.

Não há motivo técnico concreto para substituir Next.js no início.

### 5.2 Backend: NestJS e TypeScript

É adequado para um monólito modular, com módulos de domínio, validação, guards, filas e comunicação em tempo real. Compartilhar a linguagem com o frontend reduz atrito, mas não autoriza compartilhar diretamente entidades de persistência ou confiar em tipos TypeScript como validação de entrada.

Cuidados:

- manter regras de negócio nos módulos de aplicação/domínio, não em controllers;
- evitar acoplamento excessivo a decorators e ao ORM nas regras centrais;
- estabelecer limites de módulos e contratos internos claros;
- processamentos assíncronos devem ser executados por workers, ainda que no mesmo repositório.

Não há motivo técnico concreto para alterar NestJS no MVP.

### 5.3 PostgreSQL

É recomendado como banco transacional e fonte oficial de verdade. Oferece transações, constraints, índices, JSONB para extensões pontuais e Row-Level Security (RLS) como defesa adicional de isolamento.

O modelo inicial deve ser relacional. JSONB não deve substituir entidades centrais consultáveis. Particionamento físico só deve ser adotado com evidência de volume e padrão de acesso.

### 5.4 Redis

É apropriado como componente auxiliar para rate limiting distribuído, presença/conexões em tempo real, cache efêmero e, se escolhido, filas de jobs. Não é fonte de verdade e sua indisponibilidade não deve corromper pedidos ou histórico.

Redis não precisa ser obrigatório no primeiro incremento se houver apenas uma instância e baixa carga, mas os contratos não devem depender de memória local. Antes de produção com múltiplas réplicas, rate limiting e fan-out em tempo real exigirão um mecanismo compartilhado.

### 5.5 WebSocket ou equivalente

WebSocket é adequado para comunicação bidirecional e expansão futura. Para o MVP, **Server-Sent Events (SSE)** também é uma alternativa mais simples se as telas operacionais apenas receberem eventos e enviarem comandos por HTTP.

A decisão entre WebSocket e SSE permanece aberta e deve considerar proxy, reconexão, observabilidade, volume de conexões e necessidade real de bidirecionalidade. Em ambos os casos, o cliente deve reconciliar estado pela API após conexão ou reconexão.

### 5.6 Docker

É adequado para empacotar os componentes do projeto e produzir ambientes reproduzíveis. Não implica criar uma instalação por tenant nem compartilhar bancos ou recursos de outros projetos. A topologia de produção, o provedor e a orquestração permanecem abertos.

## 6. Componentes e responsabilidades

### 6.1 Aplicação do consumidor

- resolve o QR Code e obtém contexto público limitado do tenant e da origem;
- apresenta catálogo, detalhes, adicionais e promoções válidas;
- mantém o carrinho local temporário;
- envia uma confirmação idempotente ao backend;
- exibe o estado aceito pelo servidor;
- não possui privilégios administrativos e não confia em preços calculados no cliente.

### 6.2 Painel administrativo

- gerencia catálogo, disponibilidade, pontos de atendimento, QR Codes e usuários;
- aplica permissões por ação;
- apresenta histórico e auditoria conforme autorização;
- não acessa diretamente banco, Redis ou armazenamento de objetos.

### 6.3 Aplicação operacional

- fornece visões filtradas para cozinha, bar, atendimento e gerência;
- recebe sinalização em tempo real e consulta o estado canônico pela API;
- registra transições com comandos idempotentes e usuário responsável;
- separa itens por estação de produção.

As três experiências podem inicialmente residir no mesmo projeto Next.js, desde que rotas, bundles, autenticação e responsabilidades permaneçam claramente separadas.

### 6.4 API central modular

Módulos iniciais propostos:

- **Identity & Access:** autenticação, sessões/tokens, usuários, papéis e permissões;
- **Tenancy:** estabelecimento, configurações, plano e contexto de tenant;
- **Catalog:** categorias, produtos, preços, adicionais, fotos e disponibilidade;
- **Promotions:** regras promocionais e validade;
- **Entry Contexts:** mesas, credenciais públicas e regeneração;
- **Service Sessions:** sessão de atendimento, consumo consolidado, solicitação da conta e fechamento operacional;
- **Ordering:** carrinho validado, precificação, rodadas/pedidos vinculados à sessão, itens e estados;
- **Production:** roteamento, cozinha, bar e estados de preparação;
- **Cancellation:** solicitações, decisões e políticas de aprovação;
- **Realtime:** publicação, autorização e retomada/reconciliação;
- **Audit:** trilha imutável no uso normal;
- **Reporting:** consultas operacionais e futuras projeções analíticas;
- **Media:** metadados e autorização para imagens em armazenamento de objetos;
- **Notifications/Jobs:** tarefas assíncronas e retries.

Módulos não devem consultar tabelas de outros módulos indiscriminadamente. Alterações entre módulos passam por serviços de aplicação ou contratos internos. O banco pode ser compartilhado no monólito, mas a propriedade lógica das tabelas deve ser clara.

### 6.5 Workers assíncronos

Workers processarão tarefas que não precisam bloquear a resposta, como geração de derivados de imagens, notificações, projeções e publicação de eventos. Jobs devem ser idempotentes, ter retry com backoff, limite de tentativas e fila de falhas inspecionável.

### 6.6 Armazenamento de objetos

Fotos devem residir em armazenamento de objetos compatível com a estratégia de nuvem; o PostgreSQL mantém metadados, proprietário, estado e referências. Uploads devem validar tipo, tamanho e conteúdo, usar nomes/chaves não previsíveis e, preferencialmente, URLs assinadas ou um pipeline controlado.

## 7. Arquitetura lógica e regras de dependência

Cada módulo deve separar, proporcionalmente à sua complexidade:

1. interface de entrada (HTTP, tempo real ou job);
2. casos de uso e transações;
3. regras e invariantes de domínio;
4. adaptadores de persistência e integrações.

Controllers autenticam o contexto, validam a entrada e chamam casos de uso. Casos de uso aplicam autorização, regras e transações. Repositórios sempre recebem o contexto de tenant para dados tenant-scoped. Eventos externos são publicados somente após o commit correspondente.

A implantação pode começar com:

- frontend web stateless;
- API stateless com endpoint de tempo real;
- worker;
- PostgreSQL;
- Redis quando necessário;
- armazenamento de objetos.

API e worker podem derivar do mesmo código do monólito modular, mas executar processos distintos.

## 8. Estratégia multi-tenant

### 8.1 Modelo inicial recomendado

Usar **banco e schema compartilhados**, com uma coluna `tenant_id` obrigatória em toda entidade pertencente a estabelecimento. Essa abordagem facilita atualizações centrais e utiliza recursos eficientemente para muitos tenants.

O isolamento deve ser aplicado em profundidade:

- o tenant é derivado de sessão autenticada, host/slug validado ou credencial pública de QR; nunca de um `tenant_id` arbitrário confiado do corpo da requisição;
- todo acesso tenant-scoped inclui `tenant_id` explícito;
- chaves únicas e relacionamentos incluem `tenant_id` quando necessário, impedindo referências cruzadas;
- índices principais começam por `tenant_id` quando o padrão de consulta justificar;
- PostgreSQL RLS é recomendado como segunda barreira, mediante validação operacional e de pool de conexões;
- jobs, caches, eventos, logs e canais em tempo real carregam e validam o contexto de tenant;
- testes automatizados negativos verificam tentativas de acesso cruzado;
- usuários que participarem de mais de um tenant terão associações explícitas por tenant.

Não usar um schema ou banco por tenant no MVP. Essa alternativa aumenta provisionamento, migrações, conexões, observabilidade e backups. O modelo deve, porém, permitir no futuro mover tenants de alta exigência para células ou bancos dedicados sem alterar os conceitos do domínio.

### 8.2 Contexto e relações

Entidades globais devem ser raras e justificadas. Uma associação `tenant_user` vincula a identidade à organização e aos papéis locais. Relações entre entidades tenant-scoped devem garantir que pai e filho pertencem ao mesmo tenant, preferencialmente por constraints compostas, não apenas por código.

O acesso de suporte da própria plataforma, se criado, não deve ser um papel comum do tenant. Exige fluxo separado, privilégio mínimo, justificativa, expiração e auditoria reforçada.

## 9. Modelo conceitual inicial

O modelo abaixo representa conceitos, não nomes finais de tabelas:

- **Tenant/Estabelecimento:** identidade, status, configurações, fuso horário e moeda;
- **User/Usuário:** identidade autenticável global;
- **TenantUser:** vínculo do usuário com tenant, estado e papéis;
- **Role, Permission, RolePermission:** RBAC e permissões atribuídas no tenant;
- **TenantEntryMode/Modo de entrada do tenant:** habilita `FIXED_TABLE`, `MOBILE_TAB` ou ambos para o estabelecimento;
- **ServicePoint/Ponto de atendimento:** recurso físico reutilizável, tenant-scoped, classificado como mesa fixa ou placa/comanda móvel; não é sessão nem pedido;
- **EntryCredential/Credencial de entrada:** mecanismo revogável que resolve um contexto público; no MVP é um QR vinculado a um `ServicePoint`, mantendo versões históricas;
- **ServiceSession/Sessão de atendimento:** agregado operacional criado atomicamente com o primeiro pedido aceito. Registra tenant, origem/contexto, estado, abertura, fechamento, versão e totais consolidados, sem depender estruturalmente de mesa;
- **BillRequest/CheckRequest/Solicitação da conta:** evento operacional persistente de uma sessão existente, com solicitante, estado, instante, atendimento responsável e resolução;
- **Category:** nome, ordenação, disponibilidade e estado;
- **Product:** dados atuais do item comercial e categoria;
- **ProductPrice:** preço vigente e eventual período de validade;
- **ModifierGroup/Grupo de adicionais:** cardinalidade mínima/máxima e regras;
- **ModifierOption/Adicional:** opção e preço atual;
- **ProductModifierGroup:** associação do produto a grupos permitidos;
- **Promotion:** regra, vigência, prioridade e escopo;
- **ProductionStation/Estação:** cozinha, bar ou futuras estações configuráveis;
- **ProductRouting:** estação responsável por produto/item;
- **Order/Pedido:** rodada de consumo vinculada obrigatoriamente à `ServiceSession`, com tenant, origem, estado agregado, totais, timestamps e chave idempotente;
- **OrderItem/Item do pedido:** quantidade, estado, estação e snapshot comercial;
- **OrderItemModifier:** adicionais escolhidos e seus snapshots;
- **ServiceSessionStatusHistory/OrderStatusHistory/ItemStatusHistory:** transições independentes, ator, instante e origem;
- **CancellationRequest:** alvo, solicitante, motivo, estado e decisão;
- **AuditEvent:** ator, ação, alvo, tenant, instante, correlação e dados seguros;
- **OutboxEvent:** evento transacional aguardando publicação;
- **MediaAsset:** metadados e vínculo da imagem armazenada externamente.

Campos monetários devem usar decimal de precisão definida ou unidades inteiras da menor moeda, nunca ponto flutuante. Timestamps são armazenados em UTC; apresentação e agregações locais usam o fuso configurado do estabelecimento. Exclusão lógica ou estados inativos preservam referências históricas.

### 9.1 Decisão: catálogo próprio e publicação contextual

Cada tenant mantém categorias, produtos, preços atuais, disponibilidade, grupos de modificadores reutilizáveis, opções, ordenação e identidade visual próprios. `active` define se um item pertence ao catálogo publicado; `available` informa se um produto ativo pode ser escolhido naquele momento. Valores monetários do catálogo usam unidades inteiras da menor moeda. A camada futura de Ordering copiará nomes, preços e modificadores aceitos para snapshots imutáveis; vendas históricas nunca serão reconstruídas a partir do catálogo atual.

Imagens são `MediaAsset` tenant-scoped: o banco guarda metadados e uma storage key gerada pelo servidor, não o binário. O adaptador local atende desenvolvimento e pode ser substituído por object storage sem alterar o domínio. Uploads aceitam somente formatos e limites explícitos, validam assinatura do conteúdo e ignoram o nome fornecido pelo cliente. Identidade visual permite nome, logo, capa e cor principal validada, sem CSS arbitrário.

O cardápio público deriva tenant e ponto de atendimento exclusivamente de uma `EntryCredential` válida. Sua projeção omite IDs internos de tenant, credenciais e dados administrativos, inclui somente entidades ativas e mantém produtos temporariamente indisponíveis visíveis e identificados. Navegação e escolhas locais de modificadores pertencem à fronteira de catálogo: não criam `ServiceSession`, `Order` ou qualquer registro operacional.

### 9.2 Decisão: entrada configurável e fluxo operacional único

O domínio separa quatro conceitos que não podem ser fundidos:

1. **método/credencial de entrada**, que resolve de forma segura um contexto público;
2. **recurso físico**, quando existir, como mesa fixa ou placa/comanda móvel;
3. **sessão de atendimento**, que concentra o ciclo operacional;
4. **pedido**, que sempre pertence a uma sessão.

No MVP, `service_points.kind` aceita `FIXED_TABLE` e `MOBILE_TAB`, e `tenant_entry_modes` define quais deles cada tenant utiliza. `entry_credentials` contém a credencial QR e referencia o ponto de atendimento. Uma placa/comanda móvel não possui fluxo próprio: ao fechar sua sessão, ela volta a ficar disponível para uma nova sessão; disponibilidade operacional será derivada da ausência de sessão ativa, não armazenada como verdade concorrente no cadastro.

`ServiceSession` é o nome do agregado futuro. Ela deverá guardar a origem de maneira explícita e imutável, incluindo o `service_point_id` quando aplicável e snapshots legíveis suficientes para histórico. Pedidos, produção, conta, cancelamentos e fechamento dependem da sessão, nunca diretamente de `ServicePoint`. Métodos futuros que não usem recurso físico poderão criar outro resolvedor de entrada sem introduzir colunas específicas no núcleo de pedidos.

Resolver uma credencial apenas fornece contexto. Não cria `ServiceSession`, não reserva ponto de atendimento e não autentica administradores.

## 10. Fluxo completo do atendimento

1. O consumidor lê o QR Code e abre uma URL HTTPS com credencial pública opaca.
2. O backend resolve a credencial, confirma que está ativa e associa internamente tenant e contexto de origem.
3. Resolver ou escanear o QR nunca cria uma `ServiceSession`: o frontend recebe apenas o contexto público necessário de tenant e contexto de origem e consulta o catálogo publicado daquele tenant.
4. O backend só localiza a sessão ativa durante as operações que a exigem. Se ainda não houver sessão, ela será criada exclusivamente quando o primeiro pedido válido for aceito.
5. O consumidor escolhe produtos e adicionais. O carrinho local é uma intenção, não uma cotação autoritativa.
6. Antes da confirmação, o backend revalida a credencial, o ponto de atendimento, eventual sessão ativa, disponibilidade, regras de adicionais, promoções e preços.
7. O frontend envia o comando de criação com uma chave idempotente gerada no cliente e mantém essa chave nos retries da mesma intenção.
8. Se for o primeiro pedido aceito, o backend cria `ServiceSession`, `Order`, `OrderItem`s, snapshots, históricos iniciais, totais e outbox em uma única transação. Falha ou rejeição não pode deixar sessão vazia. Pedidos iniciais concorrentes convergem para a única sessão do par tenant/origem por constraint e tratamento transacional do conflito. Nas rodadas seguintes, o backend vincula atomicamente o novo `Order` à sessão `OPEN` existente.
9. O backend responde com o mesmo pedido se receber novamente a mesma chave e o mesmo payload. Chave reutilizada com payload incompatível gera conflito.
10. Após o commit, o publicador processa a outbox e sinaliza as telas operacionais pertinentes.
11. Cada `OrderItem` possui estação/roteamento como atributo e/ou evento e evolui independentemente. Ao atingir `READY`, gera imediatamente disponibilidade/notificação para a estação e o atendimento, sem aguardar os demais itens da rodada.
12. Os estados operacionais agregáveis do `Order` são derivados deterministicamente dos itens. Se materializados por desempenho, são projeções reconstruíveis mantidas na mesma transação, nunca uma segunda fonte de verdade; estados de governança não deriváveis podem permanecer explícitos.
13. Somente enquanto a `ServiceSession` estiver `OPEN`, novas rodadas de qualquer origem criam novos pedidos vinculados à mesma sessão. O consumo consolidado reúne todos os pedidos e ajustes válidos da sessão, sem reescrever seus históricos.
14. Na ação **pedir a conta**, o backend exige uma sessão ativa em `OPEN`, registra uma `BillRequest`/`CheckRequest` idempotente, muda a sessão para `CHECK_REQUESTED` e notifica atendimento/gerência. Sem sessão ativa, a operação é inaplicável e rejeitada, sem criar sessão ou chamado. Enquanto houver solicitação ativa, retries retornam o mesmo registro e nenhuma nova rodada é aceita, independentemente de sua origem.
15. Garçom, gerente ou administrador com a capability necessária pode retirar a solicitação. A operação resolve o registro ativo e retorna a sessão atomicamente a `OPEN`; uma solicitação posterior cria novo registro e evento histórico.
16. No MVP, o pagamento ocorre fora da plataforma. Após o acerto externo e a conclusão dos pedidos/itens conforme a política, um usuário com capability fecha a `ServiceSession`, encerrando operacionalmente o atendimento e liberando o ponto de atendimento reutilizável.

Falha na publicação em tempo real não reverte um pedido aceito. A outbox será retentada, e a operação deve poder consultar pedidos pendentes pela API.

O vínculo `Order -> ServiceSession` é obrigatório e imutável. O tenant do pedido e o contexto confiável do comando devem coincidir com os da sessão; a aplicação não aceita um identificador arbitrário de sessão. `Order` não referencia mesa ou comanda como dependência estrutural. Nenhum pedido pode ser associado posteriormente a uma sessão fechada. O consumo consolidado é calculado exclusivamente a partir de pedidos, itens, cancelamentos, descontos e ajustes persistidos que pertençam à sessão.

## 11. Estados da sessão, do pedido e do item

Os estados finais devem ser validados com a operação real. A proposta inicial é:

### 11.1 Sessão de atendimento

```text
OPEN -> CHECK_REQUESTED -> CLOSING -> CLOSED
  ^            |
  +------------+
```

- **OPEN:** atendimento ativo e apto a receber novas rodadas;
- **CHECK_REQUESTED:** conta solicitada e atendimento avisado; bloqueia toda nova rodada até retirada explícita e continua sendo uma condição operacional, não financeira;
- **CLOSING:** fechamento operacional em andamento, sem aceitar novas rodadas;
- **CLOSED:** atendimento encerrado e eventual ponto de atendimento reutilizável liberado segundo as regras do estabelecimento.

A retirada operacional resolve a solicitação ativa e retorna a sessão a `OPEN` enquanto o fechamento não tiver sido iniciado. `CLOSED` é terminal sem transição normal ou excepcional para `OPEN`. Correções posteriores usam registros ou ajustes compensatórios com capability específica e auditoria, preservando integralmente a sessão original; novo atendimento no mesmo ponto sempre cria uma nova `ServiceSession`. Nenhum estado representa pagamento processado pela plataforma no MVP.

### 11.2 Pedido

```text
RECEIVED -> CONFIRMED -> IN_PRODUCTION -> READY -> COMPLETED
    |          |              |            |
    +----------+--------------+------------+-> CANCELLATION_REQUESTED
                                                       |
                                           (rejeitado: volta ao estado anterior)
                                                       |
                                                    CANCELLED
```

- **RECEIVED:** persistido e aguardando aceite/regra operacional;
- **CONFIRMED:** aceito para atendimento;
- **IN_PRODUCTION:** estado agregado indicando que ao menos um item ativo entrou em produção sem que todos tenham atingido estado posterior aplicável;
- **READY:** estado agregado indicando que todos os itens ativos relevantes estão prontos ou em estado posterior compatível;
- **COMPLETED:** rodada concluída segundo a regra do estabelecimento, sem implicar fechamento da sessão ou pagamento;
- **CANCELLATION_REQUESTED:** há solicitação pendente que bloqueia ou condiciona ações conforme política;
- **CANCELLED:** pedido integralmente cancelado com registro de governança.

### 11.3 Item

```text
ACCEPTED -> IN_PREPARATION -> READY -> DELIVERED
    |              |            |
    +--------------+------------+-> CANCELLATION_REQUESTED -> CANCELLED
```

- **ACCEPTED:** persistido e aceito para a estação definida por atributo/evento de roteamento;
- **IN_PREPARATION:** produção iniciada;
- **READY:** produção finalizada, com disponibilidade/notificação imediata sem esperar outros itens do pedido;
- **DELIVERED:** entregue/servido;
- **CANCELLATION_REQUESTED:** cancelamento pendente;
- **CANCELLED:** cancelado sem remoção histórica.

`ServiceSession`, `Order` e `OrderItem` possuem máquinas de estado distintas e históricos próprios; não se infere todo o estado apenas de timestamps. O item é a unidade de trabalho da estação e suas transições independem das transições de itens enviados a outras estações. Roteamento não é estado operacional. O estado agregado do pedido resume a rodada para acompanhamento, mas nunca substitui, homogeneíza ou apaga estados individuais. Estados operacionais do pedido são derivados deterministicamente dos itens; a tabela completa de derivação fica para a modelagem detalhada. Transições inválidas são rejeitadas. Cancelamento parcial deve recalcular os totais do pedido e da sessão de forma auditável e preservar valores originais, cancelados e efetivos. O efeito de cancelamento após produção e o significado operacional exato de `COMPLETED` permanecem decisões abertas.

## 12. RBAC e autorização

Papéis iniciais são modelos configuráveis, não condicionais espalhadas pelo código:

| Papel | Capacidades iniciais propostas |
| --- | --- |
| Proprietário/admin | administração completa do tenant, usuários, permissões, catálogo, pontos de atendimento e aprovações |
| Gerente | operação, catálogo e aprovações; ações sensíveis de propriedade podem ser reservadas |
| Garçom/atendente | consultar e operar atendimentos/pedidos; solicitar cancelamento; sem aprovação privilegiada |
| Cozinha | visualizar e atualizar apenas itens das estações de cozinha permitidas |
| Bar | visualizar e atualizar apenas itens das estações de bar permitidas |

Permissões granulares sugeridas incluem `catalog.read`, `catalog.manage`, `service_point.read`, `service_point.manage`, `qr.manage`, `session.read`, `session.withdraw_check_request`, `session.start_closing`, `session.close`, `session.correct_closed`, `order.read`, `order.create`, `order.transition`, `cancellation.request`, `cancellation.approve`, `user.manage`, `role.manage`, `audit.read` e `report.read`.

Autorização avalia: identidade, tenant ativo, vínculo ativo, capability, escopo operacional e estado do recurso. Operações de sessão nunca dependem somente do nome fixo de um papel; os papéis padrão recebem capabilities conforme a política do tenant. RBAC pode ser complementado por atributos simples, como estação atribuída, sem introduzir um motor genérico de políticas no MVP. Alterações de papéis e permissões são auditadas. O sistema deve impedir autoelevação indevida e preservar ao menos um administrador recuperável por tenant.

## 13. Cancelamentos e aprovações

Cancelamento é um workflow persistente, não uma simples atualização de status.

1. Um usuário autorizado solicita cancelamento de pedido ou item, informando motivo obrigatório.
2. O sistema registra solicitante, tenant, alvo, estado do alvo, instante e justificativa.
3. Uma política determina se há cancelamento direto ou aprovação. Por padrão, garçom solicita; gerente ou admin decide, especialmente após envio/produção.
4. O aprovador não pode alterar silenciosamente a solicitação. Ele aprova ou rejeita, com instante e observação quando aplicável.
5. A decisão e a transição do alvo ocorrem atomicamente, com histórico e outbox.
6. Rejeição restaura/libera o fluxo conforme o estado anterior registrado; aprovação marca o cancelamento e ajusta valores sem apagar registros.

Devem ser impedidas decisões duplicadas, aprovação sem permissão e, por padrão, autoaprovação quando segregação de funções for exigida. Concorrência será controlada por versão/lock transacional. Motivos podem combinar código categorizado para relatório e texto obrigatório. Toda solicitação e decisão gera auditoria.

## 14. QR Codes e contexto público

Cada ponto de atendimento possui uma ou mais versões históricas de credencial, com no máximo uma ativa conforme a política. O QR contém URL e token aleatório criptograficamente forte, opaco e não sequencial. Não contém `tenant_id`, `service_point_id` ou outros IDs internos previsíveis.

Recomendação:

- gerar ao menos 128 bits de entropia com gerador seguro;
- persistir somente hash/HMAC pesquisável do token quando o fluxo permitir, reduzindo impacto de vazamento do banco;
- comparar tokens de forma segura;
- permitir reimpressão da mesma versão ativa sem criar credencial nova;
- regenerar criando nova versão e revogando a anterior;
- rejeitar imediatamente versões revogadas;
- registrar emissão, reimpressão, rotação e revogação em auditoria;
- aplicar rate limiting e monitoramento à resolução;
- nunca usar o QR como autorização administrativa.

Um QR fotografado pode ser reutilizado fora do local; token opaco não resolve sozinho presença física. No MVP, o risco deve ser reduzido com confirmação clara do contexto de atendimento, limites de abuso e possibilidade de rotação. Controles adicionais de presença ou sessão são decisão aberta e devem equilibrar fraude e atrito.

O QR identifica contexto de entrada, não autentica uma pessoa. Após resolução, pode ser emitida sessão pública curta e limitada, vinculada ao contexto, evitando propagar a credencial original em todas as requisições e logs.

## 15. Comunicação em tempo real

O canal em tempo real transporta **notificações de mudança**, não substitui persistência nem garante sozinho processamento exatamente uma vez.

- conexões de equipe são autenticadas e autorizadas por tenant e estação;
- canais/tópicos são segregados por tenant, sem aceitar nomes arbitrários do cliente;
- eventos carregam identificador, tipo, versão, instante e referência opaca ao agregado;
- payloads contêm apenas o necessário e nunca credenciais;
- consumidores toleram eventos repetidos e fora de ordem;
- heartbeat, expiração de sessão e revogação são previstos;
- ao conectar/reconectar, o cliente consulta um snapshot ou mudanças desde cursor suportado;
- outbox transacional impede a janela “pedido salvo, evento perdido”.

Em múltiplas réplicas, o fan-out precisa de broker/adaptador compartilhado, possivelmente Redis Streams/PubSub ou broker dedicado. Pub/Sub efêmero isoladamente não oferece replay; a outbox e a reconciliação pela API continuam necessárias.

## 16. Persistência e transações

PostgreSQL é a fonte de verdade para dados permanentes. Operações que alteram pedido, estado, cancelamento e auditoria correlata devem possuir limites transacionais explícitos.

As invariantes de `ServiceSession` exigem garantias no banco e no caso de uso, não apenas verificações prévias no frontend:

- resolver o QR não escreve `ServiceSession`; a primeira sessão e todo o primeiro pedido são criados no mesmo commit, sem sessão vazia em caso de rejeição ou rollback;
- uma constraint/índice único parcial, ou mecanismo transacional equivalente, permite no máximo uma sessão operacional não encerrada por `(tenant_id, service_point_id)` quando a origem física exigir exclusividade, fazendo pedidos iniciais concorrentes convergirem para ela;
- chaves estrangeiras compostas e validação tenant-scoped garantem que `ServiceSession`, credencial e eventual ponto de atendimento pertençam ao mesmo tenant; `Order` referencia somente a sessão do mesmo tenant;
- criação de pedido valida e altera a versão/lock lógico da sessão na mesma transação, aceitando novas rodadas apenas em `OPEN` e impedindo associação a sessão fechada ou diferente;
- criação atômica da primeira sessão/pedido, nova rodada, solicitação e retirada da conta, aprovação de cancelamento que altere o consolidado e início/conclusão do fechamento participam da mesma estratégia consistente de versão ou lock da `ServiceSession`;
- o início do fechamento muda atomicamente a sessão para `CLOSING`; comandos concorrentes disputam a mesma versão ou lock, de modo que apenas uma ordem válida prevaleça;
- o fechamento é rejeitado se houver `OrderItem` diferente de `DELIVERED` ou `CANCELLED` — inclusive `READY` —, cancelamento pendente ou `Order` não terminal;
- pedido integralmente cancelado permanece terminal no histórico e contribui zero para o total efetivo;
- uma sessão fechada nunca retorna a `OPEN`; correção excepcional exige capability, justificativa e ajuste compensatório auditado, sem alterar ou apagar o fechamento original;
- no máximo uma `BillRequest`/`CheckRequest` fica ativa por sessão; retry retorna a ativa, retirada a resolve junto com a transição para `OPEN`, e nova solicitação posterior cria outro registro histórico;
- `BillRequest`/`CheckRequest`, fechamento e criação de pedido são idempotentes e registram histórico/outbox no mesmo commit de sua alteração canônica.

O servidor calcula o consolidado canônico. Pedidos integralmente cancelados e itens com cancelamento aprovado contribuem zero para o total efetivo, preservando valores e histórico originais; cancelamento pendente ainda não altera o valor efetivo. O modelo mantém conceitualmente:

- `original_total`: soma comercial original antes dos cancelamentos e descontos posteriores aplicáveis;
- `cancelled_total`: parcela retirada por cancelamentos aprovados;
- `discount_total`: descontos válidos aplicados;
- `additional_service_total`: adicionais, taxas ou serviço quando aplicáveis;
- `effective_total`: valor final efetivo segundo a equação monetária canônica.

Valores consolidados materializados são projeções reconstruíveis pelos registros detalhados, atualizadas consistentemente com as operações que mudam seus componentes. Política de arredondamento, taxas, serviço e a equação exata entre componentes serão definidas na modelagem de precificação.

Princípios:

- constraints de banco complementam validações da aplicação;
- migrations são versionadas, revisáveis, compatíveis com implantação gradual e testadas em cópia sem dados sensíveis;
- mudanças destrutivas seguem expandir-migrar-contrair, nunca remoção imediata;
- concorrência usa controle otimista por `version` onde adequado e locks curtos em invariantes críticas;
- paginação por cursor é preferível em fluxos volumosos;
- consultas sempre têm limites e filtros tenant-scoped;
- réplicas de leitura só serão introduzidas quando houver necessidade e tolerância clara à defasagem;
- dados essenciais não dependem de Redis, memória de processo ou IndexedDB.

## 17. Histórico e snapshots comerciais

Ao criar um pedido, cada item guarda snapshot suficiente para reproduzir a venda, independentemente do catálogo atual:

- ID interno de referência, quando existente;
- nome e descrição comercial relevante;
- categoria e seu nome no momento da venda;
- quantidade e unidade;
- preço unitário de lista;
- adicionais escolhidos, nomes e preços;
- promoção/desconto aplicado e regra resumida/versionada;
- impostos/taxas, quando entrarem no produto;
- subtotal, desconto e total calculados;
- estação de produção e observações relevantes;
- moeda e precisão.

Snapshots são dados do pedido, não cópias consultadas dinamicamente do produto. Alterar ou desativar catálogo não os modifica. Referências ao catálogo facilitam análises, mas relatórios históricos usam também os snapshots para manter significado quando entidades mudam.

Estados e decisões possuem tabelas de histórico append-only no uso normal. Correções administrativas não sobrescrevem silenciosamente fatos; geram eventos compensatórios ou novas versões auditáveis.

## 18. Auditoria

Auditoria deve registrar eventos de segurança e negócio críticos, incluindo:

- login, falhas relevantes, encerramento e revogação de sessão;
- criação/alteração de usuários, papéis e permissões;
- alterações de preços, promoções e disponibilidade;
- criação, rotação e revogação de QR;
- abertura, solicitação da conta, início de fechamento, fechamento e tentativas rejeitadas de reabertura de sessão;
- transições manuais relevantes de sessão/pedido/item;
- solicitações e decisões de cancelamento;
- acessos privilegiados da plataforma;
- exportações de dados e mudanças de configuração sensível.

Cada evento inclui `tenant_id`, ator e tipo de ator, ação, alvo, resultado, timestamp UTC, correlation/trace ID, origem segura e metadados mínimos. Não registrar senhas, tokens, credenciais completas, dados de pagamento ou payloads pessoais desnecessários.

A trilha deve ser append-only para a aplicação comum, com acesso restrito e política de retenção. Integridade reforçada por hash encadeado ou armazenamento externo imutável pode ser avaliada conforme requisitos regulatórios; não é obrigatória para o primeiro MVP.

Auditoria de negócio não substitui logs técnicos, e logs técnicos não substituem auditoria.

## 19. Segurança

### 19.1 Identidade e sessão

- autenticação administrativa com provedor/biblioteca madura, hashing de senha resistente e política de recuperação segura;
- cookies `HttpOnly`, `Secure` e `SameSite` são preferíveis para web; se tokens forem usados, terão curta duração, audience/issuer, rotação e revogação apropriadas;
- proteção CSRF para autenticação baseada em cookie e mutações;
- MFA deve ser previsto e priorizado para proprietário/admin, com momento do MVP ainda aberto;
- sessões e vínculos desativados perdem acesso prontamente.

### 19.2 Aplicação e API

- HTTPS obrigatório, headers de segurança e CSP compatível com a aplicação;
- validação por schema em toda entrada e serialização explícita de saída;
- consultas parametrizadas e ORM usado sem interpolação insegura;
- proteção contra XSS, CSRF, SSRF e uploads maliciosos;
- rate limiting por IP, identidade, tenant e credencial pública conforme rota;
- limites de tamanho, timeout e paginação;
- CORS restritivo;
- mensagens de erro não revelam existência de recurso de outro tenant;
- dependências e imagens verificadas continuamente.

### 19.3 Dados e segredos

- criptografia em trânsito e em repouso pela plataforma de nuvem;
- segredos fornecidos em runtime por mecanismo apropriado, nunca no repositório ou imagem;
- `.env.example` documenta apenas nomes e valores fictícios;
- privilégios mínimos para banco, storage e filas;
- ambientes e credenciais separados;
- dados pessoais minimizados, com retenção e descarte definidos antes da produção.

Uma análise de ameaças deve anteceder o lançamento público, com foco em fuga entre tenants, abuso de QR, duplicação de pedido, elevação de privilégio e exposição de imagens/dados.

## 20. Cache e futura operação offline

### 20.1 MVP

- cache HTTP/CDN apenas para assets e conteúdo público cuja chave inclua corretamente tenant e versão;
- dados de mesa, sessão e permissões não entram em cache público compartilhado;
- Redis pode armazenar resultados reconstruíveis com TTL e namespace contendo ambiente, tenant e versão;
- invalidação ocorre por alteração/versionamento de catálogo;
- queda do cache degrada desempenho, não integridade;
- service worker pode cachear o shell e leituras seguras, mas não deve afirmar que um pedido foi aceito sem resposta persistida do servidor.

### 20.2 Evolução offline/degradada

A API deve aceitar IDs públicos de comando e chaves idempotentes geradas pelo cliente. Registros sincronizáveis devem possuir versão, timestamps do servidor e semântica de conflito definida. IndexedDB poderá guardar catálogo versionado, carrinho e uma fila local explícita.

Uma futura fila local deve distinguir claramente:

- intenção pendente de envio;
- enviada sem confirmação local;
- confirmada pelo servidor;
- rejeitada por conflito ou regra de negócio.

Retry usa a mesma chave idempotente. Conflitos de preço, disponibilidade e QR expirado são resolvidos pelo servidor e exigem confirmação do usuário quando alteram valor ou conteúdo. Transições operacionais não devem usar “última gravação vence” indiscriminadamente; a versão esperada detecta concorrência.

Offline completo não faz parte do MVP, e nenhuma cache local é histórico oficial.

## 21. Idempotência e duplicidade

Criação de pedido e demais comandos críticos aceitam `Idempotency-Key` ou identificador equivalente com alta entropia. O servidor armazena, no mesmo tenant e escopo:

- chave;
- identidade/sessão ou contexto público;
- hash canônico da requisição;
- estado do processamento;
- referência e resposta essencial;
- prazo de retenção compatível com o máximo período de retry.

Uma constraint única garante um vencedor concorrente. Repetição com a mesma chave e payload retorna o resultado original; mesma chave com payload diferente retorna conflito. O frontend não gera nova chave ao repetir a mesma confirmação por timeout ou reconexão.

Transições de estado usam `command_id` e/ou versão esperada. Workers e consumidores de outbox mantêm deduplicação por `event_id`. A garantia prática é processamento **pelo menos uma vez com efeitos idempotentes**, não “exactly once” distribuído.

O backend recalcula preços e totais, e a transação garante que um pedido não seja parcialmente criado. Métricas de colisão, retry e conflito devem ser observadas.

## 22. Observabilidade

Três sinais principais devem ser correlacionados:

- **logs estruturados:** serviço, ambiente, tenant pseudonimizado, request/correlation ID, usuário pseudonimizado, ação, resultado e erro seguro;
- **métricas:** taxa e latência HTTP, erros, conexões em tempo real, atraso da outbox, jobs e retries, pool do banco, cache, pedidos criados/duplicados e tempo por estado;
- **traces distribuídos:** frontend/backend quando viável, API, banco, worker e publicação de evento.

Alertas iniciais devem cobrir indisponibilidade, aumento de 5xx, latência, falha de criação de pedidos, acúmulo de outbox, falha de worker, saturação do banco, desconexões anormais e falha de backup.

Dashboards devem permitir diagnóstico por serviço e tenant sem expor dados de um tenant a outro. Nunca usar IDs de tenant como rótulo de métrica de cardinalidade ilimitada sem estratégia. Health checks diferenciam processo vivo e aptidão para receber tráfego. SLOs e metas numéricas permanecem abertos antes do piloto.

## 23. Backups e recuperação

- backups automáticos do PostgreSQL com criptografia e retenção definida;
- point-in-time recovery é recomendado para produção;
- armazenamento de objetos usa versionamento/replicação ou política equivalente conforme provedor;
- configuração crítica e infraestrutura exclusiva do projeto são versionadas sem segredos;
- restaurações são testadas periodicamente em ambiente isolado e registradas;
- runbook define responsável, detecção, contenção, restauração e validação;
- backup preserva isolamento e acesso mínimo, com auditoria de restauração;
- Redis não precisa de recuperação para dados reconstruíveis; qualquer uso não reconstruível seria erro arquitetural.

RPO e RTO devem ser definidos antes do piloto de produção. Backup sem teste de restauração não é considerado estratégia comprovada. Recuperação de exclusão lógica acidental e comprometimento de credenciais deve constar nos exercícios.

## 24. Relatórios e evolução dos dados

O modelo transacional deve manter dimensões e fatos suficientes para consultar por período, tenant, mesa, produto, categoria, atendente, pedido, estação e cancelamento. Timestamps de negócio, atores, snapshots e históricos não podem ser descartados.

No MVP, relatórios operacionais podem consultar o PostgreSQL com índices e réplicas quando necessário. Consultas pesadas não devem competir indefinidamente com pedidos. Conforme volume, eventos/outbox podem alimentar projeções, tabelas agregadas ou um data warehouse sem alterar o modelo transacional básico.

Mudanças em nomes ou categorias não reclassificam silenciosamente o passado: relatórios devem declarar se usam dimensão atual ou snapshot da venda.

## 25. Estratégia de evolução

1. Implementar o monólito modular com contratos claros e banco central.
2. Validar fluxo real com poucos estabelecimentos piloto e medir carga, falhas e operação.
3. Adicionar Redis, filas ou réplicas somente quando o requisito de implantação/carga justificar, preservando interfaces desde o início.
4. Escalar horizontalmente frontend, API e workers stateless.
5. Criar projeções de leitura para relatórios e operação quando consultas transacionais deixarem de ser adequadas.
6. Separar um módulo em serviço apenas diante de necessidade concreta de escala, isolamento, equipe ou ciclo de implantação.
7. Evoluir para células de tenants se escala ou requisitos contratuais exigirem reduzir raio de impacto.
8. Introduzir capacidades offline por fases, começando por leitura e fila explícita de intenções idempotentes.

APIs e eventos relevantes devem ser versionados por compatibilidade. Implantações usam mudanças retrocompatíveis e migrations expand/contract. Feature flags tenant-scoped podem apoiar pilotos, com governança para não se tornarem configuração permanente descontrolada.

Atualizações são implantadas centralmente e beneficiam todos os tenants; variações por plano ou piloto são capacidades/configurações, não forks de código por cliente.

## 26. Escopo claro do MVP

O MVP deve entregar:

1. onboarding/configuração básica do estabelecimento;
2. autenticação segura da equipe e cinco papéis iniciais com permissões essenciais;
3. gestão de categorias, produtos, fotos, preços, adicionais, disponibilidade e ativo/inativo;
4. gestão de mesas fixas e placas/comandas móveis, com geração, reimpressão, revogação e regeneração de QR Codes;
5. cardápio responsivo acessado pelo QR, detalhes, adicionais e carrinho;
6. resolução segura do QR sem criar sessão e abertura atômica da única `ServiceSession` da origem física junto com o primeiro pedido aceito;
7. validação e criação idempotente de múltiplas rodadas/pedidos vinculados à mesma sessão, com snapshots comerciais;
8. visão operacional em tempo real com itens independentes e separação configurável entre cozinha e bar;
9. estados separados de sessão, pedido agregado derivado e item independente por estação, com notificação imediata de item `READY`;
10. consumo consolidado da sessão e ação **pedir a conta** como solicitação operacional ao atendimento;
11. fechamento operacional da sessão após acerto realizado fora da plataforma, sem processamento de pagamento no MVP;
12. solicitação, aprovação/rejeição e histórico de cancelamento;
13. auditoria dos eventos críticos;
14. consulta básica de sessões/pedidos e filtros operacionais/históricos;
15. observabilidade, backups testáveis e controles de segurança mínimos para produção.

Promoções no MVP devem começar com um conjunto pequeno de regras explicitamente definido. PWA pode incluir instalabilidade e cache seguro de assets/leitura, mas fila de mutações offline e resolução completa de conflitos ficam fora.

Critério essencial: um pedido confirmado deve existir centralmente, pertencer à sessão correta, não ser duplicado por retry, aparecer por item na estação correta e manter seu histórico mesmo após mudanças no catálogo. A sessão deve consolidar corretamente todas as rodadas, emitir a solicitação da conta e só ser fechada quando suas invariantes operacionais forem satisfeitas.

## 27. Riscos arquiteturais e mitigação

| Risco | Impacto | Mitigação proposta |
| --- | --- | --- |
| Falha de filtro causa vazamento entre tenants | Crítico | contexto confiável, repositórios tenant-scoped, constraints, RLS, testes negativos e revisão |
| QR copiado/usado fora do local | Pedidos indevidos | token forte, rotação, rate limit, confirmação do contexto de atendimento e estudo de prova de presença |
| Retry cria pedidos duplicados | Cobrança/produção duplicada | chave idempotente, constraint única, hash de payload e resposta reaproveitada |
| Duas sessões ficam abertas no mesmo ponto de atendimento | Consumo dividido e mesa inconsistente | criação da sessão junto com o primeiro pedido, unicidade por tenant/origem e tratamento de conflito |
| Pedido é associado à sessão errada | Vazamento lógico e conta incorreta | vínculo composto tenant/origem/sessão, contexto confiável e validação transacional |
| Sessão fecha com pedidos ou itens ativos | Produção órfã e consumo incompleto | guarda de fechamento, consulta/lock dos filhos ativos e política explícita |
| Novo pedido concorre com conta/fechamento | Rodada perdida ou incluída depois do bloqueio | versão/lock comum da sessão e transições atômicas que determinam um único vencedor válido |
| Sessão fechada é reaberta indevidamente | Histórico e ocupação do ponto de atendimento inconsistentes | estado terminal sem retorno, nova sessão para novo atendimento e ajustes compensatórios auditados |
| Consolidação da sessão diverge dos pedidos | Conta operacional incorreta | cálculo canônico no servidor, mesma transação, precisão monetária e reconciliação pelos detalhes |
| Evento em tempo real é perdido | Operação não vê pedido | outbox, retry, consulta/reconciliação e alerta de atraso |
| WebSocket/SSE vira fonte de verdade | Divergência | PostgreSQL canônico e ressincronização pela API |
| Catálogo mutável altera histórico | Relatórios incorretos | snapshots imutáveis em pedido/item/adicional/promoção |
| Cancelamento concorrente com produção | Estado e totais inconsistentes | máquina de estados, versionamento/lock e transação auditada |
| Monólito perde modularidade | Evolução lenta | propriedade de módulos, contratos e testes de limites |
| Microserviços prematuros | Custo operacional e falhas distribuídas | monólito modular até haver evidência |
| Consultas analíticas afetam pedidos | Latência/indisponibilidade | índices, limites, projeções e futura réplica/warehouse |
| Redis se torna dependência crítica indevida | Perda de dados/indisponibilidade | somente dados efêmeros/reconstruíveis e degradação planejada |
| Uploads expõem conteúdo malicioso | Segurança/custo | validação, limites, isolamento, URLs controladas e varredura a definir |
| Migração bloqueia banco | Indisponibilidade | expand/contract, ensaio, observação e rollback compatível |
| Crescimento de auditoria/outbox | Custo e desempenho | retenção, arquivamento, índices e monitoramento |
| Fuso horário gera relatório incorreto | Divergência diária | UTC no armazenamento e fuso explícito por tenant nas agregações |
| Provedor gera lock-in | Custo de migração | interfaces para storage/broker e PostgreSQL padrão; aceitar serviços gerenciados quando benefício superar custo |

## 28. Decisões ainda abertas

As decisões abaixo precisam ser tomadas antes da fase indicada, com ADR quando forem arquiteturalmente relevantes:

1. **Provedor e região de nuvem**, requisitos de residência de dados e topologia de ambientes — antes da infraestrutura de produção.
2. **Plataforma de implantação/orquestração** e serviços gerenciados utilizados — antes do primeiro ambiente compartilhado.
3. **WebSocket ou SSE** e o adaptador de fan-out/replay — antes da implementação do tempo real.
4. **ORM/query builder e estratégia concreta de RLS/contexto de conexão** — antes da modelagem física e da primeira migration.
5. **Solução de autenticação**, formato de sessão e inclusão de MFA no MVP — antes do módulo de identidade.
6. **Modelo de usuário em múltiplos tenants** e fluxo de convite/recuperação — antes do onboarding.
7. **Tabela determinística completa de derivação do estado do `Order`**, incluindo combinações de itens entregues, cancelados e em cancelamento — definir na modelagem detalhada.
8. **Regras de cancelamento**, incluindo autoaprovação, cancelamento parcial, efeito financeiro e cancelamento após produção/entrega — antes do workflow.
9. **Prova de presença/sessão pública do QR**, validade e controles contra uso remoto — antes do piloto público.
10. **Escopo das promoções do MVP** e precedência/acúmulo de descontos — antes do módulo de promoções.
11. **Política de preço**, moeda, arredondamento, taxas, serviço e equação exata dos componentes do consolidado — antes da precificação.
12. **Configuração de estações e roteamento**, inclusive produtos enviados a mais de uma estação — antes da tela operacional.
13. **Broker/fila de jobs** e momento em que Redis se torna obrigatório — antes de múltiplas réplicas ou jobs críticos.
14. **Armazenamento e processamento de imagens**, CDN, moderação/varredura e limites — antes de uploads em produção.
15. **Retenção de idempotência, auditoria, logs e dados pessoais** — antes da produção.
16. **RPO, RTO, frequência/retenção de backups e cadência de testes de restauração** — antes do piloto de produção.
17. **SLOs, alertas e ferramentas de observabilidade** — antes da operação assistida.
18. **LGPD**, papéis de controlador/operador, base legal, atendimento de direitos e política de privacidade — antes de coletar dados reais.
19. **Necessidade futura de pagamento, fiscal, impressão ou integração com PDV** — fora do MVP atual; definir somente antes de expandir essa fronteira.
20. **Estratégia de slug/domínio do tenant e cache de catálogo** — antes das rotas públicas definitivas.
21. **Matriz inicial de capabilities de sessão por papel padrão e limites dos ajustes compensatórios em sessão fechada** — antes da implementação do atendimento.

## 29. Princípios de decisão futura

- isolamento de tenant e integridade do pedido prevalecem sobre conveniência de implementação;
- a fonte de verdade é central e transacional;
- componentes distribuídos devem assumir retry e duplicidade;
- complexidade nova exige requisito ou medição concreta;
- alterações irreversíveis, lock-in relevante e infraestrutura compartilhada exigem avaliação explícita;
- decisões grandes são registradas em ADRs, incluindo contexto, alternativas, consequência e possibilidade de reversão.
