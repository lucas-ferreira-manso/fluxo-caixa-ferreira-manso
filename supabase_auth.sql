-- =============================================
-- ADICIONAR SUPORTE A LOGIN — Execute no Supabase SQL Editor
-- =============================================

-- Atualiza as políticas para exigir autenticação
-- Primeiro remove as políticas abertas se existirem
drop policy if exists "Acesso público" on configuracoes;
drop policy if exists "Acesso público" on receitas;
drop policy if exists "Acesso público" on lancamentos;
drop policy if exists "Acesso público" on metas;
drop policy if exists "Acesso público" on orcamentos;

-- Habilita RLS em todas as tabelas
alter table configuracoes enable row level security;
alter table receitas enable row level security;
alter table lancamentos enable row level security;
alter table metas enable row level security;
alter table orcamentos enable row level security;

-- Cria políticas que permitem acesso apenas para usuários logados
-- Todos os usuários logados veem os mesmos dados (dados compartilhados do casal)
create policy "Apenas logados" on configuracoes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Apenas logados" on receitas for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Apenas logados" on lancamentos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Apenas logados" on metas for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Apenas logados" on orcamentos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
