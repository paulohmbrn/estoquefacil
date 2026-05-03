// Mobile screens — Estoque Fácil

// 01 — Lista de Contagem (overview)
function ScreenMobileContagem() {
  return (
    <PhoneFrame time="14:32">
      <PhoneTopbar user="Marketing" role="Gestor" />
      <PhoneSubBar />
      <div className="ef-phone-content">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <h1 className="ef-page-title" style={{fontSize:26}}>Contagem</h1>
          <button className="ef-btn ef-btn-ghost ef-btn-sm">Ver histórico</button>
        </div>
        <div className="ef-search" style={{marginBottom:12}}><Icon name="search" size={14}/><span>Buscar lista pelo nome</span></div>
        <div style={{display:'flex', gap:6, marginBottom:14, overflowX:'auto'}}>
          {['Todos','Proteínas','Frutos do Mar','Queijos','Hortifruti'].map((t,i)=>(
            <button key={t} className={`ef-btn ${i===0?'ef-btn-primary':'ef-btn-ghost'} ef-btn-sm`} style={{flexShrink:0, height:30}}>{i===0 && <Icon name="check" size={12}/>} {t}</button>
          ))}
        </div>
        <div className="ef-eyebrow" style={{color:'var(--rm-ink-2)', marginBottom:10}}>Todas as listas</div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {LISTAS_CONTAGEM.map(l=>(
            <div key={l.id} className="ef-card" style={{padding:16}}>
              <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:10}}>
                <div className="ef-card-icon" style={{width:36, height:36}}><Icon name={l.icon} size={18}/></div>
                <div style={{flex:1}}>
                  <h3 className="ef-card-title" style={{fontSize:16}}>{l.name}</h3>
                  <div style={{fontSize:11, color:'var(--rm-mid)', marginTop:2}}>{l.count} produtos</div>
                </div>
                <Icon name="arrow" size={14} style={{color:'var(--rm-green)'}}/>
              </div>
              <div style={{display:'flex', gap:6, flexWrap:'wrap', paddingTop:10, borderTop:'1px dashed var(--rm-rule-strong)'}}>
                {l.tags.map(t=><span key={t} className="ef-badge ef-badge-mute" style={{fontSize:9, textTransform:'none', letterSpacing:'.04em'}}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

// 02 — Quem fará a contagem
function ScreenMobileQuem() {
  return (
    <PhoneFrame time="14:33">
      <PhoneTopbar user="Marketing" role="Gestor" />
      <PhoneSubBar />
      <div className="ef-phone-content">
        <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{padding:0, border:'none', color:'var(--rm-red)', fontWeight:700, marginBottom:14}}><Icon name="chevL" size={14}/> Voltar</button>
        <h1 className="ef-page-title" style={{fontSize:24, lineHeight:1.1}}>Quem da equipe fará a <em>contagem?</em></h1>
        <p className="ef-page-sub" style={{fontSize:13, marginTop:8, marginBottom:18}}>Selecione um responsável por esta contagem.</p>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          {FUNCIONARIOS.slice(0,8).map(f=>(
            <div key={f.id} className="ef-pick" style={{padding:'14px 8px', flexDirection:'row', justifyContent:'flex-start', gap:10}}>
              <div className="av" style={{width:30, height:30, fontSize:14}}>{f.initials}</div>
              <div style={{textAlign:'left', fontSize:13}}>{f.name}</div>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

// 03 — Como contar (instructions)
function ScreenMobileComoContar() {
  const steps = [
    'Aponte a câmera do seu celular para o QR Code na etiqueta;',
    'Se não conseguir escanear o QR Code, utilize o ID para contar.',
    'Confira os produtos e finalize a contagem.',
    'O sistema avisa quando todos os produtos estão contados.',
  ];
  return (
    <PhoneFrame time="14:34">
      <PhoneTopbar user="Marketing" role="Gestor" />
      <PhoneSubBar />
      <div className="ef-phone-content">
        <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{padding:0, border:'none', color:'var(--rm-red)', fontWeight:700, marginBottom:14}}><Icon name="chevL" size={14}/> Voltar</button>
        <div style={{textAlign:'center', padding:'20px 12px', background:'var(--rm-cream)', borderRadius:4, border:'1px solid var(--rm-rule)', marginBottom:18, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', inset:0, opacity:.4, backgroundImage:'radial-gradient(circle, var(--rm-rule) 1px, transparent 1px)', backgroundSize:'12px 12px'}}/>
          <div style={{position:'relative', display:'inline-block', padding:'12px 14px', background:'var(--rm-red)', borderRadius:6, color:'#fff', transform:'rotate(-3deg)'}}>
            <Icon name="qr" size={28}/>
          </div>
          <div style={{position:'relative', marginTop:6, fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18}}>★ ★ ★</div>
        </div>
        <h1 className="ef-page-title" style={{fontSize:22, lineHeight:1.15}}>Entenda como contar seu estoque com <em>QR Code</em></h1>
        <div style={{marginTop:18, display:'flex', flexDirection:'column', gap:0}}>
          {steps.map((s,i)=>(
            <div key={i} style={{display:'flex', gap:14, padding:'14px 0', borderBottom: i<3?'1px dashed var(--rm-rule-strong)':'none'}}>
              <div style={{width:28, height:28, borderRadius:'50%', background:'rgba(0,65,37,.1)', color:'var(--rm-green)', display:'grid', placeItems:'center', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, flexShrink:0, fontSize:14}}>{i+1}</div>
              <p style={{fontSize:13, lineHeight:1.5, color:'var(--rm-ink-2)', margin:0}}>{s}</p>
            </div>
          ))}
        </div>
        <button className="ef-btn ef-btn-primary" style={{width:'100%', justifyContent:'center', marginTop:18, height:46}}>Entendi, começar contagem <Icon name="arrow" size={14} className="arrow"/></button>
      </div>
    </PhoneFrame>
  );
}

// 04 — Scan QR (the camera view + bottom sheet)
function ScreenMobileScan() {
  return (
    <PhoneFrame time="14:35">
      <div style={{height:54, background:'var(--rm-ink)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', flexShrink:0}}>
        <button style={{background:'none', border:'none', color:'#fff', fontSize:20}}>‹</button>
        <span style={{fontWeight:700}}>Contagem</span>
        <button style={{background:'none', border:'none', color:'#fff', fontSize:13, fontWeight:600}}>Ajuda</button>
      </div>
      <div className="ef-scan">
        <div className="ef-scan-bg"/>
        <div className="ef-scan-hint"><Icon name="cam" size={20} className="cam"/> Aponte a câmera para o QR Code da etiqueta para contar</div>
        <div style={{position:'relative'}}>
          <div className="ef-scan-frame">
            <div style={{position:'absolute', top:14, left:12, right:12, fontFamily:'var(--font-mono)', fontSize:7, color:'#fff', mixBlendMode:'difference', lineHeight:1.5}}>
              <div style={{fontWeight:900, fontSize:11}}>ANCHO</div>
              <div>RESFRIADO &nbsp;&nbsp; 500g</div>
              <div style={{borderTop:'1px dashed #fff', margin:'4px 0'}}/>
              <div>VAL: 30/12/25</div>
              <div>SWIFT · SIF 0303</div>
              <div>#C9796F</div>
            </div>
          </div>
          <div className="ef-scan-corners"><div className="tl"/><div className="tr"/><div className="bl"/><div className="br"/></div>
        </div>
      </div>
      <div className="ef-bottom-sheet" style={{padding:'8px 16px 18px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <div>
            <div style={{fontWeight:700, fontSize:15}}>alcatra</div>
            <div style={{fontSize:11, color:'var(--rm-mid)', marginTop:2}}>Proteínas — Carnes Bovinas</div>
          </div>
          <div style={{display:'flex', gap:6}}>
            <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{width:32, padding:0}}><Icon name="chevU" size={14}/></button>
            <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{width:32, padding:0, borderColor:'var(--rm-red)', color:'var(--rm-red)'}}><Icon name="chevD" size={14}/></button>
          </div>
        </div>
        <div style={{height:4, borderRadius:2, background:'var(--rm-rule)', overflow:'hidden', marginBottom:6}}>
          <div style={{width:'24%', height:'100%', background:'var(--rm-green)'}}/>
        </div>
        <div style={{fontSize:11, color:'var(--rm-green)', fontWeight:700, marginBottom:10}}>18 de 74</div>
        <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:'1px dashed var(--rm-rule-strong)', fontSize:12}}>
          <span style={{display:'flex', alignItems:'center', gap:6}}><Icon name="snow" size={14} style={{color:'#1e8aaa'}}/> Congelado</span>
          <span style={{fontWeight:700, fontFamily:'var(--font-mono)'}}>11 de 47</span>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:'1px dashed var(--rm-rule-strong)', fontSize:12, marginBottom:10}}>
          <span style={{display:'flex', alignItems:'center', gap:6}}><Icon name="wind" size={14} style={{color:'var(--rm-green)'}}/> Resfriado</span>
          <span style={{fontWeight:700, fontFamily:'var(--font-mono)'}}>7 de 27</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <button className="ef-btn ef-btn-ghost" style={{justifyContent:'center'}}>Contar por ID</button>
          <button className="ef-btn ef-btn-primary" style={{justifyContent:'center'}}>Ver lista</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

// 05 — Lista de produtos para contar
function ScreenMobileLista() {
  return (
    <PhoneFrame time="14:42">
      <PhoneTopbar user="Ana Rita" role="Cozinha"/>
      <PhoneSubBar/>
      <div className="ef-phone-content" style={{background:'#fafaf7'}}>
        <div style={{padding:'12px 0 16px'}}>
          <div className="ef-eyebrow" style={{marginBottom:6}}>EM CONTAGEM</div>
          <h1 className="ef-page-title" style={{fontSize:24}}>Proteínas</h1>
          <p style={{fontSize:12, color:'var(--rm-mid)', margin:'4px 0 0'}}>Conte todos os produtos da lista. Você pode pausar e retomar.</p>
        </div>
        <div style={{padding:'10px 14px', background:'#fff', borderRadius:4, border:'1px solid var(--rm-rule)', marginBottom:12, display:'flex', justifyContent:'space-between'}}>
          <div className="ef-eyebrow" style={{margin:0, color:'var(--rm-ink-2)'}}>Produtos da lista</div>
          <div className="mono" style={{fontSize:11, color:'var(--rm-green)', fontWeight:700}}>3 / 14</div>
        </div>
        {[
          {n:'alcatra', g:'Proteínas — Bovinas', done:true, c:74},
          {n:'ancho', g:'Proteínas — Bovinas', warn:true, c:0},
          {n:'atum', g:'Proteínas — Peixes', c:0},
          {n:'bacon', g:'Proteínas — Suínos', done:true, c:18},
          {n:'camarão pizza', g:'Proteínas — Frutos do Mar', c:0},
        ].map((p,i)=>(
          <div key={i} className="ef-card" style={{padding:14, marginBottom:8}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex', alignItems:'center', gap:6, fontWeight:700, fontSize:14}}>
                  {p.n}
                  {p.warn && <Icon name="alert" size={14} style={{color:'var(--rm-red)'}}/>}
                  {p.done && <span className="ef-badge" style={{padding:'2px 6px', fontSize:9}}>OK</span>}
                </div>
                <div style={{fontSize:11, color:'var(--rm-mid)', marginTop:3}}>{p.g}</div>
              </div>
              <button className="ef-btn ef-btn-ghost ef-btn-sm">{p.done ? 'Editar' : 'Contar'}</button>
            </div>
            {p.done && (
              <>
                <div style={{height:3, borderRadius:2, background:'var(--rm-rule)', overflow:'hidden', margin:'10px 0 4px'}}>
                  <div style={{width:'100%', height:'100%', background:'var(--rm-green)'}}/>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--rm-mid)'}}><span>Concluído</span><span style={{color:'var(--rm-green)', fontWeight:700, fontFamily:'var(--font-mono)'}}>{p.c} de {p.c} etiquetas</span></div>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{padding:'10px 14px 14px', borderTop:'1px solid var(--rm-rule-strong)', background:'#fff', flexShrink:0}}>
        <button className="ef-btn ef-btn-primary ef-btn-lg" style={{width:'100%', justifyContent:'center'}}>Finalizar contagem</button>
      </div>
    </PhoneFrame>
  );
}

// 06 — Sucesso
function ScreenMobileSucesso() {
  return (
    <PhoneFrame time="15:06">
      <PhoneTopbar user="Ana Rita" role="Cozinha"/>
      <PhoneSubBar/>
      <div className="ef-phone-content" style={{textAlign:'center', padding:'24px 18px'}}>
        <div style={{width:96, height:96, margin:'10px auto 14px', background:'var(--rm-cream)', borderRadius:'50%', display:'grid', placeItems:'center', position:'relative', border:'1px solid var(--rm-rule-strong)'}}>
          <Icon name="trophy" size={50} style={{color:'var(--rm-gold)'}} fill="rgba(184,144,46,.15)"/>
          <span style={{position:'absolute', top:0, right:8, fontFamily:'var(--font-display)', fontSize:18, fontStyle:'italic', color:'var(--rm-gold)'}}>★</span>
          <span style={{position:'absolute', bottom:6, left:4, fontFamily:'var(--font-display)', fontSize:14, fontStyle:'italic', color:'var(--rm-gold)'}}>★</span>
        </div>
        <div className="ef-eyebrow" style={{justifyContent:'center', marginBottom:6}}>GRAZIE MILLE!</div>
        <h1 className="ef-page-title" style={{fontSize:24, lineHeight:1.15}}>Parabéns Ana Rita! Contagem concluída com <em>sucesso</em></h1>
        <div className="ef-card" style={{textAlign:'left', marginTop:22, padding:18}}>
          <div className="ef-eyebrow" style={{color:'var(--rm-ink-2)'}}>Resumo geral</div>
          <div style={{display:'flex', flexDirection:'column', gap:0, marginTop:8}}>
            {[
              ['Lista','Proteínas'],
              ['Responsável','Ana Rita'],
              ['Data','01/05/2026 · 15:06'],
              ['Etiquetas contadas','143 de 143'],
              ['Conformidade','100%'],
            ].map(([k,v],i)=>(
              <div key={k} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom: i<4?'1px dashed var(--rm-rule)':'none', fontSize:13}}>
                <span style={{color:'var(--rm-mid)'}}>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </div>
        <button className="ef-btn ef-btn-primary ef-btn-lg" style={{width:'100%', justifyContent:'center', marginTop:18}}>Voltar para área de contagem</button>
        <button className="ef-btn ef-btn-ghost" style={{width:'100%', justifyContent:'center', marginTop:8}}>Ver detalhes da contagem</button>
      </div>
    </PhoneFrame>
  );
}

// 07 — Recebimento
function ScreenMobileRecebimento() {
  return (
    <PhoneFrame time="16:02">
      <PhoneTopbar user="Joana" role="Recebimento"/>
      <PhoneSubBar/>
      <div className="ef-phone-content" style={{background:'#fafaf7'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <h1 className="ef-page-title" style={{fontSize:24}}>Recebimento</h1>
          <span className="ef-badge ef-badge-gold">Em aberto · 1</span>
        </div>
        <div className="ef-card" style={{padding:0, marginBottom:14, overflow:'hidden'}}>
          <div style={{padding:'14px 16px', background:'var(--rm-ink)', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div className="ef-eyebrow" style={{color:'var(--rm-gold)', margin:0}}>NF-E 0009453 · CEASA NATAL</div>
              <div style={{fontSize:14, fontWeight:700, marginTop:4}}>Hortifruti · 14 itens</div>
            </div>
            <Icon name="truck" size={22} style={{color:'var(--rm-cream)'}}/>
          </div>
          <div style={{padding:14}}>
            {[
              {n:'Tomate Italiano', m:'CEASA', q:'18 kg', t:'Resfriado', ok:true, temp:'4°C'},
              {n:'Cebola', m:'CEASA', q:'12 kg', t:'Ambiente', ok:true, temp:'—'},
              {n:'Manjericão Fresco', m:'CEASA', q:'1,5 kg', t:'Resfriado', warn:true, temp:'9°C'},
              {n:'Brócolis Congelado', m:'Bonduelle', q:'6 kg', t:'Congelado', ok:true, temp:'-18°C'},
            ].map((p,i)=>(
              <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:i<3?'1px dashed var(--rm-rule-strong)':'none'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700, fontSize:13}}>{p.n}</div>
                  <div style={{fontSize:10, color:'var(--rm-mid)', marginTop:2, fontFamily:'var(--font-mono)', letterSpacing:'.06em'}}>{p.m} · {p.q}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11, fontWeight:700, color: p.warn ? 'var(--rm-red)' : 'var(--rm-green)', display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end'}}>
                    <Icon name={p.t==='Congelado'?'snow':p.t==='Resfriado'?'wind':'flame'} size={11}/>
                    {p.temp}
                  </div>
                  <div style={{fontSize:9, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--rm-mid)', marginTop:2, fontWeight:600}}>{p.t}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:'12px 16px', background:'var(--rm-cream)', borderTop:'1px dashed var(--rm-rule-strong)', display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:600}}>
            <span style={{color:'var(--rm-mid)'}}>4 de 14 conferidos</span>
            <span className="mono" style={{color:'var(--rm-green)'}}>10 pendentes</span>
          </div>
        </div>
        <button className="ef-btn ef-btn-primary ef-btn-lg" style={{width:'100%', justifyContent:'center'}}><Icon name="qr" size={16}/> Bipar próximo item</button>
      </div>
    </PhoneFrame>
  );
}

// 08 — Mobile sidebar (drawer open) - referenced in screenshots
function ScreenMobileSidebar() {
  const items = [
    { id:'home', l:'Início', i:'home', a:true },
    { id:'tags', l:'Etiquetas', i:'tag' },
    { id:'qr', l:'QR Code', i:'qr', badge:'NOVO' },
    { id:'val', l:'Validades', i:'calendar' },
    { id:'pro', l:'Produção', i:'pot' },
    { id:'rec', l:'Recebimento', i:'truck' },
    { id:'cont', l:'Contagem', i:'calc' },
    { id:'ctrl', l:'Controlados', i:'diamond' },
    { id:'rep', l:'Relatórios', i:'report' },
  ];
  return (
    <PhoneFrame time="14:30">
      <div style={{display:'flex', flex:1, position:'relative'}}>
        <div style={{width:240, background:'#fafaf7', borderRight:'1px solid var(--rm-rule-strong)', display:'flex', flexDirection:'column', padding:'14px 12px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:14, borderBottom:'1px dashed var(--rm-rule-strong)', marginBottom:8}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div className="ef-mark" style={{width:26, height:26, fontSize:14}}>EF</div>
              <div style={{fontFamily:'var(--font-display)',fontStyle:'italic',fontWeight:600,fontSize:18,letterSpacing:'-.02em'}}>estoque <em style={{color:'var(--rm-green)'}}>fácil</em></div>
            </div>
            <button style={{background:'none', border:'none', fontSize:20, cursor:'pointer'}}>×</button>
          </div>
          {items.map(it=>(
            <div key={it.id} className={`ef-nav-item ${it.a ? 'active':''}`} style={{fontSize:12.5, padding:'8px 10px'}}>
              <Icon name={it.i} size={16}/>
              <span>{it.l}</span>
              {it.badge && <span className="ef-badge ef-badge-gold" style={{marginLeft:'auto', fontSize:7, padding:'2px 5px'}}>{it.badge}</span>}
            </div>
          ))}
          <div style={{borderTop:'1px dashed var(--rm-rule-strong)', marginTop:10, paddingTop:6}}>
            <div className="ef-nav-item" style={{fontSize:12.5, padding:'8px 10px'}}><Icon name="box" size={16}/><span>Cadastros</span><Icon name="chevD" size={12} className="ef-chev"/></div>
            <div className="ef-nav-item" style={{fontSize:12.5, padding:'8px 10px'}}><Icon name="settings" size={16}/><span>Configurações</span><Icon name="chevD" size={12} className="ef-chev"/></div>
          </div>
          <div style={{marginTop:'auto', fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--rm-mid)', fontWeight:600, paddingTop:12, borderTop:'1px dashed var(--rm-rule-strong)'}}>© RM 2026 · Capim Macio</div>
        </div>
        <div style={{flex:1, background:'rgba(10,26,16,.5)'}}/>
      </div>
    </PhoneFrame>
  );
}

Object.assign(window, { ScreenMobileContagem, ScreenMobileQuem, ScreenMobileComoContar, ScreenMobileScan, ScreenMobileLista, ScreenMobileSucesso, ScreenMobileRecebimento, ScreenMobileSidebar });
