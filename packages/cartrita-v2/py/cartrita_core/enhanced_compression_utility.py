"""
Enhanced Summarization Compression Utility
Advanced context compression with failure recovery and quality assurance
"""

import asyncio
import json
import logging
import math
import hashlib
import time
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Union, Tuple, Set
from datetime import datetime, timezone
from enum import Enum
import re
from pathlib import Path

try:
    import numpy as np
except ImportError:
    # Fallback to basic math
    import math
    np = None

from openai import AsyncOpenAI
from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)


class CompressionStrategy(str, Enum):
    """Compression strategies"""
    EXTRACTIVE_ONLY = "extractive_only"
    ABSTRACTIVE_ONLY = "abstractive_only"
    HYBRID = "hybrid"
    ADAPTIVE = "adaptive"


class QualityMetric(str, Enum):
    """Quality assessment metrics"""
    SEMANTIC_SIMILARITY = "semantic_similarity"
    INFORMATION_PRESERVATION = "information_preservation"
    COHERENCE = "coherence"
    FACTUAL_CONSISTENCY = "factual_consistency"
    COMPRESSION_RATIO = "compression_ratio"


class SegmentType(str, Enum):
    """Types of content segments"""
    SYSTEM_MESSAGE = "system"
    USER_MESSAGE = "user"
    ASSISTANT_MESSAGE = "assistant"
    CODE_BLOCK = "code"
    CONSTRAINT = "constraint"
    DECISION = "decision"
    QUESTION = "question"
    FACTUAL_DATA = "factual"
    CONTEXT = "context"


@dataclass
class ContentSegment:
    """Represents a segment of content for compression"""
    id: str
    text: str
    segment_type: SegmentType
    token_count: int
    importance_score: float = 0.0
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Quality metrics
    novelty_score: float = 1.0
    recency_score: float = 1.0
    relevance_score: float = 0.0
    critical_score: float = 0.0
    
    # Processing flags
    must_keep: bool = False
    can_summarize: bool = True
    is_duplicate: bool = False
    
    @property
    def final_score(self) -> float:
        """Calculate final importance score"""
        return (
            self.importance_score * 0.3 +
            self.relevance_score * 0.25 +
            self.critical_score * 0.2 +
            self.recency_score * 0.15 +
            self.novelty_score * 0.1
        )


@dataclass
class CompressionResult:
    """Result of compression operation"""
    success: bool
    original_tokens: int
    compressed_tokens: int
    compression_ratio: float
    strategy_used: CompressionStrategy
    quality_metrics: Dict[QualityMetric, float] = field(default_factory=dict)
    
    # Content
    compressed_content: str = ""
    structured_memory: Dict[str, Any] = field(default_factory=dict)
    retained_segments: List[str] = field(default_factory=list)
    summarized_segments: List[str] = field(default_factory=list)
    
    # Metadata
    processing_time_ms: float = 0.0
    warnings: List[str] = field(default_factory=list)
    fallback_used: bool = False
    error_message: Optional[str] = None


@dataclass
class CompressionConfig:
    """Configuration for compression behavior"""
    target_token_budget: int = 2000
    max_token_budget: int = 3000
    min_compression_ratio: float = 0.5
    
    # Strategy selection
    strategy: CompressionStrategy = CompressionStrategy.ADAPTIVE
    fallback_strategy: CompressionStrategy = CompressionStrategy.EXTRACTIVE_ONLY
    
    # Quality thresholds
    min_semantic_similarity: float = 0.7
    min_information_preservation: float = 0.8
    min_coherence: float = 0.6
    
    # Processing parameters
    enable_embeddings: bool = True
    enable_quality_validation: bool = True
    max_retries: int = 2
    timeout_seconds: float = 30.0
    
    # Model selection
    compression_model: str = "gpt-5-mini"
    quality_model: str = "gpt-5-mini"
    embedding_model: str = "text-embedding-3-small"
    
    # Safety settings
    preserve_all_constraints: bool = True
    preserve_all_decisions: bool = True
    preserve_unanswered_questions: bool = True


class AdvancedTokenEstimator:
    """Enhanced token estimation with model-specific counting"""
    
    def __init__(self):
        # Rough token-to-character ratios for different models
        self.token_ratios = {
            'gpt-5': 0.25,      # ~4 chars per token
            'gpt-5-mini': 0.25,
            'gpt-5-nano': 0.25,
            'gpt-4': 0.25,
            'default': 0.25
        }
    
    def estimate_tokens(self, text: str, model: str = "default") -> int:
        """Estimate token count for text"""
        if not text:
            return 0
        
        ratio = self.token_ratios.get(model, self.token_ratios['default'])
        
        # More sophisticated estimation
        char_count = len(text)
        word_count = len(text.split())
        
        # Adjust for special tokens and punctuation
        special_char_count = len(re.findall(r'[^\w\s]', text))
        
        # Base estimate from characters
        base_estimate = char_count * ratio
        
        # Adjust based on word density (more words = more tokens typically)
        word_adjustment = word_count * 1.3
        
        # Penalty for special characters (JSON, code, etc.)
        special_adjustment = special_char_count * 0.5
        
        return max(1, int(base_estimate + word_adjustment * 0.1 + special_adjustment * 0.05))


class SemanticAnalyzer:
    """Analyzes semantic similarity and content relationships"""
    
    def __init__(self, client: AsyncOpenAI, embedding_model: str = "text-embedding-3-small"):
        self.client = client
        self.embedding_model = embedding_model
        self._embedding_cache: Dict[str, List[float]] = {}
    
    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for text with caching"""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        
        if text_hash in self._embedding_cache:
            return self._embedding_cache[text_hash]
        
        try:
            response = await self.client.embeddings.create(
                model=self.embedding_model,
                input=text[:8000]  # Truncate for embedding limits
            )
            
            embedding = response.data[0].embedding
            self._embedding_cache[text_hash] = embedding
            return embedding
            
        except Exception as e:
            logger.warning(f"Failed to get embedding: {e}")
            # Return dummy embedding
            return [0.0] * 1536
    
    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between embeddings"""
        if not a or not b or len(a) != len(b):
            return 0.0
        
        if np is not None:
            # Use NumPy if available
            a_np = np.array(a)
            b_np = np.array(b)
            
            norm_a = np.linalg.norm(a_np)
            norm_b = np.linalg.norm(b_np)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return float(np.dot(a_np, b_np) / (norm_a * norm_b))
        else:
            # Fallback to pure Python
            dot_product = sum(x * y for x, y in zip(a, b))
            norm_a = math.sqrt(sum(x * x for x in a))
            norm_b = math.sqrt(sum(y * y for y in b))
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return dot_product / (norm_a * norm_b)
    
    async def assess_semantic_preservation(
        self, 
        original_segments: List[ContentSegment], 
        compressed_text: str
    ) -> float:
        """Assess how well compressed text preserves original semantics"""
        if not original_segments:
            return 1.0
        
        # Get embeddings
        original_texts = [seg.text for seg in original_segments if seg.must_keep or seg.importance_score > 0.7]
        if not original_texts:
            return 1.0
        
        original_combined = " ".join(original_texts)
        
        original_embedding = await self.get_embedding(original_combined)
        compressed_embedding = await self.get_embedding(compressed_text)
        
        return self.cosine_similarity(original_embedding, compressed_embedding)


class ContentClassifier:
    """Classifies and scores content segments"""
    
    def __init__(self):
        # Keyword patterns for different content types
        self.patterns = {
            SegmentType.CONSTRAINT: [
                r'\bmust\b', r'\brequire[ds]?\b', r'\bmandatory\b', 
                r'\bshall\b', r'\bobligation\b', r'\bcompulsory\b',
                r'\bstrict\b', r'\benforce\b', r'\bprohibit\b'
            ],
            SegmentType.DECISION: [
                r'\bdecid[ed]?\b', r'\bchosen?\b', r'\bselect[ed]?\b',
                r'\bapproved?\b', r'\bfinalize?d?\b', r'\bdetermine[ds]?\b',
                r'\bresolved?\b', r'\bconclude[ds]?\b'
            ],
            SegmentType.QUESTION: [
                r'\?', r'\bwhat\b', r'\bhow\b', r'\bwhy\b', r'\bwhen\b',
                r'\bwhere\b', r'\bwhich\b', r'\bcan\b', r'\bwill\b',
                r'\bshould\b', r'\bcould\b', r'\bwould\b'
            ],
            SegmentType.CODE_BLOCK: [
                r'```', r'def\s+\w+', r'class\s+\w+', r'import\s+\w+',
                r'function\s+\w+', r'var\s+\w+', r'const\s+\w+',
                r'public\s+class', r'@\w+'
            ]
        }
    
    def classify_segment(self, text: str, role: str = "user") -> SegmentType:
        """Classify content segment by type"""
        text_lower = text.lower()
        
        # Role-based classification first
        if role == "system":
            return SegmentType.SYSTEM_MESSAGE
        elif role == "user":
            base_type = SegmentType.USER_MESSAGE
        elif role == "assistant":
            base_type = SegmentType.ASSISTANT_MESSAGE
        else:
            base_type = SegmentType.CONTEXT
        
        # Pattern-based refinement
        for segment_type, patterns in self.patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    return segment_type
        
        return base_type
    
    def calculate_critical_score(self, text: str, segment_type: SegmentType) -> float:
        """Calculate critical importance score"""
        score = 0.0
        text_lower = text.lower()
        
        # Base scores by type
        type_scores = {
            SegmentType.CONSTRAINT: 0.9,
            SegmentType.DECISION: 0.8,
            SegmentType.QUESTION: 0.7,
            SegmentType.SYSTEM_MESSAGE: 0.8,
            SegmentType.CODE_BLOCK: 0.6,
            SegmentType.FACTUAL_DATA: 0.5,
            SegmentType.CONTEXT: 0.3,
            SegmentType.USER_MESSAGE: 0.4,
            SegmentType.ASSISTANT_MESSAGE: 0.4
        }
        
        score += type_scores.get(segment_type, 0.3)
        
        # Keyword-based boosts
        critical_keywords = [
            ('error', 0.3), ('fail', 0.3), ('urgent', 0.4),
            ('critical', 0.4), ('important', 0.3), ('deadline', 0.4),
            ('security', 0.4), ('compliance', 0.4), ('legal', 0.4),
            ('privacy', 0.4), ('data', 0.2), ('api key', 0.5),
            ('password', 0.5), ('token', 0.3)
        ]
        
        for keyword, boost in critical_keywords:
            if keyword in text_lower:
                score += boost
        
        # Length penalty for very long segments
        if len(text) > 2000:
            score *= 0.9
        
        return min(1.0, score)


class QualityValidator:
    """Validates compression quality and suggests improvements"""
    
    def __init__(self, client: AsyncOpenAI, config: CompressionConfig):
        self.client = client
        self.config = config
        self.semantic_analyzer = SemanticAnalyzer(client)
    
    async def validate_compression(
        self,
        original_segments: List[ContentSegment],
        compressed_text: str,
        structured_memory: Dict[str, Any]
    ) -> Dict[QualityMetric, float]:
        """Validate compression quality across multiple metrics"""
        
        metrics = {}
        
        # Semantic similarity
        metrics[QualityMetric.SEMANTIC_SIMILARITY] = await self.semantic_analyzer.assess_semantic_preservation(
            original_segments, compressed_text
        )
        
        # Information preservation (structural check)
        metrics[QualityMetric.INFORMATION_PRESERVATION] = self._assess_information_preservation(
            original_segments, structured_memory
        )
        
        # Coherence (text quality)
        metrics[QualityMetric.COHERENCE] = await self._assess_coherence(compressed_text)
        
        # Factual consistency
        metrics[QualityMetric.FACTUAL_CONSISTENCY] = await self._assess_factual_consistency(
            original_segments, compressed_text
        )
        
        # Compression ratio
        original_tokens = sum(seg.token_count for seg in original_segments)
        compressed_tokens = len(compressed_text.split()) // 0.75  # Rough estimate
        metrics[QualityMetric.COMPRESSION_RATIO] = compressed_tokens / max(1, original_tokens)
        
        return metrics
    
    def _assess_information_preservation(
        self,
        original_segments: List[ContentSegment],
        structured_memory: Dict[str, Any]
    ) -> float:
        """Assess how well structured information is preserved"""
        
        # Count critical segments
        critical_segments = [seg for seg in original_segments if seg.must_keep or seg.critical_score > 0.8]
        
        if not critical_segments:
            return 1.0
        
        # Check preservation in structured memory
        preserved_count = 0
        
        for seg in critical_segments:
            segment_preserved = False
            
            # Check if segment content appears in any structured field
            for field_name, field_value in structured_memory.items():
                if isinstance(field_value, list):
                    for item in field_value:
                        if isinstance(item, str) and len(item) > 10:
                            if self._text_similarity(seg.text, item) > 0.7:
                                segment_preserved = True
                                break
                elif isinstance(field_value, str) and len(field_value) > 10:
                    if self._text_similarity(seg.text, field_value) > 0.7:
                        segment_preserved = True
            
            if segment_preserved:
                preserved_count += 1
        
        return preserved_count / len(critical_segments)
    
    def _text_similarity(self, text1: str, text2: str) -> float:
        """Simple text similarity based on common words"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    async def _assess_coherence(self, text: str) -> float:
        """Assess text coherence and readability"""
        if len(text) < 50:
            return 1.0
        
        try:
            # Use model to assess coherence
            response = await self.client.chat.completions.create(
                model=self.config.quality_model,
                messages=[
                    {
                        "role": "user",
                        "content": f"""Rate the coherence and readability of this text on a scale of 0-10, where 10 is perfectly coherent and readable.

Text to evaluate:
{text[:1500]}

Respond with just the number (e.g., "8.5")."""
                    }
                ],
                max_tokens=10,
                temperature=0.1
            )
            
            rating_text = response.choices[0].message.content.strip()
            rating = float(re.search(r'[\d.]+', rating_text).group())
            return min(1.0, rating / 10.0)
            
        except Exception as e:
            logger.warning(f"Failed to assess coherence: {e}")
            return 0.7  # Default assumption
    
    async def _assess_factual_consistency(
        self,
        original_segments: List[ContentSegment],
        compressed_text: str
    ) -> float:
        """Check for factual consistency between original and compressed"""
        
        # Extract factual claims from original
        factual_segments = [
            seg for seg in original_segments 
            if seg.segment_type in [SegmentType.FACTUAL_DATA, SegmentType.DECISION] 
            and seg.importance_score > 0.6
        ]
        
        if not factual_segments:
            return 1.0
        
        try:
            # Use model to check consistency
            original_facts = "\n".join([seg.text for seg in factual_segments[:5]])
            
            response = await self.client.chat.completions.create(
                model=self.config.quality_model,
                messages=[
                    {
                        "role": "user",
                        "content": f"""Check if the compressed text is factually consistent with the original facts. Rate consistency from 0-10.

Original facts:
{original_facts}

Compressed text:
{compressed_text[:1000]}

Respond with just the consistency rating (e.g., "9.2")."""
                    }
                ],
                max_tokens=10,
                temperature=0.1
            )
            
            rating_text = response.choices[0].message.content.strip()
            rating = float(re.search(r'[\d.]+', rating_text).group())
            return min(1.0, rating / 10.0)
            
        except Exception as e:
            logger.warning(f"Failed to assess factual consistency: {e}")
            return 0.8  # Conservative default


class EnhancedContextCompressor:
    """Main compression engine with advanced failure handling"""
    
    def __init__(
        self, 
        client: AsyncOpenAI, 
        config: Optional[CompressionConfig] = None
    ):
        self.client = client
        self.config = config or CompressionConfig()
        self.token_estimator = AdvancedTokenEstimator()
        self.classifier = ContentClassifier()
        self.quality_validator = QualityValidator(client, self.config)
        self.semantic_analyzer = SemanticAnalyzer(client, self.config.embedding_model)
        
        # Statistics
        self.stats = {
            'total_compressions': 0,
            'successful_compressions': 0,
            'fallback_compressions': 0,
            'avg_compression_ratio': 0.0,
            'avg_quality_score': 0.0
        }
    
    async def compress_context(
        self,
        messages: List[Dict[str, Any]],
        query: str = "",
        user_context: Optional[Dict[str, Any]] = None
    ) -> CompressionResult:
        """Compress conversation context with enhanced error handling"""
        
        start_time = time.time()
        self.stats['total_compressions'] += 1
        
        try:
            # Segment input messages
            segments = await self._segment_messages(messages, query)
            
            if not segments:
                return CompressionResult(
                    success=False,
                    original_tokens=0,
                    compressed_tokens=0,
                    compression_ratio=1.0,
                    strategy_used=self.config.strategy,
                    error_message="No content to compress"
                )
            
            original_token_count = sum(seg.token_count for seg in segments)
            
            # Check if compression is needed
            if original_token_count <= self.config.target_token_budget:
                return self._create_no_compression_result(segments, original_token_count, start_time)
            
            # Attempt compression with primary strategy
            result = await self._attempt_compression(segments, query, user_context)
            
            # Validate quality if enabled
            if self.config.enable_quality_validation and result.success:
                quality_metrics = await self.quality_validator.validate_compression(
                    segments, result.compressed_content, result.structured_memory
                )
                result.quality_metrics = quality_metrics
                
                # Check quality thresholds
                if not self._meets_quality_thresholds(quality_metrics):
                    logger.warning("Compression failed quality validation, attempting fallback")
                    result = await self._attempt_fallback_compression(segments, query, user_context)
            
            # Update statistics
            result.processing_time_ms = (time.time() - start_time) * 1000
            self._update_stats(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Compression failed with error: {e}")
            return CompressionResult(
                success=False,
                original_tokens=len(" ".join([msg.get("content", "") for msg in messages]).split()),
                compressed_tokens=0,
                compression_ratio=1.0,
                strategy_used=self.config.strategy,
                processing_time_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            )
    
    async def _segment_messages(
        self,
        messages: List[Dict[str, Any]],
        query: str
    ) -> List[ContentSegment]:
        """Convert messages into classified segments"""
        
        segments = []
        query_embedding = None
        
        if query and self.config.enable_embeddings:
            query_embedding = await self.semantic_analyzer.get_embedding(query)
        
        for i, msg in enumerate(messages):
            content = msg.get("content", "")
            if not content or len(content.strip()) < 3:
                continue
            
            role = msg.get("role", "user")
            segment_type = self.classifier.classify_segment(content, role)
            token_count = self.token_estimator.estimate_tokens(content, self.config.compression_model)
            
            segment = ContentSegment(
                id=f"seg_{i}",
                text=content,
                segment_type=segment_type,
                token_count=token_count,
                metadata={"role": role, "index": i}
            )
            
            # Calculate importance scores
            segment.critical_score = self.classifier.calculate_critical_score(content, segment_type)
            segment.recency_score = self._calculate_recency_score(i, len(messages))
            
            # Get embedding and relevance if enabled
            if self.config.enable_embeddings:
                segment.embedding = await self.semantic_analyzer.get_embedding(content)
                if query_embedding:
                    segment.relevance_score = self.semantic_analyzer.cosine_similarity(
                        segment.embedding, query_embedding
                    )
            
            # Determine if segment must be kept
            segment.must_keep = (
                segment.segment_type in [SegmentType.CONSTRAINT, SegmentType.DECISION] and
                self.config.preserve_all_constraints
            ) or (
                segment.segment_type == SegmentType.QUESTION and
                self.config.preserve_unanswered_questions
            ) or segment.critical_score > 0.9
            
            segments.append(segment)
        
        # Calculate novelty scores (detect duplicates)
        await self._calculate_novelty_scores(segments)
        
        return segments
    
    def _calculate_recency_score(self, index: int, total: int) -> float:
        """Calculate recency score with decay"""
        if total <= 1:
            return 1.0
        
        # Exponential decay from most recent
        position_from_end = total - 1 - index
        decay_rate = 0.1
        return math.exp(-decay_rate * position_from_end)
    
    async def _calculate_novelty_scores(self, segments: List[ContentSegment]):
        """Calculate novelty scores and mark duplicates"""
        if not self.config.enable_embeddings:
            return
        
        for i, segment in enumerate(segments):
            segment.novelty_score = 1.0
            
            for j, other in enumerate(segments):
                if i != j and segment.embedding and other.embedding:
                    similarity = self.semantic_analyzer.cosine_similarity(
                        segment.embedding, other.embedding
                    )
                    
                    if similarity > 0.9:  # Very similar
                        # Keep the more recent one
                        if i < j:  # Current segment is older
                            segment.is_duplicate = True
                            segment.novelty_score = 0.1
                        break
    
    async def _attempt_compression(
        self,
        segments: List[ContentSegment],
        query: str,
        user_context: Optional[Dict[str, Any]]
    ) -> CompressionResult:
        """Attempt compression with the configured strategy"""
        
        try:
            if self.config.strategy == CompressionStrategy.EXTRACTIVE_ONLY:
                return await self._extractive_compression(segments, query)
            elif self.config.strategy == CompressionStrategy.ABSTRACTIVE_ONLY:
                return await self._abstractive_compression(segments, query, user_context)
            elif self.config.strategy == CompressionStrategy.HYBRID:
                return await self._hybrid_compression(segments, query, user_context)
            else:  # ADAPTIVE
                return await self._adaptive_compression(segments, query, user_context)
                
        except Exception as e:
            logger.error(f"Primary compression strategy failed: {e}")
            raise
    
    async def _extractive_compression(
        self,
        segments: List[ContentSegment],
        query: str
    ) -> CompressionResult:
        """Pure extractive compression - select best segments"""
        
        # Separate must-keep segments
        must_keep_segments = [seg for seg in segments if seg.must_keep and not seg.is_duplicate]
        selectable_segments = [seg for seg in segments if not seg.must_keep and not seg.is_duplicate]
        
        must_keep_tokens = sum(seg.token_count for seg in must_keep_segments)
        remaining_budget = max(0, self.config.target_token_budget - must_keep_tokens)
        
        # Sort selectable segments by final score
        selectable_segments.sort(key=lambda x: x.final_score, reverse=True)
        
        selected_segments = must_keep_segments.copy()
        used_tokens = must_keep_tokens
        
        # Greedy selection
        for segment in selectable_segments:
            if used_tokens + segment.token_count <= remaining_budget:
                selected_segments.append(segment)
                used_tokens += segment.token_count
        
        # Build structured memory
        structured_memory = self._build_structured_memory(selected_segments, [])
        
        # Create compressed content
        compressed_content = self._format_selected_segments(selected_segments)
        
        original_tokens = sum(seg.token_count for seg in segments)
        compressed_tokens = sum(seg.token_count for seg in selected_segments)
        
        return CompressionResult(
            success=True,
            original_tokens=original_tokens,
            compressed_tokens=compressed_tokens,
            compression_ratio=compressed_tokens / max(1, original_tokens),
            strategy_used=CompressionStrategy.EXTRACTIVE_ONLY,
            compressed_content=compressed_content,
            structured_memory=structured_memory,
            retained_segments=[seg.id for seg in selected_segments],
            summarized_segments=[]
        )
    
    async def _abstractive_compression(
        self,
        segments: List[ContentSegment],
        query: str,
        user_context: Optional[Dict[str, Any]]
    ) -> CompressionResult:
        """Pure abstractive compression using LLM summarization"""
        
        # Group segments by type and importance
        critical_segments = [seg for seg in segments if seg.must_keep or seg.critical_score > 0.8]
        other_segments = [seg for seg in segments if seg not in critical_segments and not seg.is_duplicate]
        
        # Create summarization prompt
        prompt = self._create_summarization_prompt(segments, query, user_context)
        
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.config.compression_model,
                    messages=[
                        {"role": "system", "content": "You are an expert at compressing and summarizing conversations while preserving critical information."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=self.config.target_token_budget
                ),
                timeout=self.config.timeout_seconds
            )
            
            compressed_content = response.choices[0].message.content
            compressed_tokens = self.token_estimator.estimate_tokens(compressed_content)
            
            # Build structured memory from critical segments
            structured_memory = self._build_structured_memory(critical_segments, other_segments)
            
            original_tokens = sum(seg.token_count for seg in segments)
            
            return CompressionResult(
                success=True,
                original_tokens=original_tokens,
                compressed_tokens=compressed_tokens,
                compression_ratio=compressed_tokens / max(1, original_tokens),
                strategy_used=CompressionStrategy.ABSTRACTIVE_ONLY,
                compressed_content=compressed_content,
                structured_memory=structured_memory,
                retained_segments=[],
                summarized_segments=[seg.id for seg in segments]
            )
            
        except asyncio.TimeoutError:
            raise Exception("Abstractive compression timed out")
        except Exception as e:
            raise Exception(f"Abstractive compression failed: {e}")
    
    async def _hybrid_compression(
        self,
        segments: List[ContentSegment],
        query: str,
        user_context: Optional[Dict[str, Any]]
    ) -> CompressionResult:
        """Hybrid approach: keep critical segments, summarize others"""
        
        # Separate critical and summarizable segments
        critical_segments = [seg for seg in segments if seg.must_keep or seg.final_score > 0.8]
        summarizable_segments = [seg for seg in segments if seg not in critical_segments and seg.can_summarize]
        
        critical_tokens = sum(seg.token_count for seg in critical_segments)
        remaining_budget = max(100, self.config.target_token_budget - critical_tokens)
        
        # Summarize the summarizable segments
        summary = ""
        if summarizable_segments and remaining_budget > 100:
            summary_prompt = self._create_targeted_summary_prompt(
                summarizable_segments, query, remaining_budget // 2
            )
            
            try:
                response = await self.client.chat.completions.create(
                    model=self.config.compression_model,
                    messages=[
                        {"role": "system", "content": "Summarize the provided content concisely while preserving key information."},
                        {"role": "user", "content": summary_prompt}
                    ],
                    temperature=0.2,
                    max_tokens=remaining_budget // 2
                )
                
                summary = response.choices[0].message.content
                
            except Exception as e:
                logger.warning(f"Hybrid summarization failed: {e}")
                # Fall back to extractive for summarizable segments
                budget_per_segment = remaining_budget // max(1, len(summarizable_segments))
                selected_summarizable = []
                for seg in sorted(summarizable_segments, key=lambda x: x.final_score, reverse=True):
                    if sum(s.token_count for s in selected_summarizable) + seg.token_count <= remaining_budget:
                        selected_summarizable.append(seg)
                summary = self._format_selected_segments(selected_summarizable)
        
        # Combine critical segments and summary
        critical_content = self._format_selected_segments(critical_segments)
        compressed_content = f"{critical_content}\n\n--- Summary of Additional Context ---\n{summary}" if summary else critical_content
        
        compressed_tokens = self.token_estimator.estimate_tokens(compressed_content)
        original_tokens = sum(seg.token_count for seg in segments)
        
        # Build structured memory
        structured_memory = self._build_structured_memory(critical_segments, summarizable_segments)
        
        return CompressionResult(
            success=True,
            original_tokens=original_tokens,
            compressed_tokens=compressed_tokens,
            compression_ratio=compressed_tokens / max(1, original_tokens),
            strategy_used=CompressionStrategy.HYBRID,
            compressed_content=compressed_content,
            structured_memory=structured_memory,
            retained_segments=[seg.id for seg in critical_segments],
            summarized_segments=[seg.id for seg in summarizable_segments]
        )
    
    async def _adaptive_compression(
        self,
        segments: List[ContentSegment],
        query: str,
        user_context: Optional[Dict[str, Any]]
    ) -> CompressionResult:
        """Adaptive compression - choose strategy based on content"""
        
        total_tokens = sum(seg.token_count for seg in segments)
        critical_ratio = sum(seg.token_count for seg in segments if seg.must_keep) / max(1, total_tokens)
        
        # Decision logic for strategy selection
        if critical_ratio > 0.7:
            # Mostly critical content - use extractive
            return await self._extractive_compression(segments, query)
        elif total_tokens > self.config.target_token_budget * 2:
            # Heavy compression needed - use abstractive
            return await self._abstractive_compression(segments, query, user_context)
        else:
            # Moderate compression - use hybrid
            return await self._hybrid_compression(segments, query, user_context)
    
    async def _attempt_fallback_compression(
        self,
        segments: List[ContentSegment],
        query: str,
        user_context: Optional[Dict[str, Any]]
    ) -> CompressionResult:
        """Attempt compression with fallback strategy"""
        
        logger.info(f"Attempting fallback compression with {self.config.fallback_strategy}")
        
        try:
            original_strategy = self.config.strategy
            self.config.strategy = self.config.fallback_strategy
            
            result = await self._attempt_compression(segments, query, user_context)
            result.fallback_used = True
            result.warnings.append("Primary compression strategy failed, used fallback")
            
            self.config.strategy = original_strategy  # Restore
            return result
            
        except Exception as e:
            logger.error(f"Fallback compression also failed: {e}")
            # Ultimate fallback - simple truncation
            return self._emergency_truncation(segments)
    
    def _emergency_truncation(self, segments: List[ContentSegment]) -> CompressionResult:
        """Emergency fallback - simple truncation"""
        
        must_keep = [seg for seg in segments if seg.must_keep]
        must_keep_tokens = sum(seg.token_count for seg in must_keep)
        
        if must_keep_tokens <= self.config.target_token_budget:
            remaining_budget = self.config.target_token_budget - must_keep_tokens
            other_segments = [seg for seg in segments if not seg.must_keep]
            other_segments.sort(key=lambda x: x.final_score, reverse=True)
            
            selected_other = []
            used_tokens = 0
            
            for seg in other_segments:
                if used_tokens + seg.token_count <= remaining_budget:
                    selected_other.append(seg)
                    used_tokens += seg.token_count
            
            selected_segments = must_keep + selected_other
        else:
            # Even must-keep segments exceed budget - truncate them
            selected_segments = must_keep[:self.config.target_token_budget // 200]  # Rough segment limit
        
        compressed_content = self._format_selected_segments(selected_segments)
        compressed_tokens = sum(seg.token_count for seg in selected_segments)
        original_tokens = sum(seg.token_count for seg in segments)
        
        return CompressionResult(
            success=True,
            original_tokens=original_tokens,
            compressed_tokens=compressed_tokens,
            compression_ratio=compressed_tokens / max(1, original_tokens),
            strategy_used=CompressionStrategy.EXTRACTIVE_ONLY,
            compressed_content=compressed_content,
            structured_memory=self._build_structured_memory(selected_segments, []),
            retained_segments=[seg.id for seg in selected_segments],
            fallback_used=True,
            warnings=["Emergency truncation fallback used"]
        )
    
    def _create_summarization_prompt(
        self,
        segments: List[ContentSegment],
        query: str,
        user_context: Optional[Dict[str, Any]]
    ) -> str:
        """Create prompt for abstractive summarization"""
        
        content_by_type = {}
        for seg in segments:
            seg_type = seg.segment_type.value
            if seg_type not in content_by_type:
                content_by_type[seg_type] = []
            content_by_type[seg_type].append(seg.text)
        
        prompt_parts = [
            f"Compress and summarize the following conversation content into approximately {self.config.target_token_budget // 4} words.",
            f"Focus on information relevant to: {query}" if query else "Focus on the most important information.",
            ""
        ]
        
        for seg_type, contents in content_by_type.items():
            prompt_parts.append(f"--- {seg_type.upper()} CONTENT ---")
            for i, content in enumerate(contents[:5]):  # Limit to avoid overly long prompts
                prompt_parts.append(f"{i+1}. {content}")
            prompt_parts.append("")
        
        if user_context:
            prompt_parts.append(f"Additional context: {user_context}")
            prompt_parts.append("")
        
        prompt_parts.extend([
            "REQUIREMENTS:",
            "- Preserve all critical decisions, constraints, and unanswered questions",
            "- Maintain factual accuracy",
            "- Use clear, concise language",
            "- Organize information logically"
        ])
        
        return "\n".join(prompt_parts)
    
    def _create_targeted_summary_prompt(
        self,
        segments: List[ContentSegment],
        query: str,
        max_tokens: int
    ) -> str:
        """Create focused summary prompt for specific segments"""
        
        content = "\n\n".join([f"[{seg.segment_type.value}] {seg.text}" for seg in segments[:10]])
        
        return f"""Summarize this content in approximately {max_tokens // 4} words, focusing on information relevant to: "{query}"

Content to summarize:
{content}

Requirements:
- Preserve key facts and decisions
- Use bullet points for clarity
- Maintain chronological order where relevant"""
    
    def _build_structured_memory(
        self,
        retained_segments: List[ContentSegment],
        summarized_segments: List[ContentSegment]
    ) -> Dict[str, Any]:
        """Build structured memory object from segments"""
        
        memory = {
            "facts": [],
            "decisions": [],
            "constraints": [],
            "open_questions": [],
            "pending_actions": [],
            "context_summary": "",
            "retained_segments": [seg.id for seg in retained_segments]
        }
        
        # Categorize retained content
        for seg in retained_segments:
            if seg.segment_type == SegmentType.CONSTRAINT:
                memory["constraints"].append(seg.text)
            elif seg.segment_type == SegmentType.DECISION:
                memory["decisions"].append(seg.text)
            elif seg.segment_type == SegmentType.QUESTION:
                memory["open_questions"].append(seg.text)
            elif seg.segment_type == SegmentType.FACTUAL_DATA:
                memory["facts"].append(seg.text)
            else:
                memory["facts"].append(seg.text)
        
        # Create context summary from summarized content
        if summarized_segments:
            summary_texts = [seg.text for seg in summarized_segments if seg.importance_score > 0.3]
            if summary_texts:
                # Simple extractive summary
                memory["context_summary"] = " ".join(summary_texts)[:500] + "..."
        
        return memory
    
    def _format_selected_segments(self, segments: List[ContentSegment]) -> str:
        """Format selected segments into readable text"""
        
        if not segments:
            return ""
        
        # Group by segment type for better organization
        grouped = {}
        for seg in segments:
            seg_type = seg.segment_type
            if seg_type not in grouped:
                grouped[seg_type] = []
            grouped[seg_type].append(seg)
        
        # Order types by importance
        type_order = [
            SegmentType.SYSTEM_MESSAGE,
            SegmentType.CONSTRAINT,
            SegmentType.DECISION,
            SegmentType.QUESTION,
            SegmentType.USER_MESSAGE,
            SegmentType.ASSISTANT_MESSAGE,
            SegmentType.CODE_BLOCK,
            SegmentType.FACTUAL_DATA,
            SegmentType.CONTEXT
        ]
        
        formatted_parts = []
        
        for seg_type in type_order:
            if seg_type in grouped:
                segs = grouped[seg_type]
                if seg_type == SegmentType.SYSTEM_MESSAGE:
                    formatted_parts.extend([seg.text for seg in segs])
                elif seg_type in [SegmentType.USER_MESSAGE, SegmentType.ASSISTANT_MESSAGE]:
                    formatted_parts.extend([f"[{seg.metadata.get('role', 'user')}] {seg.text}" for seg in segs])
                else:
                    formatted_parts.extend([seg.text for seg in segs])
        
        return "\n\n".join(formatted_parts)
    
    def _create_no_compression_result(
        self,
        segments: List[ContentSegment],
        token_count: int,
        start_time: float
    ) -> CompressionResult:
        """Create result when no compression is needed"""
        
        content = self._format_selected_segments(segments)
        
        return CompressionResult(
            success=True,
            original_tokens=token_count,
            compressed_tokens=token_count,
            compression_ratio=1.0,
            strategy_used=self.config.strategy,
            compressed_content=content,
            structured_memory=self._build_structured_memory(segments, []),
            retained_segments=[seg.id for seg in segments],
            processing_time_ms=(time.time() - start_time) * 1000
        )
    
    def _meets_quality_thresholds(self, metrics: Dict[QualityMetric, float]) -> bool:
        """Check if compression meets quality thresholds"""
        
        checks = [
            metrics.get(QualityMetric.SEMANTIC_SIMILARITY, 0) >= self.config.min_semantic_similarity,
            metrics.get(QualityMetric.INFORMATION_PRESERVATION, 0) >= self.config.min_information_preservation,
            metrics.get(QualityMetric.COHERENCE, 0) >= self.config.min_coherence
        ]
        
        return all(checks)
    
    def _update_stats(self, result: CompressionResult):
        """Update compression statistics"""
        
        if result.success:
            self.stats['successful_compressions'] += 1
            
            # Update average compression ratio
            total_successful = self.stats['successful_compressions']
            current_avg = self.stats['avg_compression_ratio']
            self.stats['avg_compression_ratio'] = (
                (current_avg * (total_successful - 1) + result.compression_ratio) / total_successful
            )
            
            # Update average quality score
            if result.quality_metrics:
                avg_quality = sum(result.quality_metrics.values()) / len(result.quality_metrics)
                current_avg_quality = self.stats['avg_quality_score']
                self.stats['avg_quality_score'] = (
                    (current_avg_quality * (total_successful - 1) + avg_quality) / total_successful
                )
        
        if result.fallback_used:
            self.stats['fallback_compressions'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get compression statistics"""
        return self.stats.copy()


# Usage example and testing
async def example_usage():
    """Example usage of the enhanced compression utility"""
    
    # Initialize OpenAI client
    client = AsyncOpenAI()
    
    # Configure compression
    config = CompressionConfig(
        target_token_budget=1500,
        strategy=CompressionStrategy.ADAPTIVE,
        enable_quality_validation=True,
        min_semantic_similarity=0.75
    )
    
    # Create compressor
    compressor = EnhancedContextCompressor(client, config)
    
    # Example conversation
    messages = [
        {"role": "system", "content": "You are a helpful AI assistant specialized in software development."},
        {"role": "user", "content": "I need help with implementing a REST API for user management. The API must support authentication, user CRUD operations, and role-based access control."},
        {"role": "assistant", "content": "I'll help you implement a comprehensive user management REST API. Let's break this down into key components: 1) Authentication system, 2) User model and database, 3) CRUD endpoints, 4) Role-based middleware."},
        {"role": "user", "content": "What database should I use? I'm considering PostgreSQL vs MongoDB."},
        {"role": "assistant", "content": "For user management, I'd recommend PostgreSQL because: 1) Strong ACID compliance for user data integrity, 2) Excellent support for relational data (users, roles, permissions), 3) Mature ecosystem with ORMs like Sequelize or TypeORM."},
        {"role": "user", "content": "Good point. Can you show me the database schema for users and roles?"}
    ]
    
    # Compress context
    result = await compressor.compress_context(
        messages=messages,
        query="database schema design for user management API"
    )
    
    # Print results
    print(f"Compression Success: {result.success}")
    print(f"Original Tokens: {result.original_tokens}")
    print(f"Compressed Tokens: {result.compressed_tokens}")
    print(f"Compression Ratio: {result.compression_ratio:.2f}")
    print(f"Strategy Used: {result.strategy_used}")
    print(f"Processing Time: {result.processing_time_ms:.1f}ms")
    
    if result.quality_metrics:
        print("\nQuality Metrics:")
        for metric, score in result.quality_metrics.items():
            print(f"  {metric}: {score:.2f}")
    
    print(f"\nCompressed Content:\n{result.compressed_content}")
    
    if result.structured_memory:
        print(f"\nStructured Memory:\n{json.dumps(result.structured_memory, indent=2)}")


if __name__ == "__main__":
    asyncio.run(example_usage())