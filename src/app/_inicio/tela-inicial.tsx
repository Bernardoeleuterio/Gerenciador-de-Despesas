"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AvisoSemFamilia } from "@/componentes/aviso-sem-familia";
import { BotaoSair } from "@/componentes/botao-sair";
import { mensagemDoErro, semFamilia } from "@/componentes/erros";
import { botaoDiscreto } from "@/componentes/estilos";
import { SeloDoModo } from "@/componentes/selo-do-modo";
import {
  obterRepositorio,
  type Categoria,
  type Conta,
  type Familia,
  type Lancamento,
  type Membro,
  type NovoLancamento,
  type Regra,
} from "@/lib/dados";
import { nomeDoMes } from "@/lib/formato";
import { hojeEmSaoPaulo } from "@/lib/lancamento-rapido";
import { MODO } from "@/lib/modo";
import { AvisoDesfazer, type Aviso } from "./aviso-desfazer";
import { Doca } from "./doca";
import { ListaDoMes } from "./lista-do-mes";

interface Dados {
  hoje: string;
  familia: Familia;
  eu: Membro;
  membros: Membro[];
  categorias: Categoria[];
  contas: Conta[];
  regras: Regra[];
  lancamentos: Lancamento[];
  /** A última conta usada neste aparelho: a conta de sempre. */
  contaPadraoId: string | null;
}

type Estado =
  | { tipo: "carregando" }
  | { tipo: "pronto"; dados: Dados }
  | { tipo: "sem-familia" }
  | { tipo: "falhou"; mensagem: string };

// Uma conveniência deste aparelho, não um dado da família: fica no navegador
const CHAVE_ULTIMA_CONTA = "gerenciador-de-despesas:ultima-conta";

function lerUltimaConta(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_ULTIMA_CONTA);
  } catch {
    return null;
  }
}

function guardarUltimaConta(contaId: string): void {
  try {
    window.localStorage.setItem(CHAVE_ULTIMA_CONTA, contaId);
  } catch {
    // Navegador sem armazenamento: só perde a conta de sempre
  }
}

async function carregar(): Promise<Dados> {
  const repo = await obterRepositorio();
  const hoje = hojeEmSaoPaulo();
  const [familia, eu, membros, categorias, contas, regras, lancamentos] = await Promise.all([
    repo.familia(),
    repo.euMesmo(),
    repo.membros(),
    repo.categorias(),
    repo.contas(),
    repo.regras(),
    repo.lancamentosDoMes(hoje.slice(0, 7)),
  ]);
  const ultima = lerUltimaConta();
  return {
    hoje,
    familia,
    eu,
    membros,
    categorias,
    contas,
    regras,
    lancamentos,
    contaPadraoId: contas.some((conta) => conta.id === ultima) ? ultima : null,
  };
}

/** A tela do dia a dia: o mês, a lista e o campo de lançamento embaixo. */
export function TelaInicial() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [recente, setRecente] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    carregar().then(
      (dados) => ativo && setEstado({ tipo: "pronto", dados }),
      (erro: unknown) =>
        ativo &&
        setEstado(semFamilia(erro) ? { tipo: "sem-familia" } : { tipo: "falhou", mensagem: mensagemDoErro(erro) }),
    );
    return () => {
      ativo = false;
    };
  }, []);

  const mudarDados = useCallback((mudar: (dados: Dados) => Dados) => {
    setEstado((atual) => (atual.tipo === "pronto" ? { tipo: "pronto", dados: mudar(atual.dados) } : atual));
  }, []);

  const mesDaLista = estado.tipo === "pronto" ? estado.dados.hoje.slice(0, 7) : null;

  const salvar = useCallback(
    async (novo: NovoLancamento) => {
      const criado = await (await obterRepositorio()).criarLancamento(novo);
      if (novo.contaId) guardarUltimaConta(novo.contaId);
      const mes = criado.data.slice(0, 7);
      const desteMes = mes === mesDaLista;
      mudarDados((dados) => ({
        ...dados,
        contaPadraoId: novo.contaId ?? dados.contaPadraoId,
        // O novo entra na hora; no mesmo dia, fica em cima (a ordenação é estável)
        lancamentos: desteMes
          ? [criado, ...dados.lancamentos].sort((a, b) => b.data.localeCompare(a.data))
          : dados.lancamentos,
      }));
      setRecente(criado.id);
      setAviso({
        chave: criado.id,
        texto: desteMes ? "Gasto salvo." : `Gasto salvo em ${nomeDoMes(mes)}.`,
        desfazer: criado.id,
      });
    },
    [mudarDados, mesDaLista],
  );

  const desfazer = useCallback(
    async (id: string) => {
      try {
        await (await obterRepositorio()).excluirLancamento(id);
        mudarDados((dados) => ({ ...dados, lancamentos: dados.lancamentos.filter((l) => l.id !== id) }));
        setAviso({ chave: `${id}-desfeito`, texto: "Gasto desfeito." });
      } catch (erro) {
        setAviso({ chave: `${id}-erro`, texto: mensagemDoErro(erro) });
      }
    },
    [mudarDados],
  );

  const ensinar = useCallback(
    async (termo: string, categoriaId: string) => {
      const regra = await (await obterRepositorio()).salvarRegra(termo, categoriaId);
      mudarDados((dados) => ({
        ...dados,
        regras: [...dados.regras.filter((existente) => existente.termo !== regra.termo), regra],
      }));
      setAviso({ chave: regra.id + regra.categoriaId, texto: "Pronto: da próxima vez, já vai certo." });
    },
    [mudarDados],
  );

  const sumirAviso = useCallback(() => {
    setAviso(null);
    setRecente(null);
  }, []);

  if (estado.tipo === "carregando") {
    return <p className="mx-auto w-full max-w-md px-4 py-16 text-zinc-500">Carregando…</p>;
  }
  if (estado.tipo === "sem-familia") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <AvisoSemFamilia />
      </main>
    );
  }
  if (estado.tipo === "falhou") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-16">
        <p role="alert">{estado.mensagem}</p>
        <button type="button" className={`${botaoDiscreto} w-fit`} onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
      </main>
    );
  }

  const { dados } = estado;
  return (
    <>
      <header className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-6">
        {MODO === "demo" && <SeloDoModo />}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-500">{dados.familia.nome}</p>
            <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
              {nomeDoMes(dados.hoje.slice(0, 7))}
            </h1>
          </div>
          <nav className="flex shrink-0 items-center gap-1" aria-label="Menu">
            <Link href="/membros" className={botaoDiscreto}>
              Membros
            </Link>
            <BotaoSair />
          </nav>
        </div>
      </header>

      {/* Espaço embaixo para a lista não ficar atrás do campo */}
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-2 pb-64">
        <ListaDoMes
          lancamentos={dados.lancamentos}
          categorias={dados.categorias}
          hoje={dados.hoje}
          recente={recente}
        />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="mb-3">
          <AvisoDesfazer aviso={aviso} onDesfazer={(id) => void desfazer(id)} onSumir={sumirAviso} />
        </div>
        <div className="border-t border-zinc-200 bg-white/95 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto w-full max-w-md px-4 pt-3">
            <Doca
              hoje={dados.hoje}
              eu={dados.eu}
              membros={dados.membros}
              categorias={dados.categorias}
              contas={dados.contas}
              regras={dados.regras}
              contaPadraoId={dados.contaPadraoId}
              onSalvar={salvar}
              onEnsinar={ensinar}
            />
          </div>
        </div>
      </div>
    </>
  );
}
