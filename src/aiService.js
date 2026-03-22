const axios = require('axios');
const { safeJsonParse, normalizeTags } = require('./utils');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

function fallbackAnalysis() {
  return {
    whatWentWrong: 'No AI provider configured',
    solution: 'Add an AI provider in bugvaulty.init() to get solutions',
    codeFix: '',
    howToAvoid: '',
    difficulty: 'Unknown',
    tags: [],
  };
}

function sanitizeAnalysis(raw) {
  const base = fallbackAnalysis();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  return {
    whatWentWrong: String(raw.whatWentWrong || base.whatWentWrong),
    solution: String(raw.solution || base.solution),
    codeFix: String(raw.codeFix || base.codeFix),
    howToAvoid: String(raw.howToAvoid || base.howToAvoid),
    difficulty: String(raw.difficulty || base.difficulty),
    tags: normalizeTags(raw.tags && Array.isArray(raw.tags) ? raw.tags : base.tags),
  };
}

function extractJsonFromText(message) {
  if (typeof message !== 'string') {
    return null;
  }

  const fenced = message.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }

  const firstBrace = message.indexOf('{');
  const lastBrace = message.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return message.slice(firstBrace, lastBrace + 1);
  }

  return message;
}

function buildPrompt(errorData) {
  return [
    'Analyze this JavaScript/Node/React error and return JSON only.',
    'Required keys: whatWentWrong, solution, codeFix, howToAvoid, difficulty, tags.',
    'difficulty must be Beginner, Intermediate, or Advanced.',
    'tags must be an array of short strings.',
    '',
    JSON.stringify(errorData, null, 2),
  ].join('\n');
}

async function analyzeWithGroq(errorData, apiKey) {
  const response = await axios.post(
    GROQ_API_URL,
    {
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert debugger. Always return valid JSON only with the exact requested keys.',
        },
        {
          role: 'user',
          content: buildPrompt(errorData),
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return (
    response &&
    response.data &&
    response.data.choices &&
    response.data.choices[0] &&
    response.data.choices[0].message &&
    response.data.choices[0].message.content
  );
}

async function analyzeWithOpenAI(errorData, apiKey) {
  const response = await axios.post(
    OPENAI_API_URL,
    {
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert debugger. Always return valid JSON only with the exact requested keys.',
        },
        {
          role: 'user',
          content: buildPrompt(errorData),
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return (
    response &&
    response.data &&
    response.data.choices &&
    response.data.choices[0] &&
    response.data.choices[0].message &&
    response.data.choices[0].message.content
  );
}

async function analyzeWithClaude(errorData, apiKey) {
  const response = await axios.post(
    CLAUDE_API_URL,
    {
      model: CLAUDE_MODEL,
      max_tokens: 700,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: buildPrompt(errorData),
        },
      ],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const content = response && response.data && response.data.content;
  if (Array.isArray(content) && content[0] && content[0].text) {
    return content[0].text;
  }

  return null;
}

async function analyzeError(errorData, aiConfig) {
  if (!aiConfig || !aiConfig.provider || !aiConfig.apiKey) {
    return fallbackAnalysis();
  }

  const provider = String(aiConfig.provider).toLowerCase();
  const apiKey = String(aiConfig.apiKey);

  if (provider !== 'groq' && provider !== 'openai' && provider !== 'claude') {
    return fallbackAnalysis();
  }

  try {
    let content = null;

    if (provider === 'groq') {
      content = await analyzeWithGroq(errorData, apiKey);
    } else if (provider === 'openai') {
      content = await analyzeWithOpenAI(errorData, apiKey);
    } else if (provider === 'claude') {
      content = await analyzeWithClaude(errorData, apiKey);
    }

    const jsonText = extractJsonFromText(content || '');
    const parsed = safeJsonParse(jsonText, null);

    if (!parsed) {
      console.warn('[BugVaulty] AI analysis failed, saving without solution.');
      return fallbackAnalysis();
    }

    return sanitizeAnalysis(parsed);
  } catch (err) {
    console.warn('[BugVaulty] AI analysis failed, saving without solution.');
    return fallbackAnalysis();
  }
}

module.exports = {
  analyzeError,
};
