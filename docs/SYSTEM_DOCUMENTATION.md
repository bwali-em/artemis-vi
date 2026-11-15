# ARTEMIS Motion — System Documentation

## 1. Features

### 1.1 Implemented in this codebase

| Feature | Description | Key implementation areas |
|---|---|---|
| Mission/medical dashboard shell | Single-page dashboard with header, sidebar (desktop), bottom tab bar (mobile), status panels, and demo-data labeling. | `src/App.tsx`, `src/pages/DashboardPage.tsx`, `src/components/dashboard/*`, `src/components/layout/EarthBackdrop.tsx` |
| Astronaut roster & profile (sample data) | In-memory astronaut list with selection, profile view, mission/crew metadata, and “demonstration data” indicators. | `src/hooks/useMedicalData.ts`, `src/components/dashboard/AstronautProfile.tsx`, `AstronautRoster.tsx`, `src/types/health.ts` |
| Alert queue & review workflow (sample data) | Alert list with severities/statuses and actions to acknowledge/resolve/update status through a review panel. | `useMedicalData.ts`, `AlertQueue.tsx`, `AlertReviewPanel.tsx`, `HealthHistory.tsx` |
| Movement assessment selection & execution | Guided assessment flow: select protocol, run assessment, and produce a results/record view. Dashboard uses `AssessmentRunner`; a separate page variant uses `ConversationalAssessmentRunner`. | `AssessmentPage.tsx`, `AssessmentSelector.tsx`, `AssessmentRunner.tsx`, `ConversationalAssessmentRunner.tsx`, `InstructionOverlay.tsx`, `AssessmentProgress.tsx`, `AssessmentSummary.tsx` |
| Camera-based pose analysis pipeline | Webcam capture and MediaPipe Pose Landmarker integration with landmark processing, skeleton rendering, and analysis utilities (angles, posture, symmetry, repetitions, scoring). | `CameraView.tsx`, `PoseCanvas.tsx`, `useCamera.ts`, `services/mediapipe/*`, `services/analysis/*`, `services/assessment/poseCoach.ts`, `public/models/*`, `public/wasm/*` |
| Assessment persistence (local) | Completed assessment records are stored/retrieved from browser IndexedDB (`ARTEMIS_MOTION_DB`, `assessments` store) and surfaced in dashboard/history/trends. | `src/storage/assessmentRepository.ts`, `src/types/assessment.ts`, `ResultsDashboard.tsx`, `AssessmentHistory.tsx`, `ScoreTrend.tsx`, `MovementCharts.tsx` |
| AI health consultation (voice-guided, prototype) | Voice/text-driven symptom check flow with predefined health questions, keyword/affirmative detection, live transcript state, and consultation summary. Uses Gemini Live hook when API key is configured; falls back to browser speech synthesis demo mode when not. | `src/pages/AIConsultationPage.tsx`, `src/hooks/useGeminiLive.ts`, `src/hooks/useVoiceInput.ts`, `src/services/gemini/geminiLive.ts` |
| Consultation persistence (local) | Consultation records (detected signs, transcript, timestamp, astronaut association) saved to browser `localStorage`. | `src/storage/healthConsultationRepository.ts`, `src/types/health.ts` |
| History & trend views | UI components for assessment history, score trends, movement charts, and health history panels based on stored/sample records. | `HealthHistory.tsx`, `AssessmentHistory.tsx`, `ScoreTrend.tsx`, `MovementCharts.tsx` |
| Build/runtime stack | React 19 + TypeScript + Vite app with Tailwind/PostCSS styling, MediaPipe tasks-vision, Google GenAI dependency, lint/build scripts. | `package.json`, `vite.config.ts`, `tsconfig*.json`, `postcss.config.js`, `index.html`, `main.tsx` |

### 1.2 Documented/aspirational capabilities (from README, not fully implemented here)

The repository README describes a broader concept that is **not** fully present in this frontend prototype:
- Secure backend/API, identity/roles, audit logging, encrypted health records, offline sync service.
- Medical personnel dashboard as a separate authorized system with real telemetry/sensor integrations.
- Sleep-session start/wake logging, schedule analysis, wearable/spacecraft sensor ingestion, and physiological measurements (HR/HRV).
- Longitudinal baseline engine across multimodal inputs, configurable clinical alert rules, and escalation protocols.
- Production-grade AI safety, emergency triage workflows, and clinical validation for spaceflight environments.

## 2. Purpose of features and importance

| Feature | Purpose | Importance |
|---|---|---|
| Dashboard & workspace navigation | Provide a central operational view of astronaut status, activities, and review items. | Improves situational awareness and gives a single entry point for monitoring and action. |
| Astronaut roster/profile | Associate observations and actions with a specific crew member and mission context. | Supports accountability, continuity of records, and crew-specific review. |
| Alerts & review workflow | Surface items needing attention and track acknowledgement/resolution state. | Helps prioritize follow-up and reduces risk of missed issues (prototype/demo logic only). |
| Movement assessments (camera + pose) | Capture guided movement sessions and derive pose-based metrics/scores/findings. | Enables repeatable, low-equipment functional checks and trend tracking over time; useful for early review signals (not diagnosis). |
| Local assessment storage/history/trends | Persist and compare completed assessments across sessions on the same device/browser. | Longitudinal context is essential for detecting change relative to prior performance. |
| AI health consultation | Offer a conversational, structured way to report symptoms and capture a transcript/sign summary. | Low-friction reporting can improve consistency and completeness of self-reported health data. |
| Consultation storage | Retain consultation outputs for later review within the app. | Preserves context/history of reported concerns; supports follow-up discussions. |
| Demo-mode fallback for AI/voice | Allow the consultation flow to run without external AI connectivity using browser speech synthesis/recognition paths. | Improves resilience for demos/offline-like scenarios and reduces setup friction. |
| Clear demo/prototype labeling | Communicate sample data, estimate-only metrics, and non-clinical status in UI/copy. | Critical for safety and expectation management; prevents misinterpretation as medical advice or live telemetry. |

## 3. Feature alternatives

| Current feature/approach | Alternatives | Trade-offs |
|---|---|---|
| Browser-based pose estimation (MediaPipe in frontend) | Native mobile CV pipeline; server-side video analysis; depth-camera/sensor-based motion capture. | Browser is easy to deploy/demo but sensitive to lighting, camera placement, device performance, and privacy concerns; native/sensor systems can be more accurate but costlier and harder to deploy. |
| IndexedDB/localStorage for persistence | Backend database (PostgreSQL/etc.) with authenticated API and sync; encrypted on-device database. | Local storage is simple/offline-capable for prototypes but not multi-user, not centrally auditable, and vulnerable to device/browser data loss. |
| Voice-guided AI consultation (Gemini/browser speech) | Form-based symptom checklists; clinician-authored decision trees; on-device/local LLM; secure telehealth integration. | Conversational UX is natural but introduces ASR/LLM ambiguity and safety risks; structured forms are less flexible but more deterministic and auditable. |
| In-memory sample astronauts/alerts | Real identity/crew management, RBAC, event-driven alerting from validated rules engine. | Sample data enables UI development/demo; production requires verified data sources, authorization, and traceability. |
| Client-only SPA | Full-stack architecture with services for auth, records, analysis, notifications, and sync. | SPA is fast to iterate; lacks security, scalability, and integration needed for operational medical use. |
| Rule/keyword symptom detection in UI flow | Clinically reviewed ontology/NLP extraction with confidence scores and human review. | Keywords are simple and transparent but brittle; clinical NLP is more capable but requires validation and governance. |

## 4. System rating

**Overall (prototype maturity): 2.8 / 5**

| Dimension | Rating | Rationale |
|---|---:|---|
| Feature completeness (vs stated concept) | 2 / 5 | Strong UI/prototype coverage for movement assessment and consultation flows; major README concepts (backend, sleep/wellbeing longitudinal engine, sensors, clinical workflows) are not implemented. |
| Usability & UX structure | 4 / 5 | Clear navigation, guided flows, status indicators, and demo labeling provide a coherent operator-facing experience. |
| Technical implementation (frontend) | 3 / 5 | Modular component/service/storage organization with TypeScript types and local persistence; complexity concentrated in assessment/AI flows. |
| Data integrity & persistence | 2.5 / 5 | Local browser persistence works for single-device demo use but lacks synchronization, backup, migration/versioning strategy, and server-side validation. |
| Security & privacy readiness | 1.5 / 5 | No evident auth/RBAC/audit/encryption-at-rest controls in app; sensitive keys/config handling must be managed outside source and environment hygiene enforced. |
| Reliability & testability | 2 / 5 | No visible automated test suite in repository; behavior depends on browser APIs (camera, mic, speech, IndexedDB) and external AI availability. |
| Clinical/safety readiness | 1 / 5 | Explicitly a prototype/demo; outputs are estimates and not validated for diagnosis, triage, or operational medical decisions. |

## 5. Weaknesses and opportunities (ops)

### Weaknesses / risks
- **Not production/clinical-grade:** Estimates and sample data are presented for demo; no clinical validation, certification, or approved escalation protocol.
- **No backend/security boundary:** No authentication, authorization, role separation, audit trail, or encrypted server-side storage evident.
- **Browser/API dependency:** Camera, microphone, speech recognition/synthesis, IndexedDB, and localStorage behavior vary by browser/device and permissions.
- **AI dependency & safety constraints:** Live consultation depends on external model/API availability and configuration; keyword-based symptom extraction can misclassify; no formal medical guardrails pipeline shown.
- **Data fragmentation/local-only state:** Assessments and consultations are stored separately in different browser stores; no cross-device sync or unified longitudinal record service.
- **Limited operational observability:** No centralized logging/monitoring/error reporting pipeline for deployed usage.
- **Testing/quality gaps:** No apparent unit/integration/e2e tests or CI quality gates in repo.

### Opportunities
- **Unify health record model:** Normalize assessments, consultations, alerts, and future sleep/wellbeing inputs into a shared schema and timeline service.
- **Add secure backend foundation:** Implement authenticated API, RBAC, audit logging, encrypted storage, and data retention policies.
- **Introduce validated alerting:** Move from demo alerts to configurable, explainable rules with thresholds reviewed by domain experts.
- **Improve assessment reliability:** Add calibration/setup checks, detection-quality gating, protocol validation, and environment guidance.
- **Strengthen AI consultation safety:** Constrain responses, separate symptom capture from advice, add uncertainty handling, and require human review for escalation.
- **Operational hardening:** Add automated tests, error telemetry, performance profiling, and deployment health checks.
- **Expand documented modules:** Implement sleep logging, wellbeing check-ins, and wearable/sensor adapters to align with the broader README vision.

## 6. Target users and user flow

### Target users
- **Primary (prototype/demo):** Medical operations personnel, trainers, or mission-support reviewers exploring a concept UI for astronaut monitoring.
- **Secondary:** Astronaut/crew-member persona during guided movement assessments or AI symptom check-ins (simulated in this app).
- **Future/aspirational (per README):** Authorized flight surgeons/medical staff and crew in an integrated, secure mission-health system.

### User flow (as implemented)

1. **Open application**
   - User lands in dashboard shell with demo indicators and sample astronaut context.
2. **Review overview**
   - User views summary cards, mission status, sample vitals/indicators, recent assessments, and open alert count.
3. **Start movement assessment**
   - User selects an assessment protocol, grants camera access, follows guided steps, and completes the session.
   - System computes pose-based metrics/score and saves a completed record to IndexedDB.
4. **Review results and history**
   - User opens results, assessment history, score trends, and movement charts from stored/sample records.
5. **Run AI consultation**
   - User starts voice-guided consultation; assistant asks health questions.
   - System detects reported signs from responses, captures transcript, and saves a consultation record to localStorage (demo or live AI mode depending on configuration).
6. **Manage alerts and profile context**
   - User views alert queue, opens review details, acknowledges/resolves items, and navigates astronaut profile/roster views (sample data).

### Scope and safety note
This system is a **prototype/demonstration**. Movement scores and consultation outputs are **not clinical diagnoses or medical advice**, and the dashboard does not represent live spacecraft telemetry or validated medical monitoring.
