import json
import os
import shutil
import sqlite3
from pathlib import Path

# ==========================================================
# MG Concrete Customer Catalog Exporter
# يقرأ من جدول المنتجات الحقيقي الظاهر في شاشة البرنامج:
# inventory_product_pricing
# ويحدّث products.json الخاص بالكتالوج.
# يدعم أكثر من صورة للمنتج تلقائيًا من جدول product_images داخل البرنامج
# ويدعم أيضًا فولدر extra_images كحل احتياطي.
# ==========================================================

ERP_DB_PATH = r"C:\Users\MARSLINO\Desktop\mg concrete\database\mg_concrete.db"

CATALOG_DIR = Path(__file__).resolve().parent
IMAGES_DIR = CATALOG_DIR / "images"
EXTRA_IMAGES_DIR = CATALOG_DIR / "extra_images"
PRODUCTS_JSON = CATALOG_DIR / "products.json"

EXPORT_AVAILABLE_ONLY = True

SMALL_ITEM_FINISH_MULTIPLIER = 3
LARGE_ITEM_FINISH_MULTIPLIER = 2
SMALL_ITEM_MAX_KG = 2

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def safe_float(value, default=0.0):
    try:
        return float(value or 0)
    except (ValueError, TypeError):
        return default


def table_exists(cursor, table_name):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def clean_filename(value):
    text = str(value or "").strip()
    if not text:
        return "item"
    bad_chars = '<>:"/\\|?*'
    for ch in bad_chars:
        text = text.replace(ch, "_")
    return text.replace(" ", "_")


def copy_image_file(image_path, product_code, product_id, image_index):
    if not image_path:
        return ""

    source = Path(str(image_path))
    if not source.exists() or not source.is_file():
        print(f"Image not found: {image_path}")
        return ""

    IMAGES_DIR.mkdir(exist_ok=True)

    ext = source.suffix.lower() or ".jpg"
    safe_code = clean_filename(product_code or product_id)
    target_name = f"product_{safe_code}_{image_index}{ext}"
    target_path = IMAGES_DIR / target_name

    try:
        shutil.copy2(source, target_path)
        return f"images/{target_name}"
    except Exception as e:
        print(f"Image copy failed for {image_path}: {e}")
        return ""


def find_extra_images(product_code, product_id, product_name):
    """
    طرق إضافة صور زيادة للمنتج:
    1) extra_images/<code>/1.jpg, 2.jpg ...
    2) extra_images/<product_id>/1.jpg, 2.jpg ...
    3) extra_images/<product_name>/1.jpg, 2.jpg ...
    """
    if not EXTRA_IMAGES_DIR.exists():
        return []

    possible_names = [
        clean_filename(product_code),
        clean_filename(product_id),
        clean_filename(product_name),
    ]

    found = []
    seen = set()
    for folder_name in possible_names:
        folder = EXTRA_IMAGES_DIR / folder_name
        if not folder.exists() or not folder.is_dir():
            continue

        for file_path in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
            if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTENSIONS:
                key = str(file_path.resolve()).lower()
                if key not in seen:
                    seen.add(key)
                    found.append(file_path)

    return found


def get_db_extra_images(cursor, product_id, product_code):
    """Read extra images saved inside the ERP product_images table."""
    if not table_exists(cursor, "product_images"):
        return []

    try:
        cursor.execute("""
            SELECT image_path
            FROM product_images
            WHERE product_id = ?
               OR IFNULL(product_code, '') = ?
            ORDER BY sort_order ASC, id ASC
        """, (product_id, str(product_code or "")))
        return [Path(str(row[0])) for row in cursor.fetchall() if row and row[0]]
    except Exception as e:
        print("DB extra images read skipped:", e)
        return []


def build_product_images(cursor, main_image_path, product_code, product_id, product_name):
    all_sources = []

    if main_image_path:
        all_sources.append(Path(str(main_image_path)))

    # الصور الإضافية المسجلة من داخل برنامج MG Concrete
    all_sources.extend(get_db_extra_images(cursor, product_id, product_code))

    # دعم قديم اختياري: صور إضافية داخل فولدر extra_images
    all_sources.extend(find_extra_images(product_code, product_id, product_name))

    copied_images = []
    seen_targets = set()
    for index, source in enumerate(all_sources, start=1):
        copied = copy_image_file(source, product_code, product_id, index)
        if copied and copied not in seen_targets:
            seen_targets.add(copied)
            copied_images.append(copied)

    return copied_images


def weight_to_kg(base_qty, base_unit):
    qty = safe_float(base_qty)
    unit = str(base_unit or "").strip()

    if unit == "كجم":
        return qty
    if unit == "جرام":
        return qty / 1000
    if unit == "طن":
        return qty * 1000

    return None


def calculate_finished_price(sale_price, base_qty, base_unit):
    price = safe_float(sale_price)
    if price <= 0:
        return 0.0

    kg = weight_to_kg(base_qty, base_unit)
    if kg is None or kg <= SMALL_ITEM_MAX_KG:
        return price * SMALL_ITEM_FINISH_MULTIPLIER

    return price * LARGE_ITEM_FINISH_MULTIPLIER


def get_legacy_product_by_name(cursor):
    legacy = {}
    if not table_exists(cursor, "products"):
        return legacy

    try:
        cursor.execute("""
            SELECT name, price_before, price_after, image
            FROM products
        """)
        for name, price_before, price_after, image in cursor.fetchall():
            if name:
                legacy[str(name).strip()] = {
                    "price_before": safe_float(price_before),
                    "price_after": safe_float(price_after),
                    "image": image or "",
                }
    except Exception as e:
        print("Legacy products read skipped:", e)

    return legacy


def export_from_inventory_product_pricing(cursor):
    legacy_by_name = get_legacy_product_by_name(cursor)

    where = "WHERE IFNULL(is_active, 1) = 1"
    if EXPORT_AVAILABLE_ONLY:
        where += " AND IFNULL(product_stock_qty, 0) > 0"

    query = f"""
        SELECT
            id,
            product_code,
            product_name,
            base_qty,
            base_unit,
            sale_price,
            image_path,
            product_stock_qty,
            stock_status
        FROM inventory_product_pricing
        {where}
        ORDER BY id ASC
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    products = []
    for row in rows:
        (
            product_id,
            product_code,
            product_name,
            base_qty,
            base_unit,
            sale_price,
            image_path,
            product_stock_qty,
            stock_status,
        ) = row

        name = product_name or ""
        code = str(product_code or product_id)

        raw_price = safe_float(sale_price)

        legacy = legacy_by_name.get(str(name).strip(), {})
        if raw_price <= 0 and legacy:
            raw_price = safe_float(legacy.get("price_before"))

        finished_price = calculate_finished_price(raw_price, base_qty, base_unit)
        if finished_price <= 0 and legacy:
            finished_price = safe_float(legacy.get("price_after"))

        main_image_path = image_path or legacy.get("image", "")
        images = build_product_images(cursor, main_image_path, code, product_id, name)

        products.append({
            "id": int(product_id),
            "code": code,
            "name": name,
            "category": "منتجات",
            "price_without_finish": raw_price,
            "price_finished": finished_price,
            "image": images[0] if images else "",
            "images": images,
            "stock_qty": safe_float(product_stock_qty),
            "stock_status": stock_status or "",
        })

    return products


def export_catalog():
    if not os.path.exists(ERP_DB_PATH):
        print("Database not found:", ERP_DB_PATH)
        return

    IMAGES_DIR.mkdir(exist_ok=True)
    EXTRA_IMAGES_DIR.mkdir(exist_ok=True)

    conn = sqlite3.connect(ERP_DB_PATH)
    cur = conn.cursor()

    try:
        print("Database found and connection successful: 'mg_concrete.db'")

        if not table_exists(cur, "inventory_product_pricing"):
            print("Table 'inventory_product_pricing' not found.")
            print("Cannot export the real product list shown in the ERP screen.")
            return

        print("Table 'inventory_product_pricing' found.")
        print("Using real ERP product pricing table, not old 'products' table.")
        print("Multiple product images support: ON")
        print("Reading extra images from ERP table: product_images")

        products = export_from_inventory_product_pricing(cur)

        with open(PRODUCTS_JSON, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)

        print("CATALOG EXPORT REAL ERP PRODUCTS + AUTOMATIC MULTIPLE IMAGES FIXED")
        print("Export complete!")
        print(f"- {len(products)} products exported.")
        print("- 'products.json' has been updated successfully.")
        print("- Extra images folder:", EXTRA_IMAGES_DIR)

        if EXPORT_AVAILABLE_ONLY:
            print("- Available products only: ON")
        else:
            print("- Available products only: OFF")

    except Exception as e:
        print("EXPORT ERROR:", e)
    finally:
        conn.close()


if __name__ == "__main__":
    export_catalog()
