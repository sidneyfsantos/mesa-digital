# Segurança das credenciais QR de mesa

Cada QR contém um token opaco de 32 bytes gerado por CSPRNG e codificado em base64url sem padding. O banco persiste somente o SHA-256 hexadecimal do token. SHA-256 é adequado aqui porque a entrada já possui 256 bits aleatórios; HMAC acrescentaria gestão de segredo sem ganho necessário para o MVP.

O token puro é retornado somente ao gerar ou regenerar a credencial e nunca deve ser registrado em logs. A rotação bloqueia a linha da mesa, revoga a credencial anterior e cria a nova na mesma transação. Um índice único parcial garante no máximo uma credencial não revogada por mesa.

A resolução pública usa uma função SQL `SECURITY DEFINER` de superfície mínima, com `search_path` fixo, permissão pública revogada e retorno limitado aos nomes públicos do estabelecimento e da mesa. Isso permite resolver o hash antes de conhecer o tenant sem enfraquecer a RLS das tabelas administrativas.

Rate limiting deve ser aplicado à rota pública antes do lançamento público. Ele não foi acoplado a memória local nem a Redis neste bloco.
