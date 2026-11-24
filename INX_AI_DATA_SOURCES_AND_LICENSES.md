# IRONX AI — DATA SOURCES, PROVENANCE & LICENSING SPECIFICATION
**System Identity:** IRONX  
**AI Engine:** IRONX AI (Nutrition Coach & Knowledge Engine)  
**Document Classification:** Legal, Intellectual Property & Data Provenance Specification  
**Version:** 1.0.0 (Release Verified)  
**Last Verified Date:** 2026-11-24  

---

## 1. EXECUTIVE SUMMARY & LEGAL ETHICS

IRONX AI is grounded exclusively in verified, peer-reviewed, laboratory-analyzed, and legally permissible food composition databases. Under strict architectural governance:
- **Zero Hallucination:** No food composition values, calorie counts, or macronutrient metrics are generated or hallucinated by Large Language Models.
- **Zero Synthetic Records:** No manufactured or synthetic food records are used. All records trace back to identifiable governmental or academic food science publications.
- **Independent Knowledge System:** IRONX AI operates autonomously with its own curated knowledge base and does not claim or rely on proprietary weights or private training data from ChatGPT or third-party AI services.

All datasets incorporated into `INX_AI_VERIFIED_FOOD_DATABASE.csv`, `INX_AI_VERIFIED_RECIPE_DATABASE.csv`, and `INX_AI_RECIPE_INGREDIENTS.csv` are legally sourced under open public domain, open government data licenses, and academic non-commercial research covenants.

---

## 2. PRIMARY VERIFIED DATA SOURCES & ATTRIBUTION

### 2.1. ICMR-NIN Indian Food Composition Tables (IFCT 2017)
- **Publishing Authority:** National Institute of Nutrition (NIN), Indian Council of Medical Research (ICMR), Department of Health Research, Ministry of Health and Family Welfare, Government of India.
- **Authors/Editors:** T. Longvah, R. Ananthan, K. Bhaskarachary, K. Venkaiah.
- **Publication Year:** 2017 (ISBN 978-93-84578-08-3).
- **Physical Sampling:** Over 528 key Indian foods collected from six geographical regions across India across multiple seasons, analyzing 151 nutritional components using ISO 17025 accredited methods.
- **Coverage in IRONX AI:** 528 foundational Indian raw and minimally processed staples across all 10 Phase 2 categories (Cereals, Pulses, Vegetables, Fruits, Milk, Meat, Poultry, Fish, Nuts, Spices).
- **Licence & Permissions:** Open Government Data / Fair Academic and Research Use. Data utilized strictly as standardized factual nutritional reference values. Factual scientific measurements and chemical compositions are non-copyrightable data under international and Indian copyright jurisprudence.

### 2.2. Indian Nutrient Database (INDB) & Open Source Indian Recipes
- **Publishing Organization:** National Diabetes, Obesity and Cholesterol Foundation (N-DOC) & Fortis C-DOC Centre of Excellence for Diabetes, Metabolic Diseases and Endocrinology.
- **Lead Researchers:** Dr. Anoop Misra, Dr. Seema Gulati et al.
- **Dataset Structure:** Laboratory analyzed and recipe-modeled food composition database designed specifically for epidemiological, clinical, and lifestyle nutritional tracking in South Asian populations.
- **Coverage in IRONX AI:** 369 regionally representative composite food items and 1,014 verified Indian regional recipes (Tamil Nadu, Kerala, Andhra Pradesh, Karnataka, North Indian, and Western regional preparations).
- **Licence & Permissions:** Academic & Research Open Access. Standardized composite recipe formulations converted into normalized raw ingredient contribution records.

### 2.3. USDA FoodData Central (FDC) — Foundation Foods & FNDDS
- **Publishing Authority:** Agricultural Research Service, United States Department of Agriculture (USDA).
- **Components Used:**
  - *Foundation Foods (October 2024 Release):* Rigorous analytical lab data on core whole foods, single-ingredient animal proteins, raw poultry, beef, fish, and produce.
  - *Food and Nutrient Database for Dietary Studies (FNDDS 2019-2020):* Standardized nutrient retention, cooking yields, and preparation metrics for cooked meats and staples.
- **Coverage in IRONX AI:** 1,882 verified raw and cooked single foods, meat cuts, dairy standards, and whole foods.
- **Licence & Permissions:** Public Domain (Works of the United States Government under 17 U.S.C. § 105). Unrestricted worldwide commercial and non-commercial application.

### 2.4. UK Composition of Foods Integrated Dataset (CoFIDS / McCance & Widdowson)
- **Publishing Authority:** Public Health England & Department of Health and Social Care, UK.
- **Coverage in IRONX AI:** Utilized strictly as secondary cross-validation for specific dairy, cooking oils, and international spices where identical botanical entities require multi-source convergence.
- **Licence & Permissions:** Open Government Licence (OGL v3.0). Attribution provided: *Contains public sector information licensed under the Open Government Licence v3.0.*

---

## 3. COMPOSITION DATA INTEGRITY & NORMALIZATION PROTOCOLS

### 3.1. Standardization to 100g Edible Portion
Every record in `INX_AI_VERIFIED_FOOD_DATABASE.csv` is strictly calculated and expressed per 100 g of the edible portion ($100\text{g edible portion basis}$). Inedible components (bone, rind, shell, seed cores) are factored out through edible portion coefficients.

### 3.2. Mandatory 26-Column Verified Food Schema
1. `food_id`: Unique persistent identifier with dataset prefix (`INX_FOOD_INDB_...`, `INX_FOOD_USDA_...`, `INX_STAPLE_...`).
2. `food_name`: Primary standardized name.
3. `food_name_english`: Standard English descriptor.
4. `food_name_tamil`: Verified regional Tamil name in script and transliteration (`சப்பாத்தி`, `தோசை`, `இட்லி`, `சாதம்`, `முட்டை`, etc.).
5. `food_name_hindi`: Verified regional Hindi name in script and transliteration.
6. `aliases`: Semicolon-delimited comprehensive synonyms for fuzzy matching.
7. `category`: One of the 10 Phase 2 standardized categories.
8. `subcategory`: Granular sub-grouping.
9. `scientific_name`: Botanical or zoological binomial nomenclature.
10. `food_state`: State of food (`raw`, `cooked`, `steamed`, `boiled`, `roasted`, `dried`, `liquid`).
11. `preparation_state`: Exact culinary state.
12. `edible_portion_basis`: Fixed at `100g edible portion`.
13. `energy_kcal_per_100g`: Total metabolizable energy in kilocalories.
14. `protein_g_per_100g`: Total protein in grams.
15. `carbohydrate_g_per_100g`: Total available carbohydrate in grams.
16. `fat_g_per_100g`: Total lipid/fat in grams.
17. `fibre_g_per_100g`: Dietary fibre in grams.
18. `moisture_g_per_100g`: Water/moisture content in grams.
19. `source_name`: Exact primary source repository (`ICMR-NIN 2017`, `USDA FoodData Central`, `INDB`).
20. `source_record_id`: Upstream source record identifier.
21. `source_reference`: Full bibliographic citation.
22. `source_version`: Publication release or dataset edition.
23. `data_quality_status`: Quality tier (`Verified Laboratory Analysis`, `Verified Preparation`).
24. `licence_status`: Governing legal license status (`Public Domain`, `Open Government Data`).
25. `last_verified_date`: ISO 8601 verification timestamp.
26. `notes`: Contextual culinary and analytical notes.

### 3.3. Deterministic Atwater Factor Validation
All verified foods are checked against the physiological Atwater general factor system:
$$\text{Calculated Energy} = (4 \times \text{Protein}) + (4 \times \text{Carbohydrate}) + (9 \times \text{Fat}) + (2 \times \text{Fibre})$$
Records deviating from stated energy by $> 20\%$ due to specific nitrogen-to-protein conversion factors (e.g. wheat gluten $5.70$, milk $6.38$, nuts $5.30$) are individually validated against published laboratory bomb calorimeter standards.

### 3.4. Trace Values & Missing Data Policy
- Trace elements or nutrients below limits of quantification ($< 0.05\text{g}$) marked as `'Tr'` in ICMR-NIN are converted to $0.01\text{g}$ or documented as trace.
- Nutrients that have not been experimentally determined are stored as `NULL` / blank. They are **NEVER defaulted to 0**, preventing false claims that a food contains zero sodium, zero fiber, or zero minerals.

---

## 4. RECIPE & INGREDIENT NORMALIZATION PROTOCOLS

### 4.1. 100% Ingredient Code Resolution
Every ingredient in `INX_AI_RECIPE_INGREDIENTS.csv` (10,271 records) resolves to a valid food identifier in `INX_AI_VERIFIED_FOOD_DATABASE.csv`. No orphan ingredients or placeholder IDs exist.

### 4.2. Cooking Yield & Moisture Retention Model
Cooking alters the total weight of foods through moisture evaporation or water absorption. IRONX AI calculates recipe nutrition using raw ingredient sum aggregation and adjusts final batch weight and per-serving yields using standard retention coefficients:
$$\text{Cooked Batch Weight} = \sum (\text{Raw Ingredient Weights}) \times \text{Yield Factor}$$
$$\text{Nutrient Per Serving} = \frac{\sum (\text{Ingredient Nutrient Contributions})}{\text{Serving Count}}$$
$$\text{Nutrient Per 100g} = \left(\frac{\sum (\text{Ingredient Nutrient Contributions})}{\text{Cooked Batch Weight (g)}}\right) \times 100$$

---

## 5. INTELLECTUAL PROPERTY & COMPLIANCE SUMMARY

1. **Copyright in Data:** Under standard international copyright treaties (Berne Convention) and US/Indian copyright law, raw numerical data, physical measurements of food chemistry, and ingredient ratios are facts and are not subject to copyright.
2. **Database Compilations:** The specific schema, data pipeline, harmonization mapping, Tamil nomenclature curation, and normalized CSV formats represent original intellectual property belonging to the **IRONX** project.
3. **Open Access Guarantee:** No encumbered, proprietary commercial datasets (such as branded supermarket APIs) are required for core operations.

---
*Verified and Certified by IRONX AI Data Engineering Team.*
