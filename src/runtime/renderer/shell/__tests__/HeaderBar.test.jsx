// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import HeaderBar from "../HeaderBar.jsx";

afterEach(() => cleanup());

describe("HeaderBar", () => {
  const baseProps = {
    viewer: { name: "Ignat", email: "qwor50@gmail.com" },
    onLogout: vi.fn(),
    activeRole: null,
    roleOptions: [],
    onSwitchRole: vi.fn(),
    currentKit: null,
    onChangeKit: vi.fn(),
    prefs: { density: "comfortable", fontSize: "md", iconMode: "lucide", patternInspector: false, uiKit: null },
    setPref: vi.fn(),
    resetPrefs: vi.fn(),
  };

  it("показывает имя и email пользователя", () => {
    render(<HeaderBar {...baseProps} />);
    expect(screen.getByText("Ignat")).toBeInTheDocument();
    expect(screen.getByText("qwor50@gmail.com")).toBeInTheDocument();
  });

  it("кнопка Выйти вызывает onLogout", () => {
    render(<HeaderBar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /выйти/i }));
    expect(baseProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it("⚙ открывает popover с секцией 'Слой'", () => {
    render(<HeaderBar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /настройки|settings|⚙/i }));
    expect(screen.getByText(/слой/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mantine/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /antd/i })).toBeInTheDocument();
  });

  it("выбор адаптера в popover вызывает onChangeKit", () => {
    render(<HeaderBar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /настройки|settings|⚙/i }));
    fireEvent.click(screen.getByRole("button", { name: /antd/i }));
    expect(baseProps.onChangeKit).toHaveBeenCalledWith("antd");
  });

  it("не рендерит role-switcher когда roleOptions пуст", () => {
    render(<HeaderBar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /настройки|settings|⚙/i }));
    expect(screen.queryByText(/роль:/i)).toBeNull();
  });

  it("рендерит role-switcher когда roleOptions заполнен", () => {
    render(
      <HeaderBar
        {...baseProps}
        roleOptions={[
          { role: "admin", label: "Admin" },
          { role: "viewer", label: "Viewer" },
        ]}
        activeRole="admin"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /настройки|settings|⚙/i }));
    expect(screen.getByText(/роль:/i)).toBeInTheDocument();
  });
});
