# Cartrita Platform User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [AI Knowledge Hub & Memory Palace](#ai-knowledge-hub--memory-palace)
4. [Secure API Key Vault](#secure-api-key-vault)
5. [Chat Interface](#chat-interface)
6. [Settings & Personalization](#settings--personalization)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

Welcome to Cartrita, your comprehensive AI-powered development and knowledge management platform. This modern web application combines cutting-edge artificial intelligence with secure data management to create a seamless experience for developers, researchers, and knowledge workers.

### Initial Setup and Authentication

Upon first accessing Cartrita, you'll be presented with a sleek, cyberpunk-inspired login interface featuring neon accents and a professional dark theme. The authentication system uses industry-standard JWT (JSON Web Tokens) with bcrypt password hashing for maximum security. 

To create your account, click "Register here" and provide your full name, email address, and a strong password (minimum 6 characters). The registration form includes proper browser autocomplete attributes for password managers, ensuring a smooth onboarding experience. Once registered, you'll receive a secure authentication token that maintains your session for 24 hours.

The login process is streamlined and secure. Enter your credentials, and the system will authenticate you against our PostgreSQL database with TimescaleDB extensions for optimal performance. Your password is never stored in plain text - only cryptographically secure hashes are maintained in our database.

After successful authentication, you'll be automatically redirected to the main dashboard where you can begin exploring Cartrita's powerful features. The platform's responsive design ensures optimal viewing on desktop computers, tablets, and mobile devices.

---

## Dashboard Overview

The Cartrita dashboard serves as your command center, providing quick access to all platform features through an intuitive, modern interface. The dashboard is built using React with TypeScript for type safety and optimal performance, ensuring a responsive and reliable user experience.

### Navigation and Layout

The main dashboard features a clean, organized layout with primary navigation elements prominently displayed. The header contains quick-access buttons for the Knowledge Hub and API Vault, while the sidebar provides detailed navigation options and recent activity summaries. The color scheme follows a professional dark theme with cyan and pink accent colors, creating a visually appealing yet functional workspace.

The dashboard displays real-time information about your account activity, including recent knowledge entries, API key usage statistics, and system notifications. The interface automatically updates to reflect changes across all connected services, ensuring you always have the most current information at your fingertips.

### Key Features Overview

From the dashboard, you can access five primary features: the AI-powered chat interface for natural language interactions, the Knowledge Hub for information management and semantic search, the API Key Vault for secure credential storage, comprehensive settings for platform personalization, and workflow management tools for automating complex tasks.

The dashboard also provides quick statistics and insights, such as the number of knowledge entries you've created, API keys stored securely, and recent chat activity. This overview helps you understand your usage patterns and maximize the platform's value for your specific needs.

All navigation elements are keyboard accessible and screen reader compatible, ensuring the platform remains usable for users with different accessibility requirements. The interface follows WCAG guidelines for inclusive design.

---

## AI Knowledge Hub & Memory Palace

The AI Knowledge Hub represents one of Cartrita's most innovative features, combining traditional knowledge management with cutting-edge artificial intelligence to create a truly intelligent information system. This feature transforms how you store, organize, and retrieve information by using semantic understanding rather than simple keyword matching.

### Understanding Semantic Search and Vector Embeddings

At the core of the Knowledge Hub lies sophisticated vector embedding technology powered by OpenAI's latest text-embedding models. When you add information to your knowledge base, the system automatically generates high-dimensional vector representations (embeddings) that capture the semantic meaning of your content. This means the system understands concepts, relationships, and context, not just exact word matches.

For example, if you store information about "JavaScript array methods" and later search for "functional programming patterns," the system will intelligently connect these related concepts and surface relevant information. This semantic understanding dramatically improves the relevance and usefulness of search results compared to traditional keyword-based systems.

The vector embeddings are stored in PostgreSQL using the pgvector extension, which provides efficient similarity search capabilities. This technical foundation enables lightning-fast semantic queries across thousands of knowledge entries while maintaining accuracy and relevance.

### Creating and Managing Knowledge Entries

Adding information to your Knowledge Hub is intuitive and flexible. Each knowledge entry consists of a title, detailed content, category classification, content type designation, and optional tags for additional organization. The system supports various content types including references, best practices, tutorials, insights, and project documentation.

When creating entries, you can specify importance scores (0.0 to 1.0) that help the system prioritize information during retrieval. Higher importance scores ensure that critical information appears more prominently in search results and relationship mapping. The platform automatically tracks access patterns and updates importance scores based on how frequently you reference specific entries.

The content editor supports rich text formatting and can handle technical documentation, code snippets, mathematical formulas, and complex explanations. All entries are timestamped and versioned, allowing you to track changes and evolution of your knowledge base over time.

### 3D Visualization and Relationship Mapping

One of the Knowledge Hub's most compelling features is its 3D graph visualization, which transforms your information into an interactive, three-dimensional network. This visualization uses the react-force-graph-3d library to create an immersive representation of how your knowledge entries relate to each other.

In the 3D view, each knowledge entry appears as a node, with the size representing its importance score and connections showing semantic relationships discovered by the AI system. You can navigate through this space using mouse controls, zooming and rotating to explore different perspectives of your knowledge network.

The visualization reveals patterns and connections that might not be immediately obvious in traditional list-based interfaces. You might discover unexpected relationships between different topics, identify knowledge gaps, or find inspiration for new projects by exploring the interconnected nature of your information.

### Auto-Clustering and Smart Organization

The Knowledge Hub automatically groups related entries into clusters based on semantic similarity. This clustering happens in real-time as you add new information, ensuring your knowledge base remains organized without manual intervention. The system can identify clusters around topics like "web development frameworks," "machine learning algorithms," or "project management methodologies."

Each cluster is given a descriptive name generated by analyzing the common themes and concepts within grouped entries. You can view these clusters in the interface and use them for focused browsing or targeted searches within specific topic areas.

The clustering algorithm continuously learns from your content and search patterns, becoming more accurate and useful over time. This adaptive behavior means the system becomes increasingly aligned with your specific knowledge domains and interests.

### Advanced Search and Retrieval

The search functionality goes far beyond simple text matching. You can perform semantic searches using natural language queries, and the system will return relevant entries based on conceptual understanding. For instance, searching for "debugging techniques" will surface entries about error handling, testing strategies, and development tools, even if those exact terms don't appear in the content.

The search interface supports filtering by category, content type, importance score, and date ranges. You can also search within specific clusters or use boolean operators for complex queries. Search results are ranked by semantic relevance and can be further refined using the visual clustering interface.

Advanced users can leverage the API endpoints to programmatically search and retrieve knowledge, enabling integration with other tools and workflows. This flexibility makes the Knowledge Hub valuable for both interactive use and automated systems.

---

## Secure API Key Vault

The API Key Vault addresses one of the most critical challenges in modern development: secure credential management. This feature provides enterprise-grade security for storing, managing, and accessing API keys from over 20 major service providers, eliminating the risks associated with hardcoded credentials or insecure storage methods.

### Security Architecture and Encryption

The vault employs AES-256-CBC encryption, the same standard used by government agencies and financial institutions for protecting classified information. Each API key is encrypted using a unique initialization vector (IV), ensuring that even identical keys produce different encrypted output. The encryption keys are derived using scrypt, a memory-hard key derivation function that resists brute-force attacks.

Beyond encryption, the system implements multiple layers of security. API keys are never transmitted or stored in plain text, and the encryption keys are stored separately from the encrypted data. The vault maintains cryptographic hashes of each key for verification purposes without storing the actual key values. This architecture ensures that even with database access, attackers cannot recover your original API keys.

The security model includes comprehensive audit logging, tracking every access, modification, and test operation performed on your stored credentials. These logs help you monitor for unauthorized access and maintain compliance with security policies. All cryptographic operations use hardware-accelerated implementations when available, providing both security and performance benefits.

### Supported Service Providers

The vault comes pre-configured with support for 21 major API providers, each with custom validation rules and testing capabilities. These include essential services like OpenAI for artificial intelligence, GitHub for version control, AWS for cloud infrastructure, Stripe for payments, and SendGrid for email delivery.

Each provider configuration includes specific API key format validation, ensuring you can only store properly formatted credentials. For example, OpenAI keys must match the pattern "sk-proj-" followed by specific character requirements, while GitHub tokens follow the "ghp_" or "ghs_" format with exactly 36 characters.

The system understands the unique requirements of each provider, including required additional fields. For AWS, you can specify regions and access key IDs; for Airtable, you can store base IDs; for Twilio, account SIDs are maintained alongside the primary credentials. This comprehensive support eliminates the need for separate credential management systems.

### Key Testing and Validation

A standout feature of the vault is its ability to test stored API keys against their respective services. This functionality helps you verify that credentials are valid and properly configured before deploying them in production environments. The testing system makes lightweight API calls to each service's authentication endpoints.

For each provider, the system knows how to construct appropriate test requests. OpenAI keys are tested against the models endpoint, GitHub tokens are verified using the user profile API, and AWS credentials are validated through the STS (Security Token Service). These tests provide immediate feedback about key validity without exposing your credentials to potential security risks.

The testing results include detailed response information, helping you diagnose issues like expired keys, insufficient permissions, or rate limiting. Test results are logged in the security audit trail, providing a complete picture of credential health over time. This proactive monitoring helps prevent production failures due to credential issues.

### Usage Analytics and Monitoring

The vault provides comprehensive analytics about how your API keys are being accessed and used. The dashboard displays usage statistics, including access frequency, last used timestamps, and trends over time. This information helps you understand your API consumption patterns and identify unused or underutilized credentials.

Security monitoring features alert you to unusual access patterns that might indicate compromised credentials or unauthorized usage. The system tracks access by timestamp, IP address, and user agent, building profiles of normal usage that help detect anomalies. These insights are particularly valuable for teams managing multiple credentials across various projects.

The analytics also help with cost management by showing which services you're accessing most frequently. This data can inform decisions about service subscriptions, API plan upgrades, or credential rotation schedules. All analytics are generated from metadata and audit logs, ensuring your actual credentials remain secure throughout the analysis process.

### Key Rotation and Lifecycle Management

The vault includes intelligent recommendations for key rotation based on industry best practices and provider-specific guidelines. The system tracks key age and usage patterns to suggest optimal rotation schedules. For high-security environments, you can set automatic reminders for regular credential updates.

Key lifecycle management extends beyond simple storage to include features like expiration tracking, replacement workflows, and secure deletion. When you update a key, the system maintains encrypted backups of previous versions for a configurable period, enabling quick rollbacks if needed while ensuring old credentials are eventually purged for security.

The platform integrates with provider APIs where possible to streamline key rotation. For services that support programmatic key generation, the vault can assist with creating new credentials and automatically testing them before marking them as active. This automation reduces the manual effort and potential errors associated with credential management.

---

## Chat Interface

The chat interface represents Cartrita's natural language interaction capabilities, powered by advanced AI models and designed for both casual conversation and complex problem-solving. This feature transforms how you interact with information, allowing you to communicate with the platform using everyday language while accessing sophisticated AI capabilities.

### AI Model Integration and Capabilities

The chat system integrates multiple AI models, with OpenAI's GPT-4 serving as the primary conversational engine. This integration provides access to state-of-the-art natural language understanding, code generation, problem-solving, and creative assistance. The system is configured with optimal parameters for response quality while maintaining reasonable response times.

Beyond basic conversation, the chat interface can assist with coding problems, explain complex concepts, generate documentation, review and refactor code, and provide guidance on technical challenges. The AI understands context from previous messages in your conversation, enabling natural, flowing discussions about complex topics that build upon earlier exchanges.

The system includes specialized knowledge about software development, data science, system administration, and many other technical domains. This expertise makes it valuable for both learning new concepts and solving specific technical challenges. The AI can adapt its communication style based on your apparent expertise level, providing detailed explanations for beginners or concise technical responses for experts.

### Real-time Communication and WebSocket Technology

The chat interface uses WebSocket technology to provide real-time, bidirectional communication between your browser and the Cartrita servers. This implementation ensures that messages are delivered instantly without the delays associated with traditional HTTP polling, creating a natural conversation flow.

The WebSocket connection includes automatic reconnection logic, ensuring that temporary network interruptions don't disrupt your conversation. The system gracefully handles connection losses and restores your session seamlessly when connectivity returns. Message queuing ensures that no input is lost during disconnection periods.

Real-time typing indicators and message status updates keep you informed about the AI's processing state. When the AI is generating a response, you'll see appropriate loading indicators, and long responses are streamed back progressively, allowing you to read the beginning of an answer while the rest is still being generated.

### Message History and Context Management

All chat conversations are automatically saved and can be accessed through the chat history interface. This persistent storage allows you to return to previous conversations, reference earlier discussions, and maintain context across multiple sessions. The system organizes conversations chronologically and provides search functionality for finding specific exchanges.

Context management is sophisticated, maintaining awareness of your conversation history to provide relevant and coherent responses. The AI can reference earlier parts of your conversation, remember your preferences and working context, and build upon previous discussions naturally. This memory extends across sessions, so you can continue conversations even after logging out and back in.

The chat history includes metadata about each conversation, such as timestamps, message counts, and topic tags automatically generated based on the conversation content. This organization helps you navigate your history effectively and find relevant previous discussions when needed.

### Integration with Knowledge Hub

One of the chat interface's most powerful features is its integration with your Knowledge Hub. The AI can access and reference your stored knowledge entries during conversations, providing responses that incorporate your personal information alongside its general knowledge base.

When you ask questions related to topics in your Knowledge Hub, the system performs semantic searches to find relevant entries and incorporates that information into its responses. This integration means the AI becomes increasingly useful as you build your knowledge base, providing personalized assistance based on your specific information and expertise areas.

You can also use the chat interface to add information to your Knowledge Hub conversationally. Simply mention that you want to remember something, and the AI can help format and store that information appropriately. This natural workflow makes knowledge capture effortless and integrated into your normal conversation flow.

---

## Settings & Personalization

The settings system in Cartrita provides comprehensive customization options that allow you to tailor the platform to your specific preferences, workflow requirements, and accessibility needs. These personalization features ensure that your experience with Cartrita aligns perfectly with your working style and technical environment.

### Personality and Communication Preferences

The AI personality settings give you control over how the system communicates with you across all interfaces. The sarcasm slider (0-10) adjusts the AI's tendency to use wit and irony in responses, with higher settings producing more playful and irreverent interactions. This setting is particularly useful for creating a comfortable communication style that matches your personality.

Verbosity controls determine how detailed the AI's responses will be. Options include "concise" for brief, to-the-point answers; "normal" for balanced explanations with appropriate detail; and "detailed" for comprehensive responses with examples, context, and thorough explanations. This setting helps optimize the information density for your specific use cases and time constraints.

The humor setting influences the AI's use of jokes, wordplay, and lighthearted comments. Options range from "professional" for strictly business-focused interactions to "playful" for a more relaxed, entertaining communication style. This personalization helps create an atmosphere that enhances your productivity and enjoyment while using the platform.

### Visual Theme and Interface Customization

Cartrita's visual theme system allows you to customize the platform's appearance to match your preferences and working environment. The default "neon" theme features the signature cyberpunk aesthetic with cyan and pink accents against dark backgrounds, providing a modern, high-tech appearance that's easy on the eyes during extended use.

Alternative themes may include "professional" for more traditional business environments, "minimal" for distraction-free interfaces, and "high-contrast" for improved accessibility. Each theme is carefully designed to maintain usability while providing distinct visual experiences that can enhance your comfort and productivity.

The theme system affects all interface elements, including buttons, input fields, navigation elements, data visualizations, and modal dialogs. Consistent color schemes and typography ensure that theme changes create cohesive visual experiences throughout the platform without compromising functionality or readability.

### Audio and Interaction Preferences

Voice response settings control whether the AI provides audio feedback in addition to text responses. When enabled, the system uses advanced text-to-speech technology to read AI responses aloud, which can be particularly useful for multitasking or accessibility purposes. You can adjust the voice speed, pitch, and accent to match your preferences.

Ambient listening features allow the platform to respond to voice commands when enabled. This hands-free interaction mode can be particularly valuable when you're working with your hands or need to interact with the system while away from your keyboard. The system includes sophisticated noise filtering and wake word detection to minimize false activations.

Sound effects settings control various audio feedback elements throughout the interface. These include notification sounds for new messages, completion sounds for successful operations, error alerts for problems, and subtle interface sounds that provide auditory confirmation of user actions. All sound effects can be individually controlled or globally disabled for quiet environments.

### Language and Localization Options

The language setting determines the primary language for all interface elements and AI responses. While English is the default and most fully supported language, the system includes provisions for multiple language support with appropriate localization of interface text, date formats, and cultural conventions.

Language preferences also affect the AI's communication style, including idiomatic expressions, cultural references, and technical terminology preferences. The system can adapt its vocabulary and explanation style based on regional preferences and local conventions in technical fields.

Regional settings influence time zone displays, date formatting, number formatting, and currency preferences throughout the platform. These localization features ensure that all displayed information matches your local conventions and expectations, reducing cognitive load and potential confusion.

### Privacy and Security Settings

Advanced privacy settings give you control over data collection, usage analytics, and information sharing preferences. You can specify whether anonymized usage data can be used for platform improvement, control whether your interactions contribute to AI model training, and manage cookie preferences for tracking and personalization.

Security settings include options for two-factor authentication setup, session timeout preferences, and login notification controls. You can configure the system to alert you about new login sessions, unusual access patterns, or potential security concerns related to your account.

Data retention settings allow you to specify how long various types of information should be stored. You can set different retention periods for chat history, knowledge entries, API keys, and usage logs. These controls help you balance functionality with privacy preferences and compliance requirements.

---

## Troubleshooting

This troubleshooting section addresses common issues you might encounter while using Cartrita and provides step-by-step solutions to resolve them quickly. Understanding these solutions will help you maintain productive workflow and get the most value from the platform's features.

### Authentication and Login Issues

If you're experiencing login difficulties, first verify that you're using the correct email address and password combination. The platform uses case-sensitive password authentication, so ensure that your Caps Lock key is in the correct state and that you're entering your password exactly as you created it.

Browser-related authentication issues often stem from cookie restrictions, cached data conflicts, or third-party script blocking. Try clearing your browser's cache and cookies for the Cartrita domain, disabling browser extensions temporarily, or using an incognito/private browsing window to isolate the issue. Most modern browsers support the platform, but ensure you're using a recent version of Chrome, Firefox, Safari, or Edge.

Network-related authentication problems can occur with corporate firewalls, VPN services, or restrictive internet service providers. Check that your network allows HTTPS connections to the Cartrita domain and that WebSocket connections aren't being blocked. If you're using a VPN, try disconnecting temporarily to test whether it's affecting your connection.

Session timeout issues occur when your authentication token expires after 24 hours of inactivity. Simply log out and back in to refresh your session. If you're experiencing frequent unexpected logouts, check your browser's privacy settings to ensure that authentication cookies aren't being automatically deleted.

### Knowledge Hub Performance and Search Issues

Slow search performance in the Knowledge Hub can result from several factors. Large knowledge bases with thousands of entries may take longer to process complex semantic queries. Consider using more specific search terms or filtering by category or content type to narrow results and improve response times.

If semantic search isn't returning expected results, remember that the system uses AI-powered understanding rather than exact keyword matching. Try rephrasing your queries using different terminology or synonyms. The search algorithm learns from your interactions, so regularly used terms and successful search patterns will improve future results.

Vector embedding generation requires an active connection to OpenAI's services. If you're experiencing issues adding new knowledge entries, verify that your internet connection is stable and that OpenAI's services are operational. The platform includes fallback mechanisms, but optimal functionality requires reliable external API access.

Database connection issues can occasionally affect Knowledge Hub operations. These problems are typically temporary and resolve automatically. If you encounter persistent database errors, try refreshing your browser or waiting a few minutes before retrying the operation. Complex queries during high system load may require patience or retry attempts.

### API Key Vault Security and Access Issues

Encryption and decryption errors in the API Key Vault typically indicate database synchronization issues or corrupted encryption keys. These problems are serious and may require administrative intervention. If you cannot access stored API keys or receive encryption errors, document the exact error messages and contact technical support immediately.

API key testing failures can result from several causes: expired or invalid credentials, insufficient permissions for the test operations, rate limiting by the target service, or temporary service outages. Before assuming your keys are invalid, check the provider's status page and ensure that your account has necessary permissions for the test operations.

If newly added API keys aren't appearing in your vault, verify that the save operation completed successfully and that you're viewing the correct category or provider filter. The interface updates in real-time, but browser refresh might be necessary if you're experiencing synchronization issues between multiple browser tabs or sessions.

Access permission errors suggest that your account role doesn't include vault access, or that there are temporary authorization issues. Ensure you're logged in with the correct account and that your session hasn't expired. If problems persist, there may be a system-wide authorization issue requiring technical support.

### Chat Interface and Real-time Communication Problems

WebSocket connection failures prevent real-time chat functionality and typically manifest as delayed message delivery or "disconnected" status indicators. These issues often resolve automatically through the platform's reconnection logic, but you can manually trigger reconnection by refreshing your browser or toggling your network connection.

If chat messages aren't being delivered or responses seem delayed, check your internet connection stability and verify that your firewall or network security software isn't blocking WebSocket connections. Corporate networks and public Wi-Fi systems sometimes restrict these connection types for security reasons.

AI response generation problems can occur due to high system load, API rate limiting, or temporary issues with the underlying AI services. The platform includes queue management and retry logic, but complex queries during peak usage times may experience delays. If responses fail to generate, try simplifying your query or waiting a few minutes before retrying.

Chat history synchronization issues occasionally occur when switching between devices or browser sessions. The platform maintains server-side conversation storage, but local caching can sometimes become inconsistent. Logging out and back in typically resolves synchronization problems and ensures you have access to your complete conversation history.

### Browser Compatibility and Performance Optimization

Cartrita is optimized for modern web browsers and may not function properly in older browser versions. Ensure you're using Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+ for optimal functionality. Older browsers may experience compatibility issues with advanced features like 3D visualizations or real-time communications.

Performance issues on older or resource-constrained devices can affect the user experience, particularly with the 3D Knowledge Hub visualization. If you're experiencing slowdowns, try closing unnecessary browser tabs, disabling browser extensions, or using the platform's simplified interface modes when available.

JavaScript errors or blank screens typically indicate script loading failures or incompatible browser extensions. Check your browser's developer console for error messages, try disabling extensions, or use an incognito window to isolate the problem. Ad blockers and privacy extensions can sometimes interfere with platform functionality.

Memory usage optimization becomes important during extended sessions, particularly when working with large knowledge bases or maintaining long chat conversations. Periodically refreshing your browser or closing unused tabs can help maintain optimal performance during intensive usage sessions.

---

## Advanced Tips and Best Practices

### Maximizing Knowledge Hub Effectiveness

To get the most value from your Knowledge Hub, develop consistent tagging and categorization practices. Use descriptive, specific tags that reflect the content's purpose and domain. Consistent terminology helps the semantic search algorithms understand your organization system and return more relevant results.

Consider creating knowledge entries at different levels of detail: high-level overviews for quick reference, detailed technical documentation for thorough understanding, and quick tips or reminders for frequent tasks. This multi-layered approach ensures that you can find the right level of information for any situation.

Regularly review and update your knowledge entries to keep information current and accurate. The platform tracks access patterns, so you can identify frequently referenced entries that might benefit from expansion or entries that haven't been accessed recently and might need updating or removal.

### API Key Security Best Practices

Implement a regular key rotation schedule based on the sensitivity of each service and your organization's security policies. High-security environments should rotate keys monthly or quarterly, while less sensitive applications might use longer rotation periods. The vault's analytics help you track key age and usage patterns.

Use the key testing functionality proactively to identify expired or problematic credentials before they cause production issues. Set up regular testing schedules for critical services, and monitor the security audit logs for unusual access patterns that might indicate compromise.

Consider using the vault's importance scoring and categorization features to prioritize security attention on your most critical credentials. This systematic approach helps ensure that your most important API keys receive appropriate security focus and monitoring.

### Optimizing Chat Interactions

Develop effective prompting strategies by being specific about your needs, providing relevant context, and asking follow-up questions to refine responses. The AI performs better with clear, detailed queries than with vague or ambiguous requests.

Take advantage of the Knowledge Hub integration by asking the AI to reference your stored information during conversations. This personalization makes the AI increasingly useful as your knowledge base grows and becomes more comprehensive.

Use the chat interface for various tasks beyond simple questions: code review and debugging, brainstorming and ideation, learning new concepts with personalized explanations, and workflow planning and optimization. The versatility of the AI makes it valuable for many different aspects of your work.

---

*This manual represents the current version of Cartrita and its features. The platform continues to evolve with regular updates and improvements. For the most current information and feature updates, refer to the in-app help system or contact technical support.*