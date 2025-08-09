export default class LanguageMaestroAgent {
    name: string;
    personality: string;
    specializations: string[];
    hfService: HuggingFaceInferenceService | null;
    isInitialized: boolean;
    initialize(): Promise<boolean>;
    generateText(prompt: any, options?: {}): Promise<{
        agent: string;
        prompt: any;
        generatedText: any;
        parameters: {};
        timestamp: string;
    }>;
    classifyText(text: any, labels?: null, options?: {}): Promise<{
        agent: string;
        text: any;
        classifications: any;
        predictedLabel: any;
        timestamp: string;
        sentiment?: undefined;
        confidence?: undefined;
    } | {
        agent: string;
        text: any;
        classifications: {
            label: string;
            confidence: number;
        }[];
        sentiment: string;
        confidence: number;
        timestamp: string;
        predictedLabel?: undefined;
    }>;
    answerQuestion(question: any, context: any, options?: {}): Promise<{
        agent: string;
        question: any;
        context: string;
        answer: string;
        confidence: number;
        startIndex: number;
        endIndex: number;
        timestamp: string;
    }>;
    summarizeText(text: any, options?: {}): Promise<{
        agent: string;
        originalLength: any;
        summary: any;
        compressionRatio: number;
        timestamp: string;
    }>;
    translateText(text: any, options?: {}): Promise<{
        agent: string;
        originalText: any;
        translatedText: any;
        sourceLang: any;
        targetLang: any;
        model: any;
        timestamp: string;
    }>;
    extractEntities(text: any, options?: {}): Promise<{
        agent: string;
        text: any;
        entities: {
            word: string;
            entity: any;
            confidence: number;
            start: number;
            end: number;
        }[];
        timestamp: string;
    }>;
    fillInBlanks(text: any, options?: {}): Promise<{
        agent: string;
        originalText: any;
        predictions: {
            token: string;
            confidence: number;
            sequence: string;
        }[];
        topPrediction: {
            score: number;
            sequence: string;
            token: number;
            token_str: string;
        };
        timestamp: string;
    }>;
    compareSentences(sentences: any, options?: {}): Promise<{
        agent: string;
        sentences: any;
        similarities: import("@huggingface/inference").SentenceSimilarityOutput;
        mostSimilar: number;
        leastSimilar: number;
        timestamp: string;
    }>;
    analyzeText(text: any, analysisType?: string, options?: {}): Promise<{
        agent: string;
        analysisType: string;
        timestamp: string;
        results: {};
    }>;
    getTranslationModel(sourceLang: any, targetLang: any): any;
    generateResponse(userMessage: any, context?: {}): string;
    getCapabilities(): {
        name: string;
        personality: string;
        specializations: string[];
        features: string[];
    };
}
import HuggingFaceInferenceService from '../services/HuggingFaceInferenceService.js';
