# PII Shield V2: Local SLM Integration Plan

To make the plugin incredibly powerful while keeping it 100% private, we will integrate **Chrome's built-in Local AI (Gemini Nano)**. This means your extension size stays tiny (no downloading heavy models), but it gains the reasoning power of an LLM.

## 1. The Hybrid Architecture
Local SLMs are smart but relatively slow (taking 1-2 seconds) compared to Regex (10ms). We will build a **Hybrid Engine**:
*   **Layer 1 (Regex Engine):** Runs instantly on every keystroke. Catches standard formats (Phones, Emails, NI/NHS numbers).
*   **Layer 2 (SLM Engine):** Runs *only* when the user pauses typing for 1.5 seconds. Catches contextual, unstructured PII (e.g., *"My manager John Smith"* or *"Our secret Q3 merger strategy"*).

## 2. Managing Token Size & Latency
Running an SLM locally means we have a strict context window and limited compute power. Here is how we keep the token size minimal:

### A. The "Sliding Window" Strategy
If a user pastes a 5,000-word document, we **cannot** send it all to the SLM at once. 
*   **Chunking:** We split the input by paragraphs or sentences.
*   **Diff Scanning:** We keep track of what has already been scanned. If the user adds a new sentence, we *only* send that new sentence to the SLM, not the whole text box again.

### B. Ultra-Condensed System Prompts
SLMs (like Gemini Nano) have small attention spans. We must strip out "polite" prompt fluff.
*   **Bad Prompt (High Token Cost):** *"You are a highly intelligent privacy expert. Please carefully read the following text and tell me if there is any Personally Identifiable Information..."*
*   **Optimized SLM Prompt (Low Cost):** *"Extract sensitive entities (names, health data, trade secrets) from this text. Output strict JSON array of strings."*

### C. Bail-Out Filtering
Before waking up the SLM, we do a basic length check. If a text chunk is just "Hello", or "Can you write a python script?", we skip the SLM entirely to save battery and compute.

## 3. Implementation Steps

### Phase 1: Enable & Test `window.ai`
We will update `manifest.json` to include permissions for `aiLanguageModelOriginTrial` (or whatever the current trial permission is) and write a background script test to check if the browser has the Gemini Nano model downloaded.

### Phase 2: Create `slm-engine.js`
A new file that will:
1. Initialize the `window.ai.languageModel` session.
2. Accept debounced text chunks from the content script.
3. Apply the condensed system prompt.
4. Parse the AI's response and merge it with our existing Regex results.

### Phase 3: Update the UI
*   Add an **"AI Deep Scan"** toggle in the popup/side panel.
*   Show a small "🧠 Scanning context..." spinner in the side panel when the SLM is thinking, so the user knows it's doing deep analysis.
