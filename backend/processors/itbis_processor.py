import pandas as pd
import numpy as np
from io import BytesIO


ITBIS_COLUMN_ALIASES = {
    "rnc": ["rnc", "cedula", "rnc_cedula", "rnc o cedula", "identificacion"],
    "ncf": ["ncf", "comprobante", "numero_comprobante", "numero de comprobante fiscal"],
    "fecha": ["fecha", "date", "fecha_comprobante", "fecha de comprobante", "fecha_factura"],
    "tipo_comprobante": ["tipo", "tipo_comprobante", "tipo de comprobante", "tipo_ncf"],
    "monto_servicios": ["monto_servicios", "servicios", "monto en servicios", "facturado_servicios"],
    "monto_bienes": ["monto_bienes", "bienes", "monto en bienes", "facturado_bienes"],
    "monto_total": ["monto_total", "total", "monto total", "monto facturado", "importe_total", "valor_total"],
    "itbis_facturado": ["itbis_facturado", "itbis", "itbis facturado", "monto_itbis", "impuesto"],
    "itbis_retenido": ["itbis_retenido", "itbis retenido", "retencion_itbis"],
}


def _normalize_col(col: str) -> str:
    return col.strip().lower().replace(" ", "_")


def _map_columns(df: pd.DataFrame) -> dict:
    normalized = {_normalize_col(c): c for c in df.columns}
    mapping = {}
    for canonical, aliases in ITBIS_COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                mapping[canonical] = normalized[alias]
                break
    return mapping


def load_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "csv":
        try:
            df = pd.read_csv(BytesIO(file_bytes), encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(BytesIO(file_bytes), encoding="latin-1")
    elif ext in ("xlsx", "xls"):
        df = pd.read_excel(BytesIO(file_bytes))
    else:
        raise ValueError(f"Formato no soportado: {ext}")
    return df


def process(df: pd.DataFrame) -> dict:
    col_map = _map_columns(df)
    df = df.copy()

    # Rename to canonical names for easier processing
    df.rename(columns={v: k for k, v in col_map.items()}, inplace=True)

    numeric_cols = ["monto_servicios", "monto_bienes", "monto_total", "itbis_facturado", "itbis_retenido"]
    for c in numeric_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(
                df[c].astype(str).str.replace(",", "").str.replace("$", "").str.strip(),
                errors="coerce",
            ).fillna(0)

    if "fecha" in df.columns:
        # Try ISO format first; fall back to dayfirst for DD/MM/YYYY style
        fecha_iso = pd.to_datetime(df["fecha"], errors="coerce", dayfirst=False)
        fecha_day = pd.to_datetime(df["fecha"], errors="coerce", dayfirst=True)
        df["fecha"] = fecha_iso.where(fecha_iso.notna(), fecha_day)
        df["mes"] = df["fecha"].dt.to_period("M").astype(str)
    else:
        df["mes"] = "Sin fecha"

    total_rows = len(df)
    monto_total = float(df["monto_total"].sum()) if "monto_total" in df.columns else 0
    itbis_total = float(df["itbis_facturado"].sum()) if "itbis_facturado" in df.columns else 0
    itbis_retenido = float(df["itbis_retenido"].sum()) if "itbis_retenido" in df.columns else 0

    # Effective ITBIS rate
    tasa_efectiva = (itbis_total / monto_total * 100) if monto_total > 0 else 0

    # Monthly breakdown
    monthly = {}
    if "itbis_facturado" in df.columns:
        monthly_df = df.groupby("mes")["itbis_facturado"].sum().reset_index()
        monthly_df.columns = ["mes", "itbis"]
        monthly_df = monthly_df.sort_values("mes")
        monthly = {
            "labels": monthly_df["mes"].tolist(),
            "values": [round(float(v), 2) for v in monthly_df["itbis"].tolist()],
        }

    # By RNC if available
    top_rnc = {}
    if "rnc" in df.columns and "monto_total" in df.columns:
        rnc_df = df.groupby("rnc")["monto_total"].sum().nlargest(10).reset_index()
        top_rnc = {
            "labels": rnc_df["rnc"].astype(str).tolist(),
            "values": [round(float(v), 2) for v in rnc_df["monto_total"].tolist()],
        }

    # By tipo_comprobante
    by_tipo = {}
    if "tipo_comprobante" in df.columns:
        tipo_df = df.groupby("tipo_comprobante").size().reset_index(name="count")
        by_tipo = {
            "labels": tipo_df["tipo_comprobante"].astype(str).tolist(),
            "values": tipo_df["count"].tolist(),
        }

    # Monto servicios vs bienes
    servicios_bienes = {}
    if "monto_servicios" in df.columns and "monto_bienes" in df.columns:
        servicios_bienes = {
            "labels": ["Servicios", "Bienes"],
            "values": [round(float(df["monto_servicios"].sum()), 2), round(float(df["monto_bienes"].sum()), 2)],
        }

    # Preview table (first 100 rows with original structure)
    preview = df.head(100).replace({np.nan: None}).to_dict(orient="records")

    return {
        "summary": {
            "total_registros": total_rows,
            "monto_total": round(monto_total, 2),
            "itbis_total": round(itbis_total, 2),
            "itbis_retenido": round(itbis_retenido, 2),
            "tasa_efectiva": round(tasa_efectiva, 2),
        },
        "charts": {
            "monthly": monthly,
            "top_rnc": top_rnc,
            "by_tipo": by_tipo,
            "servicios_bienes": servicios_bienes,
        },
        "columns": list(df.columns),
        "preview": preview,
    }
