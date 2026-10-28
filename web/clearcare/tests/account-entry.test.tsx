// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { AccountEntry } from "@/components/auth/account-entry";

const action = async () => {};

afterEach(cleanup);

describe("account entry", () => {
  test("configured pages carry the return path", () => {
    render(
      <AccountEntry
        intent="sign-in"
        configured
        returnTo="/search?county=Dublin"
        action={action}
      />,
    );

    const hidden = document.querySelector(
      'input[name="returnTo"]',
    ) as HTMLInputElement | null;

    expect(hidden?.value).toBe("/search?county=Dublin");
    expect(screen.getByRole("button", { name: "Continue to Cognito" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "How ClearCare uses your details" })
        .getAttribute("href"),
    ).toBe("/privacy");
  });

  test("create account sends the visitor to the same provider page", () => {
    render(
      <AccountEntry intent="sign-up" configured returnTo="/home" action={action} />,
    );

    expect(
      screen.getByRole("button", { name: "Create an account with Cognito" }),
    ).toBeTruthy();
  });

  test("unconfigured pages explain the state and offer guest browsing", () => {
    render(
      <AccountEntry
        intent="sign-in"
        configured={false}
        returnTo="/search"
        action={action}
      />,
    );

    expect(screen.getByText("Sign-in is not available here")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue as a guest" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    // The notice has to be reachable even where sign-in is unavailable.
    expect(
      screen
        .getByRole("link", { name: "How ClearCare uses your details" })
        .getAttribute("href"),
    ).toBe("/privacy");
  });
});
