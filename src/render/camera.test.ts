import { describe, expect, it } from "vitest";
import { createCamera } from "./camera";

const viewport = { widthPx: 1280, heightPx: 720 };

describe("createCamera", () => {
  it("defaults scrollMeters to 0 and pxPerMeter to 1", () => {
    const cam = createCamera(viewport);
    expect(cam.scrollMeters).toBe(0);
    expect(cam.pxPerMeter).toBe(1);
  });

  it("exposes the viewport as provided", () => {
    const cam = createCamera(viewport);
    expect(cam.viewport).toEqual(viewport);
  });

  it("setViewport updates the active extents", () => {
    const cam = createCamera(viewport);
    cam.setViewport(800, 600);
    expect(cam.viewport).toEqual({ widthPx: 800, heightPx: 600 });
  });

  it("setScrollMeters updates the depth the camera follows", () => {
    const cam = createCamera(viewport);
    cam.setScrollMeters(512);
    expect(cam.scrollMeters).toBe(512);
  });
});

describe("camera.project (at surface)", () => {
  it("projects origin to viewport center", () => {
    const cam = createCamera(viewport);
    const p = cam.project({ x: 0, y: 0, z: 0 });
    expect(p.x).toBe(viewport.widthPx * 0.5);
    expect(p.y).toBe(viewport.heightPx * 0.5);
  });

  it("translates +x to the right of center", () => {
    const cam = createCamera(viewport);
    const p = cam.project({ x: 100, y: 0, z: 0 });
    expect(p.x).toBeGreaterThan(viewport.widthPx * 0.5);
  });

  it("translates +y (deeper) to below center", () => {
    const cam = createCamera(viewport);
    const p = cam.project({ x: 0, y: 100, z: 0 });
    expect(p.y).toBeGreaterThan(viewport.heightPx * 0.5);
  });

  it("near-field entities (z=0) project at world scale 1:1", () => {
    const cam = createCamera(viewport);
    const p = cam.project({ x: 0, y: 0, z: 0 });
    expect(p.scale).toBe(1);
  });

  it("far-field entities (z=1) project at a reduced scale", () => {
    const cam = createCamera(viewport);
    const p = cam.project({ x: 0, y: 0, z: 1 });
    expect(p.scale).toBeLessThan(1);
    expect(p.scale).toBeGreaterThan(0);
  });

  it("far-field entities move less per world-x than near-field", () => {
    const cam = createCamera(viewport);
    const nearRight = cam.project({ x: 100, y: 0, z: 0 }).x;
    const farRight = cam.project({ x: 100, y: 0, z: 1 }).x;
    expect(nearRight - viewport.widthPx * 0.5).toBeGreaterThan(
      farRight - viewport.widthPx * 0.5,
    );
  });
});

describe("camera.project (scrolling)", () => {
  it("a world-y at scrollMeters projects to viewport center", () => {
    const cam = createCamera(viewport);
    cam.setScrollMeters(1000);
    const p = cam.project({ x: 0, y: 1000, z: 0 });
    expect(p.y).toBeCloseTo(viewport.heightPx * 0.5, 1);
  });

  it("entities below scrollMeters project below center", () => {
    const cam = createCamera(viewport);
    cam.setScrollMeters(1000);
    const above = cam.project({ x: 0, y: 900, z: 0 }).y;
    const below = cam.project({ x: 0, y: 1100, z: 0 }).y;
    expect(above).toBeLessThan(viewport.heightPx * 0.5);
    expect(below).toBeGreaterThan(viewport.heightPx * 0.5);
  });

  it("scroll translation is symmetric — same depth delta, same pixel delta", () => {
    const cam = createCamera(viewport);
    cam.setScrollMeters(500);
    const a = cam.project({ x: 0, y: 500 + 50, z: 0 }).y;
    const b = cam.project({ x: 0, y: 500 - 50, z: 0 }).y;
    const centerY = viewport.heightPx * 0.5;
    expect(a - centerY).toBeCloseTo(centerY - b, 5);
  });

  it("clamp01 z values: negative z behaves like z=0, >1 like z=1", () => {
    const cam = createCamera(viewport);
    const zNeg = cam.project({ x: 100, y: 0, z: -5 });
    const zZero = cam.project({ x: 100, y: 0, z: 0 });
    const zOver = cam.project({ x: 100, y: 0, z: 10 });
    const zOne = cam.project({ x: 100, y: 0, z: 1 });
    expect(zNeg.x).toBeCloseTo(zZero.x, 5);
    expect(zOver.x).toBeCloseTo(zOne.x, 5);
  });
});
