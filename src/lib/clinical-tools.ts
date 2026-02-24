/* ═══════════════════════════════════════════════
   MedAssist Clinical Tools — callable functions
   5 domain-specific healthcare tools
   ═══════════════════════════════════════════════ */

import {
  PENICILLIN_CLASS_DRUGS,
  PATIENT_INFO,
  STAFF,
  INITIAL_APPOINTMENTS,
  TIME_SLOTS,
  formatTime12,
} from "./patient-data";

/* ─────────────────────────────────────────────────
   Tool 1: drug_interaction_check
   Input:  medications[] (drug names)
   Output: interactions with severity levels
   ───────────────────────────────────────────────── */

interface DrugInteraction {
  pair: string;
  severity: "high" | "moderate" | "low";
  detail: string;
  recommendation: string;
}

interface DrugInteractionResult {
  medications_checked: string[];
  interactions_found: number;
  interactions: DrugInteraction[];
  allergy_alerts: string[];
}

// Known interaction database (curated for demo patient context)
const INTERACTION_DB: { drugs: [string, string]; severity: "high" | "moderate" | "low"; detail: string; recommendation: string }[] = [
  { drugs: ["Aspirin", "Warfarin"], severity: "high", detail: "Both agents affect coagulation. Concurrent use significantly increases bleeding risk.", recommendation: "Avoid combination or monitor INR closely. Consider PPI for GI protection." },
  { drugs: ["Aspirin", "Ibuprofen"], severity: "moderate", detail: "NSAIDs may reduce cardioprotective effect of aspirin and increase GI bleeding risk.", recommendation: "If both needed, take aspirin 30 min before ibuprofen. Monitor for GI symptoms." },
  { drugs: ["Lisinopril", "Losartan"], severity: "high", detail: "Dual RAAS blockade increases risk of hyperkalemia, hypotension, and renal impairment.", recommendation: "Do not combine ACE inhibitor with ARB. Choose one agent." },
  { drugs: ["Lisinopril", "Potassium"], severity: "moderate", detail: "ACE inhibitors increase potassium retention. Risk of hyperkalemia.", recommendation: "Monitor serum K+ closely. Patient's current K+ is 5.8 mEq/L (critically elevated)." },
  { drugs: ["Metformin", "Doxycycline"], severity: "low", detail: "Tetracyclines may rarely affect glucose metabolism.", recommendation: "Monitor blood glucose. Unlikely to be clinically significant." },
  { drugs: ["Atorvastatin", "Amoxicillin"], severity: "low", detail: "No significant interaction expected.", recommendation: "Safe to co-administer." },
  { drugs: ["Lisinopril", "Metformin"], severity: "low", detail: "ACE inhibitors may slightly enhance hypoglycemic effect of metformin.", recommendation: "Monitor blood glucose when initiating combination." },
  { drugs: ["Prednisone", "Aspirin"], severity: "moderate", detail: "Corticosteroids increase GI bleeding risk when combined with aspirin.", recommendation: "Use PPI prophylaxis if combination required. Limit duration." },
  { drugs: ["Prednisone", "Metformin"], severity: "moderate", detail: "Corticosteroids antagonize blood glucose control.", recommendation: "Monitor glucose closely. May need temporary insulin or dose adjustment." },
  { drugs: ["Sertraline", "Aspirin"], severity: "moderate", detail: "SSRIs impair platelet function; combined with aspirin increases bleeding risk.", recommendation: "Monitor for signs of bleeding. Consider PPI if high GI risk." },
  { drugs: ["Gabapentin", "Hydrocodone/APAP"], severity: "high", detail: "Both cause CNS depression. Combined use increases sedation, respiratory depression risk.", recommendation: "If combination necessary, use lowest effective doses. Monitor respiratory status." },
  { drugs: ["Doxycycline", "Antacids"], severity: "moderate", detail: "Antacids, calcium, and iron reduce doxycycline absorption.", recommendation: "Separate administration by at least 2 hours." },
  { drugs: ["Amlodipine", "Atorvastatin"], severity: "low", detail: "Amlodipine may slightly increase statin levels.", recommendation: "Limit atorvastatin to 20mg when combined with amlodipine. Monitor for myopathy." },
  { drugs: ["Metoprolol", "Amlodipine"], severity: "moderate", detail: "Additive hypotensive and bradycardic effects.", recommendation: "Monitor BP and heart rate closely when combining." },
];

export function drugInteractionCheck(medications: string[]): DrugInteractionResult {
  const interactions: DrugInteraction[] = [];
  const allergyAlerts: string[] = [];

  // Normalize medication names for matching
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

  // Check for allergy conflicts (penicillin cross-reactivity)
  const patientAllergies = PATIENT_INFO.allergies;
  const hasPenicillinAllergy = patientAllergies.some((a) => a.allergen === "Penicillin");

  for (const med of medications) {
    if (hasPenicillinAllergy && PENICILLIN_CLASS_DRUGS.some((d) => normalize(med).includes(normalize(d)))) {
      allergyAlerts.push(`ALLERGY ALERT: ${med} is a penicillin-class antibiotic. Patient has documented Penicillin allergy (rash, hives). Do NOT prescribe.`);
    }
  }

  // Check pairwise interactions
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const a = normalize(medications[i]);
      const b = normalize(medications[j]);

      for (const entry of INTERACTION_DB) {
        const d1 = normalize(entry.drugs[0]);
        const d2 = normalize(entry.drugs[1]);
        if ((a.includes(d1) && b.includes(d2)) || (a.includes(d2) && b.includes(d1))) {
          interactions.push({
            pair: `${medications[i]} + ${medications[j]}`,
            severity: entry.severity,
            detail: entry.detail,
            recommendation: entry.recommendation,
          });
        }
      }
    }
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, moderate: 1, low: 2 };
  interactions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    medications_checked: medications,
    interactions_found: interactions.length,
    interactions,
    allergy_alerts: allergyAlerts,
  };
}

/* ─────────────────────────────────────────────────
   Tool 2: symptom_lookup
   Input:  symptoms[] (symptom descriptions)
   Output: possible conditions with urgency levels
   ───────────────────────────────────────────────── */

interface PossibleCondition {
  condition: string;
  likelihood: "high" | "moderate" | "low";
  urgency: "emergent" | "urgent" | "routine";
  reasoning: string;
  recommended_workup: string[];
}

interface SymptomLookupResult {
  symptoms_analyzed: string[];
  possible_conditions: PossibleCondition[];
  patient_context: string;
}

const SYMPTOM_DB: { keywords: string[]; condition: string; likelihood: "high" | "moderate" | "low"; urgency: "emergent" | "urgent" | "routine"; reasoning: string; workup: string[] }[] = [
  { keywords: ["chest pain", "chest pressure"], condition: "Acute Coronary Syndrome", likelihood: "moderate", urgency: "emergent", reasoning: "Chest pain in 59M with HTN, elevated ASCVD risk, and history of pericarditis requires ACS rule-out.", workup: ["Troponin (serial)", "12-lead ECG", "CXR", "CBC/BMP"] },
  { keywords: ["chest pain", "pleuritic", "sharp", "breathing"], condition: "Recurrent Pericarditis", likelihood: "moderate", urgency: "urgent", reasoning: "Patient has history of pericarditis (Aug 2024). Pleuritic chest pain could indicate recurrence.", workup: ["CRP", "ESR", "Echocardiogram", "ECG"] },
  { keywords: ["headache"], condition: "Hypertensive Headache", likelihood: "high", urgency: "routine", reasoning: "Patient has documented HTN with BP above target. Headaches are reported as associated symptom.", workup: ["BP measurement", "Medication review", "Consider dose titration"] },
  { keywords: ["nausea", "vomiting"], condition: "Medication Side Effect (ACE Inhibitor / Doxycycline)", likelihood: "high", urgency: "routine", reasoning: "Patient has documented intermittent nausea. Both Lisinopril and Doxycycline can cause GI symptoms.", workup: ["H. pylori breath test (already ordered)", "Medication timing review", "Upper GI if persists"] },
  { keywords: ["nausea", "vomiting", "abdominal"], condition: "Celiac Disease / Gluten Sensitivity", likelihood: "moderate", urgency: "routine", reasoning: "Patient has gluten sensitivity with mildly elevated tTG-IgA (22). GI referral pending.", workup: ["tTG-IgA recheck", "Endoscopy with biopsy", "Strict GF diet trial"] },
  { keywords: ["abdominal pain", "stomach", "belly"], condition: "Diverticulitis", likelihood: "low", urgency: "urgent", reasoning: "CT showed mild diverticulosis. LLQ pain could indicate diverticular flare.", workup: ["CT abdomen with contrast", "CBC", "CRP", "Surgery consult if complicated"] },
  { keywords: ["shortness of breath", "dyspnea", "breathing difficulty"], condition: "COPD Exacerbation", likelihood: "moderate", urgency: "urgent", reasoning: "Patient has early emphysema (FEV1 78%), former smoker. SOB may indicate COPD progression.", workup: ["SpO2", "PFTs", "CXR", "Bronchodilator trial"] },
  { keywords: ["cough"], condition: "ACE Inhibitor-Induced Cough", likelihood: "high", urgency: "routine", reasoning: "Dry cough is a known side effect of Lisinopril (ACE inhibitor). Occurs in ~10% of patients.", workup: ["Medication review", "Consider switching to ARB (Losartan)", "CXR if productive"] },
  { keywords: ["ear pain", "ear", "hearing"], condition: "Otitis Externa / Ear Abscess", likelihood: "high", urgency: "routine", reasoning: "Patient has active ear abscess being treated with Doxycycline. Ear symptoms likely related.", workup: ["Otoscopic exam", "Assess antibiotic response", "I&D if no improvement"] },
  { keywords: ["fatigue", "tired", "weakness"], condition: "Copper Deficiency", likelihood: "moderate", urgency: "routine", reasoning: "Patient has low copper (62 ug/dL). Copper deficiency can cause fatigue and weakness.", workup: ["Serum copper recheck", "Ceruloplasmin", "CBC for anemia", "Dietary assessment"] },
  { keywords: ["dizziness", "lightheaded"], condition: "Medication-Related Hypotension", likelihood: "moderate", urgency: "urgent", reasoning: "Lisinopril + elevated K+ could cause hemodynamic instability.", workup: ["Orthostatic BP", "BMP (K+, creatinine)", "Medication review"] },
  { keywords: ["swelling", "edema", "legs"], condition: "Heart Failure", likelihood: "low", urgency: "urgent", reasoning: "HTN is a risk factor for HF. New edema warrants evaluation.", workup: ["BNP/NT-proBNP", "Echocardiogram", "CXR", "BMP"] },
  { keywords: ["rash", "hives", "skin"], condition: "Drug Allergy Reaction", likelihood: "moderate", urgency: "urgent", reasoning: "Patient has documented drug allergy to Penicillin. New rash could indicate reaction to current medications.", workup: ["Medication timeline review", "Allergy panel", "Discontinue suspect agent", "Dermatology referral if severe"] },
];

export function symptomLookup(symptoms: string[]): SymptomLookupResult {
  const conditions: PossibleCondition[] = [];
  const seen = new Set<string>();

  const normalizedSymptoms = symptoms.map((s) => s.toLowerCase());

  for (const entry of SYMPTOM_DB) {
    const matches = entry.keywords.some((kw) =>
      normalizedSymptoms.some((s) => s.includes(kw) || kw.includes(s))
    );
    if (matches && !seen.has(entry.condition)) {
      seen.add(entry.condition);
      conditions.push({
        condition: entry.condition,
        likelihood: entry.likelihood,
        urgency: entry.urgency,
        reasoning: entry.reasoning,
        recommended_workup: entry.workup,
      });
    }
  }

  // Sort by urgency
  const urgencyOrder = { emergent: 0, urgent: 1, routine: 2 };
  conditions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return {
    symptoms_analyzed: symptoms,
    possible_conditions: conditions,
    patient_context: `59-year-old male with HTN, early COPD, history of pericarditis, active ear abscess, K+ 5.8 (elevated), Copper 62 (low). Allergies: Penicillin, Peanuts, Gluten.`,
  };
}

/* ─────────────────────────────────────────────────
   Tool 3: provider_search
   Input:  specialty, location (optional)
   Output: matching providers with details
   ───────────────────────────────────────────────── */

interface ProviderResult {
  name: string;
  title: string;
  specialty: string;
  bio: string;
  role: "doctor" | "nurse" | "receptionist";
  available: boolean;
}

interface ProviderSearchResult {
  query_specialty: string;
  query_location: string;
  providers_found: number;
  providers: ProviderResult[];
}

export function providerSearch(specialty: string, location?: string): ProviderSearchResult {
  const normalizedSpecialty = specialty.toLowerCase();
  const allProviders: ProviderResult[] = [];

  // Search doctors
  for (const doc of STAFF.doctors) {
    if (
      doc.specialty.toLowerCase().includes(normalizedSpecialty) ||
      doc.title.toLowerCase().includes(normalizedSpecialty) ||
      doc.name.toLowerCase().includes(normalizedSpecialty) ||
      normalizedSpecialty.includes("doctor") ||
      normalizedSpecialty.includes("physician")
    ) {
      allProviders.push({
        name: doc.name,
        title: doc.title,
        specialty: doc.specialty,
        bio: doc.bio,
        role: "doctor",
        available: true,
      });
    }
  }

  // Search nurses
  for (const nurse of STAFF.nurses) {
    if (
      nurse.specialty.toLowerCase().includes(normalizedSpecialty) ||
      nurse.title.toLowerCase().includes(normalizedSpecialty) ||
      nurse.name.toLowerCase().includes(normalizedSpecialty) ||
      normalizedSpecialty.includes("nurse") ||
      normalizedSpecialty.includes("rn")
    ) {
      allProviders.push({
        name: nurse.name,
        title: nurse.title,
        specialty: nurse.specialty,
        bio: nurse.bio,
        role: "nurse",
        available: true,
      });
    }
  }

  // Search receptionists
  for (const rec of STAFF.receptionists) {
    if (
      rec.specialty.toLowerCase().includes(normalizedSpecialty) ||
      normalizedSpecialty.includes("reception") ||
      normalizedSpecialty.includes("front desk") ||
      normalizedSpecialty.includes("scheduling")
    ) {
      allProviders.push({
        name: rec.name,
        title: rec.title,
        specialty: rec.specialty,
        bio: rec.bio,
        role: "receptionist",
        available: true,
      });
    }
  }

  return {
    query_specialty: specialty,
    query_location: location || "Main Clinic",
    providers_found: allProviders.length,
    providers: allProviders,
  };
}

/* ─────────────────────────────────────────────────
   Tool 4: appointment_availability
   Input:  provider_id (name), date_range
   Output: available time slots
   ───────────────────────────────────────────────── */

interface AvailableSlot {
  date: string;
  time: string;
  time_display: string;
  provider: string;
  type: string;
}

interface AppointmentAvailabilityResult {
  provider: string;
  date_range_start: string;
  date_range_end: string;
  booked_slots: number;
  available_slots: AvailableSlot[];
}

export function appointmentAvailability(providerName: string, startDate: string, endDate: string): AppointmentAvailabilityResult {
  const normalizedProvider = providerName.toLowerCase();

  // Find matching provider
  const matchedProvider = [...STAFF.doctors].find((d) =>
    d.name.toLowerCase().includes(normalizedProvider) ||
    normalizedProvider.includes(d.name.split(" ").pop()!.toLowerCase())
  );

  const providerDisplay = matchedProvider?.name || providerName;

  // Get booked appointments for this provider in date range
  const booked = INITIAL_APPOINTMENTS.filter((appt) => {
    const matchesProvider = appt.provider.toLowerCase().includes(normalizedProvider) ||
      normalizedProvider.includes(appt.provider.split(" ").pop()!.toLowerCase());
    const inRange = appt.date >= startDate && appt.date <= endDate;
    return matchesProvider && inRange;
  });

  const bookedSlots = new Set(booked.map((a) => `${a.date}|${a.time}`));

  // Generate available slots
  const available: AvailableSlot[] = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const dateStr = d.toISOString().split("T")[0];
    for (const slot of TIME_SLOTS) {
      const key = `${dateStr}|${slot}`;
      if (!bookedSlots.has(key)) {
        available.push({
          date: dateStr,
          time: slot,
          time_display: formatTime12(slot),
          provider: providerDisplay,
          type: "Available",
        });
      }
    }
  }

  return {
    provider: providerDisplay,
    date_range_start: startDate,
    date_range_end: endDate,
    booked_slots: booked.length,
    available_slots: available.slice(0, 20), // Limit to 20 results
  };
}

/* ─────────────────────────────────────────────────
   Tool 5: insurance_coverage_check
   Input:  procedure_code, plan_id (optional)
   Output: coverage details, copay, requirements
   ───────────────────────────────────────────────── */

interface CoverageDetail {
  procedure_code: string;
  procedure_name: string;
  covered: boolean;
  coverage_level: "full" | "partial" | "not_covered";
  patient_responsibility: string;
  copay: string;
  deductible_applies: boolean;
  prior_auth_required: boolean;
  notes: string;
}

interface InsuranceCoverageResult {
  patient: string;
  insurance_provider: string;
  member_id: string;
  plan_type: string;
  procedure_checked: string;
  coverage: CoverageDetail;
}

// Procedure database matching common codes
const PROCEDURE_DB: Record<string, { name: string; covered: boolean; coverage_level: "full" | "partial" | "not_covered"; responsibility: string; copay: string; deductible: boolean; prior_auth: boolean; notes: string }> = {
  "99213": { name: "Office Visit — Established Patient (Level 3)", covered: true, coverage_level: "full", responsibility: "Copay only", copay: "$25.00", deductible: false, prior_auth: false, notes: "Standard office visit. No referral needed for PCP." },
  "99214": { name: "Office Visit — Established Patient (Level 4)", covered: true, coverage_level: "full", responsibility: "Copay only", copay: "$25.00", deductible: false, prior_auth: false, notes: "Extended office visit. No referral needed for PCP." },
  "99215": { name: "Office Visit — Established Patient (Level 5)", covered: true, coverage_level: "full", responsibility: "Copay only", copay: "$40.00", deductible: false, prior_auth: false, notes: "Complex visit. May require documentation justification." },
  "99203": { name: "Office Visit — New Patient (Level 3)", covered: true, coverage_level: "full", responsibility: "Copay only", copay: "$35.00", deductible: false, prior_auth: false, notes: "Initial new patient visit." },
  "36415": { name: "Venipuncture (Blood Draw)", covered: true, coverage_level: "full", responsibility: "No charge", copay: "$0", deductible: false, prior_auth: false, notes: "Covered as part of diagnostic workup." },
  "80053": { name: "Comprehensive Metabolic Panel (CMP)", covered: true, coverage_level: "full", responsibility: "No charge (preventive)", copay: "$0", deductible: false, prior_auth: false, notes: "Covered under preventive lab work benefit." },
  "80061": { name: "Lipid Panel", covered: true, coverage_level: "full", responsibility: "No charge (preventive)", copay: "$0", deductible: false, prior_auth: false, notes: "Annual lipid panel covered at 100% as preventive screening." },
  "93000": { name: "Electrocardiogram (ECG), 12-lead", covered: true, coverage_level: "full", responsibility: "Copay only", copay: "$25.00", deductible: false, prior_auth: false, notes: "Covered for cardiac evaluation." },
  "93306": { name: "Echocardiogram, Complete", covered: true, coverage_level: "partial", responsibility: "20% coinsurance after deductible", copay: "$50.00", deductible: true, prior_auth: false, notes: "Covered when medically necessary. Cardiology referral may be required." },
  "71046": { name: "Chest X-Ray, 2 Views", covered: true, coverage_level: "full", responsibility: "Copay only", copay: "$25.00", deductible: false, prior_auth: false, notes: "Standard diagnostic imaging. No prior auth needed." },
  "74178": { name: "CT Abdomen/Pelvis with Contrast", covered: true, coverage_level: "partial", responsibility: "20% coinsurance after deductible", copay: "$75.00", deductible: true, prior_auth: true, notes: "Prior authorization required. Must document medical necessity." },
  "94010": { name: "Spirometry / Pulmonary Function Test (PFT)", covered: true, coverage_level: "full", responsibility: "Copay only", copay: "$25.00", deductible: false, prior_auth: false, notes: "Covered for respiratory evaluation." },
  "43239": { name: "Upper GI Endoscopy with Biopsy", covered: true, coverage_level: "partial", responsibility: "20% coinsurance after deductible", copay: "$100.00", deductible: true, prior_auth: true, notes: "Prior authorization required. GI referral needed. Celiac workup qualifies." },
  "90471": { name: "Immunization Administration", covered: true, coverage_level: "full", responsibility: "No charge (preventive)", copay: "$0", deductible: false, prior_auth: false, notes: "Covered at 100% under ACA preventive services." },
  "90686": { name: "Influenza Vaccine (Quadrivalent)", covered: true, coverage_level: "full", responsibility: "No charge (preventive)", copay: "$0", deductible: false, prior_auth: false, notes: "Annual flu vaccine covered at 100%." },
  "G0444": { name: "Depression Screening (PHQ-9)", covered: true, coverage_level: "full", responsibility: "No charge (preventive)", copay: "$0", deductible: false, prior_auth: false, notes: "Annual depression screening covered under preventive benefit." },
  "G0442": { name: "Alcohol Misuse Screening", covered: true, coverage_level: "full", responsibility: "No charge (preventive)", copay: "$0", deductible: false, prior_auth: false, notes: "Annual screening covered under preventive benefit." },
  "99490": { name: "Chronic Care Management (20 min/month)", covered: true, coverage_level: "partial", responsibility: "20% coinsurance", copay: "$15.00", deductible: false, prior_auth: false, notes: "Available for patients with 2+ chronic conditions. Patient qualifies (HTN + early COPD)." },
};

export function insuranceCoverageCheck(procedureCode: string, planId?: string): InsuranceCoverageResult {
  const patientInsurance = PATIENT_INFO.insurance;
  const procedure = PROCEDURE_DB[procedureCode];

  const coverage: CoverageDetail = procedure
    ? {
        procedure_code: procedureCode,
        procedure_name: procedure.name,
        covered: procedure.covered,
        coverage_level: procedure.coverage_level,
        patient_responsibility: procedure.responsibility,
        copay: procedure.copay,
        deductible_applies: procedure.deductible,
        prior_auth_required: procedure.prior_auth,
        notes: procedure.notes,
      }
    : {
        procedure_code: procedureCode,
        procedure_name: "Unknown Procedure",
        covered: false,
        coverage_level: "not_covered",
        patient_responsibility: "Unable to determine — code not found in benefits database",
        copay: "N/A",
        deductible_applies: false,
        prior_auth_required: false,
        notes: `Procedure code ${procedureCode} not found in the Aetna benefits database. Contact Aetna Member Services at 1-800-872-3862 for manual verification.`,
      };

  return {
    patient: PATIENT_INFO.personal["Full Legal Name"],
    insurance_provider: patientInsurance["Insurance Provider"],
    member_id: patientInsurance["Member ID"],
    plan_type: planId || patientInsurance["Group Number"],
    procedure_checked: procedureCode,
    coverage,
  };
}
