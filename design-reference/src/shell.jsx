// Shell components: Sidebar, Topbar, PhoneFrame, Modal, etc.

function Sidebar({ active = 'home', expanded = ['cadastros'] }) {
  const items = [
    { id: 'home', label: 'Início', icon: 'home' },
    { id: 'etiquetas', label: 'Etiquetas', icon: 'tag' },
    { id: 'qr', label: 'QR Code', icon: 'qr', badge: 'NOVO' },
    { id: 'validades', label: 'Validades', icon: 'calendar' },
    { id: 'producao', label: 'Produção', icon: 'pot' },
    { id: 'recebimento', label: 'Recebimento', icon: 'truck' },
    { id: 'contagem', label: 'Contagem', icon: 'calc' },
    { id: 'controlados', label: 'Controlados', icon: 'diamond' },
    { id: 'relatorios', label: 'Relatórios', icon: 'report' },
  ];
  const cadastros = [
    { id: 'produtos', label: 'Produtos' },
    { id: 'grupos', label: 'Grupos' },
    { id: 'funcionarios', label: 'Funcionários' },
    { id: 'metodos', label: 'Métodos' },
  ];
  return (
    <aside className="ef-sidebar">
      <div className="ef-brand">
        <div className="ef-mark">EF</div>
        <div>
          <div className="ef-wm">estoque <em>fácil</em></div>
          <span className="ef-wm-sub">RM · Capim Macio</span>
        </div>
      </div>
      <nav className="ef-nav">
        {items.map(it => (
          <div key={it.id} className={`ef-nav-item ${active === it.id ? 'active' : ''}`}>
            <Icon name={it.icon} size={18} />
            <span>{it.label}</span>
            {it.badge && <span className="ef-badge ef-badge-gold" style={{marginLeft:'auto', fontSize:8, padding:'2px 6px'}}>{it.badge}</span>}
          </div>
        ))}
        <div className={`ef-nav-item ${expanded.includes('cadastros') ? 'active' : ''}`} style={{marginTop:8}}>
          <Icon name="box" size={18} />
          <span>Cadastros</span>
          <Icon name="chevU" size={14} className="ef-chev" />
        </div>
        {expanded.includes('cadastros') && (
          <div className="ef-nav-sub">
            {cadastros.map(c => (
              <div key={c.id} className={`ef-nav-item ${active === c.id ? 'active' : ''}`}>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="ef-nav-item">
          <Icon name="settings" size={18} />
          <span>Configurações</span>
          <Icon name="chevD" size={14} className="ef-chev" />
        </div>
      </nav>
      <div className="ef-sidebar-footer">
        <span>v1.0 · 2026</span>
        <span className="dot" />
      </div>
    </aside>
  );
}

function Topbar({ title }) {
  return (
    <div className="ef-topbar">
      <div className="ef-tenant">
        Famiglia Reis Magos <span className="pill">CAPIM MACIO</span>
      </div>
      <div className="ef-search">
        <Icon name="search" size={14} />
        <span>Buscar produto, etiqueta, lote…</span>
      </div>
      <div className="ef-user">
        <Icon name="bell" size={18} style={{color:'var(--rm-mid)'}} />
        <div style={{textAlign:'right'}}>
          <div className="ef-user-name">Paulo Reis</div>
          <div className="ef-user-role">Gestor</div>
        </div>
        <div className="ef-avatar">PR</div>
      </div>
    </div>
  );
}

function DesktopShell({ active, expanded, title, children }) {
  return (
    <div className="ef-shell">
      <Sidebar active={active} expanded={expanded} />
      <div className="ef-main">
        <Topbar title={title} />
        <div className="ef-content">{children}</div>
      </div>
    </div>
  );
}

function PageHead({ eyebrow, title, sub, action }) {
  return (
    <div className="ef-page-head">
      <div>
        {eyebrow && <div className="ef-eyebrow">{eyebrow}</div>}
        <h1 className="ef-page-title" dangerouslySetInnerHTML={{__html: title}} />
        {sub && <p className="ef-page-sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function PhoneFrame({ children, statusbar = true, time = '15:06' }) {
  return (
    <div className="ef-phone">
      {statusbar && (
        <div className="ef-phone-statusbar">
          <span>{time}</span>
          <span style={{display:'flex', gap:6, alignItems:'center'}}>
            <span style={{fontSize:9}}>●●●●</span>
            <span style={{fontSize:9, letterSpacing:'.1em'}}>4G</span>
            <span>▮</span>
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

function PhoneTopbar({ tenant = 'Famiglia RM', user = 'Ana Rita', role = 'Cozinha', onMenu }) {
  return (
    <div className="ef-phone-topbar">
      <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{padding:'0 8px', height:30, border:'1px solid var(--rm-rule-strong)'}} onClick={onMenu}>
        <Icon name="menu" size={16} />
      </button>
      <div className="ef-brand" style={{padding:0, border:'none', margin:0}}>
        <div className="ef-mark" style={{width:24,height:24,fontSize:13}}>EF</div>
        <div>
          <div style={{fontFamily:'var(--font-display)',fontStyle:'italic',fontWeight:600,fontSize:16,letterSpacing:'-.02em',lineHeight:1}}>estoque <em style={{color:'var(--rm-green)'}}>fácil</em></div>
        </div>
      </div>
      <div className="ef-user" style={{marginLeft:'auto', gap:7}}>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11,fontWeight:600,lineHeight:1.1}}>{user}</div>
          <div style={{fontSize:9,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--rm-mid)'}}>{role}</div>
        </div>
        <div className="ef-avatar" style={{width:26,height:26,fontSize:11}}>{user[0]}</div>
      </div>
    </div>
  );
}

function PhoneSubBar() {
  return (
    <div style={{padding:'10px 16px', display:'flex', alignItems:'center', gap:8, fontSize:10, letterSpacing:'.22em', textTransform:'uppercase', color:'var(--rm-mid)', borderBottom:'1px dashed var(--rm-rule-strong)', background:'#fff', flexShrink:0}}>
      <span style={{fontWeight:700, color:'var(--rm-ink)'}}>RM</span>
      <span style={{background:'rgba(0,65,37,.08)',color:'var(--rm-green)',padding:'2px 7px',borderRadius:2,fontSize:9}}>UNIDADE</span>
      <span style={{marginLeft:'auto', fontSize:9}}>Capim Macio</span>
    </div>
  );
}

function Modal({ title, sub, onClose, children, footer, width = 480, accent = 'green' }) {
  const accentColor = accent === 'red' ? 'var(--rm-red)' : 'var(--rm-green)';
  return (
    <div className="ef-modal-backdrop">
      <div className="ef-modal" style={{width, borderTopColor: accentColor}}>
        <div className="ef-modal-head">
          <div style={{flex:1}}>
            <h2 className="ef-modal-title">{title}</h2>
            {sub && <p className="ef-modal-sub">{sub}</p>}
          </div>
          <button className="ef-modal-close" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="ef-modal-body">{children}</div>
        {footer && <div className="ef-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, required, hint, error, children }) {
  return (
    <div className="ef-field">
      <label className="ef-label">{label}{required && <span className="req">*</span>}</label>
      {children}
      {error ? <span className="ef-help ef-help-error">{error}</span> : hint ? <span className="ef-help">{hint}</span> : null}
    </div>
  );
}

function Check({ on, label, onClick }) {
  return (
    <div className={`ef-check ${on ? 'on' : ''}`} onClick={onClick}>
      <div className="box">
        {on && <Icon name="check" size={11} stroke={3} style={{color:'#fff'}} />}
      </div>
      <span>{label}</span>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, DesktopShell, PageHead, PhoneFrame, PhoneTopbar, PhoneSubBar, Modal, Field, Check });
