"""
LangChain Integration for Cartrita V2
Advanced language model orchestration and chain management
"""
import asyncio
import json
import logging
import os
from typing import Dict, List, Optional, Any, Union, Callable, cast
from datetime import datetime
from enum import Enum
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the backend .env file
env_path = Path(__file__).parent.parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(env_path)

from langchain.agents import AgentType, initialize_agent
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.tools import BaseTool, Tool
from langchain.chains import LLMChain, ConversationChain
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.schema import BaseOutputParser
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from pydantic import BaseModel, Field

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChainType(str, Enum):
    """Available chain types"""
    CONVERSATION = "conversation"
    RESEARCH = "research"
    CODE_ASSISTANT = "code_assistant"
    DATA_ANALYSIS = "data_analysis"
    CREATIVE_WRITING = "creative_writing"
    QUANTUM_COMPUTING = "quantum_computing"

class MemoryType(str, Enum):
    """Available memory types"""
    BUFFER = "buffer"
    SUMMARY = "summary"
    ENTITY = "entity"

class LangChainTool(BaseTool):
    """Base class for custom LangChain tools"""
    name: str = Field(...)
    description: str = Field(...)
    
    async def _arun(self, query: str) -> str:
        """Async implementation"""
        return await asyncio.get_event_loop().run_in_executor(None, self._run, query)
    
    def _run(self, query: str) -> str:
        """Sync implementation - to be overridden"""
        raise NotImplementedError("Tool must implement _run method")

class LangChainConfig:
    """LangChain configuration manager with environment variable loading"""
    
    def __init__(self):
        """Initialize configuration with environment variables"""
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.model_name = os.getenv("OPENAI_MODEL", "gpt-4")
        self.temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
        self.max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
        self.chunk_size = int(os.getenv("LANGCHAIN_CHUNK_SIZE", "1000"))
        self.chunk_overlap = int(os.getenv("LANGCHAIN_CHUNK_OVERLAP", "200"))
        
        # Vector store configuration
        self.vector_store_path = os.getenv("VECTOR_STORE_PATH", "./data/vectorstore")
        
        # Memory configuration
        self.memory_type = os.getenv("LANGCHAIN_MEMORY_TYPE", "buffer")
        self.max_memory_length = int(os.getenv("LANGCHAIN_MAX_MEMORY", "10"))
        
        # Initialize containers
        self.tools: Dict[str, LangChainTool] = {}
        self.chains: Dict[str, Any] = {}
        self.memories: Dict[str, Any] = {}
        self.llm: Optional[ChatOpenAI] = None
        self.embeddings: Optional[OpenAIEmbeddings] = None
        
        logger.info(f"LangChain configuration loaded - Model: {self.model_name}, Temperature: {self.temperature}")
    
    def get_llm(self) -> ChatOpenAI:
        """Get configured LLM instance"""
        if not self.llm:
            self.llm = ChatOpenAI(
                openai_api_key=self.openai_api_key,
                model_name=self.model_name,
                temperature=self.temperature,
            )
        return self.llm
    
    def get_embeddings(self) -> OpenAIEmbeddings:
        """Get configured embeddings instance"""
        if not self.embeddings:
            self.embeddings = OpenAIEmbeddings(
                openai_api_key=self.openai_api_key
            )
        return self.embeddings
import asyncio
import json
import logging
import os
from typing import Dict, List, Optional, Any, Union, Callable, cast
from datetime import datetime
from enum import Enum
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the backend .env file
env_path = Path(__file__).parent.parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(env_path)

from langchain.agents import AgentType, initialize_agent
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.tools import BaseTool, Tool
from langchain.chains import LLMChain, ConversationChain
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.schema import BaseOutputParser
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from pydantic import BaseModel, Field, SecretStr

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChainType(Enum):
    SIMPLE = "simple"
    CONVERSATION = "conversation"
    RETRIEVAL_QA = "retrieval_qa"
    AGENT = "agent"
    CUSTOM = "custom"

class MemoryType(Enum):
    BUFFER = "buffer"
    SUMMARY = "summary"
    BUFFER_WINDOW = "buffer_window"
    TOKEN_BUFFER = "token_buffer"

class ChainConfiguration(BaseModel):
    id: str
    name: str
    description: str
    chain_type: ChainType
    memory_type: Optional[MemoryType] = None
    model_name: str = "gpt-5"
    temperature: float = 0.7
    max_tokens: int = 2048
    prompt_template: Optional[str] = None
    tools: List[str] = []
    created_at: datetime = Field(default_factory=datetime.now)

class LangChainTool(BaseTool):
    """Custom LangChain tool wrapper for Cartrita"""
    
    name: str = Field(default="default_tool")
    description: str
    func: Callable
    
    def _run(self, *args, **kwargs) -> str:
        """Run the tool synchronously"""
        try:
            result = self.func(*args, **kwargs)
            return json.dumps(result) if isinstance(result, dict) else str(result)
        except Exception as e:
            return f"Error executing tool: {str(e)}"
    
    async def _arun(self, *args, **kwargs) -> str:
        """Run the tool asynchronously"""
        try:
            if asyncio.iscoroutinefunction(self.func):
                result = await self.func(*args, **kwargs)
            else:
                result = self.func(*args, **kwargs)
            return json.dumps(result) if isinstance(result, dict) else str(result)
        except Exception as e:
            return f"Error executing tool: {str(e)}"

class LangChainConfig:
    """LangChain configuration manager with environment variable loading"""
    
    def __init__(self):
        """Initialize configuration with environment variables"""
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.model_name = os.getenv("OPENAI_MODEL", "gpt-4")
        self.temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
        self.max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
        self.chunk_size = int(os.getenv("LANGCHAIN_CHUNK_SIZE", "1000"))
        self.chunk_overlap = int(os.getenv("LANGCHAIN_CHUNK_OVERLAP", "200"))
        
        # Vector store configuration
        self.vector_store_path = os.getenv("VECTOR_STORE_PATH", "./data/vectorstore")
        
        # Memory configuration
        self.memory_type = os.getenv("LANGCHAIN_MEMORY_TYPE", "buffer")
        self.max_memory_length = int(os.getenv("LANGCHAIN_MAX_MEMORY", "10"))
        
        # Initialize containers
        self.tools: Dict[str, Tool] = {}
        self.chains: Dict[str, Any] = {}
        self.llm: Optional[ChatOpenAI] = None
        
        logger.info(f"LangChain configuration loaded - Model: {self.model_name}, Temperature: {self.temperature}")
    
    def get_llm(self) -> ChatOpenAI:
        """Get configured LLM instance"""
        if not self.llm:
            self.llm = ChatOpenAI(
                api_key=self.openai_api_key,
                model=self.model_name,
                temperature=self.temperature,
                streaming=True
            )
        return self.llm
    
    def _initialize_default_tools(self):
        """Initialize default LangChain tools"""
        
        # Web search tool
        web_search_tool = LangChainTool(
            name="web_search",
            description="Search the web for current information",
            func=self._web_search_func
        )
        self.tools["web_search"] = web_search_tool
        
        # Code execution tool
        code_exec_tool = LangChainTool(
            name="code_execution", 
            description="Execute Python code in a safe environment",
            func=self._code_execution_func
        )
        self.tools["code_execution"] = code_exec_tool
        
        # File operations tool
        file_ops_tool = LangChainTool(
            name="file_operations",
            description="Perform file system operations (read, write, list)",
            func=self._file_operations_func
        )
        self.tools["file_operations"] = file_ops_tool
        
        # Calculator tool
        calculator_tool = LangChainTool(
            name="calculator",
            description="Perform mathematical calculations",
            func=self._calculator_func
        )
        self.tools["calculator"] = calculator_tool
        
        # Data analysis tool
        data_analysis_tool = LangChainTool(
            name="data_analysis",
            description="Analyze datasets and generate insights",
            func=self._data_analysis_func
        )
        self.tools["data_analysis"] = data_analysis_tool
        
        logger.info(f"Initialized {len(self.tools)} LangChain tools")
    
    def _initialize_default_chains(self):
        """Initialize default LangChain chains"""
        
        if not self.llm:
            logger.warning("Skipping chain initialization - LLM not available")
            return
        
        # Simple conversation chain
        conversation_chain = ConversationChain(
            llm=self.llm,
            memory=ConversationBufferMemory(),
            verbose=False
        )
        self.chains["conversation"] = conversation_chain
        
        # Research chain with tools
        research_tools = [self.tools["web_search"], self.tools["data_analysis"]]
        research_agent = initialize_agent(
            research_tools,
            self.llm,
            agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
            memory=ConversationBufferMemory(memory_key="chat_history", return_messages=True),
            verbose=False
        )
        self.chains["research"] = research_agent
        
        # Code assistant chain
        code_tools = [self.tools["code_execution"], self.tools["file_operations"]]
        code_agent = initialize_agent(
            code_tools,
            self.llm,
            agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
            memory=ConversationBufferMemory(memory_key="chat_history", return_messages=True),
            verbose=False
        )
        self.chains["code_assistant"] = code_agent
        
        logger.info(f"Initialized {len(self.chains)} LangChain chains")
    
    async def _web_search_func(self, query: str, num_results: int = 5) -> Dict:
        """Web search function (placeholder - integrate with actual search API)"""
        # This would integrate with a real search API like Serper, SerpAPI, etc.
        return {
            "query": query,
            "results": [
                {
                    "title": f"Search result {i+1} for: {query}",
                    "url": f"https://example.com/result-{i+1}",
                    "snippet": f"This is a sample search result snippet for query: {query}"
                }
                for i in range(num_results)
            ],
            "timestamp": datetime.now().isoformat()
        }
    
    async def _code_execution_func(self, code: str, language: str = "python") -> Dict:
        """Code execution function (secure sandbox execution)"""
        try:
            # This would integrate with a secure code execution environment
            # For now, return a mock response
            return {
                "success": True,
                "language": language,
                "code": code,
                "output": f"Mock execution output for code: {code[:100]}...",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _file_operations_func(self, operation: str, path: str, content: Optional[str] = None) -> Dict:
        """File operations function"""
        try:
            if operation == "read":
                # Read file (with security checks)
                return {"content": f"Mock file content from {path}", "operation": "read"}
            elif operation == "write":
                # Write file (with security checks)
                return {"success": True, "operation": "write", "path": path}
            elif operation == "list":
                # List directory (with security checks)
                return {"files": ["file1.txt", "file2.py", "dir1/"], "operation": "list"}
            else:
                return {"error": f"Unknown operation: {operation}"}
        except Exception as e:
            return {"error": str(e)}
    
    async def _calculator_func(self, expression: str) -> Dict:
        """Calculator function"""
        try:
            # Safe mathematical expression evaluation
            import ast
            import operator
            
            # Allowed operations
            ops = {
                ast.Add: operator.add,
                ast.Sub: operator.sub,
                ast.Mult: operator.mul,
                ast.Div: operator.truediv,
                ast.Pow: operator.pow,
                ast.USub: operator.neg,
            }
            
            def eval_expr(expr):
                return eval_node(ast.parse(expr, mode='eval').body)
            
            def eval_node(node):
                if isinstance(node, ast.Constant):
                    return node.value
                elif isinstance(node, ast.BinOp):
                    return ops[type(node.op)](eval_node(node.left), eval_node(node.right))
                elif isinstance(node, ast.UnaryOp):
                    return ops[type(node.op)](eval_node(node.operand))
                else:
                    raise TypeError(node)
            
            result = eval_expr(expression)
            return {
                "expression": expression,
                "result": result,
                "success": True
            }
        except Exception as e:
            return {
                "expression": expression,
                "error": str(e),
                "success": False
            }
    
    async def _data_analysis_func(self, data: Any, analysis_type: str = "descriptive") -> Dict:
        """Data analysis function"""
        try:
            # Mock data analysis - would integrate with pandas/numpy/scipy
            return {
                "analysis_type": analysis_type,
                "summary": f"Mock analysis results for {analysis_type} analysis",
                "insights": [
                    "Data contains numerical patterns",
                    "Trends indicate positive correlation",
                    "Statistical significance detected"
                ],
                "recommendations": [
                    "Consider further investigation",
                    "Collect additional data points",
                    "Validate findings with domain experts"
                ],
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {"error": str(e)}
    
    async def create_chain(self, config: ChainConfiguration) -> str:
        """Create a new LangChain chain"""
        try:
            chain_id = config.id
            
            # Create LLM with specific configuration
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OpenAI API key not found")
            
            llm = ChatOpenAI(
                model=config.model_name,
                temperature=config.temperature
            )
            
            # Create memory if specified
            memory = None
            if config.memory_type:
                if config.memory_type == MemoryType.BUFFER:
                    memory = ConversationBufferMemory()
                elif config.memory_type == MemoryType.SUMMARY:
                    memory = ConversationSummaryMemory(llm=llm)
                
                if memory:
                    self.memories[chain_id] = memory
            
            # Create chain based on type
            if config.chain_type == ChainType.SIMPLE:
                prompt = PromptTemplate(
                    template=config.prompt_template or "{input}",
                    input_variables=["input"]
                )
                chain = LLMChain(llm=llm, prompt=prompt, memory=memory)
                
            elif config.chain_type == ChainType.CONVERSATION:
                chain = ConversationChain(llm=llm, memory=memory or ConversationBufferMemory())
                
            elif config.chain_type == ChainType.AGENT:
                # Get tools for agent
                agent_tools = [self.tools[tool_name] for tool_name in config.tools if tool_name in self.tools]
                chain = initialize_agent(
                    agent_tools,
                    llm,
                    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
                    memory=memory or ConversationBufferMemory(memory_key="chat_history", return_messages=True),
                    verbose=False
                )
            else:
                raise ValueError(f"Unsupported chain type: {config.chain_type}")
            
            self.chains[chain_id] = chain
            logger.info(f"Created chain '{chain_id}' of type {config.chain_type}")
            return chain_id
            
        except Exception as e:
            logger.error(f"Error creating chain: {e}")
            raise
    
    async def execute_chain(self, chain_id: str, input_data: Dict[str, Any]) -> Dict:
        """Execute a specific chain"""
        try:
            if chain_id not in self.chains:
                return {
                    "success": False,
                    "error": f"Chain '{chain_id}' not found"
                }
            
            chain = self.chains[chain_id]
            
            # Execute the chain
            if hasattr(chain, 'run'):
                result = chain.run(input_data.get("input", ""))
            elif hasattr(chain, 'invoke'):
                result = chain.invoke(input_data)
            else:
                result = chain(input_data)
            
            return {
                "success": True,
                "chain_id": chain_id,
                "result": result,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error executing chain {chain_id}: {e}")
            return {
                "success": False,
                "chain_id": chain_id,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def add_tool(self, tool: LangChainTool):
        """Add a custom tool"""
        self.tools[tool.name] = tool
        logger.info(f"Added tool '{tool.name}'")
    
    async def remove_tool(self, tool_name: str):
        """Remove a tool"""
        if tool_name in self.tools:
            del self.tools[tool_name]
            logger.info(f"Removed tool '{tool_name}'")
    
    async def get_available_tools(self) -> List[Dict]:
        """Get list of available tools"""
        return [
            {
                "name": tool.name,
                "description": tool.description
            }
            for tool in self.tools.values()
        ]
    
    async def get_chains(self) -> List[str]:
        """Get list of available chains"""
        return list(self.chains.keys())
    
    async def delete_chain(self, chain_id: str):
        """Delete a chain"""
        if chain_id in self.chains:
            del self.chains[chain_id]
            if chain_id in self.memories:
                del self.memories[chain_id]
            logger.info(f"Deleted chain '{chain_id}'")
    
    async def create_vectorstore(self, documents: List[str], collection_name: str = "cartrita_docs"):
        """Create a vector store for document retrieval"""
        try:
            # Split documents
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            
            texts = []
            for doc in documents:
                texts.extend(text_splitter.split_text(doc))
            
            # Create vectorstore
            self.vectorstore = Chroma.from_texts(
                texts,
                self.embeddings,
                collection_name=collection_name
            )
            
            logger.info(f"Created vectorstore with {len(texts)} chunks")
            return True
            
        except Exception as e:
            logger.error(f"Error creating vectorstore: {e}")
            return False
    
    async def create_retrieval_chain(self, chain_id: str, query: str, k: int = 4) -> Dict:
        """Create and execute a retrieval-based QA chain"""
        try:
            if not self.vectorstore:
                return {
                    "success": False,
                    "error": "No vectorstore available. Create one first."
                }
            
            if not self.llm:
                return {
                    "success": False,
                    "error": "LLM not available - OpenAI API key may be missing."
                }
            
            # Create retriever
            retriever = self.vectorstore.as_retriever(search_kwargs={"k": k})
            
            # Create compression retriever for better results
            compressor = LLMChainExtractor.from_llm(self.llm)
            compression_retriever = ContextualCompressionRetriever(
                base_compressor=compressor,
                base_retriever=retriever
            )
            
            # Get relevant documents
            docs = compression_retriever.get_relevant_documents(query)
            
            # Create context from retrieved docs
            context = "\n\n".join([doc.page_content for doc in docs])
            
            # Create QA prompt
            qa_prompt = f"""
            Based on the following context, please answer the question.
            
            Context:
            {context}
            
            Question: {query}
            
            Answer:
            """
            
            # Get answer from LLM using proper message objects
            messages: List[BaseMessage] = [HumanMessage(content=qa_prompt)]
            response = await self.llm.agenerate([messages])
            answer = response.generations[0][0].text
            
            return {
                "success": True,
                "chain_id": chain_id,
                "query": query,
                "answer": answer,
                "retrieved_docs": len(docs),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in retrieval chain: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_chain_status(self) -> Dict:
        """Get status of all chains and tools"""
        return {
            "chains": {
                "count": len(self.chains),
                "active": list(self.chains.keys())
            },
            "tools": {
                "count": len(self.tools),
                "available": [tool.name for tool in self.tools.values()]
            },
            "memories": {
                "count": len(self.memories),
                "active": list(self.memories.keys())
            },
            "vectorstore": {
                "available": self.vectorstore is not None
            },
            "timestamp": datetime.now().isoformat()
        }

# Global configuration instance will be initialized by the agent manager
langchain_config = None

def initialize_langchain() -> LangChainConfig:
    """Initialize the global LangChain configuration"""
    global langchain_config
    if not langchain_config:
        langchain_config = LangChainConfig()
    return langchain_config

def get_langchain_config() -> Optional[LangChainConfig]:
    """Get the global LangChain configuration"""
    return langchain_config