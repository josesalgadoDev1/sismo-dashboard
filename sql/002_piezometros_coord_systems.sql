-- Soporte para 3 sistemas de coordenadas en piezómetros.
--
-- Sistemas permitidos:
--   GEOGRAFICA - Lat/Lon WGS84 (directo al mapa)
--   UTM        - Este/Norte en WGS84 UTM (se convierte a lat/lon al guardar)
--   LOCAL      - Sistema Local Collahuasi (grid propio del sitio).
--                Se guardan los raw Este/Norte; lat/lon quedan NULL hasta
--                que se definan los parámetros de transformación del sitio.
--
-- Las columnas existentes `latitud` y `longitud` siguen siendo la fuente de
-- verdad para el mapa; las nuevas columnas guardan los valores originales
-- que entró el usuario para poder mostrarlos/editarlos en el sistema que
-- usó al crearlos.

ALTER TABLE piezometros
  ADD COLUMN IF NOT EXISTS sistema_coordenada VARCHAR(20) NOT NULL DEFAULT 'GEOGRAFICA',
  ADD COLUMN IF NOT EXISTS coord_este  NUMERIC(14, 6),
  ADD COLUMN IF NOT EXISTS coord_norte NUMERIC(14, 6),
  ADD COLUMN IF NOT EXISTS zona_utm    VARCHAR(4);

-- Constraint: solo valores permitidos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_piezo_sistema_coord'
  ) THEN
    ALTER TABLE piezometros
      ADD CONSTRAINT chk_piezo_sistema_coord
      CHECK (sistema_coordenada IN ('LOCAL', 'UTM', 'GEOGRAFICA'));
  END IF;
END$$;

-- Backfill: los piezómetros existentes estaban guardados como geográficas.
-- Copiamos longitud/latitud a coord_este/coord_norte para que la UI de
-- edición pueda mostrar los valores originales.
UPDATE piezometros
   SET coord_este  = longitud,
       coord_norte = latitud
 WHERE sistema_coordenada = 'GEOGRAFICA'
   AND coord_este  IS NULL
   AND coord_norte IS NULL
   AND longitud IS NOT NULL
   AND latitud  IS NOT NULL;
