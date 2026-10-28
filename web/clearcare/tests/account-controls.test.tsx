// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AccountControlsView } from "@/components/auth/account-controls-view";

// The header sits on every page and has to know which page it is on.
vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams("county=Dublin&page=2"),
}));

const signOut = async () => {};

afterEach(cleanup);

describe("signed out", () => {
  test("offers log in and create account", () => {
    render(
      <AccountControlsView email={null} configured signOutAction={signOut} />,
    );

    expect(screen.getByRole("link", { name: "Log in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create account" })).toBeTruthy();
  });

  test("links carry the page the visitor is on", () => {
    render(
      <AccountControlsView email={null} configured signOutAction={signOut} />,
    );

    const returnTo = encodeURIComponent("/search?county=Dublin&page=2");
    expect(
      screen.getByRole("link", { name: "Log in" }).getAttribute("href"),
    ).toBe(`/login?returnTo=${returnTo}`);
    expect(
      screen.getByRole("link", { name: "Create account" }).getAttribute("href"),
    ).toBe(`/sign-up?returnTo=${returnTo}`);
  });
});

describe("signed in", () => {
  test("shows the address and a log out control", () => {
    render(
      <AccountControlsView
        email="sawin@example.com"
        configured
        signOutAction={signOut}
      />,
    );

    expect(screen.getByText("sawin@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });
});

describe("unconfigured", () => {
  test("renders no controls at all", () => {
    const { container } = render(
      <AccountControlsView
        email={null}
        configured={false}
        signOutAction={signOut}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});
