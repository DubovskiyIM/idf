// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import TopicDetailPane from "../TopicDetailPane.jsx";

afterEach(cleanup);

const TOPIC = {
  id: "t1", name: "orders", comment: "Order events",
  properties: { "retention.ms": "604800000", partitions: "12", "cleanup.policy": "delete" },
};

describe("TopicDetailPane", () => {
  it("header показывает name + comment", () => {
    render(<TopicDetailPane topic={TOPIC} />);
    expect(screen.getAllByText("orders").length).toBeGreaterThan(0);
    expect(screen.getByText("Order events")).toBeTruthy();
  });

  it("Properties секция показывает все key-value", () => {
    render(<TopicDetailPane topic={TOPIC} />);
    expect(screen.getByText("retention.ms")).toBeTruthy();
    expect(screen.getByText("604800000")).toBeTruthy();
    expect(screen.getByText("partitions")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });
});
