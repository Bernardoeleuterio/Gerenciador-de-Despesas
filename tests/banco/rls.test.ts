import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { CATEGORIAS_PADRAO } from "@/lib/dados/categorias-padrao";

// Postgres de verdade, em memória: a base do Supabase + todas as migrações, em ordem.
const base = readFileSync(new URL("./supabase-base.sql", import.meta.url), "utf8");
const pastaMigracoes = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const migracoes = readdirSync(pastaMigracoes)
  .filter((arquivo) => arquivo.endsWith(".sql"))
  .sort()
  .map((arquivo) => readFileSync(pastaMigracoes + arquivo, "utf8"));

const TABELAS = ["familias", "membros", "convites", "contas", "categorias", "lancamentos"];

const FAMILIA_A = "f000000a-0000-4000-8000-000000000000";
const FAMILIA_B = "f000000b-0000-4000-8000-000000000000";
const ADMIN_A = "0000000a-0000-4000-8000-000000000001";
const MEMBRO_A = "0000000a-0000-4000-8000-000000000002";
const ADMIN_B = "0000000b-0000-4000-8000-000000000001";
const SEM_FAMILIA = "00000000-0000-4000-8000-000000000099";
const M_ADMIN_A = "a000000a-0000-4000-8000-000000000001";
const LANCAMENTO_B = "1000000b-0000-4000-8000-000000000001";

let db: PGlite;

/** Roda a ação logado como `usuario` (papel authenticated), ou sem login (anon) se for null. */
async function como<T>(usuario: string | null, acao: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ""]);
  await db.exec(usuario ? "set role authenticated" : "set role anon");
  try {
    return await acao();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function categoria(familia: string, nome: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select id from categorias where familia_id = $1 and nome = $2",
    [familia, nome],
  );
  return rows[0].id;
}

/** Lança uma despesa com o papel atual. Sem criadoPor, o banco usa auth.uid(). */
function lancar(dados: { familia: string; categoria: string; valor?: number; criadoPor?: string }) {
  return db.query<{ id: string }>(
    `insert into lancamentos (familia_id, tipo, valor_centavos, data, descricao, categoria_id, criado_por)
     values ($1, 'despesa', $2, current_date, 'teste', $3, coalesce($4::uuid, auth.uid()))
     returning id`,
    [dados.familia, dados.valor ?? 5000, dados.categoria, dados.criadoPor ?? null],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(base);
  for (const migracao of migracoes) await db.exec(migracao);

  // Seed como superusuário, como o seed real (service role) fará na Etapa 4.
  await db.exec(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'admin.a@exemplo.com'),
      ('${MEMBRO_A}', 'membro.a@exemplo.com'),
      ('${ADMIN_B}', 'admin.b@exemplo.com'),
      ('${SEM_FAMILIA}', 'ninguem@exemplo.com');

    insert into familias (id, nome) values
      ('${FAMILIA_A}', 'Família A'),
      ('${FAMILIA_B}', 'Família B');

    insert into membros (id, familia_id, user_id, apelido, papel) values
      ('${M_ADMIN_A}', '${FAMILIA_A}', '${ADMIN_A}', 'Admin A', 'admin'),
      (gen_random_uuid(), '${FAMILIA_A}', '${MEMBRO_A}', 'Membro A', 'membro'),
      (gen_random_uuid(), '${FAMILIA_B}', '${ADMIN_B}', 'Admin B', 'admin');
  `);

  await db.query(
    `insert into lancamentos (id, familia_id, tipo, valor_centavos, data, descricao, categoria_id)
     values ($1, $2, 'despesa', 12345, current_date, 'mercado da família B', $3)`,
    [LANCAMENTO_B, FAMILIA_B, await categoria(FAMILIA_B, "Mercado")],
  );
});

describe("schema", () => {
  it("toda família nasce com as 12 categorias padrão", async () => {
    for (const familia of [FAMILIA_A, FAMILIA_B]) {
      const { rows } = await db.query<{ total: number }>(
        "select count(*)::int as total from categorias where familia_id = $1",
        [familia],
      );
      expect(rows[0].total).toBe(12);
    }
  });

  it("as categorias do banco são as mesmas da demo", async () => {
    const { rows } = await db.query<{ nome: string; icone: string }>(
      "select nome, icone from categorias where familia_id = $1 order by nome",
      [FAMILIA_A],
    );
    const daDemo = [...CATEGORIAS_PADRAO].sort((a, b) => (a.nome < b.nome ? -1 : 1));
    expect(rows).toEqual(daDemo.map(({ nome, icone }) => ({ nome, icone })));
  });

  it("recusa valor zero, negativo ou acima de R$ 10 milhões", async () => {
    const mercado = await categoria(FAMILIA_A, "Mercado");
    for (const valor of [0, -500, 1_000_000_001]) {
      await expect(lancar({ familia: FAMILIA_A, categoria: mercado, valor })).rejects.toThrow(
        /check constraint/,
      );
    }
  });

  it("parcela vem com os três campos, ou sem nenhum", async () => {
    const mercado = await categoria(FAMILIA_A, "Mercado");
    await expect(
      db.query(
        `insert into lancamentos (familia_id, tipo, valor_centavos, data, descricao, categoria_id, parcela_num)
         values ($1, 'despesa', 6000, current_date, 'geladeira', $2, 1)`,
        [FAMILIA_A, mercado],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("cartão exige fechamento e vencimento; conta comum não aceita esses dias", async () => {
    await expect(
      db.query("insert into contas (familia_id, nome, tipo) values ($1, 'Cartão', 'cartao')", [FAMILIA_A]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        "insert into contas (familia_id, nome, tipo, dia_fechamento, dia_vencimento) values ($1, 'Pix', 'conta', 5, 10)",
        [FAMILIA_A],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("RLS: uma família não enxerga a outra", () => {
  it("o membro só vê a própria família", async () => {
    const { rows } = await como(ADMIN_A, () => db.query<{ id: string }>("select id from familias"));
    expect(rows.map((linha) => linha.id)).toEqual([FAMILIA_A]);
  });

  it("não lê categorias nem lançamentos da outra família", async () => {
    await como(ADMIN_A, async () => {
      const categorias = await db.query<{ familia_id: string }>("select familia_id from categorias");
      expect(categorias.rows).toHaveLength(12);
      expect(new Set(categorias.rows.map((linha) => linha.familia_id))).toEqual(new Set([FAMILIA_A]));

      const lancamento = await db.query("select id from lancamentos where id = $1", [LANCAMENTO_B]);
      expect(lancamento.rows).toHaveLength(0);
    });
  });

  it("não cria lançamento na outra família", async () => {
    const mercadoB = await categoria(FAMILIA_B, "Mercado");
    await expect(
      como(ADMIN_A, () => lancar({ familia: FAMILIA_B, categoria: mercadoB })),
    ).rejects.toThrow(/row-level security/);
  });

  it("não altera nem apaga lançamento da outra família", async () => {
    await como(ADMIN_A, async () => {
      const alterou = await db.query("update lancamentos set valor_centavos = 1 where id = $1", [LANCAMENTO_B]);
      const apagou = await db.query("delete from lancamentos where id = $1", [LANCAMENTO_B]);
      expect(alterou.affectedRows).toBe(0);
      expect(apagou.affectedRows).toBe(0);
    });
    const { rows } = await db.query<{ valor: number }>(
      "select valor_centavos::int as valor from lancamentos where id = $1",
      [LANCAMENTO_B],
    );
    expect(rows[0].valor).toBe(12345);
  });

  it("não aponta para categoria da outra família, mesmo lançando na própria", async () => {
    const mercadoB = await categoria(FAMILIA_B, "Mercado");
    await expect(
      como(ADMIN_A, () => lancar({ familia: FAMILIA_A, categoria: mercadoB })),
    ).rejects.toThrow(/foreign key/);
  });

  it("não move lançamento para outra família nem troca o autor", async () => {
    const mercadoA = await categoria(FAMILIA_A, "Mercado");
    await como(ADMIN_A, async () => {
      const { rows } = await lancar({ familia: FAMILIA_A, categoria: mercadoA });
      await expect(
        db.query("update lancamentos set familia_id = $1 where id = $2", [FAMILIA_B, rows[0].id]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("update lancamentos set criado_por = $1 where id = $2", [MEMBRO_A, rows[0].id]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("não lança em nome de outra pessoa", async () => {
    const mercadoA = await categoria(FAMILIA_A, "Mercado");
    await expect(
      como(ADMIN_A, () => lancar({ familia: FAMILIA_A, categoria: mercadoA, criadoPor: MEMBRO_A })),
    ).rejects.toThrow(/row-level security/);
  });

  it("quem não é de família nenhuma não vê nada", async () => {
    await como(SEM_FAMILIA, async () => {
      for (const tabela of TABELAS) {
        const { rows } = await db.query(`select * from ${tabela}`);
        expect(rows, tabela).toHaveLength(0);
      }
    });
  });

  it("sem login, não tem nem permissão de tabela", async () => {
    for (const tabela of TABELAS) {
      await expect(como(null, () => db.query(`select * from ${tabela}`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });
});

describe("RLS: papéis dentro da família", () => {
  it("membro comum lança e vê os lançamentos de todos da família", async () => {
    const mercadoA = await categoria(FAMILIA_A, "Mercado");
    const doAdmin = await como(ADMIN_A, () => lancar({ familia: FAMILIA_A, categoria: mercadoA }));
    await como(MEMBRO_A, async () => {
      await lancar({ familia: FAMILIA_A, categoria: mercadoA });
      const { rows } = await db.query("select id from lancamentos where id = $1", [doAdmin.rows[0].id]);
      expect(rows).toHaveLength(1);
    });
  });

  it("só admin vê e cria convites", async () => {
    const convidar = () =>
      db.query("insert into convites (familia_id, email, apelido) values ($1, 'novo@exemplo.com', 'Novo')", [
        FAMILIA_A,
      ]);
    await expect(como(MEMBRO_A, convidar)).rejects.toThrow(/row-level security/);
    await como(ADMIN_A, convidar);
    const { rows } = await como(MEMBRO_A, () => db.query("select id from convites"));
    expect(rows).toHaveLength(0);
  });

  it("membro só nasce de convite: nem o admin insere membro pelo app", async () => {
    for (const usuario of [MEMBRO_A, ADMIN_A]) {
      await expect(
        como(usuario, () =>
          db.query("insert into membros (familia_id, user_id, apelido) values ($1, $2, 'Intruso')", [
            FAMILIA_A,
            SEM_FAMILIA,
          ]),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("só admin remove membro, e nunca a si mesmo", async () => {
    const peloMembro = await como(MEMBRO_A, () => db.query("delete from membros where id = $1", [M_ADMIN_A]));
    expect(peloMembro.affectedRows).toBe(0);
    const aSiMesmo = await como(ADMIN_A, () => db.query("delete from membros where id = $1", [M_ADMIN_A]));
    expect(aSiMesmo.affectedRows).toBe(0);
  });

  it("o admin não tira o próprio papel de admin, mas muda o próprio apelido", async () => {
    await expect(
      como(ADMIN_A, () => db.query("update membros set papel = 'membro' where id = $1", [M_ADMIN_A])),
    ).rejects.toThrow(/row-level security/);
    const apelido = await como(ADMIN_A, () =>
      db.query("update membros set apelido = 'Admin A' where id = $1", [M_ADMIN_A]),
    );
    expect(apelido.affectedRows).toBe(1);
  });

  it("admin renomeia a família; membro comum não", async () => {
    const membro = await como(MEMBRO_A, () =>
      db.query("update familias set nome = 'Outro nome' where id = $1", [FAMILIA_A]),
    );
    expect(membro.affectedRows).toBe(0);
    const admin = await como(ADMIN_A, () =>
      db.query("update familias set nome = 'Família A (renomeada)' where id = $1", [FAMILIA_A]),
    );
    expect(admin.affectedRows).toBe(1);
  });

  it("ninguém cria nem apaga família pelo app", async () => {
    await expect(
      como(ADMIN_A, () => db.query("insert into familias (nome) values ('Nova')")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      como(ADMIN_A, () => db.query("delete from familias where id = $1", [FAMILIA_A])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("convites: só entra quem foi convidado", () => {
  const NOVA = "0000000a-0000-4000-8000-000000000003";
  const LENTA = "0000000a-0000-4000-8000-000000000004";
  const VOLTA = "0000000a-0000-4000-8000-000000000005";

  const convidar = (email: string, apelido: string, papel = "membro") =>
    como(ADMIN_A, () =>
      db.query("insert into convites (familia_id, email, apelido, papel) values ($1, $2, $3, $4)", [
        FAMILIA_A,
        email,
        apelido,
        papel,
      ]),
    );

  async function membroDe(usuario: string) {
    const { rows } = await db.query<{ familia_id: string; apelido: string; papel: string }>(
      "select familia_id, apelido, papel from membros where user_id = $1",
      [usuario],
    );
    return rows;
  }

  async function hook(email: string) {
    await db.exec("set role supabase_auth_admin");
    try {
      const { rows } = await db.query<{ resposta: unknown }>(
        "select public.antes_de_criar_usuario($1::jsonb) as resposta",
        [JSON.stringify({ metadata: { name: "before-user-created" }, user: { email } })],
      );
      return rows[0].resposta;
    } finally {
      await db.exec("reset role");
    }
  }

  it("conta nova, e-mail confirmado e convite: vira membro com o apelido e o papel do convite", async () => {
    await convidar("nova@exemplo.com", "Nova");
    await db.query(
      "insert into auth.users (id, email, email_confirmed_at) values ($1, 'nova@exemplo.com', now())",
      [NOVA],
    );
    expect(await membroDe(NOVA)).toEqual([{ familia_id: FAMILIA_A, apelido: "Nova", papel: "membro" }]);
    const { rows } = await db.query("select 1 from convites where email = 'nova@exemplo.com'");
    expect(rows).toHaveLength(0); // convite usado some
  });

  it("e-mail ainda não confirmado não entra; quando confirma, entra", async () => {
    await convidar("lenta@exemplo.com", "Lenta");
    await db.query("insert into auth.users (id, email) values ($1, 'lenta@exemplo.com')", [LENTA]);
    expect(await membroDe(LENTA)).toEqual([]);
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [LENTA]);
    expect(await membroDe(LENTA)).toHaveLength(1);
  });

  it("convite para quem já tem conta vale na hora", async () => {
    await db.query(
      "insert into auth.users (id, email, email_confirmed_at) values ($1, 'volta@exemplo.com', now())",
      [VOLTA],
    );
    expect(await membroDe(VOLTA)).toEqual([]);
    await convidar("volta@exemplo.com", "Volta", "admin");
    expect(await membroDe(VOLTA)).toEqual([{ familia_id: FAMILIA_A, apelido: "Volta", papel: "admin" }]);
  });

  it("hook do Auth: com convite, a conta pode nascer; sem convite, é recusada", async () => {
    await convidar("bia@exemplo.com", "Bia");
    expect(await hook("  Bia@Exemplo.com ")).toEqual({});
    expect(await hook("estranho@exemplo.com")).toMatchObject({
      error: { http_code: 403, message: expect.stringMatching(/só por convite/) },
    });
  });

  it("o app não chama o hook nem a função que aceita convites", async () => {
    for (const usuario of [ADMIN_A, null]) {
      await expect(
        como(usuario, () => db.query("select public.antes_de_criar_usuario('{}'::jsonb)")),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      como(ADMIN_A, () => db.query("select privado.aceitar_convites($1, 'x@exemplo.com')", [ADMIN_A])),
    ).rejects.toThrow(/permission denied/);
  });

  it("o admin remove outro membro: o que ele pagou fica sem 'quem pagou', e ele deixa de ver a família", async () => {
    const {
      rows: [nova],
    } = await db.query<{ id: string }>("select id from membros where user_id = $1", [NOVA]);
    const {
      rows: [lancamento],
    } = await como(NOVA, async () =>
      db.query<{ id: string }>(
        `insert into lancamentos (familia_id, tipo, valor_centavos, data, descricao, categoria_id, pago_por)
         values ($1, 'despesa', 2500, current_date, 'pão', $2, $3) returning id`,
        [FAMILIA_A, await categoria(FAMILIA_A, "Mercado"), nova.id],
      ),
    );

    const removeu = await como(ADMIN_A, () => db.query("delete from membros where id = $1", [nova.id]));
    expect(removeu.affectedRows).toBe(1);

    const { rows } = await db.query<{ pago_por: string | null }>(
      "select pago_por from lancamentos where id = $1",
      [lancamento.id],
    );
    expect(rows).toEqual([{ pago_por: null }]);
    const visto = await como(NOVA, () => db.query("select id from lancamentos"));
    expect(visto.rows).toEqual([]);
  });
});
