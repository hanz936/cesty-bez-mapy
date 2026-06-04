-- Migrace 040: neplátce DPH — refund flow používá storno fakturu místo ODD/dobropisu.
-- Přejmenování sloupců facturoid_credit_note_* → facturoid_storno_*.

ALTER TABLE public.orders
  RENAME COLUMN facturoid_credit_note_id TO facturoid_storno_id;

ALTER TABLE public.orders
  RENAME COLUMN facturoid_credit_note_number TO facturoid_storno_number;
