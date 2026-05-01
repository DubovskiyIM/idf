// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ContextNav from "../ContextNav.jsx";

afterEach(cleanup);

describe("ContextNav", () => {
  it("рендерит 4 tabs (Catalogs / Jobs / Data Compliance / Access)", () => {
    render(<ContextNav active="catalogs" onNavigate={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /catalogs/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^jobs$/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /data compliance/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /access/i })).toBeTruthy();
  });

  it("active tab имеет aria-current=page", () => {
    render(<ContextNav active="catalogs" onNavigate={vi.fn()} />);
    const cat = screen.getByRole("tab", { name: /catalogs/i });
    const jobs = screen.getByRole("tab", { name: /^jobs$/i });
    expect(cat.getAttribute("aria-current")).toBe("page");
    expect(jobs.getAttribute("aria-current")).toBeNull();
  });

  it("click по Jobs вызывает onNavigate(jobs_hub)", () => {
    const onNavigate = vi.fn();
    render(<ContextNav active="catalogs" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("tab", { name: /^jobs$/i }));
    expect(onNavigate).toHaveBeenCalledWith("jobs_hub");
  });

  it("click Data Compliance → onNavigate(compliance_hub)", () => {
    const onNavigate = vi.fn();
    render(<ContextNav active="catalogs" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("tab", { name: /data compliance/i }));
    expect(onNavigate).toHaveBeenCalledWith("compliance_hub");
  });

  it("click Access → onNavigate(access_hub)", () => {
    const onNavigate = vi.fn();
    render(<ContextNav active="catalogs" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("tab", { name: /access/i }));
    expect(onNavigate).toHaveBeenCalledWith("access_hub");
  });

  it("click по active tab НЕ вызывает onNavigate", () => {
    const onNavigate = vi.fn();
    render(<ContextNav active="catalogs" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("tab", { name: /catalogs/i }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
