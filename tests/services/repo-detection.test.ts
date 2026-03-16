import { describe, it, expect } from "vitest";
import { detectRepos, stripHtml, type RepoConfig } from "../../src/services/planning/repo-detection.js";

const REPOS: Record<string, RepoConfig> = {
  backend: { path: "/projects/backend" },
  frontend: { path: "/projects/frontend" },
  "shared-lib": { path: "/projects/shared-lib" },
};

describe("stripHtml", () => {
  it("converts <br> to newlines", () => {
    expect(stripHtml("line1<br>line2<br/>line3")).toBe("line1\nline2\nline3");
  });

  it("converts closing block tags to newlines", () => {
    expect(stripHtml("<p>hello</p><p>world</p>")).toBe("hello\nworld\n");
  });

  it("strips remaining tags", () => {
    expect(stripHtml("<b>bold</b> and <em>italic</em>")).toBe("bold and italic");
  });

  it("decodes common entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#39;")).toBe("& < > \" '");
    expect(stripHtml("&nbsp;")).toBe(" ");
  });
});

describe("detectRepos", () => {
  it("returns empty when no repos configured", () => {
    const result = detectRepos({}, "backend mentioned", undefined, "/somewhere");
    expect(result).toEqual([]);
  });

  it("returns empty when no repos mentioned in text", () => {
    const result = detectRepos(REPOS, "nothing relevant here", undefined, "/somewhere");
    expect(result).toEqual([]);
  });

  it("detects repos from structured list in description", () => {
    const desc = "Changes needed:\n- backend: Add auth middleware\n- frontend: Add login page";
    const result = detectRepos(REPOS, desc, undefined, "/somewhere");
    expect(result).toHaveLength(2);
    const be = result.find((r) => r.repoName === "backend")!;
    expect(be.features).toEqual(["Add auth middleware"]);
    const fe = result.find((r) => r.repoName === "frontend")!;
    expect(fe.features).toEqual(["Add login page"]);
  });

  it("detects repos from bold markdown format", () => {
    const desc = "- **backend**: Implement JWT validation\n- **frontend**: Show error toast";
    const result = detectRepos(REPOS, desc, undefined, "/somewhere");
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.repoName === "backend")!.features).toEqual([
      "Implement JWT validation",
    ]);
    expect(result.find((r) => r.repoName === "frontend")!.features).toEqual([
      "Show error toast",
    ]);
  });

  it("detects freeform mentions with no features extracted", () => {
    const desc = "We need to update the backend service to handle this case.";
    const result = detectRepos(REPOS, desc, undefined, "/somewhere");
    expect(result).toHaveLength(1);
    expect(result[0].repoName).toBe("backend");
    expect(result[0].features).toEqual([]);
  });

  it("searches both description and latestComment", () => {
    const result = detectRepos(REPOS, "update backend", "also fix frontend", "/somewhere");
    expect(result).toHaveLength(2);
    const names = result.map((r) => r.repoName);
    expect(names).toContain("backend");
    expect(names).toContain("frontend");
  });

  it("marks current repo correctly based on cwd", () => {
    const result = detectRepos(REPOS, "backend and frontend changes", undefined, "/projects/backend");
    const be = result.find((r) => r.repoName === "backend")!;
    const fe = result.find((r) => r.repoName === "frontend")!;
    expect(be.isCurrentRepo).toBe(true);
    expect(fe.isCurrentRepo).toBe(false);
  });

  it("sorts current repo first", () => {
    const result = detectRepos(REPOS, "frontend and backend changes", undefined, "/projects/backend");
    expect(result[0].repoName).toBe("backend");
    expect(result[0].isCurrentRepo).toBe(true);
  });

  it("handles HTML content in description", () => {
    const desc = "<p>Changes needed:</p><ul><li>- backend: Add auth</li><li>- frontend: Add page</li></ul>";
    const result = detectRepos(REPOS, desc, undefined, "/somewhere");
    expect(result).toHaveLength(2);
  });

  it("collects multiple features for same repo", () => {
    const desc = "- backend: Add auth middleware\n- backend: Add rate limiting\n- backend: Add logging";
    const result = detectRepos(REPOS, desc, undefined, "/somewhere");
    expect(result).toHaveLength(1);
    expect(result[0].features).toEqual(["Add auth middleware", "Add rate limiting", "Add logging"]);
  });

  it("handles repo names with hyphens", () => {
    const desc = "- shared-lib: Add new types\n- backend: Use new types";
    const result = detectRepos(REPOS, desc, undefined, "/somewhere");
    expect(result).toHaveLength(2);
    const sl = result.find((r) => r.repoName === "shared-lib")!;
    expect(sl.features).toEqual(["Add new types"]);
  });

  it("handles undefined description and latestComment", () => {
    const result = detectRepos(REPOS, undefined, undefined, "/somewhere");
    expect(result).toEqual([]);
  });

  it("cwd inside a subdirectory of a repo still counts as current", () => {
    const result = detectRepos(
      REPOS,
      "backend changes needed",
      undefined,
      "/projects/backend/src/controllers",
    );
    expect(result[0].isCurrentRepo).toBe(true);
  });

  it("cwd not inside any repo marks all as not current", () => {
    const result = detectRepos(REPOS, "backend and frontend", undefined, "/other/directory");
    expect(result.every((r) => !r.isCurrentRepo)).toBe(true);
  });
});
