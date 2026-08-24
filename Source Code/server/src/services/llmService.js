/**
 * LLM Integration Service with Graceful Fallback Engine
 * Uses OpenAI API (or Gemini API) when API keys are available,
 * otherwise runs built-in NLP-inspired rule fallback parser.
 */

// Helper to attempt OpenAI completion if API key is provided
async function callOpenAI(prompt, systemInstruction = 'You are a professional medical AI assistant. Always output clean JSON.') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (err) {
    console.warn('[LLM Service] OpenAI call failed or returned unparseable output:', err.message);
    return null;
  }
}

/**
 * Generate Pre-Visit AI Symptom Summary
 * Prompt required by spec:
 * "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>"
 */
async function generatePreVisitSummary(symptoms) {
  const prompt = `Analyse these symptoms and return JSON with keys "urgency" ("Low" | "Medium" | "High"), "chiefComplaint" (string), and "suggestedQuestions" (array of 3 strings). Symptoms: ${symptoms}`;

  const llmResult = await callOpenAI(prompt);

  if (llmResult && llmResult.urgency && llmResult.chiefComplaint && Array.isArray(llmResult.suggestedQuestions)) {
    return {
      urgency: ['Low', 'Medium', 'High'].includes(llmResult.urgency) ? llmResult.urgency : 'Medium',
      chiefComplaint: llmResult.chiefComplaint,
      suggestedQuestions: llmResult.suggestedQuestions.slice(0, 3),
    };
  }

  // Graceful Fallback Engine (Runs reliably even without API Key or during network outage)
  return fallbackPreVisitAnalysis(symptoms);
}

function fallbackPreVisitAnalysis(symptoms) {
  const text = symptoms.toLowerCase();

  // Keyword triage for urgency determination
  let urgency = 'Low';
  const highRiskKeywords = ['chest pain', 'shortness of breath', 'severe', 'bleeding', 'fainting', 'unconscious', 'high fever', 'numbness'];
  const mediumRiskKeywords = ['persistent', 'pain', 'fever', 'cough', 'swelling', 'vomiting', 'dizziness', 'migraine', 'infection'];

  if (highRiskKeywords.some(kw => text.includes(kw))) {
    urgency = 'High';
  } else if (mediumRiskKeywords.some(kw => text.includes(kw))) {
    urgency = 'Medium';
  }

  // Extract chief complaint (first phrase or sentence)
  const cleanSymptoms = symptoms.trim();
  const chiefComplaint = cleanSymptoms.length > 80 ? cleanSymptoms.substring(0, 80) + '...' : cleanSymptoms;

  // Generate relevant questions based on urgency & text
  const questions = [
    `How long have these symptoms (${chiefComplaint.slice(0, 30)}) been presenting?`,
    `Are there any specific triggers or relief factors you've noticed?`,
    urgency === 'High' 
      ? `Do I require immediate diagnostic imaging or specialized blood work?` 
      : `What key lifestyle modifications or over-the-counter care do you recommend?`,
  ];

  return {
    urgency,
    chiefComplaint,
    suggestedQuestions: questions,
  };
}

/**
 * Generate Post-Visit AI Summary
 * Prompt required by spec:
 * "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
 */
async function generatePostVisitSummary(notes, medications = []) {
  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. Clinical Notes: ${notes}. Prescribed Medications: ${JSON.stringify(medications)}. Return JSON with keys: "summary" (string), "medicationSchedule" (array of strings), "followUpSteps" (array of strings).`;

  const llmResult = await callOpenAI(prompt);

  if (llmResult && llmResult.summary && Array.isArray(llmResult.medicationSchedule)) {
    return {
      summary: llmResult.summary,
      medicationSchedule: llmResult.medicationSchedule,
      followUpSteps: Array.isArray(llmResult.followUpSteps) ? llmResult.followUpSteps : ['Rest well and maintain proper hydration.'],
    };
  }

  // Graceful Fallback Engine
  return fallbackPostVisitAnalysis(notes, medications);
}

function fallbackPostVisitAnalysis(notes, medications) {
  const medSchedule = medications.length > 0
    ? medications.map(m => `${m.name} (${m.dosage}) - ${m.frequency || 'As directed'} for ${m.durationDays || 5} days`)
    : ['Take prescribed medications as recommended by your doctor with meals.'];

  const followUpSteps = [
    'Monitor your symptoms daily and record any notable changes.',
    'Ensure consistent hydration and get adequate rest.',
    'Follow up with DrPatho clinic if symptoms worsen or persist past 5 days.',
  ];

  return {
    summary: `Patient Summary: ${notes}. Please follow the personalized care routine outlined below to support a speedy recovery.`,
    medicationSchedule: medSchedule,
    followUpSteps,
  };
}

module.exports = {
  generatePreVisitSummary,
  generatePostVisitSummary,
};
