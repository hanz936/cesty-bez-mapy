-- Migrace 039: neplátce DPH — default vat_rate=0 a update existing.
-- Jana je neplátce DPH, sazba se na žádném produktu nepoužívá.
-- Sloupec necháváme, kdyby se v budoucnu rozhodla být plátcem.

ALTER TABLE public.products ALTER COLUMN vat_rate SET DEFAULT 0;

UPDATE public.products SET vat_rate = 0 WHERE vat_rate <> 0;
