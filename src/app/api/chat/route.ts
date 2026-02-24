import { streamText, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { fetchPatientData } from "@/lib/fhir/fetch-patient";
import {
  drugInteractionCheck,
  symptomLookup,
  providerSearch,
  appointmentAvailability,
  insuranceCoverageCheck,
} from "@/lib/clinical-tools";

export async function POST(req: Request) {
  const { messages, patientId } = await req.json();

  const { patientInfo, visitNotes } = await fetchPatientData(patientId ?? "demo");

  const result = streamText({
    model: openai("gpt-4o"),
    system: buildSystemPrompt(patientInfo, visitNotes),
    messages,
    temperature: 0.3,
    stopWhen: stepCountIs(3),
    tools: {
      drug_interaction_check: tool({
        description:
          "Check for drug-drug interactions and allergy conflicts for a list of medications. Use this when the user asks about drug interactions, medication safety, or whether medications can be taken together.",
        inputSchema: z.object({
          medications: z
            .array(z.string())
            .describe("List of medication names to check for interactions"),
        }),
        execute: async ({ medications }) => drugInteractionCheck(medications),
      }),

      symptom_lookup: tool({
        description:
          "Look up possible conditions based on patient symptoms, considering the current patient's medical history. Use this when the user describes symptoms or asks what could be causing certain symptoms.",
        inputSchema: z.object({
          symptoms: z
            .array(z.string())
            .describe("List of symptoms to analyze"),
        }),
        execute: async ({ symptoms }) => symptomLookup(symptoms),
      }),

      provider_search: tool({
        description:
          "Search for healthcare providers by specialty or role. Use this when the user asks about available doctors, nurses, or staff, or needs a referral to a specialist.",
        inputSchema: z.object({
          specialty: z
            .string()
            .describe("The specialty or role to search for (e.g. Cardiology, Pulmonology, nurse)"),
          location: z
            .string()
            .optional()
            .describe("Optional location filter"),
        }),
        execute: async ({ specialty, location }) => providerSearch(specialty, location),
      }),

      appointment_availability: tool({
        description:
          "Check available appointment slots for a specific provider within a date range. Use this when the user asks about scheduling, availability, or booking an appointment.",
        inputSchema: z.object({
          provider_name: z
            .string()
            .describe("Name of the provider (e.g. Dr. Patel, Kim)"),
          start_date: z
            .string()
            .describe("Start date in YYYY-MM-DD format"),
          end_date: z
            .string()
            .describe("End date in YYYY-MM-DD format"),
        }),
        execute: async ({ provider_name, start_date, end_date }) =>
          appointmentAvailability(provider_name, start_date, end_date),
      }),

      insurance_coverage_check: tool({
        description:
          "Check insurance coverage for a specific medical procedure using CPT/HCPCS codes. Use this when the user asks about insurance coverage, copays, prior authorization, or whether a procedure is covered. Common codes: 99213 (office visit), 80053 (CMP lab), 93306 (echo), 74178 (CT abdomen), 43239 (endoscopy), 94010 (PFT).",
        inputSchema: z.object({
          procedure_code: z
            .string()
            .describe("CPT or HCPCS procedure code (e.g. 99213, 93306, 74178)"),
          plan_id: z
            .string()
            .optional()
            .describe("Optional insurance plan ID"),
        }),
        execute: async ({ procedure_code, plan_id }) =>
          insuranceCoverageCheck(procedure_code, plan_id),
      }),
    },
  });

  return result.toTextStreamResponse();
}
