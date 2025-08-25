"""
Cartrita Python AI Agent Suite - Advanced ML/AI agents for hybrid system
Leverages Python ecosystem advantages for machine learning workloads
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import numpy as np
import torch
from transformers import AutoTokenizer, AutoModel, pipeline
from sentence_transformers import SentenceTransformer
import faiss
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..bridge.python_bridge import PythonAgent, PythonAgentCapability
from ..schema import TaskRequest, TaskResponse, TaskStatus

logger = logging.getLogger(__name__)


class MLModelAgent(PythonAgent):
    """Advanced ML model agent leveraging HuggingFace and PyTorch ecosystem"""
    
    def __init__(self):
        super().__init__("MLModelAgent", "specialized")
        
        # Initialize models lazily
        self.models = {}
        self.tokenizers = {}
        self.pipelines = {}
        
        # Model configurations
        self.model_configs = {
            'text_classification': {
                'model': 'distilbert-base-uncased-finetuned-sst-2-english',
                'task': 'sentiment-analysis'
            },
            'text_generation': {
                'model': 'gpt2',
                'task': 'text-generation'
            },
            'question_answering': {
                'model': 'distilbert-base-uncased-distilled-squad',
                'task': 'question-answering'
            },
            'summarization': {
                'model': 'facebook/bart-large-cnn',
                'task': 'summarization'
            },
            'translation': {
                'model': 'Helsinki-NLP/opus-mt-en-de',
                'task': 'translation'
            },
            'embeddings': {
                'model': 'sentence-transformers/all-MiniLM-L6-v2',
                'task': 'feature-extraction'
            }
        }
        
        # Performance tracking
        self.task_metrics = {
            'total_tasks': 0,
            'successful_tasks': 0,
            'avg_processing_time': 0.0,
            'model_usage': {},
            'error_count': 0
        }

    async def initialize(self):
        """Initialize the ML agent with capabilities"""
        capabilities = [
            PythonAgentCapability(
                name="text_classification",
                category="nlp",
                priority=85,
                resource_requirements={"memory": "512MB", "gpu": "optional"},
                dependencies=["transformers", "torch"],
                performance_profile={"avg_latency": 200, "throughput": 100}
            ),
            PythonAgentCapability(
                name="text_generation", 
                category="nlp",
                priority=80,
                resource_requirements={"memory": "1GB", "gpu": "recommended"},
                dependencies=["transformers", "torch"],
                performance_profile={"avg_latency": 500, "throughput": 50}
            ),
            PythonAgentCapability(
                name="question_answering",
                category="nlp",
                priority=90,
                resource_requirements={"memory": "512MB", "gpu": "optional"},
                dependencies=["transformers", "torch"],
                performance_profile={"avg_latency": 300, "throughput": 80}
            ),
            PythonAgentCapability(
                name="text_summarization",
                category="nlp", 
                priority=85,
                resource_requirements={"memory": "1GB", "gpu": "recommended"},
                dependencies=["transformers", "torch"],
                performance_profile={"avg_latency": 400, "throughput": 60}
            ),
            PythonAgentCapability(
                name="language_translation",
                category="nlp",
                priority=75,
                resource_requirements={"memory": "512MB", "gpu": "optional"},
                dependencies=["transformers", "torch"],
                performance_profile={"avg_latency": 350, "throughput": 70}
            ),
            PythonAgentCapability(
                name="embedding_generation",
                category="ml",
                priority=95,
                resource_requirements={"memory": "256MB", "gpu": "optional"},
                dependencies=["sentence-transformers"],
                performance_profile={"avg_latency": 100, "throughput": 200}
            )
        ]
        
        await self.register_capabilities(capabilities)
        logger.info("MLModelAgent initialized with NLP capabilities")

    async def execute_task(self, task_request: TaskRequest) -> TaskResponse:
        """Execute ML model inference task"""
        start_time = time.time()
        
        try:
            task_type = task_request.task_type
            inputs = task_request.inputs
            options = task_request.options or {}
            
            # Route to appropriate ML method
            if task_type == "text_classification":
                result = await self._classify_text(inputs, options)
            elif task_type == "text_generation":
                result = await self._generate_text(inputs, options)
            elif task_type == "question_answering":
                result = await self._answer_question(inputs, options)
            elif task_type == "text_summarization":
                result = await self._summarize_text(inputs, options)
            elif task_type == "language_translation":
                result = await self._translate_text(inputs, options)
            elif task_type == "embedding_generation":
                result = await self._generate_embeddings(inputs, options)
            else:
                raise ValueError(f"Unsupported ML task type: {task_type}")
            
            # Update metrics
            processing_time = time.time() - start_time
            self._update_metrics(task_type, processing_time, True)
            
            return TaskResponse(
                task_id=task_request.task_id,
                status=TaskStatus.COMPLETED,
                result=result,
                metadata={
                    "agent": self.name,
                    "model_used": self._get_model_for_task(task_type),
                    "processing_time": processing_time,
                    "language": "python"
                }
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            self._update_metrics(task_request.task_type, processing_time, False)
            
            logger.error(f"ML task execution failed: {e}")
            
            return TaskResponse(
                task_id=task_request.task_id,
                status=TaskStatus.FAILED,
                error=str(e),
                metadata={
                    "agent": self.name,
                    "processing_time": processing_time,
                    "language": "python"
                }
            )

    async def _classify_text(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Perform text classification"""
        text = inputs.get("text", "")
        if not text:
            raise ValueError("Text input required for classification")
        
        model_name = options.get("model", "text_classification")
        pipeline = await self._get_pipeline(model_name)
        
        results = pipeline(text)
        
        return {
            "classification": results,
            "confidence": results[0]["score"] if results else 0.0,
            "label": results[0]["label"] if results else "unknown"
        }

    async def _generate_text(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Generate text using language model"""
        prompt = inputs.get("prompt", "")
        if not prompt:
            raise ValueError("Prompt required for text generation")
        
        max_length = options.get("max_length", 100)
        temperature = options.get("temperature", 0.7)
        
        model_name = options.get("model", "text_generation")
        pipeline = await self._get_pipeline(model_name)
        
        results = pipeline(
            prompt,
            max_length=max_length,
            temperature=temperature,
            do_sample=True,
            pad_token_id=pipeline.tokenizer.eos_token_id
        )
        
        generated_text = results[0]["generated_text"] if results else ""
        
        return {
            "generated_text": generated_text,
            "prompt": prompt,
            "parameters": {
                "max_length": max_length,
                "temperature": temperature
            }
        }

    async def _answer_question(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Answer questions based on context"""
        question = inputs.get("question", "")
        context = inputs.get("context", "")
        
        if not question or not context:
            raise ValueError("Both question and context required for QA")
        
        model_name = options.get("model", "question_answering")
        pipeline = await self._get_pipeline(model_name)
        
        result = pipeline(question=question, context=context)
        
        return {
            "answer": result["answer"],
            "confidence": result["score"],
            "start_position": result["start"],
            "end_position": result["end"],
            "question": question,
            "context": context[:200] + "..." if len(context) > 200 else context
        }

    async def _summarize_text(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize long text"""
        text = inputs.get("text", "")
        if not text:
            raise ValueError("Text input required for summarization")
        
        max_length = options.get("max_length", 130)
        min_length = options.get("min_length", 30)
        
        model_name = options.get("model", "summarization")
        pipeline = await self._get_pipeline(model_name)
        
        results = pipeline(text, max_length=max_length, min_length=min_length, do_sample=False)
        
        summary = results[0]["summary_text"] if results else ""
        
        return {
            "summary": summary,
            "original_length": len(text),
            "summary_length": len(summary),
            "compression_ratio": len(summary) / len(text) if text else 0
        }

    async def _translate_text(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Translate text between languages"""
        text = inputs.get("text", "")
        source_lang = inputs.get("source_lang", "en")
        target_lang = inputs.get("target_lang", "de")
        
        if not text:
            raise ValueError("Text input required for translation")
        
        # For demo, using English to German model
        model_name = options.get("model", "translation")
        pipeline = await self._get_pipeline(model_name)
        
        results = pipeline(text)
        translated_text = results[0]["translation_text"] if results else ""
        
        return {
            "translated_text": translated_text,
            "original_text": text,
            "source_language": source_lang,
            "target_language": target_lang
        }

    async def _generate_embeddings(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Generate text embeddings"""
        texts = inputs.get("texts", [])
        if isinstance(texts, str):
            texts = [texts]
        
        if not texts:
            raise ValueError("Texts input required for embedding generation")
        
        model_name = options.get("model", "sentence-transformers/all-MiniLM-L6-v2")
        
        # Use sentence transformers for better embeddings
        if model_name not in self.models:
            self.models[model_name] = SentenceTransformer(model_name)
        
        model = self.models[model_name]
        embeddings = model.encode(texts)
        
        return {
            "embeddings": embeddings.tolist(),
            "texts": texts,
            "embedding_dim": embeddings.shape[1] if embeddings.ndim > 1 else len(embeddings),
            "num_texts": len(texts)
        }

    async def _get_pipeline(self, model_key: str):
        """Get or create ML pipeline for model"""
        if model_key in self.pipelines:
            return self.pipelines[model_key]
        
        config = self.model_configs.get(model_key, {})
        model_name = config.get("model", model_key)
        task = config.get("task", "text-classification")
        
        # Create pipeline
        self.pipelines[model_key] = pipeline(task, model=model_name)
        
        logger.info(f"Created ML pipeline for {model_key}: {model_name}")
        return self.pipelines[model_key]

    def _get_model_for_task(self, task_type: str) -> str:
        """Get model name for task type"""
        config = self.model_configs.get(task_type, {})
        return config.get("model", "unknown")

    def _update_metrics(self, task_type: str, processing_time: float, success: bool):
        """Update performance metrics"""
        self.task_metrics["total_tasks"] += 1
        
        if success:
            self.task_metrics["successful_tasks"] += 1
        else:
            self.task_metrics["error_count"] += 1
        
        # Update average processing time
        current_avg = self.task_metrics["avg_processing_time"]
        total_tasks = self.task_metrics["total_tasks"]
        self.task_metrics["avg_processing_time"] = (
            (current_avg * (total_tasks - 1) + processing_time) / total_tasks
        )
        
        # Update model usage
        if task_type not in self.task_metrics["model_usage"]:
            self.task_metrics["model_usage"][task_type] = 0
        self.task_metrics["model_usage"][task_type] += 1


class DataAnalysisAgent(PythonAgent):
    """Advanced data analysis agent using pandas, numpy, and scikit-learn"""
    
    def __init__(self):
        super().__init__("DataAnalysisAgent", "specialized")
        
        # Analysis tools
        self.analyzers = {}
        
        # Performance tracking
        self.analysis_metrics = {
            "total_analyses": 0,
            "successful_analyses": 0,
            "avg_processing_time": 0.0,
            "data_volume_processed": 0,
            "analysis_types": {}
        }

    async def initialize(self):
        """Initialize data analysis capabilities"""
        capabilities = [
            PythonAgentCapability(
                name="statistical_analysis",
                category="data",
                priority=90,
                resource_requirements={"memory": "1GB", "cpu": "recommended"},
                dependencies=["pandas", "numpy", "scipy"],
                performance_profile={"avg_latency": 300, "throughput": 100}
            ),
            PythonAgentCapability(
                name="data_cleaning",
                category="data",
                priority=85,
                resource_requirements={"memory": "512MB", "cpu": "standard"},
                dependencies=["pandas", "numpy"],
                performance_profile={"avg_latency": 200, "throughput": 150}
            ),
            PythonAgentCapability(
                name="correlation_analysis",
                category="data",
                priority=80,
                resource_requirements={"memory": "256MB", "cpu": "standard"},
                dependencies=["pandas", "numpy", "seaborn"],
                performance_profile={"avg_latency": 150, "throughput": 120}
            ),
            PythonAgentCapability(
                name="time_series_analysis",
                category="data",
                priority=85,
                resource_requirements={"memory": "512MB", "cpu": "recommended"},
                dependencies=["pandas", "numpy", "statsmodels"],
                performance_profile={"avg_latency": 400, "throughput": 80}
            ),
            PythonAgentCapability(
                name="clustering_analysis",
                category="ml",
                priority=75,
                resource_requirements={"memory": "1GB", "cpu": "recommended"},
                dependencies=["scikit-learn", "numpy"],
                performance_profile={"avg_latency": 500, "throughput": 60}
            )
        ]
        
        await self.register_capabilities(capabilities)
        logger.info("DataAnalysisAgent initialized with data analysis capabilities")

    async def execute_task(self, task_request: TaskRequest) -> TaskResponse:
        """Execute data analysis task"""
        start_time = time.time()
        
        try:
            task_type = task_request.task_type
            inputs = task_request.inputs
            options = task_request.options or {}
            
            # Route to appropriate analysis method
            if task_type == "statistical_analysis":
                result = await self._statistical_analysis(inputs, options)
            elif task_type == "data_cleaning":
                result = await self._clean_data(inputs, options)
            elif task_type == "correlation_analysis":
                result = await self._correlation_analysis(inputs, options)
            elif task_type == "time_series_analysis":
                result = await self._time_series_analysis(inputs, options)
            elif task_type == "clustering_analysis":
                result = await self._clustering_analysis(inputs, options)
            else:
                raise ValueError(f"Unsupported data analysis task: {task_type}")
            
            # Update metrics
            processing_time = time.time() - start_time
            self._update_analysis_metrics(task_type, processing_time, True, inputs)
            
            return TaskResponse(
                task_id=task_request.task_id,
                status=TaskStatus.COMPLETED,
                result=result,
                metadata={
                    "agent": self.name,
                    "analysis_type": task_type,
                    "processing_time": processing_time,
                    "language": "python"
                }
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            self._update_analysis_metrics(task_request.task_type, processing_time, False, inputs)
            
            logger.error(f"Data analysis task failed: {e}")
            
            return TaskResponse(
                task_id=task_request.task_id,
                status=TaskStatus.FAILED,
                error=str(e),
                metadata={
                    "agent": self.name,
                    "processing_time": processing_time,
                    "language": "python"
                }
            )

    async def _statistical_analysis(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Perform statistical analysis on data"""
        data = inputs.get("data", [])
        if not data:
            raise ValueError("Data required for statistical analysis")
        
        df = pd.DataFrame(data)
        
        # Basic statistics
        stats = {
            "basic_stats": df.describe().to_dict(),
            "shape": df.shape,
            "data_types": df.dtypes.to_dict(),
            "null_counts": df.isnull().sum().to_dict(),
            "memory_usage": df.memory_usage(deep=True).sum()
        }
        
        # Additional statistics for numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            stats["numeric_analysis"] = {
                "correlation_matrix": df[numeric_cols].corr().to_dict(),
                "skewness": df[numeric_cols].skew().to_dict(),
                "kurtosis": df[numeric_cols].kurtosis().to_dict()
            }
        
        return stats

    async def _clean_data(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and preprocess data"""
        data = inputs.get("data", [])
        if not data:
            raise ValueError("Data required for cleaning")
        
        df = pd.DataFrame(data)
        original_shape = df.shape
        
        cleaning_options = options.get("cleaning", {})
        
        # Remove duplicates
        if cleaning_options.get("remove_duplicates", True):
            df = df.drop_duplicates()
        
        # Handle missing values
        missing_strategy = cleaning_options.get("missing_strategy", "drop")
        if missing_strategy == "drop":
            df = df.dropna()
        elif missing_strategy == "fill":
            fill_value = cleaning_options.get("fill_value", 0)
            df = df.fillna(fill_value)
        
        # Remove outliers (simple IQR method for numeric columns)
        if cleaning_options.get("remove_outliers", False):
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            for col in numeric_cols:
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                df = df[~((df[col] < (Q1 - 1.5 * IQR)) | (df[col] > (Q3 + 1.5 * IQR)))]
        
        return {
            "cleaned_data": df.to_dict(orient="records"),
            "original_shape": original_shape,
            "cleaned_shape": df.shape,
            "rows_removed": original_shape[0] - df.shape[0],
            "cleaning_applied": cleaning_options
        }

    async def _correlation_analysis(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Perform correlation analysis"""
        data = inputs.get("data", [])
        if not data:
            raise ValueError("Data required for correlation analysis")
        
        df = pd.DataFrame(data)
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        if len(numeric_cols) < 2:
            raise ValueError("At least 2 numeric columns required for correlation analysis")
        
        correlation_matrix = df[numeric_cols].corr()
        
        # Find strong correlations
        strong_correlations = []
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                corr_value = correlation_matrix.iloc[i, j]
                if abs(corr_value) > 0.7:  # Strong correlation threshold
                    strong_correlations.append({
                        "variable1": numeric_cols[i],
                        "variable2": numeric_cols[j],
                        "correlation": corr_value
                    })
        
        return {
            "correlation_matrix": correlation_matrix.to_dict(),
            "strong_correlations": strong_correlations,
            "numeric_columns": list(numeric_cols)
        }

    async def _time_series_analysis(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Perform time series analysis"""
        data = inputs.get("data", [])
        time_column = inputs.get("time_column", "timestamp")
        value_column = inputs.get("value_column", "value")
        
        if not data:
            raise ValueError("Data required for time series analysis")
        
        df = pd.DataFrame(data)
        
        if time_column not in df.columns or value_column not in df.columns:
            raise ValueError(f"Required columns {time_column} and {value_column} not found")
        
        # Convert to datetime and sort
        df[time_column] = pd.to_datetime(df[time_column])
        df = df.sort_values(time_column)
        
        # Basic time series statistics
        series = df.set_index(time_column)[value_column]
        
        return {
            "basic_stats": series.describe().to_dict(),
            "trend": "increasing" if series.iloc[-1] > series.iloc[0] else "decreasing",
            "start_date": series.index.min().isoformat(),
            "end_date": series.index.max().isoformat(),
            "data_points": len(series),
            "time_range_days": (series.index.max() - series.index.min()).days
        }

    async def _clustering_analysis(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Perform clustering analysis"""
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler
        
        data = inputs.get("data", [])
        if not data:
            raise ValueError("Data required for clustering analysis")
        
        df = pd.DataFrame(data)
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        if len(numeric_cols) < 2:
            raise ValueError("At least 2 numeric columns required for clustering")
        
        # Prepare data
        X = df[numeric_cols].values
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Perform K-means clustering
        n_clusters = options.get("n_clusters", 3)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(X_scaled)
        
        # Add cluster labels to dataframe
        df_with_clusters = df.copy()
        df_with_clusters["cluster"] = cluster_labels
        
        # Calculate cluster statistics
        cluster_stats = {}
        for i in range(n_clusters):
            cluster_data = df_with_clusters[df_with_clusters["cluster"] == i]
            cluster_stats[f"cluster_{i}"] = {
                "size": len(cluster_data),
                "percentage": len(cluster_data) / len(df) * 100,
                "mean_values": cluster_data[numeric_cols].mean().to_dict()
            }
        
        return {
            "clustered_data": df_with_clusters.to_dict(orient="records"),
            "n_clusters": n_clusters,
            "cluster_statistics": cluster_stats,
            "inertia": kmeans.inertia_,
            "numeric_columns_used": list(numeric_cols)
        }

    def _update_analysis_metrics(self, task_type: str, processing_time: float, success: bool, inputs: Dict):
        """Update analysis performance metrics"""
        self.analysis_metrics["total_analyses"] += 1
        
        if success:
            self.analysis_metrics["successful_analyses"] += 1
        
        # Update average processing time
        current_avg = self.analysis_metrics["avg_processing_time"]
        total_analyses = self.analysis_metrics["total_analyses"]
        self.analysis_metrics["avg_processing_time"] = (
            (current_avg * (total_analyses - 1) + processing_time) / total_analyses
        )
        
        # Track data volume
        data = inputs.get("data", [])
        if isinstance(data, list):
            self.analysis_metrics["data_volume_processed"] += len(data)
        
        # Update analysis type usage
        if task_type not in self.analysis_metrics["analysis_types"]:
            self.analysis_metrics["analysis_types"][task_type] = 0
        self.analysis_metrics["analysis_types"][task_type] += 1


class VectorSearchAgent(PythonAgent):
    """Advanced vector search agent with FAISS integration"""
    
    def __init__(self):
        super().__init__("VectorSearchAgent", "specialized")
        
        # Vector search components
        self.faiss_index = None
        self.document_store = {}
        self.embedding_model = None
        
        # Performance tracking
        self.search_metrics = {
            "total_searches": 0,
            "successful_searches": 0,
            "avg_search_time": 0.0,
            "total_documents": 0,
            "index_size": 0
        }

    async def initialize(self):
        """Initialize vector search capabilities"""
        capabilities = [
            PythonAgentCapability(
                name="vector_similarity_search",
                category="vector",
                priority=95,
                resource_requirements={"memory": "2GB", "cpu": "recommended"},
                dependencies=["faiss", "sentence-transformers"],
                performance_profile={"avg_latency": 50, "throughput": 1000}
            ),
            PythonAgentCapability(
                name="document_indexing",
                category="vector",
                priority=90,
                resource_requirements={"memory": "1GB", "cpu": "recommended"},
                dependencies=["faiss", "sentence-transformers"],
                performance_profile={"avg_latency": 200, "throughput": 100}
            ),
            PythonAgentCapability(
                name="semantic_search",
                category="nlp",
                priority=85,
                resource_requirements={"memory": "512MB", "gpu": "optional"},
                dependencies=["sentence-transformers"],
                performance_profile={"avg_latency": 100, "throughput": 200}
            )
        ]
        
        # Initialize embedding model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize FAISS index (384 dimensions for all-MiniLM-L6-v2)
        self.faiss_index = faiss.IndexFlatIP(384)  # Inner product for cosine similarity
        
        await self.register_capabilities(capabilities)
        logger.info("VectorSearchAgent initialized with vector search capabilities")

    async def execute_task(self, task_request: TaskRequest) -> TaskResponse:
        """Execute vector search task"""
        start_time = time.time()
        
        try:
            task_type = task_request.task_type
            inputs = task_request.inputs
            options = task_request.options or {}
            
            # Route to appropriate vector search method
            if task_type == "vector_similarity_search":
                result = await self._vector_search(inputs, options)
            elif task_type == "document_indexing":
                result = await self._index_documents(inputs, options)
            elif task_type == "semantic_search":
                result = await self._semantic_search(inputs, options)
            else:
                raise ValueError(f"Unsupported vector search task: {task_type}")
            
            # Update metrics
            processing_time = time.time() - start_time
            self._update_search_metrics(task_type, processing_time, True)
            
            return TaskResponse(
                task_id=task_request.task_id,
                status=TaskStatus.COMPLETED,
                result=result,
                metadata={
                    "agent": self.name,
                    "search_type": task_type,
                    "processing_time": processing_time,
                    "language": "python"
                }
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            self._update_search_metrics(task_request.task_type, processing_time, False)
            
            logger.error(f"Vector search task failed: {e}")
            
            return TaskResponse(
                task_id=task_request.task_id,
                status=TaskStatus.FAILED,
                error=str(e),
                metadata={
                    "agent": self.name,
                    "processing_time": processing_time,
                    "language": "python"
                }
            )

    async def _vector_search(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Perform vector similarity search"""
        query = inputs.get("query", "")
        if not query:
            raise ValueError("Query required for vector search")
        
        top_k = options.get("top_k", 10)
        threshold = options.get("threshold", 0.0)
        
        if self.faiss_index.ntotal == 0:
            return {
                "results": [],
                "query": query,
                "total_results": 0,
                "message": "Index is empty. Please add documents first."
            }
        
        # Generate query embedding
        query_embedding = self.embedding_model.encode([query])
        query_embedding = query_embedding.astype('float32')
        
        # Normalize for cosine similarity
        faiss.normalize_L2(query_embedding)
        
        # Perform search
        scores, indices = self.faiss_index.search(query_embedding, min(top_k, self.faiss_index.ntotal))
        
        # Prepare results
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:  # Invalid index
                continue
            if score < threshold:
                continue
                
            doc = self.document_store.get(str(idx), {})
            results.append({
                "document": doc.get("text", ""),
                "metadata": doc.get("metadata", {}),
                "score": float(score),
                "document_id": str(idx)
            })
        
        return {
            "results": results,
            "query": query,
            "total_results": len(results),
            "search_time": time.time(),
            "index_size": self.faiss_index.ntotal
        }

    async def _index_documents(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Index documents for vector search"""
        documents = inputs.get("documents", [])
        if not documents:
            raise ValueError("Documents required for indexing")
        
        batch_size = options.get("batch_size", 100)
        
        # Process documents in batches
        indexed_count = 0
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            
            # Extract text and metadata
            texts = []
            for doc in batch:
                if isinstance(doc, dict):
                    texts.append(doc.get("text", str(doc)))
                else:
                    texts.append(str(doc))
            
            # Generate embeddings
            embeddings = self.embedding_model.encode(texts)
            embeddings = embeddings.astype('float32')
            
            # Normalize for cosine similarity
            faiss.normalize_L2(embeddings)
            
            # Add to FAISS index
            start_idx = self.faiss_index.ntotal
            self.faiss_index.add(embeddings)
            
            # Store documents
            for j, doc in enumerate(batch):
                doc_id = str(start_idx + j)
                self.document_store[doc_id] = {
                    "text": texts[j],
                    "metadata": doc.get("metadata", {}) if isinstance(doc, dict) else {},
                    "indexed_at": datetime.now(timezone.utc).isoformat()
                }
            
            indexed_count += len(batch)
        
        self.search_metrics["total_documents"] = self.faiss_index.ntotal
        self.search_metrics["index_size"] = self.faiss_index.ntotal
        
        return {
            "indexed_count": indexed_count,
            "total_documents": self.faiss_index.ntotal,
            "index_size": self.faiss_index.ntotal,
            "embedding_dimension": 384
        }

    async def _semantic_search(self, inputs: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Perform semantic search with additional processing"""
        # This is similar to vector search but with additional semantic processing
        query = inputs.get("query", "")
        context = inputs.get("context", "")
        
        if not query:
            raise ValueError("Query required for semantic search")
        
        # Enhance query with context if provided
        enhanced_query = f"{context} {query}".strip() if context else query
        
        # Use the vector search functionality
        search_inputs = {"query": enhanced_query}
        search_options = options.copy()
        
        vector_results = await self._vector_search(search_inputs, search_options)
        
        # Add semantic enhancements
        vector_results["semantic_enhancements"] = {
            "query_enhancement": enhanced_query != query,
            "context_provided": bool(context),
            "original_query": query,
            "enhanced_query": enhanced_query
        }
        
        return vector_results

    def _update_search_metrics(self, task_type: str, processing_time: float, success: bool):
        """Update search performance metrics"""
        self.search_metrics["total_searches"] += 1
        
        if success:
            self.search_metrics["successful_searches"] += 1
        
        # Update average search time
        current_avg = self.search_metrics["avg_search_time"]
        total_searches = self.search_metrics["total_searches"]
        self.search_metrics["avg_search_time"] = (
            (current_avg * (total_searches - 1) + processing_time) / total_searches
        )