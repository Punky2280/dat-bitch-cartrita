# Cartrita: Development Roadmap V7 - The Expressive Agent

## Vision Statement

Transform Cartrita from a responsive assistant into a proactive, multi-purpose AGI. She will not only respond to commands but will anticipate needs, automate complex tasks, and learn from her environment in a natural, seamless way. The goal is to create an elusive, powerful, and ethically-grounded digital entity capable of true partnership in every facet of a user's life.

**Core Functionality Note:** Cartrita's primary conversational and reasoning abilities, powered by the core OpenAI model (GPT-4o), are a built-in service. User-provided keys are only for connecting Cartrita to optional, third-party services.

**Technology Stack Reminder:**

- **Backend:** Node.js with JavaScript (`.js`)
- **Frontend:** React with TypeScript (`.tsx`)

---

## Phase 1: Foundational Enhancements

_Goal: Strengthen core capabilities and internationalize the platform._

- **1.1: `CodeWriterAgent` Sub-Agent**
- **1.2: User Settings Page**
- **1.3: Internationalization (i18n) & Multi-Language Support**

## Phase 2: UI/UX & Core Personalization

_Goal: Create a polished, intuitive, and highly customizable user experience._

- **2.1: Advanced UI Styling & Theming**
- **2.2: Capabilities Hub Page**
- **2.3: Customizable Personality & Ethics**
- **2.4: Static Content Pages**

## Phase 3: The Agentic Core

_Goal: Re-architect Cartrita's internal systems for true agentic behavior and task automation._

- **3.1: Multi-Agent Communication Protocol (MCP) Implementation**
- **3.2: Workflow Automation Engine**

## Phase 4: Ambient, Emotional, & Expressive Intelligence

_Goal: Enable Cartrita to perceive, understand, and express herself based on the user's environment, emotional state, and social context._

- **4.1: Sensory Input - Mic & Camera Integration**
- **4.2: Proactive Environmental Response**
- **4.3: Emotional Acuity & Tone Adaptation**
- **4.4: Cross-Cultural Acuity & Bias Mitigation**
- **4.5: Dynamic Voice & Persona Synthesis (New):**
  - **Description:** Give Cartrita the ability to dynamically alter her voice in real-time to match the content and emotional intent of her message. This allows her to adopt different tones, accents, or personas when telling a story, quoting someone, or expressing a specific emotion.
  - **Backend:** Integrate an advanced Text-to-Speech (TTS) service that supports detailed SSML (Speech Synthesis Markup Language) or real-time voice styling (e.g., ElevenLabs, OpenAI TTS). The `CoreAgent` will be upgraded to not only generate text but also to wrap it in SSML tags that define the desired delivery (e.g., `<speak><voice name="SassyFemale"><prosody rate="fast">Okay, check this out...</prosody></voice><voice name="OldMan"><prosody rate="slow">As the proverb goes...</prosody></voice></speak>`). The backend will process this, generate an audio stream, and send it to the frontend.
  - **Frontend:** The `ChatComponent.tsx` will be updated to receive and play these audio streams seamlessly, replacing the standard text-to-speech output for these expressive moments.

## Phase 5: Connectivity & Security

_Goal: Build the secure infrastructure for Cartrita to connect to the user's world and for administrators to monitor the system._

- **5.1: Secure API Key Vault**
- **5.2: Performance & Usage Analytics Dashboard**

## Phase 6: Total Integration & Collaboration

_Goal: Weave Cartrita into the fabric of the user's digital life and enable collaborative use._

- **6.1: The Personal Life OS**
- **6.2: The Creative Suite**
- **6.3: Digital & Physical World Bridge**
- **6.4: The Second Brain & Predictive Assistance**
- **6.5: Collaborative Sessions**

## Phase 7: Resilience & Autonomy

_Goal: Ensure Cartrita is a reliable companion, even without an internet connection, and expand her influence to the physical world._

- **7.1: Robotics Communication Protocol**
- **7.2: Offline Mode & On-Device Models**
