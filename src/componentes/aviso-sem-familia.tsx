import { BotaoSair } from "./botao-sair";
import { aviso } from "./estilos";

/** Para quem entrou com o Google mas não tem convite (ou foi removido da família). */
export function AvisoSemFamilia() {
  return (
    <div className={`${aviso} flex flex-col gap-3`}>
      <p className="font-medium">Acesso só por convite</p>
      <p>
        Sua conta Google entrou, mas ainda não faz parte de uma família. Peça ao admin da família
        para convidar o seu e-mail e entre de novo.
      </p>
      <div>
        <BotaoSair />
      </div>
    </div>
  );
}
