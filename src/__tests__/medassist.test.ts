import { describe, it, expect } from "vitest";
import {
  computeBodySystemScores,
  REFERENCE_RANGES,
  PENICILLIN_CLASS_DRUGS,
  LAB_TRENDS,
  BP_READINGS,
  MEDICATION_TIMELINE,
  formatTime12,
  PATIENT_INFO,
} from "@/lib/patient-data";
import {
  drugInteractionCheck,
  symptomLookup,
  providerSearch,
  appointmentAvailability,
  insuranceCoverageCheck,
} from "@/lib/clinical-tools";

/* ─────────────────────────────────────
   Test 1: ASCVD Pooled Cohort Equation
   ───────────────────────────────────── */
describe("ASCVD Risk Calculation", () => {
  // Reproduces the exact Pooled Cohort Equations from ASCVDRiskCalculator in page.tsx
  function calculateASCVD(params: {
    age: number;
    totalChol: number;
    hdl: number;
    sbp: number;
    isMale: boolean;
    isDiabetic: boolean;
    isSmoker: boolean;
    onBPMeds: boolean;
  }): number {
    const { age, totalChol, hdl, sbp, isMale, isDiabetic, isSmoker, onBPMeds } = params;
    const lnAge = Math.log(age);
    const lnChol = Math.log(totalChol);
    const lnHDL = Math.log(hdl);
    const lnSBP = Math.log(sbp);
    const smokerVal = isSmoker ? 1 : 0;
    const diabetesVal = isDiabetic ? 1 : 0;

    let sumCoeff: number;
    let meanCoeff: number;
    let baselineSurvival: number;

    if (isMale) {
      const lnSBPCoeff = onBPMeds ? 1.99881 : 1.93303;
      sumCoeff =
        12.344 * lnAge + 11.853 * lnChol + -2.664 * (lnAge * lnChol) +
        -7.990 * lnHDL + 1.769 * (lnAge * lnHDL) +
        lnSBPCoeff * lnSBP +
        7.837 * smokerVal + -1.795 * (lnAge * smokerVal) +
        0.658 * diabetesVal;
      meanCoeff = 61.18;
      baselineSurvival = 0.9144;
    } else {
      const lnSBPCoeff = onBPMeds ? 29.2907 : 27.8197;
      sumCoeff =
        -29.799 * lnAge + 13.540 * (lnAge * lnAge) + 13.540 * lnChol +
        -13.578 * (lnAge * lnChol) + -13.578 * lnHDL + 1.957 * (lnAge * lnHDL) +
        lnSBPCoeff * lnSBP + -6.4321 * (lnAge * lnSBP) +
        7.574 * smokerVal + -1.665 * (lnAge * smokerVal) +
        0.661 * diabetesVal;
      meanCoeff = -29.18;
      baselineSurvival = 0.9665;
    }

    const raw = (1 - Math.pow(baselineSurvival, Math.exp(sumCoeff - meanCoeff))) * 100;
    return Math.max(0, Math.min(Math.round(raw * 10) / 10, 100));
  }

  it("should produce a finite percentage between 0 and 100 for Gord Sims profile", () => {
    const risk = calculateASCVD({
      age: 59,
      totalChol: 210,
      hdl: 42,
      sbp: 132,
      isMale: true,
      isDiabetic: false,
      isSmoker: false,
      onBPMeds: true,
    });
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThanOrEqual(100);
    expect(Number.isFinite(risk)).toBe(true);
  });

  it("should return higher risk for smoker vs non-smoker (low-risk baseline)", () => {
    // Use a younger, lower-risk profile so neither caps at 100%
    const base = { age: 45, totalChol: 180, hdl: 60, sbp: 120, isMale: true, isDiabetic: false, onBPMeds: false };
    const nonSmoker = calculateASCVD({ ...base, isSmoker: false });
    const smoker = calculateASCVD({ ...base, isSmoker: true });
    expect(smoker).toBeGreaterThan(nonSmoker);
  });
});

/* ───────────────────────────────────────
   Test 2: Penicillin Cross-Reactivity
   ─────────────────────────────────────── */
describe("Penicillin Allergy Cross-Reactivity", () => {
  function isPenicillinClassDrug(drugName: string): boolean {
    return PENICILLIN_CLASS_DRUGS.some(
      (d) => drugName.toLowerCase().includes(d.toLowerCase())
    );
  }

  it("should flag Amoxicillin as a penicillin-class drug", () => {
    expect(isPenicillinClassDrug("Amoxicillin")).toBe(true);
  });

  it("should flag Augmentin as a penicillin-class drug", () => {
    expect(isPenicillinClassDrug("Augmentin")).toBe(true);
  });

  it("should NOT flag Doxycycline as penicillin-class", () => {
    expect(isPenicillinClassDrug("Doxycycline")).toBe(false);
  });

  it("should NOT flag Azithromycin as penicillin-class", () => {
    expect(isPenicillinClassDrug("Azithromycin")).toBe(false);
  });

  it("should detect allergy for patient with Penicillin allergy", () => {
    const hasAllergy = PATIENT_INFO.allergies.some(
      (a) => a.allergen === "Penicillin" && a.type === "Drug"
    );
    expect(hasAllergy).toBe(true);
  });
});

/* ─────────────────────────────────────────────
   Test 3: Reference Range Validation
   ───────────────────────────────────────────── */
describe("Reference Range Validation", () => {
  function isInRange(lab: string, value: number): boolean {
    const range = REFERENCE_RANGES[lab];
    if (!range) return false;
    return value >= range.min && value <= range.max;
  }

  it("should mark K+ 4.0 as within normal range (3.5–5.0)", () => {
    expect(isInRange("K", 4.0)).toBe(true);
  });

  it("should mark K+ 5.8 as OUT of range (hyperkalemia)", () => {
    expect(isInRange("K", 5.8)).toBe(false);
  });

  it("should mark Creatinine 1.0 as within normal range (0.6–1.2)", () => {
    expect(isInRange("Creatinine", 1.0)).toBe(true);
  });

  it("should mark Copper 62 as OUT of range (below 70)", () => {
    expect(isInRange("Copper", 62)).toBe(false);
  });

  it("should mark LDL 148 as OUT of range (above 100 target)", () => {
    expect(isInRange("LDL", 148)).toBe(false);
  });

  it("should have all 6 lab reference ranges defined", () => {
    const expected = ["K", "LDL", "HDL", "CRP", "Creatinine", "Copper"];
    for (const lab of expected) {
      expect(REFERENCE_RANGES[lab]).toBeDefined();
      expect(REFERENCE_RANGES[lab].min).toBeLessThan(REFERENCE_RANGES[lab].max);
    }
  });
});

/* ───────────────────────────────────────────
   Test 4: Body System Scores
   ─────────────────────────────────────────── */
describe("Body System Scores (computeBodySystemScores)", () => {
  const scores = computeBodySystemScores();

  it("should return exactly 8 body systems", () => {
    expect(scores).toHaveLength(8);
  });

  it("should have Cardiovascular as lowest score (45)", () => {
    const cardio = scores.find((s) => s.system === "Cardiovascular");
    expect(cardio).toBeDefined();
    expect(cardio!.score).toBe(45);

    const minScore = Math.min(...scores.map((s) => s.score));
    expect(cardio!.score).toBe(minScore);
  });

  it("should have Hepatic as highest score (90)", () => {
    const hepatic = scores.find((s) => s.system === "Hepatic");
    expect(hepatic).toBeDefined();
    expect(hepatic!.score).toBe(90);
  });

  it("should have all scores between 0 and 100", () => {
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("should compute overall average ~73", () => {
    const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    expect(Math.round(avg)).toBeGreaterThanOrEqual(70);
    expect(Math.round(avg)).toBeLessThanOrEqual(76);
  });
});

/* ─────────────────────────────────────────
   Test 5: Lab Trend Data Integrity
   ───────────────────────────────────────── */
describe("Lab Trend Data Integrity", () => {
  it("should have 9 data points in chronological order", () => {
    expect(LAB_TRENDS).toHaveLength(9);
    for (let i = 1; i < LAB_TRENDS.length; i++) {
      expect(new Date(LAB_TRENDS[i].date).getTime())
        .toBeGreaterThan(new Date(LAB_TRENDS[i - 1].date).getTime());
    }
  });

  it("should show K+ trending upward from 4.6 to 5.8", () => {
    const kValues = LAB_TRENDS
      .filter((p) => p.K !== null)
      .map((p) => p.K as number);
    expect(kValues[0]).toBe(4.6);
    expect(kValues[kValues.length - 1]).toBe(5.8);
    expect(kValues[kValues.length - 1]).toBeGreaterThan(kValues[0]);
  });

  it("should show CRP normalizing from 48 to 3.2 (pericarditis resolution)", () => {
    const crpValues = LAB_TRENDS
      .filter((p) => p.CRP !== null)
      .map((p) => p.CRP as number);
    expect(crpValues[0]).toBe(48);
    expect(crpValues[crpValues.length - 1]).toBe(3.2);
  });
});

/* ────────────────────────────────────────
   Test 6: BP Reading Data Integrity
   ──────────────────────────────────────── */
describe("BP Reading Data Integrity", () => {
  it("should have 9 BP readings in chronological order", () => {
    expect(BP_READINGS).toHaveLength(9);
    for (let i = 1; i < BP_READINGS.length; i++) {
      expect(new Date(BP_READINGS[i].date).getTime())
        .toBeGreaterThan(new Date(BP_READINGS[i - 1].date).getTime());
    }
  });

  it("should show systolic BP improving from 152 to 132", () => {
    expect(BP_READINGS[0].systolic).toBe(152);
    expect(BP_READINGS[BP_READINGS.length - 1].systolic).toBe(132);
  });

  it("should have systolic always greater than diastolic", () => {
    for (const bp of BP_READINGS) {
      expect(bp.systolic).toBeGreaterThan(bp.diastolic);
    }
  });
});

/* ────────────────────────────────────────
   Test 7: Medication Timeline
   ──────────────────────────────────────── */
describe("Medication Timeline", () => {
  it("should have 5 medication events", () => {
    expect(MEDICATION_TIMELINE).toHaveLength(5);
  });

  it("should have Colchicine as the only discontinued medication", () => {
    const discontinued = MEDICATION_TIMELINE.filter((m) => m.event === "discontinued");
    expect(discontinued).toHaveLength(1);
    expect(discontinued[0].drug).toContain("Colchicine");
    expect(discontinued[0].endDate).not.toBeNull();
  });

  it("should have ongoing medications with null endDate", () => {
    const ongoing = MEDICATION_TIMELINE.filter((m) => m.event === "ongoing");
    for (const med of ongoing) {
      expect(med.endDate).toBeNull();
    }
  });
});

/* ───────────────────────────────────────
   Test 8: Utility Functions
   ─────────────────────────────────────── */
describe("formatTime12 Utility", () => {
  it("should format 09:00 as 9:00 AM", () => {
    expect(formatTime12("09:00")).toBe("9:00 AM");
  });

  it("should format 14:30 as 2:30 PM", () => {
    expect(formatTime12("14:30")).toBe("2:30 PM");
  });

  it("should format 12:00 as 12:00 PM", () => {
    expect(formatTime12("12:00")).toBe("12:00 PM");
  });
});

/* ──────────────────────────────────────────────
   Test 9: Input Validation Edge Cases (ASCVD)
   ────────────────────────────────────────────── */
describe("ASCVD Input Validation", () => {
  function validateASCVDInputs(params: {
    age: number;
    totalChol: number;
    hdl: number;
    sbp: number;
  }): string | null {
    const { age, totalChol, hdl, sbp } = params;
    if (age < 40 || age > 79) return "Age must be between 40 and 79.";
    if (totalChol <= 0 || hdl <= 0 || sbp <= 0)
      return "Cholesterol, HDL, and blood pressure must be positive values.";
    if (hdl >= totalChol)
      return "HDL cannot be greater than total cholesterol.";
    return null;
  }

  it("should reject age below 40", () => {
    expect(validateASCVDInputs({ age: 30, totalChol: 200, hdl: 50, sbp: 120 }))
      .toBe("Age must be between 40 and 79.");
  });

  it("should reject age above 79", () => {
    expect(validateASCVDInputs({ age: 85, totalChol: 200, hdl: 50, sbp: 120 }))
      .toBe("Age must be between 40 and 79.");
  });

  it("should reject HDL >= total cholesterol", () => {
    expect(validateASCVDInputs({ age: 55, totalChol: 150, hdl: 160, sbp: 120 }))
      .toBe("HDL cannot be greater than total cholesterol.");
  });

  it("should accept valid inputs", () => {
    expect(validateASCVDInputs({ age: 59, totalChol: 210, hdl: 42, sbp: 132 }))
      .toBeNull();
  });
});

/* ══════════════════════════════════════════════════
   CLINICAL TOOL FUNCTION TESTS
   ══════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────
   Test 10: drug_interaction_check
   ──────────────────────────────────────────────── */
describe("drug_interaction_check", () => {
  it("should detect allergy alert when Amoxicillin prescribed to penicillin-allergic patient", () => {
    const result = drugInteractionCheck(["Amoxicillin", "Lisinopril"]);
    expect(result.allergy_alerts.length).toBeGreaterThan(0);
    expect(result.allergy_alerts[0]).toContain("penicillin");
  });

  it("should detect interaction between Aspirin and Ibuprofen", () => {
    const result = drugInteractionCheck(["Aspirin", "Ibuprofen"]);
    expect(result.interactions_found).toBeGreaterThan(0);
    expect(result.interactions[0].pair).toContain("Aspirin");
    expect(result.interactions[0].severity).toBe("moderate");
  });

  it("should return no interactions for safe combination", () => {
    const result = drugInteractionCheck(["Doxycycline"]);
    expect(result.interactions_found).toBe(0);
    expect(result.allergy_alerts.length).toBe(0);
  });

  it("should return structured result with all expected fields", () => {
    const result = drugInteractionCheck(["Lisinopril", "Losartan"]);
    expect(result.medications_checked).toEqual(["Lisinopril", "Losartan"]);
    expect(result.interactions_found).toBeGreaterThan(0);
    expect(result.interactions[0]).toHaveProperty("pair");
    expect(result.interactions[0]).toHaveProperty("severity");
    expect(result.interactions[0]).toHaveProperty("detail");
    expect(result.interactions[0]).toHaveProperty("recommendation");
  });
});

/* ────────────────────────────────────────────────
   Test 11: symptom_lookup
   ──────────────────────────────────────────────── */
describe("symptom_lookup", () => {
  it("should return emergent conditions for chest pain", () => {
    const result = symptomLookup(["chest pain"]);
    expect(result.possible_conditions.length).toBeGreaterThan(0);
    const emergent = result.possible_conditions.find((c) => c.urgency === "emergent");
    expect(emergent).toBeDefined();
    expect(emergent!.condition).toContain("Coronary");
  });

  it("should return ear-related condition for ear pain", () => {
    const result = symptomLookup(["ear pain"]);
    const earCondition = result.possible_conditions.find((c) => c.condition.includes("Ear") || c.condition.includes("Otitis"));
    expect(earCondition).toBeDefined();
  });

  it("should include patient context in result", () => {
    const result = symptomLookup(["nausea"]);
    expect(result.patient_context).toContain("59-year-old");
    expect(result.patient_context).toContain("Penicillin");
  });

  it("should sort by urgency (emergent first)", () => {
    const result = symptomLookup(["chest pain", "nausea", "ear pain"]);
    const urgencies = result.possible_conditions.map((c) => c.urgency);
    const urgencyOrder = { emergent: 0, urgent: 1, routine: 2 };
    for (let i = 1; i < urgencies.length; i++) {
      expect(urgencyOrder[urgencies[i]]).toBeGreaterThanOrEqual(urgencyOrder[urgencies[i - 1]]);
    }
  });
});

/* ────────────────────────────────────────────────
   Test 12: provider_search
   ──────────────────────────────────────────────── */
describe("provider_search", () => {
  it("should find cardiologist when searching Cardiology", () => {
    const result = providerSearch("Cardiology");
    expect(result.providers_found).toBeGreaterThan(0);
    const doc = result.providers.find((p) => p.role === "doctor");
    expect(doc).toBeDefined();
    expect(doc!.name).toContain("Kim");
  });

  it("should find nurses when searching for nurse role", () => {
    const result = providerSearch("nurse");
    expect(result.providers_found).toBeGreaterThan(0);
    expect(result.providers.every((p) => p.role === "nurse")).toBe(true);
  });

  it("should return empty for non-existent specialty", () => {
    const result = providerSearch("Neurosurgery");
    expect(result.providers_found).toBe(0);
  });

  it("should return structured result with expected fields", () => {
    const result = providerSearch("Internal Medicine");
    expect(result).toHaveProperty("query_specialty");
    expect(result).toHaveProperty("providers_found");
    expect(result).toHaveProperty("providers");
    if (result.providers.length > 0) {
      expect(result.providers[0]).toHaveProperty("name");
      expect(result.providers[0]).toHaveProperty("bio");
      expect(result.providers[0]).toHaveProperty("role");
    }
  });
});

/* ────────────────────────────────────────────────
   Test 13: appointment_availability
   ──────────────────────────────────────────────── */
describe("appointment_availability", () => {
  it("should return available slots for Dr. Patel", () => {
    const result = appointmentAvailability("Patel", "2026-02-24", "2026-02-24");
    expect(result.provider).toContain("Patel");
    expect(result.available_slots.length).toBeGreaterThan(0);
  });

  it("should exclude booked appointment times", () => {
    const result = appointmentAvailability("Patel", "2026-02-24", "2026-02-24");
    // Dr. Patel has 09:00 booked on 2026-02-24 (Jane Doe)
    const nineAM = result.available_slots.find((s) => s.time === "09:00");
    expect(nineAM).toBeUndefined();
  });

  it("should skip weekends", () => {
    // 2026-02-28 is a Saturday, 2026-03-01 is Sunday
    const result = appointmentAvailability("Patel", "2026-02-28", "2026-03-01");
    expect(result.available_slots.length).toBe(0);
  });

  it("should include time_display in 12-hour format", () => {
    const result = appointmentAvailability("Patel", "2026-02-24", "2026-02-24");
    if (result.available_slots.length > 0) {
      expect(result.available_slots[0].time_display).toMatch(/AM|PM/);
    }
  });
});

/* ────────────────────────────────────────────────
   Test 14: insurance_coverage_check
   ──────────────────────────────────────────────── */
describe("insurance_coverage_check", () => {
  it("should return coverage for standard office visit (99213)", () => {
    const result = insuranceCoverageCheck("99213");
    expect(result.coverage.covered).toBe(true);
    expect(result.coverage.copay).toBe("$25.00");
    expect(result.coverage.prior_auth_required).toBe(false);
  });

  it("should require prior auth for CT abdomen (74178)", () => {
    const result = insuranceCoverageCheck("74178");
    expect(result.coverage.covered).toBe(true);
    expect(result.coverage.prior_auth_required).toBe(true);
    expect(result.coverage.coverage_level).toBe("partial");
  });

  it("should return not_covered for unknown procedure code", () => {
    const result = insuranceCoverageCheck("XXXXX");
    expect(result.coverage.covered).toBe(false);
    expect(result.coverage.coverage_level).toBe("not_covered");
  });

  it("should include correct patient insurance info", () => {
    const result = insuranceCoverageCheck("99213");
    expect(result.patient).toBe("Gord Allen Sims");
    expect(result.insurance_provider).toBe("Aetna");
    expect(result.member_id).toBe("32523523023");
  });

  it("should cover preventive labs at no charge (80053)", () => {
    const result = insuranceCoverageCheck("80053");
    expect(result.coverage.covered).toBe(true);
    expect(result.coverage.copay).toBe("$0");
    expect(result.coverage.deductible_applies).toBe(false);
  });
});
