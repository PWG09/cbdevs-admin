import { describe, expect, it } from "vitest";
import { email, longText, money, oneOf, optionalDate, optionalHttpsUrl, optionalPhone, positiveMoney, requiredHttpsUrl, text, DELIVERY_STATUSES } from "@/lib/validation";
import { toAppError } from "@/lib/errors";

describe("validation", () => {
  it("normalizes and bounds text", () => {
    expect(text("  Hola   mundo ", "El nombre", { required: true })).toBe("Hola mundo");
    expect(() => text("  ", "El nombre", { required: true })).toThrow("El nombre es obligatorio.");
    expect(() => text("x".repeat(201), "El nombre")).toThrow(/como máximo 200/);
    expect(() => text("a", "El nombre", { min: 2 })).toThrow(/al menos 2/);
    expect(longText("a\r\nb", "Notas")).toBe("a\nb");
  });

  it("validates emails and phones", () => {
    expect(email("  Ana@Ejemplo.MX ")).toBe("ana@ejemplo.mx");
    expect(() => email("no-es-correo")).toThrow(/no es válido/);
    expect(optionalPhone("")).toBeNull();
    expect(optionalPhone("+52 55 1234 5678")).toBe("+52 55 1234 5678");
    expect(() => optionalPhone("abc")).toThrow(/teléfono/);
  });

  it("validates money", () => {
    expect(money("1,500.555", "Monto")).toBe(1500.56);
    expect(() => money(-1, "Monto")).toThrow(/mayor o igual a 0/);
    expect(() => money("abc", "Monto")).toThrow();
    expect(() => positiveMoney(0, "Monto")).toThrow(/mayor a 0/);
  });

  it("only accepts known options", () => {
    expect(oneOf("Entregado", DELIVERY_STATUSES, "Estado")).toBe("Entregado");
    expect(() => oneOf("Hackeado", DELIVERY_STATUSES, "Estado")).toThrow(/no es válido/);
  });

  it("validates dates", () => {
    expect(optionalDate("", "Fecha")).toBeNull();
    expect(optionalDate("2026-11-02", "Fecha")).toBe("2026-11-02");
    expect(() => optionalDate("02/11/2026", "Fecha")).toThrow(/fecha válida/);
  });

  it("only allows clean https links (what the portal will render)", () => {
    expect(optionalHttpsUrl("", "Enlace")).toBeNull();
    expect(optionalHttpsUrl("https://drive.google.com/x", "Enlace")).toBe("https://drive.google.com/x");
    expect(() => optionalHttpsUrl("http://inseguro.com", "Enlace")).toThrow(/https/);
    expect(() => optionalHttpsUrl("javascript:alert(1)", "Enlace")).toThrow(/https/);
    expect(() => optionalHttpsUrl("https://user:pw@x.com", "Enlace")).toThrow(/https/);
    expect(() => requiredHttpsUrl("", "Enlace")).toThrow(/obligatorio/);
  });
});

describe("errors", () => {
  it("translates database codes without leaking internals", () => {
    const e = toAppError({ code: "23505", message: 'duplicate key value violates unique constraint "cbdevs_clients_organization_id_email_key"' }, "x", { "23505": "Ya existe un cliente con ese correo." });
    expect(e.message).toBe("Ya existe un cliente con ese correo.");
    expect(toAppError({ code: "42501" }, "x").message).toMatch(/permiso/);
    expect(toAppError(null, "Fallback").message).toBe("Fallback");
  });
});
