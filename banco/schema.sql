CREATE TABLE IF NOT EXISTS public.catalogo_pedidos (
 id uuid PRIMARY KEY,
 itens jsonb NOT NULL,
 total_centavos integer NOT NULL CHECK(total_centavos > 0),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalogo_pedidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogo_pedidos FROM anon, authenticated;
GRANT SELECT, INSERT ON public.catalogo_pedidos TO service_role;
