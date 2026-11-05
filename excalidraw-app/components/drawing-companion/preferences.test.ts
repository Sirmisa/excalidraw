import { STORAGE_KEYS } from "../../app_constants";

import {
  readCompanionPreferences,
  writeCompanionPreferences,
} from "./preferences";

const key = STORAGE_KEYS.LOCAL_STORAGE_DRAWING_COMPANION;

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it.each([
  undefined,
  "{",
  "null",
  "[]",
  "true",
  "42",
  '"hi"',
  '{"version":99,"enabled":false}',
])("defaults_when_missing_or_invalid: %s", (stored) => {
  if (stored !== undefined) {
    localStorage.setItem(key, stored);
  }
  expect(readCompanionPreferences(window)).toEqual({
    enabled: true,
    tipsEnabled: true,
  });
});

it("validates_fields_individually", () => {
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, enabled: false, tipsEnabled: "false" }),
  );
  expect(readCompanionPreferences(window)).toEqual({
    enabled: false,
    tipsEnabled: true,
  });
  writeCompanionPreferences(window, { enabled: true, tipsEnabled: false });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
    version: 1,
    enabled: true,
    tipsEnabled: false,
  });
});

it("survives_storage_getter_and_write_errors", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(readCompanionPreferences(window)).toEqual({
    enabled: true,
    tipsEnabled: true,
  });
  expect(() =>
    writeCompanionPreferences(window, { enabled: false, tipsEnabled: false }),
  ).not.toThrow();
});
