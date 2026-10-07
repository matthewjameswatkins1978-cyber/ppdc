import assert from "node:assert/strict";
import test from "node:test";
import { getPublicOrigin } from "./public-origin";

test("uses Render's assigned URL as the public origin", () => {
  const oldRenderUrl = process.env.RENDER_EXTERNAL_URL;
  const oldConfiguredOrigin = process.env.PPDC_PUBLIC_ORIGIN;
  process.env.RENDER_EXTERNAL_URL = "https://ppdc-demo.onrender.com/extra";
  process.env.PPDC_PUBLIC_ORIGIN = "http://localhost:3000";
  try {
    assert.equal(getPublicOrigin(), "https://ppdc-demo.onrender.com");
  } finally {
    if (oldRenderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = oldRenderUrl;
    if (oldConfiguredOrigin === undefined) delete process.env.PPDC_PUBLIC_ORIGIN;
    else process.env.PPDC_PUBLIC_ORIGIN = oldConfiguredOrigin;
  }
});

test("preserves localhost when developing without a deployment URL", () => {
  const oldRenderUrl = process.env.RENDER_EXTERNAL_URL;
  const oldConfiguredOrigin = process.env.PPDC_PUBLIC_ORIGIN;
  delete process.env.RENDER_EXTERNAL_URL;
  delete process.env.PPDC_PUBLIC_ORIGIN;
  try {
    assert.equal(getPublicOrigin(), "http://localhost:3000");
  } finally {
    if (oldRenderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = oldRenderUrl;
    if (oldConfiguredOrigin === undefined) delete process.env.PPDC_PUBLIC_ORIGIN;
    else process.env.PPDC_PUBLIC_ORIGIN = oldConfiguredOrigin;
  }
});

test("rejects an insecure non-local public origin", () => {
  const oldRenderUrl = process.env.RENDER_EXTERNAL_URL;
  const oldConfiguredOrigin = process.env.PPDC_PUBLIC_ORIGIN;
  delete process.env.RENDER_EXTERNAL_URL;
  process.env.PPDC_PUBLIC_ORIGIN = "http://example.com";
  try {
    assert.throws(() => getPublicOrigin(), /HTTPS or a local loopback/);
  } finally {
    if (oldRenderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = oldRenderUrl;
    if (oldConfiguredOrigin === undefined) delete process.env.PPDC_PUBLIC_ORIGIN;
    else process.env.PPDC_PUBLIC_ORIGIN = oldConfiguredOrigin;
  }
});
