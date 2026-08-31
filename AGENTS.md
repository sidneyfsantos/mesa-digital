# AGENTS.md — Mesa Digital

## Objetivo do projeto

Construir uma plataforma SaaS multiempresa para atendimento em estabelecimentos com mesas, começando por restaurantes, bares, lanchonetes, cafeterias, confeitarias e negócios semelhantes.

O cliente final acessará o cardápio pelo QR Code da mesa, sem necessidade de instalar aplicativo.

A plataforma deve ser projetada desde o início para ser escalável, segura, resiliente e administrável pelo próprio estabelecimento.

---

## Estrutura do projeto

- frontend/  → aplicação web e PWA
- backend/   → API, regras de negócio e integrações
- infra/     → arquivos exclusivos da infraestrutura deste projeto
- docs/      → arquitetura, decisões e documentação
- scripts/   → scripts exclusivos deste projeto

---

## Limites obrigatórios

O Codex pode criar, alterar, remover e organizar arquivos dentro de:

/opt/mesa-digital

O Codex NÃO deve, sem autorização explícita do usuário:

- alterar arquivos fora de /opt/mesa-digital;
- modificar outros projetos existentes;
- modificar /opt/atlas;
- modificar ~/financeiro-automacao;
- alterar containers existentes;
- reiniciar Docker globalmente;
- alterar Portainer;
- alterar Traefik compartilhado;
- alterar Cloudflare ou Cloudflared;
- alterar firewall;
- alterar Tailscale;
- alterar Home Assistant;
- alterar n8n;
- alterar Evolution API;
- alterar Redis ou PostgreSQL compartilhados;
- alterar Nginx compartilhado;
- apagar volumes Docker;
- executar docker system prune;
- alterar DNS;
- alterar serviços systemd existentes;
- instalar pacotes globais sem autorização.

Antes de qualquer alteração de infraestrutura compartilhada, parar e solicitar autorização.

---

## Segurança

Nunca:

- salvar senhas no repositório;
- salvar tokens no repositório;
- salvar chaves privadas;
- commitar arquivos .env;
- expor credenciais em logs;
- usar credenciais de outros projetos;
- compartilhar banco ou schema com outro projeto sem autorização.

Usar .env.example para documentar variáveis necessárias.

---

## Arquitetura

O sistema deverá ser multi-tenant.

Cada estabelecimento deve ter isolamento lógico completo dos seus dados.

Nenhuma consulta deve permitir acesso aos dados de outro estabelecimento.

Principais domínios previstos:

- tenant/estabelecimento
- usuários
- perfis e permissões
- mesas
- QR Codes
- categorias
- produtos
- adicionais/complementos
- preços
- promoções
- pedidos
- itens do pedido
- cozinha/bar
- status de produção
- cancelamentos
- aprovação de cancelamentos
- auditoria
- relatórios
- configurações

---

## QR Code

Cada mesa deverá possuir identificação própria.

O QR Code deverá:

- abrir diretamente o cardápio daquele estabelecimento;
- identificar a mesa;
- não expor IDs internos previsíveis;
- poder ser reimpresso;
- poder ser invalidado/regenerado;
- utilizar identificador público seguro.

A geração e gestão dos QR Codes deve fazer parte do painel administrativo.

Não criar aplicativo separado exclusivamente para QR Code.

---

## Permissões

A plataforma deverá utilizar controle de acesso baseado em papéis/permissões.

Papéis iniciais previstos:

- proprietário/admin
- gerente
- garçom/atendente
- cozinha
- bar

Cancelamentos devem possuir controle específico.

Por padrão:

- garçom não cancela diretamente pedido produzido/enviado;
- garçom pode solicitar cancelamento;
- gerente/admin aprova ou rejeita;
- motivo é obrigatório;
- solicitante, aprovador, data/hora e motivo devem ficar registrados;
- eventos críticos devem gerar trilha de auditoria.

---

## Dados e histórico

Dados permanentes ficam no banco central.

O histórico não deve depender de cache local.

O sistema deverá preservar informação suficiente para gerar posteriormente relatórios por:

- dia
- semana
- mês
- ano
- mesa
- produto
- categoria
- atendente
- pedido
- cancelamento

Não destruir dados históricos simplesmente porque um produto foi desativado ou alterado.

Pedidos devem preservar snapshot das informações comerciais relevantes no momento da venda.

---

## Resiliência

Arquitetura principal: cloud-first.

O sistema deve ser projetado para permitir futuramente operação degradada/offline através de cache local/PWA e sincronização posterior.

Não implementar infraestrutura local complexa em cada restaurante no MVP.

A arquitetura não deve impedir futura implementação de:

- fila local;
- IndexedDB;
- sincronização;
- idempotência;
- resolução de conflitos;
- recuperação após perda temporária de conexão.

---

## Administração pelo cliente

O próprio estabelecimento deverá conseguir administrar:

- produtos;
- fotos;
- descrições;
- preços;
- disponibilidade;
- ativo/inativo;
- categorias;
- adicionais;
- promoções;
- mesas;
- QR Codes;
- usuários;
- permissões compatíveis com seu plano.

Alterações normais de catálogo não devem exigir intervenção técnica do fornecedor da plataforma.

---

## Desenvolvimento

Antes de implementar funcionalidades grandes:

1. verificar documentação em docs/;
2. verificar impacto multi-tenant;
3. verificar segurança;
4. verificar migrações;
5. verificar compatibilidade com funcionalidades existentes.

Evitar overengineering.

Priorizar MVP funcional, modular e evolutivo.

Não adicionar dependências desnecessárias.

Executar lint, testes e build quando aplicável.

Não fazer commit automaticamente sem solicitação do usuário.

---

## Regra de comunicação

Quando encontrar:

- risco arquitetural;
- alteração destrutiva;
- necessidade de modificar infraestrutura compartilhada;
- decisão que possa gerar lock-in relevante;
- incompatibilidade com requisito definido;

parar e explicar antes de executar.
