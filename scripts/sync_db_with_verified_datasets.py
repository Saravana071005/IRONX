"""
Syncs data/nutrition.db with the verified datasets:
1. INX_AI_VERIFIED_FOOD_DATABASE.csv -> foods table
2. INX_AI_VERIFIED_RECIPE_DATABASE.csv -> verified_recipes table
3. INX_AI_RECIPE_INGREDIENTS.csv -> recipe_ingredients table
4. Updates data/nutrition_cache.json
"""

import os
import json
import sqlite3
import pandas as pd

WORKSPACE_DIR = r"C:\Users\Admin\.gemini\antigravity-ide\scratch\opengym"
DATA_DIR = os.path.join(WORKSPACE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "nutrition.db")
FOOD_CSV = os.path.join(WORKSPACE_DIR, "INX_AI_VERIFIED_FOOD_DATABASE.csv")
RECIPE_CSV = os.path.join(WORKSPACE_DIR, "INX_AI_VERIFIED_RECIPE_DATABASE.csv")
ING_CSV = os.path.join(WORKSPACE_DIR, "INX_AI_RECIPE_INGREDIENTS.csv")

def sync():
    print("Connecting to", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Update foods table schema if needed
    cur.execute("PRAGMA table_info(foods)")
    cols = [c[1] for c in cur.fetchall()]

    new_cols = [
        ("category", "TEXT"),
        ("subcategory", "TEXT"),
        ("food_name_english", "TEXT"),
        ("food_name_tamil", "TEXT"),
        ("food_name_hindi", "TEXT"),
        ("scientific_name", "TEXT"),
        ("preparation_state", "TEXT"),
        ("edible_portion_basis", "TEXT"),
        ("moisture_g", "REAL"),
        ("source_reference", "TEXT"),
        ("source_version", "TEXT"),
        ("data_quality_status", "TEXT"),
        ("licence_status", "TEXT"),
        ("last_verified_date", "TEXT")
    ]
    for cname, ctype in new_cols:
        if cname not in cols:
            cur.execute(f"ALTER TABLE foods ADD COLUMN {cname} {ctype}")
            print(f"Added column {cname} to foods table.")

    # 2. Insert or replace verified foods from INX_AI_VERIFIED_FOOD_DATABASE.csv
    food_df = pd.read_csv(FOOD_CSV)
    print(f"Syncing {len(food_df)} verified foods into SQLite...")

    for _, r in food_df.iterrows():
        fid = str(r['food_id']).strip()
        fname = str(r['food_name']).strip()
        eng_name = str(r.get('food_name_english', fname)).strip()
        tam_name = "" if pd.isna(r.get('food_name_tamil')) else str(r['food_name_tamil']).strip()
        hin_name = "" if pd.isna(r.get('food_name_hindi')) else str(r['food_name_hindi']).strip()
        aliases_str = "" if pd.isna(r.get('aliases')) else str(r['aliases']).strip()
        aliases_list = [a.strip() for a in aliases_str.split(';') if a.strip()]

        cat = str(r['category']).strip()
        fstate = str(r['food_state']).strip()
        pstate = str(r.get('preparation_state', '')).strip()
        scie = "" if pd.isna(r.get('scientific_name')) else str(r['scientific_name']).strip()

        kcal = float(r['energy_kcal_per_100g']) if pd.notna(r.get('energy_kcal_per_100g')) else 0.0
        p = float(r['protein_g_per_100g']) if pd.notna(r.get('protein_g_per_100g')) else 0.0
        c = float(r['carbohydrate_g_per_100g']) if pd.notna(r.get('carbohydrate_g_per_100g')) else 0.0
        f = float(r['fat_g_per_100g']) if pd.notna(r.get('fat_g_per_100g')) else 0.0
        fib = float(r['fibre_g_per_100g']) if pd.notna(r.get('fibre_g_per_100g')) else 0.0
        water = float(r['moisture_g_per_100g']) if pd.notna(r.get('moisture_g_per_100g')) else None

        s_name = str(r['source_name']).strip()
        s_id = str(r.get('source_record_id', '')).strip()
        s_ref = str(r.get('source_reference', '')).strip()
        s_ver = str(r.get('source_version', '')).strip()
        q_stat = str(r.get('data_quality_status', '')).strip()
        lic = str(r.get('licence_status', '')).strip()
        vdate = str(r.get('last_verified_date', '')).strip()

        canonical = f"{fname} {tam_name} {hin_name} {scie} {' '.join(aliases_list)}".lower()

        subcat = str(r.get('subcategory', '')).strip()

        cur.execute("""
            INSERT OR REPLACE INTO foods (
                id, name, canonical_name, alternate_names, tamil_name, hindi_name,
                food_group, category, subcategory, prep_state, source, source_id, serving_basis_g,
                energy_kcal, protein_g, carb_g, fat_g, fibre_g, moisture_g,
                scientific_name, preparation_state, edible_portion_basis, source_reference,
                source_version, data_quality_status, licence_status, last_verified_date,
                food_name_english, food_name_tamil, food_name_hindi, confidence, is_recipe
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (
            fid, fname, canonical, json.dumps(aliases_list), tam_name, hin_name,
            cat, cat, subcat, fstate, s_name, s_id, 100.0,
            kcal, p, c, f, fib, water,
            scie, pstate, "100g edible portion", s_ref,
            s_ver, q_stat, lic, vdate,
            eng_name, tam_name, hin_name, "verified_high"
        ))

    conn.commit()
    print("Verified foods synced.")

    # 3. Create or replace verified_recipes table
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS verified_recipes (
            recipe_id TEXT PRIMARY KEY,
            recipe_name TEXT NOT NULL,
            recipe_name_tamil TEXT,
            recipe_category TEXT,
            cuisine TEXT,
            ingredients TEXT,
            ingredient_food_ids TEXT,
            ingredient_quantities_g TEXT,
            ingredient_preparation_states TEXT,
            cooking_method TEXT,
            total_recipe_weight_g REAL,
            serving_count REAL,
            serving_weight_g REAL,
            total_energy_kcal REAL,
            total_protein_g REAL,
            total_carbohydrate_g REAL,
            total_fat_g REAL,
            total_fibre_g REAL,
            nutrition_per_100g TEXT,
            nutrition_per_serving TEXT,
            source_name TEXT,
            source_reference TEXT,
            calculation_method TEXT,
            confidence_level TEXT
        );
    """)

    recipe_df = pd.read_csv(RECIPE_CSV)
    print(f"Syncing {len(recipe_df)} verified recipes...")
    for _, r in recipe_df.iterrows():
        cur.execute("""
            INSERT OR REPLACE INTO verified_recipes (
                recipe_id, recipe_name, recipe_name_tamil, recipe_category, cuisine,
                ingredients, ingredient_food_ids, ingredient_quantities_g, ingredient_preparation_states,
                cooking_method, total_recipe_weight_g, serving_count, serving_weight_g,
                total_energy_kcal, total_protein_g, total_carbohydrate_g, total_fat_g, total_fibre_g,
                nutrition_per_100g, nutrition_per_serving, source_name, source_reference,
                calculation_method, confidence_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            r['recipe_id'], r['recipe_name'], r.get('recipe_name_tamil', ''), r['recipe_category'], r['cuisine'],
            r['ingredients'], r['ingredient_food_ids'], r['ingredient_quantities_g'], r['ingredient_preparation_states'],
            r['cooking_method'], float(r['total_recipe_weight_g']), float(r['serving_count']), float(r['serving_weight_g']),
            float(r['total_energy_kcal']), float(r['total_protein_g']), float(r['total_carbohydrate_g']), float(r['total_fat_g']), float(r['total_fibre_g']),
            r['nutrition_per_100g'], r['nutrition_per_serving'], r['source_name'], r['source_reference'],
            r['calculation_method'], r['confidence_level']
        ))
    conn.commit()
    print("Verified recipes synced.")

    # 4. Sync recipe_ingredients table
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS verified_recipe_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id TEXT,
            recipe_name TEXT,
            ingredient_sequence INTEGER,
            ingredient_food_id TEXT,
            ingredient_name TEXT,
            ingredient_quantity REAL,
            ingredient_unit TEXT,
            ingredient_weight_g REAL,
            prep_state TEXT,
            contribution_energy_kcal REAL,
            contribution_protein_g REAL,
            contribution_carbs_g REAL,
            contribution_fat_g REAL,
            contribution_fibre_g REAL
        );
        DELETE FROM verified_recipe_ingredients;
    """)

    ing_df = pd.read_csv(ING_CSV)
    print(f"Syncing {len(ing_df)} recipe ingredients...")
    for _, r in ing_df.iterrows():
        cur.execute("""
            INSERT INTO verified_recipe_ingredients (
                recipe_id, recipe_name, ingredient_sequence, ingredient_food_id,
                ingredient_name, ingredient_quantity, ingredient_unit, ingredient_weight_g,
                prep_state, contribution_energy_kcal, contribution_protein_g, contribution_carbs_g,
                contribution_fat_g, contribution_fibre_g
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            r['recipe_id'], r['recipe_name'], int(r['ingredient_sequence']), r['ingredient_food_id'],
            r['ingredient_name'], float(r['ingredient_quantity']), r['ingredient_unit'], float(r['ingredient_weight_g']),
            r['prep_state'], float(r['contribution_energy_kcal']), float(r['contribution_protein_g']), float(r['contribution_carbs_g']),
            float(r['contribution_fat_g']), float(r['contribution_fibre_g'])
        ))
    conn.commit()
    print("Recipe ingredients synced.")

    # 5. Export updated search cache
    print("Updating nutrition_cache.json...")
    cur.execute("""
        SELECT id, name, canonical_name, alternate_names, tamil_name, hindi_name,
               food_group, energy_kcal, protein_g, carb_g, fat_g, fibre_g, is_recipe,
               prep_state, source, scientific_name
        FROM foods
    """)
    rows = cur.fetchall()
    cache_foods = []
    for r in rows:
        aliases = []
        try:
            if r[3]: aliases = json.loads(r[3])
        except:
            pass
        cache_foods.append({
            "id": r[0],
            "name": r[1],
            "canonical": r[2],
            "aliases": aliases,
            "tamil": r[4] or "",
            "hindi": r[5] or "",
            "group": r[6] or "",
            "kcal": r[7],
            "protein": r[8],
            "carb": r[9],
            "fat": r[10],
            "fibre": r[11],
            "is_recipe": bool(r[12]),
            "prep_state": r[13] or "raw",
            "source": r[14],
            "scientific_name": r[15] or ""
        })

    cur.execute("SELECT recipe_id, recipe_name, recipe_name_tamil, recipe_category, cuisine, serving_count, serving_weight_g, total_energy_kcal, total_protein_g, total_carbohydrate_g, total_fat_g, total_fibre_g, nutrition_per_serving FROM verified_recipes")
    cache_recipes = []
    for r in cur.fetchall():
        cache_recipes.append({
            "recipe_id": r[0],
            "name": r[1],
            "tamil": r[2] or "",
            "category": r[3] or "",
            "cuisine": r[4] or "",
            "servings": r[5],
            "serving_weight_g": r[6],
            "total_kcal": r[7],
            "total_p": r[8],
            "total_c": r[9],
            "total_f": r[10],
            "total_fibre": r[11],
            "per_serving": json.loads(r[12]) if r[12] else {}
        })

    cache = {
        "version": "2.0.0",
        "verified_foods_count": len(cache_foods),
        "verified_recipes_count": len(cache_recipes),
        "foods": cache_foods,
        "recipes": cache_recipes
    }
    cache_path = os.path.join(DATA_DIR, "nutrition_cache.json")
    with open(cache_path, "w", encoding="utf-8") as fp:
        json.dump(cache, fp, ensure_ascii=False)
    print(f"Updated nutrition_cache.json ({len(cache_foods)} foods, {len(cache_recipes)} recipes, {os.path.getsize(cache_path) / 1024:.1f} KB).")

    conn.close()
    print("Database sync complete!")

if __name__ == "__main__":
    sync()
