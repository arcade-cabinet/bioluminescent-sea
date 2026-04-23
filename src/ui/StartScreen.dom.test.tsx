import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { StartScreen } from "@/ui/shell/StartScreen";

afterEach(cleanup);

describe("StartScreen", () => {
  test("renders title, subtitle, verb chips, and CTA", () => {
    render(
      <StartScreen
        title="Bioluminescent Sea"
        subtitle="Sink into an abyssal trench."
        primaryAction={{ label: "Begin Dive", onClick: () => {} }}
      />
    );
    expect(screen.getByRole("heading", { name: /bioluminescent sea/i })).toBeTruthy();
    expect(screen.getByText(/sink into an abyssal trench/i)).toBeTruthy();
    expect(screen.getByText(/collect bioluminescence/i)).toBeTruthy();
    expect(screen.getByText(/read the bottom banner/i)).toBeTruthy();
    expect(screen.getByText(/surface before oxygen ends/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /begin dive/i })).toBeTruthy();
  });
});
