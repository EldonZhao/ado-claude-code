import type { TsgOutput } from "../../schemas/tsg.schema.js";
import type { TsgStorage } from "../../storage/tsg.js";
import { logger } from "../../utils/logger.js";

export interface TsgSearchQuery {
  text?: string;
  symptoms?: string[];
  tags?: string[];
  category?: string;
}

export interface TsgSearchResult {
  tsg: TsgOutput;
  score: number;
  matchedOn: string[];
}

export class TsgService {
  constructor(private storage: TsgStorage) {}

  async search(query: TsgSearchQuery): Promise<TsgSearchResult[]> {
    const all = await this.storage.listAll();
    const results: TsgSearchResult[] = [];

    for (const tsg of all) {
      const { score, matchedOn } = this.computeScore(tsg, query);
      if (score > 0) {
        results.push({ tsg, score, matchedOn });
      }
    }

    results.sort((a, b) => b.score - a.score);
    logger.debug({ query, resultCount: results.length }, "TSG search completed");
    return results;
  }

  private computeScore(
    tsg: TsgOutput,
    query: TsgSearchQuery,
  ): { score: number; matchedOn: string[] } {
    let score = 0;
    const matchedOn: string[] = [];

    // Category filter (exact match, mandatory if specified)
    if (query.category && tsg.category !== query.category) {
      return { score: 0, matchedOn: [] };
    }

    // Tag matching
    if (query.tags && query.tags.length > 0) {
      const tsgTagsLower = tsg.tags.map((t) => t.toLowerCase());
      for (const tag of query.tags) {
        if (tsgTagsLower.includes(tag.toLowerCase())) {
          score += 10;
          matchedOn.push(`tag:${tag}`);
        }
      }
    }

    // Symptom matching (fuzzy keyword containment)
    if (query.symptoms && query.symptoms.length > 0) {
      for (const symptom of query.symptoms) {
        const symptomLower = symptom.toLowerCase();

        // Match against TSG symptoms
        for (const tsgSymptom of tsg.symptoms) {
          if (
            tsgSymptom.toLowerCase().includes(symptomLower) ||
            symptomLower.includes(tsgSymptom.toLowerCase())
          ) {
            score += 15;
            matchedOn.push(`symptom:${tsgSymptom}`);
          }
        }

        // Match against related errors
        for (const err of tsg.relatedErrors) {
          if (
            err.toLowerCase().includes(symptomLower) ||
            symptomLower.includes(err.toLowerCase())
          ) {
            score += 12;
            matchedOn.push(`error:${err}`);
          }
        }
      }
    }

    // Free-text matching against title, symptoms, tags, errors
    if (query.text) {
      const textLower = query.text.toLowerCase();
      const words = textLower.split(/\s+/).filter((w) => w.length > 2);

      // Title match (high weight)
      if (tsg.title.toLowerCase().includes(textLower)) {
        score += 20;
        matchedOn.push("title");
      } else {
        for (const word of words) {
          if (tsg.title.toLowerCase().includes(word)) {
            score += 5;
            matchedOn.push(`title-word:${word}`);
          }
        }
      }

      // Symptom text match
      for (const symptom of tsg.symptoms) {
        for (const word of words) {
          if (symptom.toLowerCase().includes(word)) {
            score += 3;
            matchedOn.push(`symptom-word:${word}`);
            break;
          }
        }
      }

      // Tag text match
      for (const tag of tsg.tags) {
        if (textLower.includes(tag.toLowerCase())) {
          score += 5;
          matchedOn.push(`tag-text:${tag}`);
        }
      }

      // Related error text match
      for (const err of tsg.relatedErrors) {
        for (const word of words) {
          if (err.toLowerCase().includes(word)) {
            score += 4;
            matchedOn.push(`error-word:${word}`);
            break;
          }
        }
      }
    }

    // Deduplicate matchedOn
    return { score, matchedOn: [...new Set(matchedOn)] };
  }
}
