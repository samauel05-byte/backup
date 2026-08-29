# ITBIS Análisis

Aplicación web para analizar archivos 606 (compras) y 607 (ventas), generar
el cuadre preliminar del IT-1 y exportar los resultados a Excel o PDF.

Los archivos se procesan localmente en el navegador: la información fiscal
no se envía a ningún servidor.

## Uso local

Requiere Python 3 únicamente:

```bash
./start.sh
```

Luego abre <http://localhost:8000>.

## Publicación

La aplicación se despliega como un sitio estático en Vercel. El contenido de
`frontend/` es el artefacto de producción y no requiere variables de entorno.

## Formatos admitidos

- CSV
- XLSX
- XLS
- Tamaño máximo: 20 MB

La aplicación intenta detectar automáticamente la hoja, la fila de encabezado
y las columnas relevantes de plantillas 606 y 607.
