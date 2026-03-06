import { describe, it, expect } from "vitest";
import {
  getTsgTemplate,
  getTemplateCategories,
  TSG_TEMPLATES,
} from "../../src/services/tsg/templates.js";

describe("getTemplateCategories", () => {
  it("returns all five built-in categories", () => {
    const cats = getTemplateCategories();
    expect(cats).toContain("deployment");
    expect(cats).toContain("database");
    expect(cats).toContain("networking");
    expect(cats).toContain("authentication");
    expect(cats).toContain("performance");
    expect(cats).toHaveLength(5);
  });
});

describe("getTsgTemplate", () => {
  it("returns a template for a known category", () => {
    const t = getTsgTemplate("deployment");
    expect(t).toBeDefined();
    expect(t!.tags).toContain("deployment");
    expect(t!.symptoms!.length).toBeGreaterThan(0);
  });

  it("returns undefined for an unknown category", () => {
    expect(getTsgTemplate("nonexistent")).toBeUndefined();
  });
});

describe("template structure", () => {
  const categories = getTemplateCategories();

  for (const cat of categories) {
    describe(`${cat} template`, () => {
      const template = TSG_TEMPLATES[cat];

      it("has tags", () => {
        expect(template.tags).toBeDefined();
        expect(template.tags!.length).toBeGreaterThan(0);
      });

      it("has symptoms", () => {
        expect(template.symptoms).toBeDefined();
        expect(template.symptoms!.length).toBeGreaterThan(0);
      });

      it("has relatedErrors", () => {
        expect(template.relatedErrors).toBeDefined();
        expect(template.relatedErrors!.length).toBeGreaterThan(0);
      });

      it("has diagnostics with at least one step", () => {
        expect(template.diagnostics).toBeDefined();
        expect(template.diagnostics!.length).toBeGreaterThan(0);
      });

      it("has escalation with contacts", () => {
        expect(template.escalation).toBeDefined();
        expect(template.escalation!.contacts).toBeDefined();
        expect(template.escalation!.contacts!.length).toBeGreaterThan(0);
      });

      it("each diagnostic step has an id and name", () => {
        for (const step of template.diagnostics!) {
          expect(step.id).toBeTruthy();
          expect(step.name).toBeTruthy();
        }
      });

      it("each diagnostic step with a command has parameters", () => {
        for (const step of template.diagnostics!) {
          if (step.command) {
            expect(step.command.template).toBeTruthy();
            expect(step.command.parameters).toBeDefined();
            expect(step.command.parameters!.length).toBeGreaterThan(0);
          }
        }
      });
    });
  }
});
