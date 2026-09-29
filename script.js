(() => {
  const CHAVE = 'betaburger-carrinho';
  const SUPABASE_URL = 'https://galmddmirvqzspsnbhdl.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_m95sGjOdUQ_9Y2il8KyxUg_mtIL-Ius';
  const $ = (s) => document.querySelector(s);
  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let itens = {};
  try { itens = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { itens = {}; }
  Object.keys(itens).forEach((id) => {
    const i = itens[id];
    if (!i || !(Number(i.price) > 0) || !(Number(i.qty) > 0)) delete itens[id];
  });
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) {} };

  const abrirBtn = $('#carrinho-abrir'), fecharBtn = $('#carrinho-fechar'), overlay = $('#carrinho-overlay');
  const lista = $('#carrinho-itens'), vazio = $('#carrinho-vazio'), rodape = $('#carrinho-rodape');
  const contagem = $('#carrinho-contagem'), totalEl = $('#carrinho-total');
  const enviar = $('#carrinho-enviar'), limpar = $('#carrinho-limpar'), erro = $('#carrinho-erro');
  const sucesso = $('#carrinho-sucesso'), campoEndereco = $('#campo-endereco'), enderecoEl = $('#carrinho-endereco');

  const resumo = () => Object.values(itens).reduce(
    (r, i) => ({ qtd: r.qtd + i.qty, total: r.total + i.qty * i.price }), { qtd: 0, total: 0 });

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function botaoQtd(id, acao, simbolo, rotulo) {
    const b = el('button', null, simbolo);
    b.type = 'button';
    b.dataset.id = id;
    b.dataset.acao = acao;
    b.setAttribute('aria-label', rotulo);
    return b;
  }

  function render() {
    const { qtd, total } = resumo();
    sucesso.hidden = true;
    contagem.textContent = qtd;
    totalEl.textContent = brl(total);
    lista.replaceChildren();
    Object.entries(itens).forEach(([id, i]) => {
      const li = el('li', 'carrinho-item');
      li.append(el('span', 'carrinho-item-nome', i.name), el('span', 'carrinho-item-preco', brl(i.price * i.qty)));
      const q = el('div', 'carrinho-qtd');
      q.append(
        botaoQtd(id, 'menos', '−', `Diminuir ${i.name}`),
        el('span', null, String(i.qty)),
        botaoQtd(id, 'mais', '+', `Aumentar ${i.name}`)
      );
      li.append(q);
      lista.append(li);
    });
    const temItens = qtd > 0;
    lista.hidden = !temItens;
    vazio.hidden = temItens;
    rodape.hidden = !temItens;
  }

  let ultimoFoco = null;
  function abrir() {
    ultimoFoco = document.activeElement;
    document.body.classList.add('carrinho-aberto');
    fecharBtn.focus();
  }
  function fechar() {
    document.body.classList.remove('carrinho-aberto');
    (ultimoFoco || abrirBtn).focus();
  }

  document.addEventListener('click', (e) => {
    const add = e.target.closest('.add-btn');
    if (add) {
      const { id, name, price } = add.dataset;
      if (itens[id]) itens[id].qty += 1;
      else itens[id] = { name, price: Number(price), qty: 1 };
      salvar();
      render();
      const original = add.dataset.rotulo || add.textContent;
      add.dataset.rotulo = original;
      add.textContent = 'Adicionado ✓';
      clearTimeout(add._t);
      add._t = setTimeout(() => { add.textContent = original; }, 1200);
    }
  });

  lista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-acao]');
    if (!b || !itens[b.dataset.id]) return;
    const item = itens[b.dataset.id];
    item.qty += b.dataset.acao === 'mais' ? 1 : -1;
    if (item.qty <= 0) delete itens[b.dataset.id];
    salvar();
    render();
    const proximo = lista.querySelector(`button[data-id="${b.dataset.id}"][data-acao="${b.dataset.acao}"]`);
    if (proximo) proximo.focus();
  });

  limpar.addEventListener('click', () => { itens = {}; salvar(); render(); });

  function atualizarTipo() {
    const entrega = rodape.elements.tipo.value === 'entrega';
    campoEndereco.hidden = !entrega;
    enderecoEl.required = entrega;
  }
  rodape.addEventListener('change', (e) => { if (e.target.name === 'tipo') atualizarTipo(); });
  atualizarTipo();

  rodape.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.textContent = '';
    const f = new FormData(rodape);
    const entrega = f.get('tipo') === 'entrega';
    const corpo = {
      p_nome: String(f.get('nome')).trim(),
      p_telefone: String(f.get('telefone')).trim(),
      p_tipo: f.get('tipo'),
      p_endereco: entrega ? String(f.get('endereco')).trim() : null,
      p_pagamento: f.get('pagamento'),
      p_observacao: String(f.get('obs')).trim() || null,
      p_itens: Object.entries(itens).map(([id, i]) => ({ id, qtd: i.qty }))
    };
    enviar.disabled = true;
    enviar.textContent = 'Enviando…';
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify(corpo)
      });
      const dados = await r.json();
      if (!r.ok) {
        erro.textContent = dados && dados.code === 'P0001' ? `${dados.message}. Confira os dados e tente de novo.` : 'Não foi possível enviar o pedido. Tente de novo.';
        return;
      }
      itens = {};
      salvar();
      rodape.reset();
      atualizarTipo();
      render();
      $('#carrinho-numero').textContent = `Pedido #${dados}`;
      vazio.hidden = true;
      sucesso.hidden = false;
    } catch (err) {
      erro.textContent = 'Sem conexão. Verifique a internet e tente de novo.';
    } finally {
      enviar.disabled = false;
      enviar.textContent = 'Fazer pedido';
    }
  });

  $('#carrinho-sucesso-fechar').addEventListener('click', fechar);

  abrirBtn.addEventListener('click', abrir);
  fecharBtn.addEventListener('click', fechar);
  overlay.addEventListener('click', fechar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('carrinho-aberto')) fechar();
  });

  render();
})();
