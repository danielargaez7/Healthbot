"use client";
import { useState, useEffect, useRef } from "react";

/* ─── Chat Demo Data ─── */
const DEMO_RESPONSES: Record<string, any> = {
  interactions: {
    type: "alert",
    severity: "high",
    title: "Drug Interaction Alert",
    content: [
      { pair: "Aspirin + Warfarin (if added)", severity: "high", detail: "Both agents affect coagulation. Concurrent use increases bleeding risk significantly. Monitor INR closely.", source: "OpenFDA Drug Interaction API" },
      { pair: "Lisinopril + Potassium", severity: "low", detail: "ACE inhibitors can increase potassium levels. Patient labs show K+ 5.8 (HIGH). Recommend close monitoring.", source: "RxNorm / DailyMed" },
    ],
    recommendation: "Potassium is critically elevated at 5.8 mEq/L with concurrent ACE inhibitor use. Consider holding Lisinopril and rechecking K+ level.",
    sources: ["OpenFDA DrugInteraction API", "RxNorm REST API", "OpenEMR FHIR /MedicationRequest"],
  },
  labs: {
    type: "lab_summary",
    title: "Lab Results Summary",
    content: {
      flagged: [
        { test: "Potassium (K)", value: "5.8 mEq/L", interpretation: "Above normal range (3.5–5.0). Hyperkalemia risk — may be related to ACE inhibitor therapy. Requires follow-up.", trend: "up" },
        { test: "Copper (Cu)", value: "62 µg/dL", interpretation: "Below normal range (70–140). Mild copper deficiency. Consider dietary assessment or supplementation.", trend: "down" },
      ],
      normal: ["Calcium 9.4 (normal)", "Magnesium 2.1 (normal)", "Sodium 140 (normal)", "Chloride 101 (normal)"],
    },
    recommendation: "Potassium elevation is the primary concern given concurrent Lisinopril. Recommend repeat BMP and consider dose adjustment. Low copper is incidental — monitor.",
    sources: ["OpenEMR FHIR /Observation", "LOINC Reference Ranges", "Clinical Decision Support"],
  },
  meds: {
    type: "med_review",
    title: "Medication Review",
    content: {
      active: [
        { name: "Enteric Coated Aspirin", dose: "325mg", freq: "Daily", purpose: "Cardioprotective" },
        { name: "Tylenol Acetaminophen", dose: "500mg", freq: "PRN", purpose: "Pain management" },
        { name: "Lisinopril", dose: "10mg", freq: "Daily", purpose: "Hypertension" },
        { name: "Doxycycline", dose: "100mg", freq: "BID", purpose: "Ear abscess (infection)" },
      ],
      considerations: [
        "Aspirin 325mg: Higher dose — evaluate if 81mg low-dose would be more appropriate for maintenance cardioprotection.",
        "Lisinopril: BP 132/83 still above target. K+ elevated at 5.8 — reassess ACE inhibitor vs. ARB.",
        "Doxycycline: Appropriate for external ear abscess. Verify course duration (typically 7–14 days).",
        "Acetaminophen PRN: Safe at current dose. Ensure patient not exceeding 3g/day with OTC use.",
      ],
    },
    recommendation: "Key gap: No documented statin therapy. Given hypertension + age, ACC/AHA guidelines may recommend moderate-intensity statin. Discuss with patient.",
    sources: ["OpenEMR FHIR /MedicationRequest", "ACC/AHA 2024 Guidelines", "Clinical Pharmacology DB"],
  },
};

/* ─── Appointment Data ─── */
interface Appointment {
  id: string;
  date: string;
  time: string;
  patientName: string;
  patientId: string;
  type: string;
  provider: string;
}

const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30",
];

const APPT_TYPES = ["Follow-up", "Lab Review", "General Checkup", "Consultation"];

const INITIAL_APPOINTMENTS: Appointment[] = [
  { id: "a1", date: "2026-02-24", time: "09:00", patientName: "Jane Doe", patientId: "other", type: "General Checkup", provider: "Dr. Patel" },
  { id: "a2", date: "2026-02-24", time: "10:30", patientName: "Gord Sims", patientId: "gord-sims", type: "Follow-up", provider: "Dr. Patel" },
  { id: "a3", date: "2026-02-24", time: "14:00", patientName: "Bob Smith", patientId: "other", type: "Lab Review", provider: "Dr. Kim" },
  { id: "a4", date: "2026-02-25", time: "09:00", patientName: "Alice Johnson", patientId: "other", type: "Cardiology", provider: "Dr. Kim" },
  { id: "a5", date: "2026-02-25", time: "11:00", patientName: "Carlos Rivera", patientId: "other", type: "Follow-up", provider: "Dr. Patel" },
  { id: "a6", date: "2026-02-25", time: "14:30", patientName: "Maria Lopez", patientId: "other", type: "General Checkup", provider: "Dr. Patel" },
  { id: "a7", date: "2026-02-26", time: "09:30", patientName: "Gord Sims", patientId: "gord-sims", type: "Lab Review", provider: "Dr. Patel" },
  { id: "a8", date: "2026-02-26", time: "11:00", patientName: "Tom Baker", patientId: "other", type: "Consultation", provider: "Dr. Kim" },
  { id: "a9", date: "2026-02-26", time: "15:00", patientName: "Sarah Chen", patientId: "other", type: "Follow-up", provider: "Dr. Patel" },
  { id: "a10", date: "2026-02-27", time: "10:00", patientName: "David Kim", patientId: "other", type: "Lab Review", provider: "Dr. Kim" },
  { id: "a11", date: "2026-02-27", time: "13:30", patientName: "Nancy White", patientId: "other", type: "General Checkup", provider: "Dr. Patel" },
  { id: "a12", date: "2026-03-02", time: "09:00", patientName: "James Brown", patientId: "other", type: "Follow-up", provider: "Dr. Patel" },
  { id: "a13", date: "2026-03-02", time: "11:30", patientName: "Emily Davis", patientId: "other", type: "Consultation", provider: "Dr. Kim" },
  { id: "a14", date: "2026-03-03", time: "10:00", patientName: "Gord Sims", patientId: "gord-sims", type: "Cardiology", provider: "Dr. Kim" },
  { id: "a15", date: "2026-03-04", time: "14:00", patientName: "Lisa Park", patientId: "other", type: "Follow-up", provider: "Dr. Patel" },
  { id: "a16", date: "2026-03-05", time: "09:30", patientName: "Mike Taylor", patientId: "other", type: "General Checkup", provider: "Dr. Kim" },
];

const formatTime12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, "0")} ${ampm}`;
};

/* ─── Visit Notes (15 entries, 2 years — Gord Sims) ─── */
const VISIT_NOTES = [
  {
    id: "vn-01", date: "2024-02-08", type: "Initial Consultation", provider: "Dr. Patel",
    chief: "New patient intake — elevated blood pressure readings at pharmacy screening",
    summary: "Patient presents for initial evaluation after pharmacy screening showed BP 152/94. Reports occasional headaches, especially in the afternoon. No prior diagnosis of hypertension. Family history: father had HTN and MI at 62. Lifestyle assessment: sedentary desk job, moderate alcohol intake (2-3 beers/week), former smoker (quit 2019). BMI 29.2. Started on lifestyle modifications — low sodium diet, 30 min walking daily. Ordered baseline labs including CMP, lipid panel, CBC.",
    tags: ["Lab Order", "Blood Work"],
    actions: ["Ordered CMP + lipid panel + CBC", "Dietary counseling — low sodium", "Exercise prescription: 30 min walking/day", "Follow-up in 4 weeks with BP log"],
  },
  {
    id: "vn-02", date: "2024-03-12", type: "Follow-up", provider: "Dr. Patel",
    chief: "BP log review — consistently 145–155/88–94 over 4 weeks",
    summary: "Patient returns with home BP log showing persistent elevation. Average reading 148/91. Labs from last visit: LDL 158 (high), HDL 42 (low), TG 172, fasting glucose 102 (borderline). CMP otherwise normal — K+ 4.6, creatinine 0.9. Started Lisinopril 10mg daily for hypertension. Discussed statin therapy for dyslipidemia — patient prefers to try diet first. Also started low-dose aspirin 325mg daily given cardiovascular risk factors. Allergies confirmed: Peanuts, Gluten, Penicillin.",
    tags: ["Prescription", "Lab Review"],
    actions: ["Rx: Lisinopril 10mg daily", "Rx: Aspirin 325mg daily", "Statin discussion deferred — patient prefers diet trial", "Recheck BP + labs in 8 weeks"],
  },
  {
    id: "vn-03", date: "2024-05-14", type: "Lab Follow-up", provider: "Dr. Patel",
    chief: "8-week recheck — BP response to Lisinopril",
    summary: "BP today 138/86, improved from 148/91 baseline. Patient tolerating Lisinopril well, no cough or dizziness. Labs: K+ 4.8, creatinine 0.9 (stable). LDL still 148 despite dietary changes. Patient now agreeable to discussing statin but wants to wait one more quarter. Weight stable at 195 lbs. Urged continued lifestyle modifications. Will recheck in 3 months.",
    tags: ["Lab Work", "Blood Work"],
    actions: ["BP improved — continue Lisinopril 10mg", "K+ 4.8 — monitor on ACE inhibitor", "LDL 148 — statin discussion next visit", "Continue aspirin 325mg"],
  },
  {
    id: "vn-04", date: "2024-08-06", type: "Urgent Visit", provider: "Dr. Patel",
    chief: "Chest pain — sharp, worse with deep breathing, 2 days",
    summary: "Patient presents with 2-day history of sharp anterior chest pain, worse with inspiration and when lying flat. No radiation to arm/jaw. Relieved by leaning forward. VS: BP 144/90, HR 92, Temp 100.1°F, SpO2 97%. ECG shows diffuse ST elevation with PR depression — classic pericarditis pattern. Troponin negative. CRP markedly elevated at 48 mg/L. Diagnosed with acute pericarditis, likely viral etiology. Cannot use NSAIDs as first-line due to existing aspirin use — will optimize aspirin dose. Added colchicine 0.5mg BID. Urgent cardiology referral to Dr. Kim for echocardiogram.",
    tags: ["Fever", "ECG", "Prescription", "Referral"],
    actions: ["ECG — diffuse ST elevation, PR depression", "Troponin negative", "CRP 48 mg/L (elevated)", "Rx: Colchicine 0.5mg BID", "Continue Aspirin 325mg (anti-inflammatory dose)", "Urgent cardiology referral to Dr. Kim"],
  },
  {
    id: "vn-05", date: "2024-08-20", type: "Cardiology Consult", provider: "Dr. Kim",
    chief: "Pericarditis evaluation — echocardiogram",
    summary: "Cardiology evaluation for acute pericarditis. Echocardiogram performed: EF 60%, no pericardial effusion, normal wall motion, no valvular abnormalities. Patient reports chest pain has improved significantly since starting colchicine. Still mild discomfort with deep breathing. CRP down to 18 from 48. Continue colchicine for 3 months minimum. Follow-up echo in 6 weeks if symptoms recur. Cleared for gradual return to exercise once pain-free for 1 week.",
    tags: ["Echo", "Lab Review"],
    actions: ["Echo: EF 60%, no effusion", "CRP 18 (improving from 48)", "Continue colchicine 0.5mg BID x 3 months", "Gradual return to exercise when pain-free", "Follow-up echo if symptoms recur"],
  },
  {
    id: "vn-06", date: "2024-11-05", type: "Follow-up", provider: "Dr. Patel",
    chief: "Pericarditis 3-month follow-up — completing colchicine course",
    summary: "Patient reports complete resolution of chest pain. No recurrence of symptoms. BP 136/84 on Lisinopril. Labs: CRP normalized at 3.2, K+ 5.0 (upper normal on ACE inhibitor), creatinine 1.0. Pericarditis considered resolved. Discontinuing colchicine after 3-month course. Will continue monitoring CRP at next visit. Flu vaccine administered. Weight stable at 196 lbs.",
    tags: ["Lab Review", "Vaccination"],
    actions: ["Pericarditis resolved — discontinue colchicine", "CRP normalized at 3.2", "K+ 5.0 — monitor (upper normal on ACE inhibitor)", "Flu vaccine given", "Continue Lisinopril 10mg + Aspirin 325mg"],
  },
  {
    id: "vn-07", date: "2025-01-15", type: "Routine Follow-up", provider: "Dr. Patel",
    chief: "Quarterly HTN management — BP still above target",
    summary: "BP today 140/88. Not at goal of <130/80. Patient admits inconsistent with low-sodium diet over holidays. K+ 5.1 — creeping up, need to watch closely on ACE inhibitor. Creatinine stable at 1.0. Discussed increasing Lisinopril dose vs. adding second agent. Patient prefers to try dietary compliance first. Set strict 3-month deadline — if BP not at goal, will escalate therapy. Ordered repeat labs for next visit. Still no statin — LDL likely still elevated.",
    tags: ["Blood Work", "Lab Order"],
    actions: ["BP 140/88 — above target", "K+ 5.1 — trending up, monitor", "Dietary compliance counseling — sodium restriction", "3-month deadline for BP control", "Labs ordered for next visit"],
  },
  {
    id: "vn-08", date: "2025-03-10", type: "Urgent Visit", provider: "Dr. Patel",
    chief: "Severe abdominal pain — cramping, lower abdomen, 3 days",
    summary: "Patient presents with 3-day history of cramping abdominal pain, predominantly left lower quadrant. Associated with intermittent nausea. No vomiting, no diarrhea, no fever. Abdomen mildly tender in LLQ, no guarding or rebound. Bowel sounds present. Labs: CBC normal, lipase normal. Gluten exposure 5 days ago (accidental — restaurant error) may be contributing given gluten sensitivity. Recommended clear liquid diet for 24 hours then gradual reintroduction. If worsening or fever develops, return for CT scan. Prescribed Tylenol 500mg PRN for pain (avoiding NSAIDs).",
    tags: ["Prescription", "Lab Work"],
    actions: ["Abdominal exam — LLQ tenderness, no peritoneal signs", "CBC + lipase — normal", "Rx: Tylenol 500mg PRN", "Clear liquid diet x 24 hrs", "Return if worsening — CT scan if needed", "Gluten avoidance counseling"],
  },
  {
    id: "vn-09", date: "2025-04-22", type: "GI Follow-up", provider: "Dr. Patel",
    chief: "Persistent intermittent abdominal pain — CT abdomen ordered",
    summary: "Patient reports abdominal pain improved but still has intermittent episodes, 2-3 times per week, mostly after meals. No weight loss, no bloody stool. Given persistent symptoms, ordered abdominal CT with contrast to rule out structural pathology. Also ordered celiac panel given known gluten sensitivity — may be undiagnosed celiac disease. BP today 142/86. K+ 5.2 — continuing to trend up. Discussed timeline for BP medication change if potassium continues rising.",
    tags: ["Imaging", "Lab Order", "Blood Work"],
    actions: ["Abdominal CT with contrast ordered", "Celiac panel ordered", "K+ 5.2 — trending up, reassess ACE inhibitor", "BP 142/86 — still not at goal", "Follow-up with CT results in 2 weeks"],
  },
  {
    id: "vn-10", date: "2025-05-08", type: "Results Review", provider: "Dr. Patel",
    chief: "CT abdomen results — small bowel unremarkable",
    summary: "Abdominal CT reviewed: small bowel pattern unremarkable, no masses, no obstruction, no lymphadenopathy. Mild colonic diverticulosis noted (age-appropriate). Celiac panel: tTG-IgA mildly elevated at 22 (normal <15), suggesting possible celiac disease. Recommended strict gluten-free diet trial and GI referral for possible endoscopy/biopsy. Patient acknowledges difficulty avoiding gluten. Provided resources for gluten-free eating. Abdominal pain likely related to gluten sensitivity/possible celiac.",
    tags: ["Imaging", "Lab Review", "Referral"],
    actions: ["CT: unremarkable, mild diverticulosis", "Celiac panel: tTG-IgA 22 (mildly elevated)", "GI referral for possible endoscopy", "Strict gluten-free diet recommended", "Dietary resources provided"],
  },
  {
    id: "vn-11", date: "2025-06-18", type: "Lab Follow-up", provider: "Dr. Patel",
    chief: "Quarterly labs — potassium trending higher on ACE inhibitor",
    summary: "Labs reviewed: K+ 5.4 (was 5.2 in April, 5.1 in Jan, 5.0 in Nov). Concerning upward trend on Lisinopril. Creatinine 1.0 (stable). Copper 62 µg/dL — incidentally found to be low (range 70-140). May be related to dietary restrictions from gluten avoidance. Recommended copper-rich foods (shellfish, nuts — avoiding peanuts, dark chocolate). BP 138/86. Abdominal pain has improved significantly on gluten-free diet. GI referral pending — patient on waitlist.",
    tags: ["Blood Work", "Lab Review"],
    actions: ["K+ 5.4 — ACE inhibitor contributing, reassess at next visit", "Copper 62 — low, dietary supplementation advised", "Creatinine 1.0 — stable", "BP 138/86 — still above target", "Abdominal pain improving on GF diet"],
  },
  {
    id: "vn-12", date: "2025-08-13", type: "Imaging Visit", provider: "Dr. Patel",
    chief: "Chest X-ray — routine screening given smoking history",
    summary: "Routine chest X-ray ordered given former smoker history (quit 2019, ~15 pack-year history). Results: bilateral findings consistent with early emphysematous changes, predominantly upper lobes. No masses, no infiltrates, no pleural effusion. Heart size normal. Discussed findings with patient — early emphysema likely related to prior smoking. Recommended pulmonary function testing (PFTs) to establish baseline. Encouraged continued smoking cessation. No active treatment needed at this time.",
    tags: ["X-Ray", "Imaging", "Screening"],
    actions: ["Chest X-ray: early emphysema, bilateral upper lobes", "No masses or infiltrates", "PFT referral ordered", "Smoking cessation reinforced", "Follow-up imaging in 12 months"],
  },
  {
    id: "vn-13", date: "2025-09-24", type: "Follow-up", provider: "Dr. Patel",
    chief: "PFT results review and comprehensive management check",
    summary: "PFT results: FEV1 78% predicted, FVC 85% predicted, FEV1/FVC 92%. Mild obstructive pattern consistent with early COPD/emphysema. No bronchodilator response. Patient asymptomatic — no dyspnea, no chronic cough. No treatment needed now but will monitor annually. BP today 134/84 — best in months, patient reports strict low-sodium compliance. K+ 5.5 — still trending up. Need to seriously consider switching from Lisinopril to ARB (losartan) to potentially reduce hyperkalemia risk. Discussed with patient — agreed to switch at next visit if K+ remains elevated.",
    tags: ["Lab Review", "Screening"],
    actions: ["PFTs: FEV1 78%, FVC 85%, FEV1/FVC 92% — mild obstruction", "Early COPD — no treatment needed, annual monitoring", "BP 134/84 — improving", "K+ 5.5 — plan to switch ACE to ARB next visit", "Continue aspirin + Tylenol PRN"],
  },
  {
    id: "vn-14", date: "2025-12-03", type: "Acute Visit", provider: "Dr. Patel",
    chief: "Right ear pain, swelling, drainage for 5 days",
    summary: "Patient presents with 5-day history of right ear pain with swelling of external ear canal. Purulent drainage noted. Temp 99.4°F. Otoscopic exam: external auditory canal erythematous and edematous with visible abscess formation. TM obscured by swelling. No hearing loss reported. Diagnosed with abscess of external auditory canal. Cannot use penicillin-class antibiotics (allergy). Started Doxycycline 100mg BID for 10 days. Warm compresses. If no improvement in 72 hours, may need I&D. Also noted: nausea reported intermittently over past 2 weeks — possibly related to stress/dietary triggers. Will address at follow-up.",
    tags: ["Fever", "Prescription"],
    actions: ["Otoscopic exam — abscess of external auditory canal", "Rx: Doxycycline 100mg BID x 10 days", "Warm compresses to affected ear", "Return in 72 hrs if no improvement for possible I&D", "Nausea noted — address at follow-up"],
  },
  {
    id: "vn-15", date: "2026-01-14", type: "Follow-up", provider: "Dr. Patel",
    chief: "Ear abscess follow-up — labs show K+ 5.8, nausea persisting",
    summary: "Ear abscess improving on Doxycycline — swelling reduced, drainage minimal, pain much better. Will complete 10-day course. Nausea has been intermittent for past month — 2-3 episodes per week, not related to meals. No vomiting until this week (1 episode). BP 132/83. Labs drawn today: K+ 5.8 — critically elevated, highest recorded. Creatinine 1.0 (stable so kidneys OK). This confirms need to switch off Lisinopril. Discussed with patient — will transition to Losartan 50mg daily at next visit once ear infection fully resolved. Copper still low at 62. Nausea workup: ordered H. pylori breath test and upper GI series if persists. Added problem list: nausea with vomiting.",
    tags: ["Prescription", "Lab Review", "Blood Work"],
    actions: ["Ear abscess improving — complete Doxycycline course", "K+ 5.8 — critically elevated, plan ACE→ARB switch", "Losartan 50mg to replace Lisinopril (at next visit)", "Nausea workup: H. pylori breath test ordered", "Copper 62 — continue monitoring", "Problem list updated: nausea with vomiting", "Follow-up in 3 weeks"],
  },
];

/* ─── Tag styling (light theme, inline styles) ─── */
const TAG_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "Prescription":  { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  "Lab Order":     { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Lab Work":      { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Lab Review":    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Blood Work":    { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
  "X-Ray":         { bg: "#ecfeff", color: "#0891b2", border: "#a5f3fc" },
  "Imaging":       { bg: "#ecfeff", color: "#0891b2", border: "#a5f3fc" },
  "Fever":         { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  "Referral":      { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  "ECG":           { bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
  "Echo":          { bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
  "Vaccination":   { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" },
  "Screening":     { bg: "#f0fdfa", color: "#0d9488", border: "#99f6e4" },
};
const getTagStyle = (tag: string) => TAG_COLORS[tag] || { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };

/* ─── Note AI response builder (Gord Sims) ─── */
const buildNotesResponse = (query: string) => {
  const q = query.toLowerCase();
  const allNotes = VISIT_NOTES;

  if (q.includes("prescription") || q.includes("rx") || q.includes("prescrib") || q.includes("medication history")) {
    const rxNotes = allNotes.filter(n => n.tags.includes("Prescription"));
    return {
      type: "notes_answer",
      title: "Prescription History — Gord Sims",
      content: rxNotes.map(n => `**${n.date}** — ${n.provider}: ${n.actions.filter(a => a.toLowerCase().startsWith("rx:") || a.toLowerCase().includes("increased") || a.toLowerCase().includes("refill") || a.toLowerCase().includes("continue")).join("; ") || n.chief}`).join("\n\n"),
      details: `Found ${rxNotes.length} visits with prescription activity across ${allNotes.length} total visit notes.`,
      noteCount: rxNotes.length,
    };
  }

  if (q.includes("x-ray") || q.includes("xray") || q.includes("imaging") || q.includes("scan") || q.includes("ct")) {
    const imgNotes = allNotes.filter(n => n.tags.includes("X-Ray") || n.tags.includes("Imaging") || n.tags.includes("Echo"));
    return {
      type: "notes_answer",
      title: "Imaging & Diagnostic History",
      content: imgNotes.map(n => `**${n.date}** (${n.type}) — ${n.actions.filter(a => a.toLowerCase().includes("x-ray") || a.toLowerCase().includes("echo") || a.toLowerCase().includes("ct")).join("; ")}`).join("\n\n"),
      details: `Found ${imgNotes.length} visits involving imaging or diagnostic studies. Key findings: Echo EF 60% (Aug 2024), CT abdomen unremarkable (May 2025), Chest X-ray shows early emphysema (Aug 2025).`,
      noteCount: imgNotes.length,
    };
  }

  if (q.includes("fever") || q.includes("urgent") || q.includes("sick") || q.includes("emergency") || q.includes("acute")) {
    const urgentNotes = allNotes.filter(n => n.type.includes("Urgent") || n.type.includes("Acute") || n.tags.includes("Fever"));
    return {
      type: "notes_answer",
      title: "Urgent & Acute Visits",
      content: urgentNotes.map(n => `**${n.date}** — ${n.chief}\n${n.summary.substring(0, 180)}...`).join("\n\n"),
      details: `Found ${urgentNotes.length} urgent or acute visits: pericarditis (Aug 2024), abdominal pain (Mar 2025), and ear abscess (Dec 2025).`,
      noteCount: urgentNotes.length,
    };
  }

  if (q.includes("heart") || q.includes("cardiac") || q.includes("pericarditis") || q.includes("chest pain") || q.includes("echo") || q.includes("ecg")) {
    const cardiacNotes = allNotes.filter(n => n.tags.includes("ECG") || n.tags.includes("Echo") || n.summary.toLowerCase().includes("pericarditis") || n.summary.toLowerCase().includes("cardiac"));
    return {
      type: "notes_answer",
      title: "Cardiac History Timeline",
      content: cardiacNotes.map(n => `**${n.date}** (${n.type}, ${n.provider}) — ${n.chief}\n${n.actions.join("; ")}`).join("\n\n"),
      details: `Found ${cardiacNotes.length} cardiac-related visits. Pericarditis diagnosed Aug 2024, treated with colchicine + aspirin, resolved by Nov 2024. Echo EF 60%, no effusion.`,
      noteCount: cardiacNotes.length,
    };
  }

  if (q.includes("potassium") || q.includes("kidney") || q.includes("renal") || q.includes("k+") || q.includes("hyperkal")) {
    const renalNotes = allNotes.filter(n => n.summary.toLowerCase().includes("k+") || n.summary.toLowerCase().includes("potassium") || n.summary.toLowerCase().includes("creatinine"));
    return {
      type: "notes_answer",
      title: "Potassium & Renal Trend",
      content: renalNotes.map(n => {
        const kMatch = n.summary.match(/K\+?\s*(\d+\.?\d*)/i);
        return `**${n.date}** — K+: ${kMatch ? kMatch[1] : "N/A"}`;
      }).join("\n\n"),
      details: `Potassium has trended: 4.6 (Mar 2024) → 4.8 → 5.0 → 5.1 → 5.2 → 5.4 → 5.5 → 5.8 (Jan 2026). Critically elevated on ACE inhibitor. Plan to switch Lisinopril → Losartan.`,
      noteCount: renalNotes.length,
    };
  }

  if (q.includes("ear") || q.includes("abscess") || q.includes("doxycycline") || q.includes("infection")) {
    const earNotes = allNotes.filter(n => n.summary.toLowerCase().includes("ear") || n.summary.toLowerCase().includes("abscess"));
    return {
      type: "notes_answer",
      title: "Ear Abscess History",
      content: earNotes.map(n => `**${n.date}** (${n.type}) — ${n.chief}\n${n.actions.join("; ")}`).join("\n\n"),
      details: `Ear abscess diagnosed Dec 2025. Treated with Doxycycline 100mg BID (Penicillin allergy). Improving at Jan 2026 follow-up.`,
      noteCount: earNotes.length,
    };
  }

  if (q.includes("abdomen") || q.includes("nausea") || q.includes("vomit") || q.includes("stomach") || q.includes("gi") || q.includes("celiac") || q.includes("gluten")) {
    const giNotes = allNotes.filter(n => n.summary.toLowerCase().includes("abdominal") || n.summary.toLowerCase().includes("nausea") || n.summary.toLowerCase().includes("celiac") || n.summary.toLowerCase().includes("gluten"));
    return {
      type: "notes_answer",
      title: "GI / Abdominal History",
      content: giNotes.map(n => `**${n.date}** (${n.type}) — ${n.chief}\n${n.actions.join("; ")}`).join("\n\n"),
      details: `Abdominal pain since Mar 2025, likely related to gluten sensitivity (tTG-IgA mildly elevated). CT unremarkable. GF diet helping. Nausea persisting since late 2025 — H. pylori workup pending.`,
      noteCount: giNotes.length,
    };
  }

  // ── Patient Info queries ──
  if (q.includes("allerg")) {
    return {
      type: "notes_answer",
      title: "Allergies — Gord Sims",
      content: PATIENT_INFO.allergies.map(a => `**${a.allergen}** (${a.type}) — ${a.reaction} [${a.severity}]`).join("\n\n"),
      details: `${PATIENT_INFO.allergies.length} documented allergies. Penicillin allergy is relevant for antibiotic selection — currently on Doxycycline for ear abscess.`,
      noteCount: PATIENT_INFO.allergies.length,
    };
  }

  if (q.includes("insurance") || q.includes("billing") || q.includes("coverage") || q.includes("member id") || q.includes("policy")) {
    const ins = PATIENT_INFO.insurance;
    return {
      type: "notes_answer",
      title: "Insurance & Billing — Gord Sims",
      content: Object.entries(ins).map(([k, v]) => `**${k}:** ${v}`).join("\n"),
      details: "Insurance information on file and verified.",
      noteCount: 1,
    };
  }

  if (q.includes("demographic") || q.includes("contact") || q.includes("phone") || q.includes("email") || q.includes("address") || q.includes("emergency") || q.includes("personal info") || q.includes("date of birth") || q.includes("dob") || q.includes("age")) {
    const p = PATIENT_INFO.personal;
    return {
      type: "notes_answer",
      title: "Patient Demographics — Gord Sims",
      content: Object.entries(p).map(([k, v]) => `**${k}:** ${v}`).join("\n"),
      details: "Full demographic and contact information on file.",
      noteCount: 1,
    };
  }

  if (q.includes("social") || q.includes("smok") || q.includes("alcohol") || q.includes("drug use") || q.includes("occupation") || q.includes("exercise")) {
    const s = PATIENT_INFO.social;
    return {
      type: "notes_answer",
      title: "Social History — Gord Sims",
      content: Object.entries(s).map(([k, v]) => `**${k}:** ${v}`).join("\n"),
      details: "Former smoker with ~15 pack-years is a key risk factor for the early emphysema noted on chest X-ray (Aug 2025).",
      noteCount: 1,
    };
  }

  if (q.includes("mental health") || q.includes("phq") || q.includes("gad") || q.includes("depress") || q.includes("anxiety") || q.includes("sleep") || q.includes("stress")) {
    const mh = PATIENT_INFO.mentalHealth;
    return {
      type: "notes_answer",
      title: "Mental Health Screening — Gord Sims",
      content: `**PHQ-9 (Depression):** ${mh.phq9.score}/27 — ${mh.phq9.label} (${mh.phq9.date})\n**GAD-7 (Anxiety):** ${mh.gad7.score}/21 — ${mh.gad7.label} (${mh.gad7.date})\n**Sleep:** ${mh.sleep}\n**Stress:** ${mh.stress}`,
      details: "Scores are in the minimal range. Moderate work-related stress noted. No pharmacotherapy indicated at this time.",
      noteCount: 1,
    };
  }

  if (q.includes("consent") || q.includes("hipaa") || q.includes("legal") || q.includes("release") || q.includes("telehealth consent")) {
    return {
      type: "notes_answer",
      title: "Consent & Legal Forms — Gord Sims",
      content: PATIENT_INFO.consent.map(c => `**${c.form}:** ${c.status} — ${c.date}`).join("\n"),
      details: "All required consent forms are signed and on file.",
      noteCount: PATIENT_INFO.consent.length,
    };
  }

  if (q.includes("payment") || q.includes("copay") || q.includes("card on file") || q.includes("billing info")) {
    return {
      type: "notes_answer",
      title: "Payment Information — Gord Sims",
      content: Object.entries(PATIENT_INFO.payment).map(([k, v]) => `**${k}:** ${v}`).join("\n"),
      details: "Payment method verified and on file.",
      noteCount: 1,
    };
  }

  if (q.includes("reason for visit") || q.includes("chief complaint") || q.includes("pain scale") || q.includes("why is he here") || q.includes("symptoms today")) {
    return {
      type: "notes_answer",
      title: "Reason for Visit — Gord Sims",
      content: Object.entries(PATIENT_INFO.reasonForVisit).map(([k, v]) => `**${k}:** ${v}`).join("\n"),
      details: "Follow-up visit for hypertension and diabetes management. Mild ear discomfort is resolving with current Doxycycline course.",
      noteCount: 1,
    };
  }

  if (q.includes("chronic") || q.includes("condition") || q.includes("diagnos") || q.includes("surgery") || q.includes("hospital") || q.includes("family history") || q.includes("medical history")) {
    const mh = PATIENT_INFO.medicalHistory;
    return {
      type: "notes_answer",
      title: "Medical History — Gord Sims",
      content: `**Chronic Conditions:** ${mh.chronic.join(", ")}\n\n**Past Diagnoses:**\n${mh.pastDiagnoses.map(d => `- ${d.condition} (${d.year}) — ${d.status}`).join("\n")}\n\n**Surgeries:**\n${mh.surgeries.map(s => `- ${s.procedure} (${s.year}) — ${s.notes}`).join("\n")}\n\n**Hospitalizations:**\n${mh.hospitalizations.map(h => `- ${h.reason} — ${h.date}, ${h.facility}`).join("\n")}\n\n**Family History:**\n${mh.familyHistory.map(f => `- ${f.relation}: ${f.conditions}`).join("\n")}`,
      details: "Key concerns: Hypertension managed with Lisinopril (pending switch to Losartan due to hyperkalemia), early COPD from smoking history, and resolved pericarditis.",
      noteCount: 1,
    };
  }

  if (q.includes("summary") || q.includes("overview") || q.includes("everything") || q.includes("full profile") || q.includes("tell me about") || q.includes("who is")) {
    const p = PATIENT_INFO.personal;
    const mh = PATIENT_INFO.medicalHistory;
    return {
      type: "notes_answer",
      title: "Patient Summary — Gord Sims",
      content: `**${p["Full Legal Name"]}**, ${p["Date of Birth"]} (${p["Gender"]})\n${p["Address"]}\n\n**Chronic Conditions:** ${mh.chronic.join(", ")}\n**Allergies:** ${PATIENT_INFO.allergies.map(a => `${a.allergen} (${a.severity})`).join(", ")}\n**Current Medications:** ${PATIENT_INFO.medications.map(m => `${m.name} ${m.dose}`).join(", ")}\n\n**Recent:** K+ elevated at 5.8 — switching Lisinopril to Losartan. Ear abscess resolving on Doxycycline. Early emphysema on imaging.\n\n**${allNotes.length} visit notes** on file spanning Feb 2024 – Jan 2026.`,
      details: "Ask about any specific area: allergies, insurance, medications, mental health, visit history, imaging, labs, or social history.",
      noteCount: allNotes.length,
    };
  }

  const recentNotes = allNotes.slice(-5);
  return {
    type: "notes_answer",
    title: "Visit History Overview — Gord Sims",
    content: `Gord Sims has **${allNotes.length} documented visits** spanning **${allNotes[0].date}** to **${allNotes[allNotes.length - 1].date}** (2 years).\n\n**Key milestones:**\n• Feb 2024: Hypertension diagnosed, started Lisinopril\n• Aug 2024: Pericarditis — treated, resolved by Nov 2024\n• Mar 2025: Abdominal pain → possible celiac disease\n• Aug 2025: Chest X-ray — early emphysema (former smoker)\n• Dec 2025: Ear abscess → Doxycycline\n• Jan 2026: K+ critically elevated at 5.8 — ACE→ARB switch planned\n\n**Most recent visits:**\n${recentNotes.map(n => `• ${n.date}: ${n.type} — ${n.chief}`).join("\n")}`,
    details: `Ask about specific topics: prescriptions, imaging, cardiac history, potassium trend, ear abscess, GI issues, or any specific visit.`,
    noteCount: recentNotes.length,
  };
};

const SeverityBadge = ({ level }: { level: string }) => {
  const styles: Record<string, React.CSSProperties> = {
    high: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
    moderate: { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" },
    low: { background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" },
  };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, ...(styles[level] || styles.low) }}>
      {level.toUpperCase()}
    </span>
  );
};

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "up") return <span style={{ color: "#dc2626" }}>↗</span>;
  if (trend === "down") return <span style={{ color: "#059669" }}>↘</span>;
  return <span style={{ color: "#9ca3af" }}>→</span>;
};

const SourceTag = ({ sources }: { sources: string[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
      <button onClick={() => setOpen(!open)} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
        {open ? "Hide" : "View"} Sources ({sources.length})
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {sources.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: "#6b7280", paddingLeft: 12, borderLeft: "2px solid #d1d5db", marginBottom: 4 }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const ResponseCard = ({ data, onBookSlot }: { data: any; onBookSlot?: (date: string, time: string) => void }) => {
  if (data.type === "alert") {
    return (
      <div style={{ borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />
            <span style={{ fontWeight: 600, fontSize: 12, color: "#dc2626" }}>{data.title}</span>
          </div>
          <SeverityBadge level="high" />
        </div>
        {data.content.map((item: any, i: number) => (
          <div key={i} style={{ background: "#ffffff", borderRadius: 8, padding: 10, marginBottom: 8, border: "1px solid #fee2e2" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b" }}>{item.pair}</span>
              <SeverityBadge level={item.severity} />
            </div>
            <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{item.detail}</p>
            <p style={{ fontSize: 10, color: "#9ca3af", margin: "4px 0 0" }}>via {item.source}</p>
          </div>
        ))}
        <div style={{ background: "#fffbeb", borderRadius: 8, padding: 10, borderLeft: "3px solid #f59e0b" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#b45309", margin: "0 0 4px" }}>Recommendation</p>
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{data.recommendation}</p>
        </div>
        <SourceTag sources={data.sources} />
      </div>
    );
  }

  if (data.type === "lab_summary") {
    return (
      <div style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: "#2563eb" }}>{data.title}</span>
        </div>
        <p style={{ fontSize: 10, fontWeight: 600, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>⚠ Flagged Results</p>
        {data.content.flagged.map((item: any, i: number) => (
          <div key={i} style={{ background: "#ffffff", borderRadius: 8, padding: 10, marginBottom: 8, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b" }}>{item.test}: <span style={{ color: "#dc2626" }}>{item.value}</span></span>
              <TrendIcon trend={item.trend} />
            </div>
            <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{item.interpretation}</p>
          </div>
        ))}
        <p style={{ fontSize: 10, fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>✓ Within Range</p>
        {data.content.normal.map((n: string, i: number) => (
          <p key={i} style={{ fontSize: 11, color: "#6b7280", paddingLeft: 10, borderLeft: "2px solid #a7f3d0", marginBottom: 4 }}>{n}</p>
        ))}
        <div style={{ background: "#eff6ff", borderRadius: 8, padding: 10, marginTop: 8, borderLeft: "3px solid #3b82f6" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8", margin: "0 0 4px" }}>Clinical Consideration</p>
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{data.recommendation}</p>
        </div>
        <SourceTag sources={data.sources} />
      </div>
    );
  }

  if (data.type === "med_review") {
    return (
      <div style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: "#7c3aed" }}>{data.title}</span>
        </div>
        <div style={{ borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 10 }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 500 }}>Medication</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 500 }}>Dose</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 500 }}>Freq</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 500 }}>For</th>
              </tr>
            </thead>
            <tbody>
              {data.content.active.map((med: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #f1f5f9", background: "#ffffff" }}>
                  <td style={{ padding: "6px 8px", color: "#1e293b", fontWeight: 500 }}>{med.name}</td>
                  <td style={{ padding: "6px 8px", color: "#64748b" }}>{med.dose}</td>
                  <td style={{ padding: "6px 8px", color: "#64748b" }}>{med.freq}</td>
                  <td style={{ padding: "6px 8px", color: "#9ca3af" }}>{med.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 10, fontWeight: 600, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Clinical Considerations</p>
        {data.content.considerations.map((c: string, i: number) => (
          <p key={i} style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid #e2e8f0", marginBottom: 6 }}>{c}</p>
        ))}
        <div style={{ background: "#fffbeb", borderRadius: 8, padding: 10, marginTop: 8, borderLeft: "3px solid #f59e0b" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#b45309", margin: "0 0 4px" }}>⚠ Gaps Identified</p>
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{data.recommendation}</p>
        </div>
        <SourceTag sources={data.sources} />
      </div>
    );
  }
  if (data.type === "notes_answer") {
    const lines = data.content.split("\n");
    return (
      <div style={{ borderRadius: 12, border: "1px solid #d1fae5", background: "#ecfdf5", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span style={{ fontWeight: 600, fontSize: 12, color: "#059669" }}>{data.title}</span>
        </div>
        <div style={{ background: "#ffffff", borderRadius: 8, padding: 10, border: "1px solid #d1fae5" }}>
          {lines.map((line: string, i: number) => {
            if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
            const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1e293b">$1</strong>');
            return <p key={i} style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, margin: "2px 0" }} dangerouslySetInnerHTML={{ __html: formatted }} />;
          })}
        </div>
        {data.details && (
          <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 10, marginTop: 8, borderLeft: "3px solid #10b981" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#059669", margin: "0 0 4px" }}>AI Analysis</p>
            <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{data.details}</p>
          </div>
        )}
        {data.noteCount && (
          <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>Referenced {data.noteCount} visit note(s) from patient record</p>
        )}
      </div>
    );
  }

  if (data.type === "availability") {
    return (
      <div style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: "#3b82f6" }}>{data.title}</span>
        </div>
        {data.content.dates.map((dg: any) => (
          <div key={dg.date} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{dg.label}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {dg.slots.map((slot: string) => (
                <button key={slot} onClick={() => onBookSlot?.(dg.date, slot)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, border: "1px solid #3b82f6", background: "#eff6ff", color: "#3b82f6", cursor: "pointer" }}>
                  {formatTime12(slot)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ background: "#eff6ff", borderRadius: 8, padding: 10, marginTop: 4, borderLeft: "3px solid #3b82f6" }}>
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{data.recommendation}</p>
        </div>
      </div>
    );
  }

  if (data.type === "booking_confirmation") {
    return (
      <div style={{ borderRadius: 12, border: "1px solid #a7f3d0", background: "#ecfdf5", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
          <span style={{ fontWeight: 600, fontSize: 12, color: "#059669" }}>{data.title}</span>
        </div>
        <div style={{ background: "#ffffff", borderRadius: 8, padding: 10, border: "1px solid #d1fae5" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", margin: 0 }}>{data.content.date} at {data.content.time}</p>
          <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>Type: {data.content.type} — Provider: {data.content.provider}</p>
        </div>
        <p style={{ fontSize: 11, color: "#059669", margin: "8px 0 0" }}>{data.recommendation}</p>
      </div>
    );
  }

  return null;
};

const TypingIndicator = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px" }}>
    {[0, 150, 300].map(delay => (
      <div key={delay} style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", animation: "bounce 1s infinite", animationDelay: `${delay}ms` }} />
    ))}
    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>Querying OpenEMR FHIR endpoint...</span>
  </div>
);

/* ─── Calendar View Component ─── */
const CalendarView = ({
  appointments,
  onBook,
  onCancel,
}: {
  appointments: Appointment[];
  onBook: (date: string, time: string, type: string) => void;
  onCancel: (id: string) => void;
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [bookingType, setBookingType] = useState("Follow-up");
  const [viewMonth, setViewMonth] = useState(1); // 0-indexed: 1 = Feb
  const [viewYear] = useState(2026);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const getDateStr = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    return `${viewYear}-${m}-${String(day).padStart(2, "0")}`;
  };

  const aptsForDay = (day: number) => appointments.filter(a => a.date === getDateStr(day));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedApts = selectedDate ? appointments.filter(a => a.date === selectedDate) : [];

  return (
    <div style={{ padding: "24px 32px", animation: "fadeIn 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", margin: 0 }}>Appointments</h2>
          <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Book and manage appointments for Gord Sims</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setViewMonth(m => Math.max(1, m - 1))} disabled={viewMonth <= 1} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: viewMonth <= 1 ? "not-allowed" : "pointer", opacity: viewMonth <= 1 ? 0.3 : 1, fontSize: 14, color: "#64748b" }}>←</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", minWidth: 140, textAlign: "center" }}>{monthNames[viewMonth]} {viewYear}</span>
          <button onClick={() => setViewMonth(m => Math.min(2, m + 1))} disabled={viewMonth >= 2} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: viewMonth >= 2 ? "not-allowed" : "pointer", opacity: viewMonth >= 2 ? 0.3 : 1, fontSize: 14, color: "#64748b" }}>→</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: "#3b82f6" }} /><span style={{ fontSize: 11, color: "#64748b" }}>Your appointments</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: "#e2e8f0" }} /><span style={{ fontSize: 11, color: "#64748b" }}>Booked (other patients)</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: "#fff", border: "1px solid #d1d5db" }} /><span style={{ fontSize: 11, color: "#64748b" }}>Available</span></div>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        {/* Calendar Grid */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {/* Day headers */}
            {dayNames.map(d => (
              <div key={d} style={{ padding: "10px 4px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#9ca3af", background: "#f8fafc", textTransform: "uppercase", letterSpacing: 0.5 }}>{d}</div>
            ))}
            {/* Day cells */}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} style={{ padding: 8, background: "#fafbfc" }} />;
              const dateStr = getDateStr(day);
              const dow = new Date(viewYear, viewMonth, day).getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isSelected = selectedDate === dateStr;
              const dayApts = aptsForDay(day);
              const myApts = dayApts.filter(a => a.patientId === "gord-sims");
              const otherApts = dayApts.filter(a => a.patientId !== "gord-sims");
              const isToday = dateStr === "2026-02-23";

              return (
                <div
                  key={day}
                  onClick={() => !isWeekend && setSelectedDate(dateStr)}
                  style={{
                    padding: "8px 6px",
                    minHeight: 72,
                    cursor: isWeekend ? "default" : "pointer",
                    background: isSelected ? "#eff6ff" : isWeekend ? "#f9fafb" : "#fff",
                    border: isSelected ? "2px solid #3b82f6" : "1px solid transparent",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isWeekend ? "#d1d5db" : isToday ? "#3b82f6" : "#1e293b", marginBottom: 4 }}>
                    {day}
                    {isToday && <span style={{ fontSize: 9, color: "#3b82f6", marginLeft: 4 }}>Today</span>}
                  </div>
                  {isWeekend ? (
                    <span style={{ fontSize: 9, color: "#d1d5db" }}>Closed</span>
                  ) : (
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {myApts.map((_, j) => <div key={`m${j}`} style={{ width: 6, height: 6, borderRadius: 2, background: "#3b82f6" }} />)}
                      {otherApts.map((_, j) => <div key={`o${j}`} style={{ width: 6, height: 6, borderRadius: 2, background: "#d1d5db" }} />)}
                      {dayApts.length === 0 && <span style={{ fontSize: 9, color: "#a3e635" }}>Open</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Detail Panel */}
        <div style={{ width: 320, flexShrink: 0 }}>
          {selectedDate ? (() => {
            const selDow = new Date(selectedDate).getDay();
            const isWE = selDow === 0 || selDow === 6;
            const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
            if (isWE) return (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20, textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{dateLabel}</p>
                <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>No office hours on weekends</p>
              </div>
            );
            return (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{dateLabel}</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Office hours: 9:00 AM – 5:00 PM</p>
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto", padding: "8px 0" }} className="scrollbar-thin">
                  {TIME_SLOTS.map(slot => {
                    const apt = selectedApts.find(a => a.time === slot);
                    const isMine = apt?.patientId === "gord-sims";
                    const isTaken = !!apt;
                    const isBooking = bookingSlot === slot;

                    return (
                      <div key={slot} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#64748b", width: 64, flexShrink: 0 }}>{formatTime12(slot)}</span>
                        {isTaken ? (
                          <div style={{ flex: 1, padding: "6px 10px", borderRadius: 8, background: isMine ? "#eff6ff" : "#f1f5f9", border: isMine ? "1px solid #bfdbfe" : "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 500, color: isMine ? "#1d4ed8" : "#9ca3af" }}>{isMine ? apt.type : "Booked"}</span>
                              {isMine && <span style={{ fontSize: 10, color: "#64748b", marginLeft: 6 }}>{apt.provider}</span>}
                            </div>
                            {isMine && (
                              <button onClick={(e) => { e.stopPropagation(); onCancel(apt.id); }} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                            )}
                          </div>
                        ) : isBooking ? (
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                            <select value={bookingType} onChange={e => setBookingType(e.target.value)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", color: "#1e293b", background: "#fff" }}>
                              {APPT_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                            <button onClick={() => { onBook(selectedDate, slot, bookingType); setBookingSlot(null); }} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                            <button onClick={() => setBookingSlot(null)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer" }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setBookingSlot(slot)} style={{ flex: 1, padding: "6px 10px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", color: "#3b82f6", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
                            Available — Book
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })() : (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 32, textAlign: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: "0 auto 12px" }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#64748b" }}>Select a date</p>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Click a weekday to view available time slots</p>
            </div>
          )}

          {/* My Upcoming Appointments */}
          {(() => {
            const myApts = appointments.filter(a => a.patientId === "gord-sims").sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
            if (myApts.length === 0) return null;
            return (
              <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: 0 }}>Your Upcoming Appointments</p>
                </div>
                <div style={{ padding: 8 }}>
                  {myApts.map(apt => (
                    <div key={apt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", marginBottom: 4 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#1d4ed8", margin: 0 }}>{new Date(apt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {formatTime12(apt.time)}</p>
                        <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{apt.type} — {apt.provider}</p>
                      </div>
                      <button onClick={() => onCancel(apt.id)} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

/* ─── Visit Notes View Component ─── */
const VisitNotesView = () => {
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  return (
    <div style={{ padding: "24px 32px", animation: "fadeIn 0.3s ease", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", margin: 0 }}>Visit Notes</h2>
        <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Dr. submitted notes from previous appointments with Gord Sims</p>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ background: "#ecfdf5", border: "1px solid #d1fae5", borderRadius: 10, padding: "8px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Visits</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#059669" }}>{VISIT_NOTES.length}</div>
        </div>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Date Range</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>Feb 2024 — Jan 2026</div>
        </div>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Providers</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>Dr. Patel, Dr. Kim</div>
        </div>
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Urgent Visits</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ea580c" }}>{VISIT_NOTES.filter(n => n.type.includes("Urgent") || n.type.includes("Acute")).length}</div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative" }}>
        {/* Timeline line */}
        <div style={{ position: "absolute", left: 7, top: 10, bottom: 10, width: 2, background: "#e2e8f0", borderRadius: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...VISIT_NOTES].reverse().map((note) => {
            const isExpanded = expandedNote === note.id;
            const dateObj = new Date(note.date + "T12:00:00");
            const monthStr = dateObj.toLocaleDateString("en-US", { month: "short" });
            const dayStr = dateObj.getDate();
            const yearStr = dateObj.getFullYear();
            const isUrgent = note.type.includes("Urgent") || note.type.includes("Acute");

            return (
              <div key={note.id} style={{ position: "relative", paddingLeft: 28 }}>
                {/* Timeline dot */}
                <div style={{
                  position: "absolute", left: 0, top: 14,
                  width: 16, height: 16, borderRadius: "50%",
                  border: `2px solid ${isUrgent ? "#f97316" : "#10b981"}`,
                  background: isUrgent ? "#fff7ed" : "#ecfdf5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: isUrgent ? "#f97316" : "#10b981" }} />
                </div>

                {/* Card */}
                <div
                  onClick={() => setExpandedNote(isExpanded ? null : note.id)}
                  style={{
                    borderRadius: 12,
                    border: isExpanded ? "1px solid #3b82f6" : "1px solid #e5e7eb",
                    background: isExpanded ? "#fafbff" : "#ffffff",
                    padding: "12px 16px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: isExpanded ? "0 2px 12px rgba(59,130,246,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                        background: isUrgent ? "#fff7ed" : "#f1f5f9",
                        color: isUrgent ? "#ea580c" : "#1e293b",
                        border: `1px solid ${isUrgent ? "#fed7aa" : "#e2e8f0"}`,
                      }}>{note.type}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{note.provider}</span>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{monthStr} {dayStr}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{yearStr}</div>
                    </div>
                  </div>

                  {/* Chief complaint */}
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 8px" }}>{note.chief}</p>

                  {/* Tags */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {note.tags.map((tag) => {
                      const ts = getTagStyle(tag);
                      return (
                        <span key={tag} style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 999,
                          background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
                        }}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e5e7eb", animation: "fadeIn 0.2s ease" }}>
                      {/* Doctor's note */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Doctor&apos;s Note</div>
                        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>{note.summary}</p>
                      </div>

                      {/* Actions taken */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Actions & Orders</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {note.actions.map((action, ai) => (
                            <div key={ai} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", marginTop: 6, flexShrink: 0 }} />
                              <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.5 }}>{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─── Staff Data ─── */
const STAFF = {
  doctors: [
    { name: "Dr. Raj Patel", title: "Primary Care Physician", specialty: "Internal Medicine", bio: "Board-certified internist with 18 years of experience in primary care and chronic disease management. Special interest in diabetes, hypertension, and preventive medicine. Completed residency at Johns Hopkins." },
    { name: "Dr. Susan Kim", title: "Cardiologist", specialty: "Cardiology", bio: "Fellowship-trained cardiologist specializing in arrhythmia management and echocardiography. 12 years in practice. Passionate about patient education and heart disease prevention." },
    { name: "Dr. Michael Torres", title: "Pulmonologist", specialty: "Pulmonology", bio: "Specializes in COPD, asthma, and interstitial lung disease. 10 years of experience. Active in clinical research on early emphysema detection and smoking cessation programs." },
  ],
  nurses: [
    { name: "Jessica Hernandez", title: "Charge Nurse, RN", specialty: "Primary Care", bio: "Lead nurse with 14 years of experience in outpatient clinical settings. Coordinates patient triage, medication management, and care plan follow-ups." },
    { name: "David Okonkwo", title: "Registered Nurse, RN", specialty: "Cardiology", bio: "Cardiac-certified nurse specializing in anticoagulation monitoring and post-procedure care. 9 years of experience in cardiology clinics." },
    { name: "Emily Tran", title: "Registered Nurse, RN", specialty: "Chronic Care", bio: "Focused on diabetes education and chronic disease management. Certified Diabetes Educator (CDE). Helps patients with glucose monitoring and lifestyle coaching." },
    { name: "Marcus Johnson", title: "Registered Nurse, RN", specialty: "Urgent Care", bio: "Experienced in acute care triage and wound management. 11 years in emergency and urgent care settings. Calm under pressure." },
    { name: "Priya Sharma", title: "Licensed Practical Nurse", specialty: "Lab & Vitals", bio: "Skilled in phlebotomy, vital signs, and point-of-care testing. 6 years of experience. Patients appreciate her gentle technique and warm demeanor." },
    { name: "Rachel Nguyen", title: "Registered Nurse, RN", specialty: "Pulmonology", bio: "Specializes in pulmonary function testing and respiratory care. 7 years of experience. Certified in spirometry and patient breathing education." },
  ],
  receptionists: [
    { name: "Sarah Mitchell", title: "Front Desk Manager", specialty: "Operations", bio: "Manages patient scheduling, insurance verification, and front office operations. 10 years in healthcare administration. Keeps the clinic running smoothly." },
    { name: "Carlos Vega", title: "Patient Coordinator", specialty: "Scheduling", bio: "Handles appointment booking, referral coordination, and patient communications. Known for his friendly phone manner and attention to detail. 5 years with the clinic." },
    { name: "Amanda Foster", title: "Medical Receptionist", specialty: "Records & Intake", bio: "Manages patient check-in, medical records requests, and new patient intake paperwork. 4 years of experience. Always greets patients with a smile." },
  ],
};

/* ─── Patient Personal Info ─── */
const PATIENT_INFO = {
  personal: {
    "Full Legal Name": "Gord Allen Sims",
    "Date of Birth": "January 25, 1967",
    "Age": "59 years old",
    "Sex": "Male",
    "Gender": "Male",
    "Marital Status": "Married",
    "Preferred Language": "English",
    "Phone": "(843) 831-5476",
    "Email": "gord.sims@email.com",
    "Address": "3517 Camden Place, New York, NY 10001",
    "Emergency Contact": "Linda Sims (Wife) — (843) 831-5480",
  },
  insurance: {
    "Insurance Provider": "Aetna",
    "Member ID": "32523523023",
    "Group Number": "GRP-88421",
    "Policyholder": "Self (Gord A. Sims)",
    "Policyholder DOB": "01/25/1967",
    "Secondary Insurance": "None",
    "Guarantor": "Self",
    "Consent for Billing": "Yes — signed 02/08/2024",
  },
  medicalHistory: {
    pastDiagnoses: [
      { condition: "Pericarditis", status: "Resolved", year: "2024" },
      { condition: "Urinary Tract Infection", status: "Resolved", year: "2025" },
      { condition: "Possible Celiac Disease", status: "Under investigation", year: "2025" },
    ],
    surgeries: [{ procedure: "Appendectomy", year: "2003", notes: "Uncomplicated" }],
    hospitalizations: [{ reason: "Acute Pericarditis — overnight observation", date: "Aug 2024", facility: "Northwest Valley Medical" }],
    chronic: ["Hypertension (diagnosed Feb 2024)", "Early COPD / Emphysema (identified Aug 2025)", "Abdominal pain — gluten-related (ongoing)"],
    familyHistory: [
      { relation: "Father", conditions: "Hypertension, Myocardial Infarction at age 62" },
      { relation: "Mother", conditions: "Type 2 Diabetes" },
      { relation: "Brother", conditions: "Healthy, no known conditions" },
    ],
  },
  medications: [
    { name: "Enteric Coated Aspirin", dose: "325mg", freq: "Daily", purpose: "Cardioprotective", type: "Rx" },
    { name: "Lisinopril", dose: "10mg", freq: "Daily", purpose: "Hypertension", type: "Rx" },
    { name: "Doxycycline", dose: "100mg", freq: "BID", purpose: "Ear abscess (infection)", type: "Rx" },
    { name: "Tylenol (Acetaminophen)", dose: "500mg", freq: "PRN", purpose: "Pain management", type: "OTC" },
    { name: "Vitamin D3", dose: "2,000 IU", freq: "Daily", purpose: "Supplement", type: "Supplement" },
    { name: "Fish Oil (Omega-3)", dose: "1,200mg", freq: "Daily", purpose: "Cardiovascular support", type: "Supplement" },
  ],
  allergies: [
    { allergen: "Peanuts", type: "Food", reaction: "Anaphylaxis", severity: "Severe" },
    { allergen: "Gluten", type: "Food", reaction: "GI distress, bloating", severity: "Moderate" },
    { allergen: "Penicillin", type: "Drug", reaction: "Rash, hives", severity: "Moderate" },
  ],
  social: {
    "Smoking / Tobacco": "Former smoker — quit 2019 (~15 pack-year history)",
    "Alcohol Use": "Moderate — 2-3 beers per week",
    "Recreational Drugs": "None",
    "Occupation": "Office Administrator",
    "Exercise": "Walking 20-30 minutes most days",
  },
  mentalHealth: {
    phq9: { score: 4, label: "Minimal depression", date: "01/14/2026" },
    gad7: { score: 3, label: "Minimal anxiety", date: "01/14/2026" },
    sleep: "6-7 hours per night, occasional insomnia",
    stress: "Moderate — primarily work-related",
  },
  reasonForVisit: {
    "Chief Complaint": "Follow-up HTN management, ear abscess treatment",
    "Duration": "Ongoing — hypertension since Feb 2024",
    "Pain Scale": "2/10 — mild right ear discomfort",
    "Associated Symptoms": "Intermittent nausea (2-3x/week), occasional headaches",
  },
  consent: [
    { form: "Consent to Treat", status: "Signed", date: "02/08/2024" },
    { form: "HIPAA Privacy Acknowledgment", status: "Signed", date: "02/08/2024" },
    { form: "Financial Responsibility Agreement", status: "Signed", date: "02/08/2024" },
    { form: "Telehealth Consent", status: "Signed", date: "03/12/2024" },
    { form: "Release of Information", status: "On file", date: "02/08/2024" },
  ],
  payment: {
    "Copay": "$25.00",
    "Card on File": "Visa ending in 4821",
    "Billing Preference": "Insurance primary, card on file for copay",
  },
};

/* ─── Personal Info View Component ─── */
const PersonalInfoView = () => {
  const sectionStyle = (accent: string): React.CSSProperties => ({
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    overflow: "hidden",
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    borderLeft: `4px solid ${accent}`,
  });

  const headerStyle: React.CSSProperties = {
    padding: "14px 20px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  const rowStyle = (isLast: boolean): React.CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    padding: "10px 20px",
    borderBottom: isLast ? "none" : "1px solid #f8fafc",
    alignItems: "center",
  });

  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#9ca3af", fontWeight: 500 };
  const valueStyle: React.CSSProperties = { fontSize: 13, color: "#1e293b", fontWeight: 500 };

  const entries = Object.entries;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, animation: "fadeIn 0.3s ease" }}>
      {/* ── Row: Personal & Demographics + Insurance ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ ...sectionStyle("#3b82f6"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Personal & Demographic Information</h3>
          </div>
          <div>
            {entries(PATIENT_INFO.personal).map(([k, v], i, arr) => (
              <div key={k} style={rowStyle(i === arr.length - 1)}>
                <span style={labelStyle}>{k}</span>
                <span style={valueStyle}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...sectionStyle("#8b5cf6"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Insurance & Billing Details</h3>
          </div>
          <div>
            {entries(PATIENT_INFO.insurance).map(([k, v], i, arr) => (
              <div key={k} style={rowStyle(i === arr.length - 1)}>
                <span style={labelStyle}>{k}</span>
                <span style={valueStyle}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row: Medical History + Mental Health ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start", marginBottom: 20 }}>
        <div style={{ ...sectionStyle("#f59e0b"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Medical History</h3>
          </div>
          <div style={{ padding: "14px 20px" }}>
            {/* Past diagnoses */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>Past Diagnoses</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {PATIENT_INFO.medicalHistory.pastDiagnoses.map(d => (
                  <div key={d.condition} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{d.condition}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: d.status === "Resolved" ? "#ecfdf5" : "#fffbeb", color: d.status === "Resolved" ? "#059669" : "#d97706", border: `1px solid ${d.status === "Resolved" ? "#a7f3d0" : "#fde68a"}` }}>{d.status}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{d.year}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Surgeries */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>Surgeries</p>
              {PATIENT_INFO.medicalHistory.surgeries.map(s => (
                <p key={s.procedure} style={{ fontSize: 13, color: "#1e293b", margin: 0 }}>{s.procedure} <span style={{ color: "#9ca3af" }}>({s.year}) — {s.notes}</span></p>
              ))}
            </div>
            {/* Hospitalizations */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>Hospitalizations</p>
              {PATIENT_INFO.medicalHistory.hospitalizations.map(h => (
                <p key={h.reason} style={{ fontSize: 13, color: "#1e293b", margin: 0 }}>{h.reason} <span style={{ color: "#9ca3af" }}>— {h.date}, {h.facility}</span></p>
              ))}
            </div>
            {/* Chronic conditions */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>Chronic Conditions</p>
              {PATIENT_INFO.medicalHistory.chronic.map(c => (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#1e293b" }}>{c}</span>
                </div>
              ))}
            </div>
            {/* Family history */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>Family Medical History</p>
              {PATIENT_INFO.medicalHistory.familyHistory.map(f => (
                <div key={f.relation} style={{ display: "grid", gridTemplateColumns: "80px 1fr", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{f.relation}</span>
                  <span style={{ fontSize: 13, color: "#1e293b" }}>{f.conditions}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...sectionStyle("#6366f1"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Mental Health Screening</h3>
          </div>
          <div style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
              {/* PHQ-9 */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>PHQ-9 (Depression)</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{PATIENT_INFO.mentalHealth.phq9.score}</span>
                </div>
                <div style={{ width: "100%", height: 4, borderRadius: 2, background: "#e2e8f0" }}>
                  <div style={{ width: `${(PATIENT_INFO.mentalHealth.phq9.score / 27) * 100}%`, height: "100%", borderRadius: 2, background: "#10b981" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>{PATIENT_INFO.mentalHealth.phq9.label}</span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{PATIENT_INFO.mentalHealth.phq9.date}</span>
                </div>
              </div>
              {/* GAD-7 */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>GAD-7 (Anxiety)</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{PATIENT_INFO.mentalHealth.gad7.score}</span>
                </div>
                <div style={{ width: "100%", height: 4, borderRadius: 2, background: "#e2e8f0" }}>
                  <div style={{ width: `${(PATIENT_INFO.mentalHealth.gad7.score / 21) * 100}%`, height: "100%", borderRadius: 2, background: "#10b981" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>{PATIENT_INFO.mentalHealth.gad7.label}</span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{PATIENT_INFO.mentalHealth.gad7.date}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "6px 0" }}>
              <span style={labelStyle}>Sleep</span><span style={valueStyle}>{PATIENT_INFO.mentalHealth.sleep}</span>
              <span style={labelStyle}>Stress Level</span><span style={valueStyle}>{PATIENT_INFO.mentalHealth.stress}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Medications ── */}
      <div style={sectionStyle("#7c3aed")}>
        <div style={headerStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Medication List</h3>
        </div>
        <div style={{ padding: "4px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 1fr 80px", padding: "8px 20px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Medication</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Dose</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Freq</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Purpose</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Type</span>
          </div>
          {PATIENT_INFO.medications.map(med => (
            <div key={med.name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 1fr 80px", padding: "10px 20px", borderBottom: "1px solid #fafbfc", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{med.name}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{med.dose}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{med.freq}</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{med.purpose}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, textAlign: "center", background: med.type === "Rx" ? "#eff6ff" : med.type === "OTC" ? "#f8fafc" : "#ecfdf5", color: med.type === "Rx" ? "#2563eb" : med.type === "OTC" ? "#64748b" : "#059669", border: `1px solid ${med.type === "Rx" ? "#bfdbfe" : med.type === "OTC" ? "#e2e8f0" : "#a7f3d0"}` }}>{med.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row: Allergies + Social History ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ ...sectionStyle("#ef4444"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Allergies</h3>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {PATIENT_INFO.allergies.map(a => (
              <div key={a.allergen} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: a.severity === "Severe" ? "#fef2f2" : "#fffbeb", border: `1px solid ${a.severity === "Severe" ? "#fecaca" : "#fde68a"}` }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{a.allergen}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>({a.type})</span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{a.reaction}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: a.severity === "Severe" ? "#dc2626" : "#f59e0b", color: "#fff" }}>{a.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...sectionStyle("#10b981"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Social History</h3>
          </div>
          <div>
            {entries(PATIENT_INFO.social).map(([k, v], i, arr) => (
              <div key={k} style={rowStyle(i === arr.length - 1)}>
                <span style={labelStyle}>{k}</span>
                <span style={valueStyle}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row: Reason for Visit + Payment ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start", marginBottom: 20 }}>
        <div style={{ ...sectionStyle("#0ea5e9"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Reason for Visit / Symptoms</h3>
          </div>
          <div>
            {entries(PATIENT_INFO.reasonForVisit).map(([k, v], i, arr) => (
              <div key={k} style={rowStyle(i === arr.length - 1)}>
                <span style={labelStyle}>{k}</span>
                <span style={valueStyle}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...sectionStyle("#f97316"), marginBottom: 0 }}>
          <div style={headerStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Payment Information</h3>
          </div>
          <div>
            {entries(PATIENT_INFO.payment).map(([k, v], i, arr) => (
              <div key={k} style={rowStyle(i === arr.length - 1)}>
                <span style={labelStyle}>{k}</span>
                <span style={valueStyle}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 9. Consent & Legal ── */}
      <div style={sectionStyle("#059669")}>
        <div style={headerStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Consent & Legal Forms</h3>
        </div>
        <div style={{ padding: "10px 20px" }}>
          {PATIENT_INFO.consent.map((c, i) => (
            <div key={c.form} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i === PATIENT_INFO.consent.length - 1 ? "none" : "1px solid #f8fafc" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#059669" }}>✓</span>
              </div>
              <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, flex: 1 }}>{c.form}</span>
              <span style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>{c.status}</span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{c.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Staff View Component ─── */
const StaffView = () => {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDrop = (name: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPhotos(prev => ({ ...prev, [name]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleClick = (name: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPhotos(prev => ({ ...prev, [name]: reader.result as string }));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const sections = [
    { title: "Physicians", data: STAFF.doctors, accent: "#3b82f6", accentBg: "#eff6ff", accentBorder: "#bfdbfe" },
    { title: "Nursing Staff", data: STAFF.nurses, accent: "#10b981", accentBg: "#ecfdf5", accentBorder: "#a7f3d0" },
    { title: "Reception", data: STAFF.receptionists, accent: "#8b5cf6", accentBg: "#f5f3ff", accentBorder: "#ddd6fe" },
  ];

  return (
    <div style={{ padding: "24px 32px", animation: "fadeIn 0.3s ease", maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", margin: 0 }}>Staff Directory</h2>
        <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Northwest Valley — 1716 2nd Street NW, Albuquerque, NM 87101</p>
      </div>

      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: 32 }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: section.accent }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: 0 }}>{section.title}</h3>
            <span style={{ fontSize: 12, color: "#9ca3af", background: "#f1f5f9", padding: "2px 10px", borderRadius: 999 }}>{section.data.length}</span>
          </div>

          {/* Cards grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}>
            {section.data.map((person) => {
              const hasPhoto = !!photos[person.name];
              const isDragTarget = dragOver === person.name;

              return (
                <div
                  key={person.name}
                  style={{
                    background: "#ffffff",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Photo area — drag & drop or click */}
                  <div
                    onClick={() => handleClick(person.name)}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(person.name); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleDrop(person.name, e)}
                    style={{
                      width: "100%",
                      height: 180,
                      background: hasPhoto ? `url(${photos[person.name]}) center/cover no-repeat` : `linear-gradient(135deg, ${section.accentBg}, #f8fafc)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 6,
                      borderBottom: `1px solid ${section.accentBorder}`,
                      position: "relative",
                      cursor: "pointer",
                      outline: isDragTarget ? `2px dashed ${section.accent}` : "none",
                      outlineOffset: -2,
                      transition: "outline 0.15s",
                    }}
                  >
                    {!hasPhoto && (
                      <>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={section.accentBorder} strokeWidth="1.2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>Drop image or click</span>
                      </>
                    )}
                    {/* Specialty badge */}
                    <div style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: hasPhoto ? "rgba(0,0,0,0.55)" : section.accent,
                      color: "#ffffff",
                      backdropFilter: hasPhoto ? "blur(4px)" : "none",
                    }}>
                      {person.specialty}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding: "14px 16px" }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{person.name}</h4>
                    <p style={{ fontSize: 11, color: section.accent, fontWeight: 600, margin: "2px 0 8px", letterSpacing: 0.2 }}>{person.title}</p>
                    <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{person.bio}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Patient Portal Component ─── */
export default function PatientPortal() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [chatHovered, setChatHovered] = useState(false);
  const [activeNav, setActiveNav] = useState("Dashboard");

  /* Appointments state */
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);

  const handleBookAppointment = (date: string, time: string, type: string) => {
    const newApt: Appointment = { id: `apt-${Date.now()}`, date, time, patientName: "Gord Sims", patientId: "gord-sims", type, provider: "Dr. Patel" };
    setAppointments(prev => [...prev, newApt]);
  };

  const handleCancelAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => !(a.id === id && a.patientId === "gord-sims")));
  };

  /* Chat state */
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content?: string; data?: any; time: string }>>([
    { role: "system", content: "Hello! I have Gord Sims' full records loaded — 15 visit notes spanning 2 years, plus labs, meds, and imaging. What would you like to know?", time: "Now" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  /* Availability helper */
  const getAvailabilityResponse = () => {
    const today = new Date(2026, 1, 23);
    const dates: { date: string; label: string; slots: string[] }[] = [];
    for (let i = 1; i <= 10 && dates.length < 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dateStr = `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, "0")}`;
      const taken = appointments.filter(a => a.date === dateStr).map(a => a.time);
      const open = TIME_SLOTS.filter(t => !taken.includes(t));
      if (open.length > 0) dates.push({ date: dateStr, label: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }), slots: open.slice(0, 4) });
    }
    return {
      type: "availability",
      title: "Available Appointments This Week",
      content: { dates },
      recommendation: `I found ${dates.reduce((s, d) => s + d.slots.length, 0)} open slots across ${dates.length} days. Click a time to book.`,
    };
  };

  const handleChatQuery = (queryType: string, label: string) => {
    setChatMessages((m) => [...m, { role: "user" as const, content: label, time: "Now" }]);
    setChatLoading(true);
    if (queryType === "notes_overview") {
      const resp = buildNotesResponse(label);
      setTimeout(() => {
        setChatLoading(false);
        setChatMessages((m) => [...m, { role: "assistant" as const, data: resp, time: "Now" } as any]);
      }, 1500);
      return;
    }
    if (queryType === "availability") {
      setTimeout(() => {
        setChatLoading(false);
        const data = getAvailabilityResponse();
        setChatMessages((m) => [...m, { role: "assistant" as const, data, time: "Now" } as any]);
      }, 1800);
    } else {
      setTimeout(() => {
        setChatLoading(false);
        setChatMessages((m) => [...m, { role: "assistant" as const, data: DEMO_RESPONSES[queryType], time: "Now" } as any]);
      }, 1800);
    }
  };

  const handleChatBooking = (date: string, time: string) => {
    handleBookAppointment(date, time, "Follow-up");
    const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    setChatMessages(prev => [...prev, {
      role: "assistant" as const,
      data: {
        type: "booking_confirmation",
        title: "Appointment Confirmed",
        content: { date: dateLabel, time: formatTime12(time), type: "Follow-up", provider: "Dr. Patel" },
        recommendation: "Your appointment has been booked. You can view it on the Calendar page.",
      },
      time: "Now",
    } as any]);
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    const q = chatInput.toLowerCase();
    setChatMessages((m) => [...m, { role: "user" as const, content: chatInput, time: "Now" }]);
    setChatInput("");
    setChatLoading(true);

    // Check if this is a notes/history question
    const notesKeywords = ["note", "visit", "history", "previous", "prescription", "rx", "prescrib", "x-ray", "xray", "imaging", "scan", "ct", "fever", "urgent", "sick", "cardiac", "heart", "pericarditis", "chest pain", "echo", "ecg", "potassium", "k+", "kidney", "renal", "ear", "abscess", "doxycycline", "infection", "abdomen", "nausea", "vomit", "stomach", "gi", "celiac", "gluten", "timeline", "past", "when did", "how many", "allerg", "insurance", "billing", "coverage", "member id", "policy", "demographic", "contact", "phone", "email", "address", "emergency", "personal info", "dob", "date of birth", "age", "social", "smok", "alcohol", "occupation", "exercise", "mental health", "phq", "gad", "depress", "anxiety", "sleep", "stress", "consent", "hipaa", "legal", "telehealth", "payment", "copay", "card on file", "reason for visit", "chief complaint", "pain scale", "symptoms today", "chronic", "condition", "diagnos", "surgery", "hospital", "family history", "medical history", "summary", "overview", "everything", "full profile", "tell me about", "who is"];
    const isNotesQuery = notesKeywords.some(kw => q.includes(kw));

    if (isNotesQuery) {
      const notesResp = buildNotesResponse(chatInput);
      setTimeout(() => {
        setChatLoading(false);
        setChatMessages((m) => [...m, { role: "assistant" as const, data: notesResp, time: "Now" } as any]);
      }, 1500);
      return;
    }

    let responseType = "meds";
    if (q.includes("book") || q.includes("appointment") || q.includes("schedule") || q.includes("availab")) responseType = "availability";
    else if (q.includes("interact") || q.includes("drug")) responseType = "interactions";
    else if (q.includes("lab") || q.includes("result") || q.includes("a1c")) responseType = "labs";
    if (responseType === "availability") {
      setTimeout(() => {
        setChatLoading(false);
        const data = getAvailabilityResponse();
        setChatMessages((m) => [...m, { role: "assistant" as const, data, time: "Now" } as any]);
      }, 1800);
    } else {
      setTimeout(() => {
        setChatLoading(false);
        setChatMessages((m) => [...m, { role: "assistant" as const, data: DEMO_RESPONSES[responseType], time: "Now" } as any]);
      }, 1800);
    }
  };

  const quickActions = [
    { key: "notes_overview", label: "Review Visit History", icon: "📋" },
    { key: "interactions", label: "Check Drug Interactions", icon: "⚠" },
    { key: "labs", label: "Summarize Labs", icon: "📊" },
    { key: "meds", label: "Review Medications", icon: "💊" },
    { key: "availability", label: "Check Availability", icon: "📅" },
  ];

  const topTabs = ["Overview", "Notes & Graphs", "Personal Info", "History", "Documents"];
  const navItems = [
    { label: "Dashboard", icon: <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { label: "Departments", icon: <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h2m4 0h2m-8 4h2m4 0h2"/></svg> },
    { label: "Staff", icon: <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
    { label: "Chat", icon: <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
    { label: "Calendar", icon: <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">H</div>
            Health Monitor <span>Portal</span>
          </div>
        </div>

        <div className="patient-card">
          <div className="patient-avatar-row">
            <div className="patient-avatar">GS</div>
            <div>
              <div className="patient-name">Gord Sims</div>
              <div className="patient-dob">Male, 01.25.1967</div>
            </div>
          </div>
          <button className="patient-contact-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            843-831-5476
          </button>
          <div className="patient-meta">
            <div className="patient-meta-row"><span>Insurance</span><strong>Aetna</strong></div>
            <div className="patient-meta-row"><span>Member #</span><strong>32523523023</strong></div>
          </div>
          <div className="patient-address">3517 Camden Place, New York</div>
          <div className="patient-polst"><strong>POLST</strong> (10/07/2023) — George Michael</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activeNav === item.label ? "active" : ""}`}
              onClick={() => setActiveNav(item.label)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="facility-name">Northwest Valley</div>
          <div className="facility-address">1716 2nd Street NW<br />Albuquerque, NM 87101</div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        {activeNav === "Calendar" ? (
          <CalendarView appointments={appointments} onBook={handleBookAppointment} onCancel={handleCancelAppointment} />
        ) : activeNav === "Chat" ? (
          <VisitNotesView />
        ) : activeNav === "Staff" ? (
          <StaffView />
        ) : (
        <>
        <div className="top-nav">
          <div className="top-nav-tabs">
            {topTabs.map((tab) => (
              <button
                key={tab}
                className={`top-nav-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "Personal Info" ? (
          <PersonalInfoView />
        ) : (
        <div className="content">
          {/* VITALS */}
          <div className="card vitals-card">
            <div className="card-title">Vitals <div className="dots"><span></span><span></span></div></div>
            <div className="vitals-grid">
              <div className="vital-item">
                <div className="vital-label">Weight</div>
                <div className="vital-value">195 <span className="vital-unit">lbs</span></div>
                <div className="vital-status normal">Normal</div>
                <svg className="vital-sparkline" viewBox="0 0 80 36"><polyline fill="none" stroke="#10b981" strokeWidth="1.5" points="0,28 10,24 20,26 30,20 40,22 50,18 60,20 70,16 80,18"/></svg>
              </div>
              <div className="vital-item">
                <div className="vital-label">Temperature</div>
                <div className="vital-value">99.4 <span className="vital-unit">°F</span></div>
                <div className="vital-status elevated">Elevated</div>
                <svg className="vital-sparkline" viewBox="0 0 80 36"><polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points="0,20 10,22 20,18 30,24 40,20 50,26 60,22 70,28 80,24"/></svg>
              </div>
              <div className="vital-item">
                <div className="vital-label">Heart Rate</div>
                <div className="vital-value">85/145 <span className="vital-unit">bpm</span></div>
                <div className="vital-status normal">Normal</div>
                <svg className="vital-sparkline" viewBox="0 0 80 36"><polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" points="0,18 8,20 12,10 16,28 20,14 28,18 36,16 44,22 48,12 52,26 56,18 64,20 72,16 80,18"/></svg>
              </div>
              <div className="vital-item">
                <div className="vital-label">Blood Pressure</div>
                <div className="vital-value">132/83 <span className="vital-unit">mmHg</span></div>
                <div className="vital-status high">High</div>
                <svg className="vital-sparkline" viewBox="0 0 80 36"><polyline fill="none" stroke="#ef4444" strokeWidth="1.5" points="0,22 10,18 20,24 30,16 40,20 50,14 60,18 70,12 80,16"/></svg>
              </div>
            </div>
          </div>

          {/* PROBLEMS */}
          <div className="card problems-card">
            <div className="card-title">Problems <div className="dots"><span></span><span></span></div></div>
            <div className="problem-list">
              <div className="problem-item active-problem"><span className="problem-dot red"></span>Abscess of external auditory canal</div>
              <div className="problem-item active-problem"><span className="problem-dot red"></span>Nausea with vomiting</div>
              <div className="problem-item active-problem"><span className="problem-dot orange"></span>Hypertension</div>
              <div className="problem-item active-problem"><span className="problem-dot yellow"></span>Abdominal Pain</div>
              <div className="problem-item resolved"><span className="problem-dot green"></span>Pericarditis (resolved)</div>
            </div>
          </div>

          {/* ALLERGIES & IMMUNIZATIONS */}
          <div className="card allergies-card">
            <div className="allergies-immun-grid">
              <div>
                <div className="sub-title">Allergies</div>
                <div>
                  <span className="allergy-tag">Peanuts</span>
                  <span className="allergy-tag">Gluten</span>
                  <span className="allergy-tag">Penicillin</span>
                </div>
              </div>
              <div>
                <div className="sub-title">Immunizations</div>
                <div className="immun-item"><span className="immun-check">✓</span> Influenza (A/V, TIV)</div>
                <div className="immun-item"><span className="immun-check">✓</span> Pneumococcal (PCV, PPV)</div>
                <div className="immun-item"><span className="immun-check">✓</span> COVID-19 (Bivalent)</div>
              </div>
            </div>
          </div>

          {/* MEDICATIONS */}
          <div className="card medications-card">
            <div className="card-title">Medications</div>
            <div className="med-list">
              <div className="med-item">
                <div><span className="med-name">Enteric Coated Aspirin</span> <span className="med-dose">325mg</span></div>
                <span className="med-freq">Daily</span>
              </div>
              <div className="med-item">
                <div><span className="med-name">Tylenol Acetaminophen</span> <span className="med-dose">500mg</span></div>
                <span className="med-freq">PRN</span>
              </div>
              <div className="med-item">
                <div><span className="med-name">Lisinopril</span> <span className="med-dose">10mg</span></div>
                <span className="med-freq">Daily</span>
              </div>
              <div className="med-item">
                <div><span className="med-name">Doxycycline</span> <span className="med-dose">100mg</span></div>
                <span className="med-freq">BID</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="right-col">
            {/* Labs */}
            <div className="card">
              <div className="card-title">Latest Investigations — Labs</div>
              <div className="labs-grid">
                <div className="lab-item"><div className="lab-label">Ca</div><div className="lab-value normal">9.4</div><div className="lab-range">8.5–10.5 mg/dL</div></div>
                <div className="lab-item"><div className="lab-label">Mg</div><div className="lab-value normal">2.1</div><div className="lab-range">1.7–2.2 mg/dL</div></div>
                <div className="lab-item"><div className="lab-label">K</div><div className="lab-value high">5.8</div><div className="lab-range">3.5–5.0 mEq/L</div></div>
                <div className="lab-item"><div className="lab-label">Na</div><div className="lab-value normal">140</div><div className="lab-range">136–145 mEq/L</div></div>
                <div className="lab-item"><div className="lab-label">Cu</div><div className="lab-value low">62</div><div className="lab-range">70–140 µg/dL</div></div>
                <div className="lab-item"><div className="lab-label">Cl</div><div className="lab-value normal">101</div><div className="lab-range">96–106 mEq/L</div></div>
              </div>
            </div>

            {/* Pulmonary Function */}
            <div className="card">
              <div className="card-title">Pulmonary Function Tx</div>
              <div className="pulm-results">
                <div>
                  <div className="pulm-row"><span className="label">FEV1</span><span className="value">78%</span></div>
                  <div className="pulm-bar-bg"><div className="pulm-bar" style={{ width: "78%", background: "var(--accent-orange)" }}></div></div>
                </div>
                <div>
                  <div className="pulm-row"><span className="label">FVC</span><span className="value">85%</span></div>
                  <div className="pulm-bar-bg"><div className="pulm-bar" style={{ width: "85%", background: "var(--accent-blue)" }}></div></div>
                </div>
                <div>
                  <div className="pulm-row"><span className="label">FEV1/FVC</span><span className="value">92%</span></div>
                  <div className="pulm-bar-bg"><div className="pulm-bar" style={{ width: "92%", background: "var(--accent-green)" }}></div></div>
                </div>
              </div>
            </div>

            {/* Imaging */}
            <div className="card imaging-card">
              <div className="card-title">Imaging</div>
              <div className="imaging-item">
                <div className="imaging-thumb"><div className="xray-placeholder"></div></div>
                <div className="imaging-info">
                  <div className="imaging-date">Sept 2025</div>
                  <div className="imaging-desc">Chest X-ray — Observed bilateral findings consistent with early emphysema</div>
                </div>
              </div>
              <div className="imaging-item">
                <div className="imaging-thumb"><div className="xray-placeholder"></div></div>
                <div className="imaging-info">
                  <div className="imaging-date">Aug 2025</div>
                  <div className="imaging-desc">Abdominal CT — Small bowel pattern unremarkable</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
        </>
        )}
      </div>

      {/* ─── Chat Popup Panel ─── */}
      {chatOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 96,
            right: 28,
            width: 420,
            height: 560,
            zIndex: 1000,
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)",
            animation: "slideUp 0.3s ease",
          }}
        >
          {/* Chat Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>MedAssist AI</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>Clinical Decision Support</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: 10, color: "#6b7280" }}>FHIR Connected</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, background: "#fafbfc" }} className="scrollbar-thin">
            {chatMessages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: "16px 16px 4px 16px", padding: "8px 14px", maxWidth: "80%" }}>
                      <p style={{ fontSize: 13, color: "#ffffff", margin: 0 }}>{msg.content}</p>
                    </div>
                  </div>
                ) : msg.role === "system" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 24, height: 24, minWidth: 24, borderRadius: "50%", background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                    </div>
                    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "16px 16px 16px 4px", padding: "8px 14px" }}>
                      <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 24, height: 24, minWidth: 24, borderRadius: "50%", background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                    </div>
                    <div style={{ flex: 1, maxWidth: "85%" }}>
                      <ResponseCard data={(msg as any).data} onBookSlot={handleChatBooking} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 24, height: 24, minWidth: 24, borderRadius: "50%", background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                </div>
                <TypingIndicator />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Actions */}
          <div style={{ padding: "6px 14px", display: "flex", gap: 6, flexWrap: "wrap", background: "#ffffff" }}>
            {quickActions.map((a) => (
              <button
                key={a.key}
                onClick={() => handleChatQuery(a.key, a.label)}
                disabled={chatLoading}
                style={{
                  fontSize: 11,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#64748b",
                  cursor: chatLoading ? "not-allowed" : "pointer",
                  opacity: chatLoading ? 0.3 : 1,
                  transition: "all 0.2s",
                }}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb", background: "#ffffff" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSubmit()}
                placeholder="Ask about this patient..."
                disabled={chatLoading}
                style={{
                  flex: 1,
                  background: "#f1f5f9",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 13,
                  color: "#1e293b",
                  outline: "none",
                }}
              />
              <button
                onClick={handleChatSubmit}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                  opacity: chatLoading || !chatInput.trim() ? 0.3 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", margin: "6px 0 0" }}>AI-assisted • Always verify clinical decisions</p>
          </div>
        </div>
      )}

      {/* Floating Chat Toggle Button */}
      <div
        onClick={() => setChatOpen(!chatOpen)}
        onMouseEnter={() => setChatHovered(true)}
        onMouseLeave={() => setChatHovered(false)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 1001,
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
        }}
      >
        {/* Label that slides in on hover */}
        {!chatOpen && (
          <div
            style={{
              background: "#ffffff",
              color: "#1e293b",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              whiteSpace: "nowrap",
              opacity: chatHovered ? 1 : 0,
              transform: chatHovered ? "translateX(0)" : "translateX(8px)",
              transition: "all 0.25s ease",
              pointerEvents: "none",
            }}
          >
            AI Assistant
          </div>
        )}

        {/* FAB button */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: chatOpen
              ? "linear-gradient(135deg, #ef4444, #f97316)"
              : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            boxShadow: chatHovered
              ? "0 6px 24px rgba(59,130,246,0.45)"
              : "0 4px 16px rgba(59,130,246,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.25s ease",
            transform: chatHovered ? "scale(1.08)" : "scale(1)",
          }}
        >
          {chatOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
