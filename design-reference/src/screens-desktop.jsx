// Desktop screens for Estoque Fácil

// ─── 01 LOGIN / Picker (FoodCamp style) ──────────────────────
function ScreenLogin() {
  return (
    <div className="ef-shell" style={{ gridTemplateColumns: '80px 1fr' }}>
      <aside className="ef-sidebar" style={{ padding: '18px 8px', alignItems: 'center', background: 'var(--rm-red)', borderRight: 'none' }}>
        <div className="ef-brand" style={{ flexDirection: 'column', padding: 0, border: 'none', margin: 0, gap: 6 }}>
          <div className="ef-mark" style={{ width: 42, height: 42, fontSize: 22, background: '#fff', color: 'var(--rm-red)', border: '2px solid #fff' }}>EF</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 32, width: '100%' }}>
          {[
          { i: 'tag', l: 'Etiquetas', a: true },
          { i: 'calendar', l: 'Validades' },
          { i: 'home', l: 'Restaurantes' }].
          map((it) =>
          <div key={it.l} style={{
            padding: '14px 4px', textAlign: 'center', cursor: 'pointer',
            color: '#fff', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 600,
            background: it.a ? 'rgba(255,255,255,.16)' : 'transparent',
            borderRadius: 2, border: it.a ? '1px solid rgba(255,255,255,.3)' : '1px solid transparent'
          }}>
              <Icon name={it.i} size={20} stroke={1.6} />
              <div style={{ marginTop: 6 }}>{it.l}</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 'auto', color: '#fff', opacity: .6, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 600, paddingTop: 12, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>RM</div>
      </aside>
      <div className="ef-main">
        <Topbar />
        <div className="ef-content" style={{ padding: '40px 56px', background: '#fafaf7' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="ef-eyebrow" style={{ justifyContent: 'center', marginBottom: 14 }}>ETAPA 01 · Identificação</div>
            <h1 className="ef-page-title" style={{ fontSize: 44 }}>Quem é <em>você?</em></h1>
            <p className="ef-page-sub" style={{ margin: '8px auto 0' }}>Selecione o seu nome para iniciar a operação.</p>
          </div>
          <div className="ef-pick-grid">
            {FUNCIONARIOS.map((f) =>
            <div key={f.id} className="ef-pick">
                <div className="av">{f.initials}</div>
                <div>{f.name}</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button className="ef-btn ef-btn-ghost ef-btn-sm">
              <Icon name="chevL" size={14} /> Voltar
            </button>
          </div>
        </div>
      </div>
    </div>);

}

// ─── 02 DASHBOARD HOME — variation A (cards 3-up, original Suflex layout) ──
function ScreenHomeA() {
  const cards = [
  { i: 'printer', t: 'Impressão em grupo', d: 'Imprima múltiplos produtos através da funcionalidade de impressão em grupo.', cta: 'Fazer impressão', primary: true },
  { i: 'calendar', t: 'Exclusão de etiquetas', d: 'Exclua etiquetas já utilizadas e mantenha o controle de seus produtos.', cta: 'Por que indisponível?', disabled: true },
  { i: 'calc', t: 'Contagem de produtos', d: 'Confira todos os produtos impressos disponíveis em sua cozinha.', cta: 'Por que indisponível?', disabled: true },
  { i: 'diamond', t: 'Produtos controlados', d: 'Monitore todos os produtos ativos no nosso sistema.', cta: 'Ver controlados' },
  { i: 'truck', t: 'Recebimento de produtos', d: 'Registre os produtos e suas temperaturas durante o recebimento.', cta: 'Fazer recebimento' },
  { i: 'report', t: 'Relatórios de operação', d: 'Consulte indicadores e exporte planilhas para a contabilidade.', cta: 'Ver relatórios' }];

  return (
    <DesktopShell active="home">
      <PageHead
        eyebrow="DAL 1984 · NATAL · RIO GRANDE DO NORTE"
        title='Bem-vindo, <em>Paulo.</em>'
        sub="Senta aí, a gente já vai. Hoje é 1º de maio · 14:32 · Capim Macio."
        action={<div style={{ display: 'flex', gap: 8 }}><button className="ef-btn ef-btn-ghost"><Icon name="history" size={14} /> Histórico</button><button className="ef-btn ef-btn-primary"><Icon name="plus" size={14} /> Nova ação</button></div>} />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="ef-stat"><div className="ef-stat-eye">Etiquetas hoje</div><div className="ef-stat-num" style={{ fontFamily: "Manrope" }}>147</div><div className="ef-stat-trend">↑ 12% vs. ontem</div></div>
        <div className="ef-stat"><div className="ef-stat-eye">Vencendo em 24h</div><div className="ef-stat-num" style={{ color: 'var(--rm-red)' }}>8</div><div className="ef-stat-trend down">3 críticas</div></div>
        <div className="ef-stat"><div className="ef-stat-eye">Recebimentos</div><div className="ef-stat-num">3</div><div className="ef-stat-trend">2 conformes</div></div>
        <div className="ef-stat"><div className="ef-stat-eye">Última contagem</div><div className="ef-stat-num" style={{ fontSize: 24 }}>13 jan</div><div className="ef-stat-trend">por Ana Rita</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {cards.map((c) =>
        <div className="ef-card" key={c.t}>
            <div className="ef-card-head">
              <div className="ef-card-icon"><Icon name={c.i} size={22} /></div>
              <div style={{ flex: 1 }}>
                <h3 className="ef-card-title">{c.t}</h3>
                <p className="ef-card-desc">{c.d}</p>
              </div>
            </div>
            <button className={`ef-btn ${c.disabled ? 'ef-btn-ghost' : c.primary ? 'ef-btn-primary' : ''}`} style={{ width: '100%', justifyContent: 'center' }}>
              {c.disabled && <Icon name="help" size={13} />}
              {c.cta}
              {!c.disabled && <Icon name="arrow" size={14} className="arrow" />}
            </button>
          </div>
        )}
      </div>
    </DesktopShell>);

}

// ─── 02 DASHBOARD HOME — variation B (editorial / receita format) ──────
function ScreenHomeB() {
  return (
    <DesktopShell active="home">
      <div style={{ borderTop: '6px solid var(--rm-ink)', borderBottom: '1px solid var(--rm-rule-strong)', padding: '18px 0', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="ef-eyebrow" style={{ margin: 0, color: 'var(--rm-ink-2)' }}>EST. MCMLXXXIV · UNIDADE 01 · CAPIM MACIO · QUI 01 MAI 2026</div>
        <div className="ef-eyebrow" style={{ margin: 0, color: 'var(--rm-ink-2)' }}>EDIÇÃO · MAI/26 · Nº 147</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 48, alignItems: 'start' }}>
        <div>
          <div className="ef-eyebrow">A casa hoje</div>
          <h1 className="ef-page-title" style={{ fontSize: 64, lineHeight: .95 }}>Boa tarde, <em>Paulo.</em><br />A pizza <em>já vai.</em></h1>
          <p className="ef-page-sub" style={{ fontSize: 16, marginTop: 18, maxWidth: '52ch' }}>
            Massa descansando há 36h. Forno em 380°C. Vamos imprimir as etiquetas do almoço — você cuida do resto.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="ef-btn ef-btn-primary ef-btn-lg"><Icon name="printer" size={16} /> Imprimir agora <Icon name="arrow" size={16} className="arrow" /></button>
            <button className="ef-btn ef-btn-ghost ef-btn-lg"><Icon name="calc" size={16} /> Iniciar contagem</button>
          </div>
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px dashed var(--rm-rule-strong)' }}>
            <div className="ef-eyebrow" style={{ marginBottom: 12 }}>Tarefas do turno</div>
            {[
            { t: 'Imprimir etiquetas para o almoço', s: '14 produtos · pendente', icon: 'printer' },
            { t: 'Contagem semanal de Proteínas', s: '14 itens · 0 contados', icon: 'calc' },
            { t: 'Receber pedido CEASA', s: 'previsto 16h · Joana', icon: 'truck' }].
            map((t, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px dashed var(--rm-rule)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--rm-mid)', minWidth: 24 }}>0{i + 1}</span>
                <Icon name={t.icon} size={18} style={{ color: 'var(--rm-green)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.t}</div>
                  <div style={{ fontSize: 11, color: 'var(--rm-mid)', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: 2 }}>{t.s}</div>
                </div>
                <Icon name="arrow" size={14} style={{ color: 'var(--rm-green)' }} />
              </div>
            )}
          </div>
        </div>
        <div>
          <div style={{ background: 'var(--rm-cream)', border: '1px solid var(--rm-rule-strong)', borderRadius: 2, padding: 24 }}>
            <div className="ef-eyebrow">Validades · próximas 48h</div>
            <h3 className="ef-card-title" style={{ fontSize: 24, margin: '8px 0 14px' }}>8 etiquetas <em style={{ color: 'var(--rm-red)' }}>vencendo</em></h3>
            {[
            { n: 'Mussarela Fatiada', q: '2,4 kg', t: 'Resfriado', d: 'em 6h', alert: true },
            { n: 'Molho Pelado', q: '1,8 kg', t: 'Resfriado', d: 'em 14h' },
            { n: 'Camarão Pizza', q: '3,2 kg', t: 'Congelado', d: 'em 42h' }].
            map((v, i) =>
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px dashed var(--rm-rule-strong)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.n}</div>
                  <div style={{ fontSize: 11, color: 'var(--rm-mid)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{v.q} · {v.t}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 18, color: v.alert ? 'var(--rm-red)' : 'var(--rm-ink)' }}>{v.d}</div>
              </div>
            )}
            <button className="ef-btn ef-btn-ghost" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>Ver todas <Icon name="arrow" size={14} /></button>
          </div>
          <div style={{ marginTop: 18, background: 'var(--rm-ink)', color: 'var(--rm-cream)', padding: 24, borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <div className="ef-eyebrow" style={{ color: 'var(--rm-gold)' }}>Forno · agora</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 56, lineHeight: 1, marginTop: 6 }}>380<span style={{ fontSize: 24, color: 'var(--rm-gold)' }}>°C</span></div>
            <div style={{ fontSize: 12, color: 'rgba(246,236,211,.7)', marginTop: 8, fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>MASSA · 36H · LEVEDURA · OK</div>
          </div>
        </div>
      </div>
    </DesktopShell>);

}

// ─── 02 DASHBOARD HOME — variation C (compact ops table) ──────────────
function ScreenHomeC() {
  return (
    <DesktopShell active="home">
      <PageHead
        eyebrow="Painel operacional"
        title="Hoje na <em>cozinha</em>"
        sub="Visão rápida do que precisa acontecer agora." />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 28 }}>
        {[
        { l: 'Etiquetas hoje', v: '147', t: '' },
        { l: 'A vencer 24h', v: '8', t: 'red' },
        { l: 'Recebimentos', v: '3', t: '' },
        { l: 'Em produção', v: '12', t: '' },
        { l: 'Funcionários ativos', v: '9', t: '' },
        { l: 'Forno', v: '380°C', t: 'gold' }].
        map((s) =>
        <div key={s.l} className="ef-stat" style={{ padding: '14px 16px' }}>
            <div className="ef-stat-eye">{s.l}</div>
            <div className="ef-stat-num" style={{ fontSize: 28, color: s.t === 'red' ? 'var(--rm-red)' : s.t === 'gold' ? 'var(--rm-gold)' : 'var(--rm-ink)' }}>{s.v}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
        <div className="ef-card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--rm-rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="ef-card-title" style={{ fontSize: 17 }}>Ações sugeridas</h3>
            <span className="ef-badge">6 pendentes</span>
          </div>
          <table className="ef-table">
            <thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th></th></tr></thead>
            <tbody>
              {[
              ['Imprimir etiquetas almoço', 'Ana Rita', 'em 30min', 'primary'],
              ['Contar Proteínas (semanal)', 'Felipe', 'hoje', ''],
              ['Receber CEASA — hortifruti', 'Joana', '16:00', ''],
              ['Excluir etiquetas vencidas', 'Auto', 'em 6h', 'red'],
              ['Conferir massas pizza', 'Tiago', 'amanhã', '']].
              map((r, i) =>
              <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td><span className={`ef-badge ${r[3] === 'red' ? 'ef-badge-red' : r[3] === 'primary' ? '' : 'ef-badge-mute'}`}>{r[2]}</span></td>
                  <td style={{ textAlign: 'right' }}><Icon name="arrow" size={14} style={{ color: 'var(--rm-green)' }} /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="ef-card">
          <h3 className="ef-card-title" style={{ fontSize: 17 }}>Atalhos</h3>
          <div className="ef-divider" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['printer', 'Imprimir'], ['calc', 'Contar'], ['truck', 'Receber'], ['diamond', 'Controlados'], ['tag', 'Etiquetas'], ['report', 'Relatório']].map(([i, l]) =>
            <button key={l} className="ef-btn ef-btn-ghost" style={{ justifyContent: 'flex-start', height: 48 }}>
                <Icon name={i} size={16} /> {l}
              </button>
            )}
          </div>
        </div>
      </div>
    </DesktopShell>);

}

// ─── FUNCIONARIOS list ─────────────────────────────────
function ScreenFuncionarios({ onCreate }) {
  return (
    <DesktopShell active="funcionarios" expanded={['cadastros']}>
      <PageHead
        eyebrow="Cadastros · Funcionários"
        title="<em>Quem</em> faz a casa rodar"
        sub="Equipe de Capim Macio. 12 ativos, 3 com login de gestor."
        action={<button className="ef-btn ef-btn-primary" onClick={onCreate}><Icon name="plus" size={14} /> Criar funcionário</button>} />
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div className="ef-search" style={{ flex: 'unset', maxWidth: 320 }}>
          <Icon name="search" size={14} />
          <span>Buscar pelo nome ou cargo</span>
        </div>
        <button className="ef-btn ef-btn-ghost"><Icon name="filter" size={14} /> Permissão: todas</button>
      </div>
      <div className="ef-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="ef-table">
          <thead><tr><th></th><th>Nome</th><th>Cargo</th><th>Telefone</th><th>Permissão</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {FUNCIONARIOS.map((f) =>
            <tr key={f.id}>
                <td style={{ width: 54 }}>
                  <div className="ef-avatar" style={{ width: 32, height: 32, fontSize: 13, background: 'var(--rm-cream)', color: 'var(--rm-green)', border: '1px solid rgba(0,65,37,.18)' }}>{f.initials}</div>
                </td>
                <td><div style={{ fontWeight: 700, color: 'var(--rm-ink)' }}>{f.name}</div><div style={{ fontSize: 11, color: 'var(--rm-mid)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>#{f.id}</div></td>
                <td>{f.role}</td>
                <td className="mono">{f.tel}</td>
                <td>
                  <span className={`ef-badge ${f.perm === 'gestor' ? 'ef-badge-gold' : f.perm === 'login' ? '' : 'ef-badge-mute'}`}>
                    {f.perm === 'gestor' ? 'Gestor' : f.perm === 'login' ? 'Com login' : 'Sem login'}
                  </span>
                </td>
                <td><span className="ef-badge"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rm-green)' }} /> Ativo</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{ padding: '0 8px' }}><Icon name="edit" size={13} /></button>
                  <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{ padding: '0 8px', marginLeft: 4 }}><Icon name="trash" size={13} style={{ color: 'var(--rm-red)' }} /></button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DesktopShell>);

}

// ─── CRIAR FUNCIONARIO MODAL — variation A (single column) ──────
function ScreenCriarFuncA() {
  return (
    <div style={{ position: 'relative' }}>
      <ScreenFuncionarios />
      <Modal
        title="Criar funcionário"
        sub="Preencha os campos abaixo para adicionar um novo membro à equipe."
        onClose={() => {}}
        width={500}
        footer={<>
          <button className="ef-btn ef-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button className="ef-btn ef-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Criar funcionário</button>
        </>}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ef-eyebrow" style={{ color: 'var(--rm-ink-2)' }}>Informações pessoais</div>
          <Field label="Nome" required>
            <input className="ef-input" defaultValue="Larissa Cavalcanti" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Telefone" required>
              <input className="ef-input" defaultValue="(84) 9 9876-1234" />
            </Field>
            <Field label="Cargo" required>
              <select className="ef-select" defaultValue="Cozinha"><option>Cozinha</option><option>Pizzaiolo</option><option>Salão</option><option>Caixa</option><option>Gerente</option></select>
            </Field>
          </div>
          <div className="ef-eyebrow" style={{ color: 'var(--rm-ink-2)', marginTop: 4 }}>Permissões de acesso</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Check on label="Sem login" />
            <Check label="Com login" />
            <Check label="Gestor" />
          </div>
        </div>
      </Modal>
    </div>);

}

// ─── CRIAR FUNCIONARIO MODAL — variation B (split with permissions side panel) ──────
function ScreenCriarFuncB() {
  return (
    <div style={{ position: 'relative' }}>
      <ScreenFuncionarios />
      <Modal
        title="Novo membro da família"
        sub="Bem-vindo à equipe! Vamos preencher os dados básicos."
        onClose={() => {}}
        width={680}
        footer={<>
          <span style={{ fontSize: 11, color: 'var(--rm-mid)', letterSpacing: '.16em', textTransform: 'uppercase', marginRight: 'auto' }}>Etapa 01 de 02 · dados</span>
          <button className="ef-btn ef-btn-ghost">Cancelar</button>
          <button className="ef-btn ef-btn-primary">Continuar <Icon name="arrow" size={14} className="arrow" /></button>
        </>}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome completo" required>
              <input className="ef-input" defaultValue="Larissa Cavalcanti" />
            </Field>
            <Field label="Telefone" required>
              <input className="ef-input" defaultValue="(84) 9 9876-1234" />
            </Field>
            <Field label="Cargo" required>
              <select className="ef-select"><option>Cozinha</option></select>
            </Field>
            <Field label="Data de admissão">
              <input className="ef-input" defaultValue="01/05/2026" />
            </Field>
          </div>
          <div style={{ background: 'var(--rm-cream)', borderLeft: '1px solid var(--rm-rule-strong)', margin: '-22px -26px -22px 0', padding: '22px 24px' }}>
            <div className="ef-eyebrow" style={{ color: 'var(--rm-ink-2)' }}>Permissões</div>
            <p style={{ fontSize: 12, color: 'var(--rm-mid)', margin: '6px 0 14px' }}>Defina o nível de acesso. Pode ser alterado depois.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Check label="Sem login — só nome aparece na contagem" />
              <Check on label="Com login — pode entrar e operar" />
              <Check label="Gestor — vê relatórios e cadastros" />
            </div>
            <div className="ef-divider" />
            <div className="ef-eyebrow" style={{ color: 'var(--rm-ink-2)' }}>Telas liberadas</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {['Etiquetas', 'Contagem', 'Recebimento', 'Validades'].map((t) =>
              <span key={t} className="ef-badge ef-badge-mute" style={{ textTransform: 'none', letterSpacing: '.04em', fontSize: 11 }}>{t}</span>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>);

}

// ─── CRIAR FUNCIONARIO — variation C (inline drawer instead of modal) ──────
function ScreenCriarFuncC() {
  return (
    <DesktopShell active="funcionarios" expanded={['cadastros']}>
      <PageHead
        eyebrow="Cadastros · Funcionários · Novo"
        title="<em>Novo</em> funcionário"
        sub="Preencha os campos abaixo. Você pode salvar como rascunho."
        action={<><button className="ef-btn ef-btn-ghost"><Icon name="chevL" size={14} /> Voltar</button></>} />
      
      <div className="ef-card" style={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: 420 }}>
          <div style={{ background: 'var(--rm-cream)', padding: 24, borderRight: '1px dashed var(--rm-rule-strong)' }}>
            <div className="ef-eyebrow" style={{ color: 'var(--rm-ink-2)' }}>Etapas</div>
            {['Identificação', 'Contato', 'Permissões', 'Revisão'].map((s, i) =>
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < 3 ? '1px dashed var(--rm-rule)' : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, background: i === 0 ? 'var(--rm-green)' : 'transparent', color: i === 0 ? '#fff' : 'var(--rm-mid)', border: i === 0 ? 'none' : '1px solid var(--rm-rule-strong)' }}>{i + 1}</div>
                <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--rm-ink)' : 'var(--rm-mid)' }}>{s}</span>
              </div>
            )}
          </div>
          <div style={{ padding: 28 }}>
            <h3 className="ef-card-title" style={{ fontSize: 22, marginBottom: 18 }}>Identificação</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <Field label="Nome" required><input className="ef-input" /></Field>
              <Field label="Apelido"><input className="ef-input" placeholder="Como aparece nas telas" /></Field>
              <Field label="Cargo" required><select className="ef-select"><option>Selecione…</option></select></Field>
              <Field label="Data de admissão"><input className="ef-input" placeholder="DD/MM/AAAA" /></Field>
            </div>
            <Field label="Observações"><textarea className="ef-textarea" placeholder="Alguma observação sobre alergias, restrições, escala…" /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--rm-rule-strong)' }}>
              <button className="ef-btn ef-btn-ghost">Salvar rascunho</button>
              <button className="ef-btn ef-btn-primary">Continuar <Icon name="arrow" size={14} className="arrow" /></button>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>);

}

// ─── PRODUTOS ─────────────────────────────────
function ScreenProdutos() {
  return (
    <DesktopShell active="produtos" expanded={['cadastros']}>
      <PageHead
        eyebrow="Cadastros · Produtos"
        title="<em>Tudo</em> que entra na cozinha"
        sub="345 produtos ativos · 14 grupos · última atualização hoje, 14:32."
        action={<><button className="ef-btn ef-btn-ghost"><Icon name="report" size={14} /> Exportar</button><button className="ef-btn ef-btn-primary"><Icon name="plus" size={14} /> Novo produto</button></>} />
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div className="ef-search" style={{ flex: 'unset', maxWidth: 320 }}>
          <Icon name="search" size={14} />
          <span>Buscar produto, marca ou código</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Todos', 'Proteínas', 'Queijos', 'Massas', 'Molhos', 'Secos', 'FLV', 'Bebidas'].map((t, i) =>
          <button key={t} className={`ef-btn ${i === 0 ? 'ef-btn-primary ef-btn-sm' : 'ef-btn-ghost ef-btn-sm'}`}>{t}</button>
          )}
        </div>
      </div>
      <div className="ef-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="ef-table">
          <thead><tr><th>Código</th><th>Produto</th><th>Marca/Forn.</th><th>Grupo</th><th>Validades</th><th>Estoque</th><th></th></tr></thead>
          <tbody>
            {PRODUCTS.slice(0, 15).map((p) =>
            <tr key={p.id}>
                <td className="mono">#{p.code.slice(-6)}</td>
                <td>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--rm-mid)', marginTop: 2 }}>{p.subgroup || '—'}</div>
                </td>
                <td><div style={{ fontSize: 13 }}>{p.brand}</div><div className="mono" style={{ fontSize: 10, marginTop: 2 }}>SIF — {(123 + Number(p.id.slice(1))).toString().padStart(4, '0')}</div></td>
                <td><span className="ef-badge ef-badge-mute" style={{ textTransform: 'none', letterSpacing: '.02em', fontSize: 11 }}>{p.group}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="snow" size={12} style={{ color: '#1e8aaa' }} /> 90d</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="wind" size={12} style={{ color: 'var(--rm-green)' }} /> 3d</span>
                  </div>
                </td>
                <td><div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 18 }}>{p.qty} <span style={{ fontSize: 11, color: 'var(--rm-mid)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, fontStyle: 'normal' }}>{p.un}</span></div></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{ padding: '0 8px' }}><Icon name="edit" size={13} /></button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DesktopShell>);

}

// ─── GRUPOS ──────────────────────────────────────
function ScreenGrupos() {
  return (
    <DesktopShell active="grupos" expanded={['cadastros']}>
      <PageHead
        eyebrow="Cadastros · Grupos"
        title="<em>Famílias</em> de produtos"
        sub="Organize seu estoque em categorias para contagem e relatórios."
        action={<button className="ef-btn ef-btn-primary"><Icon name="plus" size={14} /> Novo grupo</button>} />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {GRUPOS.map((g) =>
        <div className="ef-card" key={g.id} style={{ padding: 20, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div className="ef-card-icon" style={{ width: 38, height: 38, background: `${g.color}15`, color: g.color }}><Icon name={g.icon} size={20} /></div>
              <span className="ef-badge ef-badge-mute" style={{ marginLeft: 'auto' }}>{g.count} itens</span>
            </div>
            <h3 className="ef-card-title" style={{ fontSize: 20 }}>{g.name}</h3>
            <div className="ef-divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--rm-mid)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              <span>Subgrupos · 3</span>
              <Icon name="arrow" size={13} style={{ color: 'var(--rm-green)' }} />
            </div>
          </div>
        )}
      </div>
    </DesktopShell>);

}

// ─── ETIQUETAS / IMPRESSAO EM GRUPO ─────────────
function ScreenEtiquetas() {
  return (
    <DesktopShell active="etiquetas">
      <PageHead
        eyebrow="Etiquetas · Impressão em grupo"
        title="Imprima <em>várias</em> de uma vez"
        sub="Selecione o grupo, os produtos e os métodos. Imprime para a impressora térmica USB."
        action={<button className="ef-btn ef-btn-primary"><Icon name="printer" size={14} /> Imprimir 14 etiquetas</button>} />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        <div className="ef-card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--rm-rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="ef-card-title" style={{ fontSize: 18 }}>Selecionar produtos</h3>
              <p style={{ fontSize: 12, color: 'var(--rm-mid)', margin: '4px 0 0' }}>14 selecionados · 31 disponíveis no grupo Proteínas</p>
            </div>
            <div className="ef-search" style={{ maxWidth: 240 }}><Icon name="search" size={14} /><span>Buscar…</span></div>
          </div>
          <div style={{ padding: '14px 22px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px dashed var(--rm-rule-strong)' }}>
            {['FLV', 'Confeitaria', 'Salgados', 'Secos', 'Padaria', 'Proteínas', 'Cozinha Quente', 'Queijos', 'Sushi', 'Molhos', 'Massas', 'Entradas'].map((t, i) =>
            <button key={t} className={`ef-btn ${t === 'Proteínas' ? 'ef-btn-primary' : 'ef-btn-ghost'} ef-btn-sm`} style={{ height: 32 }}>
                <Icon name={['carrot', 'cheese', 'box', 'package', 'wheat', 'beef', 'pot', 'cheese', 'fish', 'bottle', 'wheat', 'utensils'][i]} size={13} /> {t}
              </button>
            )}
          </div>
          <table className="ef-table">
            <thead><tr><th></th><th>Produto</th><th>Subgrupo</th><th>Marca</th><th>Métodos</th><th>Qtd</th></tr></thead>
            <tbody>
              {PRODUCTS.filter((p) => p.group === 'Proteínas').slice(0, 10).map((p, i) =>
              <tr key={p.id}>
                  <td style={{ width: 36 }}><div className={`ef-check ${i < 7 ? 'on' : ''}`} style={{ padding: 0, border: 'none', background: 'transparent' }}><div className="box" style={{ margin: 0 }}>{i < 7 && <Icon name="check" size={11} stroke={3} style={{ color: '#fff' }} />}</div></div></td>
                  <td><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 10, color: 'var(--rm-mid)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>#{p.code.slice(-6)}</div></td>
                  <td>{p.subgroup}</td>
                  <td>{p.brand}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}><Icon name="snow" size={11} style={{ color: '#1e8aaa' }} /> Cong.</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}><Icon name="wind" size={11} style={{ color: 'var(--rm-green)' }} /> Resf.</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{ width: 24, padding: 0 }}>−</button>
                      <span className="mono" style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{i < 7 ? 2 : 0}</span>
                      <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{ width: 24, padding: 0 }}>+</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div>
          <div className="ef-card">
            <div className="ef-eyebrow" style={{ color: 'var(--rm-ink-2)' }}>Pré-visualização</div>
            <div className="ef-label-preview" style={{ marginTop: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="name">ANCHO</div>
                  <div style={{ fontSize: 9, letterSpacing: '.18em', color: 'var(--rm-mid)', marginTop: 4 }}>RESFRIADO</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>500 g</div>
              </div>
              <div style={{ borderTop: '1px dashed var(--rm-ink)', margin: '10px 0' }} />
              <div className="row" style={{ justifyContent: 'space-between' }}><span>VAL. ORIGINAL:</span><span>30/12/2025</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>MANIPULAÇÃO:</span><span>15/12/2025 - 10:42</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>VALIDADE:</span><span>18/12/2025 - 10:42</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>MARCA / FORN:</span><span>SWIFT</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>SIF:</span><span>1818</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>LOTE:</span><span>9HCN40HCN4</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>RESP.:</span><span>JOANA</span></div>
              <div style={{ borderTop: '1px dashed var(--rm-ink)', margin: '10px 0' }} />
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontSize: 9, lineHeight: 1.4 }}>
                  RESTAURANTE FAMIGLIA<br />
                  REIS MAGOS · CAPIM MACIO<br />
                  CNPJ XX.XXX.XXX/0001-XX<br />
                  AV. ENG. R. P., 459, NATAL/RN
                </div>
                <div className="qr" />
              </div>
              <div style={{ textAlign: 'right', marginTop: 6, fontWeight: 700 }}>#T15463</div>
            </div>
          </div>
          <div className="ef-card" style={{ marginTop: 14 }}>
            <div className="ef-eyebrow" style={{ color: 'var(--rm-ink-2)' }}>Resumo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Produtos selecionados</span><strong>7</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Total de etiquetas</span><strong>14</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Impressora</span><span className="mono" style={{ fontSize: 11 }}>EPSON-TM-T20</span></div>
            </div>
            <div className="ef-divider" />
            <button className="ef-btn ef-btn-primary" style={{ width: '100%', justifyContent: 'center' }}><Icon name="printer" size={14} /> Imprimir agora</button>
          </div>
        </div>
      </div>
    </DesktopShell>);

}

Object.assign(window, { ScreenLogin, ScreenHomeA, ScreenHomeB, ScreenHomeC, ScreenFuncionarios, ScreenCriarFuncA, ScreenCriarFuncB, ScreenCriarFuncC, ScreenProdutos, ScreenGrupos, ScreenEtiquetas });