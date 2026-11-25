"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { mensagemDoErro } from "@/componentes/erros";
import { botaoDiscreto, botaoPrincipal, campo as estiloCampo } from "@/componentes/estilos";
import type { Categoria, Conta, Membro, NovoLancamento, Regra } from "@/lib/dados";
import { formatarReais, nomeDoDia } from "@/lib/formato";
import { somarDias } from "@/lib/lancamento-rapido/datas";
import { montarPrevia, termoParaRegra, type Escolhas, type Previa } from "@/lib/lancamento-rapido/previa";
import { lerNumero, valorValido } from "@/lib/lancamento-rapido/valor";

type Editor = "valor" | "categoria" | "data" | "conta" | "pagoPor";

interface Pergunta {
  termo: string;
  /** Como a pessoa escreveu, para a pergunta soar natural. */
  descricao: string;
  categoriaId: string;
}

export interface PropsDaDoca {
  hoje: string;
  eu: Membro;
  membros: Membro[];
  categorias: Categoria[];
  contas: Conta[];
  regras: Regra[];
  contaPadraoId: string | null;
  onSalvar: (novo: NovoLancamento) => Promise<void>;
  onEnsinar: (termo: string, categoriaId: string) => Promise<void>;
}

/**
 * O campo de lançamento, fixo embaixo: o texto vira uma prévia em chips, e
 * cada chip troca com um toque. Enter salva.
 */
export function Doca(props: PropsDaDoca) {
  const { hoje, eu, membros, categorias, contas, regras, contaPadraoId, onSalvar, onEnsinar } = props;
  const campo = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [escolhas, setEscolhas] = useState<Escolhas>({});
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const catalogo = useMemo(() => ({ categorias, contas, regras }), [categorias, contas, regras]);
  const padroes = useMemo(() => ({ euId: eu.id, contaPadraoId }), [eu.id, contaPadraoId]);
  const previa = useMemo(
    () => montarPrevia(texto, hoje, catalogo, padroes, escolhas),
    [texto, hoje, catalogo, padroes, escolhas],
  );

  const voltarAoCampo = () => campo.current?.focus();

  function recomecar() {
    setTexto("");
    setEscolhas({});
    setEditor(null);
    setPergunta(null);
  }

  function mudarTexto(novo: string) {
    setTexto(novo);
    setErro(null);
    if (novo.trim() === "") recomecar();
  }

  function escolher(mudanca: Escolhas) {
    setEscolhas((atuais) => ({ ...atuais, ...mudanca }));
    setEditor(null);
    voltarAoCampo();
  }

  function escolherCategoria(categoriaId: string) {
    escolher({ categoriaId });
    // Trocou o que o app tinha entendido: oferece ensinar
    const termo = termoParaRegra(previa);
    const corrigiu = categoriaId !== previa.interpretacao.categoriaId;
    setPergunta(termo && corrigiu ? { termo, descricao: previa.descricao, categoriaId } : null);
  }

  async function salvarLancamento(novo: NovoLancamento) {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(novo);
      recomecar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    } finally {
      setSalvando(false);
      voltarAoCampo();
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (salvando) return;
    if (previa.novo) {
      void salvarLancamento(previa.novo);
      return;
    }
    // Sem valor, não chuta: pede
    if (previa.bloqueio === "sem-valor" || previa.bloqueio === "valor-ambiguo") setEditor("valor");
    if (previa.bloqueio === "sem-categoria") setEditor("categoria");
  }

  function salvarAVista() {
    const aVista = montarPrevia(texto, hoje, catalogo, padroes, { ...escolhas, aVista: true });
    if (aVista.novo) void salvarLancamento(aVista.novo);
  }

  async function ensinar() {
    if (!pergunta) return;
    try {
      await onEnsinar(pergunta.termo, pergunta.categoriaId);
      setPergunta(null);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
    voltarAoCampo();
  }

  const alternar = (qual: Editor) => setEditor((aberto) => (aberto === qual ? null : qual));
  const temTexto = texto.trim() !== "";
  const nomeDaCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "";

  return (
    <div className="flex flex-col gap-3">
      {editor && temTexto && (
        <PainelDeEscolha
          editor={editor}
          previa={previa}
          hoje={hoje}
          eu={eu}
          membros={membros}
          categorias={categorias.filter((c) => c.tipo === "despesa")}
          contas={contas}
          onEscolher={escolher}
          onEscolherCategoria={escolherCategoria}
          onFechar={() => {
            setEditor(null);
            voltarAoCampo();
          }}
        />
      )}

      {pergunta && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
          <p className="min-w-0 flex-1">
            Sempre que aparecer <strong className="font-medium">“{pergunta.descricao}”</strong>, usar{" "}
            {nomeDaCategoria(pergunta.categoriaId)}?
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className={`${botaoDiscreto} border border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:text-zinc-100`}
              onClick={() => void ensinar()}
            >
              Sempre
            </button>
            <button type="button" className={botaoDiscreto} onClick={() => setPergunta(null)}>
              Só desta vez
            </button>
          </div>
        </div>
      )}

      {temTexto && (
        <Chips
          previa={previa}
          hoje={hoje}
          editor={editor}
          membros={membros}
          categorias={categorias}
          contas={contas}
          onAbrir={alternar}
        />
      )}

      {temTexto && (
        <Bloqueio previa={previa} onCandidato={(valorCentavos) => escolher({ valorCentavos })} onAVista={salvarAVista} />
      )}

      <form onSubmit={enviar} className="flex items-center gap-2">
        <label htmlFor="lancamento" className="sr-only">
          Novo gasto
        </label>
        <input
          ref={campo}
          id="lancamento"
          className={`${estiloCampo} py-3 text-lg`}
          placeholder="Ex.: 50 ifood ontem"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          autoFocus
          value={texto}
          onChange={(evento) => mudarTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Escape") setEditor(null);
          }}
        />
        {/* Nunca desabilitado: um botão desabilitado também bloqueia o Enter, e
            o Enter sem valor precisa abrir o campo de valor */}
        <button type="submit" className={`${botaoPrincipal} py-3`} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>

      {erro && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Chips: a prévia, na ordem em que se lê um gasto
// ----------------------------------------------------------------------------

function Chip(props: {
  rotulo: string;
  ativo: boolean;
  atencao?: boolean;
  destaque?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { rotulo, ativo, atencao, destaque, onClick, children } = props;
  const cor = atencao
    ? "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100"
    : "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-expanded={ativo}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 whitespace-nowrap ${cor} ${
        destaque ? "text-base font-semibold tabular-nums" : "text-sm"
      } ${ativo ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : ""} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100`}
    >
      {children}
    </button>
  );
}

function Selo({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm whitespace-nowrap text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100">
      {children}
    </span>
  );
}

function Chips(props: {
  previa: Previa;
  hoje: string;
  editor: Editor | null;
  membros: Membro[];
  categorias: Categoria[];
  contas: Conta[];
  onAbrir: (editor: Editor) => void;
}) {
  const { previa, hoje, editor, membros, categorias, contas, onAbrir } = props;
  const categoria = categorias.find((c) => c.id === previa.categoriaId);
  const conta = contas.find((c) => c.id === previa.contaId);
  const pagou = membros.find((m) => m.id === previa.pagoPor);
  const valor = previa.valorCentavos === null ? "Valor?" : formatarReais(previa.valorCentavos);
  const categoriaChute = previa.categoriaPor === null;
  const contaEmAberto = previa.contasPossiveis.length > 0;

  return (
    <div className="flex flex-wrap gap-2" aria-label="Prévia do gasto">
      <Chip
        rotulo={`Valor: ${valor}. Trocar`}
        ativo={editor === "valor"}
        atencao={previa.valorCentavos === null}
        destaque
        onClick={() => onAbrir("valor")}
      >
        {valor}
      </Chip>
      {previa.tipo === "receita" && <Selo>Receita</Selo>}
      {previa.parcelas > 1 && <Selo>{previa.parcelas}x</Selo>}
      <Chip
        rotulo={`Categoria: ${categoria?.nome ?? "nenhuma"}. Trocar`}
        ativo={editor === "categoria"}
        atencao={categoriaChute}
        onClick={() => onAbrir("categoria")}
      >
        <span aria-hidden>{categoria?.icone ?? "📦"}</span>
        {categoria ? `${categoria.nome}${categoriaChute ? "?" : ""}` : "Categoria?"}
      </Chip>
      <Chip rotulo={`Dia: ${nomeDoDia(previa.data, hoje)}. Trocar`} ativo={editor === "data"} onClick={() => onAbrir("data")}>
        {nomeDoDia(previa.data, hoje)}
      </Chip>
      <Chip
        rotulo={`Conta: ${conta?.nome ?? "sem conta"}. Trocar`}
        ativo={editor === "conta"}
        atencao={contaEmAberto}
        onClick={() => onAbrir("conta")}
      >
        {conta?.nome ?? (contaEmAberto ? "Qual cartão?" : "Sem conta")}
      </Chip>
      <Chip
        rotulo={`Quem pagou: ${pagou?.apelido ?? "ninguém em especial"}. Trocar`}
        ativo={editor === "pagoPor"}
        onClick={() => onAbrir("pagoPor")}
      >
        {pagou ? `Pagou: ${pagou.apelido}` : "Pagou: ninguém"}
      </Chip>
    </div>
  );
}

// ----------------------------------------------------------------------------
// O que ainda impede de salvar, dito do jeito mais curto
// ----------------------------------------------------------------------------

function Bloqueio(props: {
  previa: Previa;
  onCandidato: (valorCentavos: number) => void;
  onAVista: () => void;
}) {
  const { previa, onCandidato, onAVista } = props;
  const classe = "text-sm text-amber-900 dark:text-amber-200";

  switch (previa.bloqueio) {
    case "sem-valor":
      return <p className={classe}>Falta o valor: escreva junto, como em “50 ifood”, ou toque em Valor.</p>;
    case "valor-ambiguo":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <p className={classe}>Qual destes é o valor?</p>
          {previa.valoresPossiveis.map((candidato) => (
            <button
              key={candidato.valorCentavos}
              type="button"
              className={`${botaoDiscreto} border border-zinc-300 tabular-nums dark:border-zinc-700`}
              onClick={() => onCandidato(candidato.valorCentavos)}
            >
              {formatarReais(candidato.valorCentavos)}
            </button>
          ))}
        </div>
      );
    case "receita":
      return <p className={classe}>Receitas ainda não entram: por enquanto, só gastos.</p>;
    case "parcelado":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <p className={classe}>Compra parcelada ainda não entra.</p>
          <button type="button" className={`${botaoDiscreto} border border-zinc-300 dark:border-zinc-700`} onClick={onAVista}>
            Salvar {formatarReais(previa.valorCentavos ?? 0)} à vista
          </button>
        </div>
      );
    case "sem-categoria":
      return <p className={classe}>Escolha a categoria.</p>;
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// O painel que abre ao tocar num chip
// ----------------------------------------------------------------------------

function Opcao(props: { selecionada: boolean; onClick: () => void; children: ReactNode }) {
  const { selecionada, onClick, children } = props;
  return (
    <button
      type="button"
      aria-pressed={selecionada}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
        selecionada
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
      } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100`}
    >
      {children}
    </button>
  );
}

const TITULOS: Record<Editor, string> = {
  valor: "Valor",
  categoria: "Categoria",
  data: "Dia",
  conta: "Conta",
  pagoPor: "Quem pagou",
};

function PainelDeEscolha(props: {
  editor: Editor;
  previa: Previa;
  hoje: string;
  eu: Membro;
  membros: Membro[];
  categorias: Categoria[];
  contas: Conta[];
  onEscolher: (mudanca: Escolhas) => void;
  onEscolherCategoria: (categoriaId: string) => void;
  onFechar: () => void;
}) {
  const { editor, previa, hoje, membros, categorias, contas, onEscolher, onEscolherCategoria, onFechar } = props;

  return (
    <section
      aria-label={TITULOS[editor]}
      className="max-h-[45vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") onFechar();
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-500">{TITULOS[editor]}</h2>
        <button type="button" className={botaoDiscreto} onClick={onFechar}>
          Fechar
        </button>
      </div>

      {editor === "valor" && <EscolhaDeValor previa={previa} onEscolher={onEscolher} />}

      {editor === "categoria" && (
        <div className="grid grid-cols-2 gap-2">
          {categorias.map((categoria) => (
            <Opcao
              key={categoria.id}
              selecionada={categoria.id === previa.categoriaId}
              onClick={() => onEscolherCategoria(categoria.id)}
            >
              <span aria-hidden>{categoria.icone}</span>
              <span className="leading-tight">{categoria.nome}</span>
            </Opcao>
          ))}
        </div>
      )}

      {editor === "data" && (
        <div className="flex flex-wrap items-center gap-2">
          {[0, 1, 2].map((atras) => {
            const dia = somarDias(hoje, -atras);
            return (
              <Opcao key={dia} selecionada={dia === previa.data} onClick={() => onEscolher({ data: dia })}>
                {nomeDoDia(dia, hoje)}
              </Opcao>
            );
          })}
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Outro dia</span>
            <input
              type="date"
              className="rounded-lg border border-zinc-200 bg-transparent px-3 py-2 dark:border-zinc-800"
              max={hoje}
              value={previa.data}
              onChange={(evento) => evento.target.value && onEscolher({ data: evento.target.value })}
            />
          </label>
        </div>
      )}

      {editor === "conta" && (
        <div className="grid grid-cols-2 gap-2">
          {contas.map((conta) => (
            <Opcao key={conta.id} selecionada={conta.id === previa.contaId} onClick={() => onEscolher({ contaId: conta.id })}>
              {conta.nome}
            </Opcao>
          ))}
          <Opcao selecionada={previa.contaId === null} onClick={() => onEscolher({ contaId: null })}>
            Sem conta
          </Opcao>
        </div>
      )}

      {editor === "pagoPor" && (
        <div className="grid grid-cols-2 gap-2">
          {membros.map((membro) => (
            <Opcao key={membro.id} selecionada={membro.id === previa.pagoPor} onClick={() => onEscolher({ pagoPor: membro.id })}>
              {membro.apelido}
            </Opcao>
          ))}
          <Opcao selecionada={previa.pagoPor === null} onClick={() => onEscolher({ pagoPor: null })}>
            Ninguém em especial
          </Opcao>
        </div>
      )}
    </section>
  );
}

function EscolhaDeValor(props: { previa: Previa; onEscolher: (mudanca: Escolhas) => void }) {
  const { previa, onEscolher } = props;
  const [digitado, setDigitado] = useState("");
  const [invalido, setInvalido] = useState(false);

  function usar(evento: FormEvent) {
    evento.preventDefault();
    const numero = lerNumero(digitado.trim().replace(/^r\$\s*/i, ""));
    if (!numero || !valorValido(numero.centavos)) {
      setInvalido(true);
      return;
    }
    onEscolher({ valorCentavos: numero.centavos });
  }

  return (
    <div className="flex flex-col gap-3">
      {previa.valoresPossiveis.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {previa.valoresPossiveis.map((candidato) => (
            <Opcao
              key={candidato.valorCentavos}
              selecionada={candidato.valorCentavos === previa.valorCentavos}
              onClick={() => onEscolher({ valorCentavos: candidato.valorCentavos })}
            >
              <span className="tabular-nums">{formatarReais(candidato.valorCentavos)}</span>
            </Opcao>
          ))}
        </div>
      )}
      <form onSubmit={usar} className="flex items-center gap-2">
        <label htmlFor="valor" className="sr-only">
          Valor em reais
        </label>
        <input
          id="valor"
          className={estiloCampo}
          inputMode="decimal"
          placeholder="0,00"
          autoComplete="off"
          autoFocus
          value={digitado}
          aria-invalid={invalido}
          onChange={(evento) => {
            setDigitado(evento.target.value);
            setInvalido(false);
          }}
        />
        <button type="submit" className={botaoPrincipal}>
          Usar
        </button>
      </form>
      {invalido && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          Escreva o valor como 50 ou 50,90.
        </p>
      )}
    </div>
  );
}
