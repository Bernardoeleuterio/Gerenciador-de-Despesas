"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AvisoSemFamilia } from "@/componentes/aviso-sem-familia";
import { mensagemDoErro, semFamilia } from "@/componentes/erros";
import { botaoDiscreto, botaoPerigo, botaoPrincipal, campo, cartao, cartaoLista } from "@/componentes/estilos";
import {
  obterRepositorio,
  type Convite,
  type Familia,
  type Membro,
  type NovoConvite,
  type Papel,
} from "@/lib/dados";
import { MODO } from "@/lib/modo";

interface Dados {
  familia: Familia;
  eu: Membro;
  membros: Membro[];
  convites: Convite[];
}

type Estado =
  | { tipo: "carregando" }
  | { tipo: "pronto"; dados: Dados }
  | { tipo: "sem-familia" }
  | { tipo: "falhou"; mensagem: string };

async function buscarDados(): Promise<Dados> {
  const repo = await obterRepositorio();
  const [familia, eu, membros, convites] = await Promise.all([
    repo.familia(),
    repo.euMesmo(),
    repo.membros(),
    repo.convites(),
  ]);
  return { familia, eu, membros, convites };
}

function estadoDoErro(erro: unknown): Estado {
  return semFamilia(erro) ? { tipo: "sem-familia" } : { tipo: "falhou", mensagem: mensagemDoErro(erro) };
}

/** Quem é da família; o admin convida, cancela convites e remove pessoas. */
export function Membros() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    let ativo = true;
    buscarDados().then(
      (dados) => ativo && setEstado({ tipo: "pronto", dados }),
      (erro: unknown) => ativo && setEstado(estadoDoErro(erro)),
    );
    return () => {
      ativo = false;
    };
  }, []);

  // Depois de cada mudança (convidar, cancelar, remover): busca tudo de novo
  const recarregar = useCallback(async () => {
    try {
      setEstado({ tipo: "pronto", dados: await buscarDados() });
    } catch (erro) {
      setEstado(estadoDoErro(erro));
    }
  }, []);

  if (estado.tipo === "carregando") return <p className="text-sm text-zinc-500">Carregando…</p>;
  if (estado.tipo === "sem-familia") return <AvisoSemFamilia />;
  if (estado.tipo === "falhou") {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p role="alert">{estado.mensagem}</p>
        <button type="button" className={`${botaoDiscreto} w-fit`} onClick={() => void recarregar()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const { familia, eu, membros, convites } = estado.dados;
  const souAdmin = eu.papel === "admin";

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-3 text-zinc-600 dark:text-zinc-400">{familia.nome}</p>

      <ListaDeMembros membros={membros} eu={eu} podeRemover={souAdmin} depoisDeMudar={recarregar} />

      {souAdmin ? (
        <>
          {convites.length > 0 && <ListaDeConvites convites={convites} depoisDeMudar={recarregar} />}
          <FormularioDeConvite depoisDeConvidar={recarregar} />
        </>
      ) : (
        <p className="text-sm text-zinc-500">Só o admin da família convida ou remove pessoas.</p>
      )}
    </div>
  );
}

function Selo({ papel }: { papel: Papel }) {
  if (papel !== "admin") return null;
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      admin
    </span>
  );
}

function ListaDeMembros(props: {
  membros: Membro[];
  eu: Membro;
  podeRemover: boolean;
  depoisDeMudar: () => Promise<void>;
}) {
  const { membros, eu, podeRemover, depoisDeMudar } = props;
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function remover(membro: Membro) {
    setOcupado(true);
    setErro(null);
    try {
      await (await obterRepositorio()).removerMembro(membro.id);
      setConfirmando(null);
      await depoisDeMudar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="titulo-membros" className="flex flex-col gap-3">
      <h2 id="titulo-membros" className="text-sm font-medium text-zinc-500">
        {membros.length === 1 ? "1 pessoa" : `${membros.length} pessoas`}
      </h2>
      <ul className={cartaoLista}>
        {membros.map((membro) => (
          <li key={membro.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium dark:bg-zinc-800"
              >
                {membro.apelido.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate">
                {membro.apelido}
                {membro.id === eu.id && <span className="text-zinc-500"> (você)</span>}
              </span>
              <Selo papel={membro.papel} />
              {podeRemover && membro.id !== eu.id && confirmando !== membro.id && (
                <button
                  type="button"
                  className={botaoPerigo}
                  aria-label={`Remover ${membro.apelido}`}
                  onClick={() => setConfirmando(membro.id)}
                >
                  Remover
                </button>
              )}
            </div>
            {confirmando === membro.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/40">
                <span className="flex-1">
                  Remover {membro.apelido}? Os lançamentos ficam, sem o nome em &quot;quem pagou&quot;.
                </span>
                <button type="button" className={botaoPerigo} disabled={ocupado} onClick={() => remover(membro)}>
                  Remover
                </button>
                <button type="button" className={botaoDiscreto} disabled={ocupado} onClick={() => setConfirmando(null)}>
                  Cancelar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {erro && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {erro}
        </p>
      )}
    </section>
  );
}

function ListaDeConvites(props: { convites: Convite[]; depoisDeMudar: () => Promise<void> }) {
  const { convites, depoisDeMudar } = props;
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar(convite: Convite) {
    setOcupado(convite.id);
    setErro(null);
    try {
      await (await obterRepositorio()).cancelarConvite(convite.id);
      await depoisDeMudar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section aria-labelledby="titulo-convites" className="flex flex-col gap-3">
      <h2 id="titulo-convites" className="text-sm font-medium text-zinc-500">
        Convites pendentes
      </h2>
      <ul className={cartaoLista}>
        {convites.map((convite) => (
          <li key={convite.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                {convite.apelido} <Selo papel={convite.papel} />
              </p>
              <p className="truncate text-sm text-zinc-500">{convite.email}</p>
            </div>
            <button
              type="button"
              className={botaoDiscreto}
              disabled={ocupado === convite.id}
              aria-label={`Cancelar o convite de ${convite.apelido}`}
              onClick={() => cancelar(convite)}
            >
              Cancelar
            </button>
          </li>
        ))}
      </ul>
      {erro && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {erro}
        </p>
      )}
    </section>
  );
}

const CONVITE_VAZIO: NovoConvite = { email: "", apelido: "", papel: "membro" };

function FormularioDeConvite({ depoisDeConvidar }: { depoisDeConvidar: () => Promise<void> }) {
  const [convite, setConvite] = useState<NovoConvite>(CONVITE_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function convidar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setResultado(null);
    try {
      const criado = await (await obterRepositorio()).convidar(convite);
      setConvite(CONVITE_VAZIO);
      await depoisDeConvidar();
      setResultado({
        ok: true,
        texto:
          MODO === "demo"
            ? `Convite para ${criado.apelido} criado. Na demonstração, ele fica pendente: ninguém recebe nada.`
            : `Pronto: ${criado.apelido} já pode entrar com o Google usando ${criado.email}.`,
      });
    } catch (falha) {
      setResultado({ ok: false, texto: mensagemDoErro(falha) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-convidar" className={`${cartao} flex flex-col gap-4`}>
      <div>
        <h2 id="titulo-convidar" className="font-medium">
          Convidar alguém
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          A pessoa entra com a conta Google desse e-mail — sem senha nova para lembrar.
        </p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={convidar}>
        <label className="flex flex-col gap-1 text-sm">
          E-mail do Google
          <input
            className={campo}
            type="email"
            required
            autoComplete="off"
            placeholder="nome@gmail.com"
            value={convite.email}
            onChange={(e) => setConvite({ ...convite, email: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Como chamar
          <input
            className={campo}
            required
            maxLength={40}
            placeholder="Ana"
            value={convite.apelido}
            onChange={(e) => setConvite({ ...convite, apelido: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Papel
          <select
            className={campo}
            value={convite.papel}
            onChange={(e) => setConvite({ ...convite, papel: e.target.value as Papel })}
          >
            <option value="membro">Membro — lança e vê tudo</option>
            <option value="admin">Admin — também convida e remove</option>
          </select>
        </label>
        <button type="submit" className={`${botaoPrincipal} w-fit`} disabled={enviando}>
          {enviando ? "Convidando…" : "Convidar"}
        </button>
      </form>
      {resultado && (
        <p
          role={resultado.ok ? "status" : "alert"}
          className={`text-sm ${resultado.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-400"}`}
        >
          {resultado.texto}
        </p>
      )}
    </section>
  );
}
