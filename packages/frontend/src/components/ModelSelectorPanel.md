# Model Selector Panel Integration

Component: `ModelSelectorPanel` (source in `ModelSelectorPanel.tsx`).

Purpose: Interactive UI for exploring the Hugging Face model routing subsystem:
- Fetches catalog via `GET /api/models/catalog`.
- Accepts user prompt & optional task filter.
- Calls `POST /api/models/route` and displays chosen model, confidence, and metadata.

## Adding To A Page

1. Import the component:
```tsx
import ModelSelectorPanel from "@/components/ModelSelectorPanel";
```
2. Render inside any page or modal:
```tsx
<ModelSelectorPanel />
```
3. (Optional) Wrap with layout / card styling.

## Dashboard View Binding

`DashboardPage.tsx` registers a view key `"models"` in the `DashboardView` union. The header button sets `currentView` to `"models"` which renders a lightweight wrapper containing the panel.

To add a new view:
1. Extend the `DashboardView` union with a new string literal.
2. Add a conditional block just like the existing `if (currentView === "models")` case.
3. Add a navigation button in the header / sidebar setting `setCurrentView("<new>")`.

## API Contract Summary

`GET /api/models/catalog` -> `[ { repo_id, category, primary_tasks, ... } ]`

`POST /api/models/route` body:
```json
{ "prompt": "Explain RAG", "taskHint": "text-generation", "maxCandidates": 6 }
```
Response success excerpt:
```json
{ "success": true, "data": { "model_id": "...", "output": "...", "confidence": 0.82 } }
```

## Error Handling

Errors from the API are displayed inline; failures include a fallback chain so the user can diagnose why a model was picked or why routing failed.

## Styling / Theming

The panel uses existing utility classes; customize by editing its container classes. Keep network calls and routing logic inside the panel—avoid duplicating catalog logic elsewhere.

---
Update this document if the routing API schema evolves (e.g., adding new tasks or confidence calibration fields).
