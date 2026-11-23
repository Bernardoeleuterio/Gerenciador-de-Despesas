"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AvisoSemFamilia } from "@/componentes/aviso-sem-familia";
import { BotaoSair } from "@/componentes/botao-sair";
import { mensagemDoErro, semFamilia } from "@/componentes/erros";
import { botaoDiscreto, botaoPrincipal, cartao } from "@/componentes/estilos";
import { obterRepositorio, type Familia, type Membro } from "@/lib/dados";

type Estado =
  | { tipo: "carregando" }
  | { tipo: "pronto"; familia: Familia; eu: Membro }
  | { tipo: "sem-familia" }
  | { tipo: "falhou"; mensagem: string };

/** Quem está usando e de que família — os dados vêm do repositório, no navegador. */
export function Painel() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    let ativo = true;
    (async () => {
      const repo = await obterRepositorio();
      const [familia, eu] = await Promise.all([repo.familia(), repo.euMesmo()]);
      return { familia, eu };
    })().then(
      ({ familia, eu }) => ativo && setEstado({ tipo: "pronto", familia, eu }),
      (erro: unknown) =>
        ativo &&
        setEstado(semFamilia(erro) ? { tipo: "sem-familia" } : { tipo: "falhou", mensagem: mensagemDoErro(erro) }),
    );
    return () => {
      ativo = false;
    };
  }, []);

  if (estado.tipo === "carregando") {
    return <p className={`${cartao} text-sm text-zinc-500`}>Carregando…</p>;
  }
  if (estado.tipo === "sem-familia") return <AvisoSemFamilia />;
  if (estado.tipo === "falhou") {
    return (
      <div className={`${cartao} flex flex-col gap-3 text-sm`}>
        <p role="alert">{estado.mensagem}</p>
        <button type="button" className={`${botaoDiscreto} w-fit`} onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const { familia, eu } = estado;
  return (
    <section className={`${cartao} flex flex-col gap-4`} aria-label="Sua família">
      <div>
        <p className="text-lg font-medium">{familia.nome}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Você entrou como <strong className="font-medium">{eu.apelido}</strong>
          {eu.papel === "admin" ? ", admin da família" : ""}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/membros" className={botaoPrincipal}>
          Membros da família
        </Link>
        <BotaoSair />
      </div>
    </section>
  );
}
