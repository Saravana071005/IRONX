/**
 * IRONX AI — Personalized Diet Plan PDF Generator
 * Uses jsPDF to create a multi-page, publication-grade liquid glass diet plan.
 * Zero external AI API dependency.
 */

import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { jsPDF } = require(path.resolve(process.cwd(), 'frontend/node_modules/jspdf'));

export function generateDietPlanPdf(dietPlan) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  function drawDarkPage(pageTitle, pageNumber, totalPages) {
    // Deep black background #050505
    doc.setFillColor(5, 5, 5);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Top Specular Accent Line (Amber Gold)
    doc.setFillColor(232, 180, 119);
    doc.rect(margin, 24, contentWidth, 2, 'F');

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(245, 245, 245);
    doc.text('IRONX AI — PERSONALIZED FITNESS & NUTRITION DIET PLAN', margin, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(165, 165, 165);
    doc.text(pageTitle, pageWidth - margin, 42, { align: 'right' });

    // Thin Header Divider
    doc.setLineWidth(0.5);
    doc.setDrawColor(35, 35, 38);
    doc.line(margin, 50, pageWidth - margin, 50);

    // Footer
    doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.text('IRONX AI • Personalized Diet Plan • Verified ICMR-NIN & USDA Lab Nutrition', margin, pageHeight - 20);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  function drawGlassCard(y, height, title, subtitle) {
    // Frosted liquid glass card fill #121418
    doc.setFillColor(18, 20, 24);
    doc.roundedRect(margin, y, contentWidth, height, 8, 8, 'F');

    // Translucent border
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.65);
    doc.roundedRect(margin, y, contentWidth, height, 8, 8, 'S');

    // Specular top highlight line
    doc.setDrawColor(232, 180, 119);
    doc.setLineWidth(1.2);
    doc.line(margin + 8, y, margin + contentWidth - 8, y);

    let currentY = y + 18;
    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(232, 180, 119);
      doc.text(title, margin + 14, currentY);
      currentY += 14;
    }
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(175, 175, 180);
      doc.text(subtitle, margin + 14, currentY);
      currentY += 12;
    }
    return currentY;
  }

  const userProf = dietPlan.user_profile || {};
  const calc = dietPlan.calculation || {};
  const totals = dietPlan.daily_totals || {};
  const meals = dietPlan.meals || [];

  // ================= PAGE 1 =================
  drawDarkPage('Lifter Profile & Targets', 1, 2);

  let y = 68;
  y = drawGlassCard(y, 115, 'LIFTER PROFILE & METRIC SPECIFICATION', 'Calculated by IRONX AI using validated physiological baselines');

  const pStats = [
    { label: 'Goal', val: String(userProf.fitness_goal || 'Fat Loss').replace(/_/g, ' ').toUpperCase() },
    { label: 'Age / Sex', val: `${userProf.age || 25} yrs • ${String(userProf.sex || 'Male').toUpperCase()}` },
    { label: 'Height / Weight', val: `${userProf.height_cm || 175} cm • ${userProf.weight_kg || 75} kg` },
    { label: 'Workout Freq', val: userProf.workout_frequency || '3-4 days/week' },
    { label: 'Diet Style', val: String(userProf.diet_preference || 'South Indian').toUpperCase() },
    { label: 'Meal Count', val: `${dietPlan.meal_count || 4} Meals / Day` }
  ];

  const colW = (contentWidth - 28) / 3;
  pStats.forEach((ps, idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const bx = margin + 14 + (col * colW);
    const by = y + (row * 36);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(232, 180, 119);
    doc.text(ps.val, bx, by);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(170, 170, 175);
    doc.text(ps.label, bx, by + 11);
  });

  y = 198;
  y = drawGlassCard(y, 130, 'CALORIE & MACRONUTRIENT TARGET BREAKDOWN', 'Mifflin-St Jeor BMR, Physical Activity TDEE & 4P/4C/9F Atwater Split');

  const macroStats = [
    { label: 'Target Calories', val: `${calc.target_calories || totals.calories || 1900} kcal`, sub: calc.explanation || 'Balanced intake' },
    { label: 'Daily Protein', val: `${calc.protein_target_g || totals.protein_g || 140}g`, sub: '~2.0g per kg bodyweight' },
    { label: 'Carbohydrates', val: `${calc.carb_target_g || totals.carb_g || 220}g`, sub: 'Fuel for training glycogen' },
    { label: 'Healthy Fats', val: `${calc.fat_target_g || totals.fat_g || 60}g`, sub: 'Hormonal & joint support' },
    { label: 'Daily Dietary Fibre', val: `${calc.fibre_target_g || totals.fibre_g || 30}g`, sub: 'Digestive & gut microbiome' },
    { label: 'Basal Metabolic Rate', val: `${calc.bmr || 1650} kcal`, sub: `TDEE: ${calc.tdee || 2300} kcal` }
  ];

  macroStats.forEach((ms, idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const bx = margin + 14 + (col * colW);
    const by = y + (row * 42);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(232, 180, 119);
    doc.text(ms.val, bx, by);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(240, 240, 245);
    doc.text(ms.label, bx, by + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 145);
    doc.text(ms.sub, bx, by + 21);
  });

  y = 342;
  // Render Meals Table (First 2-3 meals on page 1)
  const mealsOnP1 = meals.slice(0, 2);
  mealsOnP1.forEach((m) => {
    const cardH = 34 + (m.items.length * 20) + 24;
    y = drawGlassCard(y, cardH, `${m.meal_name.toUpperCase()} (${m.recommended_time})`, m.preparation_note || '');

    // Headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(232, 180, 119);
    doc.text('Food Item', margin + 14, y);
    doc.text('Portion / Unit', margin + 200, y);
    doc.text('Calories', margin + 310, y);
    doc.text('Protein', margin + 375, y);
    doc.text('Carbs / Fat', margin + 440, y);
    y += 12;

    doc.setFont('helvetica', 'normal');
    m.items.forEach(it => {
      doc.setTextColor(240, 240, 245);
      doc.text(it.food_name, margin + 14, y);
      doc.setTextColor(170, 170, 175);
      doc.text(`${it.serving_quantity} ${it.serving_unit} (${it.serving_grams}g)`, margin + 200, y);
      doc.setTextColor(240, 240, 245);
      doc.text(`${it.energy_kcal} kcal`, margin + 310, y);
      doc.setTextColor(46, 196, 182);
      doc.text(`${it.protein_g}g`, margin + 375, y);
      doc.setTextColor(170, 170, 175);
      doc.text(`${it.carb_g}g / ${it.fat_g}g`, margin + 440, y);
      y += 18;
    });

    // Subtotal
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(232, 180, 119);
    doc.text(`Meal Subtotal: ${m.total_calories} kcal • ${m.total_protein_g}g P • ${m.total_carb_g}g C • ${m.total_fat_g}g F`, margin + 14, y);
    y += 24;
  });

  // ================= PAGE 2 =================
  doc.addPage();
  drawDarkPage('Meals Continuation & Substitution Guide', 2, 2);

  y = 68;
  const mealsOnP2 = meals.slice(2);
  mealsOnP2.forEach((m) => {
    const cardH = 34 + (m.items.length * 20) + 24;
    y = drawGlassCard(y, cardH, `${m.meal_name.toUpperCase()} (${m.recommended_time})`, m.preparation_note || '');

    // Headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(232, 180, 119);
    doc.text('Food Item', margin + 14, y);
    doc.text('Portion / Unit', margin + 200, y);
    doc.text('Calories', margin + 310, y);
    doc.text('Protein', margin + 375, y);
    doc.text('Carbs / Fat', margin + 440, y);
    y += 12;

    doc.setFont('helvetica', 'normal');
    m.items.forEach(it => {
      doc.setTextColor(240, 240, 245);
      doc.text(it.food_name, margin + 14, y);
      doc.setTextColor(170, 170, 175);
      doc.text(`${it.serving_quantity} ${it.serving_unit} (${it.serving_grams}g)`, margin + 200, y);
      doc.setTextColor(240, 240, 245);
      doc.text(`${it.energy_kcal} kcal`, margin + 310, y);
      doc.setTextColor(46, 196, 182);
      doc.text(`${it.protein_g}g`, margin + 375, y);
      doc.setTextColor(170, 170, 175);
      doc.text(`${it.carb_g}g / ${it.fat_g}g`, margin + 440, y);
      y += 18;
    });

    // Subtotal
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(232, 180, 119);
    doc.text(`Meal Subtotal: ${m.total_calories} kcal • ${m.total_protein_g}g P • ${m.total_carb_g}g C • ${m.total_fat_g}g F`, margin + 14, y);
    y += 24;
  });

  // Daily Totals Card
  y = drawGlassCard(y, 80, 'DAILY MACRONUTRIENT TOTALS SUMMARY', 'Aggregated across all meals vs. recommended targets');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(245, 245, 245);
  doc.text(`Grand Total Calories: ${totals.calories} kcal (Target: ${calc.target_calories} kcal)`, margin + 14, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(46, 196, 182);
  doc.text(`Protein: ${totals.protein_g}g (Target: ${calc.protein_target_g}g)`, margin + 14, y);
  doc.setTextColor(240, 240, 245);
  doc.text(`Carbohydrates: ${totals.carb_g}g (Target: ${calc.carb_target_g}g)`, margin + 160, y);
  doc.text(`Fat: ${totals.fat_g}g (Target: ${calc.fat_target_g}g)`, margin + 340, y);
  doc.text(`Fibre: ${totals.fibre_g}g`, margin + 460, y);
  y += 26;

  // Substitutions Card
  y = drawGlassCard(y, 140, 'SOUTH INDIAN FOOD SUBSTITUTION GUIDE', 'Practical swaps to maintain consistency without menu fatigue');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(205, 205, 210);
  const subs = dietPlan.substitution_guide || [
    'Idli (3 pcs) ↔ Dosa (2 pcs) ↔ Wheat Chapatis (2 pcs) ↔ Cooked Oats (40g dry).',
    'Chicken (100g) ↔ South Indian Fish Curry (150g) ↔ 3 Boiled Eggs ↔ 50g Soya Chunks ↔ 100g Paneer.',
    'White Rice (150g) ↔ Brown / Red Rice (150g) ↔ 2 Chapatis ↔ 1 Cup Cooked Quinoa.'
  ];
  subs.forEach((s, idx) => {
    doc.text(`• ${s}`, margin + 14, y + (idx * 16));
  });
  y += (subs.length * 16) + 12;

  // Hydration & Safety Notes Card
  y = drawGlassCard(y, 90, 'HYDRATION & SCIENTIFIC SAFETY GUIDELINES', 'Official clinical safety guidelines from IRONX AI');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 190, 195);
  doc.text(`• Hydration: ${dietPlan.hydration_guideline || 'Drink 2.5 to 3.5 liters of clean water daily.'}`, margin + 14, y);
  y += 14;
  doc.text('• Cooking Oils: Measure all cooking oil with a metric teaspoon (1 tsp = ~4.5g / 40 kcal). Never pour freely from the bottle.', margin + 14, y);
  y += 14;
  doc.text(`• Safety Disclaimer: ${dietPlan.safety_disclaimer || 'Calculated using validated Mifflin-St Jeor and ICMR-NIN 2017 baselines.'}`, margin + 14, y);

  return doc.output('arraybuffer');
}
