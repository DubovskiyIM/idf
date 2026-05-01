// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import JobDetailDrawer from "../JobDetailDrawer.jsx";

afterEach(cleanup);

const JOB = {
  id: "j1", jobId: "spark-etl-001", templateId: "jt_spark",
  status: "running", startTime: "2026-05-01T10:00:00Z", endTime: null,
  details: { currentTask: "stage_3", completedTasks: 3, totalTasks: 12 },
};
const TEMPLATE = { id: "jt_spark", name: "spark_etl" };

describe("JobDetailDrawer", () => {
  it("не рендерится когда visible=false", () => {
    render(<JobDetailDrawer visible={false} job={JOB} template={TEMPLATE} onClose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/spark-etl-001/)).toBeNull();
  });

  it("рендерит jobId + status + template name", () => {
    render(<JobDetailDrawer visible={true} job={JOB} template={TEMPLATE} onClose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("spark-etl-001")).toBeTruthy();
    expect(screen.getByText(/running/i)).toBeTruthy();
    expect(screen.getByText("spark_etl")).toBeTruthy();
  });

  it("running job → Cancel-кнопка видна", () => {
    render(<JobDetailDrawer visible={true} job={JOB} template={TEMPLATE} onClose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /cancel job|отменить/i })).toBeTruthy();
  });

  it("success job → Cancel-кнопка скрыта", () => {
    render(<JobDetailDrawer visible={true} job={{ ...JOB, status: "success", endTime: "2026-05-01T11:00:00Z" }} template={TEMPLATE} onClose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /cancel job|отменить/i })).toBeNull();
  });

  it("Cancel-кнопка вызывает onCancel(jobId)", () => {
    const onCancel = vi.fn();
    render(<JobDetailDrawer visible={true} job={JOB} template={TEMPLATE} onClose={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel job|отменить/i }));
    expect(onCancel).toHaveBeenCalledWith("j1");
  });

  it("показывает details JSON", () => {
    render(<JobDetailDrawer visible={true} job={JOB} template={TEMPLATE} onClose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/currentTask|stage_3/)).toBeTruthy();
  });

  it("Close-кнопка вызывает onClose", () => {
    const onClose = vi.fn();
    render(<JobDetailDrawer visible={true} job={JOB} template={TEMPLATE} onClose={onClose} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /close|закрыть|✕|×/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
