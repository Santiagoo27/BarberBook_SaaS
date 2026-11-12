# AI Diagnosis Quota UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quota feedback (warning banner + button block) inside `DiagnosisModal` so barbers see how many AI diagnoses remain before hitting the 100/month limit.

**Architecture:** Single file change — `BarberDashboard.tsx`. On modal mount, fetch quota from the existing `GET /api/appointments/ai-diagnosis/quota` endpoint. Show a yellow banner when ≤ 20 remain, red + disabled button when 0 remain. Update counter locally after a successful diagnosis without re-fetching.

**Tech Stack:** React 18 + TypeScript, existing `aiDiagnosisService.getQuota()`, inline styles matching the existing PANEL/glassmorphism pattern.

## Global Constraints

- Only modify `BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx` — no backend changes, no new files.
- `AiDiagnosisQuota` interface is already exported from `./aiDiagnosisService` — import it, don't redefine it.
- All inline styles must use CSS variables (`var(--color-*)`) or the exact rgba values specified in the spec.
- Soft-cap threshold: `remaining <= 20` (not 19, not 25).
- Do NOT show the banner when `quota.limit === -1` (PremiumUnlimited plan).
- Do NOT show the banner when `result !== null` (diagnosis already exists for this appointment).
- On network error loading quota: `setLoadingQuota(false)`, leave `quota` as `null`, no banner shown.
- After successful diagnosis: decrement locally (`remaining - 1`, `used + 1`), no re-fetch.

---

### Task 1: Add quota state, fetch, computed flag, and guard in DiagnosisModal

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx`

**Interfaces:**
- Consumes: `aiDiagnosisService.getQuota(): Promise<AiDiagnosisQuota | null>` (already in service)
- Consumes: `AiDiagnosisQuota` interface from `./aiDiagnosisService` — fields: `plan: string`, `available: boolean`, `used: number`, `limit: number`, `remaining: number`, `resetDate?: string`
- Produces: `quota: AiDiagnosisQuota | null` state and `showQuotaBanner: boolean` — used by Task 2's JSX render

**Context:** `DiagnosisModal` is a React.FC defined at line ~40 of `BarberDashboard.tsx`. It already has a `useEffect` that fetches existing diagnosis and branding. The `handleAnalyze` function fires the POST to the AI service.

- [ ] **Step 1: Add `AiDiagnosisQuota` to the import**

Find this line (line 5 of the file):
```ts
import { aiDiagnosisService, AI_SERVICE_NAME, type DiagnosisResult } from "./aiDiagnosisService";
```
Replace with:
```ts
import { aiDiagnosisService, AI_SERVICE_NAME, type DiagnosisResult, type AiDiagnosisQuota } from "./aiDiagnosisService";
```

- [ ] **Step 2: Add `quota` and `loadingQuota` state variables**

Find these lines inside `DiagnosisModal` (after `useState` declarations, around line 50):
```ts
  const [loadingMsg, setLoadingMsg] = useState("");
```
Replace with:
```ts
  const [loadingMsg, setLoadingMsg] = useState("");
  const [quota, setQuota]           = useState<AiDiagnosisQuota | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
```

- [ ] **Step 3: Add quota fetch inside the existing useEffect**

Find the existing `useEffect` block:
```ts
  useEffect(() => {
    brandingService.getBranding()
      .then(b => { if (b.logoBase64) setLogoBase64(b.logoBase64); })
      .catch(() => {});
    aiDiagnosisService.getExisting(appointment.id)
      .then(existing => {
        if (existing) {
          setResult(existing);
          const saved = sessionStorage.getItem(`diagnosis-photo-${appointment.id}`);
          if (saved) setPreview(saved);
        }
      })
      .finally(() => setLoadingExisting(false));
  }, [appointment.id]);
```
Replace with:
```ts
  useEffect(() => {
    brandingService.getBranding()
      .then(b => { if (b.logoBase64) setLogoBase64(b.logoBase64); })
      .catch(() => {});
    aiDiagnosisService.getExisting(appointment.id)
      .then(existing => {
        if (existing) {
          setResult(existing);
          const saved = sessionStorage.getItem(`diagnosis-photo-${appointment.id}`);
          if (saved) setPreview(saved);
        }
      })
      .finally(() => setLoadingExisting(false));
    aiDiagnosisService.getQuota()
      .then(q => { if (q) setQuota(q); })
      .catch(() => {})
      .finally(() => setLoadingQuota(false));
  }, [appointment.id]);
```

- [ ] **Step 4: Add `showQuotaBanner` computed variable right after the useEffect**

Find `const handleFile = (f: File) => {` and insert BEFORE it:
```ts
  const showQuotaBanner =
    !result &&
    quota !== null &&
    quota.limit !== -1 &&
    quota.remaining <= 20;

  const handleFile = (f: File) => {
```

(Keep the original `const handleFile` line — you are just inserting the computed variable block before it.)

- [ ] **Step 5: Add early-return guard in `handleAnalyze`**

Find the start of `handleAnalyze`:
```ts
  const handleAnalyze = async () => {
    if (!file) return;
    setShowConfirm(false);
```
Replace with:
```ts
  const handleAnalyze = async () => {
    if (!file) return;
    if (quota?.remaining === 0) return;
    setShowConfirm(false);
```

- [ ] **Step 6: Update quota locally after a successful diagnosis**

Find this line inside `handleAnalyze`'s try block:
```ts
      setResult(await attempt());
```
Replace with:
```ts
      setResult(await attempt());
      setQuota(q => q && q.limit !== -1
        ? { ...q, remaining: Math.max(0, q.remaining - 1), used: q.used + 1 }
        : q);
```

- [ ] **Step 7: Verify TypeScript compiles with no errors**

```bash
cd BarberBookSaaS.Web && npx tsc --noEmit
```
Expected output: no errors (0 lines of output, exit code 0). If errors appear, check that `AiDiagnosisQuota` is correctly imported and that `loadingQuota` is referenced (even unused variables can be suppressed, but `loadingQuota` is not referenced in JSX yet — that's fine, it will be used in Task 2).

Actually `loadingQuota` is declared but not yet used in JSX — TypeScript won't error on this; only ESLint might warn. Proceed regardless.

- [ ] **Step 8: Commit**

```bash
git add BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx
git commit -m "feat: quota state + fetch + guard in DiagnosisModal"
```

---

### Task 2: Render quota banner and disable buttons in DiagnosisModal JSX

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx`

**Interfaces:**
- Consumes: `showQuotaBanner: boolean` and `quota: AiDiagnosisQuota | null` from Task 1
- Consumes: `loadingQuota: boolean` from Task 1

**Context:** The modal JSX is returned from `createPortal(...)`. The relevant section is the `!loadingExisting && !result && !showConfirm` block, which renders the upload drop-zone. The `showConfirm` block renders the "Confirmar y analizar" button.

- [ ] **Step 1: Insert the quota banner JSX inside the `!showConfirm` upload section**

Find this exact code (the opening of the outer `!showConfirm` block):
```tsx
            {!loadingExisting && !result && !showConfirm && (
              <>
                {loading ? (
```
Replace with:
```tsx
            {!loadingExisting && !result && !showConfirm && (
              <>
                {showQuotaBanner && !loading && (
                  <div style={{
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: quota!.remaining === 0 ? "rgba(239,68,68,0.10)" : "rgba(234,179,8,0.10)",
                    border: `1px solid ${quota!.remaining === 0 ? "rgba(239,68,68,0.30)" : "rgba(234,179,8,0.30)"}`,
                    color: quota!.remaining === 0 ? "#f87171" : "#fbbf24",
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>
                      {quota!.remaining === 0 ? "🚫" : "⚠️"}
                    </span>
                    <span>
                      {quota!.remaining === 0
                        ? "Límite mensual alcanzado"
                        : `Quedan ${quota!.remaining} diagnósticos este mes`}
                      {quota!.resetDate && (
                        <> · se reinicia el {new Date(quota!.resetDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</>
                      )}
                    </span>
                  </div>
                )}
                {loading ? (
```

- [ ] **Step 2: Disable "Tomar foto" and "Desde galería" buttons when quota is exhausted**

Find the "Tomar foto" button (has `onClick={() => cameraInputRef.current?.click()}`):
```tsx
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
                            color: "var(--color-primary)", cursor: "pointer",
                            transition: "all 150ms ease",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 25%, transparent)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 15%, transparent)"; }}
                        >
                          <Camera size={16} /> Tomar foto
                        </button>
```
Replace with:
```tsx
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={quota?.remaining === 0}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
                            color: "var(--color-primary)", cursor: quota?.remaining === 0 ? "not-allowed" : "pointer",
                            transition: "all 150ms ease",
                            opacity: quota?.remaining === 0 ? 0.4 : 1,
                          }}
                          onMouseEnter={e => { if (quota?.remaining !== 0) e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 25%, transparent)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 15%, transparent)"; }}
                        >
                          <Camera size={16} /> Tomar foto
                        </button>
```

Find the "Desde galería" button (has `onClick={() => galleryInputRef.current?.click()}`):
```tsx
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: "var(--color-glass-surface)",
                            border: "1px solid var(--color-glass-border)",
                            color: "var(--color-text)", cursor: "pointer",
                            transition: "all 150ms ease",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--color-glass-surface-hover)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--color-glass-surface)"; }}
                        >
                          <ImageIcon size={16} /> Desde galería
                        </button>
```
Replace with:
```tsx
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          disabled={quota?.remaining === 0}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: "var(--color-glass-surface)",
                            border: "1px solid var(--color-glass-border)",
                            color: "var(--color-text)", cursor: quota?.remaining === 0 ? "not-allowed" : "pointer",
                            transition: "all 150ms ease",
                            opacity: quota?.remaining === 0 ? 0.4 : 1,
                          }}
                          onMouseEnter={e => { if (quota?.remaining !== 0) e.currentTarget.style.background = "var(--color-glass-surface-hover)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--color-glass-surface)"; }}
                        >
                          <ImageIcon size={16} /> Desde galería
                        </button>
```

- [ ] **Step 3: Disable "Confirmar y analizar" button when quota is exhausted**

Find the "Confirmar y analizar" button in the `showConfirm` block:
```tsx
                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="btn-primary"
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    {loading ? "Analizando..." : <><Sparkles size={14} /> Confirmar y analizar</>}
                  </button>
```
Replace with:
```tsx
                  <button
                    onClick={handleAnalyze}
                    disabled={loading || quota?.remaining === 0}
                    className="btn-primary"
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: quota?.remaining === 0 ? 0.4 : 1, cursor: quota?.remaining === 0 ? "not-allowed" : "pointer" }}
                  >
                    {loading ? "Analizando..." : <><Sparkles size={14} /> Confirmar y analizar</>}
                  </button>
```

- [ ] **Step 4: Verify TypeScript compiles with no errors**

```bash
cd BarberBookSaaS.Web && npx tsc --noEmit
```
Expected: exit 0, no output. Fix any type errors before continuing.

- [ ] **Step 5: Manual verification checklist**

Start the dev server and open the barber panel:
```bash
cd BarberBookSaaS.Web && npm run dev
```

To test each state you'll need to temporarily force the quota API response. The quickest way is to temporarily patch `aiDiagnosisService.getQuota()` to return a mock, or use the backend with a test tenant.

**Checklist:**
- [ ] Tenant Premium, `remaining = 5` → yellow banner "Quedan 5 diagnósticos este mes · se reinicia el [fecha]" visible; "Tomar foto" and "Desde galería" buttons are active; after successful diagnosis the banner updates to "Quedan 4 diagnósticos este mes"
- [ ] Tenant Premium, `remaining = 0` → red banner "Límite mensual alcanzado · se reinicia el [fecha]" visible; "Tomar foto", "Desde galería" buttons are greyed out (opacity 0.4); even if user somehow reaches confirm step, "Confirmar y analizar" is disabled
- [ ] Tenant Premium, `remaining = 25` → no banner shown at all
- [ ] Tenant PremiumUnlimited (`limit === -1`) → no banner shown
- [ ] Simulate network error (DevTools → Network → offline → open modal) → no banner, buttons enabled

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx
git commit -m "feat: quota banner + button disable in DiagnosisModal"
```

---

## After all tasks

Push to remote:
```bash
git push origin main
```
