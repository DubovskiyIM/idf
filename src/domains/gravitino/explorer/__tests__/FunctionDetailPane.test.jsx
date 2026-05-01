// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import FunctionDetailPane from "../FunctionDetailPane.jsx";

afterEach(cleanup);

const FN = {
  id: "fn1", name: "revenue_split", comment: "Revenue UDF",
  functionBody: "CREATE FUNCTION revenue_split(amount DECIMAL) RETURNS DECIMAL",
  properties: { language: "Java", deterministic: "true" },
  schemaId: "s1",
};

describe("FunctionDetailPane", () => {
  it("header показывает name + comment", () => {
    render(<FunctionDetailPane function={FN} />);
    expect(screen.getAllByText("revenue_split").length).toBeGreaterThan(0);
    expect(screen.getByText("Revenue UDF")).toBeTruthy();
  });

  it("показывает functionBody в моноширинном блоке", () => {
    render(<FunctionDetailPane function={FN} />);
    expect(screen.getByText(/CREATE FUNCTION revenue_split/)).toBeTruthy();
  });

  it("показывает properties (key-value)", () => {
    render(<FunctionDetailPane function={FN} />);
    expect(screen.getByText("language")).toBeTruthy();
    expect(screen.getByText("Java")).toBeTruthy();
    expect(screen.getByText("deterministic")).toBeTruthy();
  });

  it("function без functionBody → показывает 'Тело функции не указано'", () => {
    render(<FunctionDetailPane function={{ id: "fn0", name: "noop", properties: {} }} />);
    expect(screen.getByText(/тело.*не указано|no body/i)).toBeTruthy();
  });
});
