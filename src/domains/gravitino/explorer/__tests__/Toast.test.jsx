// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast.jsx";

afterEach(cleanup);

function Trigger({ message, kind }) {
  const toast = useToast();
  return <button onClick={() => toast(message, kind)}>fire</button>;
}

describe("Toast", () => {
  it("useToast() показывает сообщение", () => {
    render(
      <ToastProvider>
        <Trigger message="Catalog created" />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("fire"));
    expect(screen.getByText("Catalog created")).toBeTruthy();
  });

  it("несколько toasts показываются стаком", () => {
    let toastFn;
    function CaptureHook() {
      toastFn = useToast();
      return null;
    }
    render(
      <ToastProvider>
        <CaptureHook />
      </ToastProvider>
    );
    act(() => { toastFn("first"); toastFn("second"); });
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
  });

  it("toast разного kind получают разный style (success/error)", () => {
    render(
      <ToastProvider>
        <Trigger message="ok" kind="success" />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("fire"));
    const t = screen.getByText("ok").closest("[role='status']");
    // jsdom нормализует hex → rgb; принимаем оба формата
    expect(t.style.borderLeftColor).toMatch(/71DD37|#71dd37|rgb\(113,\s*221,\s*55\)/i);
  });
});
