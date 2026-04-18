import { describe, it, expect } from "vitest";
const { sluggify, transliterate } = require("./sluggify.js");

describe("transliterate", () => {
  it("кириллица → латиница", () => {
    expect(transliterate("Доставка еды")).toBe("dostavka edy");
    expect(transliterate("Запись к врачу")).toBe("zapis k vrachu");
  });
  it("пустая строка", () => {
    expect(transliterate("")).toBe("");
  });
  it("латиница без изменений", () => {
    expect(transliterate("food delivery")).toBe("food delivery");
  });
});

describe("sluggify", () => {
  it("русское описание → latin slug из первых 2 значимых слов", () => {
    const { slug } = sluggify("Приложение для доставки еды");
    expect(slug).toBe("prilozhenie_dostavki");
  });

  it("игнорирует stop-words (и, для, на)", () => {
    const { slug } = sluggify("Запись на приём к врачу");
    expect(slug).toBe("zapis_priem");
  });

  it("slice до 24 символов", () => {
    const { slug } = sluggify("Очень длинное название которое не помещается");
    expect(slug.length).toBeLessThanOrEqual(24);
  });

  it("не начинается с цифры", () => {
    const { slug } = sluggify("123 test");
    expect(slug).toMatch(/^[a-z]/);
  });

  it("пустое описание → fallback slug", () => {
    const { slug, name } = sluggify("");
    expect(slug).toMatch(/^domain_/);
    expect(name).toBe("Новый домен");
  });

  it("name — человекочитаемое сокращение (первые 3 слова оригинала)", () => {
    const { name } = sluggify("Приложение для доставки еды");
    expect(name).toMatch(/доставки/i);
  });

  it("existsCheck добавляет суффикс при коллизии", () => {
    const taken = new Set(["food_delivery", "food_delivery_2"]);
    const { slug } = sluggify("Food delivery", { existsCheck: (s) => taken.has(s) });
    expect(slug).toBe("food_delivery_3");
  });

  it("английское описание без транслитерации", () => {
    const { slug } = sluggify("Pet care for dogs");
    expect(slug).toBe("pet_care");
  });
});
