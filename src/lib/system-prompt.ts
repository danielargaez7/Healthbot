import { STAFF } from "./patient-data";
import type { MedAssistPatientData, MedAssistVisitNote } from "./fhir/types";

export function buildSystemPrompt(patientInfo: MedAssistPatientData, visitNotes: MedAssistVisitNote[]): string {
  const p = patientInfo;

  const personal = Object.entries(p.personal)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const insurance = Object.entries(p.insurance)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const meds = p.medications
    .map((m) => `  - ${m.name} ${m.dose} ${m.freq} (${m.purpose}) [${m.type}]`)
    .join("\n");

  const allergies = p.allergies
    .map((a) => `  - ${a.allergen} (${a.type}): ${a.reaction} — Severity: ${a.severity}`)
    .join("\n");

  const social = Object.entries(p.social)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const mental = [
    `  PHQ-9: ${p.mentalHealth.phq9.score} — ${p.mentalHealth.phq9.label} (${p.mentalHealth.phq9.date})`,
    `  GAD-7: ${p.mentalHealth.gad7.score} — ${p.mentalHealth.gad7.label} (${p.mentalHealth.gad7.date})`,
    `  Sleep: ${p.mentalHealth.sleep}`,
    `  Stress: ${p.mentalHealth.stress}`,
  ].join("\n");

  const reason = Object.entries(p.reasonForVisit)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const pastDx = p.medicalHistory.pastDiagnoses
    .map((d) => `  - ${d.condition} (${d.year}) — ${d.status}`)
    .join("\n");

  const surgeries = p.medicalHistory.surgeries
    .map((s) => `  - ${s.procedure} (${s.year}) — ${s.notes}`)
    .join("\n");

  const hospitalizations = p.medicalHistory.hospitalizations
    .map((h) => `  - ${h.reason} (${h.date}) at ${h.facility}`)
    .join("\n");

  const chronic = p.medicalHistory.chronic
    .map((c) => `  - ${c}`)
    .join("\n");

  const family = p.medicalHistory.familyHistory
    .map((f) => `  - ${f.relation}: ${f.conditions}`)
    .join("\n");

  const consent = p.consent
    .map((c) => `  - ${c.form}: ${c.status} (${c.date})`)
    .join("\n");

  const payment = Object.entries(p.payment)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const notes = visitNotes.map(
    (n) =>
      `--- Visit: ${n.date} | ${n.type} | Provider: ${n.provider} ---\nChief Complaint: ${n.chief}\nSummary: ${n.summary}\nActions: ${n.actions.join("; ")}\nTags: ${n.tags.join(", ")}`
  ).join("\n\n");

  const staff = [
    "Doctors:",
    ...STAFF.doctors.map((d) => `  - ${d.name}, ${d.title} (${d.specialty})`),
    "Nurses:",
    ...STAFF.nurses.map((n) => `  - ${n.name}, ${n.title} (${n.specialty})`),
    "Receptionists:",
    ...STAFF.receptionists.map((r) => `  - ${r.name}, ${r.title} (${r.specialty})`),
  ].join("\n");

  return `You are MedAssist AI, a clinical decision support assistant for healthcare providers. You have access to the complete medical record of the current patient. Answer questions using clinical terminology appropriate for a medical professional audience.

RULES:
- Always cite specific dates, values, and data points from the record when relevant.
- Never fabricate or infer data that is not present in the record.
- If information is not in the record, say so clearly.
- Flag any clinical concerns or abnormal values proactively.
- Be concise but thorough. Use bullet points for clarity when appropriate.
- You are assisting a clinician — assume medical literacy.

═══ PATIENT DEMOGRAPHICS ═══
${personal}

═══ INSURANCE & BILLING ═══
${insurance}

═══ REASON FOR VISIT ═══
${reason}

═══ ACTIVE MEDICATIONS ═══
${meds}

═══ ALLERGIES ═══
${allergies}

═══ MEDICAL HISTORY ═══
Past Diagnoses:
${pastDx}

Surgeries:
${surgeries}

Hospitalizations:
${hospitalizations}

Chronic Conditions:
${chronic}

Family History:
${family}

═══ SOCIAL HISTORY ═══
${social}

═══ MENTAL HEALTH ═══
${mental}

═══ CONSENT FORMS ═══
${consent}

═══ PAYMENT ═══
${payment}

═══ STAFF DIRECTORY ═══
${staff}

═══ VISIT NOTES (${visitNotes.length} entries) ═══
${notes}`;
}
