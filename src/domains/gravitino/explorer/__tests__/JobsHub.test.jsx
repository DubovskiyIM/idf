// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import JobsHub from "../JobsHub.jsx";

afterEach(cleanup);

const TEMPLATES = [
  { id: "jt1", name: "spark_etl", description: "Spark ETL" },
  { id: "jt2", name: "shell_backup", description: "Shell" },
];
const JOBS = [
  { id: "j1", jobId: "etl-001", templateId: "jt1", status: "success", startTime: "2026-05-01T08:00:00Z", endTime: "2026-05-01T08:50:00Z", details: {} },
  { id: "j2", jobId: "etl-002", templateId: "jt1", status: "running", startTime: "2026-05-01T10:00:00Z", endTime: null, details: {} },
  { id: "j3", jobId: "backup-001", templateId: "jt2", status: "failed", startTime: "2026-05-01T09:00:00Z", endTime: "2026-05-01T09:05:00Z", details: { error: "x" } },
];

describe("JobsHub", () => {
  it("default Jobs tab — таблица всех jobs с status badges", () => {
    render(<JobsHub world={{ jobs: JOBS, job_templates: TEMPLATES }} />);
    expect(screen.getByRole("tab", { name: /^jobs$/i })).toBeTruthy();
    expect(screen.getByText("etl-001")).toBeTruthy();
    expect(screen.getByText("etl-002")).toBeTruthy();
    expect(screen.getByText("backup-001")).toBeTruthy();
    expect(screen.getByText(/success/i)).toBeTruthy();
    expect(screen.getByText(/running/i)).toBeTruthy();
    expect(screen.getByText(/failed/i)).toBeTruthy();
  });

  it("click tab Templates → таблица templates", () => {
    render(<JobsHub world={{ jobs: JOBS, job_templates: TEMPLATES }} />);
    fireEvent.click(screen.getByRole("tab", { name: /templates/i }));
    expect(screen.getByText("spark_etl")).toBeTruthy();
    expect(screen.getByText("Spark ETL")).toBeTruthy();
  });

  it("click row job → JobDetailDrawer открывается", () => {
    render(<JobsHub world={{ jobs: JOBS, job_templates: TEMPLATES }} />);
    fireEvent.click(screen.getByText("etl-001"));
    // drawer показывается
    expect(screen.getByRole("dialog", { name: /job etl-001/i })).toBeTruthy();
  });
});
